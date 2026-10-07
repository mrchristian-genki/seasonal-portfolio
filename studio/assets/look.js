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
      .map(function (f) { return img(A + f + '?v=19'); })));
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
  // ---------- HER BACKDROPS: the scene behind the Listen bar, shown softly blurred (narrator.css .nb-bd). The prompt
  // asks for a soft-focus room to begin with; the site blurs it a little more and dims it under the glass card ----------
  var BDW = 1344, BDH = 576;   // 21:9, the backdrop template's shape
  // The prompt says only the place, never what goes over it (a word like robot or music player gets drawn): the quiet
  // areas are given as pixels on the 2016 x 864 template, measured from backdrop-guide.jpg (her at x 0-597, the glass
  // card at x 657-1956, y 254-581, a wide screen's strip at y 198-666, a phone's middle at x 317-1699)
  function bdPrompt(scene) {
    scene = String(scene || '').trim().replace(/\.$/, '') || 'a cozy, warmly lit room';
    return 'A 2016 x 864 pixel (21:9) photograph of ' + scene + ', the same size and shape as the attached template. ' +
      'Shot like a cinematic film still with a very shallow depth of field: the whole scene softly out of focus, with gentle ' +
      'bokeh and nothing sharp. Warm, low, late-afternoon light; calm, tidy and uncluttered; straight-on at eye level. ' +
      'Composition, in pixels from the top-left corner: put the most interesting part of the scene in the band from y 200 to ' +
      'y 665, centered between x 320 and x 1700. Keep the left 600 pixels (x 0 to x 600) plain and calm: soft even tones, no ' +
      'bright lights, no strong shapes. Keep the area from x 660 to x 1960 and y 250 to y 580 evenly lit, low in contrast and ' +
      'slightly darker than the rest. Empty of people and animals. No writing, signs, logos or brands anywhere. Natural ' +
      'colors, nothing neon.';
  }
  // a render of any shape, cropped to fill 21:9 and made small (it's shown blurred), with a preview of it in the bar
  function backdrop(file) {
    var url = URL.createObjectURL(file);
    return img(url).then(function (src) {
      URL.revokeObjectURL(url);
      var c = canvas(BDW, BDH), g = c.getContext('2d'), sw = src.naturalWidth, sh = src.naturalHeight, k = Math.max(BDW / sw, BDH / sh);
      g.imageSmoothingQuality = 'high'; g.drawImage(src, (BDW - sw * k) / 2, (BDH - sh * k) / 2, sw * k, sh * k);
      var warn = Math.abs(sw / sh - BDW / BDH) > 0.15 ? 'It isn\'t 21:9 like the template, so it was cropped to fit.' : '';
      return new Promise(function (ok) { c.toBlob(ok, 'image/webp', 0.82); }).then(function (b) {
        if (b && b.type === 'image/webp') return b;
        return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.85); });
      }).then(function (blob) { return { blob: blob, ext: blob.type === 'image/webp' ? 'webp' : 'jpg', preview: bdPreview(c), warn: warn }; });
    });
  }
  // as the bar shows it: a wide strip, blurred and dimmed, her at the left and a glass card on the right
  function bdPreview(c) {
    var W = 900, H = 230, p = canvas(W, H), g = p.getContext('2d'), k = Math.max(W / BDW, H / BDH);
    g.filter = 'blur(4px) saturate(.95) brightness(.7)';
    g.drawImage(c, (W - BDW * k) / 2 - 8, (H - BDH * k) / 2 - 8, BDW * k + 16, BDH * k + 16);
    g.filter = 'none';
    var r = function (x, y, w, h, rad) { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); };
    g.fillStyle = 'rgba(40,44,44,.45)'; r(250, 22, 626, 150, 18); g.fill(); g.strokeStyle = 'rgba(240,240,240,.25)'; g.stroke();
    g.fillStyle = '#fff'; g.font = '700 22px system-ui,sans-serif'; g.fillText('The Note’s title', 274, 70);
    g.fillStyle = '#9fd8d0'; g.font = '600 14px system-ui,sans-serif'; g.fillText('Narrated by GlazyArray', 274, 96);
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(274, 124, 570, 5);
    load().then(function (P) { g.drawImage(P[0], 10, 18, 190, 133); });   // her head, for scale
    var d = new Image(); d.onload = function () { for (var x = 0; x < W; x += d.width * 16 / d.height) g.drawImage(d, x, H - 16, d.width * 16 / d.height, 16); }; d.src = A + 'desk.jpg';
    return p;
  }
  function copyImage(url) {
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) return Promise.reject(new Error('This browser can\'t copy images. Download it instead.'));
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': fetch(url).then(function (r) { return r.blob(); }) })]);
  }
  window.GALook = { make: make, copyTemplate: copyTemplate, bdPrompt: bdPrompt, backdrop: backdrop, copyImage: copyImage,
    BD_TEMPLATE: A + 'kit/backdrop-template.png', BD_GUIDE: A + 'kit/backdrop-guide.jpg' };
})();
