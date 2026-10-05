/* STUDIO RIVER: the header's table is a short looping video of the glowing river, by day or by night, and
   blue, green or orange. Flipping the day/night switch plays the dusk (or dawn) clip once, then hands over
   to the matching loop; the liquid switch beside it does the same with the clip of the river changing to
   the next liquid, always the same way round (blue, green, orange, blue). The liquid is remembered on this
   device (blue unless chosen).
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
  // the green clips came from 4K footage and have a 2560 size; the blue, orange and change ones top out at 1920
  function load(v, name, loop) {
    v.loop = loop;
    var cap = /blue|green|orange/.test(name), w = cap ? Math.min(W, 1920) : W, q = /orange/.test(name) ? '1' : cap ? '3' : '5';
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
  // the liquids, in the order the switch goes round, and each one's clips: its loops and dusk and dawn
  // (green's are the river's first, so have no colour in their names), and the change to the next one
  var LIQ = ['blue', 'green', 'orange'], PRE = { blue: 'river-blue-', green: 'river-', orange: 'river-orange-' };
  var CHANGE = { blue: function (t) { return 'river-' + t + '-to-green'; },
    green: null, orange: null };            // no footage yet for green to orange or orange to blue: a plain blend
  var liq = 'blue';
  try { var kept = localStorage.getItem('st-flow'); if (LIQ.indexOf(kept) >= 0) liq = kept; } catch (e) {}
  function stills(n) { R.classList.toggle('is-night', n); LIQ.forEach(function (l) { R.classList.toggle('is-' + l, liq === l); }); }
  function loopName(n) { return PRE[liq] + (n ? 'night' : 'day'); }
  function loopFor(n) { var v = other(); load(v, loopName(n), true); return show(v); }

  // the footer's pipe (foot.js) follows every change
  function tell(kind, from) { document.dispatchEvent(new CustomEvent('river:change', { detail: { kind: kind, night: night, liquid: liq, from: from } })); }
  function set(n) {
    if (n === night && front) return;
    var change = n !== night; night = n;
    if (change) tell('light', liq);
    if (calm || !started || !front) { stills(n); if (started && !calm) loopFor(n); return; }
    if (!change) { stills(n); loopFor(n); return; }
    // dusk or dawn: play the clip once, then the loop for the new time of day
    play(PRE[liq] + (n ? 'to-night' : 'to-day'), 'light');
  }
  // the liquid: the river changes in the clip for this time of day, then loops in its new colour
  function colour(l) {
    if (l === liq || LIQ.indexOf(l) < 0) return;
    var was = liq; liq = l; tell('flow', was);
    try { localStorage.setItem('st-flow', l); } catch (e) {}
    if (calm || !started || !front) { stills(night); if (started && !calm) loopFor(night); return; }
    var c = CHANGE[was];
    play(c && LIQ[(LIQ.indexOf(was) + 1) % 3] === l ? c(night ? 'night' : 'day') : null, 'flow');
  }
  // A change clip: it fades in over the loop, the next loop is readied underneath, and it fades in over the
  // clip's last second and a bit, both playing. The switches wait until it's all done.
  // How far the change has got (0 to 1) goes out as a 'river:turn' event, so the toggle that started it
  // turns in step with the river: the clip is most of the turn, the last fade the rest.
  function turn(kind, p) { document.dispatchEvent(new CustomEvent('river:turn', { detail: { kind: kind, p: p } })); }
  function play(clip, kind) {
    var n = night, token = {}; busy = token; lock(true);
    if (!clip) {                                    // no clip for this change: the new loop blends in over the old
      var t0 = performance.now(), BL = 2600;
      stills(n); loopFor(n);
      (function step() {
        if (busy !== token) return;
        var p = Math.min(1, (performance.now() - t0) / BL);
        if (p < 1) { turn(kind, Math.min(p, .999)); requestAnimationFrame(step); } else { busy = null; lock(false); turn(kind, 1); }
      })();
      return;
    }
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
  var switches = [].slice.call(document.querySelectorAll('#dayNight, #flow'));
  function lock(on) { switches.forEach(function (s) { s.disabled = on; }); }

  // the liquid switch: each throw moves on to the next liquid
  var fl = document.getElementById('flow');
  function nextLiq() { return LIQ[(LIQ.indexOf(liq) + 1) % 3]; }
  function cap(l) { return l.charAt(0).toUpperCase() + l.slice(1); }
  function flowShow() {
    if (!fl) return;
    fl.setAttribute('data-liquid', liq);
    fl.setAttribute('aria-label', cap(liq) + ' liquid. Change to ' + nextLiq());
  }
  if (fl) fl.addEventListener('click', function () {
    fl.classList.remove('turning'); void fl.offsetWidth; fl.classList.add('turning');
    colour(nextLiq()); flowShow();
  });
  flowShow();
  // for the address (switch.js): #…/day-blue, #…/night-orange
  window.StudioRiver = {
    liquid: function () { return liq; },
    night: function () { return night; },
    colour: function (l) { colour(l); flowShow(); }
  };

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
