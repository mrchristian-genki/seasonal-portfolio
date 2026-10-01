/* NOTES pages: the route map and elevation profile (from notes/data/<id>.json, drawn by the shared
   js/route-view.js), the miles/km switch, and a photo lightbox. The pages read fine without it. */
(function () {
  'use strict';
  var RV = window.RouteView, main = document.querySelector('[data-route]'), ub = document.getElementById('units');

  // Lightbox for any photo link
  var box = null;
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('[data-lightbox]');
    if (!a || !window.HTMLDialogElement) return;
    ev.preventDefault();
    if (!box) {
      box = document.createElement('dialog'); box.className = 'lightbox';
      box.innerHTML = '<img alt=""><p></p><button type="button" aria-label="Close">&times;</button>';
      box.querySelector('button').onclick = function () { box.close(); };
      box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
      document.body.appendChild(box);
    }
    var img = a.querySelector('img'), cap = a.parentNode.querySelector('figcaption');
    box.querySelector('img').src = a.getAttribute('href'); box.querySelector('img').alt = img ? img.alt : '';
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
