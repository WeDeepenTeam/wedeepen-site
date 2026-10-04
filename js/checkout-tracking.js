/**
 * WeDeepen checkout tracking: one GA4 `begin_checkout` and one Meta
 * `InitiateCheckout` per click on a link that leaves the site to pay or book.
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
  // blog, episode, faculty and retreat visitors too. Pages that load these
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
  // `value` is sent only where the price is fixed.
  var DESTINATIONS = [
    { type: 'membership', value: 99, test: function (u) { return u.hostname === 'circle.wedeepen.com' && u.pathname.indexOf('/checkout/wedeepen-club-membership') === 0; } },
    { type: 'membership', test: function (u) { return u.hostname === 'circle.wedeepen.com' && u.pathname.indexOf('/checkout/') === 0; } },
    { type: 'event', test: function (u) { return /(^|\.)ticketspice\.com$/.test(u.hostname) || /(^|\.)eventbrite\.com$/.test(u.hostname); } },
    { type: 'booking', test: function (u) { return /(^|\.)acuityscheduling\.com$/.test(u.hostname); } }
  ];

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;

    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }

    for (var i = 0; i < DESTINATIONS.length; i++) {
      var d = DESTINATIONS[i];
      if (!d.test(url)) continue;

      var position = a.getAttribute('data-cta') || (a.closest('#wd-header, #mobile-nav') ? 'header' : 'body');
      var checkoutUrl = (url.hostname + url.pathname).slice(0, 100);

      if (typeof window.gtag === 'function') {
        window.gtag('event', 'begin_checkout', {
          checkout_type: d.type,
          checkout_url: checkoutUrl,
          link_text: (a.textContent || '').trim().slice(0, 40),
          cta_position: position
        });
      }

      if (typeof window.fbq === 'function') {
        var fbParams = { content_category: d.type, content_name: checkoutUrl };
        if (d.value) { fbParams.value = d.value; fbParams.currency = 'USD'; }
        window.fbq('track', 'InitiateCheckout', fbParams);
      }

      if (OWN_RDT) window.rdt('track', 'AddToCart');
      return;
    }
  }, true);
})();
