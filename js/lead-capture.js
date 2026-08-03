/**
 * WeDeepen lead capture: announcement bar + popup.
 *
 * Injected on page load. Self-contained CSS (no Tailwind dependency) so it
 * renders identically on every page it's included on.
 *
 * Submissions POST to a Google Apps Script web app that appends rows to the
 * "WeDeepen Leads" Google Sheet. Until ENDPOINT is set, the popup still works:
 * it falls back to the "text COUNT ME IN" instruction on submit.
 *
 * Setup docs: scripts/lead-capture/README.md
 */
(function () {
  'use strict';

  /* == Config ============================================================ */
  // Google Apps Script web app URL (ends in /exec). Empty = SMS fallback mode.
  var ENDPOINT = '';
  var SMS_NUMBER_DISPLAY = '833-407-0037';
  var SMS_KEYWORD = 'COUNT ME IN';
  var SMS_HREF = 'sms:+18334070037?&body=COUNT%20ME%20IN';
  var POPUP_DELAY_MS = 6000;
  var DISMISS_DAYS = 7;    // popup snooze after close
  var JOINED_DAYS = 365;   // popup snooze after successful submit
  var BAR_DISMISS_DAYS = 7;

  var LS_POPUP = 'wd_lead_popup_until';
  var LS_BAR = 'wd_lead_bar_until';

  function snoozed(key) {
    try { return Date.now() < Number(localStorage.getItem(key) || 0); }
    catch (e) { return false; }
  }
  function snooze(key, days) {
    try { localStorage.setItem(key, String(Date.now() + days * 864e5)); }
    catch (e) { /* private mode */ }
  }

  /* == Styles ============================================================ */
  var css = ''
    + '#wd-lead-bar{position:fixed;top:0;left:0;right:0;z-index:60;background:linear-gradient(90deg,#A8855C,#C9A277,#D4B78C);color:#1A1A1A;font-family:"DM Sans",Inter,system-ui,sans-serif;font-size:14px;line-height:1.3;display:flex;align-items:center;justify-content:center;gap:10px;padding:9px 44px 9px 16px;text-align:center;}'
    + '#wd-lead-bar strong{font-weight:700;letter-spacing:.02em;}'
    + '#wd-lead-bar a{color:#1A1A1A;font-weight:700;text-decoration:underline;text-underline-offset:2px;}'
    + '#wd-lead-bar button.wd-bar-join{background:#1A1A1A;color:#F4EDE0;border:0;border-radius:999px;padding:5px 14px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;}'
    + '#wd-lead-bar button.wd-bar-join:hover{background:#2D2D2D;}'
    + '#wd-lead-bar .wd-bar-x{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:#1A1A1A;opacity:.55;font-size:18px;line-height:1;cursor:pointer;padding:6px;}'
    + '#wd-lead-bar .wd-bar-x:hover{opacity:1;}'
    + '@media (max-width:640px){#wd-lead-bar{font-size:13px;flex-wrap:wrap;gap:6px;padding:8px 40px 8px 12px;}}'
    + '#wd-lead-overlay{position:fixed;inset:0;z-index:100;background:rgba(10,8,9,.72);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;padding:20px;}'
    + '#wd-lead-overlay.wd-open{display:flex;}'
    + '#wd-lead-modal{position:relative;width:100%;max-width:430px;background:#1A1A1A;border:1px solid rgba(201,162,119,.35);border-radius:20px;padding:34px 30px 28px;color:#F4EDE0;font-family:"DM Sans",Inter,system-ui,sans-serif;box-shadow:0 24px 64px rgba(0,0,0,.5);max-height:92vh;overflow-y:auto;}'
    + '#wd-lead-modal h2{font-family:"Playfair Display",Georgia,serif;font-size:26px;font-weight:600;line-height:1.2;margin:0 0 8px;color:#F4EDE0;}'
    + '#wd-lead-modal p.wd-sub{margin:0 0 20px;font-size:14.5px;line-height:1.55;color:rgba(244,237,224,.75);}'
    + '#wd-lead-modal label{display:block;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#C9A277;margin:0 0 5px;}'
    + '#wd-lead-modal input{width:100%;box-sizing:border-box;background:#2D2D2D;border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#F4EDE0;font-size:15px;padding:11px 13px;margin-bottom:14px;font-family:inherit;}'
    + '#wd-lead-modal input:focus{outline:none;border-color:#C9A277;}'
    + '#wd-lead-modal input::placeholder{color:rgba(244,237,224,.35);}'
    + '#wd-lead-modal .wd-hp{position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden;}'
    + '#wd-lead-modal button.wd-submit{width:100%;background:linear-gradient(90deg,#A8855C,#C9A277);color:#1A1A1A;border:0;border-radius:999px;padding:13px 20px;font-size:15px;font-weight:700;letter-spacing:.02em;cursor:pointer;margin-top:4px;font-family:inherit;}'
    + '#wd-lead-modal button.wd-submit:hover{filter:brightness(1.07);}'
    + '#wd-lead-modal button.wd-submit:disabled{opacity:.6;cursor:wait;}'
    + '#wd-lead-modal .wd-sms-alt{margin:16px 0 0;font-size:13px;text-align:center;color:rgba(244,237,224,.6);}'
    + '#wd-lead-modal .wd-sms-alt a{color:#C9A277;font-weight:600;text-decoration:underline;text-underline-offset:3px;}'
    + '#wd-lead-modal .wd-close{position:absolute;top:14px;right:14px;background:none;border:0;color:rgba(244,237,224,.5);font-size:22px;line-height:1;cursor:pointer;padding:6px;}'
    + '#wd-lead-modal .wd-close:hover{color:#F4EDE0;}'
    + '#wd-lead-modal .wd-error{display:none;color:#FF8C9E;font-size:13px;margin:0 0 10px;}'
    + '#wd-lead-success{display:none;text-align:center;padding:12px 0 6px;}'
    + '#wd-lead-success h2{margin-bottom:10px;}'
    + '#wd-lead-success p{font-size:14.5px;line-height:1.6;color:rgba(244,237,224,.78);margin:0 0 6px;}'
    + '#wd-lead-success a{color:#C9A277;font-weight:600;text-decoration:underline;text-underline-offset:3px;}'
    + '#wd-lead-success a.wd-sms-btn{display:inline-block;margin-top:14px;background:linear-gradient(90deg,#A8855C,#C9A277);color:#1A1A1A;border-radius:999px;padding:12px 28px;font-size:15px;font-weight:700;text-decoration:none;}';

  /* == Announcement bar ================================================== */
  function buildBar() {
    var bar = document.createElement('div');
    bar.id = 'wd-lead-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Announcement');
    bar.innerHTML =
      '<span>Get on the list: text <strong>' + SMS_KEYWORD + '</strong> to ' +
      '<a href="' + SMS_HREF + '">' + SMS_NUMBER_DISPLAY + '</a></span>' +
      '<button type="button" class="wd-bar-join">Join the list</button>' +
      '<button type="button" class="wd-bar-x" aria-label="Dismiss announcement">&times;</button>';
    document.body.insertBefore(bar, document.body.firstChild);

    var header = document.getElementById('wd-header');
    function offset() {
      var h = bar.offsetHeight;
      if (header) header.style.top = h + 'px';
      document.body.style.marginTop = h + 'px';
    }
    offset();
    window.addEventListener('resize', offset);

    bar.querySelector('.wd-bar-join').addEventListener('click', function () { openPopup(); });
    bar.querySelector('.wd-bar-x').addEventListener('click', function () {
      bar.remove();
      if (header) header.style.top = '';
      document.body.style.marginTop = '';
      snooze(LS_BAR, BAR_DISMISS_DAYS);
    });
  }

  /* == Popup ============================================================= */
  var overlay;

  function buildPopup() {
    overlay = document.createElement('div');
    overlay.id = 'wd-lead-overlay';
    overlay.innerHTML =
      '<div id="wd-lead-modal" role="dialog" aria-modal="true" aria-labelledby="wd-lead-title">' +
        '<button type="button" class="wd-close" aria-label="Close">&times;</button>' +
        '<div id="wd-lead-form-wrap">' +
          '<h2 id="wd-lead-title">Stay in the loop</h2>' +
          '<p class="wd-sub">Be the first to hear about Love Immersion dates, events, and new experiences from WeDeepen.</p>' +
          '<form id="wd-lead-form" novalidate>' +
            '<div class="wd-hp" aria-hidden="true"><label for="wd-company">Company</label><input id="wd-company" name="company" type="text" tabindex="-1" autocomplete="off"></div>' +
            '<label for="wd-first">First name</label>' +
            '<input id="wd-first" name="firstName" type="text" autocomplete="given-name" required placeholder="Your first name">' +
            '<label for="wd-email">Email</label>' +
            '<input id="wd-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">' +
            '<label for="wd-phone">Cell phone</label>' +
            '<input id="wd-phone" name="phone" type="tel" autocomplete="tel" placeholder="(512) 555-0100">' +
            '<label for="wd-location">Location</label>' +
            '<input id="wd-location" name="location" type="text" autocomplete="address-level2" placeholder="City, State">' +
            '<p class="wd-error" id="wd-lead-error">Please add your first name and a valid email.</p>' +
            '<button type="submit" class="wd-submit">Count me in</button>' +
          '</form>' +
          '<p class="wd-sms-alt">Prefer text? Send <strong>' + SMS_KEYWORD + '</strong> to <a href="' + SMS_HREF + '">' + SMS_NUMBER_DISPLAY + '</a></p>' +
        '</div>' +
        '<div id="wd-lead-success">' +
          '<h2>You&#39;re on the list</h2>' +
          '<p id="wd-lead-success-msg">We&#39;ll keep you posted on upcoming dates and events.</p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) closePopup(true); });
    overlay.querySelector('.wd-close').addEventListener('click', function () { closePopup(true); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('wd-open')) closePopup(true);
    });
    overlay.querySelector('#wd-lead-form').addEventListener('submit', onSubmit);
  }

  function openPopup() {
    if (!overlay) buildPopup();
    overlay.classList.add('wd-open');
    var first = overlay.querySelector('#wd-first');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function closePopup(userDismissed) {
    overlay.classList.remove('wd-open');
    if (userDismissed) snooze(LS_POPUP, DISMISS_DAYS);
  }

  function showSuccess(msgHtml) {
    overlay.querySelector('#wd-lead-form-wrap').style.display = 'none';
    var s = overlay.querySelector('#wd-lead-success');
    if (msgHtml) overlay.querySelector('#wd-lead-success-msg').innerHTML = msgHtml;
    s.style.display = 'block';
  }

  function onSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var firstName = form.firstName.value.trim();
    var email = form.email.value.trim();
    var err = overlay.querySelector('#wd-lead-error');

    if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.style.display = 'block';
      return;
    }
    err.style.display = 'none';

    if (form.company.value) { // honeypot: pretend success, send nothing
      showSuccess();
      snooze(LS_POPUP, JOINED_DAYS);
      return;
    }

    if (!ENDPOINT) {
      // Backend not wired yet: point them at the SMS list so no lead is lost.
      showSuccess('One more step: text <strong>' + SMS_KEYWORD + '</strong> to ' +
        '<a href="' + SMS_HREF + '">' + SMS_NUMBER_DISPLAY + '</a> and you&#39;re in.' +
        '<br><a class="wd-sms-btn" href="' + SMS_HREF + '">Text ' + SMS_KEYWORD + '</a>');
      snooze(LS_POPUP, JOINED_DAYS);
      return;
    }

    var btn = form.querySelector('.wd-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    var body = new URLSearchParams({
      firstName: firstName,
      email: email,
      phone: form.phone.value.trim(),
      location: form.location.value.trim(),
      page: location.pathname
    });

    fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body: body })
      .then(function () {
        showSuccess();
        snooze(LS_POPUP, JOINED_DAYS);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Count me in';
        err.textContent = 'Something went wrong. You can also text ' + SMS_KEYWORD + ' to ' + SMS_NUMBER_DISPLAY + '.';
        err.style.display = 'block';
      });
  }

  /* == Init ============================================================== */
  function init() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    if (!snoozed(LS_BAR)) buildBar();

    // Any element with data-lead-popup opens the popup on click.
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-lead-popup]');
      if (t) { e.preventDefault(); openPopup(); }
    });

    if (!snoozed(LS_POPUP)) {
      setTimeout(openPopup, POPUP_DELAY_MS);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
