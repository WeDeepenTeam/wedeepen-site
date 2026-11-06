/*
 * Member video testimonials: the "What Members Say" cards on the homepage (and /membership, which mirrors it).
 * René, Nov 2026.
 *
 * - Every page load builds a new lineup of six cards from CLIPS below.
 *   Card 1 is always Hannah, Shailzah or Beth (picked evenly by person), then the order alternates
 *   male, female, couple, female, male: F, M, F, couple, F, M. No person appears twice.
 * - The six cards in index.html are the no-JS / SEO fallback; this script replaces them in place.
 * - Tapping a card opens a full-screen player with sound. Close with the X, the backdrop, Esc or the phone's back
 *   button; you land back on the same card. At the end: "Next story" or the 14-day trial.
 * - Videos and their source edits: WD Content project, claude/website-video-testimonials.md.
 *   Files live on Cloudflare R2 at assets.wedeepen.com/testimonials/<id>.mp4; posters in /images/testimonials/.
 */
(function () {
  'use strict';
  var BASE = 'https://assets.wedeepen.com/testimonials/';
  var CHECKOUT = 'https://circle.wedeepen.com/checkout/wedeepen-club-membership?price_id=368281';
  var CLIPS = [
    { id: 'hannah-space-for-you', person: 'Hannah', g: 'F', lead: true, len: '0:31', role: 'WeDeepen community',
      quote: 'If you’re in a space in your life where you’re feeling alone or disconnected, this is the space for you.' },
    { id: 'shailzah-friends', person: 'Shailzah', g: 'F', lead: true, len: '0:35', role: 'Member, Austin',
      quote: 'It’s probably my favorite friends group. Before joining this community I had fewer friends. Now I have this whole group of friends, and I thrive in it.' },
    { id: 'beth-belonging', person: 'Beth', g: 'F', lead: true, len: '0:39', role: 'Austin',
      quote: 'This community welcomes you in and wants to know the real you. More possibility has opened up in my life because of the support and love I feel here.' },
    { id: 'beth-gift', person: 'Beth', g: 'F', lead: true, len: '0:33', role: 'Austin',
      quote: 'Give yourself this gift. Walk into a space where you can be vulnerable and also be held and seen.' },
    { id: 'cara-11-months', person: 'Cara', g: 'F', len: '0:28', role: 'Member, 11 months',
      quote: 'Eleven months in, I feel like I’m a new person. I’ve created this community that is truly safe and secure and full of love.' },
    { id: 'cara-zoom-calls', person: 'Cara', g: 'F', len: '0:47', role: 'Member, 11 months',
      quote: 'I was terrified to be on Zoom sharing stories with people I didn’t know. Now I’m excited to get on these calls every week. I get to see my people.' },
    { id: 'gabby-intimacy', person: 'Gabby', g: 'F', len: '0:32', role: 'Santa Barbara',
      quote: 'The belief that it would take 20 years to build intimacy again just disappeared. I know I can build deep intimacy when I meet someone.' },
    { id: 'sara-coolest-people', person: 'Sara', g: 'F', len: '0:21', role: 'WeDeepen community',
      quote: 'You’re going to meet the coolest people who are going to love the heck out of you and help you grow.' },
    { id: 'bo-friends-open-heart', person: 'Bo L.', g: 'M', len: '0:35', role: 'Retired Entrepreneur & Member',
      quote: 'The people were so amazing and so warm. We’ve become amazing friends, we feel each other’s hearts, and the love is real.' },
    { id: 'justin-strangers', person: 'Justin', g: 'M', len: '0:44', role: 'WeDeepen community',
      quote: 'I’d describe the vibe of this community as vulnerable strangers. There’s so much natural grace and compassion, it’s impossible for it not to rub off on you.' },
    { id: 'matt-same-team', person: 'Matt & Jen', g: 'C', len: '0:40', role: 'Austin couple',
      quote: 'When I shift that perspective and see my partner as the loving person, it makes all the difference in the world.' }
  ];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function lineup() {
    var used = {}, out = [];
    var leads = []; CLIPS.forEach(function (c) { if (c.lead && leads.indexOf(c.person) < 0) leads.push(c.person); });
    var lp = pick(leads);
    var first = pick(CLIPS.filter(function (c) { return c.lead && c.person === lp; }));
    out.push(first); used[first.person] = 1;
    ['M', 'F', 'C', 'F', 'M'].forEach(function (g) {
      var opts = CLIPS.filter(function (c) { return c.g === g && !used[c.person]; });
      if (!opts.length) opts = CLIPS.filter(function (c) { return !used[c.person]; });
      if (!opts.length) return;
      var c = pick(opts); out.push(c); used[c.person] = 1;
    });
    return out;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function first(name) { return name.split(/[ .&]/)[0]; }
  function track(name, c) { try { if (window.gtag) window.gtag('event', name, { clip_id: c.id, clip_person: c.person }); } catch (e) {} }

  function card(c, i) {
    var el = document.createElement('div');
    el.className = 'mv-card bg-white rounded-xl shadow-sm overflow-hidden';
    el.setAttribute('data-mv', c.id);
    var who = c.g === 'C' ? 'their story' : first(c.person) + '’s story';
    el.innerHTML =
      '<button type="button" class="mv-poster" aria-label="Play ' + esc(who) + ' (' + c.len + ')">' +
        '<img src="/images/testimonials/' + c.id + '.webp" alt="' + esc(c.person) + ', speaking about WeDeepen" width="720" height="900" loading="lazy" decoding="async">' +
        '<span class="mv-badge" aria-hidden="true"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.5 4.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L7.4 4.1a.6.6 0 0 0-.9.5Z"/></svg>' + c.len + '</span>' +
      '</button>' +
      '<div class="mv-body">' +
        '<div class="flex text-gold text-sm">&#9733;&#9733;&#9733;&#9733;&#9733;</div>' +
        '<p class="text-charcoal/80 text-sm leading-relaxed">' + esc(c.quote) + '</p>' +
        '<div class="flex items-center gap-3">' +
          '<div class="w-9 h-9 rounded-full bg-rose-deep/10 flex items-center justify-center text-rose-deep font-semibold text-sm">' + esc(c.person.charAt(0)) + '</div>' +
          '<div><p class="text-charcoal font-semibold text-sm">' + esc(c.person) + '</p><p class="text-charcoal/70 text-xs">' + esc(c.role) + '</p></div>' +
        '</div>' +
        '<button type="button" class="mv-watch">▶ Watch ' + esc(who) + '</button>' +
      '</div>';
    el.querySelector('.mv-poster').addEventListener('click', function () { open(i); });
    el.querySelector('.mv-watch').addEventListener('click', function () { open(i); });
    return el;
  }

  var cur = [], idx = 0, ov, vid, end, lastFocus, pushed = false;
  function buildPlayer() {
    ov = document.createElement('div');
    ov.className = 'mv-ov'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Member story');
    ov.innerHTML =
      '<div class="mv-box">' +
        '<button type="button" class="mv-x" aria-label="Close">&times;</button>' +
        '<video playsinline controls preload="none"></video>' +
        '<div class="mv-end" hidden>' +
          '<button type="button" class="mv-next">Next story &rarr;</button>' +
          '<a data-cta="testimonial-video" href="' + CHECKOUT + '" class="mv-join">Start my 14 free days</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    vid = ov.querySelector('video'); end = ov.querySelector('.mv-end');
    ov.querySelector('.mv-x').addEventListener('click', function () { close(true); });
    ov.addEventListener('click', function (e) { if (e.target === ov) close(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ov.hidden) close(true); });
    window.addEventListener('popstate', function () { if (!ov.hidden) close(false); });
    vid.addEventListener('ended', function () { end.hidden = false; track('testimonial_complete', cur[idx]); });
    ov.querySelector('.mv-next').addEventListener('click', function () { play((idx + 1) % cur.length); });
  }
  function play(i) {
    idx = i; var c = cur[i];
    end.hidden = true;
    vid.poster = '/images/testimonials/' + c.id + '.webp';
    vid.src = BASE + c.id + '.mp4';
    var p = vid.play(); if (p && p.catch) p.catch(function () {});
    track('testimonial_play', c);
  }
  function open(i) {
    if (!ov) buildPlayer();
    lastFocus = document.activeElement;
    ov.hidden = false; document.documentElement.classList.add('mv-lock');
    if (!pushed) { try { history.pushState({ mv: 1 }, ''); pushed = true; } catch (e) {} }
    play(i);
    ov.querySelector('.mv-x').focus();
  }
  function close(fromUi) {
    vid.pause(); vid.removeAttribute('src'); vid.load();
    ov.hidden = true; document.documentElement.classList.remove('mv-lock');
    if (pushed) { pushed = false; if (fromUi) { try { history.back(); } catch (e) {} } }
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function init() {
    var grid = document.querySelector('[data-mv-grid]');
    if (!grid) return;
    var skip = (grid.getAttribute('data-mv-exclude') || '').split(/\s+/);   // set by membership segment pages
    CLIPS = CLIPS.filter(function (c) { return skip.indexOf(c.id) < 0; });
    cur = lineup();
    var frag = document.createDocumentFragment();
    cur.forEach(function (c, i) { frag.appendChild(card(c, i)); });
    grid.innerHTML = ''; grid.appendChild(frag);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
