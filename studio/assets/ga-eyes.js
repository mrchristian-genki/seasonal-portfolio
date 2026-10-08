/* HER FACE IN THE STUDIO, AS THE SITE SHOWS IT. A look image (assets/narrator/looks/*.webp, or her own curls,
   head-base.webp) is only her head's base layer: under it her old glowing lenses. The site lays her eyes over it (the
   iris through her lens, the catchlights) and her chin plates, and dyes a white-based look in its own two colours
   (looks.json flairBase). Any such image in the Studio is redrawn here the same way, once per image, so every
   thumbnail shows her calm blue eyes. */
(function () {
  'use strict';
  var A = '/assets/narrator/', done = {}, J = null, parts = null;
  function pic(u) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = u; }); }
  function load() {
    return parts || (parts = Promise.all([fetch(A + 'looks.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return {}; })]
      .concat(['head-iris.webp', 'head-lens.png', 'head-shine.webp', 'head-jaw-sides.webp', 'head-jaw.webp'].map(function (f) { return pic(A + f); }))));
  }
  function compose(src) {
    if (done[src]) return done[src];
    return (done[src] = Promise.all([pic(src), load()]).then(function (r) {
      var base = r[0], P = r[1], j = P[0] || {}; if (!base || !base.naturalWidth) return null;
      var W = 623, H = 437, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
      g.drawImage(base, 0, 0, W, H);
      // a white-based look wears its own colours, as on a Note without a palette
      var file = decodeURIComponent(src.split('?')[0].split('/').pop()), L = (j.looks || []).filter(function (l) { return l.file === file; })[0];
      var dye = L && L.flairBase ? Promise.all((L.flair || '').split('').map(function (k) { return pic(A + 'looks/' + file.replace(/\.[a-z]+$/, '') + '.flair-' + k + '.png' + (L.v ? '?r=' + L.v : '')); })) : Promise.resolve([]);
      return dye.then(function (ms) {
        ms.forEach(function (m, i) {
          if (!m) return; var t = document.createElement('canvas'); t.width = W; t.height = H; var tg = t.getContext('2d');
          tg.drawImage(m, 0, 0, W, H); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = L.flairBase[i] || L.flairBase[0]; tg.fillRect(0, 0, W, H);
          g.save(); g.globalCompositeOperation = (L.flairDye || '').indexOf('ab'[i]) >= 0 ? 'multiply' : 'color'; g.globalAlpha = L.flairK || .45; g.drawImage(t, 0, 0); g.restore();
        });
        var e = document.createElement('canvas'); e.width = W; e.height = H; var eg = e.getContext('2d');
        if (P[1]) eg.drawImage(P[1], 0, 0, W, H); if (P[2]) { eg.globalCompositeOperation = 'destination-in'; eg.drawImage(P[2], 0, 0, W, H); }
        g.drawImage(e, 0, 0); [P[3], P[4], P[5]].forEach(function (p) { if (p) g.drawImage(p, 0, 0, W, H); });
        return c.toDataURL('image/png');
      });
    }));
  }
  var RX = /\/assets\/narrator\/(looks\/[^/?]+\.(webp|png)|head-base\.webp)(\?|$)/;
  function fix(img) {
    var s = img.getAttribute('src') || ''; if (img.dataset.gaEyes === s || !RX.test(s) || /flair-[ab]\.png/.test(s)) return;
    img.dataset.gaEyes = s;
    compose(s).then(function (u) { if (u && img.getAttribute('src') === s) { img.src = u; img.dataset.gaEyes = u; } });
  }
  function scan(root) { if (root.tagName === 'IMG') fix(root); else if (root.querySelectorAll) [].forEach.call(root.querySelectorAll('img'), fix); }
  new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === 'attributes') fix(m.target); else [].forEach.call(m.addedNodes, scan); }); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  scan(document);
})();
