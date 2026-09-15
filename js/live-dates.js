/* Live dates from the Circle member calendar.
 *
 * Keeps the hand-typed dates on the homepage and /membership/ from going
 * stale. Any element with data-live="next-orientation" gets the next New
 * Member Orientation date; any element with data-live="mastermind-dates"
 * gets its children re-rendered with the next eight Love Mastermind dates
 * (the first child is used as the template). If the feed is unreachable
 * the markup is left exactly as authored.
 */
(function () {
  var SOURCES = [
    'https://oycfonjaufdihuwjecxu.supabase.co/functions/v1/circle-events',
    '/events/events.json'
  ];
  var orientationEls = document.querySelectorAll('[data-live="next-orientation"]');
  var dateGrids = document.querySelectorAll('[data-live="mastermind-dates"]');
  if (!orientationEls.length && !dateGrids.length) return;

  function localDate(ymd) { return new Date(ymd + 'T00:00:00'); }
  function fmt(d, opts) { return d.toLocaleDateString('en-US', opts); }

  function apply(data) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var events = (data.events || []).filter(function (e) {
      return e.date && localDate(e.end_date || e.date) >= today;
    }).sort(function (a, b) { return (a.starts_at_iso || a.date).localeCompare(b.starts_at_iso || b.date); });

    var orientation = events.filter(function (e) { return /orientation/i.test(e.title || ''); })[0];
    if (orientation) {
      var label = fmt(localDate(orientation.date), { weekday: 'long', month: 'long', day: 'numeric' });
      orientationEls.forEach(function (el) { el.textContent = label; });
    }

    var masterminds = events.filter(function (e) {
      return Array.isArray(e.topics) && e.topics.indexOf('Love Mastermind') !== -1;
    }).slice(0, 8);
    if (masterminds.length) {
      dateGrids.forEach(function (grid) {
        var tpl = grid.firstElementChild;
        if (!tpl) return;
        grid.innerHTML = '';
        masterminds.forEach(function (e) {
          var cell = tpl.cloneNode(true);
          var span = cell.querySelector('span') || cell;
          span.textContent = fmt(localDate(e.date), { month: 'long', day: 'numeric' });
          grid.appendChild(cell);
        });
      });
    }
  }

  (function load(i) {
    if (i >= SOURCES.length) return;
    fetch(SOURCES[i]).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(apply).catch(function () { load(i + 1); });
  })(0);
})();
