/* STUDIO: the Social panel. From a Note that's already written, the pieces for Instagram and Facebook in
   their sizes: a carousel (1080x1350 slides: the cover with the brass nameplate, the photos, an end card),
   a Story (1080x1920) and a Reel (1080x1920 video of the photos and loops, with the start of the episode),
   plus the captions, drafted by Claude in the show's rules (field/SHOW-GUIDE.md, "Social posts").
   Everything is drawn in the browser from the Note's own photos, so nothing new is stored but the captions
   (E.social, saved with the Note). Saving hands the files to the phone's share sheet where it can (straight
   to Photos or Instagram), else downloads them. */
(function () {
  var KIND = { ride: 'Ride', hike: 'Hike', forage: 'Foraging walk', make: 'Mini-Cast' };
  var MONTHS = 'January February March April May June July August September October November December'.split(' ');
  var CW = 1080, CH = 1350, SW = 1080, SH = 1920, FPS = 30;
  var X, E, wrap$;          // the Studio's helpers (mount), the Note, the panel
  var slides = [], reelBlob = null, storyCanvas = null, imgs = {};

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  // ---------- what the Note has ----------
  function shown() { return (E.photos || []).filter(function (p) { return p.use !== 'skip'; }); }
  function coverOf() {   // as the share cards pick it: the one marked cover, else the first photo; a loop's poster
    var ph = shown();
    return ph.filter(function (p) { return p.cover; })[0] || ph.filter(function (p) { return !p.video; })[0] || ph[0] || null;
  }
  function line() {
    var d = (E.date || '').split('-'), when = d.length === 3 ? MONTHS[+d[1] - 1] + ' ' + (+d[2]) + ', ' + d[0] : '';
    return [KIND[E.kind] || '', when, (E.place || '').split(',')[0].trim()].filter(Boolean).join(' · ').toUpperCase();
  }
  function link() { return (X.cfg().siteUrl || 'https://www.christiangehrke.com/play/') + E.id + '/'; }
  function img(p) {   // a photo (or a loop's poster frame) as an image, loaded once
    var u = X.still(p);
    if (!imgs[u]) imgs[u] = new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { no(new Error('A photo didn\'t load.')); }; i.src = u; });
    return imgs[u];
  }

  // ---------- drawing ----------
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // the picture filling the frame (cropped), with a focus a little above the middle, and an optional zoom and pan
  function fill(g, im, x, y, w, h, zoom, panX, panY) {
    var s = Math.max(w / im.width, h / im.height) * (zoom || 1), iw = im.width * s, ih = im.height * s;
    var ox = (iw - w) * (panX == null ? .5 : panX), oy = (ih - h) * (panY == null ? .42 : panY);
    g.drawImage(im, x - ox, y - oy, iw, ih);
  }
  // the whole picture, on a blurred, darker copy of itself
  function fit(g, im, w, h) {
    g.save(); g.filter = 'blur(36px) brightness(.55)'; fill(g, im, -60, -60, w + 120, h + 120); g.restore();
    var s = Math.min(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s;
    g.drawImage(im, (w - iw) / 2, (h - ih) / 2, iw, ih);
  }
  function shade(g, w, h, from, a) {   // the lower part darkens so the plate stands out
    var gr = g.createLinearGradient(0, h * from, 0, h);
    gr.addColorStop(0, 'rgba(10,6,2,0)'); gr.addColorStop(1, 'rgba(10,6,2,' + a + ')');
    g.fillStyle = gr; g.fillRect(0, h * from, w, h * (1 - from));
  }
  function tlen(g, t, px, tr) { var n = 0; for (var i = 0; i < t.length; i++) n += g.measureText(t[i]).width; return n + tr * px * (t.length - 1); }
  function ttext(g, t, x, y, px, tr) { for (var i = 0; i < t.length; i++) { g.fillText(t[i], x, y); x += g.measureText(t[i]).width + tr * px; } }
  function lines(g, title, px, tr, width) {   // one line, or two balanced ones
    if (tlen(g, title, px, tr) <= width) return [title];
    var w = title.split(/\s+/), best = null;
    for (var i = 1; i < w.length; i++) {
      var a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(tlen(g, a, px, tr), tlen(g, b, px, tr));
      if (!best || m < best[0]) best = [m, [a, b]];
    }
    return best && best[0] <= width ? best[1] : null;
  }
  function vgrad(g, h, stops) { var gr = g.createLinearGradient(0, 0, 0, h); stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  // the brass nameplate of the share cards (field/tools/cards.py): a bevelled rim, a brushed face, an engraved
  // border, a rivet each end, the title cut in Cinzel and the kind, day and place under it. k scales it.
  function plate(title, sub, maxW, k) {
    var m = canvas(10, 10).getContext('2d'), tr = .1, px = 54 * k, ls = null;
    for (var s = 54; s >= 30; s -= 2) { px = s * k; m.font = '700 ' + px + 'px Cinzel'; ls = lines(m, title, px, tr, maxW - 130 * k); if (ls) break; }
    if (!ls) ls = [title];
    m.font = '700 ' + px + 'px Cinzel';
    var tw = Math.max.apply(null, ls.map(function (l) { return tlen(m, l, px, tr); }));
    var spx = 16 * k; m.font = '500 ' + spx + 'px Cinzel'; var sw = sub ? tlen(m, sub, spx, .16) : 0;
    var lh = px * 1.12, pw = Math.ceil(Math.max(tw, sw) + 130 * k), ph = Math.ceil(ls.length * lh + (sub ? spx : 0) + 60 * k);
    var c = canvas(pw, ph), g = c.getContext('2d'), r = 16 * k, b = 5 * k, i = 12 * k;
    g.fillStyle = vgrad(g, ph, [[0, '#f3dc9c'], [.4, '#7d5a24'], [.7, '#e3c47f'], [1, '#6b4a1c']]); rr(g, 0, 0, pw, ph, r); g.fill();
    g.save(); rr(g, b, b, pw - 2 * b, ph - 2 * b, r - b); g.clip();
    g.fillStyle = vgrad(g, ph, [[0, '#e2c483'], [.45, '#b8944f'], [.7, '#9a7a3c'], [1, '#caa865']]); g.fillRect(0, 0, pw, ph);
    g.fillStyle = 'rgba(255,255,255,.063)'; for (var x = b; x < pw; x += 2 * k) g.fillRect(x, 0, k, ph);   // brushed
    g.restore();
    g.lineWidth = 2 * k; g.strokeStyle = 'rgba(60,38,10,.59)'; rr(g, i, i, pw - 2 * i, ph - 2 * i, 8 * k); g.stroke();
    g.lineWidth = k; g.strokeStyle = 'rgba(255,240,200,.35)'; rr(g, i + 2 * k, i + 2 * k, pw - 2 * i - 4 * k, ph - 2 * i - 4 * k, 7 * k); g.stroke();
    [34 * k, pw - 34 * k].forEach(function (cx) {   // rivets
      var cy = ph / 2;
      [[9, '#3d2a10', 0, 0], [7, '#7a5a26', 0, 0], [4.5, '#fff1c8', -1, -2]].forEach(function (d) { g.beginPath(); g.arc(cx + d[2] * k, cy + d[3] * k, d[0] * k, 0, 7); g.fillStyle = d[1]; g.fill(); });
    });
    g.textBaseline = 'top'; g.font = '700 ' + px + 'px Cinzel';
    var y = 22 * k + px * .08;
    ls.forEach(function (l) {   // cut in: a light edge below, the dark letter on it
      var x0 = (pw - tlen(g, l, px, tr)) / 2;
      g.fillStyle = 'rgba(255,236,190,.67)'; ttext(g, l, x0, y + 1.5 * k, px, tr);
      g.fillStyle = '#2b1806'; ttext(g, l, x0, y, px, tr);
      y += lh;
    });
    if (sub) {
      g.font = '500 ' + spx + 'px Cinzel'; var x1 = (pw - sw) / 2;
      g.fillStyle = 'rgba(255,236,190,.5)'; ttext(g, sub, x1, y + 9 * k, spx, .16);
      g.fillStyle = '#4a3214'; ttext(g, sub, x1, y + 8 * k, spx, .16);
    }
    return c;
  }
  function putPlate(g, p, cx, cy) {
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 28; g.shadowOffsetY = 10;
    g.drawImage(p, Math.round(cx - p.width / 2), Math.round(cy - p.height / 2)); g.restore();
  }
  function kicker(g, text, cx, y, px) {   // small white capitals above the plate
    g.save(); g.font = '700 ' + px + 'px Cinzel'; g.textBaseline = 'top'; g.fillStyle = '#fff6df';
    g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 12; ttext(g, text, cx - tlen(g, text, px, .22) / 2, y, px, .22); g.restore();
  }
  function titleCard(g, im, w, h, plateY, k, kick) {
    fill(g, im, 0, 0, w, h); shade(g, w, h, .3, .72);
    var p = plate(E.title || 'Field Notes', line(), w - 120, k);
    if (kick) kicker(g, kick, w / 2, plateY - p.height / 2 - 22 * k - 26, 24 * k);
    putPlate(g, p, w / 2, plateY);
  }
  function endCard(g, im, w, h, k) {
    g.save(); g.filter = 'blur(30px) brightness(.5)'; fill(g, im, -60, -60, w + 120, h + 120); g.restore();
    var p = plate('The full story', 'AND THE EPISODE · LINK IN BIO', w - 160, k);
    kicker(g, 'FIELD NOTES', w / 2, h / 2 - p.height / 2 - 22 * k - 26, 24 * k);
    putPlate(g, p, w / 2, h / 2);
  }

  // ---------- the carousel ----------
  function planSlides() {
    var c = coverOf(), keep = {};
    slides.forEach(function (s) { keep[s.key] = s; });
    var list = [{ key: 'title', kind: 'title', p: c, on: true }];
    shown().forEach(function (p) {
      if (p === c && !p.strip) return;   // the cover opens the carousel already
      var k = X.name(p);
      list.push(keep[k] || { key: k, kind: 'photo', p: p, on: list.length < 9, mode: null });
    });
    list.push(keep.end || { key: 'end', kind: 'end', p: c, on: true });
    slides = list.map(function (s) { var o = keep[s.key]; return o ? Object.assign(o, { p: s.p }) : s; });
  }
  function drawSlide(s) {
    if (!s.c) s.c = canvas(CW, CH);
    var g = s.c.getContext('2d');
    return img(s.p).then(function (im) {
      g.clearRect(0, 0, CW, CH);
      if (s.kind === 'title') titleCard(g, im, CW, CH, CH * .74, 1.3);
      else if (s.kind === 'end') endCard(g, im, CW, CH, 1.3);
      else {
        if (!s.mode) s.mode = s.p.strip || im.width / im.height > 1.15 ? 'fit' : 'fill';   // wide pictures whole, the rest fill the frame
        if (s.mode === 'fit') fit(g, im, CW, CH); else fill(g, im, 0, 0, CW, CH);
      }
    });
  }
  function renderSlides() {
    var box = $('#socSlides', wrap$), on = slides.filter(function (s) { return s.on; }).length;
    box.innerHTML = slides.map(function (s, i) {
      return '<figure class="soc-sl' + (s.on ? '' : ' off') + '" data-i="' + i + '"><div class="soc-cv"></div><figcaption>' +
        '<label><input type="checkbox" data-on="' + i + '"' + (s.on ? ' checked' : '') + '> ' + (s.kind === 'title' ? 'Title' : s.kind === 'end' ? 'End card' : X.esc(X.name(s.p).replace(/\.(jpg|mp4)$/, '')) + (s.p.strip ? ' (strip)' : s.p.video ? ' (loop)' : '')) + '</label>' +
        (s.kind === 'photo' ? '<button type="button" class="soc-mode" data-mode="' + i + '">' + (s.mode === 'fit' ? 'Whole' : 'Fill') + '</button>' : '') + '</figcaption></figure>';
    }).join('');
    slides.forEach(function (s, i) { if (s.c) $('.soc-sl[data-i="' + i + '"] .soc-cv', box).appendChild(s.c); });
    $('#socCount', wrap$).textContent = on + ' of 10 slides' + (on > 10 ? ': Instagram takes 10 at most, untick some' : '');
    $$('[data-on]', box).forEach(function (b) { b.onchange = function () { slides[+b.getAttribute('data-on')].on = b.checked; renderSlides(); }; });
    $$('[data-mode]', box).forEach(function (b) {
      b.onclick = function () { var s = slides[+b.getAttribute('data-mode')]; s.mode = s.mode === 'fit' ? 'fill' : 'fit'; drawSlide(s).then(renderSlides); };
    });
  }

  // ---------- the Story ----------
  function drawStory() {
    storyCanvas = storyCanvas || canvas(SW, SH);
    var g = storyCanvas.getContext('2d');
    return img(coverOf()).then(function (im) { titleCard(g, im, SW, SH, SH * .6, 1.5, 'NEW FIELD NOTE'); });
  }

  // ---------- the Reel ----------
  // The title card, then each photo and loop in the post's order (photos pan or slowly zoom, loops play),
  // crossfading, then the end card; the episode's opening under it, fading out at the end. Recorded live
  // from a canvas, so it takes as long as the Reel runs.
  function reelItems() { return shown().filter(function (p) { return !p.strip; }); }
  function loadClip(p) {
    return fetch(X.clip(p), { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('A loop didn\'t load.'); return r.blob(); }).then(function (b) {
      return new Promise(function (ok, no) {
        var v = document.createElement('video'), t = setTimeout(function () { no(new Error('A loop took too long to load.')); }, 20000);
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
        v.oncanplay = function () { v.oncanplay = null; clearTimeout(t); ok(v); };
        v.onerror = function () { clearTimeout(t); no(new Error('This browser can\'t play a loop.')); };
        v.src = URL.createObjectURL(b); v.load();
      });
    });
  }
  function pickMime() {
    var t = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    for (var i = 0; i < t.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported(t[i])) return t[i];
    return '';
  }
  function makeReel() {
    var btn = $('#socReelGo', wrap$), st = $('#socReelState', wrap$), D = +$('#socLen', wrap$).value, withAudio = $('#socAudio', wrap$) && $('#socAudio', wrap$).checked;
    var mime = pickMime();
    if (!mime) { X.toast('This browser can\'t record video. Try Chrome or Safari.', true); return; }
    var items = reelItems(), cov = coverOf();
    if (!items.length || !cov) { X.toast('The Note needs photos first.', true); return; }
    var INTRO = 3, OUTRO = 2.6, FADE = .45, per = Math.max(1.8, Math.min(6, (D - INTRO - OUTRO) / items.length));
    items = items.slice(0, Math.max(1, Math.floor((D - INTRO - OUTRO) / per)));
    btn.disabled = true; st.textContent = 'Getting the photos and loops ready…';
    var c = canvas(SW, SH), g = c.getContext('2d'), prev = $('#socReelView', wrap$);
    prev.innerHTML = ''; c.className = 'soc-live'; prev.appendChild(c);
    var ac = null, audio = null;
    var still = function (p) { return img(p).then(function (im) { return { p: p, im: im }; }); };
    // a loop that won't play here (a browser without its video format) goes in as its poster frame
    Promise.all([img(cov), drawStory()].concat(items.map(function (p) { return p.video ? loadClip(p).then(function (v) { return { p: p, v: v }; }, function () { return still(p); }) : still(p); })))
      .then(function (r) {
        var covIm = r[0], segs = r.slice(2), t0 = INTRO;
        segs.forEach(function (s, i) { s.from = t0 + i * per; s.to = s.from + per; s.dir = i % 2 ? -1 : 1; });
        var end = INTRO + segs.length * per + OUTRO;
        // the episode's opening, if there is one, fading out over the last two seconds
        var aud = withAudio && E.episode && E.episode.audio ? fetch(X.audio(), { credentials: 'same-origin' }).then(function (x) { return x.ok ? x.blob() : null; }).catch(function () { return null; }) : Promise.resolve(null);
        return aud.then(function (ab) {
          var stream = c.captureStream(FPS), gain = null;
          if (ab) {
            ac = new (window.AudioContext || window.webkitAudioContext)();
            audio = new Audio(URL.createObjectURL(ab));
            var src = ac.createMediaElementSource(audio), dst = ac.createMediaStreamDestination(); gain = ac.createGain();
            src.connect(gain); gain.connect(dst);
            dst.stream.getAudioTracks().forEach(function (tk) { stream.addTrack(tk); });
          }
          var chunks = [], rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000 });
          rec.ondataavailable = function (ev) { if (ev.data.size) chunks.push(ev.data); };
          var draw = function (t) {
            g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH);
            var one = function (s, lt, a) {   // one photo or loop at local time lt (0..1)
              g.globalAlpha = a;
              if (s.v) { var vw = s.v.videoWidth, vh = s.v.videoHeight; if (vw) { if (vw / vh > 1.1) fill(g, s.v, 0, 0, SW, SH, 1, .5 + s.dir * (lt - .5) * .8, .5); else fill(g, s.v, 0, 0, SW, SH, 1.02 + .04 * lt); } }
              else if (s.im.width / s.im.height > 1.1) fill(g, s.im, 0, 0, SW, SH, 1, .5 + s.dir * (lt - .5) * .9, .45);   // wide: pan across
              else fill(g, s.im, 0, 0, SW, SH, 1 + .08 * lt);                                                                // tall: a slow zoom in
              g.globalAlpha = 1;
            };
            if (t < INTRO + FADE) g.drawImage(storyCanvas, 0, 0);
            segs.forEach(function (s, i) {
              if (t >= s.from && t < s.to + FADE) {
                if (s.v && s.v.paused) s.v.play().catch(function () {});
                one(s, Math.min(1, (t - s.from) / per), Math.min(1, (t - s.from) / FADE));
              } else if (s.v && !s.v.paused) s.v.pause();
            });
            var eo = end - OUTRO;
            if (t >= eo) { g.globalAlpha = Math.min(1, (t - eo) / FADE); endCard(g, covIm, SW, SH, 1.5); g.globalAlpha = 1; }
            if (gain) gain.gain.value = Math.max(0, Math.min(1, (end - t) / 2));
          };
          return new Promise(function (done) {
            rec.onstop = function () { done(new Blob(chunks, { type: mime.split(';')[0] })); };
            draw(0); rec.start(500); if (audio) audio.play().catch(function () {});
            var start = performance.now();
            var tick = function () {
              var t = (performance.now() - start) / 1000;
              if (t >= end) { draw(end); setTimeout(function () { rec.stop(); }, 120); return; }
              draw(t); st.textContent = 'Recording… ' + Math.ceil(end - t) + ' s to go. Keep this tab in front.';
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }).then(function (blob) { segs.forEach(function (s) { if (s.v) { s.v.pause(); URL.revokeObjectURL(s.v.src); } }); return blob; });
        });
      }).then(function (blob) {
        if (audio) audio.pause(); if (ac) ac.close();
        reelBlob = blob;
        var v = document.createElement('video'); v.controls = true; v.playsInline = true; v.src = URL.createObjectURL(blob); v.className = 'soc-live';
        prev.innerHTML = ''; prev.appendChild(v);
        st.textContent = 'Ready: ' + Math.round(blob.size / 1048576 * 10) / 10 + ' MB' + (/webm/.test(blob.type) ? '. This browser records WebM, which Instagram won\'t take; make it in Chrome or Safari for an MP4.' : '.');
        $('#socReelSave', wrap$).hidden = false;
      }).catch(function (err) { st.textContent = ''; X.toast(err.message, true); if (audio) audio.pause(); if (ac) ac.close(); })
      .then(function () { btn.disabled = false; });
  }

  // ---------- saving ----------
  function blobOf(c) { return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', .92); }); }
  var canShare = (function () { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] })); } catch (e) { return false; } })();
  // to the phone's share sheet (Save to Photos, or Instagram) where it can, else downloads one by one
  function deliver(files) {
    if (canShare && navigator.canShare({ files: files })) return navigator.share({ files: files }).catch(function (e) { if (e.name !== 'AbortError') X.toast(e.message, true); });
    files.forEach(function (f, i) {
      setTimeout(function () { var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); }, i * 350);
    });
    return Promise.resolve();
  }
  function saveCarousel() {
    var on = slides.filter(function (s) { return s.on; }).slice(0, 10);
    Promise.all(on.map(function (s) { return blobOf(s.c); })).then(function (bs) {
      return deliver(bs.map(function (b, i) { return new File([b], E.id + '-ig-' + String(i + 1).padStart(2, '0') + '.jpg', { type: 'image/jpeg' }); }));
    });
  }

  // ---------- captions ----------
  function social() { E.social = E.social || { instagram: '', tags: '', facebook: '' }; return E.social; }
  function captions() {
    var s = social(), box = $('#socCaps', wrap$);
    box.innerHTML =
      '<div class="row"><input id="socInstr" placeholder="Optional: e.g. lead with the drone shot, or more playful"><button type="button" id="socDraft" class="primary">Write the captions with Claude</button></div>' +
      '<label class="f"><span>Instagram</span><textarea id="socIg" rows="7">' + X.esc(s.instagram) + '</textarea></label>' +
      '<label class="f"><span>Hashtags</span><input id="socTags" value="' + X.esc(s.tags) + '"></label>' +
      '<div class="row"><button type="button" id="socCopyIg">Copy for Instagram</button><span class="muted" id="socIgN"></span></div>' +
      '<label class="f"><span>Facebook</span><textarea id="socFb" rows="7">' + X.esc(s.facebook) + '</textarea></label>' +
      '<div class="row"><button type="button" id="socCopyFb">Copy for Facebook</button><span class="muted">The link shows the Note\'s own card.</span></div>';
    var n = function () { var t = $('#socIg', box).value + '\n\n' + $('#socTags', box).value; $('#socIgN', box).textContent = t.length + ' / 2200 characters, ' + ($('#socTags', box).value.match(/#/g) || []).length + ' hashtags'; };
    [['socIg', 'instagram'], ['socTags', 'tags'], ['socFb', 'facebook']].forEach(function (x) { $('#' + x[0], box).addEventListener('input', function () { social()[x[1]] = this.value; X.dirty(); n(); }); });
    n();
    var copy = function (t, what) { navigator.clipboard.writeText(t).then(function () { X.toast(what + ' caption copied.'); }); };
    $('#socCopyIg', box).onclick = function () { copy(($('#socIg', box).value.trim() + '\n\n' + $('#socTags', box).value.trim()).trim(), 'Instagram'); };
    $('#socCopyFb', box).onclick = function () { copy($('#socFb', box).value.trim(), 'Facebook'); };
    $('#socDraft', box).onclick = function () {
      if (!E.id) { X.toast('Save the Note first, so it has its address.', true); return; }
      if (!E.post || !E.post.body) { X.toast('Write the post first: the captions come from it.', true); return; }
      var b = this; b.disabled = true; b.textContent = 'Writing… (about 20 seconds)';
      X.api('social', { note: { title: E.title, date: E.date, kind: E.kind, place: E.place, whoAppears: E.consent, summary: E.summary,
        post: { title: E.post.title, body: E.post.body }, photoCaptions: shown().map(function (p) { return p.caption || ''; }).filter(Boolean),
        link: link(), current: s.instagram ? s : null, instruction: $('#socInstr', box).value.trim() } })
        .then(function (j) {
          var o = j.social, t = social();
          t.instagram = o.instagram || ''; t.tags = (o.hashtags || []).map(function (h) { h = String(h).trim().replace(/\s+/g, ''); return h.charAt(0) === '#' ? h : '#' + h; }).join(' ');
          t.facebook = o.facebook || ''; X.dirty(); captions(); X.toast('Captions ready. Read them through, then Save.');
        }).catch(function (err) { X.toast(err.message, true); b.disabled = false; b.textContent = 'Write the captions with Claude'; });
    };
  }

  // ---------- the panel ----------
  function mount(el, helpers) {
    X = helpers; E = X.entry(); wrap$ = el; slides = []; reelBlob = null; storyCanvas = null;
    if (!coverOf()) { el.innerHTML = '<p class="muted">Add photos to the Note first: everything here is made from them.</p>'; return; }
    var hasAudio = !!(E.episode && E.episode.audio);
    el.innerHTML =
      '<p class="muted">Made from this Note\'s photos in Instagram\'s sizes. ' + (canShare ? 'Save sends them to your share sheet: Save to Photos, or straight to Instagram.' : 'Save downloads them; post from your phone, or open the Studio on it to share straight to Instagram.') + '</p>' +
      '<h3>Carousel <small>1080 × 1350</small></h3><p class="muted">Untick a slide to leave it out. Whole / Fill: the whole picture on a soft backdrop, or filling the frame.</p>' +
      '<div class="soc-slides" id="socSlides"></div><div class="row"><button type="button" class="primary" id="socSaveC">Save the carousel</button><span class="muted" id="socCount"></span></div>' +
      '<div class="soc-two"><div><h3>Story <small>1080 × 1920</small></h3><div class="soc-story" id="socStory"></div><div class="row"><button type="button" class="primary" id="socSaveS">Save the Story</button></div><p class="muted">Add a link sticker to the Note in Instagram; the bottom is left clear for it.</p></div>' +
      '<div><h3>Reel <small>1080 × 1920</small></h3><div class="soc-story" id="socReelView"><p class="soc-wait">The Reel shows here once it\'s made. It records live, so it takes as long as it runs.</p></div>' +
      '<div class="row"><label>Length <select id="socLen"><option value="15">15 s</option><option value="30" selected>30 s</option><option value="60">60 s</option></select></label>' +
      (hasAudio ? '<label><input type="checkbox" id="socAudio" checked> The episode\'s opening</label>' : '<span class="muted">No episode audio yet: it\'ll be silent, so add music in Instagram.</span>') + '</div>' +
      '<div class="row"><button type="button" class="primary" id="socReelGo">Make the Reel</button><button type="button" id="socReelSave" hidden>Save the Reel</button></div><p class="muted" id="socReelState"></p></div></div>' +
      '<h3>Captions</h3><div id="socCaps"></div>';
    planSlides();
    $('#socSaveC', el).onclick = saveCarousel;
    $('#socSaveS', el).onclick = function () { blobOf(storyCanvas).then(function (b) { deliver([new File([b], E.id + '-story.jpg', { type: 'image/jpeg' })]); }); };
    $('#socReelGo', el).onclick = makeReel;
    $('#socReelSave', el).onclick = function () { if (reelBlob) deliver([new File([reelBlob], E.id + '-reel.' + (/mp4/.test(reelBlob.type) ? 'mp4' : 'webm'), { type: reelBlob.type })]); };
    captions();
    var fonts = document.fonts ? Promise.all([document.fonts.load('700 40px Cinzel'), document.fonts.load('500 16px Cinzel')]).catch(function () {}) : Promise.resolve();
    fonts.then(function () {
      return Promise.all(slides.map(drawSlide)).then(renderSlides).then(drawStory).then(function () { $('#socStory', el).appendChild(storyCanvas); });
    }).catch(function (err) { X.toast(err.message, true); });
  }
  window.StudioSocial = { mount: mount };
})();
