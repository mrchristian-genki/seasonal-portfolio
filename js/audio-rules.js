/* AUDIO RULES, site wide: one track at a time, and never one playing where its controls can't be seen.
   1. Starting a track (an <audio>, or a video with its sound on) pauses every other one on the page.
   2. ...and in every other tab or window of the site that's open (BroadcastChannel).
   3. A track whose player is no longer on screen to stop it (its tab or panel hidden, its dialog
      closed, or taken off the page altogether) pauses. Scrolling past it doesn't: a podcast plays on
      while you read.
   4. Following a link that opens a new window pauses it: that's where the listener is going.
   The silent loops (muted videos) are left alone. */
(function () {
  'use strict';
  var me = Math.random().toString(36).slice(2), live = new Set(), timer = null;
  var ch = 'BroadcastChannel' in window ? new BroadcastChannel('cg-audio') : null;
  function audible(m) { return m.tagName === 'AUDIO' || !m.muted; }
  function stop(except) { live.forEach(function (m) { if (m !== except && !m.paused) m.pause(); }); }
  // a player you can still reach: on the page, not in a closed dialog, not hidden
  function reachable(m) {
    if (!m.isConnected || m.closest('dialog:not([open])')) return false;
    if (!m.getClientRects().length) return false;
    for (var e = m; e && e.nodeType === 1; e = e.parentElement) if (getComputedStyle(e).visibility === 'hidden' || e.hidden || e.inert) return false;
    return true;
  }
  function watch() {
    if (timer) return;
    timer = setInterval(function () {
      var any = false;
      live.forEach(function (m) { if (m.paused) { live.delete(m); return; } any = true; if (!reachable(m)) m.pause(); });
      if (!any) { clearInterval(timer); timer = null; }
    }, 600);
  }
  document.addEventListener('play', function (e) {
    var m = e.target;
    if (!m || !/^(AUDIO|VIDEO)$/.test(m.tagName) || !audible(m)) return;
    stop(m); live.add(m);
    if (ch) ch.postMessage({ from: me });
    watch();
  }, true);
  // a video unmuted while playing counts too
  document.addEventListener('volumechange', function (e) {
    var m = e.target; if (m && m.tagName === 'VIDEO' && !m.muted && !m.paused) { stop(m); live.add(m); if (ch) ch.postMessage({ from: me }); watch(); }
  }, true);
  if (ch) ch.onmessage = function (e) { if (e.data && e.data.from !== me) stop(null); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[target="_blank"]');
    if (a && live.size) stop(null);
  }, true);
})();
