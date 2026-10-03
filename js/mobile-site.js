/*
 * mobile-site.js: phone-only improvements for the rest of the site (the
 * homepage has its own, js/mobile-v2.js). Everything below runs only under
 * 1024px wide; desktop gets nothing except YouTube embeds, which load as
 * before (see "Videos").
 *
 *  - Sticky join bar (next session + $99) on pages that don't have one
 *  - Join prompts where long pages had none (blog, episodes, faculty, events,
 *    podcast, about) and a $99 option at the end of Love Immersion pages
 *  - Faculty: bios collapse to "Read more"; the council becomes a compact grid
 *  - Love Immersion: guides as a swipe row, day-by-day text collapsed
 *  - Blog: the table of contents collapses
 *  - Four Pillars: a "Get the free guide" jump button near the top
 *  - Videos: YouTube iframes written as data-yt-src load right away on
 *    desktop, and on phones only when tapped (thumbnail + play button)
 */
(function () {
  'use strict';

  var PHONE = window.matchMedia && matchMedia('(max-width:1023px)').matches;
  var path = location.pathname;
  var CHECKOUT = 'https://circle.wedeepen.com/checkout/wedeepen-club-membership';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

  /* == Videos (all devices) ================================================ */
  function videos() {
    $$('iframe[data-yt-src]').forEach(function (f) {
      var src = f.getAttribute('data-yt-src');
      if (!PHONE) { f.src = src; return; }
      var m = src.match(/embed\/([\w-]{6,})/);
      if (!m) { f.src = src; return; }
      var box = el(
        '<button type="button" class="ms-yt" aria-label="Play video: ' + (f.title || 'video').replace(/"/g, '&quot;') + '">' +
          '<img src="https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg" alt="" loading="lazy">' +
          '<span class="ms-yt-play" aria-hidden="true"></span>' +
        '</button>'
      );
      // Some players size the iframe absolutely inside a padded wrapper.
      if (getComputedStyle(f).position === 'absolute') box.style.cssText = 'position:absolute;inset:0;';
      box.addEventListener('click', function () {
        f.src = src + (src.indexOf('?') < 0 ? '?' : '&') + 'autoplay=1';
        box.replaceWith(f);
      });
      f.replaceWith(box);
    });
  }
  videos();
  if (!PHONE) return;

  document.documentElement.classList.add('ms');
  var css = ''
    + '.ms-yt{position:relative;display:block;width:100%;height:100%;padding:0;border:0;background:#000;cursor:pointer;}'
    + '.ms-yt img{width:100%;height:100%;object-fit:cover;opacity:.85;}'
    + '.ms-yt-play{position:absolute;left:50%;top:50%;width:68px;height:48px;margin:-24px 0 0 -34px;border-radius:14px;background:rgba(160,27,74,.95);box-shadow:0 6px 20px rgba(0,0,0,.4);}'
    + '.ms-yt-play:after{content:"";position:absolute;left:28px;top:14px;border-style:solid;border-width:10px 0 10px 16px;border-color:transparent transparent transparent #fff;}'
    + '.ms-cta{text-align:center;margin:28px auto;max-width:440px;padding:24px 20px;border-radius:16px;background:rgba(160,27,74,.12);border:1px solid rgba(201,162,119,.3);}'
    + '.ms-cta .ms-lead{font-family:"Playfair Display",Georgia,serif;font-size:21px;line-height:1.3;margin:0 0 14px;color:#fff;}'
    + '.ms-cta .ms-btn{display:flex;justify-content:center;align-items:center;width:100%;background:#A01B4A;color:#fff !important;font-weight:600;font-size:16px;border-radius:999px;padding:14px 18px;text-decoration:none !important;font-family:"DM Sans",Inter,system-ui,sans-serif;}'
    + '.ms-cta .ms-sub{font-size:13px;margin:10px 0 0;opacity:.65;color:#fff;font-family:"DM Sans",Inter,system-ui,sans-serif;}'
    + '.ms-light{background:#fff;border-color:rgba(160,27,74,.2);}'
    + '.ms-light .ms-lead{color:#1A1A1A;}.ms-light .ms-sub{color:#1A1A1A;}'
    + '#ms-bar{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;flex-direction:column;align-items:center;gap:1px;padding:10px 20px 12px;background:#A01B4A;color:#fff;text-decoration:none;line-height:1.25;box-shadow:0 -4px 24px rgba(0,0,0,.45);transform:translateY(110%);transition:transform .3s;font-family:"DM Sans",Inter,system-ui,sans-serif;}'
    + '#ms-bar.on{transform:none;}'
    + '#ms-bar .n{font-size:12px;font-weight:500;letter-spacing:.04em;opacity:.85;}#ms-bar .m{font-size:16px;font-weight:700;}'
    + '.ms-pad{height:72px;}'
    + '.ms-swipe{display:flex !important;flex-wrap:nowrap !important;justify-content:flex-start !important;gap:14px !important;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-left:-24px;margin-right:-24px;padding:0 24px 6px;scroll-padding:0 24px;}'
    + '.ms-swipe::-webkit-scrollbar{display:none;}.ms-swipe>*{flex:0 0 62%;scroll-snap-align:start;}'
    + '.ms-hint{text-align:center;margin-top:10px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.45;}'
    + '.ms-clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}'
    + '.ms-more{background:none;border:0;padding:6px 0;margin-top:4px;color:#C9A277;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}'
    + '.ms-hide{display:none !important;}'
    + '.ms-council{grid-template-columns:1fr 1fr !important;gap:12px !important;}'
    + '.ms-council .council-card{cursor:pointer;}'
    + '.ms-council .council-bio,.ms-council .council-links{display:none;}'
    + '.ms-council .council-card.open{grid-column:1 / -1;}'
    + '.ms-council .council-card.open .council-bio{display:block;}.ms-council .council-card.open .council-links{display:flex;}'
    + '.ms-council .council-name{font-size:16px !important;}.ms-council .council-specialty{font-size:12px !important;}'
    + '.ms-council .council-card:not(.open) .council-body:after{content:"Read bio +";display:block;margin-top:6px;color:#C9A277;font-size:12px;font-weight:600;}'
    + '.ms-toc{margin:18px 0;border:1px solid rgba(0,0,0,.12);border-radius:12px;padding:4px 16px;}'
    + '.ms-toc summary{cursor:pointer;font-weight:600;padding:10px 0;}'
    + '.ms-chip-in{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;letter-spacing:.04em;padding:3px 9px;border-radius:999px;background:rgba(160,27,74,.1);color:#A01B4A;}'
    + '.ms-jump{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:11px 20px;border-radius:999px;border:1px solid rgba(201,162,119,.6);color:#C9A277 !important;font-weight:600;font-size:15px;text-decoration:none !important;}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function prompt(key, lead, opts) {
    opts = opts || {};
    return el(
      '<div class="ms-cta' + (opts.light ? ' ms-light' : '') + '">' +
        '<p class="ms-lead">' + lead + '</p>' +
        '<a class="ms-btn" data-cta="ms-' + key + '" href="' + CHECKOUT + '" target="_blank" rel="noopener">' + (opts.label || 'Become a Member &middot; $99/month') + '</a>' +
        '<p class="ms-sub">' + (opts.sub || 'Join today. Come Tuesday at 7pm ET.') + '</p>' +
      '</div>'
    );
  }

  function swipe(row) {
    if (!row) return;
    row.classList.add('ms-swipe');
    var hint = el('<p class="ms-hint" aria-hidden="true">Swipe &rarr;</p>');
    row.insertAdjacentElement('afterend', hint);
    row.addEventListener('scroll', function () { if (row.scrollLeft > 20) hint.style.visibility = 'hidden'; }, { passive: true });
  }

  // Collapse a block of text to 3 lines with a "Read more" toggle.
  function clamp(block, hideAlso) {
    if (!block) return;
    block.classList.add('ms-clamp');
    (hideAlso || []).forEach(function (h) { if (h) h.classList.add('ms-hide'); });
    var btn = el('<button type="button" class="ms-more" aria-expanded="false">Read more +</button>');
    btn.addEventListener('click', function () {
      var open = block.classList.toggle('ms-clamp') === false;
      (hideAlso || []).forEach(function (h) { if (h) h.classList.toggle('ms-hide', !open); });
      btn.textContent = open ? 'Show less −' : 'Read more +';
      btn.setAttribute('aria-expanded', String(open));
    });
    block.insertAdjacentElement('afterend', btn);
  }

  /* == Sticky join bar ====================================================== */
  function nextTuesday() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
      var wd = '', hr = 0;
      parts.forEach(function (p) { if (p.type === 'weekday') wd = p.value; if (p.type === 'hour') hr = Number(p.value); });
      var add = (2 - ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd) + 7) % 7;
      if (add === 0 && hr >= 19) add = 7;
      return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(Date.now() + add * 864e5));
    } catch (e) { return 'Tuesday'; }
  }
  function stickyBar() {
    // Pages with their own bottom bar: the homepage/membership and Love Immersion.
    if ($('#mobile-join-bar') || /^\/love-immersion\//.test(path) || /^\/join\//.test(path)) return;
    var bar = el(
      '<a id="ms-bar" data-cta="ms-sticky" href="' + CHECKOUT + '" target="_blank" rel="noopener">' +
        '<span class="n">Next live session: ' + nextTuesday() + ' &middot; 7pm ET</span>' +
        '<span class="m">Join &middot; $99/month &rarr;</span>' +
      '</a>'
    );
    document.body.appendChild(el('<div class="ms-pad" aria-hidden="true"></div>'));
    document.body.appendChild(bar);
    var scrolled = false, popup = false;
    function paint() { bar.classList.toggle('on', scrolled && !popup); }
    window.addEventListener('scroll', function () {
      var s = window.scrollY > window.innerHeight * 0.6;
      if (s !== scrolled) { scrolled = s; paint(); }
    }, { passive: true });
    new MutationObserver(function () {
      var p = !!document.querySelector('#wd-guide.wd-open, #wd-lead-sheet.wd-open, #wd-lead-overlay.wd-open, #mobile-nav.open, #mobile-nav.active');
      if (p !== popup) { popup = p; paint(); }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  }

  /* == Page by page ========================================================= */
  function faculty() {
    // Featured guides: bio clamped, social links behind "Read more".
    $$('section[id] .strategist-card').forEach(function (card) {
      var bio = $('p.text-white\\/70', card);
      var rest = $$('p.text-white\\/70', card).slice(1);
      var links = $('.flex.flex-wrap.gap-2', card);
      clamp(bio, rest.concat([links]));
      var img = $('.aspect-\\[4\\/5\\]', card);
      if (img) img.style.maxWidth = '220px';
    });
    var ken = $('#ken-page');
    if (ken) ken.firstElementChild.appendChild(prompt('faculty', 'Learn from all of them, every Tuesday.'));
    var council = $('#full-council .grid');
    if (council) {
      council.classList.add('ms-council');
      $$('.council-card', council).forEach(function (c) {
        c.addEventListener('click', function (e) { if (!e.target.closest('a')) c.classList.toggle('open'); });
      });
    }
  }

  function loveImmersion() {
    // Guides as a swipe row.
    var guides = $$('h2').filter(function (h) { return /Your Guides/.test(h.textContent); })[0];
    if (guides) swipe($('.flex.flex-wrap.justify-center', guides.closest('section')));
    // Day-by-day: keep the first paragraph, the rest behind "Read more".
    $$('.pillar-card').forEach(function (card) {
      var text = $('.space-y-3', card);
      if (!text) return;
      var ps = $$('p', text);
      if (ps.length > 1) clamp(ps[0], ps.slice(1));
      $$('img.md\\:block', card).forEach(function (i) { i.classList.add('ms-hide'); });
    });
    // A $99 way in for anyone who reaches the end without a seat.
    var reserves = $$('main a[href*="ticketspice"], body > section a[href*="ticketspice"]').filter(function (a) { return a.offsetParent && !a.closest('.fixed'); });
    var last = reserves[reserves.length - 1];
    if (last) {
      last.closest('section').firstElementChild.appendChild(prompt('li-alt', 'Not ready for three days? Start with Tuesdays.', {
        label: 'Join the Membership &middot; $99/month',
        sub: 'Weekly live sessions with the faculty. The first 20 annual members get $800 toward a Love Immersion.'
      }));
    }
  }

  function blog() {
    var article = $('article.prose');
    if (!article) return;
    var toc = $('#table-of-contents', article);
    var list = toc && toc.nextElementSibling;
    if (toc && list && /^(UL|OL)$/.test(list.tagName)) {
      var d = el('<details class="ms-toc"><summary>Table of contents (' + list.children.length + ')</summary></details>');
      toc.replaceWith(d);
      d.appendChild(list);
    }
    var skip = /^(table-of-contents|sources|faq|recommended)$/;
    var h2s = $$('h2[id]', article).filter(function (h) { return !skip.test(h.id); });
    if (h2s.length >= 4) {
      h2s[Math.floor(h2s.length / 2)].insertAdjacentElement('beforebegin',
        prompt('blog-mid', 'Reading about it is a start. Practicing it with others is where it sticks.', { light: true }));
    }
  }

  function episode() {
    var audio = $('audio');
    var video = $('.ms-yt, iframe[data-yt-src], iframe[src*="youtube"]');
    var anchor = (audio && audio.closest('section')) || (video && video.closest('section'));
    if (!anchor) return;
    var wrap = el('<div class="px-6"></div>');
    wrap.appendChild(prompt('episode', 'Love this conversation? Practice it live every Tuesday.'));
    anchor.insertAdjacentElement('afterend', wrap);
  }

  function events() {
    $$('.event-card[href*="member-s-calendar"]').forEach(function (card) {
      var chips = $('.event-card__chips', card);
      if (chips && !$('.ms-chip-in', chips)) chips.insertAdjacentHTML('beforeend', '<span class="ms-chip-in">Included with membership</span>');
    });
    var grid = $('.event-card') && $('.event-card').parentElement;
    if (grid && !$('.ms-cta[data-ms="events"]')) {
      var p = prompt('events', 'Every member session here is included in the $99 membership.', { light: true });
      p.setAttribute('data-ms', 'events');
      grid.insertAdjacentElement('beforebegin', p);
    }
  }

  function podcast() {
    var h = $$('h2').filter(function (x) { return /All Episodes/.test(x.textContent); })[0];
    var sec = h && h.closest('section');
    if (sec) sec.insertAdjacentElement('afterend', el('<div class="px-6 bg-ink"></div>')).appendChild(prompt('podcast', 'Love the podcast? Come practice it every Tuesday.'));
  }

  function about() {
    var h = $$('h2').filter(function (x) { return /^Christina Weber$/.test(x.textContent.trim()); })[0];
    var sec = h && h.closest('section');
    if (sec) sec.firstElementChild.appendChild(prompt('about', 'Practice with Christina and the faculty every Tuesday.'));
  }

  function fourPillars() {
    var h1 = $('#four-pillars h1');
    var form = $('form[data-guide-form]');
    if (!h1 || !form) return;
    var jump = el('<a href="#" class="ms-jump">Get the free guide &darr;</a>');
    jump.addEventListener('click', function (e) { e.preventDefault(); form.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    var after = h1.nextElementSibling || h1;
    after.insertAdjacentElement('afterend', el('<div style="margin:0 0 24px;"></div>')).appendChild(jump);
  }

  function run() {
    if (/^\/love-guides\/?$/.test(path)) faculty();
    else if (/^\/love-immersion\/[^/]+\/?$/.test(path)) loveImmersion();
    else if (/^\/blog\/[^/]+\/?$/.test(path)) blog();
    else if (/^\/deepen-with-christina\/[^/]+\/?$/.test(path)) episode();
    else if (/^\/events\/?$/.test(path)) {
      events();
      // The calendar can re-render client-side; re-tag new cards.
      var list = $('.event-card') && $('.event-card').parentElement;
      if (list) new MutationObserver(events).observe(list, { childList: true });
    }
    else if (/^\/podcast\/?$/.test(path)) podcast();
    else if (/^\/about\/?$/.test(path)) about();
    else if (/^\/four-pillars\/?$/.test(path)) fourPillars();
    stickyBar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
