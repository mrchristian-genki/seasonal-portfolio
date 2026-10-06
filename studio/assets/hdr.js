/* STUDIO HDR: a drone's exposure bracket (the same view shot dark, normal and bright, a second or two
   apart) made into one picture, here in the browser. The shots are lined up first (the drone drifts a
   little between them), then blended by exposure fusion (Mertens, Kautz and Van Reeth): each pixel takes
   most from the shot where it's well exposed, sharp and colourful, blended across scales so there are no
   seams or halos. No raw HDR, no tone-mapping: it looks like a photo, with the sky and the shadows both
   kept. Plain JS on Float32 arrays; about two seconds for three 1600 px shots.

   StudioHDR.merge(blobs, maxEdge) -> Promise of { canvas, w, h, shifts, order } or null when the shots aren't
   one view (they don't line up), so the caller keeps them as separate photos. */
(function () {
  'use strict';

  // decode, upright, scaled so the long edge is maxEdge: [r, g, b] Float32 planes in 0..1
  function load(blob, maxEdge) {
    return createImageBitmap(blob, { imageOrientation: 'from-image' }).then(function (bm) {
      var k = Math.min(1, maxEdge / Math.max(bm.width, bm.height)), w = Math.round(bm.width * k), h = Math.round(bm.height * k);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bm, 0, 0, w, h);
      if (bm.close) bm.close();
      var px = g.getImageData(0, 0, w, h).data, n = w * h, r = new Float32Array(n), gg = new Float32Array(n), b = new Float32Array(n);
      for (var i = 0; i < n; i++) { r[i] = px[i * 4] / 255; gg[i] = px[i * 4 + 1] / 255; b[i] = px[i * 4 + 2] / 255; }
      return { w: w, h: h, c: [r, gg, b] };
    });
  }
  function gray(im) { var n = im.w * im.h, o = new Float32Array(n), r = im.c[0], g = im.c[1], b = im.c[2]; for (var i = 0; i < n; i++) o[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i]; return o; }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }

  // half size, by 2x2 averaging (for the alignment pyramid)
  function half(a, w, h) {
    var w2 = w >> 1, h2 = h >> 1, o = new Float32Array(w2 * h2);
    for (var y = 0; y < h2; y++) for (var x = 0; x < w2; x++) { var i = 2 * y * w + 2 * x; o[y * w2 + x] = (a[i] + a[i + 1] + a[i + w] + a[i + w + 1]) / 4; }
    return { a: o, w: w2, h: h2 };
  }
  function median(a) { var s = Array.prototype.slice.call(a, 0, Math.min(a.length, 40000)); if (a.length > 40000) { s = []; var st = a.length / 40000; for (var i = 0; i < a.length; i += st) s.push(a[Math.floor(i)]); } s.sort(function (x, y) { return x - y; }); return s[s.length >> 1]; }

  // Ward's median threshold bitmaps: each shot thresholded at its own median, so brightness doesn't
  // matter; the shift that makes the bitmaps disagree least, found coarse to fine (up to ~60 px)
  function align(ref, img, w, h) {
    var pa = [{ a: ref, w: w, h: h }], pb = [{ a: img, w: w, h: h }];
    while (pa.length < 6 && pa[pa.length - 1].w > 96 && pa[pa.length - 1].h > 96) { var A = pa[pa.length - 1], B = pb[pb.length - 1]; pa.push(half(A.a, A.w, A.h)); pb.push(half(B.a, B.w, B.h)); }
    var dx = 0, dy = 0;
    for (var l = pa.length - 1; l >= 0; l--) {
      var A2 = pa[l], B2 = pb[l], ma = median(A2.a), mb = median(B2.a), best = Infinity, bx = 0, by = 0;
      dx *= 2; dy *= 2;
      for (var sy = -1; sy <= 1; sy++) for (var sx = -1; sx <= 1; sx++) {
        var ox = dx + sx, oy = dy + sy, err = 0;
        for (var y = 4; y < A2.h - 4; y += (l ? 1 : 2)) {
          var y2 = y + oy; if (y2 < 0 || y2 >= A2.h) continue;
          for (var x = 4; x < A2.w - 4; x += (l ? 1 : 2)) {
            var x2 = x + ox; if (x2 < 0 || x2 >= A2.w) continue;
            var va = A2.a[y * A2.w + x], vb = B2.a[y2 * A2.w + x2];
            if (Math.abs(va - ma) < 0.016 || Math.abs(vb - mb) < 0.016) continue;   // too near the median to say
            if ((va > ma) !== (vb > mb)) err++;
          }
        }
        if (err < best) { best = err; bx = ox; by = oy; }
      }
      dx = bx; dy = by;
    }
    return [dx, dy];
  }
  function shift(im, dx, dy) {
    var w = im.w, h = im.h;
    im.c = im.c.map(function (p) {
      var o = new Float32Array(w * h);
      for (var y = 0; y < h; y++) { var y2 = Math.min(h - 1, Math.max(0, y + dy)); for (var x = 0; x < w; x++) { var x2 = Math.min(w - 1, Math.max(0, x + dx)); o[y * w + x] = p[y2 * w + x2]; } }
      return o;
    });
  }
  // are these one view? correlation of the brightness-normalised, lined-up shots, small
  function sameView(a, b, w, h) {
    var A = { a: a, w: w, h: h }, B = { a: b, w: w, h: h };
    while (A.w > 160) { A = half(A.a, A.w, A.h); B = half(B.a, B.w, B.h); }
    var ma = mean(A.a), mb = mean(B.a), sab = 0, saa = 0, sbb = 0;
    for (var i = 0; i < A.a.length; i++) { var u = A.a[i] - ma, v = B.a[i] - mb; sab += u * v; saa += u * u; sbb += v * v; }
    return sab / Math.sqrt(saa * sbb + 1e-12);
  }

  // ---- exposure fusion ----
  var K = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  function blur(a, w, h) {   // separable 5-tap, edges clamped
    var t = new Float32Array(w * h), o = new Float32Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var s = 0; for (var k = -2; k <= 2; k++) { var xx = x + k; xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx; s += K[k + 2] * a[y * w + xx]; } t[y * w + x] = s;
    }
    for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) {
      var s2 = 0; for (var k2 = -2; k2 <= 2; k2++) { var yy = y2 + k2; yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy; s2 += K[k2 + 2] * t[yy * w + x2]; } o[y2 * w + x2] = s2;
    }
    return o;
  }
  function down(a, w, h) { var b = blur(a, w, h), w2 = (w + 1) >> 1, h2 = (h + 1) >> 1, o = new Float32Array(w2 * h2); for (var y = 0; y < h2; y++) for (var x = 0; x < w2; x++) o[y * w2 + x] = b[(2 * y) * w + 2 * x]; return { a: o, w: w2, h: h2 }; }
  function up(a, w, h, W, H) {   // to W x H: nearest place, then blur (x4 for the zeros)
    var o = new Float32Array(W * H);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var X = 2 * x, Y = 2 * y; if (X < W && Y < H) o[Y * W + X] = 4 * a[y * w + x]; }
    return blur(o, W, H);
  }
  function gaussPyr(a, w, h, n) { var p = [{ a: a, w: w, h: h }]; for (var i = 1; i < n; i++) { var q = p[i - 1]; p.push(down(q.a, q.w, q.h)); } return p; }
  function lapPyr(a, w, h, n) {
    var g = gaussPyr(a, w, h, n), out = [];
    for (var i = 0; i < n - 1; i++) { var u = up(g[i + 1].a, g[i + 1].w, g[i + 1].h, g[i].w, g[i].h), d = new Float32Array(g[i].a.length); for (var j = 0; j < d.length; j++) d[j] = g[i].a[j] - u[j]; out.push({ a: d, w: g[i].w, h: g[i].h }); }
    out.push(g[n - 1]);
    return out;
  }
  // weights: local contrast (Laplacian), saturation (spread of r, g, b) and well-exposedness (near 0.5)
  function weights(im) {
    var w = im.w, h = im.h, n = w * h, g = gray(im), o = new Float32Array(n), r = im.c[0], gg = im.c[1], b = im.c[2];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x, l = x > 0 ? g[i - 1] : g[i], rr = x < w - 1 ? g[i + 1] : g[i], u = y > 0 ? g[i - w] : g[i], d = y < h - 1 ? g[i + w] : g[i];
      var C = Math.abs(l + rr + u + d - 4 * g[i]) + 0.004;
      var m = (r[i] + gg[i] + b[i]) / 3, S = Math.sqrt(((r[i] - m) * (r[i] - m) + (gg[i] - m) * (gg[i] - m) + (b[i] - m) * (b[i] - m)) / 3) + 0.004;
      var E = Math.exp(-((r[i] - 0.5) * (r[i] - 0.5) + (gg[i] - 0.5) * (gg[i] - 0.5) + (b[i] - 0.5) * (b[i] - 0.5)) / (2 * 0.2 * 0.2 * 1.6));
      o[i] = C * S * E + 1e-12;
    }
    return o;
  }
  function fuse(ims) {
    var w = ims[0].w, h = ims[0].h, n = w * h, levels = Math.max(2, Math.floor(Math.log2(Math.min(w, h))) - 2);
    var W = ims.map(weights), tot = new Float32Array(n);
    W.forEach(function (a) { for (var i = 0; i < n; i++) tot[i] += a[i]; });
    W.forEach(function (a) { for (var i = 0; i < n; i++) a[i] /= tot[i]; });
    var WP = W.map(function (a) { return gaussPyr(a, w, h, levels); }), out = [];
    for (var c = 0; c < 3; c++) {
      var acc = null;
      ims.forEach(function (im, k) {
        var L = lapPyr(im.c[c], w, h, levels);
        if (!acc) acc = L.map(function (p) { return { a: new Float32Array(p.a.length), w: p.w, h: p.h }; });
        for (var l = 0; l < levels; l++) { var A = acc[l].a, P = L[l].a, G = WP[k][l].a; for (var i = 0; i < A.length; i++) A[i] += P[i] * G[i]; }
      });
      var r = acc[levels - 1];   // collapse
      for (var l2 = levels - 2; l2 >= 0; l2--) { var u = up(r.a, r.w, r.h, acc[l2].w, acc[l2].h), s = new Float32Array(u.length); for (var j = 0; j < s.length; j++) s[j] = u[j] + acc[l2].a[j]; r = { a: s, w: acc[l2].w, h: acc[l2].h }; }
      out.push(r.a);
    }
    return out;
  }
  // the fused picture to a canvas: stretched gently to the full range, a touch more colour
  function toCanvas(ch, w, h, sat) {
    var n = w * h, lo = [], hi = [];
    ch.forEach(function (a) { var s = []; for (var i = 0; i < n; i += 97) s.push(a[i]); s.sort(function (x, y) { return x - y; }); lo.push(s[Math.floor(s.length * 0.002)]); hi.push(s[Math.floor(s.length * 0.998)]); });
    var L = Math.min(lo[0], lo[1], lo[2]), H = Math.max(hi[0], hi[1], hi[2]), k = 1 / Math.max(0.2, H - L);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'), img = g.createImageData(w, h), px = img.data;
    for (var i2 = 0; i2 < n; i2++) {
      var r = (ch[0][i2] - L) * k, gg = (ch[1][i2] - L) * k, b = (ch[2][i2] - L) * k, m = 0.299 * r + 0.587 * gg + 0.114 * b;
      // a gentle S-curve on the brightness (fusion comes out a little flat), then a touch more colour
      var mc = m < 0 ? 0 : m > 1 ? 1 : m, m2 = mc * (1 - 0.3) + mc * mc * (3 - 2 * mc) * 0.3, f = m > 0.001 ? m2 / m : 1;
      r *= f; gg *= f; b *= f; m = m2;
      r = m + (r - m) * sat; gg = m + (gg - m) * sat; b = m + (b - m) * sat;
      px[i2 * 4] = Math.max(0, Math.min(255, r * 255 + 0.5)); px[i2 * 4 + 1] = Math.max(0, Math.min(255, gg * 255 + 0.5)); px[i2 * 4 + 2] = Math.max(0, Math.min(255, b * 255 + 0.5)); px[i2 * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function merge(blobs, maxEdge) {
    return Promise.all(blobs.map(function (b) { return load(b, maxEdge || 1600); })).then(function (ims) {
      var w = ims[0].w, h = ims[0].h;
      if (ims.some(function (im) { return im.w !== w || im.h !== h; })) return null;   // not one camera's bracket
      // the middle exposure is the reference; the others are lined up to it
      var G = ims.map(gray), order = G.map(function (g, i) { return [mean(g), i]; }).sort(function (a, b) { return a[0] - b[0]; });
      if (order[order.length - 1][0] - order[0][0] < 0.04) return null;   // all one exposure: a burst, not a bracket
      var ref = order[order.length >> 1][1], shifts = [];
      for (var i = 0; i < ims.length; i++) {
        if (i === ref) { shifts.push([0, 0]); continue; }
        var s = align(G[ref], G[i], w, h);
        if (Math.abs(s[0]) > w / 8 || Math.abs(s[1]) > h / 8) return null;
        if (s[0] || s[1]) shift(ims[i], s[0], s[1]);
        shifts.push(s);
        if (sameView(gray(ims[ref]), gray(ims[i]), w, h) < 0.6) return null;   // a different view, not a bracket
      }
      // only the part every shot covers: crop the edge the largest shift left empty
      var mx = Math.max.apply(0, shifts.map(function (s) { return Math.abs(s[0]); })), my = Math.max.apply(0, shifts.map(function (s) { return Math.abs(s[1]); }));
      var F = fuse(ims), c = toCanvas(F, w, h, 1.15);
      if (mx || my) { var c2 = document.createElement('canvas'); c2.width = w - 2 * mx; c2.height = h - 2 * my; c2.getContext('2d').drawImage(c, mx, my, c2.width, c2.height, 0, 0, c2.width, c2.height); c = c2; }
      return { canvas: c, w: c.width, h: c.height, shifts: shifts, order: order.map(function (o) { return o[1]; }) };   // order: the shots from darkest to brightest
    });
  }

  window.StudioHDR = { merge: merge };
})();
