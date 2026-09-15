---
name: zia-os-log
description: Save Zia's finished work or a new idea into ZIA OS (Work Log / Idea Bank). Use when Zia sends /work, /idea, "log:", "idea:", or asks to save something he did or thought of.
---

# ZIA OS logger

Zia sends rough notes on Telegram, often mixed Bangla and English. Your job:
polish the language, fill the fields, show him a preview, and save only after he says OK.

## 1. Decide the kind
- `/work`, "log:", "done:", "I finished / I built / I fixed" → **work**
- `/idea`, "idea:", "what if", "we could" → **idea**
- Not sure → ask one short question.

## 2. Polish the language
- Write in clear, professional English. Translate Bangla into English.
- Keep technical terms and product names exactly (Oracle APEX, PL/SQL, n8n, Supabase, RAG, H&M portal).
- Never invent facts, numbers or results he did not give.
- `title`: one line, max 90 characters, starts with a past-tense verb for work ("Built…", "Fixed…").
- `learned` (work) / `body` (idea): 1–3 short sentences.

## 3. Fill the fields

Work:
- `biz`: one of `Nexa AI`, `Sky View`, `Amanah`, `APEX`, `Personal`
- `block`: one of `B1 Build`, `B2 Ship`, `B3 Docs`, `B4 Research`, `B7 Study`, `B8 Debug`, `Other`
- `hours`: number he gave, else 0
- `plan`: a plan ID like `P2.W7.T1` only if he wrote one, else empty
- `share`: true only if the work is something he could post about publicly (a build, a launch, a lesson); false for client-private or internal fixes
- `date`: only if he says a day other than today (format YYYY-MM-DD)

Idea:
- `cat`: one of `Automation`, `Business`, `Product`, `Marketing`, `Personal`
- `biz`: one of `Nexa AI`, `Amanah`, `Sky View`, `APEX`, `General`

## 4. Preview and wait
Reply with the polished entry in this shape and wait:

```
📝 WORK — Nexa AI · B1 Build · 2h · shareable
Built the Sky View RAG chatbot's lead-capture flow
Learned: n8n webhooks need the production URL, not the test URL.
Reply OK to save, or tell me what to change.
```

Save ONLY after he replies OK / ঠিক আছে / yes. If he corrects something, show the preview again.

## 5. Save
Run exactly (JSON in single quotes, escape any single quote in the text as `'\''`):

```
python3 ~/zia_os_add.py work '{"title":"...","biz":"...","block":"...","hours":2,"learned":"...","share":true,"plan":""}'
python3 ~/zia_os_add.py idea '{"title":"...","body":"...","cat":"...","biz":"..."}'
```

- Output starts with `OK saved` → reply "✅ Saved to ZIA OS".
- Output starts with `ERROR` → send him the error line unchanged. Do not retry more than once.
- Never print or repeat the contents of `~/.zia_os.env`.
