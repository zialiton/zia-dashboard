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
  const save = () => localStorage.setItem(LS, JSON.stringify(S));
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
    home: ['হোম', 'সব কিছু এক নজরে'],
    nexa: ['Nexa AI Solutions', 'Automation project board'],
    pipeline: ['Client Pipeline', 'Lead → Prospect → Client'],
    islamic: ['ইসলামিক রিডার', 'কুরআন · হাদীস · সাহাবা'],
    news: ['সংবাদ', 'বাংলাদেশ · আন্তর্জাতিক · প্রযুক্তি'],
    ideas: ['আইডিয়া ব্যাংক', 'অটোমেশন ও ব্যবসার আইডিয়া'],
    todo: ['To-Do List', 'Actionable tasks from ideas'],
    invest: ['বিনিয়োগ', 'CDDL · Sky View · Amanah · Nexa'],
    settings: ['সেটিংস', 'ব্যাকআপ ও কনটেন্ট সোর্স']
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
    const d = now.toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
    if (!v) { $('qSrc').textContent = 'কোনো ডেটা নেই'; return; }
    $('qSrc').textContent = v.surah + ' — আয়াত ' + v.key.split(':')[1];
    $('qArabic').textContent = v.arabic;
    $('qBangla').textContent = v.bangla;
    $('qCount').textContent = (qi + 1) + ' / ' + D.quran.length;
  }
  function renderHadith() {
    const h = D.hadith[hi];
    if (!h) { $('hSrc').textContent = 'কোনো ডেটা নেই'; return; }
    $('hSrc').textContent = h.collection + ' — হাদীস নং ' + h.number + ' · ' + h.grade;
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
    if (!list || !list.length) return '<div class="empty">কোনো সংবাদ নেই</div>';
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
    $('newsMeta').textContent = 'সর্বশেষ আপডেট: ' + (N._updated || '—') +
      ' · উৎস: প্রথম আলো, BBC বাংলা, TechCrunch';
    const head = [].concat(N.bangladesh || []).slice(0, 3)
      .concat((N.tech || []).slice(0, 2));
    $('homeNews').innerHTML = newsHTML(head);
  }

  /* ============================================================
     IDEA BANK
     ============================================================ */
  const CAT_TAG = { 'অটোমেশন': 'g', 'ব্যবসা': 'b', 'প্রোডাক্ট': 'p', 'মার্কেটিং': 'y', 'ব্যক্তিগত': '' };

  $('idAdd').onclick = () => {
    const title = $('idTitle').value.trim();
    if (!title) { alert('আইডিয়ার শিরোনাম লিখুন'); return; }
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
          <span style="font-size:.74rem;color:var(--muted)">${new Date(i.ts).toLocaleDateString('bn-BD')}</span>
          ${i.promoted ? '<span class="tag g">✓ টাস্কে গেছে</span>'
        : `<button class="btn sm" data-promote="${i.id}">→ To-Do তে পাঠান</button>`}
          <button class="btn sm ghost" data-delidea="${i.id}">মুছুন</button>
        </div>
      </div>`).join('') : '<div class="empty">এখনো কোনো আইডিয়া নেই। উপরে যোগ করুন।</div>';
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
      S.ideas = S.ideas.filter(i => i.id !== d); save(); renderIdeas(); renderHome();
    }
    if ((d = t.dataset.promote)) {
      const idea = S.ideas.find(i => i.id === d);
      if (idea) {
        S.tasks.unshift({
          id: uid(), title: idea.title, pri: 'med',
          biz: idea.biz === 'সাধারণ' ? 'Personal' : idea.biz,
          due: '', done: false, ts: Date.now()
        });
        idea.promoted = true; save(); renderIdeas(); renderTasks(); renderHome();
        alert('✅ To-Do তে যোগ হয়েছে');
      }
    }
    if ((d = t.dataset.toggle)) {
      const task = S.tasks.find(x => x.id === d);
      if (task) { task.done = !task.done; save(); renderTasks(); renderHome(); }
    }
    if ((d = t.dataset.deltask)) {
      S.tasks = S.tasks.filter(x => x.id !== d); save(); renderTasks(); renderHome();
    }
    if ((d = t.dataset.nxmove)) {
      const p = S.projects.find(x => x.id === d);
      if (p) {
        const i = NX_STAGES.indexOf(p.stage) + Number(t.dataset.dir);
        if (i >= 0 && i < NX_STAGES.length) { p.stage = NX_STAGES[i]; save(); renderNexa(); renderHome(); }
      }
    }
    if ((d = t.dataset.nxdel)) {
      S.projects = S.projects.filter(x => x.id !== d); save(); renderNexa(); renderHome();
    }
    if ((d = t.dataset.plmove)) {
      const l = S.leads.find(x => x.id === d);
      if (l) {
        const i = PL_STAGES.indexOf(l.stage) + Number(t.dataset.dir);
        if (i >= 0 && i < PL_STAGES.length) { l.stage = PL_STAGES[i]; save(); renderPipeline(); renderHome(); }
      }
    }
    if ((d = t.dataset.pldel)) {
      S.leads = S.leads.filter(x => x.id !== d); save(); renderPipeline(); renderHome();
    }
  });

  /* ============================================================
     HOME
     ============================================================ */
  function renderHome() {
    const v = D.quran[dayNum % (D.quran.length || 1)];
    $('homeQuran').innerHTML = v ? `
      <div style="font-size:.76rem;color:var(--emerald);font-weight:700">${esc(v.surah)} — ${esc(v.key)}</div>
      <div style="font-family:Amiri,serif;font-size:1.28rem;line-height:2.1;text-align:right;direction:rtl;color:var(--navy);margin:12px 0">${esc(v.arabic.slice(0, 220))}</div>
      <div style="font-size:.94rem;line-height:1.95">${esc(v.bangla.slice(0, 320))}${v.bangla.length > 320 ? '…' : ''}</div>`
      : '<div class="empty">—</div>';

    const h = D.hadith[dayNum % (D.hadith.length || 1)];
    $('homeHadith').innerHTML = h ? `
      <div style="font-size:.76rem;color:var(--emerald);font-weight:700">${esc(h.collection)} — নং ${esc(h.number)}</div>
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
      </div>`).join('') : '<div class="empty">এখনো আইডিয়া নেই</div>';

    $('kpiProjects').textContent = S.projects.filter(p => p.stage !== 'Idea').length;
    $('kpiPipeline').textContent = '৳' + bn(S.leads.filter(l => l.stage !== 'Client')
      .reduce((s, l) => s + (l.value || 0), 0));
    $('kpiLeads').textContent = S.leads.length + ' leads';
    const openT = S.tasks.filter(t => !t.done);
    $('kpiTasks').textContent = openT.length;
    $('kpiTasksHigh').textContent = openT.filter(t => t.pri === 'high').length + ' high priority';
    $('kpiIdeas').textContent = S.ideas.length;
    $('kpiIdeasAuto').textContent = S.ideas.filter(i => i.cat === 'অটোমেশন').length + ' automation';
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
        save(); renderAll(); alert('✅ ডেটা ইমপোর্ট হয়েছে');
      } catch (err) { alert('❌ ফাইলটি পড়া যায়নি'); }
    };
    r.readAsText(f);
  };
  $('btnReset').onclick = () => {
    if (confirm('সব আইডিয়া, টাস্ক, প্রজেক্ট ও লিড মুছে যাবে। নিশ্চিত?')) {
      S = Object.assign({}, blank); save(); renderAll();
    }
  };

  /* ---------- boot ---------- */
  function renderAll() {
    renderQuran(); renderHadith(); renderNews();
    renderIdeas(); renderTasks(); renderNexa(); renderPipeline(); renderHome();
  }
  renderAll();
})();
