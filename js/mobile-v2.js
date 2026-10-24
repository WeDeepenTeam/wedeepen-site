/*
 * mobile-v2.js: the phone layout of the homepage (and the /membership/
 * mirror). Runs only when <html> has the "m2" class, which the inline
 * snippet in <head> sets on phones / portrait tablets (< 1024px). Desktop
 * never gets the class. Styles: /css/mobile-v2.css. Sections it moves or
 * reshapes carry data-m2="..." markers in index.html; keep them.
 *
 * What it does, in page order:
 *  1. Moves "What Members Say" up under the hero; her argument follows it.
 *  2. Turns long grids into swipe rows (membership cards, faculty, gallery).
 *  3. Adds a join prompt every few screens.
 *  4. Two-line sticky join bar (next session + price) that steps aside for popups.
 *  5. Three objection answers right above the final join button.
 *  6. "Your first Tuesday" timeline right after the membership offer.
 *  7. Hero "What's included" is a button that lands on a short summary
 *     (what you get, price, join) at the top of the membership section.
 *  8. A compact "what happens next" (join, find Tuesday, show up) right under
 *     the hero price line, where most phone visitors make the call.
 *
 * Christina's photos and hero video are left exactly as designed (her call,
 * 2026-10-03); apart from the testimonials, her section order stays too.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('m2')) return;

  var CHECKOUT = 'https://circle.wedeepen.com/checkout/wedeepen-club-membership?price_id=368281' +
    (/^\/membership\/b\//.test(location.pathname) ? '&utm_content=membership-b' : '');
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function sec(name) { return $('[data-m2="' + name + '"]'); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

  function joinPrompt(key, lead, label) {
    return el(
      '<div class="m2-cta">' +
        '<p class="lead">' + lead + '</p>' +
        '<a data-cta="m2-' + key + '" href="' + CHECKOUT + '" class="btn-rose text-base !py-4">' + (label || 'Start my 14 free days') + '</a>' +
        '<p class="sub">Join today. Come Tuesday at 7pm ET.</p>' +
      '</div>'
    );
  }

  // Swipe row with a hint and position dots under it.
  function swipe(grid, extraClass) {
    if (!grid) return;
    grid.classList.add('m2-swipe');
    // Keyboard users can focus the row and scroll it with the arrow keys.
    grid.setAttribute('tabindex', '0');
    grid.setAttribute('role', 'region');
    var h = grid.closest('section') && grid.closest('section').querySelector('h2');
    grid.setAttribute('aria-label', (h ? h.textContent.trim() : 'Cards') + ' (scrolls sideways)');
    if (extraClass) grid.classList.add(extraClass);
    var n = grid.children.length;
    var dots = el('<div class="m2-dots" aria-hidden="true"></div>');
    for (var i = 0; i < n; i++) dots.appendChild(document.createElement('span'));
    dots.firstChild.classList.add('on');
    var hint = el('<p class="m2-hint" aria-hidden="true">Swipe &rarr;</p>');
    grid.insertAdjacentElement('afterend', hint);
    hint.insertAdjacentElement('afterend', dots);
    grid.addEventListener('scroll', function () {
      var w = grid.firstElementChild ? grid.firstElementChild.offsetWidth + 12 : 1;
      var at = Math.min(n - 1, Math.round(grid.scrollLeft / w));
      for (var j = 0; j < n; j++) dots.children[j].classList.toggle('on', j === at);
      if (grid.scrollLeft > 20) hint.style.visibility = 'hidden';
    }, { passive: true });
  }

  function run() {

    // 1. Member proof right under the hero, as a swipe row (René). Christina's
    // opening argument (at a glance -> learning curve -> skills) follows it
    // directly, in her order; our timeline follows the membership offer.
    var hero = $('#hero');
    var build = sec('build');
    var testimonials = sec('testimonials');
    if (hero && testimonials) hero.insertAdjacentElement('afterend', testimonials);
    if (testimonials) swipe($('.grid', testimonials));

    // 6. "Your first Tuesday" right after the membership offer (René).
    var offer = $('#membership');
    if (offer) {
      var steps = el(
        '<section class="m2-steps" aria-label="Your first Tuesday">' +
          '<h2>Your <em>first Tuesday</em></h2>' +
          '<p>Here&rsquo;s what happens after you join.</p>' +
          '<ol>' +
            '<li><span class="n">1</span><h3>Join today</h3><p>It takes a couple of minutes, and you&rsquo;re in the private member community right away.</p></li>' +
            '<li><span class="n">2</span><h3>Find Tuesday on the calendar</h3><p>This week&rsquo;s session is waiting on the member calendar inside the community.</p></li>' +
            '<li><span class="n">3</span><h3>Show up Tuesday at 7pm ET</h3><p>90 minutes, live and online, with the faculty and members doing the same work. Come as you are.</p></li>' +
          '</ol>' +
        '</section>'
      );
      steps.appendChild(joinPrompt('first-tuesday', '', 'Start my 14 free days'));
      steps.querySelector('.m2-cta .lead').remove();
      steps.querySelector('.m2-cta .sub').remove();
      offer.insertAdjacentElement('afterend', steps);
    }

    // 8. "What happens next" in the hero: most phone visitors decide without
    // scrolling far, so the three first-Tuesday steps sit under the price line
    // (same words as the full timeline further down) (René, 2026-10-24).
    var heroCta = $('#hero a[data-cta="hero"]');
    var priceLine = heroCta && heroCta.parentElement && heroCta.parentElement.nextElementSibling;
    if (priceLine && priceLine.tagName === 'P') {
      priceLine.insertAdjacentElement('afterend', el(
        '<ol class="m2-next" aria-label="What happens after you join">' +
          '<li><span class="n">1</span>Join today<small>Takes 2 minutes</small></li>' +
          '<li><span class="n">2</span>Find Tuesday on the calendar</li>' +
          '<li><span class="n">3</span>Show up Tuesday at 7pm ET</li>' +
        '</ol>'
      ));
    }

    // 7. "What's included" in the hero becomes a real button on phones and
    // lands on a short summary (what you get, price, join) at the top of the
    // membership section; the full cards and both plans follow (René, 2026-10-24).
    var incl = $('#membership');
    if (incl) {
      var planBtn = $('a[data-cta="membership"]', incl);
      var plansPanel = planBtn && planBtn.closest('.rounded-md');
      if (plansPanel) plansPanel.id = 'm2-plans';
      var summary = el(
        '<div class="m2-offer" id="m2-offer">' +
          '<p class="m2-offer-kicker">In short</p>' +
          '<ul>' +
            '<li><b>Live sessions</b><span>Masterminds, relationship workshops, bonding &amp; integration</span></li>' +
            '<li><b>Private community</b><span>Circle discussions + Ask the Experts</span></li>' +
            '<li><b>Real-world practice</b><span>Weekly Sunday Dares by text + email</span></li>' +
            '<li><b>Recordings</b><span>Every Love Mastermind from the time you join</span></li>' +
          '</ul>' +
          '<p class="m2-offer-price">Your first 14 days are free. After that it&rsquo;s $99/month. Cancel anytime.</p>' +
          '<a data-cta="m2-offer" href="' + CHECKOUT + '" class="btn-rose">Start my 14 free days</a>' +
          (plansPanel ? '<a href="#m2-plans" class="m2-offer-more">See both plans, including annual &darr;</a>' : '') +
        '</div>'
      );
      var inclHead = $('.text-center', incl);
      if (inclHead) inclHead.insertAdjacentElement('afterend', summary);
      else incl.firstElementChild.insertAdjacentElement('afterbegin', summary);
      // Smooth scrolls can get cut short while the page is still settling
      // (lazy images, reveals), so check where it landed and correct once.
      var jump = function (link, target) {
        if (!link || !target) return;
        link.addEventListener('click', function (e) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(function () {
            var top = target.getBoundingClientRect().top;
            if (top < 60 || top > 160) target.scrollIntoView({ behavior: 'auto', block: 'start' });
          }, 900);
          try { history.replaceState(null, '', '#' + target.id); } catch (err) {}
        });
      };
      var more = $('#hero a[href="#membership"]');
      if (more) {
        more.setAttribute('href', '#m2-offer');
        more.classList.add('m2-more');
        jump(more, summary);
      }
      jump($('.m2-offer-more', summary), plansPanel);
    }

    // 2. Swipe rows.
    var membership = $('#membership');
    if (membership) swipe($('.grid.md\\:grid-cols-3', membership));
    var faculty = sec('faculty');
    if (faculty) swipe($('.grid', faculty), 'm2-swipe-narrow');
    var gallery = sec('gallery');
    if (gallery) swipe($('.grid', gallery), 'm2-swipe-gallery');
    // The calendar fills in after load (Circle feed), so swipe it once it has cards.
    var events = $('#home-events-grid');
    if (events) {
      var done = false;
      var tryEvents = function () {
        if (done || events.children.length < 2 || $('#home-events-loading', events)) return;
        done = true;
        swipe(events);
      };
      tryEvents();
      new MutationObserver(tryEvents).observe(events, { childList: true });
    }

    // 3. Join prompts every few screens.
    if (build) build.firstElementChild.appendChild(joinPrompt('skills', 'Start building these skills this Tuesday.'));
    if (faculty) faculty.firstElementChild.appendChild(joinPrompt('faculty', 'Learn from all of them, every week.'));
    var pillars = $('#four-pillars');
    if (pillars) pillars.firstElementChild.appendChild(joinPrompt('pillars', 'This is what we practice together.'));

    // 5. Objections above the final join button.
    var card = sec('finalcard');
    var joinNow = card && $('a[data-cta="final-card"]', card);
    if (joinNow) {
      joinNow.parentElement.insertAdjacentElement('beforebegin', el(
        '<div class="m2-objections">' +
          '<div><h3>Do I need to be in a relationship?</h3><p>No. It&rsquo;s for people who are dating, partnered, between relationships, or simply want a better love life. Partners can join together, each with their own membership.</p></div>' +
          '<div><h3>What if I can&rsquo;t make Tuesday?</h3><p>Every Love Mastermind is recorded from the time you join, so you can catch it later. Integration Sessions are live practice.</p></div>' +
          '<div><h3>What happens in a session?</h3><p>90 minutes, online. Love Masterminds with the faculty, built around real relationship questions, alternate with Integration Sessions where you practice what you learned.</p></div>' +
        '</div>'
      ));
    }

    // 4. Sticky bar: next session + price, hidden while a popup is open.
    var bar = $('#mobile-join-bar');
    if (bar) {
      bar.innerHTML =
        '<span class="m2-bar-next">Next live session: ' + nextTuesday() + ' &middot; 7pm ET</span>' +
        '<span class="m2-bar-main">Start my 14 free days &rarr;</span>';
      var check = function () {
        var open = document.querySelector('#wd-guide.wd-open, #wd-lead-sheet.wd-open, #wd-lead-overlay.wd-open');
        bar.classList.toggle('m2-hidden', !!open);
      };
      new MutationObserver(check).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    }
  }

  // "Tue, Oct 6": today if it's Tuesday before 7pm Eastern, else next Tuesday.
  function nextTuesday() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
      var wd = '', hr = 0;
      parts.forEach(function (p) { if (p.type === 'weekday') wd = p.value; if (p.type === 'hour') hr = Number(p.value); });
      var dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
      var add = (2 - dow + 7) % 7;
      if (add === 0 && hr >= 19) add = 7;
      var d = new Date(Date.now() + add * 864e5);
      return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }).format(d);
    } catch (e) { return 'Tuesday'; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
