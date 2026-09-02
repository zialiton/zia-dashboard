/* ============================================================
   ZIA OS — Inbox tab
   ------------------------------------------------------------
   Reads UNREAD mail from one or more Google Apps Script
   bridges and shows sender + subject + a Read button.

   The bridge URLs are NOT stored in this file — they live in
   this browser's localStorage, because the repository is
   public. You paste them once per device from the Inbox tab.
   ============================================================ */
window.CC_MAIL = (function () {
  'use strict';

  const CFG   = 'zia_mail_sources';   // [{label,url}]
  const CACHE = 'zia_mail_cache';     // last successful result
  const DAYS  = 3;                    // how far back to look
  const TAGS  = ['b', 'g', 'p', 'y', 'r'];  // tag colour per source

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- config ---------- */
  function sources() {
    try { return JSON.parse(localStorage.getItem(CFG) || '[]'); }
    catch (e) { return []; }
  }
  function saveSources(list) {
    localStorage.setItem(CFG, JSON.stringify(list));
  }

  /* ---------- cache ---------- */
  function cached() {
    try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); }
    catch (e) { return null; }
  }

  /* ---------- helpers ---------- */
  function person(from) {
    // "Zia Uddin <zia@x.com>"  ->  { name:'Zia Uddin', addr:'zia@x.com' }
    const m = String(from || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (m) return { name: (m[1] || m[2]).trim(), addr: m[2].trim() };
    return { name: String(from || '').trim(), addr: '' };
  }

  function ago(iso) {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return hrs + ' hour' + (hrs > 1 ? 's' : '') + ' ago';
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    return days + ' days ago';
  }

  function status(text, tone) {
    const el = $('mailStatus');
    if (!el) return;
    el.textContent = text || '';
    el.className = tone === 'err' ? 'msg-err' : (tone === 'ok' ? 'msg-ok' : 'meta');
  }

  /* ---------- fetch ---------- */
  async function fetchOne(src) {
    const sep = src.url.indexOf('?') >= 0 ? '&' : '?';
    const url = src.url + sep + 'days=' + DAYS + '&max=40';
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'bad response');
    return (data.mail || []).map(m => Object.assign({}, m, { _label: src.label || data.account }));
  }

  async function load(force) {
    const list = sources();
    if (!list.length) { renderSetup(); return; }

    // paint the cached copy instantly, then refresh
    if (!force) {
      const c = cached();
      if (c && c.mail) render(c.mail, c.errors || [], c.at);
    }
    status('Checking mail…', 'busy');

    const all = [], errors = [];
    await Promise.all(list.map(async src => {
      try { all.push.apply(all, await fetchOne(src)); }
      catch (err) { errors.push({ label: src.label, msg: err.message || String(err) }); }
    }));

    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    const at = new Date().toISOString();
    try { localStorage.setItem(CACHE, JSON.stringify({ mail: all, errors, at })); } catch (e) {}

    render(all, errors, at);
    status(errors.length
      ? errors.length + ' source(s) failed · ' + all.length + ' unread'
      : all.length + ' unread in the last ' + DAYS + ' days',
      errors.length ? 'err' : 'ok');
  }

  /* ---------- render ---------- */
  function render(mail, errors, at) {
    const box = $('mailList');
    if (!box) return;

    const list = sources();
    const idx = {};
    list.forEach((s, i) => { idx[s.label] = TAGS[i % TAGS.length]; });

    let html = '';

    (errors || []).forEach(e => {
      html += '<div class="item p-high"><div class="head"><div class="ttl">' +
              esc(e.label) + ' — could not load</div><span class="tag r">Error</span></div>' +
              '<div class="body">' + esc(e.msg) + '</div></div>';
    });

    if (!mail.length) {
      html += '<div class="empty">📭 No unread mail in the last ' + DAYS + ' days. Inbox zero.</div>';
    } else {
      mail.forEach(m => {
        const p = person(m.from);
        const tag = idx[m._label] || 'b';
        html +=
          '<div class="item">' +
            '<div class="head">' +
              '<div class="ttl">' + esc(m.subject) + '</div>' +
              '<span class="tag ' + tag + '">' + esc(m._label) + '</span>' +
            '</div>' +
            '<div class="body">' +
              '<strong>' + esc(p.name) + '</strong>' +
              (p.addr ? ' &middot; ' + esc(p.addr) : '') +
            '</div>' +
            '<div class="foot">' +
              '<span class="tag">' + esc(ago(m.date)) + '</span>' +
              (m.count > 1 ? '<span class="tag y">' + m.count + ' messages</span>' : '') +
              '<a class="btn sm" target="_blank" rel="noopener noreferrer" href="' +
                esc(m.link) + '">Read &rarr;</a>' +
            '</div>' +
          '</div>';
      });
    }

    box.innerHTML = html;
    const stamp = $('mailStamp');
    if (stamp) stamp.textContent = at ? 'Updated ' + ago(at) : '';
  }

  /* ---------- first-run setup ---------- */
  function renderSetup() {
    const box = $('mailList');
    if (!box) return;
    box.innerHTML =
      '<div class="empty" style="text-align:left">' +
        '<p style="font-weight:800;margin-bottom:10px">📮 Connect a mailbox</p>' +
        '<p style="margin-bottom:14px;line-height:1.7">Deploy the Apps Script bridge in each Gmail ' +
        'account, then paste its web-app URL below. The URLs stay in this browser only — ' +
        'they are never committed to GitHub.</p>' +
        '<div class="row"><div><label class="fl">Label</label>' +
          '<input id="mailNewLabel" placeholder="Personal"></div></div>' +
        '<div class="row"><div><label class="fl">Web app URL (include ?key=…)</label>' +
          '<input id="mailNewUrl" placeholder="https://script.google.com/macros/s/…/exec?key=…"></div></div>' +
        '<button class="btn" id="mailAdd">Add mailbox</button>' +
      '</div>';
    const add = $('mailAdd');
    if (add) add.onclick = addSource;
  }

  function addSource() {
    const label = ($('mailNewLabel') || {}).value || '';
    const url = ($('mailNewUrl') || {}).value || '';
    if (!label.trim() || !/^https:\/\/script\.google\.com\//.test(url.trim())) {
      status('Give it a label and a https://script.google.com/… URL', 'err');
      return;
    }
    const list = sources();
    list.push({ label: label.trim(), url: url.trim() });
    saveSources(list);
    status('Added ' + label.trim(), 'ok');
    load(true);
  }

  function manage() {
    const list = sources();
    if (!list.length) { renderSetup(); return; }
    const names = list.map((s, i) => (i + 1) + '. ' + s.label).join('\n');
    const which = prompt(
      'Connected mailboxes:\n' + names +
      '\n\nType a number to REMOVE it, or type "add" to connect another.\nLeave empty to cancel.'
    );
    if (which === null || which === '') return;
    if (which.trim().toLowerCase() === 'add') { renderSetup(); return; }
    const n = parseInt(which, 10);
    if (n >= 1 && n <= list.length) {
      list.splice(n - 1, 1);
      saveSources(list);
      localStorage.removeItem(CACHE);
      list.length ? load(true) : renderSetup();
    }
  }

  /* ---------- wire up ---------- */
  function init() {
    const refresh = $('mailRefresh');
    if (refresh) refresh.onclick = () => load(true);

    const cfgBtn = $('mailManage');
    if (cfgBtn) cfgBtn.onclick = manage;

    // load when the Inbox tab is opened
    const navLink = document.querySelector('.navlist a[data-page="email"]');
    if (navLink) navLink.addEventListener('click', () => setTimeout(() => load(false), 60));

    // and once now, if that page is already showing
    const page = $('page-email');
    if (page && page.classList.contains('active')) load(false);
    else if (sources().length) { const c = cached(); if (c) render(c.mail || [], c.errors || [], c.at); }
    else renderSetup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { load, sources, manage };
})();
