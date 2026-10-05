/* THE HEART: the brass heart over the five steps, alive. It loops in the river's liquid; when CHANGE LIQUID is
   thrown it plays that change once (blue to green, green to orange, orange to blue), then settles into the new
   liquid's loop. The still pictures under it (one per liquid, swapped by table.css) stand in until a clip is
   playing, and stay with reduced motion and on Save-Data. */
(function () {
  'use strict';
  var H = document.querySelector('.about-studio .heart');
  if (!H || !window.StudioRiver) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (navigator.connection && navigator.connection.saveData) return;
  var A = 'table/a/', W = (H.clientWidth || 700) * (window.devicePixelRatio || 1) > 1100 ? 1600 : 1024;
  var CHANGE = { blue: 'heart-blue-to-green', green: 'heart-green-to-orange', orange: 'heart-orange-to-blue' };
  function vid() {
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto';
    H.appendChild(v); return v;
  }
  var a = vid(), b = vid(), front = null, z = 1, seen = true, token = 0;
  function play(v, name, loop, fade) {
    var t = ++token;
    v.loop = loop; v.src = A + name + '-' + W + '.mp4?v=1';
    v.style.transitionDuration = fade + 'ms';
    var go = function () {
      v.removeEventListener('playing', go);
      if (t !== token) return;
      v.style.zIndex = ++z; v.classList.add('show');
      var old = front; front = v;
      if (old && old !== v) setTimeout(function () { if (front !== old) { old.classList.remove('show'); old.pause(); } }, fade + 100);
    };
    v.addEventListener('playing', go);
    var p = v.play(); if (p && p.catch) p.catch(function () {});
    return v;
  }
  function other() { return front === a ? b : a; }
  function settle(liq, fade) { play(other(), 'heart-' + liq, true, fade); }
  settle(StudioRiver.liquid(), 900);
  document.addEventListener('river:change', function (e) {
    var d = e.detail || {};
    if (d.kind !== 'flow') return;
    var clip = CHANGE[d.from], to = d.liquid;
    if (!clip) { settle(to, 2200); return; }
    var v = play(other(), clip, false, 600);
    v.onended = function () { v.onended = null; settle(to, 500); };
  });
  // only while it's on screen and the page is showing
  function wake() { if (front) { if (seen && !document.hidden) { var p = front.play(); if (p && p.catch) p.catch(function () {}); } else front.pause(); } }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; wake(); }).observe(H);
  document.addEventListener('visibilitychange', wake);
})();
