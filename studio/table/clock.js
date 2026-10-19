/* STUDIO CLOCK: the Studio follows the time of day the way Christian sets it by hand (Oct 19, 2026): blue
   liquid in the morning, green in the daytime, orange at night, and night from 7 pm to 6 am as before. Throwing
   either switch takes over by hand, remembered on this device, so any look can be tried; the HOME TIME plate
   beside them hands it back to the clock, its lamp lit while the clock is in charge. The changes are the
   switches' own, so every one eases through the river's real change clips.
   Loads before table.js and river.js, which ask it what to open on (StudioClock). */
(function () {
  'use strict';
  var KEY = 'st-clock';
  function following() { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } }
  function look(d) {
    var h = (d || new Date()).getHours();
    return h >= 19 || h < 6 ? { night: true, liquid: 'orange' } : h < 12 ? { night: false, liquid: 'blue' } : { night: false, liquid: 'green' };
  }
  window.StudioClock = { following: following, look: look };

  document.addEventListener('DOMContentLoaded', function () {
    var dn = document.getElementById('dayNight'), fl = document.getElementById('flow'), ctl = dn && dn.parentNode;
    if (!ctl || !fl) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tgl tg-home'; b.setAttribute('data-kind', 'home');
    b.innerHTML = '<span class="tg-row"><span class="lamp" aria-hidden="true"></span></span>' +
      '<span class="tg-bar" aria-hidden="true"><span></span></span><span class="tg-lbl" aria-hidden="true">HOME TIME</span>';
    ctl.appendChild(b);
    function mark() {
      var on = following();
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', on ? 'Following the clock: blue mornings, green days, orange nights'
        : 'Set by hand. Back to home time: follow the clock again');
      b.title = on ? 'Following the clock: blue mornings, green days, orange nights' : 'Back to home time';
    }
    // a throw by hand takes over; the clock's own throws (auto) don't
    var auto = false;
    function byHand() { if (auto) return; try { localStorage.setItem(KEY, '0'); } catch (e) {} mark(); }
    dn.addEventListener('click', byHand); fl.addEventListener('click', byHand);
    // One step at a time: the time of day first, then the liquid, each waiting until the river has finished the
    // last change (the switches are disabled while it runs).
    var table = document.getElementById('table'), wait = null;
    function apply() {
      clearTimeout(wait);
      if (!following()) return;
      if (dn.disabled) { wait = setTimeout(apply, 500); return; }
      var L = look(), night = table ? table.classList.contains('night') : document.body.classList.contains('night');
      var R = window.StudioRiver, sw = L.night !== night ? dn : R && R.liquid() !== L.liquid ? fl : null;
      if (!sw) return;
      auto = true; sw.click(); auto = false;
      wait = setTimeout(apply, 700);
    }
    b.addEventListener('click', function () {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      mark(); apply();
    });
    mark();
    // the hours turn over while the Studio is open, or while it waited in a hidden tab
    setInterval(apply, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });
  });
})();
