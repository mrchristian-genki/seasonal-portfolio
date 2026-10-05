/* STUDIO TOGGLES: the two controls on the STUDIO panel, LIGHTS (day or night) and LIQUID (blue or green).
   Each is a bat-handle toggle between two pilot lamps. A tap throws the toggle (switch.js and river.js do
   the work); while the river changes, the lamp it's going to breathes slowly and the slot under the toggle
   fills in step (river.js reports how far it has got), and only once it's done does the old lamp go out and
   the new one settle to a steady glow. Both wait (disabled) until the change is over. */
(function () {
  'use strict';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GLOW = 1200, ts = {};
  [].forEach.call(document.querySelectorAll('.tgl'), function (b) {
    var cls = b.id === 'flow' ? 'is-green' : 'is-night';
    var t = { b: b, la: b.querySelector('.la'), lb: b.querySelector('.lb'), g: 0, live: false, timer: null };
    t.on = function () { return b.classList.contains(cls); };
    ts[b.getAttribute('data-kind')] = t;
    t.g = t.on() ? 0 : 1; paint(t, 0);
    b.addEventListener('click', function () {
      // the switch's own handler has already flipped it
      paint(t, 0); b.classList.add('turning'); t.live = false;
      (t.on() ? t.lb : t.la).classList.add('go'); (t.on() ? t.la : t.lb).classList.remove('go');
      clearTimeout(t.timer);
      // no change clip to follow (reduced motion, or the video isn't running yet): a short fill of its own
      t.timer = setTimeout(function () { if (!t.live) glide(t, calm ? 300 : 1500); }, 250);
    });
  });
  function paint(t, p) {
    var s = t.b.style;
    s.setProperty('--a', t.g.toFixed(3)); s.setProperty('--b', (1 - t.g).toFixed(3)); s.setProperty('--p', p.toFixed(3));
    t.b.classList.toggle('on', t.on());
  }
  function glide(t, ms) {
    var t0 = performance.now();
    (function step(now) { var p = Math.min(1, (now - t0) / ms); progress(t, p); if (p < 1) requestAnimationFrame(step); })(t0);
  }
  function progress(t, p) {
    if (!t.b.classList.contains('turning')) return;
    t.b.style.setProperty('--p', p.toFixed(3));
    if (p >= 1) { t.b.classList.remove('turning'); settle(t); }
  }
  // done: the old lamp fades out as the new one comes up to a steady glow, and the slot empties
  function settle(t) {
    [t.la, t.lb].forEach(function (l) { l.classList.remove('go'); });
    var from = t.g, to = t.on() ? 0 : 1, t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / (calm ? 200 : GLOW)), e = p * p * (3 - 2 * p);
      t.g = from + (to - from) * e; paint(t, 1 - e);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  document.addEventListener('river:turn', function (e) {
    var t = ts[e.detail.kind]; if (!t) return;
    t.live = true; progress(t, e.detail.p);
  });
})();
