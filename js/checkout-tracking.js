/**
 * WeDeepen checkout tracking: one GA4 `begin_checkout` and one Meta
 * `InitiateCheckout` per click on a link that leaves the site to pay or book.
 * Links to our own /checkout/ send only Meta's InitiateCheckout (and Reddit's
 * AddToCart); GA4 counts those steps inside the checkout (Nov 25, 2026).
 *
 * Sales happen off-site (Circle, TicketSpice, Eventbrite, Acuity), so this
 * click is the last thing the site can measure. GA4 imports it into Google
 * Ads; Meta campaigns optimize for it. The Purchase itself fires on Circle
 * after payment (paywall Tracking code).
 *
 * Also loads the Meta pixel (PageView) on pages that don't load it inline,
 * so every page feeds the same retargeting pool. Pages with an inline pixel
 * keep it; the fbq guard below makes this a no-op there.
 *
 * Page-level handlers still send their own GA4 join_click / ticket_click,
 * Reddit and Lead events. They no longer send InitiateCheckout; this is the
 * only place that does, so each click counts once.
 * Capture phase so it still fires if another handler stops the event.
 * Loaded right after the Google tag on every page.
 */
(function () {
  'use strict';

  var FB_PIXEL_ID = '1541773576982273'; // "WeDeepen Website" dataset
  // Production only: never load the pixel on localhost/dev/preview hosts.
  var IS_PROD = /(^|\.)wedeepen\.com$/.test(location.hostname);
  // Automated browsers (QA scripts, Lighthouse, crawlers) must not send checkout
  // events: a test run on Oct 6, 2026 logged ~86 fake InitiateCheckouts in Meta.
  // Same test the GA4 config uses in each page head.
  var IS_BOT = !!navigator.webdriver || /bot|crawl|spider|facebookexternalhit|meta-external|HeadlessChrome|Lighthouse/i.test(navigator.userAgent);

  if (IS_PROD && !window.fbq) {
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', FB_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // Reddit pixel and Google Ads remarketing on every page, so ads can retarget
  // episode, faculty and retreat visitors too. Pages that load these
  // inline (homepage, /membership/, /inperson) keep theirs; on those, the
  // page's own handlers send Reddit's AddToCart, so OWN_RDT stays false here.
  var RDT_ID = 'a2_jqnveg46gnqn';     // "WeDeepen Inc" Reddit ad account
  var ADS_ID = 'AW-18481553095';
  var OWN_RDT = false;
  if (IS_PROD && !window.rdt) {
    !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
    window.rdt('init', RDT_ID);
    window.rdt('track', 'PageVisit');
    OWN_RDT = true;
  }
  if (IS_PROD && typeof window.gtag === 'function') {
    var hasAds = (window.dataLayer || []).some(function (x) { return x && x[0] === 'config' && x[1] === ADS_ID; });
    if (!hasAds) window.gtag('config', ADS_ID);
  }

  // First match wins. `type` becomes checkout_type in GA4 and content_category in Meta.
  // `value` is the fixed price where we know it; elsewhere Meta still gets
  // value 0 + USD, which it needs to read the event (Events Manager flagged
  // missing price/currency, 2026-10-05).
  var DESTINATIONS = [
    // Circle price IDs: 368282 = $990 annual; anything else (368281 or none) is the $99 monthly.
    { type: 'membership', value: function (u) { return u.searchParams.get('price_id') === '368282' ? 990 : 99; }, test: function (u) { return u.hostname === 'circle.wedeepen.com' && u.pathname.indexOf('/checkout/wedeepen-club-membership') === 0; } },
    { type: 'membership', test: function (u) { return u.hostname === 'circle.wedeepen.com' && u.pathname.indexOf('/checkout/') === 0; } },
    // WeDeepen's own checkout on wedeepen.com (Nov 21, 2026): the homepage Join buttons now go here. Same price IDs.
    // GA4 skips this one (ga: false): a tap here is already counted as join_click, and on our own checkout GA4's
    // begin_checkout now fires when the person actually starts (types an email or taps Apple Pay / Google Pay; see
    // own-checkout.js). Meta's InitiateCheckout still fires on the tap, unchanged, because a live ad set optimizes for it.
    { type: 'membership', ga: false, value: function (u) { return u.searchParams.get('price_id') === '368282' || u.searchParams.get('plan') === 'yearly' ? 990 : 99; }, test: function (u) { return /(^|\.)wedeepen\.com$/.test(u.hostname) && u.pathname === '/checkout/'; } },
    { type: 'event', test: function (u) { return /(^|\.)ticketspice\.com$/.test(u.hostname) || /(^|\.)eventbrite\.com$/.test(u.hostname); } },
    { type: 'booking', test: function (u) { return /(^|\.)acuityscheduling\.com$/.test(u.hostname); } }
  ];

  document.addEventListener('click', function (e) {
    if (IS_BOT) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;

    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }

    for (var i = 0; i < DESTINATIONS.length; i++) {
      var d = DESTINATIONS[i];
      if (!d.test(url)) continue;

      var position = a.getAttribute('data-cta') || (a.closest('#wd-header, #mobile-nav') ? 'header' : 'body');
      var checkoutUrl = (url.hostname + url.pathname).slice(0, 100);

      if (d.ga !== false && typeof window.gtag === 'function') {
        window.gtag('event', 'begin_checkout', {
          checkout_type: d.type,
          checkout_url: checkoutUrl,
          link_text: (a.textContent || '').trim().slice(0, 40),
          cta_position: position
        });
      }

      if (typeof window.fbq === 'function') {
        var value = typeof d.value === 'function' ? d.value(url) : (d.value || 0);
        var fbParams = { content_category: d.type, content_name: checkoutUrl, value: value, currency: 'USD' };
        window.fbq('track', 'InitiateCheckout', fbParams);
      }

      if (OWN_RDT) window.rdt('track', 'AddToCart');
      return;
    }
  }, true);
})();

/**
 * Where did this visitor come from? (Nov 25, 2026)
 * Ads tag their links (utm_source, utm_campaign, utm_content = the ad), but they
 * land on a page like /membership/start/stay/ and the Join buttons link to
 * /checkout/ without those tags, so the checkout used to lose them. This keeps
 * the tags from the visit that brought the person here (in this browser, for 30
 * days) and /checkout/ sends them with the signup, so each new member's email
 * says which ad, post or link they came from. Nothing is asked of the visitor.
 *
 * A visit counts when its link has utm_ tags or an ad click id (fbclid, gclid),
 * or it arrives from another site. Later visits with none of those (typing the
 * address, coming back from a bookmark) don't overwrite it. Kept: utm_ tags,
 * the click id type (not the id), the landing page path, the referring site's
 * host, and the date. No personal details.
 */
(function () {
  'use strict';
  var KEY = 'wd_source';
  var DAYS = 30;
  function read() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.at && Date.now() - s.at < DAYS * 86400000) return s;
    } catch (e) {}
    return null;
  }
  try {
    var q = new URLSearchParams(location.search);
    var utm = {};
    q.forEach(function (v, k) { if (/^utm_/.test(k) && v) utm[k] = String(v).slice(0, 100); });
    var click = q.get('fbclid') ? 'fbclid' : q.get('gclid') || q.get('gbraid') || q.get('wbraid') ? 'gclid' : q.get('ttclid') ? 'ttclid' : q.get('rdt_cid') ? 'rdt_cid' : '';
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    var external = ref && !/(^|\.)wedeepen\.com$/.test(ref) && ref !== location.hostname && !/(^|\.)stripe\.com$/.test(ref);
    // utm_content set by our own buttons (e.g. "drama-triangle") is not a new visit.
    var tagged = Object.keys(utm).some(function (k) { return k !== 'utm_content'; }) || !!click;
    if (tagged || external) {
      localStorage.setItem(KEY, JSON.stringify({ utm: utm, click: click, ref: external ? ref : '', landing: location.pathname.slice(0, 120), at: Date.now() }));
    }
  } catch (e) { /* private mode: nothing kept */ }
  // For /checkout/ (js/own-checkout.js): the tags of the visit that brought this person, merged under the
  // page's own utm_ tags (those win), plus where they landed and the referring site.
  window.wdSource = function (pageUtm) {
    var s = read() || {};
    var utm = {};
    var k;
    for (k in (s.utm || {})) utm[k] = s.utm[k];
    // The page's own tags win only when they are a real tagged arrival (an ad linking straight to /checkout/).
    // A lone utm_content comes from one of our own Join buttons and must not replace the ad's name.
    var pageTagged = Object.keys(pageUtm || {}).some(function (x) { return x !== 'utm_content'; });
    if (pageTagged || !s.utm || !Object.keys(s.utm).length) for (k in (pageUtm || {})) utm[k] = pageUtm[k];
    return { utm: utm, source: { click: s.click || '', ref: s.ref || '', landing: s.landing || '', at: s.at ? new Date(s.at).toISOString().slice(0, 10) : '' } };
  };
})();
