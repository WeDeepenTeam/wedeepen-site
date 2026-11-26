/* WeDeepen Facilitator Portal (/facilitator-portal/).
   Talks only to WeDeepen's own server (api.wedeepen.com/faculty/*, source: WeDeepenTeam/wedeepen-google-ads-mcp,
   src/faculty.ts), which checks the Facilitator ID + access code and reads/writes the Referral Fee Tracker.
   The ID and code are kept in memory only (never in storage or the address bar); reloading signs you out. */
(function () {
  'use strict';
  var API = 'https://api.wedeepen.com/faculty';
  var me = null; // { id, code, name, rate }
  var $ = function (id) { return document.getElementById(id); };

  function nonce() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  var reportNonce = nonce();
  var noteNonce = nonce();

  function show(el, text) { el.textContent = text || ''; el.hidden = !text; }
  function money(v) {
    var s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
    if (s === '') return 0;
    return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : null;
  }
  function usd(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function call(path, payload) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ id: me ? me.id : '', code: me ? me.code : '' }, payload || {}))
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error && data.error.length > 12 ? data.error : (data.message || 'Something went wrong. Please try again.'));
          err.status = res.status; err.field = data.field;
          throw err;
        }
        return data;
      });
    }, function () { throw new Error('No connection. Check your internet and try again.'); });
  }

  // Months: this month and the 12 before it. Default = last month (reports are due by the 10th for the month before).
  (function fillMonths() {
    var sel = $('fp-month'); var d = new Date(); d.setDate(1);
    for (var i = 0; i < 13; i++) {
      var y = d.getFullYear(), m = d.getMonth() + 1;
      if (y < 2026) break;
      var o = document.createElement('option');
      o.value = y + '-' + (m < 10 ? '0' : '') + m;
      o.textContent = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (i === 1) o.selected = true;
      sel.appendChild(o);
      d.setMonth(d.getMonth() - 1);
    }
  })();

  function renderHistory(items) {
    var box = $('fp-history'); box.textContent = '';
    if (!items || !items.length) {
      var p = document.createElement('p'); p.className = 'fp-empty'; p.textContent = 'Nothing reported yet.'; box.appendChild(p); return;
    }
    items.forEach(function (it) {
      var row = document.createElement('div'); row.className = 'fp-item';
      var top = document.createElement('div'); top.className = 'fp-item-top';
      var who = document.createElement('span'); who.textContent = (it.client || 'Client') + (it.service ? ' · ' + it.service : '');
      var badge = document.createElement('span'); badge.className = 'fp-badge';
      var status = it.status || 'Submitted';
      if (/paid/i.test(status)) badge.className += ' paid';
      badge.textContent = status;
      top.appendChild(who); top.appendChild(badge);
      var meta = document.createElement('div'); meta.className = 'fp-item-meta';
      var g = money(it.gross), c = money(it.commission);
      var bits = [it.ref, 'reported ' + it.submitted];
      if (g !== null && it.gross !== '') bits.push('received ' + usd(g));
      if (c !== null && it.commission !== '') bits.push('commission ' + usd(c));
      if (it.invoice) bits.push('invoice ' + it.invoice);
      if (it.approved) bits.push('approved ' + it.approved);
      meta.textContent = bits.join(' · ');
      row.appendChild(top); row.appendChild(meta);
      box.appendChild(row);
    });
  }

  function enter(data) {
    me.name = data.name; me.rate = data.rate;
    $('fp-name').textContent = 'Hi, ' + String(data.name || data.id).split(' ')[0];
    $('fp-rate').textContent = 'ID ' + data.id + ' · commission ' + Math.round(data.rate * 1000) / 10 + '%';
    renderHistory(data.history);
    $('fp-signin').hidden = true; $('fp-app').hidden = false;
    $('fp-code').value = '';
    updateTotal();
    window.scrollTo(0, 0);
  }

  // Sign in
  $('fp-signin-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = this.querySelector('button'); var err = $('fp-signin-err');
    var id = $('fp-id').value.trim(), code = $('fp-code').value.trim();
    if (!id || !code) return show(err, 'Enter your Facilitator ID and access code.');
    show(err, ''); btn.disabled = true; btn.textContent = 'Signing in…';
    me = { id: id, code: code };
    call('/login').then(enter, function (x) { me = null; show(err, x.message); })
      .then(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
  });

  $('fp-signout').addEventListener('click', function () { window.location.reload(); });

  // Tabs
  var tabs = document.querySelectorAll('.fp-tabs button');
  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener('click', function () {
      Array.prototype.forEach.call(tabs, function (o) { o.setAttribute('aria-selected', String(o === t)); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function (p) { p.hidden = p.getAttribute('data-panel') !== t.getAttribute('data-tab'); });
    });
  });

  // Live commission preview
  var rf = $('fp-report');
  function updateTotal() {
    if (!me || me.rate == null) return;
    var g = money(rf.gross.value), r = money(rf.refunds.value);
    var out = $('fp-total');
    if (!g || r === null || g === null) { out.textContent = ''; return; }
    out.textContent = 'Commission to WeDeepen: ' + usd(Math.max(0, Math.round((g - r) * me.rate * 100) / 100));
  }
  ['input', 'change'].forEach(function (ev) { rf.addEventListener(ev, updateTotal); });

  // Report
  rf.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = rf.querySelector('button[type=submit]'); var err = $('fp-report-err'); var ok = $('fp-report-ok');
    Array.prototype.forEach.call(rf.elements, function (el) { el.removeAttribute('aria-invalid'); });
    show(ok, '');
    var report = {
      month: rf.month.value, client: rf.client.value, nameShared: rf.nameShared.checked, service: rf.service.value,
      serviceDate: rf.serviceDate.value, gross: rf.gross.value, refunds: rf.refunds.value,
      existingClient: rf.existingClient.checked, notes: rf.notes.value, nonce: reportNonce
    };
    show(err, ''); btn.disabled = true; btn.textContent = 'Sending…';
    call('/report', { report: report }).then(function (data) {
      renderHistory(data.history);
      var c = money(data.commission);
      show(ok, (data.duplicate ? 'Already received: ' : 'Thank you. Report ') + data.ref + ' is in' +
        (c !== null ? ', commission ' + usd(c) : '') + '. You can see it under My history.');
      rf.reset(); reportNonce = nonce(); updateTotal();
      ok.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, function (x) {
      if (x.status === 401 || x.status === 429) { show(err, x.message + ' Reload the page to sign in again.'); return; }
      show(err, x.message);
      if (x.field && rf[x.field]) { rf[x.field].setAttribute('aria-invalid', 'true'); rf[x.field].focus(); }
    }).then(function () { btn.disabled = false; btn.textContent = 'Send report'; });
  });

  // Client notes
  var nf = $('fp-note');
  nf.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = nf.querySelector('button[type=submit]'); var err = $('fp-note-err'); var ok = $('fp-note-ok');
    show(ok, ''); show(err, ''); btn.disabled = true; btn.textContent = 'Sending…';
    var note = { client: nf.client.value, upsell: nf.upsell.value, wantsHelp: nf.wantsHelp.value, feedback: nf.feedback.value, testimonial: nf.testimonial.value, nonce: noteNonce };
    call('/note', { note: note }).then(function () {
      show(ok, 'Thank you. Your note is with the WeDeepen team.');
      nf.reset(); noteNonce = nonce();
    }, function (x) { show(err, x.message); })
      .then(function () { btn.disabled = false; btn.textContent = 'Send note'; });
  });
})();
