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
 *  4. Two-line sticky join bar (weekly sessions + join) that steps aside for popups.
 *  5. Three objection answers right above the final join button.
 *  6. "Your first session" timeline right after the membership offer.
 *  7. Hero "What's included" is a button that lands on a short summary
 *     (what you get, price, join) at the top of the membership section.
 *  8. Homepage hero (Christina, Nov 5, 2026): "Love is the key. Fun is the way.",
 *     a one-line synopsis, the join button with a reassurance line, and a
 *     "What brings you to WeDeepen?" checklist that opens matching skills and
 *     a join button. The two intro paragraphs move to the top of "At a glance".
 *     Only on the homepage hero; the audience pages keep their own.
 *  9. The three usual worries answered right under the "In short" summary.
 * 10. The two argument sections (learning curve, skills) fold after their
 *     opening behind "Read more", so the offer comes sooner. Nothing deleted.
 *
 * Christina's photos and hero video are left exactly as designed (her call,
 * 2026-10-03); apart from the testimonials, her section order stays too.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('m2')) return;

  var CHECKOUT = 'https://circle.wedeepen.com/checkout/wedeepen-club-membership?price_id=368281' +
    (/^\/membership\/b\//.test(location.pathname) ? '&utm_content=membership-b' :
     /^\/membership\/dating-again\//.test(location.pathname) ? '&utm_content=membership-dating-again' :
     /^\/membership\/together\//.test(location.pathname) ? '&utm_content=membership-together' : '');
  // Audience pages (scripts/membership-segments.mjs) open the recording library from day one.
  var LIBRARY = root.getAttribute('data-recordings') === 'library';
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function sec(name) { return $('[data-m2="' + name + '"]'); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

  function joinPrompt(key, lead, label) {
    return el(
      '<div class="m2-cta">' +
        '<p class="lead">' + lead + '</p>' +
        '<a data-cta="m2-' + key + '" href="' + CHECKOUT + '" class="btn-rose text-base !py-4">' + (label || 'Start my 14 free days') + '</a>' +
        '<p class="sub">Join today. Come to the next live session.</p>' +
      '</div>'
    );
  }

  // Three short answers to the usual worries (used above the final join button
  // and under the "In short" summary).
  function objections(extraClass) {
    return el(
      '<div class="m2-objections' + (extraClass ? ' ' + extraClass : '') + '">' +
        '<div><h3>Do I need to be in a relationship?</h3><p>No. It&rsquo;s for people who are dating, partnered, between relationships, or simply want a better love life. Partners can join together, each with their own membership.</p></div>' +
        '<div><h3>What if I can&rsquo;t make a session live?</h3><p>' + (LIBRARY ? 'Love Masterminds are recorded, and the whole library opens on your first day. Integration Sessions are live practice.' : 'Every Love Mastermind is recorded from the time you join, so you can catch it later. Integration Sessions are live practice.') + '</p></div>' +
        '<div><h3>Is this a cult or a clique?</h3><p>Not a church. Not an MLM. A culture shift: curious people practicing love together, with many teachers and no single guru or system.</p></div>' +
        '<div><h3>What happens in a session?</h3><p>60 to 90 minutes, online. Love Masterminds with the faculty, built around real relationship questions, alternate with Integration Sessions where you practice what you learned.</p></div>' +
      '</div>'
    );
  }

  // Phones: show the start of a long section and fold the rest behind a
  // "Read more" button. Nothing is removed from the page (SEO); tapping opens it.
  function fold(section, nodes, label, after) {
    nodes = nodes.filter(Boolean);
    if (!section || !nodes.length) return;
    nodes.forEach(function (n) { n.classList.add('m2-folded'); });
    var btn = el('<button type="button" class="m2-fold-btn" aria-expanded="false">' + label + ' &darr;</button>');
    var last = after || nodes[nodes.length - 1];
    (last.tagName === 'LI' ? last.parentElement : last).insertAdjacentElement('afterend', btn);
    btn.addEventListener('click', function () {
      nodes.forEach(function (n) { n.classList.remove('m2-folded'); });
      btn.remove();
    });
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

  // 8. Homepage hero on phones (Christina, Nov 5, 2026).
  // Inner-voice options, dating and partnered lines mixed near the top (Christina, Nov 13, 2026). Draft. Each gets its own opener on the result.
  // skills = indexes into the "Build the skills" list (data-m2="build").
  var QUIZ = [
    { key: 'get-it-right', label: 'I want to get it right this time', skills: [4, 3, 7],
      lead: 'Getting it right starts with owning your part. Instead of asking &lsquo;What can I get?&rsquo;, ask &lsquo;Who do I get to become?&rsquo;' },
    { key: 'dating-again', label: 'I&rsquo;m dating again and it&rsquo;s so different now', skills: [0, 3, 4],
      lead: 'Date by the Four Pillars. Prioritize growth. Own your part. Let every feeling be welcome. Practice love with every person you meet.' },
    { key: 'same-fight', label: 'We keep having the same fight', skills: [2, 6, 3],
      lead: 'All feelings are welcome here, even the ones that started the fight. You learn to repair before hurt turns into distance.' },
    { key: 'wanted', label: 'I want to feel wanted again', skills: [1, 5, 3],
      lead: 'Desire starts in your own skin. Jump to a timeline where you know you&rsquo;re wanted.' },
    { key: 'roommates', label: 'We feel more like roommates than lovers', skills: [5, 1, 6],
      lead: 'Desire grows when you miss each other, see each other with new eyes, and build something together.' },
    { key: 'stay-go', label: 'I don&rsquo;t know if I should stay or go', skills: [3, 6, 7],
      lead: 'You&rsquo;ve probably been ruminating on this for a while. Here, you get clear enough to choose.' },
    { key: 'not-over', label: 'I&rsquo;m still not over them', skills: [4, 3, 0],
      lead: 'Heartbreak is a natural human experience. It&rsquo;s tender, and we&rsquo;ve got you.' }
  ];
  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  function heroV2() {
    var hero = $('#hero');
    var h1 = hero && $('h1', hero);
    if (!h1 || !/Get\s+even\s+better at love/i.test(h1.textContent)) return;
    var cta = $('a[data-cta="hero"]', hero);
    var row = cta && cta.parentElement;
    if (!row) return;
    hero.classList.add('m2-hero-v2');

    h1.innerHTML = '<span class="text-white">Get <span class="italic">even</span> better at love.<br>Have fun doing it.</span>';

    // Move the two intro paragraphs (not deleted) to the top of "At a glance".
    var intro = Array.prototype.slice.call(hero.querySelectorAll('h1 ~ p'));
    var glance = sec('glance');
    var glanceInner = glance && glance.firstElementChild;
    if (glanceInner && intro.length) {
      var box = el('<div class="m2-intro"></div>');
      intro.forEach(function (p) { box.appendChild(p); });
      // Phone-only rewrite of the two intro lines (Christina, Nov 13, 2026). Desktop keeps the originals.
      if (intro.length === 2 && /curious about how much better love/.test(intro[0].textContent)) {
        intro[0].innerHTML = 'No one ever taught us how to do love well. WeDeepen is where you learn it, with expert faculty and members who are practicing too.';
        intro[1].innerHTML = 'Come partnered, dating, or solo.';
      }
      glanceInner.insertAdjacentElement('afterbegin', box);
    }

    h1.insertAdjacentElement('afterend', el(
      '<p class="m2-synopsis">Live weekly sessions with expert faculty on dating, desire, tantra, communication and jumping timelines. Ask the experts anytime in the private community, plus a new dare every Sunday.</p>'
    ));

    row.insertAdjacentElement('afterend', el(
      '<p class="m2-reassure">Way less than one private coaching session. Cancel anytime, on your own.</p>'
    ));

    // The secondary "See what's included" link gives way to the checklist.
    var more = $('a[href="#membership"]', row);
    if (more) more.remove();

    var skillLis = sec('build') ? sec('build').querySelectorAll('ul > li') : [];
    var skillText = function (i) {
      var li = skillLis[i];
      return li ? li.textContent.replace(/^\s*0?\d+\s*/, '').trim() : '';
    };
    var quote = 'I spent years and significant resources on healing and biohacking, but the emotional breakthrough I experienced at the WeDeepen Love Immersion was on another level.';

    var quiz = el(
      '<form class="m2-quiz" novalidate>' +
        '<h2>What brings you to WeDeepen?</h2>' +
        '<p class="m2-quiz-sub">Dating, partnered, or solo. Pick all that fit.</p>' +
        '<div class="m2-quiz-opts">' +
          QUIZ.map(function (q) {
            return '<label class="m2-quiz-opt"><input type="checkbox" name="why" value="' + q.key + '"><span class="box" aria-hidden="true"></span><span class="t">' + q.label + '</span></label>';
          }).join('') +
        '</div>' +
        '<button type="submit" class="m2-quiz-go" disabled>Continue</button>' +
        '<div class="m2-quiz-result" hidden></div>' +
      '</form>'
    );
    row.parentElement.insertBefore(quiz, $('.m2-reassure', hero).nextSibling);

    var go = $('.m2-quiz-go', quiz);
    var result = $('.m2-quiz-result', quiz);
    quiz.addEventListener('change', function () {
      go.disabled = !quiz.querySelector('input:checked');
    });
    quiz.addEventListener('submit', function (e) {
      e.preventDefault();
      var picked = Array.prototype.slice.call(quiz.querySelectorAll('input:checked')).map(function (i) { return i.value; });
      if (!picked.length) return;
      // The first pick (in list order) sets the opener; all picks share the skills list.
      var chosen = QUIZ.filter(function (q) { return picked.indexOf(q.key) !== -1; });
      // Take skills round-robin so every pick gets at least one line.
      var idx = [];
      for (var r = 0; r < 3; r++) chosen.forEach(function (q) {
        var n = q.skills[r];
        if (n !== undefined && idx.indexOf(n) === -1) idx.push(n);
      });
      var items = idx.slice(0, 3).map(skillText).filter(Boolean);
      result.innerHTML =
        '<p class="m2-quiz-lead">' + chosen[0].lead + '</p>' +
        '<p class="m2-quiz-kicker">The skills of intimacy you&rsquo;ll learn</p>' +
        '<ul>' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
        '<blockquote>&ldquo;' + quote + '&rdquo;<cite>Karolina S.</cite></blockquote>' +
        '<a data-cta="m2-quiz" href="' + CHECKOUT + '" class="btn-rose">Join WeDeepen - $99/month<span>(14-day free trial)</span></a>' +
        '<p class="m2-reassure">Cancel anytime, on your own.</p>';
      result.hidden = false;
      go.textContent = 'Update';
      track('quiz_complete', { choices: picked.join(','), page: location.pathname });
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function run() {

    heroV2();

    // At a glance on phones keeps only the intro lines (Christina, Nov 13, 2026).
    // Its heading, three-item list and "skills underneath are the same" closer
    // repeat the photo cards in What's included, so they're hidden, not deleted (SEO).
    var isHome = location.pathname === '/' || location.pathname === '/index.html';
    var glanceSec = isHome && sec('glance');
    var glanceIn = glanceSec && glanceSec.firstElementChild;
    if (glanceIn) Array.prototype.forEach.call(glanceIn.children, function (c) {
      if (!c.classList.contains('m2-intro')) c.style.display = 'none';
    });
    if (glanceSec) glanceSec.classList.add('m2-glance-intro');

    // 1. Member proof right under the hero, as a swipe row (René). Christina's
    // opening argument (at a glance -> learning curve -> skills) follows it
    // directly, in her order; our timeline follows the membership offer.
    var hero = $('#hero');
    var build = sec('build');
    var testimonials = sec('testimonials');
    if (hero && testimonials) hero.insertAdjacentElement('afterend', testimonials);
    if (testimonials) swipe($('.grid', testimonials));

    // 6. "Your first session" right after the membership offer (René).
    var offer = $('#membership');
    if (offer) {
      var steps = el(
        '<section class="m2-steps" aria-label="Your first session">' +
          '<h2>Your <em>first session</em></h2>' +
          '<p>Here&rsquo;s what happens after you join.</p>' +
          '<ol>' +
            '<li><span class="n">1</span><h3>Join today</h3><p>It takes a couple of minutes.</p></li>' +
            '<li><span class="n">2</span><h3>Add the live sessions to your calendar</h3><p>Save the weekly virtual sessions to your calendar to join live. If you miss a Love Mastermind, watch the recording.</p></li>' +
            '<li><span class="n">3</span><h3>Show up live</h3><p>60 to 90 minutes, live and online, with the faculty and members doing the same work. Between sessions, explore the private community in Circle.</p></li>' +
          '</ol>' +
        '</section>'
      );
      steps.appendChild(joinPrompt('first-tuesday', '', 'Start my 14 free days'));
      steps.querySelector('.m2-cta .lead').remove();
      steps.querySelector('.m2-cta .sub').remove();
      offer.insertAdjacentElement('afterend', steps);
    }

    // 10. Shorter path to the offer on phones: the two argument sections show
    // their opening and fold the rest behind "Read more" (René, approved by
    // Christina, 2026-10-24). Desktop shows everything as before.
    var skill = sec('skill');
    if (skill) {
      var skillPs = skill.querySelectorAll('h2 ~ p');
      var skillImg = skill.querySelector('.aspect-\\[3\\/2\\]');
      // Phones: the photo comes before "WeDeepen gives you a place..." (Christina, Nov 13, 2026).
      if (skillImg && skillPs[1]) { skillPs[1].insertAdjacentElement('beforebegin', skillImg); skillImg.style.marginBottom = '20px'; }
      fold(skill, [skillImg, skillPs[1] || null, $('.home-ledger', skill)], 'Read more', skillPs[1] || skillPs[0]);
    }
    if (build) {
      var buildItems = Array.prototype.slice.call(build.querySelectorAll('ul > li'), 3);
      var buildImg = build.querySelector('.aspect-\\[4\\/5\\]');
      fold(build, [buildImg && buildImg.parentElement].concat(buildItems), 'See all 8 skills');
    }

    // 7. "What's included" in the hero becomes a real button on phones and
    // lands on a short summary (what you get, price, join) at the top of the
    // membership section; the full cards and both plans follow (René, 2026-10-24).
    var incl = $('#membership');
    if (incl) {
      var planBtn = $('a[data-cta="membership"]', incl);
      var plansPanel = planBtn && planBtn.closest('.rounded-md');
      if (plansPanel) plansPanel.id = 'm2-plans';
      // Homepage phones (Christina, Nov 13, 2026): the plans panel opens straight on the
      // choice. Its intro paragraphs repeat the price box and the first-session steps,
      // so they're hidden (kept in the HTML); the heading names the choice.
      var plansIntro = isHome && plansPanel && $('.lg\\:col-span-5', plansPanel);
      if (plansIntro) {
        var pi = plansIntro.querySelectorAll('p');
        Array.prototype.forEach.call(pi, function (el2, i) {
          if (i === 1) el2.textContent = 'Choose monthly or annual.';
          else if (i > 1) el2.style.display = 'none';
        });
      }
      // Homepage phones (Christina, Nov 13, 2026): one pricing box. Annual becomes a line
      // under the main button and the separate plans panel is hidden (kept in the HTML).
      var annualLink = isHome && plansPanel && Array.prototype.filter.call(plansPanel.querySelectorAll('a[data-cta="membership"]'), function (a) { return /annual/i.test(a.textContent); })[0];
      var annualHref = annualLink && annualLink.getAttribute('href');
      if (annualHref) plansPanel.style.display = 'none';
      var summary = el(
        '<div class="m2-offer" id="m2-offer">' +
          (isHome ? '' : '<p class="m2-offer-kicker">In short</p>' + '<ul>') +
          (isHome ? '' :
            '<li><b>Live sessions</b><span>Masterminds, relationship workshops, bonding &amp; integration</span></li>' +
            '<li><b>Private community</b><span>Circle discussions + Ask the Experts</span></li>' +
            '<li><b>Real-world practice</b><span>Weekly Sunday Dares by email</span></li>') +
          (isHome ? '' :
            '<li><b>Member perks</b><span>Discounts with partners like MindTravel and Tantra Speed Date</span></li>' +
            '<li><b>Recordings</b><span>' + (LIBRARY ? 'The growing Love Mastermind library, from day one' : 'Every Love Mastermind from the time you join') + '</span></li>' +
          '</ul>') +
          '<p class="m2-offer-price">Your first 14 days are free. After that it&rsquo;s $99/month. Cancel anytime.</p>' +
          '<a data-cta="m2-offer" href="' + CHECKOUT + '" class="btn-rose">Start my 14 free days</a>' +
          (isHome && annualHref ? '<a data-cta="m2-offer-annual" href="' + annualHref + '" class="m2-offer-more">Or go annual: $990/year, two months free &rarr;</a>'
            : (plansPanel ? '<a href="#m2-plans" class="m2-offer-more">See both plans, including annual &darr;</a>' : '')) +
        '</div>'
      );
      var inclHead = $('.text-center', incl);
      // Homepage (Christina, Nov 13, 2026): the photo cards explain what's included,
      // so the box follows them and keeps only what they don't cover, plus price and join.
      var inclCards = isHome && $('.grid.md\\:grid-cols-3', incl);
      if (inclCards) inclCards.insertAdjacentElement('afterend', summary);
      else if (inclHead) inclHead.insertAdjacentElement('afterend', summary);
      else incl.firstElementChild.insertAdjacentElement('afterbegin', summary);
      // 9. The three usual worries, answered right under the summary (René, 2026-10-24).
      summary.insertAdjacentElement('afterend', objections('m2-objections-offer'));
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
        jump(more, isHome ? incl : summary);
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

    // 11. Lower-page order on phones (Christina, Nov 13, 2026): Faculty before the
    // calendar, then Christina, Four Pillars, the in-person spotlight and the
    // gallery, then the FAQ. Desktop keeps its order.
    var calendar = $('#calendar');
    var christinaSec = sec('christina');
    var pillarsSec = $('#four-pillars');
    var spotlight = sec('immersion');
    if (isHome && calendar && faculty) calendar.insertAdjacentElement('beforebegin', faculty);
    var after = isHome && calendar;
    [christinaSec, pillarsSec, spotlight, gallery].forEach(function (s) {
      if (after && s) { after.insertAdjacentElement('afterend', s); after = s; }
    });

    // 12. Shorter phone homepage, a two-week test (Christina, Nov 13, 2026).
    // Everything stays in the HTML (SEO); delete this block to undo.
    if (isHome) {
      // Christina: photo, first paragraph and story links; the rest behind Read more.
      if (christinaSec) {
        var cPs = christinaSec.querySelectorAll('h2 ~ p');
        var cPod = $('img[src*="podcast-artwork"]', christinaSec);
        var cPodRow = cPod && cPod.parentElement;
        var cBtns = cPodRow && cPodRow.nextElementSibling;
        fold(christinaSec, [cPs[1] || null, cPodRow, cBtns], 'Read more');
      }
      // Four Pillars: names stay, illustration and explanations fold.
      if (pillarsSec) {
        pillarsSec.classList.add('m2-pillars-compact');
        var pImg = $('img', pillarsSec);
        var pDescs = Array.prototype.slice.call(pillarsSec.querySelectorAll('h3 + p'));
        fold(pillarsSec, [pImg && pImg.parentElement].concat(pDescs), 'What each pillar means', pDescs.length ? pDescs[pDescs.length - 1].closest('.grid') : null);
      }
      // Gallery and the photo band: hidden on phones (testimonials and NYE carry the photos).
      if (gallery) gallery.style.display = 'none';
      var band = sec('photoband');
      if (band) band.style.display = 'none';
    }

    // 3. Join prompts every few screens.
    if (build) build.firstElementChild.appendChild(joinPrompt('skills', 'Start building these skills this week.'));
    if (faculty) faculty.firstElementChild.appendChild(joinPrompt('faculty', 'Learn from all of them, every week.'));
    var pillars = $('#four-pillars');
    if (pillars) pillars.firstElementChild.appendChild(joinPrompt('pillars', 'This is what we practice together.'));

    // 5. Objections above the final join button.
    var card = sec('finalcard');
    var joinNow = card && $('a[data-cta="final-card"]', card);
    if (joinNow) {
      joinNow.parentElement.insertAdjacentElement('beforebegin', objections());
    }

    // 4. Sticky bar: next session + price, hidden while a popup is open.
    var bar = $('#mobile-join-bar');
    if (bar) {
      bar.innerHTML =
        '<span class="m2-bar-next">Live sessions every week</span>' +
        '<span class="m2-bar-main">Start my 14 free days &rarr;</span>';
      var check = function () {
        var open = document.querySelector('#wd-guide.wd-open, #wd-lead-sheet.wd-open, #wd-lead-overlay.wd-open');
        bar.classList.toggle('m2-hidden', !!open);
      };
      new MutationObserver(check).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    }
  }


  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
