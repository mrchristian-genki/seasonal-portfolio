/* STUDIO SWITCH: the day/night switch plate on the footer strip of the table. Turning it flips the whole
   Studio (header table, footer, lamp jar) and remembers the choice on this device; with no choice the
   Studio follows the clock (night from 7 pm to 6 am). */
(function () {
  'use strict';
  var sw = document.getElementById('dayNight');
  if (!sw) return;
  var foot = document.querySelector('.st-foot'), table = document.getElementById('table');
  function isNight() { return table ? table.classList.contains('night') : document.body.classList.contains('night'); }
  function show(n) {
    sw.classList.toggle('is-night', n);
    sw.setAttribute('aria-checked', n ? 'true' : 'false');
    sw.setAttribute('aria-label', n ? 'Night. Switch to day' : 'Day. Switch to night');
    if (foot) foot.classList.toggle('night', n);
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
  show(isNight());
})();
