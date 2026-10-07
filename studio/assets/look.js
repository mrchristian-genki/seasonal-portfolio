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
    }).then(function (blob) { return flair(out).then(function (f) { return { blob: blob, ext: blob.type === 'image/webp' ? 'webp' : 'png', preview: preview(out, P), warn: warn, out: out, flair: f }; }); });
  }
  // ---------- her flair ----------
  // The Note's palette from its hero (same method as the site's first pass, scratchpad palette.py): two vivid, distinct
  // accent colours, by colourfulness per hue; a brass-brown hero lets its strongest other colour lead
  function hls(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, h = 0, d = mx - mn;
    if (d) {
      s = l <= 0.5 ? d / (mx + mn) : d / (2 - mx - mn);
      h = mx === r ? (g - b) / d : mx === g ? 2 + (b - r) / d : 4 + (r - g) / d; h = (h / 6 + 1) % 1;
    }
    return [h, l, s];
  }
  function hex(h, l, s) {
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function f(t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * t * 6 : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    return '#' + [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(function (v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join('');
  }
  function palette(src) {
    var w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height, k = Math.min(1, 64 / Math.max(w0, h0));
    var c = canvas(Math.max(1, Math.round(w0 * k)), Math.max(1, Math.round(h0 * k))), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
    var d = g.getImageData(0, 0, c.width, c.height).data, px = [], hist = [], tot = 0, i, j;
    for (i = 0; i < 36; i++) hist.push(0);
    for (i = 0; i < d.length; i += 4) {
      var t = hls(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255), w = t[2] * (1 - Math.abs(2 * t[1] - 1));
      if (!(t[2] > 0.28 && t[1] > 0.18 && t[1] < 0.85)) w = 0;
      var bin = Math.floor(t[0] * 36) % 36; px.push([t, w, bin]); hist[bin] += w; tot += w;
    }
    if (tot < 1.5) return null;
    var sm = hist.map(function (v, b) { return v + 0.5 * hist[(b + 35) % 36] + 0.5 * hist[(b + 1) % 36]; });
    function dist(a, b) { var x = Math.abs(a - b) % 36; return Math.min(x, 36 - x); }
    function best(ok) { var q = -1; for (var b = 0; b < 36; b++) if (ok(b) && (q < 0 || sm[b] > sm[q])) q = b; return q; }
    var p1 = best(function () { return true; });
    var p2 = best(function (b) { return dist(b, p1) >= 6; }); if (p2 < 0 || sm[p2] < 0.15 * sm[p1]) p2 = -1;
    function brassy(b) { return b >= 2 && b <= 4; }
    if (brassy(p1)) {
      var q = best(function (b) { return dist(b, p1) >= 6 && !brassy(b); });
      if (q >= 0 && sm[q] >= 0.012 * sm[p1]) { p2 = p1; p1 = q; }
    }
    function col(p) {
      var x = 0, y = 0, ws = 0, ss = 0, ll = 0;
      px.forEach(function (e) { if (dist(e[2], p) > 1 || !e[1]) return; x += e[1] * Math.cos(2 * Math.PI * e[0][0]); y += e[1] * Math.sin(2 * Math.PI * e[0][0]); ws += e[1]; ss += e[1] * e[0][2]; ll += e[1] * e[0][1]; });
      var h = (Math.atan2(y, x) / (2 * Math.PI) + 1) % 1;
      return [h, Math.min(Math.max(ll / ws, 0.45), 0.62), Math.min(Math.max(ss / ws, 0.55), 0.85)];
    }
    var a = col(p1);
    if (p2 < 0) return [hex(a[0], a[1], a[2]), hex((a[0] + 0.09) % 1, Math.min(a[1] + 0.14, 0.74), a[2])];   // one strong colour: a lighter neighbour
    var b2 = col(p2); return [hex(a[0], a[1], a[2]), hex(b2[0], b2[1], b2[2])];
  }
  // Where a new look's flair goes: what the look adds over her own head (not her face), its colourful parts (not brass)
  // split in two hue groups, the bigger first. Gives back the two masks as canvases (null when there's next to nothing)
  function flair(out) {
    return load().then(function (P) {
      var W = LW, H = LH, b = canvas(W, H), bg = b.getContext('2d'); bg.drawImage(P[0], 0, 0, W, H);
      var lk = canvas(W, H), lg = lk.getContext('2d'); lg.drawImage(P[4], 0, 0, W, H);
      var im = out.getContext('2d').getImageData(0, 0, W, H).data, bs = bg.getImageData(0, 0, W, H).data, lo = lg.getImageData(0, 0, W, H).data;
      var hue = new Float32Array(W * H), col = new Uint8Array(W * H), acc = new Uint8Array(W * H), n = 0, na = 0, i;
      for (i = 0; i < W * H; i++) {
        var o = i * 4, a = im[o + 3];
        if (a < 128 || lo[o + 3] >= 128) continue;
        var dd = (Math.abs(im[o] - bs[o]) + Math.abs(im[o + 1] - bs[o + 1]) + Math.abs(im[o + 2] - bs[o + 2])) / 3 + Math.abs(a - bs[o + 3]);
        if (dd <= 28) continue;
        acc[i] = 1; na++;
        var r = im[o], g = im[o + 1], bl = im[o + 2], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
        if (mx <= 40 || !mx || (mx - mn) / mx * 255 <= 70) continue;   // OpenCV's S over 70 and V over 40
        var h = hls(r / 255, g / 255, bl / 255)[0] * 360;
        if (h >= 12 && h <= 64) continue;                                // brass stays brass
        hue[i] = h; col[i] = 1; n++;
      }
      function soft(on, c) {
        if (c < 20) return null;
        var m = canvas(W, H), mg = m.getContext('2d'), md = mg.createImageData(W, H);
        for (var j = 0; j < W * H; j++) if (on(j)) md.data[j * 4 + 3] = 255;
        mg.putImageData(md, 0, 0);
        var s = canvas(W, H), sg = s.getContext('2d'); sg.filter = 'blur(0.7px)'; sg.drawImage(m, 0, 0); return s;   // soft edges, like the site's
      }
      var whole = soft(function (j) { return acc[j]; }, na);   // all it adds, brass too: for an all-brass accessory
      if (n < 30) return { a: null, b: null, whole: whole };
      // two groups by hue around the circle: start from the commonest hue and the one furthest from it, a few rounds
      var hs = []; for (i = 0; i < W * H; i++) if (col[i]) hs.push(i);
      function vec(h) { return [Math.cos(h * Math.PI / 180), Math.sin(h * Math.PI / 180)]; }
      var hb = new Array(36).fill(0); hs.forEach(function (i) { hb[Math.floor(hue[i] / 10) % 36]++; });
      var c0 = vec(hb.indexOf(Math.max.apply(null, hb)) * 10 + 5), c1 = null, far = 2;
      hs.forEach(function (i) { var v = vec(hue[i]), dt = v[0] * c0[0] + v[1] * c0[1]; if (dt < far) { far = dt; c1 = v; } });
      var lab = new Uint8Array(W * H), k0 = 0, k1 = 0;
      for (var it = 0; it < 10; it++) {
        var s0 = [0, 0], s1 = [0, 0]; k0 = k1 = 0;
        hs.forEach(function (i) { var v = vec(hue[i]); if (v[0] * c0[0] + v[1] * c0[1] >= v[0] * c1[0] + v[1] * c1[1]) { lab[i] = 0; s0[0] += v[0]; s0[1] += v[1]; k0++; } else { lab[i] = 1; s1[0] += v[0]; s1[1] += v[1]; k1++; } });
        if (k0) c0 = [s0[0] / k0, s0[1] / k0]; if (k1) c1 = [s1[0] / k1, s1[1] / k1];
      }
      var ang = Math.acos(Math.max(-1, Math.min(1, (c0[0] * c1[0] + c0[1] * c1[1]) / (Math.hypot(c0[0], c0[1]) * Math.hypot(c1[0], c1[1]) || 1)))) * 180 / Math.PI;
      var one = !k1 || ang < 40 || Math.min(k0, k1) < 0.12 * (k0 + k1), big = k0 >= k1 ? 0 : 1;
      function mask(pick) { var c = 0; hs.forEach(function (i) { if (pick(lab[i])) c++; }); return soft(function (j) { return col[j] && pick(lab[j]); }, c); }
      return one ? { a: mask(function () { return true; }), b: null, whole: whole } : { a: mask(function (l) { return l === big; }), b: mask(function (l) { return l !== big; }), whole: whole };
    });
  }
  // the look with its flair tinted in two colours ("color" blend, as on the site), on the Listen bar's teal
  function flairPreview(out, m, pal) {
    var c = canvas(LW, LH), g = c.getContext('2d');
    g.fillStyle = '#0f4d47'; g.fillRect(0, 0, LW, LH); g.drawImage(out, 0, 0);
    [m.a, m.b].forEach(function (mk, k) {
      if (!mk) return;
      var t = canvas(LW, LH), tg = t.getContext('2d'); tg.drawImage(mk, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = pal[k]; tg.fillRect(0, 0, LW, LH);
      g.globalCompositeOperation = 'color'; g.globalAlpha = 0.45; g.drawImage(t, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';   // a tint, as on the site
    });
    return c;
  }
  function png(c) { return new Promise(function (ok) { c.toBlob(ok, 'image/png'); }); }
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
  window.GALook = { make: make, palette: palette, flairPreview: flairPreview, png: png, copyTemplate: copyTemplate, bdPrompt: bdPrompt, backdrop: backdrop, copyImage: copyImage,
    BD_TEMPLATE: A + 'kit/backdrop-template.png', BD_GUIDE: A + 'kit/backdrop-guide.jpg' };
})();
