/* ============================================================
   ZIA'S COMMAND CENTRE — app.js
   Data: window.CC_DATA (quran, hadith, news) from data.js
   User data: localStorage (ideas, tasks, projects, leads)
   ============================================================ */
(function () {
  'use strict';

  const D = window.CC_DATA || { quran: [], hadith: [], news: {} };
  const LS = 'zia_cc_v1';

  /* ---------- storage ---------- */
  const blank = { ideas: [], tasks: [], projects: [], leads: [] };
  let S;
  try { S = Object.assign({}, blank, JSON.parse(localStorage.getItem(LS) || '{}')); }
  catch (e) { S = Object.assign({}, blank); }
  const save = (deletedId) => {
    localStorage.setItem(LS, JSON.stringify(S));
    if (window.CC_SYNC) window.CC_SYNC.markDirty(deletedId);
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bn = n => Number(n || 0).toLocaleString('en-IN');
  const $ = id => document.getElementById(id);

  /* ---------- day index (rotates daily, stable) ---------- */
  const dayNum = Math.floor(Date.now() / 864e5);

  /* ============================================================
     NAVIGATION
     ============================================================ */
  const TITLES = {
    home: ['Home', 'Everything at a glance'],
    nexa: ['Nexa AI Solutions', 'Automation project board'],
    pipeline: ['Client Pipeline', 'Lead → Prospect → Client'],
    islamic: ['Islamic Reader', 'Quran · Hadith · Sahaba'],
    news: ['News', 'Bangladesh · International · Tech'],
    email: ['Inbox', 'Unread mail · last 3 days'],
    ideas: ['Idea Bank', 'Automation & business ideas'],
    todo: ['To-Do List', 'Actionable tasks from ideas'],
    invest: ['Investments', 'CDDL · Sky View · Amanah · Nexa'],
    settings: ['Settings', 'Backup & content sources']
  };

  function goto(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = $('page-' + page);
    if (el) el.classList.add('active');
    document.querySelectorAll('.navlist a').forEach(a =>
      a.classList.toggle('active', a.dataset.page === page));
    const t = TITLES[page] || ['', ''];
    $('pageTitle').textContent = t[0];
    $('pageMeta').textContent = t[1];
    $('sidebar').classList.remove('open');
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.navlist a').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); goto(a.dataset.page); }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-goto]');
    if (b) goto(b.dataset.goto);
  });
  $('burger').addEventListener('click', () => $('sidebar').classList.toggle('open'));

  /* ---------- tabs ---------- */
  document.querySelectorAll('.tabs').forEach(bar => {
    const key = bar.dataset.tabs;
    bar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        bar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if (key === 'idf') { renderIdeas(); return; }
        if (key === 'tdf') { renderTasks(); return; }
        const panes = bar.parentElement.querySelectorAll('.tabpane');
        panes.forEach(p => p.classList.remove('active'));
        const target = $(key + '-' + tab);
        if (target) target.classList.add('active');
      });
    });
  });
  const activeTab = key => {
    const bar = document.querySelector(`.tabs[data-tabs="${key}"] button.active`);
    return bar ? bar.dataset.tab : 'all';
  };

  /* ---------- clock ---------- */
  function clock() {
    const now = new Date();
    const d = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const t = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    $('clock').textContent = d + ' · ' + t;
  }
  clock(); setInterval(clock, 30000);

  /* ============================================================
     ISLAMIC READER
     ============================================================ */
  let qi = D.quran.length ? dayNum % D.quran.length : 0;
  let hi = D.hadith.length ? dayNum % D.hadith.length : 0;

  function renderQuran() {
    const v = D.quran[qi];
    if (!v) { $('qSrc').textContent = 'No data'; return; }
    $('qSrc').textContent = v.surah + ' · Ayah ' + v.key.split(':')[1];
    $('qArabic').textContent = v.arabic;
    $('qBangla').textContent = v.bangla;
    $('qCount').textContent = (qi + 1) + ' / ' + D.quran.length;
  }
  function renderHadith() {
    const h = D.hadith[hi];
    if (!h) { $('hSrc').textContent = 'No data'; return; }
    $('hSrc').textContent = h.collection + ' · Hadith #' + h.number + ' · ' + h.grade;
    $('hText').textContent = h.text;
    $('hCount').textContent = (hi + 1) + ' / ' + D.hadith.length;
  }
  const wrap = (i, n) => (i % n + n) % n;
  $('qPrev').onclick = () => { qi = wrap(qi - 1, D.quran.length); renderQuran(); };
  $('qNext').onclick = () => { qi = wrap(qi + 1, D.quran.length); renderQuran(); };
  $('qRand').onclick = () => { qi = Math.floor(Math.random() * D.quran.length); renderQuran(); };
  $('hPrev').onclick = () => { hi = wrap(hi - 1, D.hadith.length); renderHadith(); };
  $('hNext').onclick = () => { hi = wrap(hi + 1, D.hadith.length); renderHadith(); };
  $('hRand').onclick = () => { hi = Math.floor(Math.random() * D.hadith.length); renderHadith(); };

  /* ============================================================
     NEWS
     ============================================================ */
  function newsHTML(list) {
    if (!list || !list.length) return '<div class="empty">No news right now</div>';
    return list.map(n => `
      <div class="news">
        <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>
        ${n.desc ? `<p>${esc(n.desc)}</p>` : ''}
      </div>`).join('');
  }
  function renderNews() {
    const N = D.news || {};
    $('newsBD').innerHTML = newsHTML(N.bangladesh);
    $('newsIntl').innerHTML = newsHTML(N.international);
    $('newsTech').innerHTML = newsHTML(N.tech);
    $('newsMeta').textContent = 'Last updated: ' + (N._updated || '—') +
      ' · Sources: Prothom Alo, BBC Bangla, TechCrunch · auto-refresh every 6h';
    const head = [].concat(N.bangladesh || []).slice(0, 3)
      .concat((N.tech || []).slice(0, 2));
    $('homeNews').innerHTML = newsHTML(head);
  }

  /* ============================================================
     IDEA BANK
     ============================================================ */
  const CAT_TAG = { 'Automation': 'g', 'Business': 'b', 'Product': 'p', 'Marketing': 'y', 'Personal': '' };
  // migrate any Bangla categories saved before the English switch
  const CAT_MIGRATE = { 'অটোমেশন': 'Automation', 'ব্যবসা': 'Business', 'প্রোডাক্ট': 'Product', 'মার্কেটিং': 'Marketing', 'ব্যক্তিগত': 'Personal', 'সাধারণ': 'General' };
  (function migrate() {
    let touched = false;
    S.ideas.forEach(i => {
      if (CAT_MIGRATE[i.cat]) { i.cat = CAT_MIGRATE[i.cat]; touched = true; }
      if (CAT_MIGRATE[i.biz]) { i.biz = CAT_MIGRATE[i.biz]; touched = true; }
    });
    if (touched) save();
  })();

  $('idAdd').onclick = () => {
    const title = $('idTitle').value.trim();
    if (!title) { alert('Enter an idea title'); return; }
    S.ideas.unshift({
      id: uid(), title, cat: $('idCat').value, biz: $('idBiz').value,
      body: $('idBody').value.trim(), ts: Date.now(), promoted: false
    });
    save();
    $('idTitle').value = ''; $('idBody').value = '';
    renderIdeas(); renderHome();
  };

  $('idSearch').addEventListener('input', renderIdeas);

  function renderIdeas() {
    const f = activeTab('idf');
    const q = ($('idSearch').value || '').toLowerCase();
    let list = S.ideas.filter(i =>
      (f === 'all' || i.cat === f) &&
      (!q || (i.title + ' ' + i.body).toLowerCase().includes(q)));

    $('ideaList').innerHTML = list.length ? list.map(i => `
      <div class="item">
        <div class="head">
          <div class="ttl">${esc(i.title)}</div>
          <span class="tag ${CAT_TAG[i.cat] || ''}">${esc(i.cat)}</span>
        </div>
        ${i.body ? `<div class="body">${esc(i.body)}</div>` : ''}
        <div class="foot">
          <span class="tag">${esc(i.biz)}</span>
          <span style="font-size:.74rem;color:var(--muted)">${new Date(i.ts).toLocaleDateString('en-GB')}</span>
          ${i.promoted ? '<span class="tag g">✓ In To-Do</span>'
 : `<button class="btn sm" data-promote="${i.id}">→ Send to To-Do</button>`}
   <button class="btn sm ghost" data-delidea="${i.id}">Delete</button>
        </div>
      </div>`).join('') : '<div class="empty">No ideas yet — capture one above.</div>';
  }

  /* ============================================================
     TO-DO
     ============================================================ */
  const PRI_LABEL = { high: 'High', med: 'Medium', low: 'Low' };
  const PRI_TAG = { high: 'r', med: 'y', low: '' };

  $('tdAdd').onclick = () => {
    const title = $('tdTitle').value.trim();
    if (!title) { alert('Enter a task'); return; }
    S.tasks.unshift({
      id: uid(), title, pri: $('tdPri').value, biz: $('tdBiz').value,
      due: $('tdDue').value, done: false, ts: Date.now()
    });
    save(); $('tdTitle').value = ''; $('tdDue').value = '';
    renderTasks(); renderHome();
  };

  function renderTasks() {
    const f = activeTab('tdf');
    let list = S.tasks.filter(t => f === 'all' || (f === 'done' ? t.done : !t.done));
    const order = { high: 0, med: 1, low: 2 };
    list.sort((a, b) => (a.done - b.done) || (order[a.pri] - order[b.pri]) || (b.ts - a.ts));

    const open = S.tasks.filter(t => !t.done).length;
    $('tdStats').textContent = `${open} open · ${S.tasks.length - open} done`;

    $('taskList').innerHTML = list.length ? list.map(t => {
      const overdue = t.due && !t.done && t.due < new Date().toISOString().slice(0, 10);
      return `
      <div class="item p-${t.pri} ${t.done ? 'done' : ''}">
        <div class="head">
          <div class="ttl">${esc(t.title)}</div>
          <span class="tag ${PRI_TAG[t.pri]}">${PRI_LABEL[t.pri]}</span>
        </div>
        <div class="foot">
          <span class="tag b">${esc(t.biz)}</span>
          ${t.due ? `<span class="tag ${overdue ? 'r' : ''}">${overdue ? '⚠ ' : '📅 '}${esc(t.due)}</span>` : ''}
          <button class="btn sm ${t.done ? 'ghost' : ''}" data-toggle="${t.id}">${t.done ? '↺ Reopen' : '✓ Done'}</button>
          <button class="btn sm ghost" data-deltask="${t.id}">Delete</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty">No tasks here.</div>';
  }

  /* ============================================================
     NEXA AI — AUTOMATION BOARD
     ============================================================ */
  const NX_STAGES = ['Idea', 'In Development', 'Testing', 'Deployed'];

  $('nxAdd').onclick = () => {
    const name = $('nxName').value.trim();
    if (!name) { alert('Enter project name'); return; }
    S.projects.unshift({
      id: uid(), name, client: $('nxClient').value.trim(),
      cat: $('nxCat').value, saved: Number($('nxSaved').value) || 0,
      stage: 'Idea', ts: Date.now()
    });
    save(); $('nxName').value = ''; $('nxClient').value = ''; $('nxSaved').value = '';
    renderNexa(); renderHome();
  };

  function renderNexa() {
    $('nxBoard').innerHTML = NX_STAGES.map(st => {
      const items = S.projects.filter(p => p.stage === st);
      return `<div class="col">
        <h4><span>${st}</span><span>${items.length}</span></h4>
        ${items.map(p => `
          <div class="kcard">
            <div class="n">${esc(p.name)}</div>
            <div class="m">${esc(p.client || 'Internal')} · ${esc(p.cat)}</div>
            ${p.saved ? `<div class="m">⏱ ${p.saved} hrs/mo saved</div>` : ''}
            <div class="kmove">
              ${NX_STAGES.indexOf(st) > 0 ? `<button data-nxmove="${p.id}" data-dir="-1">←</button>` : ''}
              ${NX_STAGES.indexOf(st) < NX_STAGES.length - 1 ? `<button data-nxmove="${p.id}" data-dir="1">→</button>` : ''}
              <button data-nxdel="${p.id}">✕</button>
            </div>
          </div>`).join('') || '<div style="font-size:.78rem;color:#94a3b8">—</div>'}
      </div>`;
    }).join('');

    const dep = S.projects.filter(p => p.stage === 'Deployed');
    $('nxTotal').textContent = S.projects.length;
    $('nxDeployed').textContent = dep.length;
    $('nxDev').textContent = S.projects.filter(p => p.stage === 'In Development').length;
    $('nxHours').textContent = dep.reduce((s, p) => s + (p.saved || 0), 0);
  }

  /* ============================================================
     CLIENT PIPELINE
     ============================================================ */
  const PL_STAGES = ['Lead', 'Prospect', 'Interested', 'Proposal Sent', 'Nurturing', 'Client'];

  $('plAdd').onclick = () => {
    const biz = $('plBiz').value.trim();
    if (!biz) { alert('Enter business name'); return; }
    S.leads.unshift({
      id: uid(), biz, name: $('plName').value.trim(), contact: $('plContact').value.trim(),
      service: $('plService').value.trim(), value: Number($('plValueIn').value) || 0,
      source: $('plSource').value.trim(), stage: 'Lead', ts: Date.now()
    });
    save();
    ['plBiz', 'plName', 'plContact', 'plService', 'plValueIn', 'plSource'].forEach(i => $(i).value = '');
    renderPipeline(); renderHome();
  };

  function renderPipeline() {
    $('plBoard').innerHTML = PL_STAGES.map(st => {
      const items = S.leads.filter(l => l.stage === st);
      return `<div class="col">
        <h4><span>${st}</span><span>${items.length}</span></h4>
        ${items.map(l => `
          <div class="kcard">
            <div class="n">${esc(l.biz)}</div>
            <div class="m">${esc(l.name || '—')}${l.contact ? ' · ' + esc(l.contact) : ''}</div>
            ${l.service ? `<div class="m">🔧 ${esc(l.service)}</div>` : ''}
            ${l.value ? `<div class="m">💰 ৳${bn(l.value)}</div>` : ''}
            <div class="kmove">
              ${PL_STAGES.indexOf(st) > 0 ? `<button data-plmove="${l.id}" data-dir="-1">←</button>` : ''}
              ${PL_STAGES.indexOf(st) < PL_STAGES.length - 1 ? `<button data-plmove="${l.id}" data-dir="1">→</button>` : ''}
              <button data-pldel="${l.id}">✕</button>
            </div>
          </div>`).join('') || '<div style="font-size:.78rem;color:#94a3b8">—</div>'}
      </div>`;
    }).join('');

    const won = S.leads.filter(l => l.stage === 'Client');
    $('plTotal').textContent = S.leads.length;
    $('plWon').textContent = won.length;
    $('plProp').textContent = S.leads.filter(l => l.stage === 'Proposal Sent').length;
    $('plValue').textContent = '৳' + bn(S.leads.filter(l => l.stage !== 'Client')
      .reduce((s, l) => s + (l.value || 0), 0));
  }

  /* ============================================================
     DELEGATED CLICKS
     ============================================================ */
  document.addEventListener('click', e => {
    const t = e.target;
    let d;

    if ((d = t.dataset.delidea)) {
      S.ideas = S.ideas.filter(i => i.id !== d); save(d); renderIdeas(); renderHome();
    }
    if ((d = t.dataset.promote)) {
      const idea = S.ideas.find(i => i.id === d);
      if (idea) {
        S.tasks.unshift({
          id: uid(), title: idea.title, pri: 'med',
          biz: idea.biz === 'General' ? 'Personal' : idea.biz,
          due: '', done: false, ts: Date.now()
        });
        idea.promoted = true; save(); renderIdeas(); renderTasks(); renderHome();
        alert('✅ Added to To-Do list');
      }
    }
    if ((d = t.dataset.toggle)) {
      const task = S.tasks.find(x => x.id === d);
      if (task) { task.done = !task.done; save(); renderTasks(); renderHome(); }
    }
    if ((d = t.dataset.deltask)) {
      S.tasks = S.tasks.filter(x => x.id !== d); save(d); renderTasks(); renderHome();
    }
    if ((d = t.dataset.nxmove)) {
      const p = S.projects.find(x => x.id === d);
      if (p) {
        const i = NX_STAGES.indexOf(p.stage) + Number(t.dataset.dir);
        if (i >= 0 && i < NX_STAGES.length) { p.stage = NX_STAGES[i]; save(); renderNexa(); renderHome(); }
      }
    }
    if ((d = t.dataset.nxdel)) {
      S.projects = S.projects.filter(x => x.id !== d); save(d); renderNexa(); renderHome();
    }
    if ((d = t.dataset.plmove)) {
      const l = S.leads.find(x => x.id === d);
      if (l) {
        const i = PL_STAGES.indexOf(l.stage) + Number(t.dataset.dir);
        if (i >= 0 && i < PL_STAGES.length) { l.stage = PL_STAGES[i]; save(); renderPipeline(); renderHome(); }
      }
    }
    if ((d = t.dataset.pldel)) {
      S.leads = S.leads.filter(x => x.id !== d); save(d); renderPipeline(); renderHome();
    }
  });

  /* ============================================================
     HOME — HERO
     ============================================================ */
  function greetWord(h) {
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function renderHero() {
    const now = new Date();
    $('heroDate').textContent = now.toLocaleDateString('en-GB',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('heroGreet').textContent = greetWord(now.getHours()) + ', Zia';

    const today = new Date().toISOString().slice(0, 10);
    const openT = S.tasks.filter(t => !t.done);
    const doneToday = S.tasks.filter(t => t.done).length;
    const high = openT.filter(t => t.pri === 'high').length;
    const overdue = openT.filter(t => t.due && t.due < today).length;
    const dueToday = openT.filter(t => t.due === today).length;

    // subtitle
    let sub;
    if (!S.tasks.length && !S.ideas.length) {
      sub = 'Start here — capture your first idea or task in the box above.';
    } else if (!openT.length) {
      sub = 'All tasks cleared 🎉 Add something new or review the Idea Bank.';
    } else if (overdue) {
      sub = `${overdue} task${overdue > 1 ? 's are' : ' is'} overdue — clear those first.`;
    } else if (high) {
      sub = `${high} high-priority task${high > 1 ? 's' : ''} waiting. Set today's focus.`;
    } else {
      sub = `${openT.length} task${openT.length > 1 ? 's' : ''} open. Steady progress wins.`;
    }
    $('heroSub').textContent = sub;

    // chips
    const chips = [];
    if (overdue) chips.push(`<span class="chip hot">⚠ ${overdue} overdue</span>`);
    if (dueToday) chips.push(`<span class="chip">📅 ${dueToday} due today</span>`);
    if (high) chips.push(`<span class="chip hot">🔥 ${high} high</span>`);
    chips.push(`<span class="chip ok">✅ ${doneToday} completed</span>`);
    chips.push(`<span class="chip">💡 ${S.ideas.length} ideas</span>`);
    if (S.leads.length) chips.push(`<span class="chip">🎯 ${S.leads.length} leads</span>`);
    $('heroChips').innerHTML = chips.join('');

    // ring
    const total = S.tasks.length;
    const pct = total ? Math.round(doneToday / total * 100) : 0;
    $('ringPct').textContent = pct + '%';
    const C = 2 * Math.PI * 52;
    $('ringFg').style.strokeDashoffset = String(C - (C * pct / 100));
  }

  /* quick capture */
  function quickAdd(kind) {
    const v = $('qInput').value.trim();
    if (!v) { $('qInput').focus(); return; }
    if (kind === 'idea') {
      S.ideas.unshift({
        id: uid(), title: v, cat: 'Automation', biz: 'Nexa AI',
        body: '', ts: Date.now(), promoted: false
      });
    } else {
      S.tasks.unshift({
        id: uid(), title: v, pri: 'med', biz: 'Nexa AI',
        due: '', done: false, ts: Date.now()
      });
    }
    save(); $('qInput').value = '';
    renderIdeas(); renderTasks(); renderHome();
  }
  $('qIdea').onclick = () => quickAdd('idea');
  $('qTask').onclick = () => quickAdd('task');
  $('qInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') quickAdd(e.shiftKey ? 'idea' : 'task');
  });

  /* ============================================================
     HOME
     ============================================================ */
  function renderHome() {
    renderHero();
    const v = D.quran[dayNum % (D.quran.length || 1)];
    $('homeQuran').innerHTML = v ? `
      <div style="font-size:.76rem;color:var(--emerald);font-weight:700">${esc(v.surah)} — ${esc(v.key)}</div>
      <div style="font-family:Amiri,serif;font-size:1.28rem;line-height:2.1;text-align:right;direction:rtl;color:var(--navy);margin:12px 0">${esc(v.arabic.slice(0, 220))}</div>
      <div style="font-size:.94rem;line-height:1.95">${esc(v.bangla.slice(0, 320))}${v.bangla.length > 320 ? '…' : ''}</div>`
      : '<div class="empty">—</div>';

    const h = D.hadith[dayNum % (D.hadith.length || 1)];
    $('homeHadith').innerHTML = h ? `
      <div style="font-size:.76rem;color:var(--emerald);font-weight:700">${esc(h.collection)} · #${esc(h.number)}</div>
      <div style="font-size:.94rem;line-height:1.95;margin-top:10px">${esc(h.text.slice(0, 380))}${h.text.length > 380 ? '…' : ''}</div>`
      : '<div class="empty">—</div>';

    const open = S.tasks.filter(t => !t.done)
      .sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.pri] - { high: 0, med: 1, low: 2 }[b.pri])).slice(0, 5);
    $('homeTasks').innerHTML = open.length ? open.map(t => `
      <div class="item p-${t.pri}" style="padding:9px 12px;margin-bottom:7px">
        <div class="ttl" style="font-size:.88rem">${esc(t.title)}</div>
        <div class="foot" style="margin-top:5px">
          <span class="tag ${PRI_TAG[t.pri]}">${PRI_LABEL[t.pri]}</span>
          <span class="tag b">${esc(t.biz)}</span>
        </div>
      </div>`).join('') : '<div class="empty">No open tasks 🎉</div>';

    const ideas = S.ideas.slice(0, 4);
    $('homeIdeas').innerHTML = ideas.length ? ideas.map(i => `
      <div class="item" style="padding:9px 12px;margin-bottom:7px">
        <div class="ttl" style="font-size:.88rem">${esc(i.title)}</div>
        <div class="foot" style="margin-top:5px">
          <span class="tag ${CAT_TAG[i.cat] || ''}">${esc(i.cat)}</span>
          <span class="tag">${esc(i.biz)}</span>
        </div>
      </div>`).join('') : '<div class="empty">No ideas yet</div>';

    $('kpiProjects').textContent = S.projects.filter(p => p.stage !== 'Idea').length;
    $('kpiPipeline').textContent = '৳' + bn(S.leads.filter(l => l.stage !== 'Client')
      .reduce((s, l) => s + (l.value || 0), 0));
    $('kpiLeads').textContent = S.leads.length + ' leads';
    const openT = S.tasks.filter(t => !t.done);
    $('kpiTasks').textContent = openT.length;
    $('kpiTasksHigh').textContent = openT.filter(t => t.pri === 'high').length + ' high priority';
    $('kpiIdeas').textContent = S.ideas.length;
    $('kpiIdeasAuto').textContent = S.ideas.filter(i => i.cat === 'Automation').length + ' automation';
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  $('btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'zia-command-centre-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(a.href);
  };
  $('btnImport').onclick = () => $('fileImport').click();
  $('fileImport').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        S = Object.assign({}, blank, JSON.parse(r.result));
        save(); renderAll(); alert('✅ Data imported');
      } catch (err) { alert('❌ Could not read that file'); }
    };
    r.readAsText(f);
  };
  $('btnReset').onclick = () => {
    if (confirm('This deletes all ideas, tasks, projects and leads. Are you sure?')) {
      S = Object.assign({}, blank); save(); renderAll();
    }
  };

  /* ============================================================
     CLOUD SYNC WIRING
     ============================================================ */
  function setSyncBadge(text, tone) {
    const b = $('syncBadge');
    if (!b) return;
    b.className = 'syncbadge' + (tone && tone !== 'idle' ? ' ' + tone : '');
    $('syncTxt').textContent = text;
  }

  function setAuthUI(u) {
    const inBox = $('cloudIn'), outBox = $('cloudOut');
    if (!inBox || !outBox) return;
    if (u) {
      outBox.style.display = 'none';
      inBox.style.display = '';
      $('cloudEmail').textContent = u.email;
      $('cloudState').textContent = 'Connected';
    } else {
      outBox.style.display = '';
      inBox.style.display = 'none';
      $('cloudState').textContent = 'Not signed in';
      setSyncBadge('Local only', 'idle');
    }
  }

  if (window.CC_SYNC) {
    window.CC_SYNC.init({
      getState: () => S,
      setState: merged => {
        S.ideas = merged.ideas; S.tasks = merged.tasks;
        S.projects = merged.projects; S.leads = merged.leads;
        localStorage.setItem(LS, JSON.stringify(S));
        renderIdeas(); renderTasks(); renderNexa(); renderPipeline(); renderHome();
      },
      onStatus: setSyncBadge,
      onAuth: setAuthUI
    });

    const msg = (t, cls) => {
      const m = $('authMsg');
      if (m) { m.textContent = t; m.className = cls || ''; }
    };

    $('btnSignIn').onclick = async () => {
      const e = $('authEmail').value, p = $('authPass').value;
      if (!e || !p) { msg('Enter email and password', 'msg-err'); return; }
      msg('Signing in…');
      try { await window.CC_SYNC.signIn(e, p); msg('✅ Signed in', 'msg-ok'); $('authPass').value = ''; }
      catch (err) { msg('❌ ' + (err.message || err), 'msg-err'); }
    };

    $('btnSignUp').onclick = async () => {
      const e = $('authEmail').value, p = $('authPass').value;
      if (!e || !p) { msg('Enter email and password', 'msg-err'); return; }
      if (p.length < 6) { msg('Password must be at least 6 characters', 'msg-err'); return; }
      msg('Creating account…');
      try {
        const r = await window.CC_SYNC.signUp(e, p);
        if (r && r.session) msg('✅ Account created and signed in', 'msg-ok');
        else msg('✅ Account created — check your email to confirm, then sign in', 'msg-ok');
      } catch (err) { msg('❌ ' + (err.message || err), 'msg-err'); }
    };

    $('btnSignOut').onclick = async () => {
      await window.CC_SYNC.signOut();
      msg('Signed out on this device. Local data stays here.', '');
    };

    $('btnSyncNow').onclick = () => window.CC_SYNC.syncNow();
  }

  /* ---------- boot ---------- */
  function renderAll() {
    renderQuran(); renderHadith(); renderNews();
    renderIdeas(); renderTasks(); renderNexa(); renderPipeline(); renderHome();
  }
  renderAll();
})();
