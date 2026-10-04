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
  // René's "WeDeepen Website Sign-ups" sheet: one row per sign-up with date
  // and time, plus an email to r@wedeepen.com. Apps Script source:
  // scripts/lead-capture/signups-notify.gs
  var SIGNUPS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwOrt4wlG4J3zuvwmdaoakHLkv5sJB7NR_OAmlz1qNjnYQzu3QSlhscgijQHdj01Kfysw/exec';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxTqMV9og1cnFzVI6KE5yLtjYcVD5C81cj0P3cPRcCJMynxIz2YsZHJ52IkvbnEo6s97Q/exec';
  var SMS_NUMBER_DISPLAY = '833-407-0037';
  var SMS_KEYWORD = 'COUNT ME IN';
  var SMS_HREF = 'sms:+18334070037?&body=COUNT%20ME%20IN';
  var VCARD_URL = '/wedeepen.vcf';
  var LI_URL = '/love-immersion/october-2026/?utm_source=announcement-bar&utm_campaign=li-oct26-earlyaccess';
  var PROMO_END = Date.parse('2026-08-17T04:59:59Z'); // Aug 16, 11:59pm Austin
  var ON_LI_PAGE = /^\/love-immersion\//.test(location.pathname);
  var ON_FOUR_PILLARS = /^\/four-pillars\//.test(location.pathname);
  var PROMO_ACTIVE = (function () {
    if (/[?&#]wd-promo=off/.test(location.href)) return false;
    return Date.now() < PROMO_END;
  })();

  function promoCountdown() {
    var d = Math.ceil((PROMO_END - Date.now()) / 864e5);
    if (d <= 1) return 'ends tonight';
    if (d === 2) return 'ends tomorrow';
    return d + ' days left';
  }
  var POPUP_DELAY_MS = 4000;
  // Announcement-bar hooks. Each visitor gets one at random and keeps it for
  // the session, so the lead log can tell which line pulled. `bar` is the
  // desktop bar line, `title`/`sub` head the popup. The bar is list capture
  // only (the hero sells the $99); a hook with `href` would send the bar
  // button straight there instead of opening the popup.
  var HOOKS = [
    { id: 'not-alone',
      bar: 'Don&#39;t do your love life alone.',
      plain: 'Don\'t do your love life alone.',
      title: 'Don&#39;t do your love life alone.',
      sub: 'Private invitations, new dates, and a room full of people learning love together.' },
    { id: 'trainable-skill',
      bar: 'Love is a trainable skill. Train with us.',
      plain: 'Love is a trainable skill. Train with us.',
      title: 'Love is a trainable skill.',
      sub: 'Private invitations, new dates, and everything it takes to practice it.' },
    { id: 'stay-yourself',
      bar: 'Learn to stay yourself in love.',
      plain: 'Learn to stay yourself in love.',
      title: 'Learn to stay yourself in love.',
      sub: 'Private invitations, new dates, and everything it takes to stay yourself in love.' },
    { id: 'couples-study',
      bar: 'Strong couples study love. Join them.',
      plain: 'Strong couples study love. Join them.',
      title: 'Strong couples study love.',
      sub: 'Private invitations, new dates, and a room of couples who take love seriously.' },
    { id: 'desire-rebuilt',
      bar: 'Desire can be rebuilt. Learn how.',
      plain: 'Desire can be rebuilt. Learn how.',
      title: 'Desire can be rebuilt.',
      sub: 'Private invitations, new dates, and everything it takes to bring desire back.' }
  ];
  var HOOK = (function () {
    var key = 'wd_hook';
    try {
      var saved = sessionStorage.getItem(key);
      for (var i = 0; i < HOOKS.length; i++) if (HOOKS[i].id === saved) return HOOKS[i];
    } catch (e) { /* storage blocked; just pick one */ }
    var pick = HOOKS[Math.floor(Math.random() * HOOKS.length)];
    try { sessionStorage.setItem(key, pick.id); } catch (e) {}
    return pick;
  })();
  // Links from inside the Circle community carry ?topic=... (see the Drop a
  // Line form on the homepage). Those visitors are already members, so skip
  // the list-building bar, popup, and header button entirely.
  // Ad landing mode (?wd-form=1, e.g. the Meta texting-list campaign): every
  // device gets the sign-up form, opened right away, so ad sign-ups fire the
  // Lead conversion. Phones normally get the text-us panel, which the pixel
  // can't confirm. Sticks for the rest of the visit.
  var AD_FORM = (function () {
    var key = 'wd_ad_form';
    try {
      if (/[?&]wd-form=1(&|$)/.test(location.search)) { sessionStorage.setItem(key, '1'); return true; }
      return sessionStorage.getItem(key) === '1';
    } catch (e) { return /[?&]wd-form=1(&|$)/.test(location.search); }
  })();
  // Four Pillars guide: a sign-up prompt (name + email, then a one-tap text
  // bonus) that replaces the automatic popup / phone sheet. Leads go to
  // MailerLite, whose "Four Pillars guide" automation emails the guide plus
  // two $99 follow-ups. Live since 2026-10-03; set GUIDE_LIVE = false to go
  // back to the texting popup (?wd-guide=1 then previews the guide).
  var GUIDE_LIVE = true;
  var GUIDE_ML_ENDPOINT = 'https://assets.mailerlite.com/jsonp/321715/forms/200340741738726767/subscribe'; // "Four Pillars guide - website popup" form
  var GUIDE_COVER = '/images/four-pillars-thumb.jpg';
  var GUIDE_MODE = (function () {
    var key = 'wd_guide';
    try {
      if (/[?&]wd-guide=1(&|$)/.test(location.search)) { sessionStorage.setItem(key, '1'); return true; }
      return GUIDE_LIVE || sessionStorage.getItem(key) === '1';
    } catch (e) { return GUIDE_LIVE || /[?&]wd-guide=1(&|$)/.test(location.search); }
  })();
  var MEMBER_LINK = (function () {
    try { return new URLSearchParams(location.search).has('topic'); } catch (e) { return false; }
  })();
  // Clicks from our own emails (?utm_medium=email, e.g. the Four Pillars
  // MailerLite sequence) are already on the list: no bar or auto popup for
  // the rest of the visit. Buttons that open the popup on click still work.
  var FROM_EMAIL = (function () {
    var key = 'wd_from_email';
    try {
      if (/[?&]utm_medium=email(&|$)/.test(location.search)) { sessionStorage.setItem(key, '1'); return true; }
      return sessionStorage.getItem(key) === '1';
    } catch (e) { return /[?&]utm_medium=email(&|$)/.test(location.search); }
  })();

  // Mobile = text-first (SMS CTA + save contact). Desktop = form.
  // ?wd-view=mobile / ?wd-view=desktop override for QA.
  var IS_MOBILE = (function () {
    if (/[?&#]wd-view=mobile/.test(location.href)) return true;
    if (/[?&#]wd-view=desktop/.test(location.href)) return false;
    return /Android|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /iPad|Macintosh/.test(navigator.userAgent));
  })();
  // Phones get a small bottom sheet instead of a popup, once the visitor has
  // scrolled this far down the page (Google is fine with banners that leave
  // the content usable; it penalizes full-screen interstitials on mobile).
  var SHEET_SCROLL_DEPTH = 0.25;
  var SHEET_DISMISS_DAYS = 5;  // bottom sheet snooze after close
  var DISMISS_DAYS = 7;    // popup snooze after close
  var JOINED_DAYS = 365;   // popup snooze after successful submit
  var BAR_DISMISS_DAYS = 7;

  var LS_POPUP = 'wd_lead_popup_until';
  var LS_BAR = 'wd_lead_bar_until';
  var SS_BAR_OFF = 'wd_lead_bar_off';  // bar handed off to the bottom sheet this visit

  function snoozed(key) {
    try { return Date.now() < Number(localStorage.getItem(key) || 0); }
    catch (e) { return false; }
  }
  // Never shortens a longer snooze (e.g. closing the text form after a guide
  // sign-up must not cut the year-long one down to 7 days).
  function snooze(key, days) {
    try {
      var until = Date.now() + days * 864e5;
      if (until > Number(localStorage.getItem(key) || 0)) localStorage.setItem(key, String(until));
    } catch (e) { /* private mode */ }
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
    + '#wd-lead-bar .wd-bar-stack{display:block;min-width:0;max-width:100%;}'
    + '#wd-lead-bar .wd-bar-line1{display:block;overflow:hidden;font-size:14px;font-weight:500;letter-spacing:.01em;line-height:1.4;}'
    + '#wd-lead-bar .wd-bar-line1 strong{color:#C9A277;font-weight:700;}'
    + '#wd-lead-bar a.wd-bar-num{color:#C9A277;font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px;font-variant-numeric:tabular-nums;padding:2px 2px;white-space:nowrap;}'
    + '#wd-lead-bar .wd-bar-line2{display:block;font-size:12.5px;font-weight:500;color:rgba(244,237,224,.65);margin-top:3px;}'
    + '#wd-lead-bar a.wd-bar-link{color:#C9A277;font-weight:700;text-decoration:underline;text-underline-offset:3px;white-space:nowrap;}'
    + '#wd-lead-bar a.wd-bar-link-lg{display:inline-block;font-size:14px;margin-top:4px;}'
    + '#wd-lead-bar.wd-gold a.wd-bar-link{color:#1A1A1A;}'
    + '@media (max-width:640px){#wd-lead-bar{font-size:13px;flex-wrap:wrap;gap:8px;padding:9px 40px 10px 12px;}}'
    + '#wd-lead-bar a.wd-bar-sms{margin-top:7px;padding:6px 18px;font-size:13px;}'
    + '#wd-lead-bar.wd-gold{background:linear-gradient(90deg,#C9A277,#E9CDA0,#D4B78C);color:#1A1A1A;border-bottom:0;box-shadow:0 1px 8px rgba(0,0,0,.2);}'
    + '#wd-lead-bar.wd-gold .wd-bar-msg{color:#1A1A1A;font-weight:600;}'
    + '#wd-lead-bar.wd-gold .wd-bar-gold{color:#1A1A1A;font-weight:700;}'
    + '#wd-lead-bar.wd-gold .wd-bar-join{background:#1A1A1A;color:#F4EDE0;}'
    + '#wd-lead-bar.wd-gold .wd-bar-join:hover{background:#2D2D2D;filter:none;}'
    + '#wd-lead-bar.wd-gold .wd-bar-x{color:#1A1A1A;}'
    + '#wd-lead-bar.wd-slim{font-size:13px;padding:8px 44px 8px 16px;}'
    + '#wd-lead-bar.wd-slim .wd-bar-msg,#wd-lead-bar.wd-slim .wd-bar-line1{font-weight:400;color:#F4EDE0;}'
    + '#wd-lead-bar a.wd-bar-cta,#wd-lead-bar button.wd-bar-cta{display:inline;background:none;border:0;border-radius:0;margin:0;padding:0 2px;color:#C9A277;font:inherit;font-weight:700;letter-spacing:.01em;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px;cursor:pointer;white-space:nowrap;}'
    + '#wd-lead-bar a.wd-bar-cta:hover,#wd-lead-bar button.wd-bar-cta:hover{color:#E9CDA0;filter:none;}'
    + '@media (max-width:640px){#wd-lead-bar.wd-slim{padding:8px 34px 8px 12px;}}'
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
    + '#wd-lead-sheet{position:fixed;left:0;right:0;bottom:0;z-index:90;background:#1A1A1A;color:#F4EDE0;border-top:1px solid rgba(201,162,119,.45);border-radius:18px 18px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.45);padding:18px 20px calc(16px + env(safe-area-inset-bottom));font-family:"DM Sans",Inter,system-ui,sans-serif;text-align:center;transform:translateY(110%);transition:transform .35s ease;}'
    + '#wd-lead-sheet.wd-open{transform:translateY(0);}'
    + '#wd-lead-sheet .wd-sheet-grip{width:38px;height:4px;border-radius:2px;background:rgba(244,237,224,.2);margin:0 auto 12px;}'
    + '#wd-lead-sheet h2{font-family:"Playfair Display",Georgia,serif;font-size:20px;font-weight:600;line-height:1.25;margin:0 28px 6px;color:#F4EDE0;}'
    + '#wd-lead-sheet p{font-size:13.5px;line-height:1.5;color:rgba(244,237,224,.72);margin:0 0 14px;}'
    + '#wd-lead-sheet a.wd-sms-btn{display:block;background:linear-gradient(90deg,#A8855C,#C9A277);color:#1A1A1A;border-radius:999px;padding:13px 20px;font-size:15.5px;font-weight:700;text-decoration:none;}'
    + '#wd-lead-sheet .wd-sheet-save{display:inline-block;margin-top:10px;font-size:12.5px;color:#C9A277;font-weight:600;text-decoration:underline;text-underline-offset:3px;}'
    + '#wd-lead-sheet .wd-close{position:absolute;top:10px;right:10px;background:none;border:0;color:rgba(244,237,224,.5);font-size:22px;line-height:1;cursor:pointer;padding:8px;}'
    + '#wd-guide{position:fixed;left:0;right:0;bottom:0;z-index:95;background:#1A1A1A;color:#F4EDE0;border-top:1px solid rgba(201,162,119,.45);border-radius:20px 20px 0 0;box-shadow:0 -12px 44px rgba(0,0,0,.5);padding:22px 22px calc(18px + env(safe-area-inset-bottom));font-family:"DM Sans",Inter,system-ui,sans-serif;text-align:center;transform:translateY(110%);transition:transform .38s ease;max-height:92vh;overflow-y:auto;box-sizing:border-box;}'
    + '#wd-guide.wd-open{transform:translateY(0);}'
    + '@media (min-width:700px){#wd-guide{left:auto;right:24px;bottom:24px;width:420px;border:1px solid rgba(201,162,119,.45);border-radius:20px;}}'
    + '#wd-guide .wd-close{position:absolute;top:10px;right:10px;background:none;border:0;color:rgba(244,237,224,.5);font-size:22px;line-height:1;cursor:pointer;padding:8px;}'
    + '#wd-guide .wd-g-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#C9A277;margin:0 0 8px;}'
    + '#wd-guide h2{font-family:"Playfair Display",Georgia,serif;font-size:23px;font-weight:600;line-height:1.22;margin:0 22px 8px;color:#F4EDE0;}'
    + '#wd-guide p{font-size:14px;line-height:1.55;color:rgba(244,237,224,.75);margin:0 0 16px;}'
    + '#wd-guide .wd-g-btn{display:block;width:100%;box-sizing:border-box;background:#A01B4A;color:#fff;border:0;border-radius:999px;padding:15px 20px;font-size:15.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;font-family:inherit;text-decoration:none;}'
    + '#wd-guide .wd-g-btn:hover{background:#851437;}'
    + '#wd-guide .wd-g-btn:disabled{opacity:.6;cursor:wait;}'
    + '#wd-guide .wd-g-no{display:inline-block;margin-top:12px;background:none;border:0;color:rgba(244,237,224,.55);font-size:12px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;font-family:inherit;}'
    + '#wd-guide .wd-g-hero{display:flex;gap:16px;align-items:center;text-align:left;margin:4px 0 16px;}'
    + '#wd-guide .wd-g-hero img{width:84px;height:105px;object-fit:cover;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.45);flex:0 0 auto;}'
    + '#wd-guide .wd-g-hero h2{margin:0 0 6px;}'
    + '#wd-guide .wd-g-hero p{margin:0;font-size:13.5px;}'
    + '#wd-guide input[type=email]{width:100%;box-sizing:border-box;background:#2D2D2D;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:#F4EDE0;font-size:16px;padding:14px 20px;margin:0 0 12px;font-family:inherit;}'
    + '#wd-guide input[type=email]:focus{outline:none;border-color:#C9A277;}'
    + '#wd-guide .wd-g-fine{font-size:11.5px;color:rgba(244,237,224,.45);margin:10px 0 0;}'
    + '#wd-guide .wd-g-err{display:none;color:#FF8C9E;font-size:13px;margin:0 0 10px;}'
    + '#wd-guide .wd-g-hp{position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden;}'
    + '#wd-guide .wd-g-sms{margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);}'
    + '#wd-guide .wd-g-sms a.wd-g-btn{background:linear-gradient(90deg,#A8855C,#C9A277);color:#1A1A1A;}'
    + '#wd-guide input[type=text],#wd-guide input[type=tel]{width:100%;box-sizing:border-box;background:#2D2D2D;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:#F4EDE0;font-size:16px;padding:14px 20px;margin:0 0 12px;font-family:inherit;}'
    + '#wd-guide input[type=text]:focus,#wd-guide input[type=tel]:focus{outline:none;border-color:#C9A277;}'
    + '#wd-guide .wd-g-bonus{margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);text-align:left;}'
    + '#wd-guide .wd-g-bonus h3{font-family:"Playfair Display",Georgia,serif;font-size:18px;font-weight:600;color:#F4EDE0;margin:0 0 4px;text-align:center;}'
    + '#wd-guide .wd-g-bonus>p{text-align:center;}'
    + '#wd-guide .wd-g-consent{display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;}'
    + '#wd-guide .wd-g-consent input{flex:0 0 18px;width:18px;height:18px;margin:2px 0 0;accent-color:#C9A277;}'
    + '#wd-guide .wd-g-consent label{font-size:11.5px;line-height:1.5;color:rgba(244,237,224,.6);}'
    + '#wd-guide .wd-g-consent a{color:#C9A277;}'
    + '#wd-guide .wd-g-bonus .wd-g-btn{background:linear-gradient(90deg,#A8855C,#C9A277);color:#1A1A1A;text-align:center;}'
    + '#wd-guide .wd-g-desk{text-align:center;color:#F4EDE0;font-size:15px;}'
    + '#wd-guide .wd-g-bonus .wd-g-no{display:block;margin:10px auto 0;}'
    + '#wd-guide.wd-g-passed [data-step="3"]>.wd-g-eyebrow,#wd-guide.wd-g-passed .wd-g-hi,#wd-guide.wd-g-passed .wd-g-sent{display:none;}'
    + '#wd-guide.wd-g-passed .wd-g-bonus{margin-top:0;padding-top:4px;border-top:0;}'
    + '#wd-guide.wd-g-passed .wd-g-bonus h3{font-size:22px;margin-bottom:8px;padding:0 28px;}'
    + '#wd-guide [data-step]{display:none;}'
    + '#wd-guide[data-at="1"] [data-step="1"],#wd-guide[data-at="2"] [data-step="2"],#wd-guide[data-at="3"] [data-step="3"]{display:block;}'
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
      if (!(ON_LI_PAGE && PROMO_ACTIVE)) bar.classList.add('wd-slim');
      // Mobile runs list capture everywhere except LI pages, where the promo
      // code + countdown is the useful ribbon (reserve CTAs cover the page).
      bar.innerHTML = (ON_LI_PAGE && PROMO_ACTIVE)
        ? '<span class="wd-bar-stack">' +
            '<span class="wd-bar-line1">Next <strong>Love Immersion</strong>: Oct 17&ndash;19 &middot; Austin, TX</span>' +
            '<span class="wd-bar-line2">Use <strong>EARLYACCESS</strong> code to save $500 &middot; <strong>' + promoCountdown() + '</strong></span>' +
          '</span>' +
          '<button type="button" class="wd-bar-x" aria-label="Dismiss announcement">&times;</button>'
        :
        // One tap opens Messages with COUNT ME IN typed (same list as desktop).
        '<span class="wd-bar-stack">' +
          '<span class="wd-bar-line1">' + HOOK.bar + ' <a class="wd-bar-cta wd-bar-sms" href="' + SMS_HREF + '">Count Me In</a></span>' +
        '</span>' +
        '<button type="button" class="wd-bar-x" aria-label="Dismiss announcement">&times;</button>';
    } else {
      bar.classList.add(PROMO_ACTIVE ? 'wd-gold' : 'wd-slim');
      bar.innerHTML = PROMO_ACTIVE
        ? '<span class="wd-bar-msg"><strong>Next Love Immersion</strong> is Oct 17&ndash;19 in Austin, TX. Use <strong>EARLYACCESS</strong> code to save $500 through Aug 16th &middot; <strong>' + promoCountdown() + '</strong>.' +
          (ON_LI_PAGE ? '' : ' <a class="wd-bar-link" href="' + LI_URL + '">Sign Me Up</a>') + '</span>' +
          '<button type="button" class="wd-bar-x" aria-label="Dismiss announcement">&times;</button>'
        : '<span class="wd-bar-msg">' + HOOK.bar + ' ' +
          (HOOK.href
            ? '<a class="wd-bar-join" href="' + HOOK.href + '" target="_blank" rel="noopener">' + HOOK.cta + '</a>'
            : '<button type="button" class="wd-bar-join wd-bar-cta">Count Me In</button>') + '</span>' +
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
    // The bar grows after first measure (web font swap re-wraps the text,
    // notably on phones), which left the header sliding under it. Track the
    // bar's real size instead of trusting the initial measurement.
    if (window.ResizeObserver) {
      new ResizeObserver(offset).observe(bar);
    } else {
      setTimeout(offset, 600);
      setTimeout(offset, 1800);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(offset).catch(function () {});
    }

    var join = bar.querySelector('button.wd-bar-join');
    if (join) join.addEventListener('click', function () { openPopup(); });
    // Phone headline stays on one line: shrink the type until it fits
    // (13px down to 11px); only the longest hooks on the narrowest phones wrap.
    var line1 = bar.querySelector('.wd-bar-line1');
    function fitLine() {
      if (!line1) return;
      line1.style.whiteSpace = 'nowrap';
      var size = 13;
      line1.style.fontSize = size + 'px';
      while (line1.scrollWidth > line1.clientWidth && size > 11) {
        size -= 0.5;
        line1.style.fontSize = size + 'px';
      }
      if (line1.scrollWidth > line1.clientWidth) line1.style.whiteSpace = 'normal';
    }
    fitLine();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLine).catch(function () {});
    window.addEventListener('resize', fitLine);
    var sms = bar.querySelector('a.wd-bar-sms');
    if (sms) sms.addEventListener('click', function () {
      if (typeof window.gtag === 'function') window.gtag('event', 'sms_signup_click', { lead_source: 'bar' });
    });
    bar.querySelector('.wd-bar-x').addEventListener('click', function () {
      removeBar();
      snooze(LS_BAR, BAR_DISMISS_DAYS);
    });
  }

  // Take the bar down and give its space back. When the visitor is already
  // scrolled, shift the scroll by the same amount so the text they're
  // reading doesn't jump.
  function removeBar() {
    var bar = document.getElementById('wd-lead-bar');
    if (!bar) return;
    var h = bar.offsetHeight;
    bar.remove();
    var header = document.getElementById('wd-header');
    if (header) header.style.top = '';
    document.body.style.marginTop = '';
    if (window.scrollY > h) window.scrollBy(0, -h);
  }

  /* == Popup ============================================================= */
  var overlay;

  function buildPopup() {
    overlay = document.createElement('div');
    overlay.id = 'wd-lead-overlay';

    var formPanel =
      '<div id="wd-lead-form-wrap">' +
        '<h2 id="wd-lead-title">' + HOOK.title + '</h2>' +
        '<p class="wd-sub">' + HOOK.sub + '</p>' +
        '<form id="wd-lead-form" novalidate>' +
          '<div class="wd-hp" aria-hidden="true"><label for="wd-company">Company</label><input id="wd-company" name="company" type="text" tabindex="-1" autocomplete="off"></div>' +
          '<label for="wd-first">First name</label>' +
          '<input id="wd-first" name="firstname" type="text" autocomplete="given-name" required placeholder="Your first name">' +
          '<label for="wd-phone">Cell phone</label>' +
          '<input id="wd-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(512) 555-0100">' +
          '<label for="wd-email">Email</label>' +
          '<input id="wd-email" name="email" type="email" autocomplete="email" placeholder="you@example.com">' +
          '<div class="wd-row">' +
            '<div><label for="wd-city">City</label>' +
            '<input id="wd-city" name="city" type="text" autocomplete="address-level2" placeholder="Austin"></div>' +
            '<div class="wd-state"><label for="wd-state">State</label>' +
            '<input id="wd-state" name="state" type="text" autocomplete="address-level1" maxlength="2" placeholder="TX"></div>' +
          '</div>' +
          '<div class="wd-consent wd-podcast">' +
            '<input id="wd-podcast" name="podcast" type="checkbox" class="wd-check">' +
            '<label for="wd-podcast">Text me new Mastering Love episodes each week.</label>' +
          '</div>' +
          '<div class="wd-consent">' +
            '<input id="wd-consent" name="consent" type="checkbox" class="wd-check" required>' +
            '<label for="wd-consent">I agree to receive promotional messages from WeDeepen up to 8 Msgs/Month. This agreement isn&#39;t a condition of any purchase. I also agree to the <a href="' + ST_TERMS_URL + '" target="_blank" rel="noopener">Terms of Service</a> and <a href="' + ST_PRIVACY_URL + '" target="_blank" rel="noopener">Privacy Policy</a>. Msg &amp; Data rates may apply.</label>' +
          '</div>' +
          '<p class="wd-legal">By submitting this form, I agree that my mobile information will not be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude my text messaging originator opt-in data and consent; this information will not be shared with any third parties, except for the necessary opt-in data required to facilitate the SMS service. Text STOP to opt-out. Text HELP for assistance. team@wedeepen.com</p>' +
          '<p class="wd-error" id="wd-lead-error">Please add your first name and phone number.</p>' +
          '<button type="submit" class="wd-submit">Count Me In</button>' +
        '</form>' +
        '<p class="wd-sms-alt">Prefer text? Send <strong>' + SMS_KEYWORD + '</strong> to <a href="' + SMS_HREF + '">' + SMS_NUMBER_DISPLAY + '</a></p>' +
      '</div>';

    var smsPanel =
      '<div id="wd-lead-form-wrap" class="wd-sms-panel">' +
        '<h2 id="wd-lead-title">' + HOOK.title + '</h2>' +
        '<p class="wd-sub">Text <strong>' + SMS_KEYWORD + '</strong> to the number below and you&#39;re in. Be the first to hear about Love Immersion dates and events.</p>' +
        '<p class="wd-number"><a href="' + SMS_HREF + '">' + SMS_NUMBER_DISPLAY + '</a></p>' +
        '<a class="wd-sms-btn" id="wd-sms-cta" href="' + SMS_HREF + '">Text ' + SMS_KEYWORD + '</a>' +
        '<p class="wd-vcard"><a href="' + VCARD_URL + '" download>Save WeDeepen to your contacts</a><br>so you always know it&#39;s us texting.</p>' +
      '</div>';

    overlay.innerHTML =
      '<div id="wd-lead-modal" role="dialog" aria-modal="true" aria-labelledby="wd-lead-title">' +
        '<button type="button" class="wd-close" aria-label="Close">&times;</button>' +
        (IS_MOBILE && !AD_FORM ? smsPanel : formPanel) +
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

  /* == Mobile bottom sheet ============================================== */
  function openSheet() {
    if (document.getElementById('wd-lead-sheet')) return;
    var sheet = document.createElement('div');
    sheet.id = 'wd-lead-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-labelledby', 'wd-sheet-title');
    sheet.innerHTML =
      '<div class="wd-sheet-grip" aria-hidden="true"></div>' +
      '<button type="button" class="wd-close" aria-label="Close">&times;</button>' +
      '<h2 id="wd-sheet-title">' + HOOK.title + '</h2>' +
      '<p>Text <strong>' + SMS_KEYWORD + '</strong> to ' + SMS_NUMBER_DISPLAY + ' for private invitations and new dates.</p>' +
      '<a class="wd-sms-btn" href="' + SMS_HREF + '">Text ' + SMS_KEYWORD + '</a>' +
      '<a class="wd-sheet-save" href="' + VCARD_URL + '" download>Save WeDeepen to your contacts</a>';
    document.body.appendChild(sheet);
    // One prompt at a time: the sheet replaces the top bar for this visit.
    removeBar();
    try { sessionStorage.setItem(SS_BAR_OFF, '1'); } catch (e) {}
    requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add('wd-open'); }); });
    function close(days) {
      sheet.classList.remove('wd-open');
      snooze(LS_POPUP, days);
      setTimeout(function () { sheet.remove(); }, 400);
    }
    sheet.querySelector('.wd-close').addEventListener('click', function () { close(SHEET_DISMISS_DAYS); });
    // They jumped to Messages; count it as joined so it stops asking.
    sheet.querySelector('.wd-sms-btn').addEventListener('click', function () {
      if (typeof window.gtag === 'function') window.gtag('event', 'sms_signup_click', { lead_source: 'phone_sheet', hook: HOOK.id });
      close(JOINED_DAYS);
    });
  }

  /* == Four Pillars guide (two-step) ===================================== */
  // Subscribe to the MailerLite "Four Pillars guide" group (which starts the
  // email sequence), log the sign-up, and fire the Lead events.
  function sendGuide(firstName, email, how, cb) {
    function done(result) {
      notifySignup({ firstName: firstName, phone: '', email: email, city: '', state: '', podcast: '' }, result);
      // Preview submissions (before launch) must not count as ad conversions.
      if (GUIDE_LIVE) trackLead(how);
      snooze(LS_POPUP, JOINED_DAYS);
      cb();
    }
    if (!GUIDE_ML_ENDPOINT) { done('Four Pillars guide (preview, MailerLite not connected)'); return; }
    var body = new URLSearchParams();
    body.append('fields[name]', firstName);
    body.append('fields[email]', email);
    body.append('ml-submit', '1');
    body.append('anticsrf', 'true');
    fetch(GUIDE_ML_ENDPOINT, { method: 'POST', body: body, mode: 'no-cors' })
      .then(function () { done('Four Pillars guide (MailerLite' + (how === 'guide' ? '' : ', ' + how) + ')'); })
      .catch(function () { done('Four Pillars guide (MailerLite unreachable)'); });
  }

  // The inline form on /four-pillars/ ([data-guide-form]): same sign-up as
  // the popup, then swaps to its [data-guide-done] block with the text bonus.
  function wireGuidePageForm() {
    var form = document.querySelector('form[data-guide-form]');
    if (!form) return;
    var doneBox = document.querySelector('[data-guide-done]');
    var err = form.querySelector('[data-guide-err]');
    function showErr(msg) { err.textContent = msg; err.style.display = msg ? 'block' : 'none'; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showErr('');
      var firstName = form.firstname.value.trim();
      var email = form.email.value.trim();
      function finish() {
        form.style.display = 'none';
        if (doneBox) {
          var hi = doneBox.querySelector('[data-guide-hi]');
          if (hi && firstName) hi.textContent = 'Check your inbox, ' + firstName + '!';
          doneBox.style.display = 'block';
        }
      }
      if (form.company.value) { finish(); return; } // honeypot
      if (!firstName) { showErr('Please add your first name.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('Please enter a valid email address.'); return; }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      sendGuide(firstName, email, 'guide_page', finish);
    });
    var textBtn = doneBox && doneBox.querySelector('[data-guide-text]');
    if (textBtn) {
      // One-tap text on every device. Desktop also spells out the keyword and
      // number, for computers that can't send texts.
      if (!IS_MOBILE) {
        textBtn.insertAdjacentHTML('beforebegin', '<p class="text-white/80 mb-4">Text <strong>' + SMS_KEYWORD + '</strong> to <strong>' + SMS_NUMBER_DISPLAY + '</strong> from your phone, or:</p>');
      }
      textBtn.setAttribute('href', SMS_HREF);
      textBtn.addEventListener('click', function () {
        if (typeof window.gtag === 'function') window.gtag('event', 'sms_signup_click', { lead_source: 'guide_page_bonus' });
      });
    }
  }

  function openGuide() {
    if (document.getElementById('wd-guide')) return;
    var g = document.createElement('div');
    g.id = 'wd-guide';
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-labelledby', 'wd-g-title');
    g.setAttribute('data-at', '2');
    g.innerHTML =
      '<button type="button" class="wd-close" aria-label="Close">&times;</button>' +
      // Step 2: name + email
      '<div data-step="2">' +
        '<div class="wd-g-hero">' +
          '<img src="' + GUIDE_COVER + '" width="240" height="300" alt="The Four Pillars of a Conscious Relationship guide cover">' +
          '<div><p class="wd-g-eyebrow">Free guide</p><h2 id="wd-g-title">Get the Four Pillars, free</h2>' +
          '<p>Prioritize growth. Own your own sh*t. All feelings are welcome. Practice love.</p></div>' +
        '</div>' +
        '<form class="wd-g-main" novalidate>' +
          '<div class="wd-g-hp" aria-hidden="true"><input name="company" type="text" tabindex="-1" autocomplete="off"></div>' +
          '<input name="firstname" type="text" autocomplete="given-name" placeholder="First name" aria-label="First name" required>' +
          '<input name="email" type="email" inputmode="email" autocomplete="email" placeholder="Email address" aria-label="Email address" required>' +
          '<p class="wd-g-err" role="alert"></p>' +
          '<button type="submit" class="wd-g-btn">Yes! Send my guide</button>' +
        '</form>' +
        '<p class="wd-g-fine">We&#39;ll email it right away. Unsubscribe anytime.</p>' +
        '<button type="button" class="wd-g-no wd-g-pass">No thanks, I&#39;ll pass</button>' +
      '</div>' +
      // Step 3: guide right away + optional phone bonus
      '<div data-step="3">' +
        '<p class="wd-g-eyebrow">You&#39;re in</p>' +
        '<h2 class="wd-g-hi">Check your inbox!</h2>' +
        '<p class="wd-g-sent">Your Four Pillars guide is on its way.</p>' +
        '<div class="wd-g-bonus">' +
          '<h3>Bonus: private invitations by text</h3>' +
          '<p>Be first to hear about new dates and live events. A few texts a month.</p>' +
          (IS_MOBILE
            ? '<a class="wd-g-btn wd-g-text" href="' + SMS_HREF + '">Text ' + SMS_KEYWORD + '</a>'
            : '<p class="wd-g-desk">Text <strong>' + SMS_KEYWORD + '</strong> to <strong>' + SMS_NUMBER_DISPLAY + '</strong> from your phone.</p>') +
          '<button type="button" class="wd-g-no wd-g-skip">No thanks</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(g);
    removeBar();
    try { sessionStorage.setItem(SS_BAR_OFF, '1'); } catch (e) {}
    requestAnimationFrame(function () { requestAnimationFrame(function () { g.classList.add('wd-open'); }); });

    function close(days) {
      g.classList.remove('wd-open');
      if (days) snooze(LS_POPUP, days);
      setTimeout(function () { g.remove(); }, 450);
    }
    function go(step) {
      g.setAttribute('data-at', String(step));
    }
    function showErr(scope, msg) {
      var err = scope.querySelector('.wd-g-err');
      err.textContent = msg;
      err.style.display = msg ? 'block' : 'none';
    }
    var dismissDays = IS_MOBILE ? SHEET_DISMISS_DAYS : DISMISS_DAYS;
    g.querySelector('.wd-close').addEventListener('click', function () {
      close(g.getAttribute('data-at') === '3' ? 0 : dismissDays);
    });
    // Passing on the guide still offers the text list: same step 3, minus
    // the "check your inbox" part.
    g.querySelector('.wd-g-pass').addEventListener('click', function () {
      snooze(LS_POPUP, dismissDays);
      g.classList.add('wd-g-passed');
      g.querySelector('.wd-g-bonus h3').textContent = 'Prefer invitations by text?';
      go(3);
    });
    g.querySelector('.wd-g-skip').addEventListener('click', function () { close(0); });

    var person = { firstName: '', email: '' };
    var form = g.querySelector('form.wd-g-main');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showErr(form, '');
      var firstName = form.firstname.value.trim();
      var email = form.email.value.trim();
      if (form.company.value) { go(3); snooze(LS_POPUP, JOINED_DAYS); return; } // honeypot
      if (!firstName) { showErr(form, 'Please add your first name.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr(form, 'Please enter a valid email address.'); return; }
      var btn = form.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      person = { firstName: firstName, email: email };
      sendGuide(firstName, email, 'guide', function () {
        g.querySelector('.wd-g-hi').textContent = 'Check your inbox, ' + firstName + '!';
        g.querySelector('.wd-g-sent').textContent = 'Your Four Pillars guide is on its way to ' + email + '.';
        go(3);
      });
    });

    // Bonus: one tap opens Messages with COUNT ME IN typed, to the COUNTMEIN list.
    var textBtn = g.querySelector('.wd-g-text');
    if (textBtn) textBtn.addEventListener('click', function () {
      if (typeof window.gtag === 'function') window.gtag('event', 'sms_signup_click', { lead_source: 'guide_bonus' });
      setTimeout(function () {
        g.querySelector('.wd-g-bonus').innerHTML = '<h3>Almost there</h3><p>Just hit send in Messages and you&#39;re on the text list.</p>';
      }, 400);
    });
  }

  function watchScrollForGuide() {
    function check() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max < SHEET_SCROLL_DEPTH) return;
      window.removeEventListener('scroll', check);
      openGuide();
    }
    window.addEventListener('scroll', check, { passive: true });
  }

  function watchScrollForSheet() {
    function check() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max < SHEET_SCROLL_DEPTH) return;
      window.removeEventListener('scroll', check);
      openSheet();
    }
    window.addEventListener('scroll', check, { passive: true });
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
          location: locationStr || '', page: location.pathname + ' [' + HOOK.id + ']'
        })
      }).catch(function () {});
    } catch (e) { /* never block the signup on the log */ }
  }

  // Conversion for the ad platforms, once per real sign-up (never on open or
  // close). Each call no-ops when that tag isn't on the page.
  function trackLead(how) {
    var label = 'Website popup sign-up';
    try {
      if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_name: label, content_category: how });
      if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { lead_source: AD_FORM ? 'ad_landing' : 'popup', lead_method: how, hook: HOOK.id });
      if (typeof window.rdt === 'function') window.rdt('track', 'Lead');
    } catch (e) { /* tracking never blocks the signup */ }
  }

  // Fire-and-forget row in the sign-ups sheet (and the email alert).
  function notifySignup(f, result) {
    if (!SIGNUPS_ENDPOINT) return;
    try {
      fetch(SIGNUPS_ENDPOINT, {
        method: 'POST', mode: 'no-cors',
        body: new URLSearchParams({
          firstName: f.firstName, phone: formatPhone(f.phone), email: f.email || '',
          city: f.city || '', state: f.state || '', podcast: f.podcast,
          page: location.pathname + (AD_FORM ? ' (from ad)' : ''), hook: HOOK.id,
          device: IS_MOBILE ? 'phone' : 'desktop', result: result
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
    if (!form.consent.checked) { showError('Please agree to receive texts so we can message you.'); return; }

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
    var signup = { firstName: firstName, phone: phone, email: email, city: city, state: state, podcast: podcast };

    function smsFallback() {
      logToSheet(firstName, phone, email, locationStr);
      notifySignup(signup, 'Asked to text in (SimpleTexting unreachable)');
      trackLead('form');
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
        notifySignup(signup, 'Added to COUNTMEIN list');
        trackLead('form');
        showSuccess('Watch your phone: a text from WeDeepen is on its way to confirm you&#39;re in.' +
          '<br><a class="wd-sms-btn" href="https://chat.whatsapp.com/FOK9T50055K97x88VTsY7J" target="_blank" rel="noopener">Join the WhatsApp group</a>');
        snooze(LS_POPUP, JOINED_DAYS);
        return;
      }
      if (res.status === 418) {
        return res.text().then(function (text) {
          var error = {};
          try { error = JSON.parse(text); } catch (e2) { /* fall through */ }
          if (error.code === 'DuplicateContactPhoneException') {
            notifySignup(signup, 'Already on the list');
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

    wireGuidePageForm();

    if (MEMBER_LINK) {
      document.querySelectorAll('[data-lead-popup]').forEach(function (el) { el.style.display = 'none'; });
      return;
    }


    var barOff = false;
    try { barOff = IS_MOBILE && sessionStorage.getItem(SS_BAR_OFF) === '1'; } catch (e) {}
    if (!snoozed(LS_BAR) && !barOff && !FROM_EMAIL) buildBar();

    // Any element with data-lead-popup opens the popup on click.
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-lead-popup]');
      if (t) { e.preventDefault(); openPopup(); }
    });

    // Desktop: the popup opens after a short delay. Phones: a small bottom
    // sheet with one-tap "text us" slides up after a scroll (no full-screen
    // popup, which Google penalizes in mobile search).
    // Four Pillars has its own free-guide signup, so the popup stays off there.
    if (AD_FORM) {
      // They clicked an ad to join: open the form, even if they closed it before.
      setTimeout(openPopup, 1200);
    } else if (GUIDE_MODE && /[?&]wd-guide=1(&|$)/.test(location.search)) {
      // Preview link: show the guide right away, ignoring past snoozes.
      setTimeout(openGuide, 800);
    } else if (FROM_EMAIL) {
      // Already subscribed: nothing opens on its own.
    } else if (GUIDE_MODE && !ON_LI_PAGE && !ON_FOUR_PILLARS && !snoozed(LS_POPUP)) {
      if (IS_MOBILE) watchScrollForGuide();
      else setTimeout(openGuide, POPUP_DELAY_MS);
    } else if (!ON_LI_PAGE && !ON_FOUR_PILLARS && !snoozed(LS_POPUP)) {
      if (IS_MOBILE) watchScrollForSheet();
      else setTimeout(openPopup, POPUP_DELAY_MS);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
