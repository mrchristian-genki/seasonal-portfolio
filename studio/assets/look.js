/* STUDIO: GlazyArray's looks, made from a rendered image. The same steps as the Workshop's Style Array
   (parts-catalog js/narrator-looks.js): her template (1376 x 768 on chroma green) with new hair and accessories,
   the green keyed out, the head cut to her layer's box, and her own face, eyes, jaw and neck laid back over it
   through the face lock, so the live narrator still talks, blinks and winks. Gives back the look (WebP, or PNG
   where the browser can't write WebP) and a preview. A look already made in the Workshop (623 x 437) is taken as it is,
   and a preview of her at rest, talking and blinking, with her eyes on. */
(function () {
  'use strict';
  var A = '/assets/narrator/', TW = 1376, TH = 768, BOX = [150, 10, 1230, 768], LW = 623, LH = 437, DROP = 0.0448;
  function img(src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { no(new Error('Could not load ' + src)); }; i.src = src; }); }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  var parts = null;   // base, jaw, jaw sides, lids, face lock, iris, shine, lens
  function load() {
    return parts || (parts = Promise.all(['head-base.webp', 'head-jaw.webp', 'head-jaw-sides.webp', 'head-lids.webp', 'look-lock.png', 'head-iris.webp', 'head-shine.webp', 'head-lens.png']
      .map(function (f) { return img(A + f + '?v=17'); })));
  }
  // the key: background where green clearly beats both red and blue, soft at the edges, green spill pulled down
  function key(c) {
    var g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      var m = Math.max(p[i], p[i + 2]), dd = p[i + 1] - m;
      if (dd > 0) p[i + 1] = Math.min(p[i + 1], m + 4);
      p[i + 3] = Math.round(Math.min(1, Math.max(0, 1 - (dd - 18) / 37)) * 255);
    }
    g.putImageData(d, 0, 0); return c;
  }
  function eyes(P) {
    var c = canvas(LW, LH), g = c.getContext('2d');
    g.drawImage(P[5], 0, 0, LW, LH); g.globalCompositeOperation = 'destination-in'; g.drawImage(P[7], 0, 0, LW, LH);
    g.globalCompositeOperation = 'source-over'; g.drawImage(P[6], 0, 0, LW, LH); return c;
  }
  // a row of her at rest, talking and blinking, on the Listen bar's teal
  function preview(out, P) {
    var row = canvas(LW * 3, LH), r = row.getContext('2d'), E = eyes(P);
    r.fillStyle = '#0f4d47'; r.fillRect(0, 0, row.width, LH);
    [[0, 0], [1, 0], [0, 1]].forEach(function (s, k) {
      var x = k * LW;
      r.drawImage(out, x, 0); r.drawImage(E, x, 0);
      r.drawImage(P[2], x, s[0] * DROP * 0.55 * LH); r.drawImage(P[1], x, s[0] * DROP * LH);
      if (s[1]) r.drawImage(P[3], x, 0);
    });
    return row;
  }
  function make(file) {
    var url = URL.createObjectURL(file);
    return Promise.all([img(url), load()]).then(function (r) {
      var src = r[0], P = r[1], warn = '';
      URL.revokeObjectURL(url);
      if (src.naturalWidth !== TW || src.naturalHeight !== TH) {
        warn = Math.abs(src.naturalWidth / src.naturalHeight - TW / TH) > 0.01 ? 'It isn\'t 16:9 like her template, so it may not line up. Start from her template.' : '';
      }
      var out = canvas(LW, LH), cg = out.getContext('2d');
      // a look the Workshop's Style Array already made (623 x 437, keyed, her face on): used as it is
      if (src.naturalWidth === LW && src.naturalHeight === LH) {
        cg.drawImage(src, 0, 0);
        return done(out, P, '');
      }
      var full = canvas(TW, TH); full.getContext('2d').drawImage(src, 0, 0, TW, TH);
      cg.imageSmoothingQuality = 'high'; cg.drawImage(key(full), BOX[0], BOX[1], BOX[2] - BOX[0], BOX[3] - BOX[1], 0, 0, LW, LH);
      // her own face, eyes, jaw and neck back over it, through the lock
      var face = canvas(LW, LH), fg = face.getContext('2d');
      fg.drawImage(P[0], 0, 0, LW, LH); fg.globalCompositeOperation = 'destination-in'; fg.drawImage(P[4], 0, 0, LW, LH);
      cg.globalCompositeOperation = 'destination-out'; cg.drawImage(P[4], 0, 0, LW, LH);
      cg.globalCompositeOperation = 'source-over'; cg.drawImage(face, 0, 0);
      return done(out, P, warn);
    });
  }
  function done(out, P, warn) {
    return new Promise(function (ok) { out.toBlob(ok, 'image/webp', 0.9); }).then(function (b) {
      if (b && b.type === 'image/webp') return b;
      return new Promise(function (ok) { out.toBlob(ok, 'image/png'); });
    }).then(function (blob) { return { blob: blob, ext: blob.type === 'image/webp' ? 'webp' : 'png', preview: preview(out, P), warn: warn }; });
  }
  // her template as an image on the clipboard, to paste straight into an image tool
  function copyTemplate() {
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) return Promise.reject(new Error('This browser can\'t copy images. Download it instead.'));
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': fetch(A + 'kit/her-template.png').then(function (r) { return r.blob(); }) })]);
  }
  window.GALook = { make: make, copyTemplate: copyTemplate };
})();
