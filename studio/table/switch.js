/* STUDIO SWITCH: the day/night switch plate (and a tap on the footer's lamps). Turning it flips the whole
   Studio (header table, footer, lamps, the dial beside it) and remembers the choice on this device; with
   no choice the Studio follows the clock (night from 7 pm to 6 am). */
(function () {
  'use strict';
  var sw = document.getElementById('dayNight');
  if (!sw) return;
  var foot = document.querySelector('.st-foot'), table = document.getElementById('table');
  var lamps = document.getElementById('lamps');            // the footer's lamps flip it too
  // the dial's disc only ever turns clockwise: each flip adds half a turn
  var disc = document.getElementById('dialDisc'), turn = 0;
  function isNight() { return table ? table.classList.contains('night') : document.body.classList.contains('night'); }
  function show(n) {
    sw.classList.toggle('is-night', n);
    sw.setAttribute('aria-checked', n ? 'true' : 'false');
    sw.setAttribute('aria-label', n ? 'Night. Switch to day' : 'Day. Switch to night');
    if (lamps) lamps.setAttribute('aria-label', n ? 'Night. Switch to day' : 'Day. Switch to night');
    if (foot) foot.classList.toggle('night', n);
    if (disc) {
      if (turn % 360 !== (n ? 180 : 0)) turn += 180;
      disc.style.setProperty('--turn', turn + 'deg');
    }
  }
  function set(n) {
    if (window.StudioTable) StudioTable.night(n); else if (table) table.classList.toggle('night', n);
    try { localStorage.setItem('st-night', n ? '1' : '0'); } catch (e) {}
    show(n);
  }
  sw.addEventListener('click', function () {
    sw.classList.remove('turning'); void sw.offsetWidth; sw.classList.add('turning');
    set(!isNight());
  });
  if (lamps) lamps.addEventListener('click', function () { sw.click(); });

  // The address keeps up: the time of day and the river's colour at the end (day-blue, night-green…),
  // after the Studio's own view once logged in (#notes/night-blue, #note/<id>/day-green, #new/day-blue).
  // Flipping either rewrites the address in place; a change of view (studio.js, through StudioHash) adds a
  // step, so Back and Forward walk the views. Opening an address with a hash restores all three (the time
  // of day and colour only on opening). A bare #…/day or #…/night still works.
  var view = '', onview = null, river = window.StudioRiver;
  function parse() {
    var parts = decodeURIComponent(location.hash.slice(1)).split('/'), mode = null, colour = null;
    var m = /^(day|night)(?:-(blue|green))?$/.exec(parts[parts.length - 1]);
    if (m) { parts.pop(); mode = m[1]; colour = m[2] || null; }
    return { view: parts.join('/'), mode: mode, colour: colour };
  }
  function address() {
    return location.pathname + '#' + (view ? view + '/' : '') + (isNight() ? 'night' : 'day') +
      (river ? (river.blue() ? '-blue' : '-green') : '');
  }
  function write(push) {
    var to = address();
    if (location.pathname + location.search + location.hash === to) return;
    history[push ? 'pushState' : 'replaceState'](null, '', to);
  }
  var first = parse();
  view = first.view;
  if (first.mode && (first.mode === 'night') !== isNight()) set(first.mode === 'night');
  if (first.colour && river && (first.colour === 'blue') !== river.blue()) river.colour(first.colour === 'blue');
  sw.addEventListener('click', function () { write(false); });
  var fl = document.getElementById('flow');
  if (fl) fl.addEventListener('click', function () { write(false); });
  // Back and Forward change the view only: the time of day stays as it is, and the address follows it
  addEventListener('popstate', function () {
    var h = parse(), moved = h.view !== view;
    view = h.view; write(false);                         // first, so the view's own update adds no step
    if (moved && onview) onview(view);
  });
  window.StudioHash = {
    view: function () { return view; },
    go: function (v, replace) { view = v; write(!replace); },
    onview: function (fn) { onview = fn; }
  };
  if (!document.getElementById('app')) write(false);    // the login page: just the time of day
  if (disc) disc.style.transition = 'none';
  show(isNight());
  if (disc) { void disc.offsetWidth; disc.style.transition = ''; }
})();
