/**
 * WeDeepen lead capture: announcement bar + popup.
 *
 * Injected on page load. Self-contained CSS (no Tailwind dependency) so it
 * renders identically on every page it's included on.
 *
 * Desktop popup submissions go straight to SimpleTexting (joinContact API),
 * which subscribes the contact to the COUNTMEIN list, the same list people
 * reach by texting the keyword. A fire-and-forget copy is also logged to the
 * "WeDeepen Leads" Google Sheet via Apps Script for page attribution.
 * If SimpleTexting is unreachable, the popup falls back to the
 * "text COUNT ME IN" instruction plus a sheet log so no lead is lost.
 *
 * Setup docs: scripts/lead-capture/README.md
 */
(function () {
  'use strict';

  /* == Config ============================================================ */
  // SimpleTexting web form (Apps > Web Sign-Up Forms > "WebSite Pop-up").
  var ST_ENDPOINT = 'https://app2.simpletexting.com/join/joinContact';
  var ST_WEBFORM_ID = '6a725eb22813b371a658bdc9';
  var ST_TERMS_URL = 'https://app2.simpletexting.com/web-forms/terms/' + ST_WEBFORM_ID;
  var ST_PRIVACY_URL = 'https://app2.simpletexting.com/web-forms/privacy-policy/' + ST_WEBFORM_ID;
  // Google Apps Script web app URL (ends in /exec). Backup log only.
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxTqMV9og1cnFzVI6KE5yLtjYcVD5C81cj0P3cPRcCJMynxIz2YsZHJ52IkvbnEo6s97Q/exec';
  var SMS_NUMBER_DISPLAY = '833-407-0037';
  var SMS_KEYWORD = 'COUNT ME IN';
  var SMS_HREF = 'sms:+18334070037?&body=COUNT%20ME%20IN';
  var VCARD_URL = '/wedeepen.vcf';
  var POPUP_DELAY_MS = 7000;

  // Mobile = text-first (SMS CTA + save contact). Desktop = form.
  // ?wd-view=mobile / ?wd-view=desktop override for QA.
  var IS_MOBILE = (function () {
    if (/[?&#]wd-view=mobile/.test(location.href)) return true;
    if (/[?&#]wd-view=desktop/.test(location.href)) return false;
    return /Android|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /iPad|Macintosh/.test(navigator.userAgent));
  })();
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
    + '#wd-lead-bar{position:fixed;top:0;left:0;right:0;z-index:60;background:#211B16;color:#F4EDE0;border-bottom:1px solid rgba(201,162,119,.4);font-family:"DM Sans",Inter,system-ui,sans-serif;font-size:14.5px;line-height:1.35;display:flex;align-items:center;justify-content:center;gap:14px;padding:10px 44px 10px 16px;text-align:center;}'
    + '#wd-lead-bar strong{font-weight:700;letter-spacing:.02em;}'
    + '#wd-lead-bar .wd-bar-gold{color:#C9A277;}'
    + '#wd-lead-bar .wd-bar-join{background:linear-gradient(90deg,#A8855C,#C9A277,#D4B78C);color:#1A1A1A;border:0;border-radius:999px;padding:7px 18px;font-size:13.5px;font-weight:700;letter-spacing:.02em;cursor:pointer;white-space:nowrap;text-decoration:none;display:inline-block;}'
    + '#wd-lead-bar .wd-bar-join:hover{filter:brightness(1.08);}'
    + '#wd-lead-bar .wd-bar-x{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:#F4EDE0;opacity:.5;font-size:18px;line-height:1;cursor:pointer;padding:6px;}'
    + '#wd-lead-bar .wd-bar-x:hover{opacity:1;}'
    + '#wd-lead-bar .wd-bar-msg{font-weight:500;letter-spacing:.01em;color:rgba(244,237,224,.92);}'
    + '#wd-lead-bar .wd-bar-number{font-size:14px;padding:8px 20px;font-variant-numeric:tabular-nums;}'
    + '#wd-lead-bar .wd-bar-stack{display:block;}'
    + '#wd-lead-bar .wd-bar-line1{display:block;font-size:18px;font-weight:600;letter-spacing:.01em;line-height:1.35;}'
    + '#wd-lead-bar .wd-bar-line1 strong{color:#C9A277;font-weight:700;}'
    + '#wd-lead-bar a.wd-bar-num{color:#C9A277;font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px;font-variant-numeric:tabular-nums;padding:2px 2px;white-space:nowrap;}'
    + '#wd-lead-bar .wd-bar-line2{display:block;font-size:12.5px;font-weight:500;color:rgba(244,237,224,.65);margin-top:3px;}'
    + '@media (max-width:640px){#wd-lead-bar{font-size:13px;flex-wrap:wrap;gap:8px;padding:9px 40px 10px 12px;}}'
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
    + '#wd-lead-modal .wd-opt{color:rgba(244,237,224,.35);font-weight:400;text-transform:none;letter-spacing:.02em;}'
    + '#wd-lead-modal .wd-row{display:flex;gap:12px;}'
    + '#wd-lead-modal .wd-row>div{flex:1;}'
    + '#wd-lead-modal .wd-row .wd-state{flex:0 0 84px;}'
    + '#wd-lead-modal .wd-podcast{margin-bottom:2px;}'
    + '#wd-lead-modal .wd-podcast label{color:rgba(244,237,224,.85);font-size:13px;}'
    + '#wd-lead-modal .wd-consent{display:flex;align-items:flex-start;gap:10px;margin:4px 0 10px;}'
    + '#wd-lead-modal input.wd-check{appearance:none;-webkit-appearance:none;flex:0 0 18px;width:18px;height:18px;margin:2px 0 0;padding:0;border:1px solid rgba(255,255,255,.3);border-radius:5px;background:#2D2D2D;cursor:pointer;position:relative;}'
    + '#wd-lead-modal input.wd-check:checked{background:linear-gradient(135deg,#A8855C,#C9A277);border-color:#C9A277;}'
    + '#wd-lead-modal input.wd-check:checked:after{content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid #1A1A1A;border-width:0 2px 2px 0;transform:rotate(45deg);}'
    + '#wd-lead-modal .wd-consent label{display:inline;font-size:12.5px;font-weight:400;letter-spacing:0;text-transform:none;color:rgba(244,237,224,.85);line-height:1.55;margin:0;cursor:pointer;}'
    + '#wd-lead-modal .wd-consent a{color:#C9A277;text-decoration:underline;text-underline-offset:2px;}'
    + '#wd-lead-modal .wd-legal{font-size:10.5px;line-height:1.55;color:rgba(244,237,224,.45);margin:0 0 6px;}'
    + '#wd-lead-modal .wd-legal a{color:rgba(244,237,224,.6);}'
    + '#wd-lead-success{display:none;text-align:center;padding:12px 0 6px;}'
    + '#wd-lead-success h2{margin-bottom:10px;}'
    + '#wd-lead-success p{font-size:14.5px;line-height:1.6;color:rgba(244,237,224,.78);margin:0 0 6px;}'
    + '#wd-lead-success a{color:#C9A277;font-weight:600;text-decoration:underline;text-underline-offset:3px;}'
    + '#wd-lead-modal a.wd-sms-btn{display:inline-block;margin-top:14px;background:linear-gradient(90deg,#A8855C,#C9A277);color:#1A1A1A;border-radius:999px;padding:12px 28px;font-size:15px;font-weight:700;text-decoration:none;}'
    + '#wd-lead-modal .wd-sms-panel{text-align:center;padding:6px 0 4px;}'
    + '#wd-lead-modal .wd-sms-panel .wd-number{font-family:"Playfair Display",Georgia,serif;font-size:24px;color:#F4EDE0;margin:14px 0 2px;}'
    + '#wd-lead-modal .wd-sms-panel .wd-number a{color:#F4EDE0;text-decoration:none;}'
    + '#wd-lead-modal .wd-vcard{margin:18px 0 0;font-size:13.5px;line-height:1.5;color:rgba(244,237,224,.6);text-align:center;}'
    + '#wd-lead-modal .wd-vcard a{color:#C9A277;font-weight:600;text-decoration:underline;text-underline-offset:3px;}';

  /* == Announcement bar ================================================== */
  function buildBar() {
    var bar = document.createElement('div');
    bar.id = 'wd-lead-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Announcement');
    if (IS_MOBILE) {
      bar.innerHTML =
        '<span class="wd-bar-stack">' +
          '<span class="wd-bar-line1">Text <strong>' + SMS_KEYWORD + '</strong> to <a class="wd-bar-num" href="' + SMS_HREF + '">' + SMS_NUMBER_DISPLAY + '</a></span>' +
          '<span class="wd-bar-line2">Get on the list: private invitations from WeDeepen.</span>' +
        '</span>' +
        '<button type="button" class="wd-bar-x" aria-label="Dismiss announcement">&times;</button>';
    } else {
      bar.innerHTML =
        '<span class="wd-bar-msg"><strong class="wd-bar-gold">Get on the list:</strong> private invitations, in-person events, and everything it takes to get really good at love.</span>' +
        '<button type="button" class="wd-bar-join">Count Me In</button>' +
        '<button type="button" class="wd-bar-x" aria-label="Dismiss announcement">&times;</button>';
    }
    document.body.insertBefore(bar, document.body.firstChild);

    var header = document.getElementById('wd-header');
    function offset() {
      var h = bar.offsetHeight;
      if (header) header.style.top = h + 'px';
      document.body.style.marginTop = h + 'px';
    }
    offset();
    window.addEventListener('resize', offset);

    var join = bar.querySelector('button.wd-bar-join');
    if (join) join.addEventListener('click', function () { openPopup(); });
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

    var formPanel =
      '<div id="wd-lead-form-wrap">' +
        '<h2 id="wd-lead-title">Get on the list</h2>' +
        '<p class="wd-sub">Be the first to hear about Love Immersion dates, events, and new experiences from WeDeepen.</p>' +
        '<form id="wd-lead-form" novalidate>' +
          '<div class="wd-hp" aria-hidden="true"><label for="wd-company">Company</label><input id="wd-company" name="company" type="text" tabindex="-1" autocomplete="off"></div>' +
          '<label for="wd-first">First name</label>' +
          '<input id="wd-first" name="firstname" type="text" autocomplete="given-name" required placeholder="Your first name">' +
          '<label for="wd-phone">Cell phone</label>' +
          '<input id="wd-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(512) 555-0100">' +
          '<label for="wd-email">Email <span class="wd-opt">(optional)</span></label>' +
          '<input id="wd-email" name="email" type="email" autocomplete="email" placeholder="you@example.com">' +
          '<div class="wd-row">' +
            '<div><label for="wd-city">City <span class="wd-opt">(optional)</span></label>' +
            '<input id="wd-city" name="city" type="text" autocomplete="address-level2" placeholder="Austin"></div>' +
            '<div class="wd-state"><label for="wd-state">State</label>' +
            '<input id="wd-state" name="state" type="text" autocomplete="address-level1" maxlength="2" placeholder="TX"></div>' +
          '</div>' +
          '<div class="wd-consent wd-podcast">' +
            '<input id="wd-podcast" name="podcast" type="checkbox" class="wd-check">' +
            '<label for="wd-podcast">Text me new podcast episodes each week.</label>' +
          '</div>' +
          '<div class="wd-consent">' +
            '<input id="wd-consent" name="consent" type="checkbox" class="wd-check">' +
            '<label for="wd-consent">I agree to receive promotional messages from WeDeepen up to 4 Msgs/Month. This agreement isn&#39;t a condition of any purchase. I also agree to the <a href="' + ST_TERMS_URL + '" target="_blank" rel="noopener">Terms of Service</a> and <a href="' + ST_PRIVACY_URL + '" target="_blank" rel="noopener">Privacy Policy</a>. Msg &amp; Data rates may apply.</label>' +
          '</div>' +
          '<p class="wd-legal">By submitting this form, I agree that my mobile information will not be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude my text messaging originator opt-in data and consent; this information will not be shared with any third parties, except for the necessary opt-in data required to facilitate the SMS service. Text STOP to opt-out. Text HELP for assistance. team@wedeepen.com</p>' +
          '<p class="wd-error" id="wd-lead-error">Please add your first name and phone number.</p>' +
          '<button type="submit" class="wd-submit">Count Me In</button>' +
        '</form>' +
        '<p class="wd-sms-alt">Prefer text? Send <strong>' + SMS_KEYWORD + '</strong> to <a href="' + SMS_HREF + '">' + SMS_NUMBER_DISPLAY + '</a></p>' +
      '</div>';

    var smsPanel =
      '<div id="wd-lead-form-wrap" class="wd-sms-panel">' +
        '<h2 id="wd-lead-title">Get on the list</h2>' +
        '<p class="wd-sub">Text <strong>' + SMS_KEYWORD + '</strong> to the number below and you&#39;re in. Be the first to hear about Love Immersion dates and events.</p>' +
        '<p class="wd-number"><a href="' + SMS_HREF + '">' + SMS_NUMBER_DISPLAY + '</a></p>' +
        '<a class="wd-sms-btn" id="wd-sms-cta" href="' + SMS_HREF + '">Text ' + SMS_KEYWORD + '</a>' +
        '<p class="wd-vcard"><a href="' + VCARD_URL + '" download>Save WeDeepen to your contacts</a><br>so you always know it&#39;s us texting.</p>' +
      '</div>';

    overlay.innerHTML =
      '<div id="wd-lead-modal" role="dialog" aria-modal="true" aria-labelledby="wd-lead-title">' +
        '<button type="button" class="wd-close" aria-label="Close">&times;</button>' +
        (IS_MOBILE ? smsPanel : formPanel) +
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

    var form = overlay.querySelector('#wd-lead-form');
    if (form) {
      form.addEventListener('submit', onSubmit);
      form.querySelector('#wd-phone').addEventListener('input', function () {
        this.value = formatPhone(this.value);
      });
    }

    var smsCta = overlay.querySelector('#wd-sms-cta');
    if (smsCta) {
      smsCta.addEventListener('click', function () {
        // They jumped to Messages — count it as joined so the popup stops nagging.
        snooze(LS_POPUP, JOINED_DAYS);
      });
    }
  }

  function openPopup() {
    if (!overlay) buildPopup();
    overlay.classList.add('wd-open');
    var first = overlay.querySelector('#wd-first');
    if (first) setTimeout(function () {
      try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
      var modal = overlay.querySelector('#wd-lead-modal');
      if (modal) modal.scrollTop = 0;
    }, 60);
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

  function formatPhone(value) {
    var d = value.replace(/\D/g, '');
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    d = d.substring(0, 10);
    var a = d.substring(0, 3), b = d.substring(3, 6), c = d.substring(6, 10);
    if (!a) return '';
    if (!b) return '(' + a;
    if (!c) return '(' + a + ') ' + b;
    return '(' + a + ') ' + b + '-' + c;
  }

  // Fire-and-forget copy to the Google Sheet for page attribution / backup.
  function logToSheet(firstName, phone, email, locationStr) {
    if (!ENDPOINT) return;
    try {
      fetch(ENDPOINT, {
        method: 'POST', mode: 'no-cors',
        body: new URLSearchParams({
          firstName: firstName, email: email || '', phone: phone,
          location: locationStr || '', page: location.pathname
        })
      }).catch(function () {});
    } catch (e) { /* never block the signup on the log */ }
  }

  function showError(msg) {
    var err = overlay.querySelector('#wd-lead-error');
    err.textContent = msg;
    err.style.display = 'block';
  }

  function onSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var firstName = form.firstname.value.trim();
    var phone = form.phone.value.replace(/\D/g, '');
    if (phone.length === 11 && phone.charAt(0) === '1') phone = phone.slice(1);
    var email = form.email.value.trim();
    var city = form.city.value.trim();
    var state = form.state.value.trim().toUpperCase();
    var podcast = form.podcast.checked ? 'Yes' : 'No';
    var err = overlay.querySelector('#wd-lead-error');
    err.style.display = 'none';

    if (form.company.value) { // honeypot: pretend success, send nothing
      showSuccess();
      snooze(LS_POPUP, JOINED_DAYS);
      return;
    }

    if (!firstName) { showError('Please add your first name.'); return; }
    if (phone.length !== 10) { showError('Please add a 10-digit cell phone number.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('That email doesn’t look right (or leave it blank).'); return; }
    if (!form.consent.checked) { showError('Please check the box so we have your OK to text you.'); return; }

    var btn = form.querySelector('.wd-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    function restoreButton() {
      btn.disabled = false;
      btn.textContent = 'Count Me In';
    }

    // SMS keeps working even if the API is down: hand them the keyword and log
    // the lead to the sheet so it isn't lost.
    var locationStr = city + (city && state ? ', ' : '') + state;

    function smsFallback() {
      logToSheet(firstName, phone, email, locationStr);
      showSuccess('One more step: text <strong>' + SMS_KEYWORD + '</strong> to ' +
        '<a href="' + SMS_HREF + '">' + SMS_NUMBER_DISPLAY + '</a> and you&#39;re in.' +
        '<br><a class="wd-sms-btn" href="' + SMS_HREF + '">Text ' + SMS_KEYWORD + '</a>');
      snooze(LS_POPUP, JOINED_DAYS);
    }

    // SimpleTexting custom-field names come from the web form definition.
    var fieldValues = { phone: phone, firstname: firstName, Podcasts: podcast };
    if (email) fieldValues.email = email;
    if (city) fieldValues.whats_your_city_full_name = city;
    if (state) fieldValues.answer_with_abbreviation_what_state_are_you_primarily_in_ex_ca = state;

    fetch(ST_ENDPOINT + '?r=' + Date.now(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        webFormId: ST_WEBFORM_ID,
        fieldValues: fieldValues,
        listIds: []
      })
    }).then(function (res) {
      if (res.ok) {
        logToSheet(firstName, phone, email, locationStr);
        showSuccess('Watch your phone: a text from WeDeepen is on its way to confirm you&#39;re in.');
        snooze(LS_POPUP, JOINED_DAYS);
        return;
      }
      if (res.status === 418) {
        return res.text().then(function (text) {
          var error = {};
          try { error = JSON.parse(text); } catch (e2) { /* fall through */ }
          if (error.code === 'DuplicateContactPhoneException') {
            showSuccess('Good news: that number is already on the list. We&#39;ll keep the texts coming.');
            snooze(LS_POPUP, JOINED_DAYS);
            return;
          }
          restoreButton();
          if (error.code === 'CustomFieldsValidationException' && error.reasons) {
            var k = Object.keys(error.reasons)[0];
            showError(k === 'phone'
              ? 'That phone number doesn’t look right. Try (XXX) XXX-XXXX.'
              : String(error.reasons[k]));
          } else {
            showError('Something went wrong. You can also text ' + SMS_KEYWORD + ' to ' + SMS_NUMBER_DISPLAY + '.');
          }
        });
      }
      smsFallback();
    }).catch(smsFallback);
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

    // Auto-open on desktop only. On mobile the bar's one-tap "text us" beats
    // any popup, and Google penalizes auto-interstitials in mobile search.
    if (!IS_MOBILE && !snoozed(LS_POPUP)) {
      setTimeout(openPopup, POPUP_DELAY_MS);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
