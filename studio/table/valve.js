/* STUDIO VALVES: the header's two bypass valves, LIGHT (day or night) and FLOW (blue or green). Throwing a
   lever turns the river: it swings across in step with the change (river.js reports how far it has got),
   from pointing at one setting to pointing at the other, starting heavy and settling at the end, and it
   can't be thrown again until the change is done (the button is disabled meanwhile). */
(function () {
  'use strict';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SWING = 68;                                  // degrees either side of upright
  var valves = {};
  [].forEach.call(document.querySelectorAll('.valve'), function (b) {
    var v = { b: b, lever: b.querySelector('.lever'), angle: 0, from: 0, to: 0, goal: 0, live: false, timer: null };
    v.on = function () { return b.classList.contains(b.id === 'flow' ? 'is-green' : 'is-night'); };
    valves[b.getAttribute('data-kind')] = v;
    v.angle = v.goal = v.on() ? SWING : -SWING; draw(v); mark(v);
    b.addEventListener('click', function () {
      // the switch's own handler (switch.js, river.js) has already flipped it; swing towards the new setting
      v.from = v.angle; v.to = v.on() ? SWING : -SWING; v.live = false;
      b.classList.add('turning'); mark(v);
      clearTimeout(v.timer);
      // no change clip to follow (reduced motion, or the video isn't running): swing on its own
      v.timer = setTimeout(function () { if (!v.live) glide(v, calm ? 300 : 1100); }, 250);
    });
  });
  // the setting it's set to (or heading for) lights; switch.js keeps is-night in step for LIGHT
  function mark(v) {
    v.b.classList.toggle('is-on', v.on());
    var a = v.b.querySelector('.vside.a'), z = v.b.querySelector('.vside.b');
    a.classList.toggle('going', !v.on()); z.classList.toggle('going', v.on());
  }
  function draw(v) { v.lever.style.transform = 'rotate(' + v.angle.toFixed(2) + 'deg)'; }
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
