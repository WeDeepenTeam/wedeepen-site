/* WeDeepen Facilitator Portal ADMIN (/facilitator-portal/admin/). Rene and Christina only.
   Sign-in is Google (api.wedeepen.com/faculty/admin/start). The server only lets in the emails on its
   FACULTY_ADMIN_EMAILS list, then hands this page a one-minute ticket in the address (#ticket=…), which is
   swapped for a 12-hour session token kept in this browser tab (sessionStorage) only.
   Server code: WeDeepenTeam/wedeepen-google-ads-mcp, src/faculty-admin.ts. */
(function () {
  'use strict';
  var API = 'https://api.wedeepen.com/faculty/admin';
  var KEY = 'wd-portal-admin';
  var token = null; var state = null;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function show(e, text) { e.textContent = text || ''; e.hidden = !text; }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; }
  function usd(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function store(t) { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch (e) {} }
  function stored() { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } }

  function call(path, payload) {
    return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ token: token }, payload || {})) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (d) {
          if (res.status === 401) { signOutLocal(d.error || 'Please sign in again.'); throw new Error(d.error || 'Please sign in again.'); }
          if (!res.ok) throw new Error(d.error || 'Something went wrong.');
          return d;
        });
      }, function () { throw new Error('No connection. Check your internet and try again.'); });
  }

  function signOutLocal(msg) {
    token = null; store(null);
    $('ad-app').hidden = true; $('ad-signin').hidden = false;
    show($('ad-signin-err'), msg || '');
  }

  // ---------- Reports ----------
  function renderReports() {
    var box = $('ad-reports'); box.textContent = '';
    var open = $('ad-filter').value === 'open';
    var list = state.reports.filter(function (r) { return !open || !/^(paid|void)$/i.test(r.status); });
    if (!list.length) { box.appendChild(el('p', 'fp-empty', open ? 'Nothing open. Everything is paid.' : 'No reports yet.')); return; }
    list.forEach(function (r) {
      var row = el('div', 'fp-item');
      var top = el('div', 'fp-item-top');
      top.appendChild(el('span', null, (r.name || r.email) + ' · ' + (r.client || 'client') + (r.service ? ' · ' + r.service : '')));
      var badge = el('span', 'fp-badge' + (/paid/i.test(r.status) ? ' paid' : ''), r.status || 'Submitted');
      top.appendChild(badge); row.appendChild(top);
      var bits = [r.ref, r.source, 'reported ' + String(r.submitted).slice(0, 10)];
      if (r.gross !== '') bits.push('received ' + usd(num(r.gross)));
      if (r.commission !== '') bits.push('commission ' + usd(num(r.commission)));
      if (r.reviewedBy) bits.push('by ' + r.reviewedBy);
      row.appendChild(el('div', 'fp-item-meta', bits.join(' · ')));
      if (r.notes) row.appendChild(el('div', 'fp-item-meta', r.notes));

      var f = el('form', 'ad-edit');
      var st = el('label', null, 'Status'); var sel = el('select'); sel.name = 'status';
      state.statuses.forEach(function (s) { var o = el('option', null, s); o.value = s; if (s === (r.status || 'Submitted')) o.selected = true; sel.appendChild(o); });
      st.appendChild(sel);
      var inv = el('label', null, 'Invoice ID'); var ii = el('input'); ii.name = 'invoice'; ii.value = r.invoice || ''; ii.maxLength = 60; inv.appendChild(ii);
      var ap = el('label', null, 'Approved on'); var ai = el('input'); ai.type = 'date'; ai.name = 'approvedOn'; ai.value = /^\d{4}-\d{2}-\d{2}$/.test(r.approvedOn) ? r.approvedOn : ''; ap.appendChild(ai);
      var btn = el('button', 'fp-btn', 'Save'); btn.type = 'submit';
      f.appendChild(st); f.appendChild(inv); f.appendChild(ap); f.appendChild(btn);
      f.addEventListener('submit', function (e) {
        e.preventDefault(); btn.disabled = true; btn.textContent = 'Saving…'; show($('ad-reports-err'), '');
        call('/report', { ref: r.ref, status: sel.value, invoice: ii.value, approvedOn: ai.value }).then(function (d) {
          state = d; renderAll();
        }, function (x) { show($('ad-reports-err'), r.ref + ': ' + x.message); btn.disabled = false; btn.textContent = 'Save'; });
      });
      row.appendChild(f);
      box.appendChild(row);
    });
  }

  // ---------- Facilitators ----------
  function renderPeople() {
    var box = $('ad-people'); box.textContent = '';
    if (!state.facilitators.length) { box.appendChild(el('p', 'fp-empty', 'No facilitators yet. Add one below.')); return; }
    state.facilitators.forEach(function (p) {
      var row = el('div', 'fp-item' + (p.active ? '' : ' ad-off'));
      var top = el('div', 'fp-item-top');
      top.appendChild(el('span', null, (p.name || '(no name)') + (p.id ? ' · ' + p.id : '')));
      top.appendChild(el('span', 'fp-badge' + (p.active ? ' paid' : ''), p.active ? 'Active' : 'Off'));
      row.appendChild(top);
      var meta = el('div', 'fp-item-meta');
      meta.appendChild(document.createTextNode((p.email || 'no email') + ' · commission ' + (p.rate || 'default ' + Math.round(state.defaultRate * 1000) / 10 + '%') + ' · code '));
      meta.appendChild(el('span', 'ad-code', p.code || 'none'));
      row.appendChild(meta);
      if (p.id) {
        var acts = el('div', 'ad-actions');
        var reset = el('button', null, 'New code'); reset.type = 'button';
        reset.addEventListener('click', function () {
          if (!window.confirm('Make a new code for ' + p.name + '? Their old code stops working right away.')) return;
          act({ action: 'reset', id: p.id }, 'New code for ' + p.name + ': ');
        });
        var tog = el('button', null, p.active ? 'Turn off' : 'Turn on'); tog.type = 'button';
        tog.addEventListener('click', function () { act({ action: 'active', id: p.id, active: !p.active }); });
        var edit = el('button', null, 'Edit'); edit.type = 'button';
        edit.addEventListener('click', function () {
          var name = window.prompt('Name', p.name); if (name == null) return;
          var email = window.prompt('Email', p.email); if (email == null) return;
          var rate = window.prompt('Commission (blank = default)', p.rate); if (rate == null) return;
          act({ action: 'edit', id: p.id, name: name, email: email, rate: rate });
        });
        acts.appendChild(reset); acts.appendChild(tog); acts.appendChild(edit);
        row.appendChild(acts);
      }
      box.appendChild(row);
    });
  }

  function act(payload, codeLabel) {
    show($('ad-people-err'), ''); show($('ad-code-box'), '');
    return call('/facilitator', payload).then(function (d) {
      state = d; renderAll();
      if (d.code) show($('ad-code-box'), (codeLabel || 'Their code: ') + d.code + '. Send it to them privately.');
      return d;
    }, function (x) { show($('ad-people-err'), x.message); throw x; });
  }

  $('ad-add').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this; var btn = f.querySelector('button');
    var v = function (n) { return f.elements.namedItem(n).value; }; // not f.name / f.id: those are the form's own properties
    btn.disabled = true;
    act({ action: 'add', name: v('name'), email: v('email'), id: v('id'), rate: v('rate') }, 'Added ' + v('id').toUpperCase() + '. Their code: ')
      .then(function () { f.reset(); f.parentNode.open = false; }, function () {})
      .then(function () { btn.disabled = false; });
  });

  // ---------- Notes ----------
  function renderNotes() {
    var box = $('ad-notes'); box.textContent = '';
    if (!state.notes.length) { box.appendChild(el('p', 'fp-empty', 'No client notes yet.')); return; }
    state.notes.forEach(function (n) {
      var row = el('div', 'fp-item');
      var top = el('div', 'fp-item-top');
      top.appendChild(el('span', null, n.name + (n.client ? ' · ' + n.client : '')));
      if (n.wantsHelp) top.appendChild(el('span', 'fp-badge', 'Help: ' + n.wantsHelp));
      row.appendChild(top);
      row.appendChild(el('div', 'fp-item-meta', String(n.when).slice(0, 16)));
      [['Upsell', n.upsell], ['Feedback', n.feedback], ['Testimonial', n.testimonial]].forEach(function (x) {
        if (x[1]) row.appendChild(el('div', null, x[0] + ': ' + x[1]));
      });
      box.appendChild(row);
    });
  }

  function renderAll() {
    $('ad-who').textContent = 'Signed in as ' + state.email;
    var open = state.reports.filter(function (r) { return !/^(paid|void)$/i.test(r.status); });
    var owed = open.reduce(function (s, r) { return s + num(r.commission); }, 0);
    var stats = $('ad-stats'); stats.textContent = '';
    [[String(open.length), 'open reports'], [usd(owed), 'commission not yet paid'], [String(state.facilitators.filter(function (p) { return p.active && p.id; }).length), 'active facilitators']].forEach(function (s) {
      var d = el('div', 'ad-stat'); d.appendChild(el('b', null, s[0])); d.appendChild(el('span', null, s[1])); stats.appendChild(d);
    });
    renderReports(); renderPeople(); renderNotes();
  }

  function load() {
    return call('/data').then(function (d) {
      state = d; $('ad-signin').hidden = true; $('ad-app').hidden = false; renderAll();
    });
  }

  // Tabs, filter, sign out
  var tabs = document.querySelectorAll('.fp-tabs button');
  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener('click', function () {
      Array.prototype.forEach.call(tabs, function (o) { o.setAttribute('aria-selected', String(o === t)); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function (p) { p.hidden = p.getAttribute('data-panel') !== t.getAttribute('data-tab'); });
    });
  });
  $('ad-filter').addEventListener('change', renderReports);
  $('ad-signout').addEventListener('click', function () {
    var t = token; signOutLocal();
    if (t) fetch(API + '/signout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) }).catch(function () {});
  });

  // Start: a ticket from Google sign-in, an error, or a stored session
  var hash = new URLSearchParams(location.hash.slice(1));
  if (location.hash) history.replaceState(null, '', location.pathname);
  if (hash.get('error')) { show($('ad-signin-err'), hash.get('error')); return; }
  if (hash.get('ticket')) {
    fetch(API + '/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: hash.get('ticket') }) })
      .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.error || 'Sign-in failed.'); return d; }); })
      .then(function (d) { token = d.token; store(token); return load(); })
      .catch(function (x) { signOutLocal(x.message); });
    return;
  }
  token = stored();
  if (token) load().catch(function () {});
})();
