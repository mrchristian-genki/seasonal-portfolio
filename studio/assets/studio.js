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
  var audioNew = null, audioGone = false;   // the episode's MP3: one attached since the last save, or removed
  var DRIVEAUD = null;                      // audio files in the note's Drive folder (null until looked up)
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
  function dur(s) { if (s == null) return ''; var t = Math.round(s / 60), h = Math.floor(t / 60), m = t % 60; return (h ? h + ' h ' : '') + m + ' m'; }
  function words(s) { return (String(s || '').match(/\S+/g) || []).length; }
  function blobToB64(blob) { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1]); }; r.readAsDataURL(blob); }); }
  function markDirty() { dirty = true; var s = $('#saveState'); if (s) s.textContent = 'Unsaved changes'; if (typeof renderNext === 'function') renderNext(); }
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

  // ---------- where we are: the view sits in the address (#notes, #note/<id>, #new), before the time of
  // day that switch.js keeps at the end. A new view adds a step to history, so Back and Forward work ----------
  var here = '', starting = true;
  function route(v, replace) {
    here = v; replace = replace || starting; starting = false;     // a page's first view replaces, never adds
    if (window.StudioHash) StudioHash.go(v, replace);
    else history.replaceState(null, '', location.pathname + '#' + v);
  }
  function open(v) {
    var m = /^note\/(.+)$/.exec(v || '');
    if (m) return edit(m[1]);
    if (v === 'new') return edit(null);
    return showList();
  }
  function listen() {                    // Back and Forward (switch.js loads after this file, so at start)
    if (window.StudioHash) StudioHash.onview(function (v) {
      if (v === here) return;
      if (dirty && !confirm('Leave without saving?')) { StudioHash.go(here); return; }
      dirty = false; open(v);
    });
  }

  // ---------- list ----------
  function showList() {
    if (dirty && !confirm('Leave without saving?')) return;
    dirty = false; E = null; fresh = {}; removed = []; INBOX = null; audioNew = null; audioGone = false; DRIVEAUD = null;
    route('notes');
    app.innerHTML = '<div class="head"><h1>Field Notes</h1><button id="new" class="primary">New entry</button></div><section id="drive" class="panel drive"><p class="muted">Checking Google Drive…</p></section><div id="list" class="cards"><p class="muted">Loading entries…</p></div>';
    $('#new').onclick = function () { edit(null); };
    driveStatus();
    api('list').then(function (j) {
      ENTRIES = j.entries; if (lastDrive) renderDrive(lastDrive);
      var st = {}; (CFG.statuses || []).forEach(function (s) { st[s.id] = s.label; });
      $('#list').innerHTML = j.entries.length ? j.entries.map(function (e) {
        return '<button class="card" data-id="' + esc(e.id) + '"><span class="st st-' + esc(e.status) + '">' + esc(st[e.status] || e.status) + '</span>' +
          '<b>' + esc(e.title || e.id) + '</b><small>' + esc(e.date) + ' · ' + esc(e.kind) + ' · ' + e.photos + ' photos</small><span class="sum">' + esc(e.summary) + '</span></button>';
      }).join('') : '<p class="muted">No entries yet.</p>';
      $$('.card', $('#list')).forEach(function (b) { b.onclick = function () { edit(b.getAttribute('data-id')); }; });
    }).catch(function (err) { $('#list').innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
  }

  // ---------- Google Drive: new files come to the server with rclone (one way, never deletes) ----------
  var drivePoll = null, lastDrive = null, ENTRIES = null, INBOX = null;
  function size(b) { return b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : b >= 1048576 ? Math.round(b / 1048576) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function when(t) { return t ? new Date(t * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; }
  function driveStatus() {
    clearTimeout(drivePoll);
    if (!$('#drive')) return;
    api('drive').then(renderDrive).catch(function (err) { var d = $('#drive'); if (d) d.innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
  }
  function renderDrive(j) {
    lastDrive = j;
    var d = $('#drive'); if (!d) return;
    var names = j.folders.map(function (f) { return '“' + esc(f) + '”'; }).join(', ');
    var line;
    if (j.running) line = 'Bringing in new files… ' + esc(j.progress || 'starting') + (j.copiedCount ? ' · ' + j.copiedCount + ' copied so far' : '');
    else if (j.finished) line = (j.ok ? 'Last brought in ' : 'Last try stopped with a problem, ') + esc(when(j.finished)) + (j.ok ? ' · ' + (j.copiedCount ? j.copiedCount + ' new file' + (j.copiedCount === 1 ? '' : 's') : 'nothing new') : '');
    else line = 'Not brought in yet.';
    // folders, plus loose files only once they belong to a note (the rest is left for tidying in Drive)
    var items = j.inbox.filter(function (f) { return f.dir || f.note; });
    var inbox = items.length ? '<ul class="inbox">' + items.slice(0, 30).map(inboxRow).join('') + '</ul>' : '';
    d.innerHTML = '<div class="drive-head"><div><h2>Google Drive</h2><p class="muted">Watching ' + names + '. New files are copied to the server; nothing is deleted on either side.</p></div>' +
      '<button id="driveGo" class="primary"' + (j.running || !j.ready ? ' disabled' : '') + '>' + (j.running ? 'Bringing in…' : 'Bring in from Drive') + '</button></div>' +
      (j.problem ? '<p class="err">' + esc(j.problem) + '</p>' : '<p class="drive-line">' + line + '</p>') +
      (j.errors.length ? '<p class="err">' + j.errors.map(esc).join('<br>') + '</p>' : '') + inbox;
    var b = $('#driveGo');
    if (b) b.onclick = function () {
      b.disabled = true; b.textContent = 'Starting…';
      api('drive', {}).then(renderDrive).catch(function (err) { toast(err.message, true); driveStatus(); });
    };
    $$('.inbox .open', d).forEach(function (b) { b.onclick = function () { edit(b.getAttribute('data-id')); }; });
    $$('.inbox .process', d).forEach(function (b) {
      b.onclick = function () {
        if (b.classList.contains('add')) addNew(b.getAttribute('data-src'), b.getAttribute('data-id'), +b.getAttribute('data-at'));
        else processFolder(b.getAttribute('data-src'));
      };
    });
    if (j.running) drivePoll = setTimeout(driveStatus, 4000);
  }

  // one inbox item: its date, what's in it, and where it stands (new, draft, published, updated since)
  function inboxRow(f) {
    var note = noteFor(f), day = f.date || guessDate(f.name), c = f.count || {};
    var what = [['photo', 'photo'], ['video', 'video'], ['track', 'track'], ['text', 'note'], ['audio', 'audio file']].filter(function (k) { return c[k[0]]; })
      .map(function (k) { return c[k[0]] + ' ' + k[1] + (c[k[0]] === 1 ? '' : 's'); }).join(' · ') || (f.files + ' files');
    var st = {}; (CFG.statuses || []).forEach(function (s) { st[s.id] = s.label; });
    var badge, act = '';
    if (!note) { badge = '<span class="st st-new">New</span>'; act = '<button class="process" data-src="' + esc(f.source) + '">Process</button>'; }
    else {
      badge = '<span class="st st-' + esc(note.status || 'notes') + '">' + esc(st[note.status] || note.status || 'Note') + '</span>';
      if (f.since) badge += '<span class="st st-updated">' + f.since + ' new since</span>';
      act = '<button class="link open" data-id="' + esc(note.id) + '">Open “' + esc(note.title || note.id) + '”</button>' +
        (f.since ? '<button class="process add" data-src="' + esc(f.source) + '" data-id="' + esc(note.id) + '" data-at="' + ((f.note && f.note.at) || 0) + '">Add ' + f.since + ' new</button>' : '');
    }
    var label = f.dir ? esc(f.name) : 'Loose files';
    return '<li><div class="in-top">' + badge + '<small>' + (day ? esc(new Date(day + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })) : 'No date') + '</small></div>' +
      '<b>' + label + '</b><small>' + what + ' · ' + size(f.bytes) + '</small><div class="in-act">' + act + '</div></li>';
  }

  // ---------- the loader: the reactor panel fills as the Studio works ----------
  // The video isn't played: it's moved to the frame that matches how far along the work is, so the green
  // fuel rises with real progress and the tube is full exactly when the work is. A clean scale, status tag
  // and plaque are drawn over the video's own, and the steps tick off below in green phosphor.
  // var L = loader('Processing', ['Read the folder', 'Bring in photos', 'Draft with Claude'], 'folder name');
  // L.at(1, '4–6 of 12') marks a step under way (earlier ones done); L.done() / L.fail(message) close it.
  // fetch the loader's video quietly once the page has settled, so it's ready before the first Process
  addEventListener('load', function () {
    setTimeout(function () { var l = document.createElement('link'); l.rel = 'prefetch'; l.href = RX.src; document.head.appendChild(l); }, 6000);
  });
  var RX = { src: 'assets/loader/reactor-loop.mp4', webm: 'assets/loader/reactor-loop.webm', poster: 'assets/loader/reactor-start.jpg' };
  function loader(title, steps, sub) {
    var el = document.createElement('div'); el.className = 'loader'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-live', 'polite');
    var marks = [100, 75, 50, 25, 0].map(function (n) { return '<span class="rx-mark" style="--at:' + n + '"><i></i>' + n + '%</span>'; }).join('');
    el.innerHTML = '<div class="ld-card"><div class="rx">' +
        // the empty reactor is the backdrop; a short loop of the full, bubbling tube plays over it, shown only
        // up to the fuel level inside the tube, while its glow on the rest of the panel brightens with it
        '<video class="rx-glow" muted playsinline loop autoplay preload="auto"><source src="' + RX.src + '" type="video/mp4"><source src="' + RX.webm + '" type="video/webm"></video>' +
        '<video class="rx-fuel" muted playsinline loop autoplay preload="auto"><source src="' + RX.src + '" type="video/mp4"><source src="' + RX.webm + '" type="video/webm"></video>' +
        '<span class="rx-surface" aria-hidden="true"></span>' +
        '<div class="rx-top"><h2>' + esc(title) + '</h2>' + (sub ? '<p class="ld-sub">' + esc(sub) + '</p>' : '') + '<p class="rx-now"></p></div>' +
        '<div class="rx-scale" aria-hidden="true"><div class="rx-lit"></div>' + marks + '</div>' +
        '<div class="rx-tag" aria-hidden="true">STATUS: <b>EMPTY</b></div>' +
        '<div class="rx-plate" aria-hidden="true"><span>FIELD NOTES · STUDIO</span><b>FUEL LOAD 000%</b></div>' +
      '</div>' +
      '<ol class="ld-steps">' + steps.map(function (s) { return '<li><span class="ld-dot"></span><span class="ld-name">' + esc(s) + '</span><small></small></li>'; }).join('') + '</ol>' +
      '<p class="ld-hold">Hold on a moment, this page is working.</p></div>';
    document.body.appendChild(el); document.body.classList.add('busy');
    requestAnimationFrame(function () { el.classList.add('on'); });
    var items = $$('.ld-steps li', el), cur = -1, shown = 0;
    var now = $('.rx-now', el), tag = $('.rx-tag b', el), plate = $('.rx-plate b', el), rx = $('.rx', el);
    var calmMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    $$('video', el).forEach(function (v) {
      v.muted = true; v.playsInline = true;
      if (calmMotion) { v.removeAttribute('autoplay'); v.pause(); return; }
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    });
    function show(frac) {
      frac = Math.max(shown, Math.min(1, frac)); shown = frac;
      rx.style.setProperty('--fill', frac.toFixed(3));
      var pct = String(Math.round(frac * 100)).padStart(3, '0');
      plate.textContent = 'FUEL LOAD ' + pct + '%';
      tag.textContent = frac >= 1 ? 'READY' : frac > 0 ? 'LOADING' : 'EMPTY';
    }
    function live() { return items.filter(function (li) { return !li.classList.contains('skipped'); }).length || 1; }
    function close(ms) {
      setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 300); }, ms);
      document.body.classList.remove('busy');
    }
    show(0);
    return {
      at: function (i, detail) {
        for (var k = 0; k < items.length; k++) { items[k].classList.toggle('done', k < i); items[k].classList.toggle('now', k === i); }
        cur = i; if (detail != null && items[i]) $('small', items[i]).textContent = detail;
        if (items[i]) now.textContent = $('.ld-name', items[i]).textContent + ($('small', items[i]).textContent ? ' · ' + $('small', items[i]).textContent : '');
        var before = items.slice(0, i).filter(function (li) { return !li.classList.contains('skipped'); }).length;
        var m = /(\d+)\s*of\s*(\d+)/.exec(detail || ''), part = m ? +m[1] / +m[2] : 0;
        show((before + part) / live());
      },
      skip: function (i) { if (items[i]) items[i].classList.add('skipped'); },
      done: function () {
        items.forEach(function (li) { if (!li.classList.contains('skipped')) { li.classList.remove('now'); li.classList.add('done'); } });
        now.textContent = 'Complete'; show(1); el.classList.add('complete'); close(1300);
      },
      fail: function (msg) {
        el.classList.add('failed'); tag.textContent = 'FAULT';
        if (items[cur]) { items[cur].classList.remove('now'); items[cur].classList.add('bad'); $('small', items[cur]).textContent = msg; now.textContent = msg; }
        close(3200);
      }
    };
  }

  // ---------- Process Content: an inbox folder becomes a new draft note ----------
  var MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
  function pad(n) { return String(n).padStart(2, '0'); }
  // a date in the folder name: 2026-10-03, Sep-5-2024, March_28_2026, 9-5-2024
  function guessDate(name) {
    var m = /(\d{4})-(\d{2})-(\d{2})/.exec(name);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s_.,-]+(\d{1,2})(?:st|nd|rd|th)?[\s_.,-]+(\d{4})/i.exec(name);
    if (m) return m[3] + '-' + pad(MONTHS.indexOf(m[1].toLowerCase()) + 1) + '-' + pad(m[2]);
    m = /\b(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})\b/.exec(name);
    if (m) return m[3] + '-' + pad(m[1]) + '-' + pad(m[2]);
    return null;
  }
  // whatever's left of the folder name once the date, a time and words like "images" are gone
  function guessTitle(name) {
    var t = name.replace(/\d{4}-\d{2}-\d{2}/, ' ')
      .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s_.,-]+\d{1,2}(st|nd|rd|th)?[\s_.,-]+\d{4}/i, ' ')
      .replace(/\b\d{1,2}[-_.]\d{1,2}[-_.]\d{4}\b/, ' ').replace(/\b\d{3,4}\b/g, ' ')
      .replace(/\b(images?|photos?|pics?|videos?|files?|new)\b/gi, ' ').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }
  // the note an inbox folder became (remembered when it was saved), or one already on that day
  function noteFor(f) {
    var list = ENTRIES || [];
    if (f.note) return list.filter(function (e) { return e.id === f.note.id; })[0] || { id: f.note.id, title: '' };
    var d = f.date || guessDate(f.name);
    return d ? list.filter(function (e) { return e.date === d; })[0] || null : null;
  }
  function fromInbox(src, f) {
    return fetch('api.php?a=inboxfile&f=' + encodeURIComponent(src) + '&n=' + encodeURIComponent(f.name)).then(function (r) {
      if (!r.ok) throw new Error('Couldn\'t fetch ' + f.name);
      return r.blob();
    }).then(function (b) { return new File([b], f.name.split('/').pop(), { type: b.type, lastModified: f.changed * 1000 }); });
  }
  // photos and the track from an inbox item, a few at a time, telling the loader how far along it is
  function bringIn(src, photos, track, L, stepTrack, stepPhotos) {
    var chain = Promise.resolve();
    if (track) chain = chain.then(function () { L.at(stepTrack, track.name.split('/').pop()); return fromInbox(src, track).then(addTrack); });
    else L.skip(stepTrack);
    var n = 0;
    for (var i = 0; i < photos.length; i += 6) (function (batch) {
      chain = chain.then(function () {
        L.at(stepPhotos, (n + 1) + '–' + (n + batch.length) + ' of ' + photos.length);
        return Promise.all(batch.map(function (f) { return fromInbox(src, f); })).then(addPhotos).then(function () { n += batch.length; });
      });
    })(photos.slice(i, i + 6));
    if (!photos.length) L.skip(stepPhotos);
    return chain;
  }
  function processFolder(src) {
    if (dirty && !confirm('Leave without saving?')) return;
    var label = src.split('/').slice(1).join('/').replace(/^#/, '');
    var L = loader('Processing', ['Read the folder', 'Bring in the track', 'Bring in the photos', 'Claude drafts the note', 'Ready for you to read'], label);
    L.at(0);
    api('inbox', null, '&f=' + encodeURIComponent(src)).then(function (j) {
      INBOX = j; dirty = false; fresh = {}; removed = []; audioNew = null; audioGone = false; DRIVEAUD = null;
      var name = src.split('/').slice(1).join('/').replace(/^#/, ''), when = guessDate(name);
      E = blank(); savedStatus = null; E.source = src; E.title = guessTitle(name); E.fieldNotes = j.notes || '';
      if (when) E.date = when;
      render();
      var photos = j.files.filter(function (f) { return f.kind === 'photo'; }).slice(0, 40);
      var track = j.files.filter(function (f) { return f.kind === 'track'; })[0];
      return bringIn(src, photos, track, L, 1, 2).then(function () {
        if (!when && !E.track) {   // no date in the name or a track: the earliest photo's day
          var t = E.photos.map(function (p) { return p.takenAt; }).filter(Boolean).sort()[0];
          if (t) { E.date = String(t).slice(0, 10); var di = $('#date'); if (di) di.value = E.date; }
        }
        if (!(E.fieldNotes.trim() || E.track || E.photos.length)) { L.skip(3); return; }
        L.at(3, 'up to a minute');
        return draft({ loader: L });
      }).then(function () { L.at(4); L.done(); });
    }).catch(function (err) { L.fail(err.message); toast(err.message, true); });
  }
  // files that reached an inbox item after its note was made: open the note and bring just those in
  function addNew(src, id, since) {
    var L = loader('Adding new files', ['Open the note', 'Bring in the track', 'Bring in the new photos', 'Ready for you to read']);
    L.at(0);
    Promise.all([api('inbox', null, '&f=' + encodeURIComponent(src)), edit(id)]).then(function (r) {
      var j = r[0]; if (!E || E.id !== id) return;
      INBOX = j; E.source = src;
      var later = j.files.filter(function (f) { return f.arrived > since; });
      var photos = later.filter(function (f) { return f.kind === 'photo'; }), track = !E.track && later.filter(function (f) { return f.kind === 'track'; })[0];
      render();
      if (!photos.length && !track) { L.done(); toast('Nothing new to bring in here: the new files are ' + later.map(function (f) { return f.kind; }).join(', ') + '.'); markDirty(); return; }
      return bringIn(src, photos, track, L, 1, 2).then(function () { L.at(3); L.done(); toast('Added. Draft again if you like, then Save.'); });
    }).catch(function (err) { L.fail(err.message); toast(err.message, true); });
  }
  function inboxPanel() {
    if (!E.source || !INBOX || INBOX.source !== E.source) return E.source ? '<section class="panel from"><p class="muted">Made from the Drive folder <b>' + esc(E.source) + '</b>.</p></section>' : '';
    var later = INBOX.files.filter(function (f) { return f.kind === 'video'; }), aud = INBOX.files.filter(function (f) { return f.kind === 'audio'; });
    var other = INBOX.files.filter(function (f) { return f.kind === 'other'; });
    return '<section class="panel from"><h2>From Drive: ' + esc(E.source) + '</h2>' +
      '<p class="muted">' + (E.id ? 'New photos from this folder are added below. Draft again if you like, then Save to keep them.'
        : 'Photos' + (INBOX.files.some(function (f) { return f.kind === 'track'; }) ? ', the track' : '') + (INBOX.notes ? ' and your text notes' : '') + ' are brought in below, then Claude drafts it. Read it through and Save.') + '</p>' +
      (later.length ? '<p><b>Waiting for the video step</b> (they stay on the server):</p><ul class="later">' + later.map(function (f) { return '<li>' + esc(f.name) + ' <small>' + size(f.bytes) + '</small></li>'; }).join('') + '</ul>' : '') +
      (aud.length ? '<p class="muted">Audio (' + aud.map(function (f) { return esc(f.name); }).join(', ') + '): choose what each file is under Episode, in <b>Audio from Drive</b>. Voice notes play above your notes.</p>' : '') +
      (other.length ? '<p class="muted">Not used: ' + other.map(function (f) { return esc(f.name); }).join(', ') + '</p>' : '') + '</section>';
  }

  // ---------- editor ----------
  function blank() {
    return { id: '', title: '', date: new Date().toISOString().slice(0, 10), kind: 'ride', place: '', status: 'notes', summary: '', trailhead: null, links: [], track: null, photos: [],
      fieldNotes: '', post: { title: '', body: '' }, episode: { title: '', script: '', audio: null }, questions: [], consent: '' };
  }
  function edit(id) {
    if (dirty && !confirm('Leave without saving?')) return;
    dirty = false; fresh = {}; removed = []; audioNew = null; audioGone = false; DRIVEAUD = null;
    if (!id) { E = blank(); savedStatus = null; route('new'); render(); return Promise.resolve(); }
    app.innerHTML = '<p class="muted">Opening…</p>';
    return api('entry', null, '&id=' + encodeURIComponent(id)).then(function (j) {
      E = j.entry; savedStatus = E.status; E.post = E.post || { title: '', body: '' }; E.episode = E.episode || { title: '', script: '', audio: null }; E.questions = E.questions || []; E.photos = E.photos || [];
      route('note/' + id); render();
    }).catch(function (err) { toast(err.message, true); showList(); });
  }

  function field(label, html, hint) { return '<label class="f"><span>' + label + '</span>' + html + (hint ? '<small>' + hint + '</small>' : '') + '</label>'; }
  function render() {
    // a note made from a Drive folder, or already saved, has its content: the drop zones wait at the bottom
    var later = !!(E.id || E.source), trackTop = !later || !!E.track;
    var dropPhotos = '<div id="drop-photos" class="drop">Drop photos here, or <label class="pick">choose<input type="file" accept="image/*" multiple hidden id="pickPhotos"></label>. They\'re resized and their location data removed before upload.</div>';
    var sOpts = (CFG.statuses || []).map(function (s) { return '<option value="' + s.id + '"' + (E.status === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('');
    var kOpts = ['ride', 'hike', 'forage', 'make'].map(function (k) { return '<option' + (E.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('');
    app.innerHTML =
      '<div class="head"><button class="back" id="back">← Entries</button><h1>' + esc(E.title || 'New entry') + '</h1></div>' +
      '<section class="panel next" id="next" aria-live="polite"></section>' + inboxPanel() +
      '<section class="panel grid2">' +
        field('Title', '<input id="title" value="' + esc(E.title) + '">') +
        field('Date', '<input id="date" type="date" value="' + esc(E.date) + '"' + (E.id ? ' disabled' : '') + '>', E.id ? 'The address is <code>' + esc(E.id) + '</code>' : 'Sets the address with the title, on first save') +
        field('Kind', '<select id="kind">' + kOpts + '</select>') +
        field('Place', '<input id="place" value="' + esc(E.place) + '" placeholder="Trailhead or public land, never closer to home">') +
        field('Status', '<select id="status">' + sOpts + '</select>', 'Published goes live on the next save') +
        field('Who appears', '<input id="consent" value="' + esc(E.consent || '') + '" placeholder="e.g. Christian and Marley only">') +
      '</section>' +
      (trackTop ? '<section class="panel"><h2>Track</h2><div id="track"></div></section>' : '') +
      '<section class="panel"><h2>Photos</h2>' + (later ? '' : dropPhotos) + '<div id="photos" class="photos"></div>' + (later && !E.photos.length ? '<p class="muted">No photos yet. Add some at the bottom of the page.</p>' : '') + '</section>' +
      '<section class="panel"><h2>Your notes</h2><div id="voiceNotes"></div>' + field('', '<textarea id="fieldNotes" rows="8" placeholder="What happened, in your words: who came, what you saw, what to leave out.">' + esc(E.fieldNotes) + '</textarea>') + '</section>' +
      '<section class="panel draft"><h2>Draft with Claude</h2><div class="row"><input id="instr" placeholder="Optional: e.g. shorter, or add the bit about the hammock"><button id="draft" class="primary">Draft with Claude</button></div>' +
        '<div id="questions"></div></section>' +
      '<section class="panel">' + field('Card summary', '<textarea id="summary" rows="2">' + esc(E.summary) + '</textarea>') + '</section>' +
      '<section class="panel"><h2>Post</h2>' + field('Title', '<input id="postTitle" value="' + esc(E.post.title) + '">') + field('Text', '<textarea id="postBody" rows="14">' + esc(E.post.body) + '</textarea>', 'First person. A blank line between paragraphs. End with "What I learned: …" when there is something real.') + '</section>' +
      '<section class="panel"><h2>Episode</h2>' + field('Title', '<input id="epTitle" value="' + esc(E.episode.title) + '">') + field('Script', '<textarea id="epScript" rows="16">' + esc(E.episode.script) + '</textarea>', '<span id="epCount"></span>') +
        '<div class="row"><button id="copyPrompt">Copy the audio prompt</button><span class="muted">Render it with your voice tool, then drop the file below.</span></div>' +
        '<h3>Audio</h3><div id="audio"></div><div id="driveFiles"></div></section>' +
      (later ? '<section class="panel more"><h2>Add more</h2><p class="muted">Only if you want to add to what\'s here.</p>' + (trackTop ? '' : '<h3>Track</h3><div id="track"></div>') + '<h3>Photos</h3>' + dropPhotos + '</section>' : '') +
      '<footer class="savebar"><span id="saveState" class="muted">' + (E.id ? 'Saved' : 'Not saved yet') + '</span><button id="save" class="primary">Save</button></footer>';

    $('#back').onclick = showList;
    ['title', 'place', 'consent', 'fieldNotes', 'summary', 'postTitle', 'postBody', 'epTitle', 'epScript'].forEach(function (k) { $('#' + k).addEventListener('input', markDirty); });
    ['kind', 'status', 'date'].forEach(function (k) { $('#' + k).addEventListener('change', markDirty); });
    $('#epScript').addEventListener('input', count); count();
    renderTrack(); renderPhotos(); renderQuestions(); renderAudio();
    driveAudio().then(function () { renderDriveFiles(); renderVoiceNotes(); renderNext(); });
    ['postBody', 'epScript', 'fieldNotes'].forEach(function (k) { $('#' + k).addEventListener('change', renderNext); });
    renderNext();
    var dp = $('#drop-photos');
    ['dragover', 'dragenter'].forEach(function (t) { dp.addEventListener(t, function (ev) { ev.preventDefault(); dp.classList.add('on'); }); });
    dp.addEventListener('dragleave', function () { dp.classList.remove('on'); });
    dp.addEventListener('drop', function (ev) { ev.preventDefault(); dp.classList.remove('on'); addPhotos(ev.dataTransfer.files); });
    $('#pickPhotos').onchange = function () { addPhotos(this.files); this.value = ''; };
    $('#draft').onclick = function () { draft(); };
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
    return file.text().then(function (txt) {
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
    var list = [].slice.call(files).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|heic|png|webp)$/i.test(f.name); });
    if (!list.length) return Promise.resolve();
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
    return chain.then(function () {
      E.photos.sort(function (a, b) { return String(a.takenAt || '~').localeCompare(String(b.takenAt || '~')); });
      markDirty(); renderPhotos();
    });
  }

  // ---------- the episode's audio: an MP3 dropped here (or picked from the note's Drive folder) goes up
  // in pieces to a Git blob straight away, plays here to check, and is committed with the next Save ----------
  function mmss(sec) { sec = Math.round(sec || 0); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function renderAudio() {
    var box = $('#audio'); if (!box) return;
    setTimeout(renderNext, 0);
    var has = audioNew || (E.episode.audio && !audioGone);
    if (has) {
      box.innerHTML = '<div class="aud"><audio controls preload="metadata"' + (audioNew && audioNew.url ? ' src="' + audioNew.url + '"' : '') + '></audio>' +
        '<p class="muted">' + (audioNew ? '<b>' + esc(audioNew.name) + '</b> · ' + size(audioNew.bytes) + '<span class="alen"></span> · new: Save to keep it' : 'Attached<span class="alen"></span>') + '</p>' +
        '<div class="row"><label class="pick link">Replace<input type="file" accept="audio/*,.wav,.mp3,.m4a" hidden id="pickAudio"></label><button type="button" class="link" id="dropAudio">Remove</button></div></div>';
      var el = $('audio', box);
      el.addEventListener('loadedmetadata', function () { var l = $('.alen', box); if (l && isFinite(el.duration)) l.textContent = ' · ' + mmss(el.duration); });
      if (!audioNew && E.id) {          // the saved one: fetched once, played from memory (Safari wants that)
        fetch('api.php?a=audio&id=' + encodeURIComponent(E.id)).then(function (r) { if (!r.ok) throw 0; return r.blob(); })
          .then(function (b) { el.src = URL.createObjectURL(b); }).catch(function () {});
      }
      $('#dropAudio').onclick = function () { if (audioNew) audioNew = null; else audioGone = true; markDirty(); renderAudio(); };
    } else {
      box.innerHTML = '<div id="drop-audio" class="drop">Drop the episode\'s audio here (WAV or MP3), or <label class="pick">choose<input type="file" accept="audio/*,.wav,.mp3,.m4a" hidden id="pickAudio"></label>. It\'s levelled and made into an MP3 in your browser, then uploaded.</div>' +
        '<small class="muted credit">MP3 encoding by <a href="https://lame.sourceforge.net" target="_blank" rel="noopener">LAME</a>.</small>';
      var dz = $('#drop-audio');
      ['dragover', 'dragenter'].forEach(function (t) { dz.addEventListener(t, function (ev) { ev.preventDefault(); dz.classList.add('on'); }); });
      dz.addEventListener('dragleave', function () { dz.classList.remove('on'); });
      dz.addEventListener('drop', function (ev) { ev.preventDefault(); dz.classList.remove('on'); if (ev.dataTransfer.files[0]) attachAudio(ev.dataTransfer.files[0]); });
    }
    var pick = $('#pickAudio', box); if (pick) pick.onchange = function () { if (this.files[0]) attachAudio(this.files[0]); this.value = ''; };
  }
  // ---------- next steps: once the content is in, what to do now, most important first, at the top of the
  // note. Worked out from the note itself, so it moves on as you go: voice notes into your notes, a draft,
  // Claude's questions (the script isn't final until they're answered), the episode audio, save, publish ----------
  var savedStatus = null;
  function go(sel) {
    var el = $(sel); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var f = el.matches('input,textarea,select,button') ? el : $('textarea,input,select,button', el);
    if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 400);
  }
  function nextSteps() {
    var val = function (id) { var el = $('#' + id); return el ? el.value.trim() : ''; };
    var drafted = !!(val('postBody') || val('epScript')), q = (E.questions || []).length;
    var vn = (DRIVEAUD || []).filter(function (f) { return roleOf(f.name) === 'notes'; }).length;
    var audio = !!(audioNew || (E.episode.audio && !audioGone));
    var videos = INBOX && INBOX.source === E.source ? INBOX.files.filter(function (f) { return f.kind === 'video'; }).length : 0;
    var out = [];
    if (vn && !E.voiceNotesDone) out.push({ t: 'Listen to your voice notes', d: 'Add what matters to Your notes: Claude can only use what\'s written there.', b: 'Listen', go: '#voiceNotes', done: 'voice' });
    if (!drafted) out.push({ t: 'Draft with Claude', d: 'Claude writes the post, the captions and the episode script from your notes, track and photos.', b: 'Draft', run: function () { draft(); } });
    if (q) out.push({ t: 'Answer Claude\'s ' + (q === 1 ? 'question' : q + ' questions'), d: 'The script isn\'t final until they\'re answered. Answer them one by one, then send them all at once.', b: 'Answer', go: '#questions' });
    if (drafted && !q && !audio) out.push({ t: 'Record the episode', d: 'Copy the audio prompt, render it with your voice tool, then drop the audio in or choose it from Drive.', b: 'Go to the audio', go: '#copyPrompt' });
    if (dirty) out.push({ t: 'Save', d: 'Keep what you have so far.', b: 'Save', run: save });
    if (drafted && !q && audio && val('status') !== 'published') out.push({ t: 'Publish', d: 'Set Status to Published, then Save. Play and the podcast feed update in about a minute.', b: 'Set status', go: '#status' });
    if (!out.length && E.id && savedStatus === 'published') out.push({ t: 'All done', d: 'It\'s live on Play' + (videos ? '. The videos wait for the video step.' : '.'), b: 'Open on Play', href: '/play/' + E.id + '/' });
    return out;
  }
  function renderNext() {
    var box = $('#next'); if (!box || !E) return;
    var steps = nextSteps().slice(0, 3);
    if (!steps.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<h2>Next steps</h2><ol class="nsteps">' + steps.map(function (st, i) {
      return '<li' + (i ? '' : ' class="now"') + '><div><b>' + esc(st.t) + '</b><span>' + esc(st.d) + '</span></div><div class="nb">' +
        (st.href ? '<a class="btn' + (i ? '' : ' primary') + '" href="' + st.href + '" target="_blank" rel="noopener">' + esc(st.b) + ' ↗</a>'
          : '<button type="button" class="small' + (i ? '' : ' primary') + '" data-i="' + i + '">' + esc(st.b) + '</button>') +
        (st.done ? '<button type="button" class="link" data-done="' + st.done + '">Done</button>' : '') + '</div></li>';
    }).join('') + '</ol>';
    $$('button[data-i]', box).forEach(function (b) {
      var st = steps[+b.getAttribute('data-i')];
      b.onclick = function () { if (st.run) st.run(); else go(st.go); };
    });
    $$('button[data-done]', box).forEach(function (b) { b.onclick = function () { E.voiceNotesDone = true; markDirty(); }; });
  }

  // ---------- audio from the note's Drive folder: each file has a role, chosen here. Voice notes (your own
  // account of the day) play above Your notes while you write them up; the episode audio is levelled and
  // attached like a dropped file; anything else is left alone. New audio starts as voice notes, since the
  // episode is recorded later from the script. The choices are saved with the note. ----------
  var ROLES = [['notes', 'Voice notes'], ['episode', 'Episode audio'], ['skip', 'Not used']];
  function driveAudio() {
    if (!E.source) return Promise.resolve(DRIVEAUD = []);
    if (DRIVEAUD) return Promise.resolve(DRIVEAUD);
    return api('inbox', null, '&f=' + encodeURIComponent(E.source))
      .then(function (j) { return (DRIVEAUD = j.files.filter(function (f) { return f.kind === 'audio'; })); })
      .catch(function () { return (DRIVEAUD = []); });
  }
  function roleOf(name) { return (E.audioRoles || {})[name] || 'notes'; }
  function driveUrl(name) { return 'api.php?a=inboxfile&f=' + encodeURIComponent(E.source) + '&n=' + encodeURIComponent(name); }
  function renderDriveFiles() {
    var box = $('#driveFiles'); if (!box) return;
    if (!DRIVEAUD || !DRIVEAUD.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<h3>Audio from Drive</h3><p class="muted">Choose what each file is.</p><ul class="dfiles">' + DRIVEAUD.map(function (f, i) {
      var r = roleOf(f.name);
      return '<li><span class="dname">' + esc(f.name.split('/').pop()) + ' <small>' + size(f.bytes) + '</small></span>' +
        '<select data-i="' + i + '" aria-label="What ' + esc(f.name) + ' is">' + ROLES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === r ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></li>';
    }).join('') + '</ul>';
    $$('select', box).forEach(function (sel) {
      sel.onchange = function () {
        var f = DRIVEAUD[+sel.getAttribute('data-i')], v = sel.value;
        E.audioRoles = E.audioRoles || {};
        if (v === 'episode') Object.keys(E.audioRoles).forEach(function (k) { if (E.audioRoles[k] === 'episode') E.audioRoles[k] = 'notes'; });
        E.audioRoles[f.name] = v; markDirty(); renderDriveFiles(); renderVoiceNotes();
        if (v === 'episode') fromDrive(f.name);
      };
    });
  }
  function renderVoiceNotes() {
    var box = $('#voiceNotes'); if (!box) return;
    var vn = (DRIVEAUD || []).filter(function (f) { return roleOf(f.name) === 'notes'; });
    box.innerHTML = vn.length ? '<div class="vnotes"><b>Your voice notes</b> <span class="muted">Listen while you write them up below.</span>' + vn.map(function (f) {
      return '<div class="vn"><small>' + esc(f.name.split('/').pop()) + '</small><audio controls preload="metadata" src="' + driveUrl(f.name) + '"></audio></div>';
    }).join('') + '</div>' : '';
  }

  // Mastering, in the browser, to match the show: mono, 44.1 kHz, levelled to -16 LUFS (measured the
  // ITU BS.1770 way) with a gentle limiter keeping peaks under -2.5 dB (room for the MP3's own overshoot;
  // if the limiter takes a lot off, it's measured again and topped up), then a 96 kbps MP3 made by LAME
  // (lamejs, lame.sourceforge.net; assets/vendor). Any WAV, M4A or MP3 the browser can decode comes in.
  var LUFS = -16, AIM = LUFS + 0.5, CEIL = Math.pow(10, -2.5 / 20), RATE = 44100;   // AIM: this meter reads 0.5 dB under ffmpeg's
  function lame() {
    if (window.lamejs) return Promise.resolve(window.lamejs);
    return new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = 'assets/vendor/lame.min.js'; sc.onload = function () { ok(window.lamejs); }; sc.onerror = function () { no(new Error('The MP3 encoder didn\'t load.')); }; document.head.appendChild(sc); });
  }
  function biquad(x, b0, b1, b2, a0, a1, a2) {
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    for (var i = 0; i < x.length; i++) { var v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
    return y;
  }
  function loudness(x, fs) {
    var w = 2 * Math.PI * 1500 / fs, A = Math.pow(10, 4 / 40), al = Math.sin(w) / (2 * Math.SQRT1_2), c = Math.cos(w), sA = Math.sqrt(A);
    var k = biquad(x, A * ((A + 1) + (A - 1) * c + 2 * sA * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * sA * al),
      (A + 1) - (A - 1) * c + 2 * sA * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * sA * al);
    w = 2 * Math.PI * 38 / fs; c = Math.cos(w); al = Math.sin(w) / (2 * 0.5);
    k = biquad(k, (1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al);
    var blk = Math.round(0.4 * fs), hop = Math.round(0.1 * fs), z = [];
    for (var s = 0; s + blk <= k.length; s += hop) { var m = 0; for (var i = s; i < s + blk; i++) m += k[i] * k[i]; z.push(m / blk); }
    function L(v) { return -0.691 + 10 * Math.log10(v); }
    function mean(a) { return a.reduce(function (p, q) { return p + q; }, 0) / (a.length || 1); }
    var g1 = z.filter(function (v) { return L(v) > -70; }), rel = L(mean(g1)) - 10;
    return L(mean(g1.filter(function (v) { return L(v) > rel; })));
  }
  function master(file, step) {
    var AC = window.AudioContext || window.webkitAudioContext;
    return file.arrayBuffer().then(function (ab) {
      var ctx = new AC();
      return new Promise(function (ok, no) { ctx.decodeAudioData(ab, ok, function () { no(new Error('That audio file couldn\'t be read. Try WAV or MP3.')); }); })
        .then(function (buf) { if (ctx.close) ctx.close(); return buf; });
    }).then(function (buf) {
      step('Mixing to mono');
      var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, oc = new OC(1, Math.ceil(buf.duration * RATE), RATE);
      var src = oc.createBufferSource(); src.buffer = buf; src.connect(oc.destination); src.start(0);
      return oc.startRendering();
    }).then(function (mono) {
      step('Levelling'); var x = mono.getChannelData(0), before = loudness(x, RATE), n = x.length;
      // the limiter: looks 3 ms ahead so it's already down when a peak arrives, then lets go over 100 ms
      function limited(gain) {
        var need = new Float32Array(n), y = new Float32Array(n), ahead = Math.round(0.003 * RATE), back = 1 / (0.1 * RATE), g = 1, i;
        for (i = 0; i < n; i++) { var a = Math.abs(x[i] * gain); need[i] = a > CEIL ? CEIL / a : 1; }
        for (i = n - 2; i >= 0; i--) need[i] = Math.min(need[i], need[i + 1] + 1 / ahead);
        for (i = 0; i < n; i++) { g = Math.min(need[i], g + back); y[i] = x[i] * gain * g; }
        return y;
      }
      var gain = Math.pow(10, (AIM - before) / 20), y = limited(gain);
      for (var pass = 0; pass < 3; pass++) {
        var off = AIM - loudness(y, RATE);
        if (Math.abs(off) < 0.3) break;
        gain *= Math.pow(10, off / 20); y = limited(gain);
      }
      var out = new Int16Array(n);
      for (var i = 0; i < n; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(y[i] * 32767)));
      return lame().then(function (L) {
        var enc = new L.Mp3Encoder(1, RATE, 96), parts = [], at = 0;
        return new Promise(function (ok) {
          (function more() {
            var stop = Math.min(n, at + 1152 * 200);
            for (; at < stop; at += 1152) { var b = enc.encodeBuffer(out.subarray(at, at + 1152)); if (b.length) parts.push(b); }
            step('Making the MP3', Math.round(at / n * 100));
            if (at < n) setTimeout(more, 0); else { parts.push(enc.flush()); ok(); }
          })();
        }).then(function () { return { blob: new Blob(parts, { type: 'audio/mpeg' }), sec: n / RATE, before: before }; });
      });
    });
  }
  function attachAudio(file) {
    if (!/\.(mp3|wav|wave|m4a|aac|aif|aiff|flac)$/i.test(file.name) && !/^audio\//.test(file.type)) { toast('That isn\'t an audio file. Drop the episode as WAV or MP3.', true); return; }
    if (file.size > 400e6) { toast('That audio file is too big.', true); return; }
    var box = $('#audio'), name = file.name.replace(/\.[^.]+$/, '') + '.mp3';
    box.innerHTML = '<p class="muted aup"><span>Reading ' + esc(file.name) + '</span>… <b></b></p>';
    function step(t, pc) { var p = $('#audio .aup'); if (p) { $('span', p).textContent = t; $('b', p).textContent = pc == null ? '' : pc + '%'; } }
    master(file, step).then(function (m) {
      if (m.blob.size > 40e6) throw new Error('That episode is too long for one file.');
      toast('Levelled from ' + Math.round(m.before + 0.5) + ' to ' + LUFS + ' LUFS, ' + mmss(m.sec) + ' long.');
      upload(m.blob, name);
    }).catch(function (err) { toast(err.message, true); renderAudio(); });
  }
  function upload(file, name) {
    var up = Array.from(crypto.getRandomValues(new Uint8Array(8)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    var CH = 1500000, n = Math.ceil(file.size / CH), chain = Promise.resolve(), res = null, box = $('#audio');
    box.innerHTML = '<p class="muted aup">Uploading ' + esc(name) + '… <b>0%</b></p>';
    for (var i = 0; i < n; i++) (function (i) {
      chain = chain.then(function () { return blobToB64(file.slice(i * CH, (i + 1) * CH)); })
        .then(function (b64) { return api('audiopart', { up: up, i: i, last: i === n - 1, b64: b64 }); })
        .then(function (r) { res = r; var b = $('#audio .aup b'); if (b) b.textContent = Math.round((i + 1) / n * 100) + '%'; });
    })(i);
    chain.then(function () {
      audioNew = { sha: res.sha, name: name, bytes: file.size, url: URL.createObjectURL(file) }; audioGone = false;
      markDirty(); renderAudio(); toast('Audio attached. Save to keep it.');
    }).catch(function (err) { toast(err.message, true); renderAudio(); });
  }
  function fromDrive(name, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Fetching from Drive…'; }
    fetch('api.php?a=inboxfile&f=' + encodeURIComponent(E.source) + '&n=' + encodeURIComponent(name)).then(function (r) {
      if (!r.ok) throw new Error('Couldn\'t fetch that file from the server.'); return r.blob();
    }).then(function (b) { attachAudio(new File([b], name.split('/').pop(), { type: b.type })); })
      .catch(function (err) { toast(err.message, true); renderAudio(); });
  }

  // ---------- questions: answered one at a time, sent to Claude all together ----------
  var QA = { list: null, at: 0, ans: {}, skip: {} };
  function renderQuestions() {
    setTimeout(renderNext, 0);
    var q = E.questions || [], box = $('#questions');
    if (QA.list !== q) QA = { list: q, at: 0, ans: {}, skip: {} };       // a new set of questions starts fresh
    if (!q.length) { box.innerHTML = ''; return; }
    QA.at = Math.max(0, Math.min(QA.at, q.length - 1));
    var i = QA.at, done = Object.keys(QA.ans).filter(function (k) { return QA.ans[k].trim(); }).length, last = i === q.length - 1;
    box.innerHTML = '<h3>Open questions</h3>' +
      '<div class="qdots">' + q.map(function (_, k) {
        return '<button type="button" class="qdot' + (k === i ? ' now' : '') + ((QA.ans[k] || '').trim() ? ' done' : '') + (QA.skip[k] ? ' skipped' : '') +
          '" data-k="' + k + '" aria-label="Question ' + (k + 1) + '"></button>';
      }).join('') + '</div>' +
      '<div class="qcard"><small class="muted">Question ' + (i + 1) + ' of ' + q.length + (QA.skip[i] ? ' · skipped' : '') + '</small>' +
      '<p class="q">' + esc(q[i]) + '</p>' +
      '<textarea class="ans" rows="3" placeholder="Your answer, in a few words">' + esc(QA.ans[i] || '') + '</textarea>' +
      '<div class="row"><button type="button" class="link qback"' + (i ? '' : ' disabled') + '>Back</button>' +
      '<button type="button" class="link qskip">' + (QA.skip[i] ? 'Keep this one' : 'Skip this one') + '</button>' +
      '<span class="grow"></span><button type="button" class="small qnext">' + (last ? 'Done' : 'Next') + '</button></div></div>' +
      '<div class="qsend"><button type="button" class="primary qsubmit"' + (done || Object.keys(QA.skip).length ? '' : ' disabled') + '>' +
        (done ? 'Submit ' + done + ' answer' + (done === 1 ? '' : 's') : 'Submit answers') + '</button>' +
      '<small class="muted">Your answers go into your notes, and Claude works them all into the draft at once.</small></div>';
    var ta = $('.ans', box);
    function go(k) { QA.ans[i] = ta.value; QA.at = k; renderQuestions(); var t = $('#questions .ans'); if (t) t.focus(); }
    ta.addEventListener('input', function () {
      QA.ans[i] = ta.value; if (ta.value.trim()) delete QA.skip[i]; markDirty();
      var n = Object.keys(QA.ans).filter(function (k) { return QA.ans[k].trim(); }).length, b = $('.qsubmit', box);
      b.disabled = !n && !Object.keys(QA.skip).length; b.textContent = n ? 'Submit ' + n + ' answer' + (n === 1 ? '' : 's') : 'Submit answers';
      $$('.qdot', box)[i].classList.toggle('done', !!ta.value.trim());
    });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(last ? i : i + 1); } });
    $$('.qdot', box).forEach(function (d) { d.onclick = function () { go(+d.getAttribute('data-k')); }; });
    $('.qback', box).onclick = function () { go(i - 1); };
    $('.qnext', box).onclick = function () { go(last ? i : i + 1); if (last) $('.qsubmit').focus(); };
    $('.qskip', box).onclick = function () {
      if (QA.skip[i]) delete QA.skip[i]; else { QA.skip[i] = true; QA.ans[i] = ''; ta.value = ''; }
      go(QA.skip[i] && !last ? i + 1 : i);
    };
    $('.qsubmit', box).onclick = function () { QA.ans[i] = ta.value; submitAnswers(); };
  }
  function submitAnswers() {
    var q = E.questions, pairs = [];
    q.forEach(function (s, k) { var a = (QA.ans[k] || '').trim(); if (a) pairs.push({ q: s, a: a }); });
    collect();
    if (pairs.length) {
      E.fieldNotes = (E.fieldNotes.trim() ? E.fieldNotes.trim() + '\n\n' : '') + pairs.map(function (p) { return p.q + '\n' + p.a; }).join('\n\n');
      $('#fieldNotes').value = E.fieldNotes;
    }
    E.questions = q.filter(function (_, k) { return !(QA.ans[k] || '').trim() && !QA.skip[k]; });
    markDirty(); renderQuestions();
    if (!pairs.length) { toast('Skipped questions cleared.'); return; }
    draft({ title: pairs.length === 1 ? 'Working in your answer' : 'Working in your ' + pairs.length + ' answers',
      instruction: 'I answered ' + (pairs.length === 1 ? 'one of your questions' : pairs.length + ' of your questions') + '. ' +
        pairs.map(function (p, n) { return (n + 1) + '. Question: "' + p.q + '" My answer: "' + p.a + '"'; }).join(' ') +
        ' Work ' + (pairs.length === 1 ? 'it' : 'them all') + ' into the draft and change nothing else.' });
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
  function draft(opts) {
    opts = opts || {};
    collect();
    if (!E.fieldNotes.trim() && !E.track && !E.photos.length) { toast('Add some notes, a track or photos first.', true); return Promise.resolve(); }
    var own = !opts.loader, L = opts.loader || loader(opts.title || 'Drafting with Claude', ['Gather your notes, track and photos', 'Claude writes the draft', 'Ready for you to read']);
    if (own) L.at(0);
    var btn = $('#draft'); btn.disabled = true; btn.textContent = 'Drafting… (up to a minute)';
    return thumbsForClaude().then(function (thumbs) {
      if (own) L.at(1, 'up to a minute');
      var facts = { title: E.title, date: E.date, kind: E.kind, place: E.place, whoAppears: E.consent, notes: E.fieldNotes, figures: figures(),
        photos: E.photos.filter(function (p) { return p.use !== 'skip'; }).map(function (p) { return { file: photoName(p), takenAt: p.takenAt || null, video: !!p.video, caption: p.caption || '' }; }),
        currentDraft: (E.post.body || E.episode.script) ? { summary: E.summary, post: E.post, episode: { title: E.episode.title, script: E.episode.script } } : null,
        instruction: opts.instruction || $('#instr').value.trim() };
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
      if (own) { L.at(2); L.done(); }
    }).catch(function (err) { if (own) L.fail(err.message); toast(err.message, true); if (!own) throw err; })
      .then(function () { var b = $('#draft'); if (b) { b.disabled = false; b.textContent = 'Draft with Claude'; } });
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
    var L = loader(E.status === 'published' ? 'Saving and publishing' : 'Saving', ['Upload the photos', 'Save the note', E.status === 'published' ? 'Publishing starts (live in about a minute)' : 'Saved']);
    if (!names.length) L.skip(0);
    var chain = Promise.resolve();
    names.forEach(function (n, i) {
      chain = chain.then(function () {
        btn.textContent = 'Uploading photo ' + (i + 1) + ' of ' + names.length + '…'; L.at(0, (i + 1) + ' of ' + names.length);
        return blobToB64(fresh[n].blob).then(function (b64) { return api('blob', { b64: b64 }); }).then(function (r) { uploaded.push({ name: n, sha: r.sha }); });
      });
    });
    chain.then(function () {
      btn.textContent = 'Saving…'; L.at(1);
      var hadAudio = E.episode.audio;
      if (audioNew) E.episode.audio = 'data/audio/' + E.id + '.mp3'; else if (audioGone) E.episode.audio = null;
      return api('save', { entry: E, newPhotos: uploaded, removePhotos: removed, newAudio: audioNew ? audioNew.sha : '', removeAudio: audioGone && !!hadAudio })
        .catch(function (err) { E.episode.audio = hadAudio; throw err; });
    }).then(function () {
      var hadNew = !!audioNew;
      fresh = {}; removed = []; dirty = false; audioNew = null; audioGone = false; savedStatus = E.status;
      setTimeout(renderNext, 0); DRIVEAUD = null;
      if (hadNew && !first) renderAudio();
      $('#saveState').textContent = E.status === 'published' ? 'Saved and publishing: live in about a minute' : 'Saved';
      if (first) { route('note/' + E.id, true); render(); }
      toast(E.status === 'published' ? 'Saved. The site updates in about a minute.' : 'Saved.');
      L.at(2); L.done();
    }).catch(function (err) {
      L.fail(err.message);
      if (first) { E.id = ''; }
      toast('Not saved: ' + err.message, true);
    }).then(function () { var b = $('#save'); if (b) { b.disabled = false; b.textContent = 'Save'; } });
  }

  // ---------- start ----------
  api('config').then(function (c) {
    CFG = c; listen();
    var m = /[?&]e=([^&]+)/.exec(location.search);            // older ?e=<id> links still open their note
    if (m) edit(decodeURIComponent(m[1]));
    else open(window.StudioHash ? StudioHash.view() : '');
  }).catch(function (err) { app.innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
})();
