/* STUDIO VALVES: the header's two handwheels, LIGHT (day or night) and FLOW (blue or green). Turning one
   turns the river: the wheel goes round in step with the change (river.js reports how far it has got),
   clockwise towards night or green and back the other way, and it can't be turned again until the change
   is done (the button is disabled meanwhile). Its tag says what it's set to, or what it's turning to. */
(function () {
  'use strict';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var valves = {};
  [].forEach.call(document.querySelectorAll('.valve'), function (b) {
    var v = { b: b, wheel: b.querySelector('.vw'), tag: b.querySelector('.vtag b'), angle: 0, from: 0, to: 0, goal: 0, live: false, timer: null };
    v.on = function () { return b.classList.contains(b.id === 'flow' ? 'is-green' : 'is-night'); };
    valves[b.getAttribute('data-kind')] = v;
    label(v, false);
    b.addEventListener('click', function () {
      // the switch's own handler (switch.js, river.js) has already flipped it; turn towards the new setting
      v.from = v.angle; v.to = v.angle + (v.on() ? 360 : -360); v.goal = v.from; v.live = false;
      b.classList.add('turning'); label(v, true); kick(v);
      clearTimeout(v.timer);
      // no change clip to follow (reduced motion, or the video isn't running): turn on our own
      v.timer = setTimeout(function () { if (!v.live) glide(v, calm ? 300 : 1100); }, 250);
    });
  });
  function label(v, moving) {
    var t = v.tag; if (!t) return;
    t.textContent = (moving ? '→ ' : '') + t.getAttribute(v.on() ? 'data-b' : 'data-a');
    v.b.classList.toggle('is-on', v.on());
  }
  function draw(v) { v.wheel.style.transform = 'rotate(' + v.angle.toFixed(2) + 'deg)'; }
  // ease towards the goal, so the wheel never jumps even if the reports come in steps
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
  // a heavy wheel: it starts slowly, as if it took some effort, and settles into place
  function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function progress(v, p) {
    v.goal = v.from + (v.to - v.from) * ease(p); kick(v);
    if (p >= 1) { v.b.classList.remove('turning'); label(v, false); }
  }
  document.addEventListener('river:turn', function (e) {
    var v = valves[e.detail.kind]; if (!v) return;
    v.live = true; progress(v, e.detail.p);
  });
})();
