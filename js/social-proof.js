/**
 * social-proof.js — the rotating proof ticker in the bottom-left corner.
 *
 * Two kinds of cue share one rotation:
 *
 *   evergreen  facts that are already published elsewhere on the site, so the
 *              ticker always has something true to show.
 *   live       recent activity from ENDPOINT. Optional. If the endpoint is
 *              unset, unreachable, empty, or stale, those cues are simply
 *              absent from the rotation.
 *
 * Nothing here invents a signup. There is no fallback name, no seeded list, no
 * synthetic timestamp: a live cue exists only when the endpoint returned a real
 * one inside MAX_AGE_HOURS. A ticker in this niche that got caught making people
 * up would cost more trust than it could earn, and stale activity ("someone
 * joined 23 days ago") reads worse than no ticker at all.
 *
 * Live cues also stay anonymous. Members join a membership about their intimate
 * lives; publishing their names on a marketing widget is not ours to do without
 * asking. City and elapsed time carry the proof on their own.
 *
 * QA: ?wd-proof=on forces it (ignores the delay, the device check, and dismissal)
 *     ?wd-proof=off suppresses it
 */
(function () {
  'use strict';

  // Set to a URL returning { events: [ { type: "join"|"immersion", city, at } ] }
  // to switch the live cues on. Endpoints live in the sister repo, under
  // my-app/supabase/functions/. Left empty, the ticker runs evergreen only.
  var ENDPOINT = '';

  // The blocked() check below already keeps the ticker quiet whenever the lead
  // popup is open, so this delay only has to clear the page load, not wait out
  // the popup. At 20s the site's own owner assumed the ticker was broken, which
  // is a fair proxy for a visitor who has already scrolled past or left.
  var START_DELAY_MS = 8000;
  var SHOW_MS = 6000;          // how long one cue stays up
  var GAP_MS = 1200;           // dead air between cues
  var PASSES = 2;              // rotations before the ticker retires for the session
  var MAX_AGE_HOURS = 72;      // older activity is dropped, not shown as "recent"
  var DISMISS_KEY = 'wd-proof-dismissed';

  var force = /[?&#]wd-proof=on/.test(location.href);
  if (/[?&#]wd-proof=off/.test(location.href)) return;

  // Desktop only, matching how lead-capture.js already handles interruptions:
  // mobile already carries the announcement bar and the SMS panel, and a third
  // element on a 375px screen covers the CTA it is meant to support.
  var isMobile = window.matchMedia('(max-width: 767px)').matches;
  if (isMobile && !force) return;

  try {
    if (!force && sessionStorage.getItem(DISMISS_KEY)) return;
  } catch (e) {}

  // Every figure below is published elsewhere on the site. Keep it that way:
  // the ticker is a pointer to proof, not a place where new claims appear.
  var EVERGREEN = [
    { text: 'Rated <strong>9.6 out of 10</strong> by Love Immersion participants.', href: '/love-immersion/october-2026/' },
    { text: '<strong>65%</strong> come back for another Love Immersion.', href: '/love-immersion/october-2026/' },
    { text: 'More than <strong>40,000 people</strong> have joined a WeDeepen experience.', href: '/about/' },
    { text: '<strong>182 episodes</strong> of Mastering Love, and counting.', href: '/podcast/' },
    { text: '<strong>9 world-class guides</strong> teach inside WeDeepen.', href: '/love-guides/' }
  ];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function ago(iso) {
    var mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (!isFinite(mins) || mins < 0) return null;
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + ' minutes ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs === 1 ? 'an hour ago' : hrs + ' hours ago';
    var days = Math.round(hrs / 24);
    return days === 1 ? 'yesterday' : days + ' days ago';
  }

  function liveCue(ev) {
    var when = ago(ev.at);
    if (!when) return null;
    if ((Date.now() - new Date(ev.at).getTime()) / 3600000 > MAX_AGE_HOURS) return null;
    var where = ev.city ? ' in ' + esc(ev.city) : '';
    if (ev.type === 'immersion') {
      return { text: 'Someone' + where + ' booked a seat at Love Immersion, <strong>' + when + '</strong>.', href: '/love-immersion/october-2026/' };
    }
    if (ev.type === 'join') {
      return { text: 'Someone' + where + ' joined the membership, <strong>' + when + '</strong>.', href: '/membership/' };
    }
    return null;
  }

  function fetchLive() {
    if (!ENDPOINT) return Promise.resolve([]);
    return fetch(ENDPOINT, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.events || !d.events.length) return [];
        return d.events.map(liveCue).filter(Boolean).slice(0, 4);
      })
      .catch(function () { return []; });
  }

  function styles() {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var css = '#wd-proof{position:fixed;left:20px;bottom:20px;z-index:70;max-width:340px;'
      + 'display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:14px;'
      + 'background:rgba(26,22,24,.94);backdrop-filter:blur(8px);'
      + 'border:1px solid rgba(201,162,119,.34);box-shadow:0 10px 34px rgba(0,0,0,.42);'
      + 'font-family:"DM Sans",Inter,system-ui,sans-serif;color:#F4EDE0;'
      + 'opacity:0;pointer-events:none;}'
      + '#wd-proof.wd-in{opacity:1;pointer-events:auto;}'
      + '#wd-proof a{color:inherit;text-decoration:none;flex:1;font-size:13.5px;line-height:1.45;}'
      + '#wd-proof a strong{color:#C9A277;font-weight:600;}'
      + '#wd-proof a:hover{text-decoration:underline;text-decoration-color:rgba(201,162,119,.5);text-underline-offset:3px;}'
      + '#wd-proof .wd-proof-dot{flex:none;width:7px;height:7px;margin-top:6px;border-radius:50%;'
      + 'background:#C9A277;box-shadow:0 0 0 3px rgba(201,162,119,.18);}'
      + '#wd-proof .wd-proof-x{flex:none;background:none;border:0;cursor:pointer;padding:0 0 0 4px;'
      + 'color:rgba(244,237,224,.42);font-size:17px;line-height:1;}'
      + '#wd-proof .wd-proof-x:hover{color:rgba(244,237,224,.85);}';
    css += reduce
      ? '#wd-proof{transition:opacity .2s ease;}'
      : '#wd-proof{transform:translateY(10px) scale(.98);transition:opacity .45s ease,transform .45s ease;}'
        + '#wd-proof.wd-in{transform:translateY(0) scale(1);}';
    var tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function run(cues) {
    if (!cues.length) return;
    styles();

    var box = document.createElement('div');
    box.id = 'wd-proof';
    // The rotation would otherwise re-announce itself to a screen reader every
    // few seconds. Every figure in it is real content elsewhere on the site.
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<span class="wd-proof-dot"></span><a href="#"></a>'
      + '<button type="button" class="wd-proof-x" aria-label="Dismiss">&times;</button>';
    document.body.appendChild(box);

    var link = box.querySelector('a');
    var stopped = false;

    box.querySelector('.wd-proof-x').addEventListener('click', function () {
      stopped = true;
      box.classList.remove('wd-in');
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
      setTimeout(function () { box.remove(); }, 500);
    });

    // Never talk over the lead popup.
    function blocked() {
      var overlay = document.getElementById('wd-lead-overlay');
      return !!(overlay && overlay.classList.contains('wd-open'));
    }

    var i = 0;
    var shown = 0;
    var total = cues.length * PASSES;

    function next() {
      if (stopped) return;
      if (shown >= total) { box.remove(); return; }
      if (blocked()) { setTimeout(next, 2000); return; }

      var cue = cues[i % cues.length];
      i++; shown++;
      link.innerHTML = cue.text;
      link.setAttribute('href', cue.href);
      box.classList.add('wd-in');

      setTimeout(function () {
        if (stopped) return;
        box.classList.remove('wd-in');
        setTimeout(next, GAP_MS);
      }, SHOW_MS);
    }

    setTimeout(next, force ? 600 : START_DELAY_MS);
  }

  // Live cues lead when they exist, because recency is the stronger signal;
  // the evergreen facts carry the rotation the rest of the time.
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  fetchLive().then(function (live) {
    run(live.concat(shuffle(EVERGREEN.slice())));
  });
})();
