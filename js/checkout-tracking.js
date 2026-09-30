/**
 * WeDeepen checkout tracking: one GA4 `begin_checkout` event per click on a
 * link that leaves the site to pay or book.
 *
 * Sales happen off-site (Circle, TicketSpice, Eventbrite, Acuity), so GA4
 * never sees a purchase. This click is the last thing we can measure, and it
 * is what gets marked as a key event in GA4 and imported into Google Ads.
 *
 * GA4 only. Pages that fire Meta/Reddit events on these clicks keep their own
 * inline handlers, so this script does not touch fbq or rdt.
 * Capture phase so it still fires if another handler stops the event.
 * Loaded right after the Google tag on every page.
 */
(function () {
  'use strict';

  // First match wins. `type` becomes the checkout_type param in GA4.
  var DESTINATIONS = [
    { type: 'membership', test: function (u) { return u.hostname === 'circle.wedeepen.com' && u.pathname.indexOf('/checkout/') === 0; } },
    { type: 'event', test: function (u) { return /(^|\.)ticketspice\.com$/.test(u.hostname) || /(^|\.)eventbrite\.com$/.test(u.hostname); } },
    { type: 'booking', test: function (u) { return /(^|\.)acuityscheduling\.com$/.test(u.hostname); } }
  ];

  document.addEventListener('click', function (e) {
    if (typeof window.gtag !== 'function') return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;

    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }

    for (var i = 0; i < DESTINATIONS.length; i++) {
      if (DESTINATIONS[i].test(url)) {
        window.gtag('event', 'begin_checkout', {
          checkout_type: DESTINATIONS[i].type,
          checkout_url: (url.hostname + url.pathname).slice(0, 100),
          link_text: (a.textContent || '').trim().slice(0, 40),
          cta_position: a.getAttribute('data-cta') || (a.closest('#wd-header, #mobile-nav') ? 'header' : 'body')
        });
        return;
      }
    }
  }, true);
})();
