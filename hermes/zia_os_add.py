#!/usr/bin/env python3
"""zia_os_add.py - save one Work Log entry or Idea into ZIA OS (Supabase table cc_items).

Usage:
  python3 zia_os_add.py work '{"title":"...","biz":"Nexa AI","block":"B1 Build","hours":2,"learned":"...","share":true,"plan":"P2.W7.T1"}'
  python3 zia_os_add.py idea '{"title":"...","body":"...","cat":"Automation","biz":"Nexa AI"}'
  add --dry-run at the end to print the row without saving.

Secrets are read from ~/.zia_os.env (chmod 600), never from this file.
"""
import json, os, sys, time, random, string, datetime, urllib.request, urllib.error

ENV_FILE = os.path.expanduser("~/.zia_os.env")

WORK_BIZ = ["Nexa AI", "Sky View", "Amanah", "APEX", "Personal"]
BLOCKS = ["B1 Build", "B2 Ship", "B3 Docs", "B4 Research", "B7 Study", "B8 Debug", "Other"]
IDEA_BIZ = ["Nexa AI", "Amanah", "Sky View", "APEX", "General"]
IDEA_CAT = ["Automation", "Business", "Product", "Marketing", "Personal"]


def fail(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def load_env():
    if not os.path.exists(ENV_FILE):
        fail("missing " + ENV_FILE)
    env = {}
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
    for k in ("ZIA_SUPABASE_URL", "ZIA_SUPABASE_SERVICE_KEY", "ZIA_USER_ID"):
        if not env.get(k):
            fail(k + " is empty in " + ENV_FILE)
    return env


def uid():
    # same shape as app.js uid(): base36 milliseconds + 5 random chars
    n, digits, s = int(time.time() * 1000), string.digits + string.ascii_lowercase, ""
    while n:
        n, r = divmod(n, 36)
        s = digits[r] + s
    return s + "".join(random.choice(digits) for _ in range(5))


def today_dhaka():
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=6)).strftime("%Y-%m-%d")


def pick(value, allowed, default):
    return value if value in allowed else default


def build(kind, d):
    title = str(d.get("title", "")).strip()
    if not title:
        fail("title is required")
    now = int(time.time() * 1000)
    if kind == "work":
        try:
            hours = float(d.get("hours", 0) or 0)
        except ValueError:
            hours = 0
        return {
            "id": uid(),
            "date": str(d.get("date") or today_dhaka()),
            "biz": pick(d.get("biz"), WORK_BIZ, "Personal"),
            "block": pick(d.get("block"), BLOCKS, "Other"),
            "plan": str(d.get("plan", "")).strip().upper(),
            "title": title,
            "hours": hours,
            "learned": str(d.get("learned", "")).strip(),
            "share": bool(d.get("share", False)),
            "ts": now,
        }
    if kind == "idea":
        return {
            "id": uid(),
            "title": title,
            "cat": pick(d.get("cat"), IDEA_CAT, "Business"),
            "biz": pick(d.get("biz"), IDEA_BIZ, "General"),
            "body": str(d.get("body", "")).strip(),
            "ts": now,
            "promoted": False,
        }
    fail("kind must be work or idea")


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry = "--dry-run" in sys.argv
    if len(args) != 2:
        fail("usage: zia_os_add.py work|idea '<json>' [--dry-run]")
    kind = args[0]
    try:
        data = json.loads(args[1])
    except json.JSONDecodeError as e:
        fail("bad JSON: " + str(e))
    obj = build(kind, data)
    if dry:
        print(json.dumps({"kind": kind, "data": obj}, ensure_ascii=False, indent=2))
        return
    env = load_env()
    row = {"id": obj["id"], "user_id": env["ZIA_USER_ID"], "kind": kind, "data": obj}
    key = env["ZIA_SUPABASE_SERVICE_KEY"]
    headers = {"apikey": key, "Content-Type": "application/json", "Prefer": "return=minimal"}
    # new-style keys (sb_secret_...) are not JWTs: send them in the apikey header only.
    # legacy service_role keys (eyJ...) also need the Authorization header.
    if not key.startswith("sb_"):
        headers["Authorization"] = "Bearer " + key
    req = urllib.request.Request(
        env["ZIA_SUPABASE_URL"].rstrip("/") + "/rest/v1/cc_items",
        data=json.dumps(row).encode("utf-8"),
        method="POST",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print("OK saved " + kind + " " + obj["id"] + " (HTTP " + str(r.status) + ")")
    except urllib.error.HTTPError as e:
        fail("Supabase HTTP " + str(e.code) + ": " + e.read().decode("utf-8", "ignore"))
    except urllib.error.URLError as e:
        fail("network: " + str(e.reason))


if __name__ == "__main__":
    main()
