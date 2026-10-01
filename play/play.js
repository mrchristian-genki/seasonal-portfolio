/* PLAY pages (Field Notes): the route map and elevation profile (from play/data/<id>.json, drawn by the shared
   js/route-view.js), the miles/km switch, and a photo lightbox. The pages read fine without it. */
(function () {
  'use strict';
  var RV = window.RouteView, main = document.querySelector('[data-route]'), ub = document.getElementById('units');

  // Daily Dose of Paradise: swap a thumbnail for the YouTube player only when it's tapped.
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-yt]');
    if (!b) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(b.getAttribute('data-yt')) + '?autoplay=1&rel=0';
    f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; f.title = b.getAttribute('aria-label') || 'YouTube video';
    b.replaceWith(f);
  });

  // Short clips loop silently, but only while on screen (and not at all with reduced motion).
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clips = document.querySelectorAll('video[data-autoplay]');
  if (clips.length && 'IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.preload = 'auto'; var p = e.target.play(); if (p && p.catch) p.catch(function () {}); } else e.target.pause(); });
    }, { threshold: 0.35 });
    clips.forEach(function (v) { io.observe(v); });
  }

  // Lightbox for any photo (or clip) link
  var box = null;
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('[data-lightbox]');
    if (!a || !window.HTMLDialogElement) return;
    ev.preventDefault();
    if (!box) {
      box = document.createElement('dialog'); box.className = 'lightbox';
      box.innerHTML = '<img alt=""><video controls loop playsinline hidden></video><p></p><button type="button" aria-label="Close">&times;</button>';
      box.querySelector('button').onclick = function () { box.close(); };
      box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
      box.addEventListener('close', function () { var v = box.querySelector('video'); v.pause(); v.removeAttribute('src'); v.load(); });
      document.body.appendChild(box);
    }
    var img = a.querySelector('img'), cap = a.parentNode.querySelector('figcaption'), bi = box.querySelector('img'), bv = box.querySelector('video');
    var isVid = a.hasAttribute('data-video');
    bi.hidden = isVid; bv.hidden = !isVid;
    if (isVid) { bv.src = a.getAttribute('href'); bv.muted = true; var p = bv.play(); if (p && p.catch) p.catch(function () {}); }
    else { bi.src = a.getAttribute('href'); bi.alt = img ? img.alt : ''; }
    box.querySelector('p').textContent = cap ? cap.textContent : '';
    box.showModal();
  });

  if (!main || !RV) return;
  fetch(main.getAttribute('data-route')).then(function (r) { return r.json(); }).then(function (d) {
    function draw() {
      RV.clearMaps();
      document.getElementById('stats').innerHTML = RV.statTiles(d.stats, d.kind);
      var mapEl = document.getElementById('map'), map = null;
      if (window.L) { mapEl.innerHTML = ''; map = RV.makeMap(mapEl, RV.routeLayers(d.line)); }
      RV.profileSVG(document.getElementById('profile'), d.profile, RV.scrubber(map, d.line));
      if (ub) { ub.hidden = false; ub.textContent = RV.units() === 'imperial' ? 'mi · ft' : 'km · m'; }
    }
    draw();
    if (ub) ub.onclick = function () { RV.setUnits(RV.units() === 'imperial' ? 'metric' : 'imperial'); draw(); };
  }).catch(function () { /* the stats in the page stay as written */ });
})();
