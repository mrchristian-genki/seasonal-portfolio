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
    v.innerHTML = '<source src="' + A + name + '.mp4?v=2" type="video/mp4"><source src="' + A + name + '.webm?v=2" type="video/webm">';
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

  stills(night);
  if (!calm) loopFor(night);

  // follow the switch: StudioTable.night is what it calls
  var tab = window.StudioTable;
  if (tab && tab.night) {
    var orig = tab.night;
    tab.night = function (on) { orig(on); set(!!on); };
  }
})();
