/* STUDIO: Robot Marley's looks, cut in the browser from two renders of her template (Christian, Oct 13, 2026), the
   way Claude cut her holiday looks by hand (assets/marley/KIT.md): one render in the look's own colours, one with the
   hat and the charm painted flat cyan. The cyan shapes say where each piece is: above her collar it's the hat, below
   it the charm. Each piece comes out three ways, cropped to its box in her 560 x 728 frame:
     own:  its own colours (the green screen's spill taken off its edges)
     dye:  the same, with the cyan parts turned to grey shading, so a Note's colour can dye them (css: multiply)
     mask: where the cyan was, for that colour
   Then her parts are put together with the pieces on, to look at before saving (in her own colours and in a sample
   Note's). MarleyCut.cut(ownFile, cyanFile) -> { hat, charm, previews: [canvas, canvas], warn }; each piece is
   { own, dye, mask: Blob, ext: 'webp' | 'png', box: [x, y, w, h] }. */
(function () {
  'use strict';
  var W = 1376, H = 768, SX = 440, SY = 40;   // the renders' frame, and where her 560 x 728 stage sits in it (parts/layout.json)
  var PARTS = '/assets/marley/parts/web/';
  function load(src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { no(new Error('That image didn\'t open.')); }; i.src = src; }); }
  function pixels(img) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
    return g.getImageData(0, 0, W, H).data;
  }
  // masks are Uint8Array(W * H) of 0/1
  function morph(m, n, grow) {   // a step out (grow) or in, over the four neighbours: thin parts (a charm's frame) survive
    for (var it = 0; it < n; it++) {
      var o = new Uint8Array(m.length);
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var i = y * W + x, l = x > 0 ? m[i - 1] : 0, r = x < W - 1 ? m[i + 1] : 0, u = y > 0 ? m[i - W] : 0, d = y < H - 1 ? m[i + W] : 0;
        o[i] = grow ? (m[i] | l | r | u | d) : (m[i] & l & r & u & d);
      }
      m = o;
    }
    return m;
  }
  function open(m, n) { return morph(morph(m, n, false), n, true); }
  function close(m, n) { return morph(morph(m, n, true), n, false); }
  // connected pieces: [{ px: [indices], cy: centre row }]
  function pieces(m) {
    var seen = new Uint8Array(m.length), out = [];
    for (var s = 0; s < m.length; s++) {
      if (!m[s] || seen[s]) continue;
      var st = [s], px = [], sy = 0; seen[s] = 1;
      while (st.length) {
        var i = st.pop(), x = i % W, y = (i - x) / W; px.push(i); sy += y;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var xx = x + d[0], yy = y + d[1], j = yy * W + xx; if (xx >= 0 && xx < W && yy >= 0 && yy < H && m[j] && !seen[j]) { seen[j] = 1; st.push(j); } });
      }
      out.push({ px: px, cy: sy / px.length });
    }
    return out;
  }
  // the holes inside a shape filled (whatever the outside can't reach)
  function fill(m) {
    var out = new Uint8Array(m.length), st = [];
    for (var x = 0; x < W; x++) { st.push(x, (H - 1) * W + x); } for (var y = 0; y < H; y++) { st.push(y * W, y * W + W - 1); }
    while (st.length) {
      var i = st.pop(); if (out[i] || m[i]) continue; out[i] = 1;
      var x2 = i % W, y2 = (i - x2) / W;
      if (x2 > 0) st.push(i - 1); if (x2 < W - 1) st.push(i + 1); if (y2 > 0) st.push(i - W); if (y2 < H - 1) st.push(i + W);
    }
    for (var k = 0; k < m.length; k++) out[k] = out[k] ? 0 : 1;
    return out;
  }
  function bbox(m) {
    var x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (var i = 0; i < m.length; i++) if (m[i]) { var x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : [x0 - 3, y0 - 3, x1 + 4, y1 + 4];
  }
  // a soft edge: the mask (0/1) to 0..255, blurred a little
  function soft(m) {
    var a = new Float32Array(m.length), o = new Uint8ClampedArray(m.length), k = [1, 2, 1];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var s = 0, n = 0; for (var d = -1; d <= 1; d++) { var xx = x + d; if (xx >= 0 && xx < W) { s += m[y * W + xx] * k[d + 1]; n += k[d + 1]; } } a[y * W + x] = s / n; }
    for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) { var s2 = 0, n2 = 0; for (var e = -1; e <= 1; e++) { var yy = y2 + e; if (yy >= 0 && yy < H) { s2 += a[yy * W + x2] * k[e + 1]; n2 += k[e + 1]; } } o[y2 * W + x2] = Math.round(s2 / n2 * 255); }
    return o;
  }
  function blob(c) {
    return new Promise(function (ok) { c.toBlob(ok, 'image/webp', 0.9); }).then(function (b) {
      if (b && b.type === 'image/webp') return { b: b, ext: 'webp' };
      return new Promise(function (ok) { c.toBlob(ok, 'image/png'); }).then(function (p) { return { b: p, ext: 'png' }; });
    });
  }
  // a piece out three ways, cropped to its box
  function out(own, cy, full, cyan, bb) {
    var w = bb[2] - bb[0], h = bb[3] - bb[1], af = soft(full), ac = soft(cyan);
    var L = [], idx = [];
    for (var i = 0; i < cyan.length; i++) if (cyan[i]) { var j = i * 4; L.push(0.299 * cy[j] + 0.587 * cy[j + 1] + 0.114 * cy[j + 2]); }
    L.sort(function (a, b) { return a - b; });
    var scale = L.length ? 245 / Math.max(1, L[Math.floor(L.length * 0.98)]) : 1;
    var mk = function (kind) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d'), d = g.createImageData(w, h), p = d.data;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var sx = bb[0] + x, sy = bb[1] + y, q = (y * w + x) * 4;
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        var i2 = sy * W + sx, j2 = i2 * 4;
        if (kind === 'mask') { p[q] = p[q + 1] = p[q + 2] = 255; p[q + 3] = ac[i2]; continue; }
        var r = own[j2], gg = own[j2 + 1], b = own[j2 + 2];
        if (full[i2]) gg = Math.min(gg, Math.max(r, b));   // the green screen's spill off it
        if (kind === 'dye' && cyan[i2]) { var l = Math.min(255, (0.299 * cy[j2] + 0.587 * cy[j2 + 1] + 0.114 * cy[j2 + 2]) * scale); r = gg = b = l; }
        p[q] = r; p[q + 1] = gg; p[q + 2] = b; p[q + 3] = af[i2];
      }
      g.putImageData(d, 0, 0); return c;
    };
    var cs = { own: mk('own'), dye: mk('dye'), mask: mk('mask') };
    return Promise.all([blob(cs.own), blob(cs.dye), blob(cs.mask)]).then(function (r) {
      return { own: r[0].b, dye: r[1].b, mask: r[2].b, ext: r[0].ext === 'webp' && r[1].ext === 'webp' && r[2].ext === 'webp' ? 'webp' : 'png', box: [bb[0] - SX, bb[1] - SY, w, h], canvases: cs };
    });
  }
  // her, put together from her parts (parts/web/boxes.json), with the pieces on; pal: a Note's two colours, or none
  function preview(boxes, imgs, cut, pal) {
    var c = document.createElement('canvas'); c.width = 560; c.height = 728;
    var g = c.getContext('2d'); g.fillStyle = '#e9e4da'; g.fillRect(0, 0, 560, 728);
    ['tail', 'body', 'head', 'earL', 'earR', 'collar'].forEach(function (k) { var b = boxes[k]; if (b && imgs[k]) g.drawImage(imgs[k], b[0], b[1], b[2], b[3]); });
    [['charm', 1], ['hat', 0]].forEach(function (pc) {
      var p = cut[pc[0]]; if (!p) return;
      var b = p.box, cs = p.canvases;
      if (!pal) { g.drawImage(cs.own, b[0], b[1]); return; }
      var t = document.createElement('canvas'); t.width = b[2]; t.height = b[3];
      var tg = t.getContext('2d'); tg.drawImage(cs.dye, 0, 0);
      var col = document.createElement('canvas'); col.width = b[2]; col.height = b[3];
      var cg = col.getContext('2d'); cg.drawImage(cs.mask, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = pal[pc[1]]; cg.fillRect(0, 0, b[2], b[3]);
      tg.globalCompositeOperation = 'multiply'; tg.drawImage(col, 0, 0); tg.globalCompositeOperation = 'destination-in'; tg.drawImage(cs.dye, 0, 0);
      g.drawImage(t, b[0], b[1]);
    });
    return c;
  }
  function cut(ownFile, cyanFile) {
    var u1 = URL.createObjectURL(ownFile), u2 = URL.createObjectURL(cyanFile);
    return Promise.all([load(u1), load(u2), fetch(PARTS + 'boxes.json').then(function (r) { return r.json(); })]).then(function (r) {
      URL.revokeObjectURL(u1); URL.revokeObjectURL(u2);
      var warn = [], a = r[0], b = r[1], boxes = r[2].box || {};
      [a, b].forEach(function (im) { if (Math.abs(im.naturalWidth / im.naturalHeight - W / H) > 0.03) warn.push('A render isn\'t 16:9 like her template (1376 x 768), so it was stretched to fit; the pieces may not line up.'); });
      var own = pixels(a), cy = pixels(b);
      // the green: the corners of her own render
      var gs = [0, 0, 0], n = 0;
      [[10, 10], [W - 30, 10], [10, H - 30], [W - 30, H - 30]].forEach(function (p) { for (var y = p[1]; y < p[1] + 20; y++) for (var x = p[0]; x < p[0] + 20; x++) { var j = (y * W + x) * 4; gs[0] += own[j]; gs[1] += own[j + 1]; gs[2] += own[j + 2]; n++; } });
      gs = gs.map(function (v) { return v / n; });
      // the cyan: plainly cyan pixels, grown into the softer cyan touching them (fur, a shaded inner ear), so a piece's
      // edges and folds come too; and what's still the green in her own render is never part of a piece
      var m = new Uint8Array(W * H), weak = new Uint8Array(W * H), green = new Uint8Array(W * H);
      var dist = function (px, j) { return Math.sqrt((px[j] - gs[0]) * (px[j] - gs[0]) + (px[j + 1] - gs[1]) * (px[j + 1] - gs[1]) + (px[j + 2] - gs[2]) * (px[j + 2] - gs[2])); };
      for (var i = 0; i < m.length; i++) {
        var j = i * 4, R = cy[j], G = cy[j + 1], B = cy[j + 2], d = dist(cy, j);
        m[i] = B > R + 45 && G > R + 30 && Math.abs(G - B) < 80 && B > 90 && d > 60 ? 1 : 0;
        weak[i] = B > R + 28 && G > R + 20 && Math.abs(G - B) < 85 && B > 80 && d > 50 ? 1 : 0;
        green[i] = dist(own, j) < 50 ? 1 : 0;
      }
      m = open(m, 1);
      (function grow() {   // at most 8 pixels out from the plain cyan, above her collar: a hat's soft edge or fold, never a new part
        var depth = new Uint8Array(m.length), st = []; for (var k = 0; k < m.length; k++) if (m[k]) st.push(k);
        while (st.length) {
          var q = st.pop(), qx = q % W;
          if (depth[q] >= 8 || q >= 245 * W) continue;   // hats only (a charm is small and solid, and its inside keeps its own colour)
          [q - 1, q + 1, q - W, q + W].forEach(function (nq, t) { if (nq < 0 || nq >= m.length || (t === 0 && qx === 0) || (t === 1 && qx === W - 1)) return; if (weak[nq] && !m[nq]) { m[nq] = 1; depth[nq] = depth[q] + 1; st.push(nq); } });
        }
      })();
      var notGreen = function (mk) { for (var k = 0; k < mk.length; k++) if (green[k]) mk[k] = 0; return mk; };
      var hat = new Uint8Array(m.length), charm = new Uint8Array(m.length);
      pieces(m).forEach(function (p) {
        if (p.px.length < 40) return;
        var into = p.cy < 245 ? hat : p.cy > 285 ? charm : null;   // above her collar (rows 265 to 344) the hat, below it the charm
        if (into) p.px.forEach(function (k) { into[k] = 1; });
      });
      hat = close(hat, 2); var hatFull = notGreen(morph(fill(hat), 1, false));
      charm = close(charm, 2); var charmFull = notGreen(fill(close(charm, 3))); charm = notGreen(charm);
      var hb = bbox(hatFull), cb = bbox(charmFull);
      if (!hb) warn.push('No hat found: is the hat painted cyan in the second render?');
      var imgs = {};
      return Promise.all(['tail', 'body', 'head', 'earL', 'earR', 'collar'].map(function (k) { return load(PARTS + k + '.webp?v=2').then(function (im) { imgs[k] = im; }, function () {}); })).then(function () {
        // a charm that isn't cyan (a turkey leg that should look like one): cut by how her own render differs from her
        // template below the collar, kept in its own colours (no part of it takes a Note's colour)
        if (!cb) {
          var c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
          var g0 = c0.getContext('2d'); g0.fillStyle = 'rgb(' + gs.map(Math.round).join(',') + ')'; g0.fillRect(0, 0, W, H);
          ['tail', 'body', 'head', 'earL', 'earR', 'collar'].forEach(function (k) { var b2 = boxes[k]; if (b2 && imgs[k]) g0.drawImage(imgs[k], b2[0] + SX, b2[1] + SY, b2[2], b2[3]); });
          var tp = g0.getImageData(0, 0, W, H).data, dm = new Uint8Array(W * H);
          for (var y = 300; y < 660; y++) for (var x = 540; x < 840; x++) {
            var i3 = y * W + x, j3 = i3 * 4;
            if (!green[i3] && Math.max(Math.abs(own[j3] - tp[j3]), Math.abs(own[j3 + 1] - tp[j3 + 1]), Math.abs(own[j3 + 2] - tp[j3 + 2])) > 55) dm[i3] = 1;
          }
          dm = open(dm, 2);   // the parts' own edges differ a little: thin lines, gone
          var hang = new Uint8Array(W * H);
          pieces(dm).forEach(function (p) {
            if (p.px.length < 200) return;
            var top = Math.min.apply(null, p.px.map(function (k) { return Math.floor(k / W); })), cx = p.px.reduce(function (a2, k) { return a2 + k % W; }, 0) / p.px.length;
            if (top < 420 && cx > 600 && cx < 780) p.px.forEach(function (k) { hang[k] = 1; });   // hanging from her collar ring, in front of her chest
          });
          charmFull = notGreen(fill(close(hang, 3))); charm = new Uint8Array(W * H); cb = bbox(charmFull);
          if (cb) warn.push('The charm isn\'t cyan, so it was cut by how it differs from her template, and keeps its own colours. Check its edges in the preview.');
        }
        if (!cb) warn.push('No charm found: is the charm painted cyan in the second render?');
        if (!hb && !cb) throw new Error('Nothing to cut. The second render should show the hat and the charm painted flat cyan.');
        return Promise.all([hb ? out(own, cy, hatFull, hatFull, hb) : null, cb ? out(own, cy, charmFull, charm, cb) : null]);
      }).then(function (rr) {
        var res = { hat: rr[0], charm: rr[1], warn: warn };
        res.previews = [preview(boxes, imgs, res, null), preview(boxes, imgs, res, ['#3c7f6f', '#d9a441'])];
        return res;
      });
    });
  }
  window.MarleyCut = { cut: cut };
})();
