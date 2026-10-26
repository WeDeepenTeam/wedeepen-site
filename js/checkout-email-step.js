/**
 * WeDeepen checkout email step: one email field between a membership join
 * button and the Circle checkout.
 *
 * Why (Oct 26, 2026): Clarity showed 0 of 7 checkout visitors typed anything
 * at Circle's payment form, and Circle can't hand us the email of someone who
 * leaves. Asking for just an email first (with a skip link) lets MailerLite
 * follow up: the form below adds people to "Checkout started (site email
 * step)", which starts the automation "Checkout follow-up – started joining,
 * no trial (site email step)". That automation drops anyone who starts a trial
 * (MailerLite group "WeDeepen $99") before each email.
 *
 * Scope: only links to the Circle membership checkout
 * (circle.wedeepen.com/checkout/wedeepen-club-membership). Event, ticket and
 * booking links are untouched.
 *
 * Tracking: checkout-tracking.js and the page's join_click handler still run
 * on the original tap (this listener only cancels the navigation; it doesn't
 * stop the event). This file adds GA4 checkout_email_step with
 * step_action = shown | submitted | skipped.
 *
 * Never a hard gate: "Skip" goes straight to checkout, a failed or slow
 * MailerLite call still continues after 1.5 s, and anyone who already answered
 * once this session goes straight through next time.
 */
(function () {
  'use strict';

  var FORM_URL = 'https://assets.mailerlite.com/jsonp/321715/forms/202397510383175548/subscribe';
  var DONE_KEY = 'wd_email_step_done';
  var IS_BOT = !!navigator.webdriver || /bot|crawl|spider|facebookexternalhit|meta-external|HeadlessChrome|Lighthouse/i.test(navigator.userAgent);
  if (IS_BOT) return;

  function seen() { try { return sessionStorage.getItem(DONE_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { sessionStorage.setItem(DONE_KEY, '1'); } catch (e) {} }
  function track(action) {
    try { if (typeof window.gtag === 'function') window.gtag('event', 'checkout_email_step', { step_action: action }); } catch (e) {}
  }
  function isMembershipCheckout(href) {
    try {
      var u = new URL(href, location.href);
      return u.hostname === 'circle.wedeepen.com' && u.pathname.indexOf('/checkout/wedeepen-club-membership') === 0;
    } catch (e) { return false; }
  }

  var target = null, sheet = null, lastFocus = null;

  function build() {
    var css = document.createElement('style');
    css.textContent =
      '#wd-es-backdrop{position:fixed;inset:0;background:rgba(20,10,15,.45);z-index:9998;opacity:0;transition:opacity .2s}' +
      '#wd-es-backdrop.open{opacity:1}' +
      '#wd-es{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#fff;color:#222;border-radius:18px 18px 0 0;' +
      'box-shadow:0 -10px 40px rgba(0,0,0,.2);padding:22px 20px calc(22px + env(safe-area-inset-bottom));max-width:520px;margin:0 auto;box-sizing:border-box;' +
      'font-family:"DM Sans",Inter,system-ui,sans-serif;opacity:0;transition:opacity .2s ease}' +
      '#wd-es.open{opacity:1}' +
      '@media(min-width:640px){#wd-es{border-radius:18px;padding-bottom:22px}}' +
      '#wd-es h2{font-family:"Playfair Display",Georgia,serif;font-weight:400;font-size:1.45rem;line-height:1.25;margin:0 0 6px}' +
      '#wd-es p{margin:0;font-size:.95rem;line-height:1.5;color:#555}' +
      '#wd-es input{width:100%;box-sizing:border-box;margin:14px 0 10px;padding:13px 14px;font-size:16px;border:1px solid #cfc7cb;border-radius:12px}' +
      '#wd-es input:focus{outline:2px solid #A01B4A;outline-offset:1px}' +
      '#wd-es .wd-es-go{width:100%;border:0;border-radius:9999px;background:#A01B4A;color:#fff;font-weight:600;font-size:1rem;padding:15px 20px;cursor:pointer}' +
      '#wd-es .wd-es-go:hover{background:#851437}' +
      '#wd-es .wd-es-fine{text-align:center;font-size:.85rem;color:#777;margin-top:10px}' +
      '#wd-es .wd-es-skip{display:block;margin:12px auto 0;background:none;border:0;color:#777;font-size:.85rem;text-decoration:underline;cursor:pointer}' +
      '#wd-es .wd-es-x{position:absolute;top:10px;right:12px;background:none;border:0;font-size:1.6rem;line-height:1;color:#999;cursor:pointer}';
    document.head.appendChild(css);

    var bd = document.createElement('div');
    bd.id = 'wd-es-backdrop';
    bd.hidden = true;

    sheet = document.createElement('div');
    sheet.id = 'wd-es';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'wd-es-title');
    sheet.innerHTML =
      '<button type="button" class="wd-es-x" aria-label="Close">&times;</button>' +
      '<h2 id="wd-es-title">Where should we send your welcome?</h2>' +
      '<p>Then we&rsquo;ll take you to your free 14 days.</p>' +
      '<form novalidate>' +
      '<label for="wd-es-email" style="position:absolute;left:-9999px">Email</label>' +
      '<input id="wd-es-email" type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required>' +
      '<button type="submit" class="wd-es-go">Continue to my free 14 days &rarr;</button>' +
      '</form>' +
      '<p class="wd-es-fine">$0 today &middot; cancel inside Circle anytime</p>' +
      '<button type="button" class="wd-es-skip">Skip, take me to checkout</button>';

    document.body.appendChild(bd);
    document.body.appendChild(sheet);

    var input = sheet.querySelector('input');
    var form = sheet.querySelector('form');

    function close() {
      sheet.classList.remove('open'); bd.classList.remove('open');
      setTimeout(function () { sheet.hidden = true; bd.hidden = true; }, 250);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function go() { markSeen(); if (target) window.location.href = target; }

    bd.addEventListener('click', close);
    sheet.querySelector('.wd-es-x').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
    sheet.querySelector('.wd-es-skip').addEventListener('click', function () { track('skipped'); go(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { input.focus(); input.setCustomValidity('Please enter your email'); input.reportValidity(); return; }
      input.setCustomValidity('');
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'One moment…';
      track('submitted');
      var finished = false;
      function finish() { if (!finished) { finished = true; go(); } }
      var body = new URLSearchParams();
      body.append('fields[email]', email);
      body.append('ml-submit', '1');
      body.append('anticsrf', 'true');
      try {
        fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body: body, keepalive: true }).then(finish, finish);
      } catch (err) { finish(); }
      setTimeout(finish, 1500);
    });
    input.addEventListener('input', function () { input.setCustomValidity(''); });

    // Size and place the sheet against what the visitor actually sees. If a
    // page ever overflows sideways (seen once in Clarity, Oct 24), the layout
    // viewport is wider than the screen and a plain left:0/right:0 sheet would
    // sit partly off-screen.
    function place() {
      var vv = window.visualViewport;
      if (!vv) return;
      var w = Math.min(vv.width, 520);
      var h = sheet.offsetHeight;
      var wide = vv.width >= 640;
      sheet.style.right = 'auto';
      sheet.style.bottom = 'auto';
      sheet.style.margin = '0';
      sheet.style.width = w + 'px';
      sheet.style.left = (vv.offsetLeft + (vv.width - w) / 2) + 'px';
      sheet.style.top = (vv.offsetTop + (wide ? (vv.height - h) / 2 : vv.height - h)) + 'px';
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () { if (!sheet.hidden) place(); });
      window.visualViewport.addEventListener('scroll', function () { if (!sheet.hidden) place(); });
    }

    sheet._open = function () {
      lastFocus = document.activeElement;
      bd.hidden = false; sheet.hidden = false;
      place();
      requestAnimationFrame(function () { bd.classList.add('open'); sheet.classList.add('open'); });
      setTimeout(function () { input.focus({ preventScroll: true }); place(); }, 260);
    };
  }

  // Capture phase, like checkout-tracking.js. preventDefault only: other
  // listeners (tracking, join_click) still receive this click.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || !isMembershipCheckout(a.href)) return;
    if (sheet && sheet.contains(a)) return;
    if (seen()) return; // answered or skipped already this session
    e.preventDefault();
    target = a.href;
    if (!sheet) build();
    sheet._open();
    track('shown');
  }, true);
})();
