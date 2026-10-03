/* STUDIO: the page. Lists entries, edits one, trims tracks and cleans photos in this browser
   (so the raw GPS track and the photos' location data never leave the device), asks Claude for a
   draft, and saves to GitHub through api.php. Plain JS, no build step. */
(function () {
  'use strict';
  var CSRF = document.body.getAttribute('data-csrf');
  var app = document.getElementById('app');
  var Track = window.FieldTrack;   // field/track.js, copied here at deploy
  var CFG = null, E = null, dirty = false;
  var fresh = {};     // name -> { blob, thumb (data URL), b64 } for photos not yet saved
  var removed = [];   // photo files to delete on save

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function toast(msg, bad) { var t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(t._h); t._h = setTimeout(function () { t.className = ''; }, bad ? 7000 : 3500); }
  function api(a, body, q) {
    var opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF }, body: JSON.stringify(body) } : {};
    return fetch('api.php?a=' + a + (q || ''), opt).then(function (r) {
      if (r.status === 401) { location.reload(); throw new Error('Logged out'); }
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('Error ' + r.status)); return j; });
    });
  }
  function slug(s) { return String(s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48); }
  function mi(km) { return Math.round(km * 0.621371 * 10) / 10; }
  function ft(m) { return Math.round(m * 3.28084); }
  function dur(s) { if (s == null) return ''; var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return (h ? h + ' h ' : '') + m + ' m'; }
  function words(s) { return (String(s || '').match(/\S+/g) || []).length; }
  function blobToB64(blob) { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1]); }; r.readAsDataURL(blob); }); }
  function markDirty() { dirty = true; var s = $('#saveState'); if (s) s.textContent = 'Unsaved changes'; }
  window.addEventListener('beforeunload', function (ev) { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } });

  // ---------- photos: EXIF date, resize, strip ----------
  // Reads DateTimeOriginal from a JPEG's EXIF (the only thing kept: the time, for ordering).
  function exifDate(file) {
    return file.slice(0, 131072).arrayBuffer().then(function (buf) {
      var v = new DataView(buf), o = 2;
      if (v.getUint16(0) !== 0xFFD8) return null;
      while (o < v.byteLength - 4) {
        var mk = v.getUint16(o), len = v.getUint16(o + 2);
        if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
          var t = o + 10, le = v.getUint16(t) === 0x4949;
          var u16 = function (p) { return v.getUint16(t + p, le); }, u32 = function (p) { return v.getUint32(t + p, le); };
          var str = function (p, n) { var s = ''; for (var i = 0; i < n - 1; i++) s += String.fromCharCode(v.getUint8(t + p + i)); return s; };
          var find = function (ifd, tag) { var n = u16(ifd); for (var i = 0; i < n; i++) { var e = ifd + 2 + i * 12; if (u16(e) === tag) return e; } return 0; };
          var ifd0 = u32(4), ex = find(ifd0, 0x8769), d = 0;
          if (ex) { var sub = u32(ex + 8); d = find(sub, 0x9003); }
          if (!d) d = find(ifd0, 0x0132);
          return d ? str(u32(d + 8), 20) : null;
        }
        o += 2 + len;
      }
      return null;
    }).catch(function () { return null; });
  }
  // Draws the photo upright into a canvas at most `max` px on the long edge and re-encodes it as a
  // JPEG: the canvas carries no EXIF, so GPS, camera serial and the rest are gone.
  function shrink(src, max, q) {
    var make = src instanceof Blob ? createImageBitmap(src, { imageOrientation: 'from-image' }) : Promise.resolve(src);
    return make.then(function (bm) {
      var k = Math.min(1, max / Math.max(bm.width, bm.height)), w = Math.round(bm.width * k), h = Math.round(bm.height * k);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(bm, 0, 0, w, h);
      return new Promise(function (ok) { c.toBlob(function (b) { ok({ blob: b, w: w, h: h }); }, 'image/jpeg', q); });
    });
  }
  function imgFromUrl(url) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = url; }); }
  function photoName(p) { return p.src.split('/').pop(); }
  function photoUrl(p) { var n = photoName(p); return fresh[n] ? fresh[n].thumb : 'api.php?a=photo&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(n); }

  // ---------- list ----------
  function showList() {
    if (dirty && !confirm('Leave without saving?')) return;
    dirty = false; E = null; fresh = {}; removed = [];
    history.replaceState(null, '', './');
    app.innerHTML = '<div class="head"><h1>Field Notes</h1><button id="new" class="primary">New entry</button></div><div id="list" class="cards"><p class="muted">Loading entries…</p></div>';
    $('#new').onclick = function () { edit(null); };
    api('list').then(function (j) {
      var st = {}; (CFG.statuses || []).forEach(function (s) { st[s.id] = s.label; });
      $('#list').innerHTML = j.entries.length ? j.entries.map(function (e) {
        return '<button class="card" data-id="' + esc(e.id) + '"><span class="st st-' + esc(e.status) + '">' + esc(st[e.status] || e.status) + '</span>' +
          '<b>' + esc(e.title || e.id) + '</b><small>' + esc(e.date) + ' · ' + esc(e.kind) + ' · ' + e.photos + ' photos</small><span class="sum">' + esc(e.summary) + '</span></button>';
      }).join('') : '<p class="muted">No entries yet.</p>';
      $$('.card', $('#list')).forEach(function (b) { b.onclick = function () { edit(b.getAttribute('data-id')); }; });
    }).catch(function (err) { $('#list').innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
  }

  // ---------- editor ----------
  function blank() {
    return { id: '', title: '', date: new Date().toISOString().slice(0, 10), kind: 'ride', place: '', status: 'notes', summary: '', trailhead: null, links: [], track: null, photos: [],
      fieldNotes: '', post: { title: '', body: '' }, episode: { title: '', script: '', audio: null }, questions: [], consent: '' };
  }
  function edit(id) {
    if (dirty && !confirm('Leave without saving?')) return;
    dirty = false; fresh = {}; removed = [];
    if (!id) { E = blank(); render(); return; }
    app.innerHTML = '<p class="muted">Opening…</p>';
    api('entry', null, '&id=' + encodeURIComponent(id)).then(function (j) {
      E = j.entry; E.post = E.post || { title: '', body: '' }; E.episode = E.episode || { title: '', script: '', audio: null }; E.questions = E.questions || []; E.photos = E.photos || [];
      history.replaceState(null, '', '?e=' + encodeURIComponent(id)); render();
    }).catch(function (err) { toast(err.message, true); showList(); });
  }

  function field(label, html, hint) { return '<label class="f"><span>' + label + '</span>' + html + (hint ? '<small>' + hint + '</small>' : '') + '</label>'; }
  function render() {
    var sOpts = (CFG.statuses || []).map(function (s) { return '<option value="' + s.id + '"' + (E.status === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('');
    var kOpts = ['ride', 'hike', 'forage', 'make'].map(function (k) { return '<option' + (E.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('');
    app.innerHTML =
      '<div class="head"><button class="back" id="back">← Entries</button><h1>' + esc(E.title || 'New entry') + '</h1></div>' +
      '<section class="panel grid2">' +
        field('Title', '<input id="title" value="' + esc(E.title) + '">') +
        field('Date', '<input id="date" type="date" value="' + esc(E.date) + '"' + (E.id ? ' disabled' : '') + '>', E.id ? 'The address is <code>' + esc(E.id) + '</code>' : 'Sets the address with the title, on first save') +
        field('Kind', '<select id="kind">' + kOpts + '</select>') +
        field('Place', '<input id="place" value="' + esc(E.place) + '" placeholder="Trailhead or public land, never closer to home">') +
        field('Status', '<select id="status">' + sOpts + '</select>', 'Published goes live on the next save') +
        field('Who appears', '<input id="consent" value="' + esc(E.consent || '') + '" placeholder="e.g. Christian and Marley only">') +
      '</section>' +
      '<section class="panel"><h2>Track</h2><div id="track"></div></section>' +
      '<section class="panel"><h2>Photos</h2><div id="drop-photos" class="drop">Drop photos here, or <label class="pick">choose<input type="file" accept="image/*" multiple hidden id="pickPhotos"></label>. They\'re resized and their location data removed before upload.</div><div id="photos" class="photos"></div></section>' +
      '<section class="panel"><h2>Your notes</h2>' + field('', '<textarea id="fieldNotes" rows="8" placeholder="What happened, in your words: who came, what you saw, what to leave out.">' + esc(E.fieldNotes) + '</textarea>') + '</section>' +
      '<section class="panel draft"><h2>Draft with Claude</h2><div class="row"><input id="instr" placeholder="Optional: e.g. shorter, or add the bit about the hammock"><button id="draft" class="primary">Draft with Claude</button></div>' +
        '<div id="questions"></div></section>' +
      '<section class="panel">' + field('Card summary', '<textarea id="summary" rows="2">' + esc(E.summary) + '</textarea>') + '</section>' +
      '<section class="panel"><h2>Post</h2>' + field('Title', '<input id="postTitle" value="' + esc(E.post.title) + '">') + field('Text', '<textarea id="postBody" rows="14">' + esc(E.post.body) + '</textarea>', 'First person. A blank line between paragraphs. End with "What I learned: …" when there is something real.') + '</section>' +
      '<section class="panel"><h2>Episode</h2>' + field('Title', '<input id="epTitle" value="' + esc(E.episode.title) + '">') + field('Script', '<textarea id="epScript" rows="16">' + esc(E.episode.script) + '</textarea>', '<span id="epCount"></span>') +
        '<div class="row"><button id="copyPrompt">Copy the audio prompt</button><span class="muted">' + (E.episode.audio ? 'Audio attached.' : 'Audio: render it with your voice tool, then hand the file to Claude Code to master and attach (Studio upload comes next).') + '</span></div></section>' +
      '<footer class="savebar"><span id="saveState" class="muted">' + (E.id ? 'Saved' : 'Not saved yet') + '</span><button id="save" class="primary">Save</button></footer>';

    $('#back').onclick = showList;
    ['title', 'place', 'consent', 'fieldNotes', 'summary', 'postTitle', 'postBody', 'epTitle', 'epScript'].forEach(function (k) { $('#' + k).addEventListener('input', markDirty); });
    ['kind', 'status', 'date'].forEach(function (k) { $('#' + k).addEventListener('change', markDirty); });
    $('#epScript').addEventListener('input', count); count();
    renderTrack(); renderPhotos(); renderQuestions();
    var dp = $('#drop-photos');
    ['dragover', 'dragenter'].forEach(function (t) { dp.addEventListener(t, function (ev) { ev.preventDefault(); dp.classList.add('on'); }); });
    dp.addEventListener('dragleave', function () { dp.classList.remove('on'); });
    dp.addEventListener('drop', function (ev) { ev.preventDefault(); dp.classList.remove('on'); addPhotos(ev.dataTransfer.files); });
    $('#pickPhotos').onchange = function () { addPhotos(this.files); this.value = ''; };
    $('#draft').onclick = draft;
    $('#save').onclick = save;
    $('#copyPrompt').onclick = function () {
      collect();
      var p = (CFG.audioPrompt || '').replace('{{title}}', E.episode.title || E.title).replace('{{script}}', E.episode.script);
      navigator.clipboard.writeText(p).then(function () { toast('Audio prompt copied.'); });
    };
  }
  function count() { var n = words($('#epScript').value); $('#epCount').textContent = n + ' words, about ' + (Math.round(n / 150 * 10) / 10) + ' minutes at the show\'s pace.'; }

  function collect() {
    E.title = $('#title').value.trim(); E.kind = $('#kind').value; E.place = $('#place').value.trim(); E.status = $('#status').value;
    E.consent = $('#consent').value.trim(); E.fieldNotes = $('#fieldNotes').value; E.summary = $('#summary').value.trim();
    E.post.title = $('#postTitle').value.trim(); E.post.body = $('#postBody').value.trim();
    E.episode.title = $('#epTitle').value.trim(); E.episode.script = $('#epScript').value.trim();
    if (!E.id) E.date = $('#date').value;
    $$('.ph').forEach(function (d) {
      var p = E.photos[+d.getAttribute('data-i')]; if (!p) return;
      p.caption = $('textarea', d).value.trim();
      p.use = $('.use', d).checked ? (p.use === 'skip' ? 'post' : (p.use || 'post')) : 'skip';
      p.cover = $('.cover', d).checked;
    });
  }

  // ---------- track ----------
  function renderTrack() {
    var t = E.track, box = $('#track');
    if (!t) {
      box.innerHTML = '<div id="drop-track" class="drop">Drop the Cyclemeter export (GPX or CSV) here, or <label class="pick">choose<input type="file" accept=".gpx,.csv,.txt,application/gpx+xml" hidden id="pickTrack"></label>. It\'s trimmed here in your browser: the raw track never leaves this device.</div>';
      var d = $('#drop-track');
      ['dragover', 'dragenter'].forEach(function (ty) { d.addEventListener(ty, function (ev) { ev.preventDefault(); d.classList.add('on'); }); });
      d.addEventListener('dragleave', function () { d.classList.remove('on'); });
      d.addEventListener('drop', function (ev) { ev.preventDefault(); d.classList.remove('on'); if (ev.dataTransfer.files[0]) addTrack(ev.dataTransfer.files[0]); });
      $('#pickTrack').onchange = function () { if (this.files[0]) addTrack(this.files[0]); };
      return;
    }
    var s = t.stats || {};
    box.innerHTML = '<div class="trackrow">' + mapSvg(t.line) + '<div class="stats">' +
      '<div><b>' + mi(s.distanceKm || 0) + ' mi</b><span>distance</span></div><div><b>' + ft(s.gainM || 0).toLocaleString() + ' ft</b><span>climbing</span></div>' +
      '<div><b>' + dur(s.movingSec) + '</b><span>moving</span></div><div><b>' + ft(s.maxEleM || 0).toLocaleString() + ' ft</b><span>high point</span></div></div></div>' +
      '<ul class="notes">' + ((t.trim && t.trim.notes) || []).map(function (n) { return '<li' + (/private zone|Warning/.test(n) ? ' class="warn"' : '') + '>' + esc(n) + '</li>'; }).join('') + '</ul>' +
      (t.homeWarning ? '<p class="err">' + esc(t.homeWarning) + '</p>' : '') +
      '<button id="dropTrack" class="link">Remove the track</button>';
    $('#dropTrack').onclick = function () { if (confirm('Remove the track from this entry?')) { E.track = null; E.trailhead = null; markDirty(); renderTrack(); } };
  }
  function mapSvg(line) {
    var pts = (line || []).filter(Boolean); if (pts.length < 2) return '<div class="map"></div>';
    var la = pts.map(function (p) { return p[0]; }), lo = pts.map(function (p) { return p[1]; });
    var a = Math.min.apply(0, la), b = Math.max.apply(0, la), c = Math.min.apply(0, lo), d = Math.max.apply(0, lo);
    var k = Math.cos((a + b) / 2 * Math.PI / 180), w = (d - c) * k || 1e-6, h = (b - a) || 1e-6, sc = 180 / Math.max(w, h);
    var segs = [], cur = [];
    (line || []).forEach(function (p) { if (!p) { if (cur.length) segs.push(cur); cur = []; } else cur.push(((p[1] - c) * k * sc + 10).toFixed(1) + ',' + ((b - p[0]) * sc + 10).toFixed(1)); });
    if (cur.length) segs.push(cur);
    return '<svg class="map" viewBox="0 0 ' + (w * sc + 20).toFixed(0) + ' ' + (h * sc + 20).toFixed(0) + '">' + segs.map(function (s) { return '<polyline points="' + s.join(' ') + '"/>'; }).join('') + '</svg>';
  }
  function addTrack(file) {
    file.text().then(function (txt) {
      var built = Track.build(txt, { kind: E.kind, trailheads: CFG.trailheads, privateZones: CFG.zones });
      var z = CFG.zones || [], raw = built.raw || [];
      var inZ = function (p) { return p && z.some(function (zz) { return Track.dist(zz, p) <= (zz.radius || 400); }); };
      var home = raw.length && (inZ(raw[0]) || inZ(raw[raw.length - 1]));
      E.track = { stats: built.stats, line: built.line, profile: built.profile, trim: built.trim };
      if (home) E.track.homeWarning = 'This starts or ends at home. By the show\'s rules, a ride from home is only told views-only: no track, no map, no distances. Remove the track before publishing unless you mean to.';
      E.trailhead = built.trim.startTrailhead || null;
      var th = (CFG.trailheads || []).filter(function (t) { return t.id === E.trailhead; })[0];
      if (!E.id && built.localDate) { E.date = built.localDate; $('#date').value = built.localDate; }
      if (!$('#place').value && th && th.area) $('#place').value = th.area;
      markDirty(); renderTrack(); toast('Track added and trimmed.');
    }).catch(function (err) { toast('Couldn\'t read that track: ' + err.message, true); });
  }

  // ---------- photos ----------
  function renderPhotos() {
    var box = $('#photos');
    box.innerHTML = E.photos.map(function (p, i) {
      var n = photoName(p), clip = !!p.video;
      return '<div class="ph' + (p.use === 'skip' ? ' off' : '') + '" data-i="' + i + '">' +
        (clip ? '<div class="clip">Clip ' + esc(n) + (p.table ? ' (on the table)' : '') + '</div>' : '<img src="' + esc(photoUrl(p)) + '" alt="" loading="lazy">') +
        '<div class="meta"><small>' + esc(n) + (p.takenAt ? ' · ' + esc(String(p.takenAt).slice(11, 16)) : '') + (fresh[n] ? ' · new' : '') + '</small>' +
        '<textarea rows="2" placeholder="Caption">' + esc(p.caption) + '</textarea>' +
        '<div class="opts"><label><input type="checkbox" class="use"' + (p.use !== 'skip' ? ' checked' : '') + '> Use</label>' +
        '<label><input type="radio" name="cover" class="cover"' + (p.cover ? ' checked' : '') + (clip ? ' disabled' : '') + '> Cover</label>' +
        '<button class="link rm">Remove</button></div></div></div>';
    }).join('');
    $$('.ph', box).forEach(function (d) {
      $('textarea', d).addEventListener('input', markDirty);
      $$('input', d).forEach(function (i) { i.addEventListener('change', function () { markDirty(); collect(); d.classList.toggle('off', !$('.use', d).checked); }); });
      $('.rm', d).onclick = function () {
        if (!confirm('Remove this photo from the entry?')) return;
        collect();
        var i = +d.getAttribute('data-i'), p = E.photos[i], n = photoName(p);
        if (fresh[n]) delete fresh[n]; else { removed.push(n); if (p.poster) removed.push(p.poster.split('/').pop()); }
        E.photos.splice(i, 1); markDirty(); renderPhotos();
      };
    });
  }
  function nextName() {
    var max = 0;
    E.photos.forEach(function (p) { var m = /^(\d{2})\./.exec(photoName(p)); if (m) max = Math.max(max, +m[1]); });
    removed.forEach(function (n) { var m = /^(\d{2})\./.exec(n); if (m) max = Math.max(max, +m[1]); });
    return String(max + 1).padStart(2, '0') + '.jpg';
  }
  function addPhotos(files) {
    collect();
    var list = [].slice.call(files).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|heic|png)$/i.test(f.name); });
    if (!list.length) return;
    toast('Preparing ' + list.length + ' photo' + (list.length > 1 ? 's' : '') + '…');
    var chain = Promise.resolve();
    list.forEach(function (f) {
      chain = chain.then(function () {
        return Promise.all([exifDate(f), shrink(f, 1600, 0.82)]).then(function (r) {
          var taken = r[0], big = r[1], n = nextName();
          return shrink(big.blob, 360, 0.7).then(function (th) {
            return blobToB64(th.blob).then(function (tb64) {
              fresh[n] = { blob: big.blob, thumb: 'data:image/jpeg;base64,' + tb64 };
              E.photos.push({ src: 'data/photos/' + (E.id || 'new') + '/' + n, caption: '', takenAt: taken, w: big.w, h: big.h, use: 'post', cover: !E.photos.some(function (p) { return p.cover; }), from: f.name });
            });
          });
        }).catch(function () { toast('Couldn\'t read ' + f.name + ' (if it\'s HEIC, export it as JPEG first).', true); });
      });
    });
    chain.then(function () {
      E.photos.sort(function (a, b) { return String(a.takenAt || '~').localeCompare(String(b.takenAt || '~')); });
      markDirty(); renderPhotos();
    });
  }

  // ---------- questions ----------
  function renderQuestions() {
    var q = E.questions || [];
    $('#questions').innerHTML = q.length ? '<h3>Open questions</h3><ul class="qs">' + q.map(function (s, i) { return '<li><span>' + esc(s) + '</span><button class="link" data-i="' + i + '">Done</button></li>'; }).join('') + '</ul><small class="muted">Answer them in your notes, then draft again. Mark one done once it\'s settled.</small>' : '';
    $$('#questions button').forEach(function (b) { b.onclick = function () { E.questions.splice(+b.getAttribute('data-i'), 1); markDirty(); renderQuestions(); }; });
  }

  // ---------- draft ----------
  function figures() {
    var t = E.track; if (!t) return null;
    var s = t.stats || {}, start = s.start ? new Date(s.start) : null;
    return { distanceMiles: mi(s.distanceKm || 0), climbingFeet: ft(s.gainM || 0), descentFeet: ft(s.lossM || 0), highPointFeet: ft(s.maxEleM || 0), lowPointFeet: ft(s.minEleM || 0),
      movingTime: dur(s.movingSec), totalTime: dur(s.elapsedSec), averageMph: Math.round((s.avgKmh || 0) * 0.621371 * 10) / 10, topSpeedMph: Math.round((s.maxKmh || 0) * 0.621371 * 10) / 10,
      startTimeLocal: start ? start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null, trackNotes: (t.trim && t.trim.notes) || [], homeWarning: t.homeWarning || null };
  }
  function thumbsForClaude() {
    var ps = E.photos.filter(function (p) { return !p.video && p.use !== 'skip'; }).slice(0, 12);
    return Promise.all(ps.map(function (p) {
      var n = photoName(p);
      var src = fresh[n] ? createImageBitmap(fresh[n].blob) : imgFromUrl(photoUrl(p));
      return src.then(function (im) { return shrink(im, 768, 0.75); }).then(function (r) { return blobToB64(r.blob); })
        .then(function (b64) { return { name: n, takenAt: p.takenAt ? String(p.takenAt).slice(11, 16) : null, b64: b64 }; });
    }));
  }
  function draft() {
    collect();
    if (!E.fieldNotes.trim() && !E.track && !E.photos.length) { toast('Add some notes, a track or photos first.', true); return; }
    var btn = $('#draft'); btn.disabled = true; btn.textContent = 'Drafting… (up to a minute)';
    thumbsForClaude().then(function (thumbs) {
      var facts = { title: E.title, date: E.date, kind: E.kind, place: E.place, whoAppears: E.consent, notes: E.fieldNotes, figures: figures(),
        photos: E.photos.filter(function (p) { return p.use !== 'skip'; }).map(function (p) { return { file: photoName(p), takenAt: p.takenAt || null, video: !!p.video, caption: p.caption || '' }; }),
        currentDraft: (E.post.body || E.episode.script) ? { summary: E.summary, post: E.post, episode: { title: E.episode.title, script: E.episode.script } } : null,
        instruction: $('#instr').value.trim() };
      return api('draft', { facts: facts, thumbs: thumbs });
    }).then(function (j) {
      var d = j.draft;
      $('#summary').value = d.summary || ''; $('#postTitle').value = d.post_title || ''; $('#postBody').value = d.post_body || '';
      $('#epTitle').value = d.episode_title || ''; $('#epScript').value = d.episode_script || ''; count();
      collect();
      (d.captions || []).forEach(function (c) { E.photos.forEach(function (p) { if (photoName(p) === c.photo && !p.caption) p.caption = c.caption; }); });
      if (d.cover && E.photos.some(function (p) { return photoName(p) === d.cover; }) && !E.photos.some(function (p) { return p.cover; })) E.photos.forEach(function (p) { p.cover = photoName(p) === d.cover; });
      E.questions = d.questions || [];
      if (!E.title && d.post_title) { E.title = d.post_title; $('#title').value = d.post_title; }
      markDirty(); renderPhotos(); renderQuestions(); toast('Draft ready. Read it through, then Save.');
    }).catch(function (err) { toast(err.message, true); })
      .then(function () { btn.disabled = false; btn.textContent = 'Draft with Claude'; });
  }

  // ---------- save ----------
  function save() {
    collect();
    if (!E.title) { toast('Give it a title first.', true); return; }
    if (E.status === 'published') {
      if (E.track && E.track.homeWarning && !confirm('This track starts or ends at home. Publish it with the map anyway?')) return;
      if ((E.questions || []).length && !confirm('There are still open questions. Publish anyway?')) return;
    }
    var first = !E.id;
    if (first) {
      E.id = E.date + '-' + (slug(E.title) || E.kind);
      E.photos.forEach(function (p) { p.src = 'data/photos/' + E.id + '/' + photoName(p); });
    }
    var btn = $('#save'); btn.disabled = true; btn.textContent = 'Saving…';
    var names = Object.keys(fresh), uploaded = [];
    var chain = Promise.resolve();
    names.forEach(function (n, i) {
      chain = chain.then(function () {
        btn.textContent = 'Uploading photo ' + (i + 1) + ' of ' + names.length + '…';
        return blobToB64(fresh[n].blob).then(function (b64) { return api('blob', { b64: b64 }); }).then(function (r) { uploaded.push({ name: n, sha: r.sha }); });
      });
    });
    chain.then(function () {
      btn.textContent = 'Saving…';
      return api('save', { entry: E, newPhotos: uploaded, removePhotos: removed });
    }).then(function () {
      fresh = {}; removed = []; dirty = false;
      $('#saveState').textContent = E.status === 'published' ? 'Saved and publishing: live in about a minute' : 'Saved';
      if (first) { history.replaceState(null, '', '?e=' + encodeURIComponent(E.id)); render(); }
      toast(E.status === 'published' ? 'Saved. The site updates in about a minute.' : 'Saved.');
    }).catch(function (err) {
      if (first) { E.id = ''; }
      toast('Not saved: ' + err.message, true);
    }).then(function () { var b = $('#save'); if (b) { b.disabled = false; b.textContent = 'Save'; } });
  }

  // ---------- start ----------
  api('config').then(function (c) {
    CFG = c;
    var m = /[?&]e=([^&]+)/.exec(location.search);
    if (m) edit(decodeURIComponent(m[1])); else showList();
  }).catch(function (err) { app.innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
})();
