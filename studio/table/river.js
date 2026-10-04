/* STUDIO RIVER: the header's table is a short looping video of the glowing river, by day or by night.
   Flipping the day/night switch plays the dusk (or dawn) clip once, then hands over to the matching loop.
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
  function load(v, name, loop) {
    v.loop = loop;
    v.innerHTML = '<source src="' + A + name + '-' + W + '.mp4?v=3" type="video/mp4"><source src="' + A + name + '-1280.webm?v=3" type="video/webm">';
    v.load();
  }
  // bring a layer to the front once it's really playing; the other fades out underneath
  function show(v) {
    return new Promise(function (ok) {
      var go = function () {
        v.removeEventListener('playing', go);
        v.classList.add('show'); R.appendChild(v);
        if (front && front !== v) { var old = front; setTimeout(function () { old.classList.remove('show'); old.pause(); }, 450); }
        front = v; ok();
      };
      v.addEventListener('playing', go);
      var p = v.play(); if (p && p.catch) p.catch(function () { v.removeEventListener('playing', go); ok(); });
    });
  }
  function other() { return front === a ? b : a; }
  function stills(n) { R.classList.toggle('is-night', n); }

  function loopFor(n) { var v = other(); load(v, n ? 'river-night' : 'river-day', true); return show(v); }

  function set(n) {
    if (n === night && front) return;
    var change = n !== night; night = n;
    if (calm) { stills(n); return; }
    if (!started) { stills(n); return; }
    if (!change || !front) { stills(n); loopFor(n); return; }
    // dusk or dawn: play the clip once, then the loop for the new time of day
    var token = {}; busy = token;
    var t = other(); load(t, n ? 'river-to-night' : 'river-to-day', false);
    var done = false, finish = function () {
      if (done || busy !== token) return; done = true;
      stills(n); loopFor(n);
    };
    t.addEventListener('ended', finish, { once: true });
    t.addEventListener('error', finish, { once: true });
    show(t).then(function () { setTimeout(finish, 8000); });   // in case 'ended' never comes
  }

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
