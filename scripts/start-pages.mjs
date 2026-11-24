/**
 * start-pages.mjs — short, ad-matched membership pages at /membership/start/<slug>/.
 *
 * Why (René, Nov 24, 2026): Clarity showed 2 of 3 ad visitors never scroll the long practice page.
 * Each page opens on one pain, with three member videos right under it (the most-tapped thing on
 * the practice page, Clarity Nov 21-24),, in the words people use when they arrive (the same lines as the
 * checkout story and the phone quiz), then: the turn → member proof → how it works → the offer.
 * About five phone screens. Each page is matched to the Meta pain-clip ads on that theme.
 * Copy pre-approved by Christina (via René, Nov 24). Voice rules: no diagnosis, no outcome promises,
 * trial line verbatim, no session day named.
 *
 * Build: node scripts/start-pages.mjs  (writes membership/start/<slug>/index.html; never edit those by hand)
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const TRIAL = 'Your first 14 days are free. After that it&rsquo;s $99/month, our founding member rate. Cancel anytime.';

export const PAGES = [
  {
    slug: 'dating',
    group: 'Start Dating',
    title: 'Dating again, and it&rsquo;s so different now | WeDeepen',
    description: 'Dating again after years away? Practice it live with expert faculty and people doing the same work. 14 days free, then $99/month.',
    h1: '&ldquo;I&rsquo;m dating again and it&rsquo;s so <em>different</em> now.&rdquo;',
    sub: 'Apps. Texts you can&rsquo;t read. A pace nobody explained. It&rsquo;s not that you&rsquo;re doing something wrong. Nobody teaches this part.',
    turnH2: 'Dating is a skill. <em>So is love.</em>',
    turnP: 'WeDeepen is where you practice it, out loud, with expert faculty and people who are in it too. Come partnered, dating, or solo.',
    practice: [
      'Know what you&rsquo;re looking for, and say it early.',
      'Tell real interest from mixed signals.',
      'Keep your heart open without losing yourself.',
      'Ask the questions most people wait months to ask.',
    ],
    videos: 'gabby-intimacy sara-coolest-people hannah-space-for-you',
    quote: { text: 'The love masterminding has been life-changing. I finally understand my identity and can actually step into it.', who: 'Bo L., member' },
  },
  {
    slug: 'desire',
    group: 'Start Desire',
    title: 'More like roommates than lovers? | WeDeepen',
    description: 'Desire, play and real conversation, practiced live with expert faculty. Come together or on your own. 14 days free, then $99/month.',
    h1: '&ldquo;We feel more like roommates than <em>lovers.</em>&rdquo;',
    sub: 'In the beginning, desire runs on novelty. Years in, it runs on what you practice. Most of us were never shown how.',
    turnH2: 'Desire is a skill. <em>You can practice it.</em>',
    turnP: 'In live sessions, expert faculty work through members&rsquo; real questions about desire, trust and feelings. Come together, or come on your own.',
    practice: [
      'Miss each other, and reunite.',
      'See your partner through new eyes.',
      'Build something together.',
      'Ask for what you want, out loud.',
    ],
    videos: 'beth-gift gabby-intimacy matt-same-team',
    quote: { text: 'The quality of the coaches is unmatched. Christina brings in high-level professionals you end up wanting to keep working with.', who: 'Krista &amp; Thomas, together 15 years' },
  },
  {
    slug: 'fight',
    group: 'Start Same Fight',
    title: 'The same fight, again? | WeDeepen',
    description: 'Practice repair, real conversation and the skills underneath, live with expert faculty. 14 days free, then $99/month.',
    h1: '&ldquo;We keep having the <em>same fight.</em>&rdquo;',
    sub: 'Different day, same argument. It&rsquo;s not that you&rsquo;re doing something wrong. It&rsquo;s the gap between learning it and living it.',
    turnH2: 'Repair is a skill. <em>So is love.</em>',
    turnP: 'WeDeepen is a practice room, not a library: live sessions with expert faculty, real questions, and people doing the same work.',
    practice: [
      'Have hard conversations without losing the connection.',
      'Repair conflict before hurt turns into distance.',
      'Tell a rough patch from a repeating pattern.',
      'Ask one question when something stings: what part of this is mine?',
    ],
    videos: 'matt-same-team cara-11-months bo-friends-open-heart',
    quote: { text: 'The quality of the coaches is unmatched. Christina brings in high-level professionals you end up wanting to keep working with.', who: 'Krista &amp; Thomas, together 15 years' },
  },
  {
    slug: 'stay',
    group: 'Start Stay Or Go',
    title: 'Not sure whether to stay or go? | WeDeepen',
    description: 'Get clear with expert faculty and people doing the same work. No verdicts, real practice. 14 days free, then $99/month.',
    h1: '&ldquo;I don&rsquo;t know if I should <em>stay or go.</em>&rdquo;',
    sub: 'Nobody can answer that for you, and nobody here will try. What you can do is get clear, with people who&rsquo;ve been there.',
    turnH2: 'Clarity is a skill. <em>You can practice it.</em>',
    turnP: 'No attachment to outcome. Growth comes first. In live sessions, expert faculty work through members&rsquo; real questions, and you can share or just listen.',
    practice: [
      'Tell a rough patch from a repeating pattern.',
      'Notice where you&rsquo;re shrinking to make it work.',
      'Ask one question when something stings: what part of this is mine?',
      'Speak up about needs and boundaries, sooner.',
    ],
    videos: 'cara-11-months hannah-space-for-you beth-belonging',
    quote: { text: 'The love masterminding has been life-changing. I finally understand my identity and can actually step into it.', who: 'Bo L., member' },
  },
];

const CHECKOUT = '/checkout/?price_id=368281';

function page(p) {
  const url = `https://wedeepen.com/membership/start/${p.slug}/`;
  const practice = p.practice.map((t) => `          <li>${t}</li>`).join('\n');
  return `<!DOCTYPE html>
<!-- Generated by scripts/start-pages.mjs. Edit the PAGES data there, then run: node scripts/start-pages.mjs -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-LZ0EY5X593"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    if (!navigator.webdriver && !/bot|crawl|spider|facebookexternalhit|meta-external|HeadlessChrome|Lighthouse/i.test(navigator.userAgent)) gtag('config', 'G-LZ0EY5X593', { content_group: '${p.group}', page_variant: 'start_${p.slug}' });
    gtag('config', 'AW-18481553095');
  </script>
  <!-- Microsoft Clarity -->
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "z2chqpt354");
    try { clarity('set', 'start_page', '${p.slug}'); } catch (e) {}
  </script>
  <!-- Loads the Meta pixel (PageView) and sends begin_checkout / InitiateCheckout on Join taps -->
  <script src="/js/checkout-tracking.js?v=4" defer></script>

  <title>${p.title}</title>
  <meta name="description" content="${p.description}">
  <meta name="robots" content="noindex, nofollow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${p.title}">
  <meta property="og:description" content="${p.description}">
  <meta property="og:site_name" content="WeDeepen">
  <meta property="og:image" content="https://wedeepen.com/images/og/og-join.jpg">

  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/start-pages.css?v=2">
  <link rel="stylesheet" href="/css/member-videos.css?v=2">
</head>
<body>
  <header class="sp-logo"><a href="/" aria-label="WeDeepen home"><img src="/images/deepen-logo-white-sm.png" alt="DeePeN" width="160" height="29"></a></header>

  <main>
    <!-- 1. Their pain, in their words -->
    <section class="sp-hero">
      <p class="sp-kicker">What people tell us when they arrive</p>
      <h1>${p.h1}</h1>
      <p class="sp-sub">${p.sub}</p>
      <p class="sp-label sp-label-c">Hear it from members</p>
      <div class="mv-row" data-mv-grid data-mv-compact data-mv-pick="${p.videos}"></div>
      <a class="sp-btn" data-cta="hero" href="${CHECKOUT}">Start my 14 free days &rarr;</a>
      <a class="sp-more" href="#turn" data-more>See how it works &darr;</a>
    </section>

    <!-- 2. The turn -->
    <section class="sp-turn" id="turn">
      <p class="sp-kicker">Love is a trainable skill</p>
      <h2>${p.turnH2}</h2>
      <p>${p.turnP}</p>
      <p class="sp-label">What you practice</p>
      <ul class="sp-list">
${practice}
      </ul>
    </section>

    <!-- 3. Proof -->
    <section class="sp-proof">
      <blockquote class="sp-quote">&ldquo;${p.quote.text}&rdquo;<cite>${p.quote.who}</cite></blockquote>
      <p class="sp-rating"><span aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span> 5.0 from 26 Google reviews</p>
    </section>

    <!-- 4. What happens when you join -->
    <section class="sp-how">
      <h2>What happens when you <em>join</em></h2>
      <div class="sp-steps">
        <div><b>Live sessions</b><span>Love Masterminds with the faculty, built around your real questions, and Integration Sessions to practice what you learned.</span></div>
        <div><b>Private member community</b><span>Ask the Experts Q&amp;A with our faculty, and private discussions on dating, sex, conflict and anything you&rsquo;re working through.</span></div>
        <div><b>Practice + recordings</b><span>A new Sunday Dare by email, and recordings of Love Masterminds held after you join.</span></div>
      </div>
      <p class="sp-note">Come live when you can, catch the recording when you can&rsquo;t. Camera off is fine, and you&rsquo;re welcome to just listen.</p>
    </section>

    <!-- 5. The offer -->
    <section class="sp-offer" id="offer">
      <h2>Come practice with us.</h2>
      <p>${TRIAL}</p>
      <a class="sp-btn" data-cta="offer" href="${CHECKOUT}">Start my 14 free days &rarr;</a>
      <details><summary>Is this therapy?</summary><p>No. It&rsquo;s expert-led coaching and practice in a community. It isn&rsquo;t a replacement for therapy, and plenty of members do both.</p></details>
      <details><summary>Do I have to share?</summary><p>No. Camera off is fine, and you&rsquo;re welcome to just listen. Share when you&rsquo;re ready.</p></details>
      <details><summary>What if I can&rsquo;t make it live?</summary><p>Love Masterminds are recorded, so you can catch them later from anywhere.</p></details>
      <details><summary>How do I cancel?</summary><p>On your own, anytime, from your billing page. We email you before your 14 free days end.</p></details>
      <p class="sp-small">Questions first? A real person answers at <a href="mailto:hello@wedeepen.com">hello@wedeepen.com</a></p>
    </section>
  </main>

  <!-- Sticky Start button, after the first screen -->
  <div class="sp-sticky" id="sp-sticky" aria-hidden="true">
    <a class="sp-btn" data-cta="mobile-sticky" href="${CHECKOUT}" tabindex="-1">Start my 14 free days &rarr;</a>
  </div>

  <!-- Member video row + full-screen player (shared with the homepage); plays, completions and Next story go to GA4 -->
  <script src="/js/member-videos.js?v=3" defer></script>
  <script>
    (function () {
      function ga(ev, params) { try { if (typeof window.gtag === 'function') window.gtag('event', ev, params || {}); } catch (e) {} }
      var q = new URLSearchParams(location.search);
      // Ad attribution: checkout links carry the visitor's utm values; utm_content is prefixed "start_${p.slug}".
      var cnt = 'start_${p.slug}' + (q.get('utm_content') ? '_' + q.get('utm_content') : '');
      document.querySelectorAll('a[href^="/checkout/?"]').forEach(function (a) {
        var u = new URL(a.href);
        u.searchParams.set('utm_source', q.get('utm_source') || 'facebook');
        u.searchParams.set('utm_medium', q.get('utm_medium') || 'paid_social');
        u.searchParams.set('utm_campaign', q.get('utm_campaign') || 'pain_clips');
        u.searchParams.set('utm_content', cnt);
        a.href = u.toString();
      });
      // Join taps (GA4 join_click by position); begin_checkout is sent by checkout-tracking.js
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a');
        if (!a) return;
        if (a.pathname === '/checkout/') ga('join_click', { cta_position: a.getAttribute('data-cta') || 'unknown', link_text: (a.textContent || '').trim().slice(0, 40) });
        if (a.hasAttribute('data-more')) { ga('start_see_more'); try { clarity('event', 'start_see_more'); } catch (x) {} }
      }, true);
      // How far people get: one event per section reached
      var seen = {};
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (en) {
            var k = en.target.className.replace('sp-', '');
            if (en.isIntersecting && !seen[k]) { seen[k] = 1; ga('start_section_view', { section: k }); }
          });
        }, { threshold: 0.4 });
        document.querySelectorAll('main > section').forEach(function (s) { io.observe(s); });
      }
      // Sticky button shows once the hero button has scrolled away, hides at the offer
      var sticky = document.getElementById('sp-sticky'), hero = document.querySelector('.sp-hero .sp-btn'), offer = document.getElementById('offer');
      function upd() {
        var past = hero.getBoundingClientRect().bottom < 0;
        var atOffer = offer.getBoundingClientRect().top < window.innerHeight * 0.85;
        var on = past && !atOffer;
        sticky.classList.toggle('on', on);
        sticky.setAttribute('aria-hidden', on ? 'false' : 'true');
        sticky.querySelector('a').tabIndex = on ? 0 : -1;
      }
      window.addEventListener('scroll', upd, { passive: true }); upd();
    })();
  </script>
</body>
</html>
`;
}

for (const p of PAGES) {
  const dir = new URL(`../membership/start/${p.slug}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('index.html', dir), page(p));
  console.log(`membership/start/${p.slug}: built`);
}
