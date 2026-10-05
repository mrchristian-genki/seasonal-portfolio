/* STUDIO VALVES: the two valves, LIGHT (day or night) and FLOW (blue or green), in the header and again
   in the footer (copies, with data-for naming the header one: throwing a copy throws the header valve, and
   both swing together). Each has two glass
   windows; the lever rests over the one for the setting that's off, and the uncovered one glows (LIGHT:
   amber for day, blue for night; FLOW: blue, green). Throwing the lever turns the river: it swings across
   in step with the change (river.js reports how far it has got), heavy at first and settling at the end;
   the glows (the windows and the pool of light around the valve) keep the old setting's
   colour all the way, and only once the lever has settled do they fade
   over to the new one. It can't be thrown again until the change is done (the button is disabled). */
(function () {
  'use strict';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SWING = 47;                                  // the windows sit 47° either side of upright
  var valves = { light: [], flow: [] };
  // the glow colours: a for day or blue, b for night or green (rgba)
  var COL = {
    light: { vg: [[255, 170, 60, .75], [90, 160, 255, .8]] },
    flow: { vg: [[60, 228, 255, .7], [125, 255, 74, .7]] }
  };
  var GLOW = 1400;                                 // how long the glow takes to cross over at the end
  function mix(c, g) {
    var x = c[0], y = c[1], m = function (i) { return x[i] * g + y[i] * (1 - g); };
    return 'rgba(' + Math.round(m(0)) + ',' + Math.round(m(1)) + ',' + Math.round(m(2)) + ',' + m(3).toFixed(3) + ')';
  }
  [].forEach.call(document.querySelectorAll('.valve'), function (b) {
    var id = b.getAttribute('data-for') || b.id, main = document.getElementById(id);
    if (!main) return;
    var cls = id === 'flow' ? 'is-green' : 'is-night';
    var v = { b: b, lever: b.querySelector('.lever'), ga: b.querySelector('.ga'), gb: b.querySelector('.gb'),
      kind: b.getAttribute('data-kind'), g: 1, angle: 0, from: 0, to: 0, goal: 0, live: false, timer: null };
    v.on = function () { return main.classList.contains(cls); };
    // a copy wears the header valve's setting and name
    function mirror() { if (b !== main) { b.classList.toggle(cls, v.on()); b.setAttribute('aria-checked', main.getAttribute('aria-checked')); b.setAttribute('aria-label', main.getAttribute('aria-label')); } }
    valves[b.getAttribute('data-kind')].push(v);
    mirror();
    // on the first setting (day, blue) the lever covers the right window and the left one glows
    v.angle = v.goal = v.on() ? -SWING : SWING; v.g = v.on() ? 0 : 1; draw(v);
    if (b !== main) b.addEventListener('click', function () { main.click(); });
    main.addEventListener('click', function () {
      // the switch's own handler (switch.js, river.js) has already flipped it; swing towards the new setting
      mirror();
      v.from = v.angle; v.to = v.on() ? -SWING : SWING; v.live = false;
      b.classList.add('turning');
      clearTimeout(v.timer);
      // no change clip to follow (reduced motion, or the video isn't running): swing on its own
      v.timer = setTimeout(function () { if (!v.live) glide(v, calm ? 300 : 1100); }, 250);
    });
  });
  // the lever, and the glows by v.g (1: the first setting's, 0: the second's), which only moves at the end
  function draw(v) {
    v.lever.style.transform = 'rotate(' + v.angle.toFixed(2) + 'deg)';
    v.ga.style.opacity = v.g.toFixed(3);
    v.gb.style.opacity = (1 - v.g).toFixed(3);
    var c = COL[v.kind];
    v.b.style.setProperty('--vg', mix(c.vg, v.g));
  }
  // once the lever has settled, the glow crosses over to the new setting, slowly
  function settle(v) {
    var from = v.g, to = v.on() ? 0 : 1, t0 = performance.now();
    if (from === to) { draw(v); return; }
    (function step(now) {
      var p = Math.min(1, (now - t0) / (calm ? 300 : GLOW)), e = p * p * (3 - 2 * p);
      v.g = from + (to - from) * e; draw(v);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  // ease towards the goal, so the lever never jumps even if the reports come in steps
  function kick(v) {
    if (v.raf) return;
    (function step() {
      var d = v.goal - v.angle;
      v.angle += Math.abs(d) < 0.05 ? d : d * 0.12; draw(v);
      v.raf = Math.abs(v.goal - v.angle) > 0.05 ? requestAnimationFrame(step) : null;
    })();
  }
  function glide(v, ms) {
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / ms); progress(v, p);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  // a stiff lever: it starts slowly, as if it took some effort, and settles into place
  function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function progress(v, p) {
    v.goal = v.from + (v.to - v.from) * ease(p); kick(v);
    if (p >= 1 && v.b.classList.contains('turning')) { v.b.classList.remove('turning'); settle(v); }
  }
  document.addEventListener('river:turn', function (e) {
    (valves[e.detail.kind] || []).forEach(function (v) { v.live = true; progress(v, e.detail.p); });
  });
})();
