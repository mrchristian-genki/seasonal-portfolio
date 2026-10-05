/* STUDIO RIVER: the header's table is a short looping video of the glowing river, by day or by night, and
   blue or green. Flipping the day/night switch plays the dusk (or dawn) clip once, then hands over to the
   matching loop; the colour switch beside it does the same with the clip of the river changing colour.
   The colour is remembered on this device (blue unless chosen).
   Two video layers take turns so the hand-over never flashes; the day and night stills sit underneath,
   so the header is never empty while a video loads, and they stand in for it when video can't play or
   motion is reduced. */
(function () {
  'use strict';
  var R = document.getElementById('river'), T = document.getElementById('table');
  if (!R || !T) return;
  var A = 'table/a/';
  // the size this screen needs: the header's width in device pixels, rounded up to 1280, 1920 or 2560
  function size() {
    var need = (R.clientWidth || innerWidth) * (window.devicePixelRatio || 1);
    var save = navigator.connection && navigator.connection.saveData;
    return save || need <= 1400 ? 1280 : need <= 2100 ? 1920 : 2560;
  }
  var W = size();
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var night = T.classList.contains('night'), busy = null;

  function vid() {
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto';
    R.appendChild(v);
    return v;
  }
  var a = vid(), b = vid(), front = null;
  // the green clips came from 4K footage and have a 2560 size; the blue and colour-change ones top out at 1920
  function load(v, name, loop) {
    v.loop = loop;
    var w = /blue|green/.test(name) ? Math.min(W, 1920) : W, q = /blue|green/.test(name) ? '1' : '4';
    v.innerHTML = '<source src="' + A + name + '-' + w + '.mp4?v=' + q + '" type="video/mp4"><source src="' + A + name + '-1280.webm?v=' + q + '" type="video/webm">';
    v.load();
  }
  // Bring a layer to the front once it's really playing and fade it in over the other, which keeps playing
  // underneath for the whole fade (XF), so the two liquids blend instead of jumping. The layers swap by
  // z-index, not by moving them in the page, which could hitch a playing video.
  var XF = 1200, z = 1;
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
  function other() { return front === a ? b : a; }
  var blue = true;
  try { blue = localStorage.getItem('st-flow') !== 'green'; } catch (e) {}
  function stills(n) { R.classList.toggle('is-night', n); R.classList.toggle('is-blue', blue); }
  function loopName(n) { return blue ? (n ? 'river-blue-night' : 'river-blue-day') : (n ? 'river-night' : 'river-day'); }
  function loopFor(n) { var v = other(); load(v, loopName(n), true); return show(v); }

  function set(n) {
    if (n === night && front) return;
    var change = n !== night; night = n;
    if (calm || !started || !front) { stills(n); if (started && !calm) loopFor(n); return; }
    if (!change) { stills(n); loopFor(n); return; }
    // dusk or dawn: play the clip once, then the loop for the new time of day
    play((blue ? 'river-blue-' : 'river-') + (n ? 'to-night' : 'to-day'), 'light');
  }
  // the colour: the river changes in the clip for this time of day, then loops in its new colour
  function colour(b) {
    if (b === blue) return;
    blue = b;
    try { localStorage.setItem('st-flow', b ? 'blue' : 'green'); } catch (e) {}
    if (calm || !started || !front) { stills(night); if (started && !calm) loopFor(night); return; }
    play('river-' + (night ? 'night' : 'day') + '-to-' + (b ? 'blue' : 'green'), 'flow');
  }
  // A change clip: it fades in over the loop, the next loop is readied underneath, and it fades in over the
  // clip's last second and a bit, both playing. The switches wait until it's all done.
  // How far the change has got (0 to 1) goes out as a 'river:turn' event, so the valve that started it
  // turns in step with the river: the clip is most of the turn, the last fade the rest.
  function turn(kind, p) { document.dispatchEvent(new CustomEvent('river:turn', { detail: { kind: kind, p: p } })); }
  function play(clip, kind) {
    var n = night, token = {}; busy = token; lock(true);
    var t = other(); load(t, clip, false);
    var next = null, done = false, end = 0;
    (function tick() {
      if (busy !== token) return;
      var p = end ? 0.8 + 0.2 * Math.min(1, (performance.now() - end) / (XF + 400)) : t.duration ? 0.8 * Math.min(1, t.currentTime / Math.max(0.5, t.duration - XF / 1000 - 0.2)) : 0;
      turn(kind, Math.min(p, 0.999));
      requestAnimationFrame(tick);
    })();
    var finish = function () {
      if (done || busy !== token) return; done = true; end = performance.now();
      stills(n);
      var v = next || other(); if (!next) load(v, loopName(n), true);
      show(v).then(function () { setTimeout(function () { if (busy === token) { busy = null; lock(false); turn(kind, 1); } }, XF); });
    };
    t.addEventListener('timeupdate', function () { if (t.duration && t.duration - t.currentTime <= XF / 1000 + 0.2) finish(); });
    t.addEventListener('ended', finish, { once: true });
    t.addEventListener('error', finish, { once: true });
    show(t).then(function () {
      setTimeout(function () { if (busy === token && !done) { next = other(); load(next, loopName(n), true); } }, XF + 200);
      setTimeout(finish, 9000);                               // in case the clip never gets to its end
    });
  }
  var switches = ['dayNight', 'flow'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  function lock(on) { switches.forEach(function (s) { s.disabled = on; }); }

  // the colour switch, on the rock beside the day/night one
  var fl = document.getElementById('flow');
  function flowShow() {
    if (!fl) return;
    fl.classList.toggle('is-green', !blue);
    fl.setAttribute('aria-checked', blue ? 'false' : 'true');
    fl.setAttribute('aria-label', blue ? 'Blue river. Switch to green' : 'Green river. Switch to blue');
  }
  if (fl) fl.addEventListener('click', function () {
    fl.classList.remove('turning'); void fl.offsetWidth; fl.classList.add('turning');
    colour(!blue); flowShow();
  });
  flowShow();

  // Frame the river: the clips are the strip of the frame from 20% to 74% of its height. Show a window
  // centred on the river (47.5%) that never reaches below 62%, so the brass plaque near the bottom of the
  // footage is never half in view, at any screen size. The video and stills share the same placement.
  var F0 = 0.20, F1 = 0.74, LIMIT = 0.62, MID = 0.475, AR = 2560 / 790;
  function frame() {
    var w = R.clientWidth, h = R.clientHeight; if (!w || !h) return;
    var vw = Math.max(w, h * AR * (F1 - F0) / (LIMIT - F0)), vh = vw / AR;
    var v = h / vh * (F1 - F0);                                   // how much of the frame shows
    var c = Math.min(Math.max(MID, F0 + v / 2), LIMIT - v / 2);    // where its middle sits
    var top = -((c - v / 2) - F0) / (F1 - F0) * vh;
    // set on the header itself, so the switch panel can sit on a rock in the footage (see table.css)
    var H = R.parentNode.style;
    H.setProperty('--rv-w', vw + 'px'); H.setProperty('--rv-h', vh + 'px');
    H.setProperty('--rv-x', ((w - vw) / 2) + 'px'); H.setProperty('--rv-y', top + 'px');
  }
  frame(); addEventListener('resize', frame);

  stills(night);
  // the video waits until the page itself has loaded, so the Studio's own content comes first; the stills
  // show meanwhile. It pauses when the header is scrolled away or the tab is hidden.
  var started = false;
  function begin() { if (started || calm) return; started = true; if (!front) loopFor(night); }
  if (document.readyState === 'complete') setTimeout(begin, 300); else addEventListener('load', function () { setTimeout(begin, 300); });
  var seen = true;
  function wake() { if (front && front.loop) { if (seen && !document.hidden) { var p = front.play(); if (p && p.catch) p.catch(function () {}); } else front.pause(); } }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { seen = e[0].isIntersecting; wake(); }).observe(R);
  document.addEventListener('visibilitychange', wake);

  // follow the switch: StudioTable.night is what it calls
  var tab = window.StudioTable;
  if (tab && tab.night) {
    var orig = tab.night;
    tab.night = function (on) { orig(on); set(!!on); };
  }
})();
