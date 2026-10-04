/* STUDIO SWITCH: the day/night switch plate on the footer strip of the table. Turning it flips the whole
   Studio (header table, footer, lamps, the dial beside it) and remembers the choice on this device; with
   no choice the Studio follows the clock (night from 7 pm to 6 am). */
(function () {
  'use strict';
  var sw = document.getElementById('dayNight');
  if (!sw) return;
  var foot = document.querySelector('.st-foot'), table = document.getElementById('table');
  // the dial's disc only ever turns clockwise: each flip adds half a turn
  var disc = document.getElementById('dialDisc'), turn = 0;
  function isNight() { return table ? table.classList.contains('night') : document.body.classList.contains('night'); }
  function show(n) {
    sw.classList.toggle('is-night', n);
    sw.setAttribute('aria-checked', n ? 'true' : 'false');
    sw.setAttribute('aria-label', n ? 'Night. Switch to day' : 'Day. Switch to night');
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
  if (disc) disc.style.transition = 'none';
  show(isNight());
  if (disc) { void disc.offsetWidth; disc.style.transition = ''; }
})();
