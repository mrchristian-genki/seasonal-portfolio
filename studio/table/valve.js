/* STUDIO VALVES: the header's two valves, LIGHT (day or night) and FLOW (blue or green). Each has two glass
   windows; the lever rests over the one for the setting that's off, and the uncovered one glows (LIGHT:
   amber for day, blue for night; FLOW: blue, green). Throwing the lever turns the river: it swings across
   in step with the change (river.js reports how far it has got), heavy at first and settling at the end,
   while the lit window dims under it and the other lights up; it can't be thrown again until the change is
   done (the button is disabled meanwhile). */
(function () {
  'use strict';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SWING = 47;                                  // the windows sit 47° either side of upright
  var valves = {};
  [].forEach.call(document.querySelectorAll('.valve'), function (b) {
    var lt = b.querySelector('.light');
    var v = { b: b, lever: b.querySelector('.lever'), ga: b.querySelector('.ga'), gb: b.querySelector('.gb'),
      light: lt, la: lt && lt.querySelector('.ca'), lb: lt && lt.querySelector('.cb'),
      angle: 0, from: 0, to: 0, goal: 0, live: false, timer: null };
    v.on = function () { return b.classList.contains(b.id === 'flow' ? 'is-green' : 'is-night'); };
    valves[b.getAttribute('data-kind')] = v;
    // on the first setting (day, blue) the lever covers the right window and the left one glows
    v.angle = v.goal = v.on() ? -SWING : SWING; draw(v);
    b.addEventListener('click', function () {
      // the switch's own handler (switch.js, river.js) has already flipped it; swing towards the new setting
      v.from = v.angle; v.to = v.on() ? -SWING : SWING; v.live = false;
      b.classList.add('turning');
      clearTimeout(v.timer);
      // no change clip to follow (reduced motion, or the video isn't running): swing on its own
      v.timer = setTimeout(function () { if (!v.live) glide(v, calm ? 300 : 1100); }, 250);
    });
  });
  // the lever, and the windows lit by how far it is from each: fully over a window puts it out
  function draw(v) {
    v.lever.style.transform = 'rotate(' + v.angle.toFixed(2) + 'deg)';
    var t = (v.angle + SWING) / (2 * SWING);       // 0: over the left window, 1: over the right one
    v.ga.style.opacity = Math.max(0, Math.min(1, t)).toFixed(3);
    v.gb.style.opacity = Math.max(0, Math.min(1, 1 - t)).toFixed(3);
    // the light beside it: out as the lever crosses the middle, then back in the new colour, flickering
    // while it's being thrown
    if (v.light) {
      var flick = v.b.classList.contains('turning') && !calm ? 0.7 + 0.3 * Math.random() : 1;
      var a = Math.max(0, Math.min(1, (t - 0.5) * 2.5)), z = Math.max(0, Math.min(1, (0.5 - t) * 2.5));
      v.la.style.opacity = (a * flick).toFixed(3); v.lb.style.opacity = (z * flick).toFixed(3);
      v.light.style.setProperty('--lit', (Math.max(a, z) * flick).toFixed(3));
    }
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
    if (p >= 1) v.b.classList.remove('turning');
  }
  document.addEventListener('river:turn', function (e) {
    var v = valves[e.detail.kind]; if (!v) return;
    v.live = true; progress(v, e.detail.p);
  });
})();
