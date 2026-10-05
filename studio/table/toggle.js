/* STUDIO TOGGLES: the two controls on the STUDIO panel: DAY/NIGHT, a toggle between two pilot lamps (amber
   for day, blue for night), and CHANGE LIQUID, a toggle by three (blue, green, orange; each throw moves on to
   the next). A tap throws the toggle (switch.js and river.js do the work); while the river changes, the lamp
   it's going to breathes slowly and the slot under the toggle fills in step (river.js reports how far it has
   got), and only once it's done does the old lamp go out and the new one settle to a steady glow. Both wait
   (disabled) until the change is over. */
(function () {
  'use strict';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GLOW = 1200, ts = {};
  var COL = { light: ['255,176,70', '110,170,255'], flow: ['60,228,255', '125,255,74', '255,150,50'] };
  var LIQ = ['blue', 'green', 'orange'];
  [].forEach.call(document.querySelectorAll('.tgl'), function (b) {
    var kind = b.getAttribute('data-kind');
    var t = { b: b, kind: kind, lamps: [].slice.call(b.querySelectorAll('.lamp')), live: false, timer: null, throws: 0 };
    t.at = function () {
      if (kind === 'flow') return Math.max(0, LIQ.indexOf(window.StudioRiver ? StudioRiver.liquid() : 'blue'));
      return b.classList.contains('is-night') ? 1 : 0;
    };
    t.lit = t.lamps.map(function (l, i) { return i === t.at() ? 1 : 0; });
    ts[kind] = t; paint(t, 0); bat(t);
    b.addEventListener('click', function () {
      // the switch's own handler has already moved it on
      t.throws++; bat(t);
      var to = t.at(), from = t.lit.indexOf(Math.max.apply(null, t.lit));
      b.style.setProperty('--cf', COL[kind][from]); b.style.setProperty('--ct', COL[kind][to]);
      paint(t, 0); b.classList.add('turning'); t.live = false;
      t.lamps.forEach(function (l, i) { l.classList.toggle('go', i === to); });
      clearTimeout(t.timer);
      // no change clip to follow (reduced motion, or the video isn't running yet): a short fill of its own
      t.timer = setTimeout(function () { if (!t.live) glide(t, calm ? 300 : 1500); }, 250);
    });
  });
  // the bat handle: day/night points at its setting; the liquid one flips side at each throw
  function bat(t) { t.b.classList.toggle('on', t.kind === 'flow' ? t.throws % 2 === 1 : t.at() === 1); }
  function paint(t, p) {
    t.lamps.forEach(function (l, i) { l.style.setProperty('--lit', t.lit[i].toFixed(3)); });
    t.b.style.setProperty('--p', p.toFixed(3));
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
    t.lamps.forEach(function (l) { l.classList.remove('go'); });
    if (t.kind === 'flow') ring(true);
    var from = t.lit.slice(), to = t.at(), t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / (calm ? 200 : GLOW)), e = p * p * (3 - 2 * p);
      t.lit = from.map(function (v, i) { return v + ((i === to ? 1 : 0) - v) * e; }); paint(t, 1 - e);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  // the dial's ring takes the liquid's colour
  // and so does the whole page (table.css): the rails' rivets fill with it, the login plate catches its light
  function ring(fill) {
    if (!ts.flow) return;
    var c = COL.flow[ts.flow.at()], p = document.querySelector('.st-dn'), root = document.documentElement, v = c.split(',');
    if (p) p.style.setProperty('--liq', c);
    if (!fill) root.style.transition = 'none';             // on opening, straight to it
    root.style.setProperty('--lr', v[0]); root.style.setProperty('--lg', v[1]); root.style.setProperty('--lb', v[2]);
    if (!fill) { void root.offsetWidth; root.style.transition = ''; }
    if (fill && !calm) { root.classList.remove('liq-fill'); void root.offsetWidth; root.classList.add('liq-fill'); }
  }
  ring();
  document.addEventListener('river:turn', function (e) {
    var t = ts[e.detail.kind]; if (!t) return;
    t.live = true; progress(t, e.detail.p);
  });
})();
