/*
 * hero-test.js: hero headline test on /membership/b/ only (René, Nov 6, 2026).
 * Loaded by scripts/build-membership.mjs (buildMembershipB), before mobile-v2.js.
 *
 * Each visitor gets one of five heroes, kept for return visits:
 *   base      the current headline and copy (phones: Christina's Nov 5 hero)
 *   career    "You studied your career for years. When did you study love?" (Christina's pick)
 *   quiet     "Desire doesn't die. It goes quiet."
 *   distance  "Love wants closeness. Desire needs a little distance."
 *   taught    "You are not behind. You are not broken. You were just never taught."
 * All five share a trial-first button, the cancel line, a row of testimonial
 * faces with the Google rating (taps jump to the member videos) and the
 * "chemistry vs alignment" contrasts right under the hero (base included since
 * Nov 6, René). The four new heroes also get one short subhead, and their two
 * original intro paragraphs move to the top of "At a glance" (not deleted).
 *
 * ?hv=<key> forces a hero (to match an ad). Measurement: Clarity tag
 * hero_variant, GA4 event hero_variant (param hero_variant), and
 * utm_term=hero_<key> on every Circle checkout link.
 */
(function () {
  'use strict';
  var KEYS = ['base', 'career', 'quiet', 'distance', 'taught'];
  var HEADLINES = {
    career: 'You studied your career for years. <span class="italic">When did you study love?</span>',
    quiet: 'Desire doesn&rsquo;t die. <span class="italic">It goes quiet.</span>',
    distance: 'Love wants closeness. <span class="italic">Desire needs a little distance.</span>',
    taught: 'You are not behind. You are not broken. <span class="italic">You were just never taught.</span>'
  };
  var SUB = 'Live expert-led sessions and a private community for people who want to get even better at love. Come solo, dating, or partnered.';
  var FACES = [
    ['hannah-space-for-you', 'Hannah'], ['justin-strangers', 'Justin'], ['cara-11-months', 'Cara'],
    ['matt-same-team', 'Matt and Jen'], ['shailzah-friends', 'Shailzah']
  ];

  function pick() {
    var forced = null;
    try { forced = new URLSearchParams(location.search).get('hv'); } catch (e) {}
    if (forced && KEYS.indexOf(forced) !== -1) return forced;
    var saved = null;
    try { saved = localStorage.getItem('wd_hero_v1'); } catch (e) {}
    if (saved && KEYS.indexOf(saved) !== -1) return saved;
    var k = KEYS[Math.floor(Math.random() * KEYS.length)];
    try { localStorage.setItem('wd_hero_v1', k); } catch (e) {}
    return k;
  }

  var key = pick();
  document.documentElement.setAttribute('data-hero', key);

  // Measurement: Clarity tag, GA4 event, utm_term on checkout links (set at click time,
  // in the capture phase, so the email step and checkout tracking see the final link).
  try { if (window.clarity) window.clarity('set', 'hero_variant', key); } catch (e) {}
  try { if (window.gtag) window.gtag('event', 'hero_variant', { hero_variant: key, non_interaction: true }); } catch (e) {}
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href*="circle.wedeepen.com/checkout/"]');
    if (!a) return;
    try {
      var u = new URL(a.href);
      u.searchParams.set('utm_term', 'hero_' + key);
      a.href = u.toString();
    } catch (err) {}
  }, true);

  // Since Nov 6 (René): the baseline keeps its own headline and copy but gets the
  // same button, cancel line, testimonial faces and contrasts as the other four,
  // so the test compares headlines only.
  var BASE = key === 'base';

  var hero = document.getElementById('hero');
  var h1 = hero && hero.querySelector('h1');
  var cta = hero && hero.querySelector('a[data-cta="hero"]');
  if (!h1 || !cta) return;

  var css = document.createElement('style');
  css.textContent =
    '#hero .ht-sub{color:rgba(255,255,255,.85);font-size:1.0625rem;line-height:1.55;max-width:36rem;margin:0 auto 26px;text-wrap:pretty}' +
    '#hero .ht-cancel{color:rgba(255,255,255,.7);font-size:.8125rem;line-height:1.5;max-width:30rem;margin:-6px auto 22px;text-wrap:pretty}' +
    '#hero .ht-proof{display:flex;flex-direction:column;align-items:center;gap:8px;margin:0 auto 34px;color:#fff;text-decoration:none}' +
    '#hero .ht-faces{display:flex;justify-content:center}' +
    '#hero .ht-faces img{width:48px;height:48px;border-radius:50%;object-fit:cover;object-position:50% 18%;border:2px solid #1a1a1a;margin-left:-10px;background:#333}' +
    '#hero .ht-faces img:first-child{margin-left:0}' +
    '#hero .ht-stars{font-size:.875rem;color:rgba(255,255,255,.85)}#hero .ht-stars b{color:#C9A277;letter-spacing:1px;font-weight:400;margin-right:6px}' +
    '#hero .ht-stars u{text-underline-offset:3px}' +
    '.ht-ledger{background:#F6F1EA;color:#2b2b2b;padding:56px 24px}' +
    '.ht-ledger h2{font-family:inherit;text-align:center;font-size:1.05rem;color:rgba(43,43,43,.7);max-width:34rem;margin:0 auto 26px;line-height:1.5;text-wrap:pretty}' +
    '.ht-ledger .home-ledger{max-width:72rem;margin:0 auto}' +
    'html.m2 #hero .ht-proof{margin-bottom:26px}html.m2 #hero h1{font-size:2.15rem;line-height:1.14}';
  document.head.appendChild(css);

  if (!BASE) {
    h1.innerHTML = '<span class="text-white">' + HEADLINES[key] + '</span>';

    // Move the two intro paragraphs (not deleted) to the top of "At a glance".
    var intro = Array.prototype.slice.call(hero.querySelectorAll('h1 ~ p'));
    var glance = document.querySelector('[data-m2="glance"]');
    var glanceInner = glance && glance.firstElementChild;
    if (glanceInner && intro.length) {
      var box = document.createElement('div');
      box.className = 'm2-intro mb-10 text-center';
      intro.forEach(function (p) { box.appendChild(p); });
      glanceInner.insertAdjacentElement('afterbegin', box);
    }

    var sub = document.createElement('p');
    sub.className = 'ht-sub';
    sub.textContent = SUB;
    h1.insertAdjacentElement('afterend', sub);
  }

  // Trial first; the price is the small line.
  cta.innerHTML = '<span class="whitespace-nowrap">Start my 14 free days &rarr;</span>' +
    '<span class="whitespace-nowrap text-sm font-normal opacity-85 mt-0.5">Then $99/month</span>';
  var row = cta.parentElement;
  row.classList.remove('mb-16');
  row.classList.add('mb-6');
  // One action in the first screen: the "See what's included" link gives way
  // (the same as Christina's phone hero); the proof row below scrolls instead.
  var more = row.querySelector('a[href="#membership"]');
  if (more) more.remove();

  var cancel = document.createElement('p');
  cancel.className = 'ht-cancel';
  cancel.innerHTML = 'We email you 3 days before your free days end &middot; cancel yourself in Circle anytime, no calls or forms';
  row.insertAdjacentElement('afterend', cancel);

  // Testimonial faces + rating; taps jump to the member videos.
  var proof = document.createElement('a');
  proof.className = 'ht-proof';
  proof.href = '#members';
  proof.setAttribute('data-cta', 'hero-proof');
  proof.innerHTML = '<span class="ht-faces">' + FACES.map(function (f) {
    return '<img src="/images/testimonials/' + f[0] + '.webp" width="96" height="96" alt="' + f[1] + ', a WeDeepen member">';
  }).join('') + '</span>' +
    '<span class="ht-stars"><b>&#9733;&#9733;&#9733;&#9733;&#9733;</b>5.0 &middot; <u>26 Google reviews</u> &middot; Hear from members</span>';
  cancel.insertAdjacentElement('afterend', proof);

  var members = document.querySelector('[data-m2="testimonials"]');
  if (members) members.id = members.id || 'members';
  proof.addEventListener('click', function (e) {
    if (!members) return;
    e.preventDefault();
    members.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { if (window.gtag) window.gtag('event', 'hero_proof_click', { hero_variant: key }); } catch (err) {}
  });

  // Baseline on phones: mobile-v2.js (runs next) adds Christina's reassurance
  // line and the "What brings you" quiz right after the button. Once it has run,
  // keep the cancel line + faces directly under the button, the quiz after them,
  // and hide its reassurance line (the cancel line says the same thing).
  if (BASE) {
    var tidy = function () {
      var reassure = hero.querySelector(':scope .m2-reassure');
      if (reassure && reassure.parentElement === row.parentElement) reassure.style.display = 'none';
      row.insertAdjacentElement('afterend', cancel);
      cancel.insertAdjacentElement('afterend', proof);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tidy);
    else setTimeout(tidy, 0);
  }

  // "Chemistry vs alignment" contrasts right under the hero (moved, not copied).
  var ledger = document.querySelector('[data-m2="skill"] .home-ledger');
  if (ledger) {
    var sec = document.createElement('section');
    sec.className = 'ht-ledger';
    sec.setAttribute('aria-label', 'What you learn to tell apart');
    var h = document.createElement('h2');
    h.textContent = 'WeDeepen gives you a place to build the skill of love deliberately, including learning to tell the difference between:';
    sec.appendChild(h);
    sec.appendChild(ledger);
    hero.insertAdjacentElement('afterend', sec);
  }
})();
