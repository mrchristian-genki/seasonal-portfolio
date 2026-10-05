/* STUDIO FOOT: the footer is a glowing pipe set into the crack between two planks, the river's liquid
   flowing through it right to left, by day or night and blue, green or orange like the header. It follows the
   header (river.js tells it each change): the change plays as a clip (dusk, dawn, or the liquid changing
   colour), then hands over to the loop for the new setting, the two crossfading while both play. Stills
   stand in until it's seen, when it's off screen, and with reduced motion; the video only loads once the
   footer comes near the screen. */
(function () {
  'use strict';
  var F = document.querySelector('.st-foot'), P = document.getElementById('footFlow');
  if (!F || !P) return;
  var A = 'table/a/', XF = 1200, z = 1;
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var river = window.StudioRiver;
  var night = river ? river.night() : F.classList.contains('night'), liq = river ? river.liquid() : 'blue';
  function W() { var need = (P.clientWidth || innerWidth) * (window.devicePixelRatio || 1); return (navigator.connection && navigator.connection.saveData) || need <= 1400 ? 1280 : 1920; }
  function stills() { P.classList.toggle('is-night', night); ['blue', 'green', 'orange'].forEach(function (l) { P.classList.toggle('is-' + l, liq === l); }); }
  function name() { return 'foot-' + liq + '-' + (night ? 'night' : 'day'); }
  // the change to each liquid from the one before it (the way the switch goes round)
  var CHANGE = { green: '-to-green', orange: '-green-to-orange', blue: '-orange-to-blue' }, BEFORE = { green: 'blue', orange: 'green', blue: 'orange' };
  function vid() {
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto';
    P.appendChild(v); return v;
  }
  var a = null, b = null, front = null, started = false, seen = false, token = null, stale = false;
  function other() { return front === a ? b : a; }
  function load(v, n, loop) {
    v.loop = loop;
    v.innerHTML = '<source src="' + A + n + '-' + W() + '.mp4?v=1" type="video/mp4"><source src="' + A + n + '-1280.webm?v=1" type="video/webm">';
    v.load();
  }
  function show(v) {
    return new Promise(function (ok) {
      var go = function () {
        v.removeEventListener('playing', go);
        v.style.zIndex = ++z; v.classList.add('show');
        if (front && front !== v) { var old = front; setTimeout(function () { if (front !== old) { old.classList.remove('show'); old.pause(); } }, XF + 100); }
        front = v; ok();
      };
      v.addEventListener('playing', go);
      var p = v.play(); if (p && p.catch) p.catch(function () { v.removeEventListener('playing', go); ok(); });
    });
  }
  function loop() { var v = other(); load(v, name(), true); return show(v); }
  // a change clip, then the new loop fading in over its last second and a bit
  function play(clip) {
    var t = other(), my = {}, done = false, next = null; token = my;
    load(t, clip, false);
    var finish = function () {
      if (done || token !== my) return; done = true;
      stills(); var v = next || other(); if (!next) load(v, name(), true); show(v);
    };
    t.addEventListener('timeupdate', function () { if (t.duration && t.duration - t.currentTime <= XF / 1000 + 0.2) finish(); });
    t.addEventListener('ended', finish, { once: true });
    t.addEventListener('error', finish, { once: true });
    show(t).then(function () {
      setTimeout(function () { if (token === my && !done) { next = other(); load(next, name(), true); } }, XF + 200);
      setTimeout(finish, 11000);
    });
  }
  document.addEventListener('river:change', function (e) {
    var d = e.detail, from = d.from || liq;
    night = d.night; liq = d.liquid;
    if (!started || !seen || !front) { stills(); stale = started; if (started && seen) { stale = false; loop(); } return; }
    if (d.kind !== 'light' && BEFORE[liq] !== from) { stills(); loop(); return; }   // not the next one: a blend
    play(d.kind === 'light'
      ? 'foot-' + from + '-to-' + (night ? 'night' : 'day')
      : 'foot-' + (night ? 'night' : 'day') + CHANGE[liq]);
  });
  stills();
  // start when the footer first comes near the screen (after the page has loaded); pause it when it's away
  function begin() {
    if (started || calm) return; started = true; a = vid(); b = vid(); loop();
  }
  function wake() {
    if (!front) return;
    if (seen && !document.hidden) { var p = front.play(); if (p && p.catch) p.catch(function () {}); } else front.pause();
  }
  var loaded = document.readyState === 'complete';
  if (!loaded) addEventListener('load', function () { loaded = true; if (seen) begin(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) {
    seen = e[0].isIntersecting;
    if (seen && loaded) { if (!started) begin(); else if (stale) { stale = false; loop(); } else wake(); }
    else wake();
  }, { rootMargin: '200px 0px' }).observe(F);
  document.addEventListener('visibilitychange', wake);
})();
