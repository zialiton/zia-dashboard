/* ============================================================
   ZIA'S COMMAND CENTRE — worklog.js
   Work Log tab: one entry per build block — what actually shipped.
   This is the "complete work list" that Claude and Hermes study.

   - Own store: localStorage key 'zia_cc_work_v1' (array of entries)
   - Cloud: sync.js reads/writes this bucket as kind = 'work'
   - Also builds the "AI brief" (Settings tab) from ALL app data
   ============================================================ */
window.CC_WORK = (function () {
  'use strict';

  const LS = 'zia_cc_work_v1';        // this tab's own store
  const APP_LS = 'zia_cc_v1';         // app.js store (ideas, tasks, projects, leads) — read only

  /* ---------- helpers (same style as app.js) ---------- */
  const $ = id => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayISO = () => {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  /* ---------- store ---------- */
  let W = [];
  try { W = JSON.parse(localStorage.getItem(LS) || '[]'); if (!Array.isArray(W)) W = []; }
  catch (e) { W = []; }

  function persist(deletedId) {
    localStorage.setItem(LS, JSON.stringify(W));
    if (window.CC_SYNC) window.CC_SYNC.markDirty(deletedId);
  }

  /* Public: used by sync.js */
  function get() { return W; }
  function set(arr) {
    W = Array.isArray(arr) ? arr : [];
    localStorage.setItem(LS, JSON.stringify(W));
    render();
  }

  /* ============================================================
     28-WEEK PLAN CALENDAR (Aug 3 2026 → Feb 14 2027)
     Week n starts on Sunday Aug 3 + 7*(n-1) days.
     ============================================================ */
  const PLAN_START = new Date(2026, 7, 3);   // month is 0-based → 7 = August
  const PHASES = [
    { p: 'P1', from: 1,  to: 6,  name: 'Sky View RAG + voice · skyvre.com' },
    { p: 'P2', from: 7,  to: 9,  name: 'Nexa AI clone + productize · nexaaibd.com' },
    { p: 'P3', from: 10, to: 16, name: 'Amanah WooCommerce · amanahsmart.com' },
    { p: 'P4', from: 17, to: 20, name: 'Facebook ad automation · Amanah' },
    { p: 'P5', from: 21, to: 28, name: 'H&M / RMG agentic automation' }
  ];
  function weekOf(dateStr) {
    const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const n = Math.floor((d - PLAN_START) / (7 * 864e5)) + 1;
    return n;                                   // may be <1 (before plan) or >28 (after)
  }
  function phaseOf(week) {
    return PHASES.find(x => week >= x.from && week <= x.to) || null;
  }
  function weekLabel(week) {
    if (week < 1) return 'Before plan start';
    if (week > 28) return 'After plan end';
    const ph = phaseOf(week);
    return (ph ? ph.p + '.' : '') + 'W' + week + (ph ? ' — ' + ph.name : '');
  }
  function weekRange(week) {
    const s = new Date(PLAN_START.getTime() + (week - 1) * 7 * 864e5);
    const e = new Date(s.getTime() + 6 * 864e5);
    const f = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return f(s) + ' – ' + f(e);
  }

  /* ============================================================
     ADD ENTRY
     ============================================================ */
  function bind() {
    if (!$('wkAdd')) return;                    // page not present — nothing to do
    if ($('wkDate') && !$('wkDate').value) $('wkDate').value = todayISO();

    $('wkAdd').onclick = () => {
      const title = $('wkTitle').value.trim();
      if (!title) { alert('What did you ship? Write one line.'); return; }
      const hrs = parseFloat($('wkHours').value);
      W.unshift({
        id: uid(),
        date: $('wkDate').value || todayISO(),
        biz: $('wkBiz').value,
        block: $('wkBlock').value,
        plan: $('wkPlan').value.trim().toUpperCase(),
        title,
        hours: isNaN(hrs) ? 0 : hrs,
        learned: $('wkLearned').value.trim(),
        share: $('wkShare').checked,
        ts: Date.now()
      });
      persist();
      $('wkTitle').value = ''; $('wkPlan').value = ''; $('wkLearned').value = '';
      $('wkHours').value = ''; $('wkShare').checked = false;
      render();
    };

    // filter tabs — app.js already toggles .active; we only re-render
    document.querySelectorAll('.tabs[data-tabs="wkf"] button')
      .forEach(b => b.addEventListener('click', render));

    // list actions (delete / toggle shareable / copy post draft)
    $('workList').addEventListener('click', e => {
      const del = e.target.closest('[data-delwork]');
      if (del) {
        if (!confirm('Delete this work entry?')) return;
        const id = del.dataset.delwork;
        W = W.filter(x => x.id !== id); persist(id); render(); return;
      }
      const sh = e.target.closest('[data-sharework]');
      if (sh) {
        const w = W.find(x => x.id === sh.dataset.sharework);
        if (w) { w.share = !w.share; w.ts = Date.now(); persist(); render(); }
        return;
      }
      const cp = e.target.closest('[data-postwork]');
      if (cp) {
        const w = W.find(x => x.id === cp.dataset.postwork);
        if (w) copyText(postDraft(w), cp);
      }
    });

    // Settings: AI brief
    if ($('btnBrief')) $('btnBrief').onclick = () => {
      const txt = buildBrief();
      if ($('briefOut')) { $('briefOut').value = txt; $('briefOut').style.display = ''; }
      copyText(txt, $('btnBrief'));
    };
  }

  function copyText(txt, btn) {
    const done = () => {
      if (!btn) return;
      const old = btn.textContent; btn.textContent = '✅ Copied';
      setTimeout(() => { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(() => alert('Copy failed — select the text and copy manually.'));
    } else {
      alert('Clipboard not available — select the text and copy manually.');
    }
  }

  /* ============================================================
     RENDER LIST
     ============================================================ */
  function activeFilter() {
    const b = document.querySelector('.tabs[data-tabs="wkf"] button.active');
    return b ? b.dataset.tab : 'week';
  }

  function render() {
    if (!$('workList')) return;
    const f = activeFilter();
    const thisWeek = weekOf();
    let list = W.slice().sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0) || (b.ts - a.ts));
    if (f === 'week') list = list.filter(w => weekOf(w.date) === thisWeek);
    else if (f === 'last') list = list.filter(w => weekOf(w.date) === thisWeek - 1);
    else if (f === 'share') list = list.filter(w => w.share);

    // stats for THIS week
    const wk = W.filter(w => weekOf(w.date) === thisWeek);
    const hrs = wk.reduce((s, w) => s + (Number(w.hours) || 0), 0);
    if ($('wkStats')) $('wkStats').textContent =
      `${wk.length} entries · ${hrs % 1 ? hrs.toFixed(1) : hrs} hrs this week · ${W.filter(w => w.share).length} shareable`;
    if ($('wkWeekNow')) $('wkWeekNow').textContent = weekLabel(thisWeek) + ' · ' + weekRange(thisWeek);

    // group by date
    const groups = [];
    list.forEach(w => {
      let g = groups[groups.length - 1];
      if (!g || g.date !== w.date) { g = { date: w.date, items: [] }; groups.push(g); }
      g.items.push(w);
    });

    $('workList').innerHTML = groups.length ? groups.map(g => {
      const d = new Date(g.date + 'T12:00:00');
      const head = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const wl = weekOf(g.date);
      return `
      <div class="wk-day">
        <div class="wk-dayhead"><span>${esc(head)}</span><span class="tag">${wl >= 1 && wl <= 28 ? 'W' + wl : '—'}</span></div>
        ${g.items.map(w => `
        <div class="item ${w.share ? 'p-med' : ''}">
          <div class="head">
            <div class="ttl">${esc(w.title)}</div>
            <span class="tag ${w.share ? 'y' : ''}">${w.share ? '📣 Shareable' : 'Private'}</span>
          </div>
          ${w.learned ? `<div class="body">💡 ${esc(w.learned)}</div>` : ''}
          <div class="foot">
            <span class="tag b">${esc(w.biz)}</span>
            ${w.plan ? `<span class="tag p">${esc(w.plan)}</span>` : ''}
            <span class="tag">${esc(w.block)}</span>
            ${w.hours ? `<span class="tag">⏱ ${esc(w.hours)} h</span>` : ''}
            <button class="btn sm ghost" data-sharework="${w.id}">${w.share ? 'Make private' : 'Mark shareable'}</button>
            ${w.share ? `<button class="btn sm" data-postwork="${w.id}">📋 Copy post draft</button>` : ''}
            <button class="btn sm ghost" data-delwork="${w.id}">Delete</button>
          </div>
        </div>`).join('')}
      </div>`;
    }).join('') : '<div class="empty">Nothing logged here yet. After every build block, write one line: what shipped.</div>';
  }

  /* ============================================================
     MARKETING — post draft from one work entry
     ============================================================ */
  function postDraft(w) {
    return [
      `[LinkedIn / Facebook draft — ${w.date} — ${w.biz}]`,
      '',
      `Shipped this week: ${w.title}`,
      '',
      w.learned ? `What I learned: ${w.learned}` : 'What I learned: (one honest line)',
      '',
      `Built on: n8n · Supabase · Claude — for ${w.biz === 'Nexa AI' ? 'a Bangladesh business' : w.biz}.`,
      'Who has this problem? (one line about the reader)',
      '',
      '#BuildInPublic #NexaAI #Bangladesh #Automation'
    ].join('\n');
  }

  /* ============================================================
     AI BRIEF — compact markdown for Claude / Hermes to study
     ============================================================ */
  function readApp() {
    try { return Object.assign({ ideas: [], tasks: [], projects: [], leads: [] }, JSON.parse(localStorage.getItem(APP_LS) || '{}')); }
    catch (e) { return { ideas: [], tasks: [], projects: [], leads: [] }; }
  }

  function buildBrief() {
    const S = readApp();
    const today = todayISO();
    const wkNow = weekOf();
    const ph = phaseOf(wkNow);
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const recent = W.filter(w => w.date >= since).sort((a, b) => (b.date > a.date ? 1 : -1));
    const hrs = recent.reduce((s, w) => s + (Number(w.hours) || 0), 0);
    const line = (w) => `- ${w.date} · ${w.biz} · ${w.plan || '—'} · ${w.block} · ${w.hours || 0}h · ${w.title}${w.learned ? ' · learned: ' + w.learned : ''}${w.share ? ' · [shareable]' : ''}`;

    const openTasks = S.tasks.filter(t => !t.done).sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.pri] - { high: 0, med: 1, low: 2 }[b.pri]));
    const doneTasks = S.tasks.filter(t => t.done).slice(0, 10);

    const out = [];
    out.push(`# ZIA OS — AI brief · ${today}`);
    out.push('');
    out.push('## Where I am in the 28-week plan');
    out.push(`- Today: ${weekLabel(wkNow)} (${weekRange(wkNow)})`);
    if (ph) out.push(`- Phase: ${ph.p} weeks W${ph.from}–W${ph.to}`);
    out.push('- Blocks: B1 build Sun–Thu 2–4 PM · B2 ship Sun–Wed 9:30 PM · B3 docs Thu · B4 research Sat 2 PM · B5 review Sat 9:30 PM');
    out.push('');
    out.push(`## Work log — last 14 days (${recent.length} entries, ${hrs} hrs)`);
    out.push(recent.length ? recent.map(line).join('\n') : '- (nothing logged)');
    out.push('');
    out.push(`## Open tasks (${openTasks.length})`);
    out.push(openTasks.length ? openTasks.map(t => `- [${t.pri}] ${t.biz} · ${t.title}${t.due ? ' · due ' + t.due : ''}`).join('\n') : '- (none)');
    out.push('');
    out.push(`## Recently completed tasks (${doneTasks.length})`);
    out.push(doneTasks.length ? doneTasks.map(t => `- ${t.biz} · ${t.title}`).join('\n') : '- (none)');
    out.push('');
    out.push(`## Idea bank (${S.ideas.length}, newest first)`);
    out.push(S.ideas.length ? S.ideas.slice(0, 20).map(i => `- [${i.cat}/${i.biz}] ${i.title}${i.body ? ' — ' + String(i.body).slice(0, 140) : ''}`).join('\n') : '- (none)');
    out.push('');
    out.push(`## Nexa projects (${S.projects.length})`);
    out.push(S.projects.length ? S.projects.map(p => `- ${p.stage} · ${p.title || p.name || ''}`).join('\n') : '- (none)');
    out.push('');
    out.push(`## Client pipeline (${S.leads.length})`);
    out.push(S.leads.length ? S.leads.map(l => `- ${l.stage} · ${l.name || l.title || ''}${l.value ? ' · ৳' + l.value : ''}`).join('\n') : '- (none)');
    out.push('');
    out.push('## What I want from you');
    out.push('1. What actually shipped vs the plan week? Am I on timeline? If not, what do I cut (not "work harder").');
    out.push('2. The ONE next step for tomorrow\'s B1 block.');
    out.push('3. From the [shareable] entries, draft one LinkedIn post (build-in-public, Nexa AI voice).');
    out.push('4. Any risk you see across the four businesses.');
    return out.join('\n');
  }

  /* ---------- boot ---------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { bind(); render(); });
  else { bind(); render(); }

  return { get, set, render, buildBrief, weekOf, weekLabel };
})();
