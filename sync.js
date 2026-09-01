/* ============================================================
   ZIA'S COMMAND CENTRE — cloud sync (Supabase)
   Offline-first: localStorage stays the working store.
   Cloud is the shared truth across laptop / mobile / iPad.

   FIXED VERSION (3 bugs):
   1) Sign-in now PULLS before it PUSHES, and refuses to upload
      another account's data left in this browser (account guard).
   2) A pull will never overwrite local edits that haven't been
      pushed yet — it flushes the pending push first (dirty-guard).
   3) Deletions no longer come back: the upsert no longer sends the
      'deleted' column, so a row deleted on another device is never
      resurrected.
   ============================================================ */
window.CC_SYNC = (function () {
  'use strict';

  const URL_ = 'https://mtwkyzqjxncutazmqujl.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10d2t5enFqeG5jdXRhem1xdWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMjA3ODIsImV4cCI6MjA5MzY5Njc4Mn0.nWi6l_ZZC3yhpHpOdKM9gggo4gVlaXfnj3L-RZx_pzw'; // ← keep the same eyJ... key that is already in your current sync.js

  const KINDS  = { ideas: 'idea', tasks: 'task', projects: 'project', leads: 'lead' };
  const BUCKET = { idea: 'ideas', task: 'tasks', project: 'projects', lead: 'leads' };
  const TOMB   = 'zia_cc_deleted';   // ids deleted locally, waiting to be pushed
  const OWNER  = 'zia_cc_owner';     // FIX 1: which user's data currently sits in this browser

  let sb = null;              // supabase client
  let user = null;            // logged-in user
  let hooks = {};             // { getState, setState, onStatus, onAuth }
  let pulling = false, pushing = false;
  let timer = null;
  let pt = null;              // pending debounced push timer

  /* ---------- tombstones ---------- */
  const tombs = () => { try { return JSON.parse(localStorage.getItem(TOMB) || '[]'); } catch (e) { return []; } };
  const addTomb = id => {
    const t = tombs();
    if (!t.includes(id)) { t.push(id); localStorage.setItem(TOMB, JSON.stringify(t.slice(-500))); }
  };
  const clearTombs = ids => {
    localStorage.setItem(TOMB, JSON.stringify(tombs().filter(x => !ids.includes(x))));
  };

  /* ---------- status ---------- */
  function status(text, tone) {
    if (hooks.onStatus) hooks.onStatus(text, tone || 'idle');
  }

  /* ---------- init ---------- */
  function init(h) {
    hooks = h || {};
    if (!window.supabase) { status('Cloud library not loaded', 'err'); return null; }
    sb = window.supabase.createClient(URL_, ANON, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'zia_cc_auth' }
    });

    sb.auth.getSession().then(({ data }) => {
      if (data && data.session) { onSignedIn(data.session.user); }
      else { if (hooks.onAuth) hooks.onAuth(null); }
    });

    sb.auth.onAuthStateChange((evt, session) => {
      if (session && session.user) onSignedIn(session.user);
      else onSignedOut();
    });

    // pull when the tab regains focus (other device may have changed things)
    window.addEventListener('focus', () => { if (user) pull(); });
    return sb;
  }

  /* ---------- FIX 1: account guard ----------
     If the data sitting in this browser belongs to a DIFFERENT user,
     wipe the working store (and pending deletions) before syncing so
     we never upload one account's items into another account. */
  function guardAccount(u) {
    let prev = null;
    try { prev = localStorage.getItem(OWNER); } catch (e) {}
    if (prev && prev !== u.id) {
      hooks.setState({ ideas: [], tasks: [], projects: [], leads: [] });
      try { localStorage.setItem(TOMB, '[]'); } catch (e) {}
    }
    try { localStorage.setItem(OWNER, u.id); } catch (e) {}
  }

  function onSignedIn(u) {
    if (user && user.id === u.id) return;
    user = u;
    if (hooks.onAuth) hooks.onAuth(u);
    guardAccount(u);          // FIX 1
    syncNow();                // FIX 1: syncNow now pulls before it pushes
    if (timer) clearInterval(timer);
    timer = setInterval(() => { if (user) pull(); }, 60000);
  }

  function onSignedOut() {
    user = null;
    if (timer) { clearInterval(timer); timer = null; }
    if (hooks.onAuth) hooks.onAuth(null);
    status('Signed out', 'idle');
  }

  /* ---------- auth actions ---------- */
  async function signIn(email, pass) {
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) throw error;
    return data.user;
  }
  async function signUp(email, pass) {
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pass });
    if (error) throw error;
    return data;
  }
  async function signOut() { await sb.auth.signOut(); }

  /* ---------- flatten / rebuild ---------- */
  function localRows() {
    const S = hooks.getState();
    const rows = [];
    Object.keys(KINDS).forEach(bucket => {
      (S[bucket] || []).forEach(obj => {
        rows.push({
          id: String(obj.id),
          user_id: user.id,
          kind: KINDS[bucket],
          data: obj
          // FIX 3: 'deleted' is intentionally NOT sent.
          // New rows get the column default (false); existing rows keep
          // whatever 'deleted' value the cloud already has, so an item
          // deleted on another device is never brought back to life.
        });
      });
    });
    return rows;
  }

  /* ---------- PULL: cloud -> local (merge) ---------- */
  async function pull() {
    if (!user || pulling) return;

    // FIX 2: flush any pending local edit BEFORE pulling, otherwise the
    // incoming cloud copy would overwrite an edit that hasn't been saved yet.
    if (pt) { clearTimeout(pt); pt = null; await push(); }

    pulling = true;
    try {
      const { data, error } = await sb.from('cc_items')
        .select('id,kind,data,deleted,updated_at')
        .eq('user_id', user.id);
      if (error) throw error;

      const S = hooks.getState();
      const dead = new Set(tombs());
      const merged = { ideas: [], tasks: [], projects: [], leads: [] };
      const seen = new Set();

      // cloud rows first
      (data || []).forEach(row => {
        if (row.deleted || dead.has(row.id)) return;
        const b = BUCKET[row.kind];
        if (!b) return;
        const obj = row.data || {};
        obj.id = row.id;
        merged[b].push(obj);
        seen.add(row.id);
      });

      // local-only rows (not yet pushed) survive
      Object.keys(merged).forEach(b => {
        (S[b] || []).forEach(obj => {
          if (!seen.has(String(obj.id)) && !dead.has(String(obj.id))) merged[b].push(obj);
        });
        merged[b].sort((a, c) => (c.ts || 0) - (a.ts || 0));
      });

      hooks.setState(merged);
      const n = merged.ideas.length + merged.tasks.length + merged.projects.length + merged.leads.length;
      status('Synced · ' + n + ' items', 'ok');
    } catch (e) {
      status('Sync failed: ' + (e.message || e), 'err');
    } finally { pulling = false; }
  }

  /* ---------- PUSH: local -> cloud ---------- */
  async function push() {
    if (!user || pushing) return;
    pushing = true;
    try {
      // 1. push deletions
      const t = tombs();
      if (t.length) {
        const { error } = await sb.from('cc_items')
          .update({ deleted: true }).in('id', t).eq('user_id', user.id);
        if (!error) clearTombs(t);
      }
      // 2. upsert everything current (without the 'deleted' column — see FIX 3)
      const rows = localRows();
      if (rows.length) {
        const { error } = await sb.from('cc_items').upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }
      status('Saved to cloud', 'ok');
    } catch (e) {
      status('Save failed: ' + (e.message || e), 'err');
    } finally { pushing = false; }
  }

  /* ---------- FIX 1: pull first, then push ---------- */
  async function syncNow() {
    if (!user) return;
    status('Syncing…', 'busy');
    await pull();
    await push();
  }

  /* debounced push after local edits */
  function markDirty(deletedId) {
    if (deletedId) addTomb(String(deletedId));
    if (!user) return;
    status('Saving…', 'busy');
    clearTimeout(pt);
    pt = setTimeout(() => { pt = null; push(); }, 900);
  }

  return {
    init, signIn, signUp, signOut, pull, push, syncNow, markDirty,
    isOn: () => !!user,
    email: () => (user ? user.email : null)
  };
})();
