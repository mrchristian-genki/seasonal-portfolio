/* STUDIO: the page. Lists entries, edits one, trims tracks and cleans photos in this browser
   (so the raw GPS track and the photos' location data never leave the device), asks Claude for a
   draft, and saves to GitHub through api.php. Plain JS, no build step. */
(function () {
  'use strict';
  var CSRF = document.body.getAttribute('data-csrf');
  var app = document.getElementById('app');
  var Track = window.FieldTrack;   // field/track.js, copied here at deploy
  var CFG = null, E = null, dirty = false;
  var REVIEW = null, LIVE = null;   // the note's review state (waiting, or sent back) and its live version, to compare
  function owner() { return !CFG || !CFG.me || CFG.me.role === 'owner'; }
  var fresh = {};     // name -> { blob, thumb (data URL), b64 } for photos not yet saved
  var audioNew = null, audioGone = false;   // the episode's MP3: one attached since the last save, or removed
  var DRIVEAUD = null;                      // audio files in the note's Drive folder (null until looked up)
  var trackRaw = null, trackSwap = false;   // the raw track, in this browser only (for setting where it starts and ends)
  var removed = [];   // photo files to delete on save
  var clipsNew = {};  // clip-N.mp4 -> { token } for video loops made on the server and not yet saved
  var posterBust = '';   // after a save with new poster frames, so the editor shows them and not a cached old one
  var posterNew = {}; // clip-N.jpg -> { blob, url } for a loop's poster frame picked here and not yet saved
  var DRIVEVID = null, VT = null;           // the videos in the note's Drive folder; the one being trimmed

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function toast(msg, bad) { var t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(t._h); t._h = setTimeout(function () { t.className = ''; }, bad ? 7000 : 3500); }
  // Read as text, not r.json(): a reply that isn't clean JSON (a PHP warning printed before it, or a host's
  // error page) then still works, or at least says what came back (Safari's own message for a bad reply is
  // only "The string did not match the expected pattern").
  // A Blob body goes up as raw bytes (the host's firewall can take base64 in JSON for an attack).
  function api(a, body, q) {
    var raw = body instanceof Blob;
    var opt = body ? { method: 'POST', headers: { 'Content-Type': raw ? 'application/octet-stream' : 'application/json', 'X-CSRF': CSRF }, body: raw ? body : JSON.stringify(body) } : {};
    return fetch('api.php?a=' + a + (q || ''), opt).then(function (r) {
      if (r.status === 401) { location.reload(); throw new Error('Logged out'); }
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) {
          var k = t.search(/[{\[]/);   // JSON after something printed before it
          try { if (k >= 0) { j = JSON.parse(t.slice(k)); if (window.console) console.warn('Studio: the server printed this before its reply:', t.slice(0, k)); } } catch (e2) { j = null; }
        }
        if (j === null && r.status === 418) throw new Error('The web host\'s firewall blocked the ' + a + ' request (418). Reload the Studio and try again; if it keeps happening, tell me.');
        if (j === null) {
          var said = t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
          throw new Error('The server\'s reply to ' + a + ' wasn\'t readable (' + r.status + (said ? ': ' + said : ', empty') + ')');
        }
        if (!r.ok) throw new Error(j.error || ('Error ' + r.status));
        return j;
      });
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
    dirty = false; E = null; fresh = {}; removed = []; INBOX = null; audioNew = null; audioGone = false; DRIVEAUD = null; DRIVETRK = null; trackRaw = null; trackSwap = false; clipsNew = {}; posterNew = {}; DRIVEVID = null; stopTrim();
    route('notes');
    app.innerHTML = '<div class="head"><h1>Field Notes</h1><span class="me">' + esc(CFG.me ? CFG.me.name : '') + (owner() ? '' : ' · editor') + '</span>' +
      (owner() ? '<button id="people" class="small">People</button>' : '') + '<button id="new" class="primary">New entry</button></div>' +
      '<section id="queue" class="panel queue" hidden></section><section id="peopleBox" class="panel people" hidden></section>' +
      '<section id="drive" class="panel drive"><p class="muted">Checking Google Drive…</p></section><div id="list" class="cards"><p class="muted">Loading entries…</p></div>';
    $('#new').onclick = function () { edit(null); };
    if (owner()) $('#people').onclick = function () { var b = $('#peopleBox'); b.hidden = !b.hidden; if (!b.hidden) renderPeople(); };
    driveStatus();
    api('list').then(function (j) {
      ENTRIES = j.entries; if (lastDrive) renderDrive(lastDrive);
      var st = {}; (CFG.statuses || []).forEach(function (s) { st[s.id] = s.label; });
      // notes waiting for the owner's review, first
      var waiting = j.entries.filter(function (e) { return e.review; }), q = $('#queue');
      if (waiting.length) {
        q.hidden = false;
        q.innerHTML = '<h2>' + (owner() ? 'Ready for review' : 'Waiting for review') + '</h2><ul class="rq">' + waiting.map(function (e) {
          var r = e.review;
          return '<li><button type="button" class="link" data-id="' + esc(e.id) + '">' + esc(e.title || e.id) + '</button> <small>' + (r.isNew ? 'new note' : r.live ? 'changes to a live post' : 'changes') + ' by ' + esc(r.by) + ' · ' + esc(when(r.at)) + '</small>' +
            (r.state === 'returned' ? ' <span class="rq-back">Sent back' + (r.note ? ': ' + esc(r.note) : '') + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
        $$('button[data-id]', q).forEach(function (b) { b.onclick = function () { edit(b.getAttribute('data-id')); }; });
      }
      $('#list').innerHTML = j.entries.length ? j.entries.map(function (e) {
        return '<button class="card" data-id="' + esc(e.id) + '"><span class="st st-' + esc(e.status) + '">' + esc(st[e.status] || e.status) + '</span>' + (e.review ? '<span class="st st-review">' + (e.review.state === 'returned' ? 'Sent back' : 'In review') + '</span>' : '') +
          '<b>' + esc(e.title || e.id) + '</b><small>' + esc(e.date) + ' · ' + esc(e.kind) + ' · ' + e.photos + ' photos</small><span class="sum">' + esc(e.summary) + '</span></button>';
      }).join('') : '<p class="muted">No entries yet.</p>';
      $$('.card', $('#list')).forEach(function (b) { b.onclick = function () { edit(b.getAttribute('data-id')); }; });
    }).catch(function (err) { $('#list').innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
  }

  // ---------- People (owner only): editors can work on notes; their saves wait for review ----------
  function renderPeople() {
    var box = $('#peopleBox'); box.innerHTML = '<p class="muted">Loading…</p>';
    api('users').then(function (j) {
      box.innerHTML = '<h2>People</h2><p class="muted">Editors can make and change notes, bring in from Drive and draft with Claude. What they save waits for your review here; they can\'t publish or change what\'s live.</p>' +
        (j.users.length ? '<ul class="ppl">' + j.users.map(function (u) { return '<li><b>' + esc(u.name) + '</b> <small>username <code>' + esc(u.user) + '</code> · editor' + (u.added ? ' · since ' + esc(when(u.added)) : '') + '</small><button type="button" class="link" data-reset="' + esc(u.name) + '">New password</button><button type="button" class="link" data-del="' + esc(u.name) + '">Remove</button></li>'; }).join('') + '</ul>' : '<p>No editors yet.</p>') +
        '<div class="row"><input id="pplName" placeholder="Name" maxlength="40"><button type="button" class="small" id="pplAdd">Add an editor</button></div><div id="pplPw"></div>';
      var show = function (r) {
        var text = 'Studio: https://www.christiangehrke.com/studio/\nUsername: ' + r.user + '\nPassword: ' + r.password;
        $('#pplPw').innerHTML = '<div class="pw"><p>' + esc(r.name) + '\'s login. The password is shown only this once: send it to them privately.</p>' +
          '<div class="pw-l"><span>Username</span><code>' + esc(r.user) + '</code></div><div class="pw-l"><span>Password</span><code>' + esc(r.password) + '</code></div><button type="button" class="small" id="pwCopy">Copy both</button></div>';
        $('#pwCopy').onclick = function () { navigator.clipboard.writeText(text).then(function () { toast('Copied.'); }); };
      };
      $('#pplAdd').onclick = function () { var n = $('#pplName').value.trim(); if (!n) return; api('useradd', { name: n }).then(function (r) { renderPeople(); setTimeout(function () { show(r); }, 300); }).catch(function (err) { toast(err.message, true); }); };
      $$('[data-reset]', box).forEach(function (b) { b.onclick = function () { var n = b.getAttribute('data-reset'); if (!confirm('Give ' + n + ' a new password? The old one stops working.')) return; api('userreset', { name: n }).then(show).catch(function (err) { toast(err.message, true); }); }; });
      $$('[data-del]', box).forEach(function (b) { b.onclick = function () { var n = b.getAttribute('data-del'); if (!confirm('Remove ' + n + '? They\'re logged out, and what they saved for review stays for you to approve or discard.')) return; api('userdel', { name: n }).then(renderPeople).catch(function (err) { toast(err.message, true); }); }; });
    }).catch(function (err) { box.innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
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
      (j.errors.length ? '<p class="err">' + j.errors.map(esc).join('<br>') + '</p>' : '') + inbox +
      ((j.ignored || []).length && owner() ? '<details class="ignored"><summary>Ignored (' + j.ignored.length + ')</summary><ul>' + j.ignored.map(function (x) {
        return '<li>' + esc(x.source) + ' <small>' + esc(when(x.at)) + (x.dropped ? ' · server copy deleted' : '') + '</small> <button class="link unignore" data-src="' + esc(x.source) + '">Restore</button></li>'; }).join('') + '</ul></details>' : '');
    var b = $('#driveGo');
    if (b) b.onclick = function () {
      b.disabled = true; b.textContent = 'Starting…';
      api('drive', {}).then(renderDrive).catch(function (err) { toast(err.message, true); driveStatus(); });
    };
    $$('.inbox .open', d).forEach(function (b) { b.onclick = function () { edit(b.getAttribute('data-id')); }; });
    // a folder that won't be used: hidden for good, and (a folder) its copy on the server deleted if you say so
    $$('.inbox .ignore', d).forEach(function (b) {
      b.onclick = function () {
        var src = b.getAttribute('data-src');
        if (!confirm('Ignore “' + src + '”? It goes from this list for good, even if Drive copies it again. (You can restore it below.)')) return;
        var drop = !!b.getAttribute('data-dir') && confirm('Also delete the server\'s copy of it, to free the space? Google Drive isn\'t touched.\n\nOK deletes the copy; Cancel keeps it.');
        api('ignore', { source: src, drop: drop }).then(function (j) { renderDrive(j); toast('Ignored' + (drop ? ', and the server copy deleted.' : '.')); }).catch(function (err) { toast(err.message, true); });
      };
    });
    $$('.ignored .unignore', d).forEach(function (b) {
      b.onclick = function () { api('unignore', { source: b.getAttribute('data-src') }).then(function (j) { renderDrive(j); toast('Restored.'); }).catch(function (err) { toast(err.message, true); }); };
    });
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
    if (owner()) act += '<button class="link ignore" data-src="' + esc(f.source) + '" data-dir="' + (f.dir ? 1 : '') + '" title="Hide it here for good">Ignore</button>';
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
    var marks = [100, 75, 50, 25, 0].map(function (n) { return '<span class="rx-mark" data-at="' + n + '"><i></i>' + n + '%</span>'; }).join('');
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
    // set by script: the page's CSP blocks style attributes written in HTML
    $$('.rx-mark', el).forEach(function (m) { m.style.setProperty('--at', m.getAttribute('data-at')); });
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
    // batches of about six, never splitting shots taken within 3 seconds (a bracket merges as one)
    var t = function (f) { return f.taken ? Date.parse(f.taken.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')) : NaN; };
    var sorted = photos.slice().sort(function (a, b) { return (t(a) || 0) - (t(b) || 0); }), batches = [], cur = [];
    sorted.forEach(function (f, i) { var p = sorted[i - 1]; if (cur.length >= 6 && !(p && t(f) - t(p) <= 3000)) { batches.push(cur); cur = []; } cur.push(f); });
    if (cur.length) batches.push(cur);
    var n = 0;
    batches.forEach(function (batch) {
      chain = chain.then(function () {
        L.at(stepPhotos, (n + 1) + '–' + (n + batch.length) + ' of ' + photos.length);
        return Promise.all(batch.map(function (f) { return fromInbox(src, f); })).then(addPhotos).then(function () { n += batch.length; });
      });
    });
    if (!photos.length) L.skip(stepPhotos);
    return chain;
  }
  function processFolder(src) {
    if (dirty && !confirm('Leave without saving?')) return;
    var label = src.split('/').slice(1).join('/').replace(/^#/, '');
    var L = loader('Processing', ['Read the folder', 'Bring in the track', 'Bring in the photos', 'Claude drafts the note', 'Ready for you to read'], label);
    L.at(0);
    api('inbox', null, '&f=' + encodeURIComponent(src)).then(function (j) {
      INBOX = j; dirty = false; fresh = {}; removed = []; audioNew = null; audioGone = false; DRIVEAUD = null; DRIVETRK = null; trackRaw = null; trackSwap = false; clipsNew = {}; posterNew = {}; DRIVEVID = null; stopTrim();
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
  // the Drive folder's own note, only while a new note is being made from it
  function inboxHint() {
    if (E.id || !E.source || !INBOX || INBOX.source !== E.source) return '';
    return '<p class="sum-hint">Photos' + (INBOX.files.some(function (f) { return f.kind === 'track'; }) ? ', the track' : '') + (INBOX.notes ? ' and your text notes' : '') +
      ' from <b>' + esc(E.source) + '</b> are brought in below, then Claude drafts it. Read it through and Save.</p>';
  }

  // ---------- editor ----------
  function blank() {
    return { id: '', title: '', date: new Date().toISOString().slice(0, 10), kind: 'ride', place: '', status: 'notes', summary: '', trailhead: null, links: [], track: null, photos: [],
      fieldNotes: '', post: { title: '', body: '' }, episode: { title: '', script: '', audio: null }, questions: [], consent: '' };
  }
  function edit(id) {
    if (dirty && !confirm('Leave without saving?')) return;
    dirty = false; fresh = {}; removed = []; audioNew = null; audioGone = false; DRIVEAUD = null; DRIVETRK = null; trackRaw = null; trackSwap = false; clipsNew = {}; posterNew = {}; DRIVEVID = null; stopTrim();
    REVIEW = null; LIVE = null;
    if (!id) { E = blank(); savedStatus = null; route('new'); render(); return Promise.resolve(); }
    app.innerHTML = '<p class="muted">Opening…</p>';
    return api('entry', null, '&id=' + encodeURIComponent(id)).then(function (j) {
      E = j.entry; savedStatus = E.status; REVIEW = j.review || null; LIVE = j.live || null; E.post = E.post || { title: '', body: '' }; E.episode = E.episode || { title: '', script: '', audio: null }; E.questions = E.questions || []; E.photos = E.photos || [];
      route('note/' + id); render();
    }).catch(function (err) { toast(err.message, true); showList(); });
  }

  function field(label, html, hint) { return '<label class="f"><span>' + label + '</span>' + html + (hint ? '<small>' + hint + '</small>' : '') + '</label>'; }
  function render() {
    // a note made from a Drive folder, or already saved, has its content: the drop zones wait at the bottom
    var later = !!(E.id || E.source), trackTop = !later || !!E.track;
    var dropPhotos = '<div id="drop-photos" class="drop">Drop photos here, or <label class="pick">choose<input type="file" accept="image/*" multiple hidden id="pickPhotos"></label>. They\'re resized and their location data removed before upload.</div>';
    var kOpts = ['ride', 'hike', 'forage', 'make'].map(function (k) { return '<option' + (E.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('');
    app.innerHTML =
      '<section class="panel sum" id="sum"><div class="sum-top"><button class="back" id="back">← Entries</button><h1 id="sumTitle">' + esc(E.title || 'New entry') + '</h1><span id="sumLive"></span></div>' +
        '<div class="sum-meta" id="sumMeta"></div><ol class="stages" id="stages"></ol>' +
        '<div class="sum-next" id="next" aria-live="polite"></div><div class="sum-left" id="left"></div>' + inboxHint() + '<div id="revBar"></div></section>' +
      '<section class="panel grid2">' +
        field('Title', '<input id="title" value="' + esc(E.title) + '">') +
        field('Date', '<input id="date" type="date" value="' + esc(E.date) + '"' + (E.id ? ' disabled' : '') + '>', E.id ? 'The address is <code>' + esc(E.id) + '</code>' : 'Sets the address with the title, on first save') +
        field('Kind', '<select id="kind">' + kOpts + '</select>') +
        field('Place', '<input id="place" value="' + esc(E.place) + '" placeholder="Trailhead or public land, never closer to home">') +
        '<input type="hidden" id="status" value="' + esc(E.status) + '">' +
        field('Who appears', '<input id="consent" value="' + esc(E.consent || '') + '" placeholder="e.g. Christian and Marley only">') +
      '</section>' +
      (trackTop ? '<section class="panel"><h2>Track</h2><div id="track"></div></section>' : '') +
      '<section class="panel"><h2>Photos</h2>' + (later ? '' : dropPhotos) + '<div id="photos" class="photos"></div>' + (later && !E.photos.length ? '<p class="muted">No photos yet. Add some at the bottom of the page.</p>' : '') + '</section>' +
      (E.source ? '<section class="panel" id="loops"><h2>Video loops</h2><div id="loopBox"></div></section>' : '') +
      '<section class="panel"><h2>Your notes</h2><div id="voiceNotes"></div>' + field('', '<textarea id="fieldNotes" rows="8" placeholder="What happened, in your words: who came, what you saw, what to leave out.">' + esc(E.fieldNotes) + '</textarea>') + '</section>' +
      '<section class="panel draft"><h2>Draft with Claude</h2><div class="row"><input id="instr" placeholder="Optional: e.g. shorter, or add the bit about the hammock"><button id="draft" class="primary">Draft with Claude</button></div>' +
        '<div id="questions"></div></section>' +
      '<section class="panel">' + field('Card summary', '<textarea id="summary" rows="2">' + esc(E.summary) + '</textarea>') + '</section>' +
      '<section class="panel"><h2>Post</h2>' + field('Title', '<input id="postTitle" value="' + esc(E.post.title) + '">') + field('Text', '<textarea id="postBody" rows="14">' + esc(E.post.body) + '</textarea>', 'First person. A blank line between paragraphs. End with "What I learned: …" when there is something real.') + '</section>' +
      '<section class="panel"><h2>Episode</h2>' + field('Title', '<input id="epTitle" value="' + esc(E.episode.title) + '">') + field('Script', '<textarea id="epScript" rows="16">' + esc(E.episode.script) + '</textarea>', '<span id="epCount"></span>') +
        '<div class="row"><button id="copyPrompt">Copy the audio prompt</button><span class="muted">Render it with your voice tool, then drop the file below.</span></div>' +
        '<h3>Audio</h3><div id="audio"></div><div id="driveFiles"></div></section>' +
      (later ? '<section class="panel more"><h2>Add more</h2><p class="muted">Only if you want to add to what\'s here.</p>' + (trackTop ? '' : '<h3>Track</h3><div id="track"></div>') + '<h3>Photos</h3>' + dropPhotos + '</section>' : '') +
      '<footer class="savebar"><span id="saveState" class="muted">' + (E.id ? 'Saved' : 'Not saved yet') + '</span>' +
        '<button type="button" id="publish" class="pub"><span class="pub-t">Publish</span><small class="pub-n"></small></button><button id="save" class="primary">' + (owner() ? 'Save' : 'Save for review') + '</button></footer>';

    $('#back').onclick = showList;
    ['title', 'place', 'consent', 'fieldNotes', 'summary', 'postTitle', 'postBody', 'epTitle', 'epScript'].forEach(function (k) { $('#' + k).addEventListener('input', markDirty); });
    ['kind', 'date'].forEach(function (k) { $('#' + k).addEventListener('change', markDirty); });
    $('#title').addEventListener('input', function () { $('#sumTitle').textContent = this.value.trim() || 'New entry'; });
    $('#epScript').addEventListener('input', count); count();
    renderTrack(); renderPhotos(); renderQuestions(); renderAudio(); renderLoops();
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
    $('#publish').onclick = publish;
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
    if (!t || trackSwap) {
      box.innerHTML = '<div id="drop-track" class="drop">Drop the Cyclemeter export (GPX or CSV) here, or <label class="pick">choose<input type="file" accept=".gpx,.csv,.txt,application/gpx+xml" hidden id="pickTrack"></label>. It\'s trimmed here in your browser: the raw track never leaves this device.</div><div class="drvtrk"></div>' +
        (trackSwap ? '<button type="button" class="link" id="keepTrack">Keep the current track</button>' : '');
      offerDriveTracks(box);
      if (trackSwap) $('#keepTrack').onclick = function () { trackSwap = false; renderTrack(); };
      var d = $('#drop-track');
      ['dragover', 'dragenter'].forEach(function (ty) { d.addEventListener(ty, function (ev) { ev.preventDefault(); d.classList.add('on'); }); });
      d.addEventListener('dragleave', function () { d.classList.remove('on'); });
      d.addEventListener('drop', function (ev) { ev.preventDefault(); d.classList.remove('on'); if (ev.dataTransfer.files[0]) addTrack(ev.dataTransfer.files[0]); });
      $('#pickTrack').onchange = function () { if (this.files[0]) addTrack(this.files[0]); };
      return;
    }
    var s = t.stats || {};
    box.innerHTML = '<div class="trackrow"><div class="lmap" id="trView">' + mapSvg(t.line) + '</div><div class="stats">' +
      '<div><b>' + mi(s.distanceKm || 0) + ' mi</b><span>distance</span></div><div><b>' + ft(s.gainM || 0).toLocaleString() + ' ft</b><span>climbing</span></div>' +
      '<div><b>' + dur(s.movingSec) + '</b><span>moving</span></div><div><b>' + ft(s.maxEleM || 0).toLocaleString() + ' ft</b><span>high point</span></div></div></div>' +
      '<ul class="notes">' + ((t.trim && t.trim.notes) || []).map(function (n) { return '<li' + (/private zone|Warning/.test(n) ? ' class="warn"' : '') + '>' + esc(n) + '</li>'; }).join('') + '</ul>' +
      (t.homeWarning ? '<p class="err">' + esc(t.homeWarning) + '</p>' : '') +
      (window.RouteView && t.line && t.line.length > 1 ? '<details class="tdash"' + (dashOpen ? ' open' : '') + '><summary>Trail stats <small>Switch each part on or off for the post</small></summary><div class="dash steam" id="trDash"></div></details>' : '') +
      (trackRaw ? rangeBox() : '<p class="muted">To change where the ride starts or ends, add the track file again: the original isn\'t kept.</p>') +
      '<div class="row"><button type="button" class="link" id="swapTrack">Replace the track</button><button id="dropTrack" class="link">Remove the track</button></div>';
    $('#dropTrack').onclick = function () { if (confirm('Remove the track from this entry?')) { E.track = null; E.trailhead = null; trackRaw = null; markDirty(); renderTrack(); } };
    $('#swapTrack').onclick = function () { trackSwap = true; renderTrack(); };
    wireRange(); viewMap(t.line); drawDash();
  }
  // The trail stats the post can show, drawn as Play draws them, each with its On Play switch.
  var dashOpen = true;
  function drawDash() {
    var el = $('#trDash'), t = E.track; if (!el || !t) return;
    var det = el.closest('details'); det.ontoggle = function () { dashOpen = det.open; };
    RouteView.dashboard(el, { kind: ($('#kind') || {}).value || E.kind, stats: t.stats, line: t.line, profile: t.profile },
      { show: E.dashboard, edit: function (k, on) { E.dashboard = E.dashboard || {}; E.dashboard[k] = on; markDirty(); } });
  }
  // The published line on a real map (the outline above stays if the map can't load). Breaks in the line
  // (a private zone mid-way) stay breaks.
  var VIEW = null;
  function viewMap(line) {
    var pts = (line || []).filter(Boolean); if (pts.length < 2) return;
    leaflet().then(function (L) {
      var el = $('#trView'); if (!el || E.track == null || E.track.line !== line) return;
      if (VIEW) { VIEW.remove(); VIEW = null; }
      el.innerHTML = ''; el.classList.add('on');
      var segs = [], cur = [];
      line.forEach(function (p) { if (!p) { if (cur.length > 1) segs.push(cur); cur = []; } else cur.push([p[0], p[1]]); });
      if (cur.length > 1) segs.push(cur);
      var map = VIEW = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.25 });
      var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)' });
      var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
      topo.addTo(map); L.control.layers({ Topo: topo, Streets: osm }, null, { position: 'topright' }).addTo(map);
      var pl = L.polyline(segs, { color: '#c0457a', weight: 4, opacity: .95 }).addTo(map);
      L.circleMarker([pts[0][0], pts[0][1]], { radius: 6, color: '#fff', weight: 2, fillColor: '#2f8f4e', fillOpacity: 1 }).bindTooltip('Start').addTo(map);
      L.circleMarker([pts[pts.length - 1][0], pts[pts.length - 1][1]], { radius: 6, color: '#fff', weight: 2, fillColor: '#b0412e', fillOpacity: 1 }).bindTooltip('End').addTo(map);
      map.fitBounds(pl.getBounds(), { padding: [18, 18] });
    }).catch(function (err) { if (window.console) console.warn('track map:', err); });
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
  // A track's raw file stays in this browser (never uploaded), so where the ride really started and ended
  // can be set by hand: a ride that kept recording on the drive home is cut where you say.
  function addTrack(file) {
    return file.text().then(function (txt) {
      var g = Track.parse(txt), cd = Track.cumDist(g.points);
      if (g.points.length < 2) throw new Error('no points in it');
      trackRaw = { text: txt, cd: cd, t: g.points.map(function (p) { return p.t; }), ll: g.points.map(function (p) { return [p.lat, p.lon]; }), km: cd[cd.length - 1] / 1000, range: null, kept: null };
      trackSwap = false;
      applyTrack(); toast('Track added and trimmed.');
    }).catch(function (err) { toast('Couldn\'t read that track: ' + err.message, true); });
  }
  function applyTrack() {
    var built = Track.build(trackRaw.text, { kind: E.kind, trailheads: CFG.trailheads, privateZones: CFG.zones, range: trackRaw.range });
    var z = CFG.zones || [], raw = built.raw || [];
    var inZ = function (p) { return p && z.some(function (zz) { return Track.dist(zz, p) <= (zz.radius || 400); }); };
    var home = raw.length && (inZ(raw[0]) || inZ(raw[raw.length - 1]));
    E.track = { stats: built.stats, line: built.line, profile: built.profile, trim: built.trim };
    trackRaw.kept = [(built.offset || 0) + built.kept[0], (built.offset || 0) + built.kept[1]];
    if (home) E.track.homeWarning = 'This starts or ends at home. By the show\'s rules, a ride from home is only told views-only: no track, no map, no distances. Remove the track before publishing unless you mean to.';
    E.trailhead = built.trim.startTrailhead || null;
    var th = (CFG.trailheads || []).filter(function (t) { return t.id === E.trailhead; })[0];
    if (!E.id && built.localDate) { E.date = built.localDate; $('#date').value = built.localDate; }
    if (!$('#place').value && th && th.area) $('#place').value = th.area;
    markDirty(); renderTrack();
  }
  // the clock time at a distance along the raw track
  function idxAt(kmv) { var r = trackRaw, i = 0; while (i < r.cd.length - 1 && r.cd[i] < kmv * 1000) i++; return i; }
  function clockAt(kmv) {
    var t = trackRaw.t[idxAt(kmv)]; if (t == null) return '';
    var d = new Date(t); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function rangeBox() {
    var r = trackRaw, from = r.range ? r.range[0] : 0, to = r.range ? r.range[1] : r.km, step = Math.max(0.01, +(r.km / 400).toFixed(2));
    var lab = function (v) { return mi(v) + ' mi' + (clockAt(v) ? ' · ' + clockAt(v) : ''); };
    return '<div class="trange"><b>Where did the ride start and end?</b><span class="muted">Forgot to stop recording? Drag the end back to where the ride really ended. ' +
      'The whole recording is ' + mi(r.km) + ' mi; the cut happens here in your browser. Tap the map to set the start or end.</span>' +
      '<div class="trmap-slot"></div><p class="trkey"><i class="k-pub"></i>published <i class="k-rng"></i>your start to end <i class="k-cut"></i>cut</p>' +
      '<label>Start <input type="range" id="trS" min="0" max="' + r.km.toFixed(2) + '" step="' + step + '" value="' + from.toFixed(2) + '"><output id="trSo">' + lab(from) + '</output></label>' +
      '<label>End <input type="range" id="trE" min="0" max="' + r.km.toFixed(2) + '" step="' + step + '" value="' + to.toFixed(2) + '"><output id="trEo">' + lab(to) + '</output></label>' +
      (r.range ? '<button type="button" class="link" id="trReset">Use the whole recording</button>' : '') + '</div>';
  }
  function wireRange() {
    var S = $('#trS'), En = $('#trE'); if (!S) return;
    var lab = function (v) { return mi(v) + ' mi' + (clockAt(v) ? ' · ' + clockAt(v) : ''); };
    var gap = trackRaw.km * 0.02;
    S.oninput = function () { if (+S.value > +En.value - gap) S.value = Math.max(0, +En.value - gap); $('#trSo').textContent = lab(+S.value); syncMap(); };
    En.oninput = function () { if (+En.value < +S.value + gap) En.value = Math.min(trackRaw.km, +S.value + gap); $('#trEo').textContent = lab(+En.value); syncMap(); };
    var set = function () {
      var a = +S.value, b = +En.value;
      trackRaw.range = a <= 0.001 && b >= trackRaw.km - 0.001 ? null : [a, b];
      applyTrack();
    };
    S.onchange = set; En.onchange = set;
    var rs = $('#trReset'); if (rs) rs.onclick = function () { trackRaw.range = null; applyTrack(); };
    showMap();
  }
  // The trim map: the whole raw recording on a real map, so you can see where the ride really ended.
  // Leaflet loads only when this panel shows. The raw points stay in this browser like the rest of it.
  var LL = null, trMap = null;
  function leaflet() {
    if (LL) return LL;
    LL = new Promise(function (ok, no) {
      var c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'assets/vendor/leaflet/leaflet.css?v=1.9.4'; document.head.appendChild(c);
      var j = document.createElement('script'); j.src = 'assets/vendor/leaflet/leaflet.js?v=1.9.4';
      j.onload = function () { ok(window.L); }; j.onerror = function () { LL = null; no(new Error('map didn\'t load')); };
      document.head.appendChild(j);
    });
    return LL;
  }
  function showMap() {
    var slot = $('.trmap-slot'); if (!slot) return;
    var r = trackRaw;
    leaflet().then(function (L) {
      if (!$('.trmap-slot') || trackRaw !== r) return;
      if (!trMap || trMap.raw !== r) {
        if (trMap) trMap.map.remove();
        var el = document.createElement('div'); el.className = 'trmap';
        $('.trmap-slot').appendChild(el);
        var map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.25 });
        var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
        var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)' });
        osm.addTo(map); L.control.layers({ Streets: osm, Topo: topo }, null, { position: 'topright' }).addTo(map);
        var all = L.polyline(r.ll, { color: '#7a6a58', weight: 3, opacity: .55, dashArray: '4 6', interactive: false }).addTo(map);
        trMap = {
          raw: r, el: el, map: map,
          rng: L.polyline([], { color: '#d08a2c', weight: 5, opacity: .75, interactive: false }).addTo(map),
          pub: L.polyline([], { color: '#2f6f8f', weight: 4, opacity: .95, interactive: false }).addTo(map),
          s: L.circleMarker(r.ll[0], { radius: 8, color: '#fff', weight: 2, fillColor: '#2f8f4e', fillOpacity: 1 }).bindTooltip('Start', { permanent: true, direction: 'top', offset: [0, -8] }).addTo(map),
          e: L.circleMarker(r.ll[r.ll.length - 1], { radius: 8, color: '#fff', weight: 2, fillColor: '#b0412e', fillOpacity: 1 }).bindTooltip('End', { permanent: true, direction: 'top', offset: [0, -8] }).addTo(map)
        };
        map.fitBounds(all.getBounds(), { padding: [34, 34] });
        map.on('click', function (ev) { pickOnMap(L, ev.latlng); });
      } else {
        $('.trmap-slot').appendChild(trMap.el);
        trMap.map.invalidateSize();
      }
      syncMap();
    }).catch(function (err) { var sl = $('.trmap-slot'); if (sl) sl.innerHTML = '<p class="muted">The map couldn\'t load (' + esc(err.message) + '). The sliders still work.</p>'; });
  }
  function syncMap() {
    var S = $('#trS'), En = $('#trE'); if (!trMap || !S || trMap.raw !== trackRaw) return;
    var r = trackRaw, i0 = idxAt(+S.value), i1 = idxAt(+En.value);
    trMap.rng.setLatLngs(r.ll.slice(i0, i1 + 1));
    trMap.pub.setLatLngs(r.kept ? r.ll.slice(r.kept[0], r.kept[1] + 1) : []);
    trMap.s.setLatLng(r.ll[i0]); trMap.e.setLatLng(r.ll[i1]);
  }
  // tap the map: the nearest point of the recording, with "Start here" and "End here"
  function pickOnMap(L, at) {
    var r = trackRaw, best = 0, bd = Infinity, k = Math.cos(at.lat * Math.PI / 180);
    r.ll.forEach(function (p, i) { var dy = p[0] - at.lat, dx = (p[1] - at.lng) * k, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } });
    var kmv = r.cd[best] / 1000, t = r.t[best];
    var box = document.createElement('div'); box.className = 'trpick';
    box.innerHTML = '<b>' + mi(kmv) + ' mi in' + (t != null ? ' · ' + esc(new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) : '') + '</b>' +
      '<button type="button" class="small" data-w="s">Start here</button><button type="button" class="small" data-w="e">End here</button>';
    var pop = L.popup({ closeButton: true }).setLatLng(r.ll[best]).setContent(box).openOn(trMap.map);
    $$('button', box).forEach(function (b) {
      b.onclick = function () {
        var S = $('#trS'), En = $('#trE'), a = +S.value, z = +En.value;
        // a start past the end (or an end before the start) moves the other one back out of the way
        var gap = trackRaw.km * 0.02;
        if (b.getAttribute('data-w') === 's') { a = kmv; if (z < a + gap) z = trackRaw.km; } else { z = kmv; if (a > z - gap) a = 0; }
        a = Math.max(0, Math.min(a, trackRaw.km - gap)); z = Math.min(trackRaw.km, Math.max(z, a + gap));
        trMap.map.closePopup(pop);
        trackRaw.range = a <= 0.001 && z >= trackRaw.km - 0.001 ? null : [a, z];
        applyTrack();
      };
    });
  }
  // track files in the note's Drive folder, offered for adding or replacing the track
  var DRIVETRK = null;
  function driveTracks() {
    if (!E.source) return Promise.resolve([]);
    if (DRIVETRK) return Promise.resolve(DRIVETRK);
    return api('inbox', null, '&f=' + encodeURIComponent(E.source))
      .then(function (j) { return (DRIVETRK = j.files.filter(function (f) { return f.kind === 'track'; })); })
      .catch(function () { return []; });
  }
  function offerDriveTracks(box) {
    driveTracks().then(function (list) {
      var d = $('.drvtrk', box); if (!d || !list.length) return;
      d.innerHTML = '<p class="muted">In this note\'s Drive folder:</p>' + list.map(function (f) {
        return '<button type="button" class="small useTrk" data-n="' + esc(f.name) + '">Use ' + esc(f.name.split('/').pop()) + ' <small>' + size(f.bytes) + '</small></button>';
      }).join(' ');
      $$('.useTrk', d).forEach(function (b) {
        b.onclick = function () {
          b.disabled = true; b.textContent = 'Reading…';
          fetch(driveUrl(b.getAttribute('data-n'))).then(function (r) { if (!r.ok) throw new Error('couldn\'t fetch it'); return r.blob(); })
            .then(function (bl) { return addTrack(new File([bl], b.getAttribute('data-n').split('/').pop())); })
            .catch(function (err) { toast('Couldn\'t read that track: ' + err.message, true); renderTrack(); });
        };
      });
    });
  }

  // ---------- photos ----------
  function renderPhotos() {
    var box = $('#photos');
    box.innerHTML = E.photos.map(function (p, i) {
      var n = photoName(p), clip = !!p.video;
      return '<div class="ph' + (p.use === 'skip' ? ' off' : '') + '" data-i="' + i + '">' +
        (clip ? clipView(p, n) : '<img src="' + esc(photoUrl(p)) + '" alt="" loading="lazy">') +
        '<div class="meta"><small>' + esc(n) + (p.hdr ? ' · HDR of ' + p.hdr : '') + (p.table ? ' · on the table' : '') + (p.takenAt ? ' · ' + esc(String(p.takenAt).slice(11, 16)) : '') + (fresh[n] || clipsNew[n] ? ' · new' : '') + '</small>' +
        '<textarea rows="2" placeholder="Caption">' + esc(p.caption) + '</textarea>' +
        '<div class="opts"><label><input type="checkbox" class="use"' + (p.use !== 'skip' ? ' checked' : '') + '> Use</label>' +
        '<label><input type="radio" name="cover" class="cover"' + (p.cover ? ' checked' : '') + '> Cover</label>' + (clip ? '<button type="button" class="link pfBtn">Poster frame</button>' : '') +
        '<button class="link rm">Remove</button></div></div></div>';
    }).join('');
    $$('.ph', box).forEach(function (d) {
      $('textarea', d).addEventListener('input', markDirty);
      $$('input', d).forEach(function (i) { i.addEventListener('change', function () { markDirty(); collect(); d.classList.toggle('off', !$('.use', d).checked); }); });
      $('.rm', d).onclick = function () {
        if (!confirm('Remove this photo from the entry?')) return;
        collect();
        var i = +d.getAttribute('data-i'), p = E.photos[i], n = photoName(p);
        if (p.poster) delete posterNew[p.poster.split('/').pop()];
        if (fresh[n]) delete fresh[n]; else if (clipsNew[n]) delete clipsNew[n]; else { removed.push(n); if (p.poster) removed.push(p.poster.split('/').pop()); }
        E.photos.splice(i, 1); markDirty(); renderPhotos(); renderLoops();
      };
    });
    $$('.pfBtn', box).forEach(function (b) { b.onclick = function () { collect(); posterPicker(E.photos[+b.closest('.ph').getAttribute('data-i')]); }; });
    // a saved loop plays when tapped: fetched once, then played from memory
    $$('video[data-clip]', box).forEach(function (v) {
      v.onclick = function () {
        if (v.src) { if (v.paused) v.play(); else v.pause(); return; }
        fetch('api.php?a=clip&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(v.getAttribute('data-clip')))
          .then(function (r) { if (!r.ok) throw 0; return r.blob(); })
          .then(function (b) { v.src = URL.createObjectURL(b); v.play(); }).catch(function () { toast('Couldn\'t load that clip.', true); });
      };
    });
  }
  function clipView(p, n) {
    var c = clipsNew[n], pn = p.poster ? p.poster.split('/').pop() : '', pk = posterNew[pn];
    if (c) return '<video class="clip" muted loop playsinline autoplay src="api.php?a=vfile&t=loop&k=' + c.token + '" poster="' + (pk ? pk.url : 'api.php?a=vfile&t=poster&k=' + c.token) + '"></video>';
    if (!E.id || !p.poster) return '<div class="clip">Clip ' + esc(n) + '</div>';
    return '<video class="clip" muted loop playsinline data-clip="' + esc(n) + '" poster="' + (pk ? pk.url : 'api.php?a=photo&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(pn) + posterBust) + '" title="Tap to play"></video>';
  }
  // A loop's poster frame: the still that shows before it plays, on cards and when it's shared. Scrub to any
  // frame, or let it find a good one: frames across the loop are scored for sharpness, colour and exposure.
  function posterPicker(p) {
    var n = photoName(p), pn = p.poster.split('/').pop(), c = clipsNew[n];
    var d = document.createElement('dialog'); d.className = 'pfp';
    d.innerHTML = '<h2>Poster frame <small>' + esc(n) + '</small></h2><video muted playsinline preload="auto"></video>' +
      '<input type="range" min="0" max="1" step="0.01" value="0" class="pf-r"><div class="pf-t muted"></div><div class="pf-c"></div>' +
      '<div class="row"><button type="button" class="small pf-find">Find a nice frame</button><span class="sp"></span><button type="button" class="link pf-x">Cancel</button><button type="button" class="primary pf-use">Use this frame</button></div>';
    document.body.appendChild(d); d.showModal();
    var v = $('video', d), r = $('.pf-r', d), t = $('.pf-t', d), url = null;
    var close = function () { d.close(); d.remove(); if (url) URL.revokeObjectURL(url); };
    $('.pf-x', d).onclick = close; d.addEventListener('cancel', close);
    var src = c ? Promise.resolve('api.php?a=vfile&t=loop&k=' + c.token)
      : fetch('api.php?a=clip&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(n)).then(function (x) { if (!x.ok) throw new Error('couldn\'t load the loop'); return x.blob(); }).then(function (b) { return (url = URL.createObjectURL(b)); });
    src.then(function (u) { v.src = u; }).catch(function (err) { t.textContent = err.message; });
    var seek = function (sec) { return new Promise(function (ok) { var f = function () { v.removeEventListener('seeked', f); ok(); }; v.addEventListener('seeked', f); v.currentTime = sec; }); };
    v.addEventListener('loadedmetadata', function () { r.max = v.duration.toFixed(2); r.step = Math.max(0.01, v.duration / 300).toFixed(3); t.textContent = '0.0 s of ' + v.duration.toFixed(1) + ' s'; seek(0.01); });
    r.oninput = function () { v.currentTime = +r.value; t.textContent = (+r.value).toFixed(1) + ' s of ' + v.duration.toFixed(1) + ' s'; };
    $('.pf-find', d).onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'Looking…';
      bestFrames(v, seek).then(function (list) {
        b.disabled = false; b.textContent = 'Find a nice frame';
        var box = $('.pf-c', d);
        box.innerHTML = list.map(function (f, i) { return '<button type="button" class="pf-k' + (i === 0 ? ' best' : '') + '" data-t="' + f.t + '" title="' + f.t.toFixed(1) + ' s"><img src="' + f.thumb + '" alt=""></button>'; }).join('');
        $$('.pf-k', box).forEach(function (k) { k.onclick = function () { $$('.pf-k', box).forEach(function (x) { x.classList.remove('on'); }); k.classList.add('on'); r.value = k.getAttribute('data-t'); r.oninput(); }; });
        r.value = list[0].t; r.oninput();
      });
    };
    $('.pf-use', d).onclick = function () {
      var cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight;
      cv.getContext('2d').drawImage(v, 0, 0);
      cv.toBlob(function (bl) {
        if (posterNew[pn]) URL.revokeObjectURL(posterNew[pn].url);
        posterNew[pn] = { blob: bl, url: URL.createObjectURL(bl) };
        close(); markDirty(); renderPhotos(); toast('Poster frame set. Save to keep it.');
      }, 'image/jpeg', 0.86);
    };
  }
  // frames across the loop, best first: sharp (the spread of a Laplacian), colourful (Hasler and Süsstrunk's
  // measure) and well exposed. Scored small, on 12 frames between the first and last 5%.
  function bestFrames(v, seek) {
    var W = 160, H = Math.max(1, Math.round(160 * v.videoHeight / v.videoWidth)), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d', { willReadFrequently: true }), out = [], chain = Promise.resolve();
    for (var i = 0; i < 12; i++) (function (k) {
      var at = v.duration * (0.05 + 0.9 * k / 11);
      chain = chain.then(function () { return seek(at); }).then(function () {
        g.drawImage(v, 0, 0, W, H);
        var px = g.getImageData(0, 0, W, H).data, n = W * H, gray = new Float32Array(n), srg = 0, syb = 0, qrg = 0, qyb = 0, lum = 0;
        for (var j = 0; j < n; j++) {
          var R = px[j * 4], G = px[j * 4 + 1], B = px[j * 4 + 2], rg = R - G, yb = (R + G) / 2 - B;
          gray[j] = 0.299 * R + 0.587 * G + 0.114 * B; lum += gray[j]; srg += rg; syb += yb; qrg += rg * rg; qyb += yb * yb;
        }
        var mrg = srg / n, myb = syb / n, color = Math.sqrt(qrg / n - mrg * mrg + qyb / n - myb * myb) + 0.3 * Math.sqrt(mrg * mrg + myb * myb);
        var ls = 0, lq = 0, m = 0;
        for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
          var q = y * W + x, L = 4 * gray[q] - gray[q - 1] - gray[q + 1] - gray[q - W] - gray[q + W]; ls += L; lq += L * L; m++;
        }
        var sharp = lq / m - (ls / m) * (ls / m), mean = lum / n;
        out.push({ t: at, sharp: sharp, color: color, expo: mean < 45 ? (45 - mean) / 45 : mean > 215 ? (mean - 215) / 40 : 0, thumb: cv.toDataURL('image/jpeg', 0.7) });
      });
    })(i);
    return chain.then(function () {
      var ms = Math.max.apply(0, out.map(function (f) { return f.sharp; })) || 1, mc = Math.max.apply(0, out.map(function (f) { return f.color; })) || 1;
      out.forEach(function (f) { f.score = 0.55 * f.sharp / ms + 0.45 * f.color / mc - 0.6 * f.expo; });
      return out.sort(function (a, b) { return b.score - a.score; }).slice(0, 6);
    });
  }
  function nextName() {
    var max = 0;
    E.photos.forEach(function (p) { var m = /^(\d{2})\./.exec(photoName(p)); if (m) max = Math.max(max, +m[1]); });
    removed.forEach(function (n) { var m = /^(\d{2})\./.exec(n); if (m) max = Math.max(max, +m[1]); });
    return String(max + 1).padStart(2, '0') + '.jpg';
  }
  // A drone's exposure bracket (the same view shot dark, normal and bright a second or two apart) becomes
  // one HDR photo (assets/hdr.js); only the merge is kept. Shots taken within 3 seconds of each other are a
  // candidate set; the merge itself checks they're one view at different exposures, and if not they stay
  // separate photos. A picture already merged elsewhere (its name says HDR) is left as it is.
  function brackets(list, times) {
    var items = list.map(function (f, i) { return { f: f, t: times[i] ? Date.parse(times[i].replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')) : NaN }; });
    var timed = items.filter(function (x) { return !isNaN(x.t) && !/hdr/i.test(x.f.name); }).sort(function (a, b) { return a.t - b.t; });
    var units = [], cur = [];
    timed.forEach(function (x) { if (cur.length && (x.t - cur[cur.length - 1].t > 3000 || cur.length >= 5)) { units.push(cur); cur = []; } cur.push(x); });
    if (cur.length) units.push(cur);
    var grouped = units.filter(function (u) { return u.length > 1; }).map(function (u) { return u.map(function (x) { return x.f; }); });
    var inSet = grouped.reduce(function (a, u) { return a.concat(u); }, []);
    return { sets: grouped, singles: list.filter(function (f) { return inSet.indexOf(f) < 0; }) };
  }
  function mergeBracket(set) {
    return Promise.all(set.map(exifDate)).then(function (ts) {
      return window.StudioHDR.merge(set, 1600).then(function (r) {
        if (!r) return false;
        return new Promise(function (ok) { r.canvas.toBlob(ok, 'image/jpeg', 0.86); }).then(function (big) {
          return shrink(big, 360, 0.7).then(function (th) {
            return blobToB64(th.blob).then(function (tb64) {
              var n = nextName();
              fresh[n] = { blob: big, thumb: 'data:image/jpeg;base64,' + tb64 };
              E.photos.push({ src: 'data/photos/' + (E.id || 'new') + '/' + n, caption: '', takenAt: ts.filter(Boolean).sort()[0] || null, w: r.w, h: r.h, use: 'post',
                cover: !E.photos.some(function (p) { return p.cover; }), from: set.map(function (f) { return f.name; }).join(' + '), hdr: set.length });
              return true;
            });
          });
        });
      });
    }).catch(function () { return false; });
  }
  function addPhotos(files) {
    collect();
    var list = [].slice.call(files).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|heic|png|webp)$/i.test(f.name); });
    if (!list.length) return Promise.resolve();
    return Promise.all(list.map(exifDate)).then(function (times) {
      var b = window.StudioHDR ? brackets(list, times) : { sets: [], singles: list }, merged = 0;
      var chain = Promise.resolve();
      b.sets.forEach(function (set) {
        chain = chain.then(function () {
          toast('Merging ' + set.length + ' exposures into one HDR photo…');
          return mergeBracket(set).then(function (ok) { if (ok) merged++; else b.singles = b.singles.concat(set); });
        });
      });
      return chain.then(function () { return addSingles(b.singles, merged); });
    });
  }
  function addSingles(list, merged) {
    if (!list.length) { E.photos.sort(function (a, b) { var x = String(a.takenAt || '~'), y = String(b.takenAt || '~'); return x < y ? -1 : x > y ? 1 : 0; }); markDirty(); renderPhotos(); if (merged) toast('Merged ' + merged + ' HDR photo' + (merged > 1 ? 's' : '') + '.'); return Promise.resolve(); }
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
      E.photos.sort(function (a, b) { var x = String(a.takenAt || '~'), y = String(b.takenAt || '~'); return x < y ? -1 : x > y ? 1 : 0; });
      markDirty(); renderPhotos();
      if (merged) toast('Merged ' + merged + ' HDR photo' + (merged > 1 ? 's' : '') + '.');
    });
  }

  // ---------- video loops: the videos stay on the server; it makes a small preview to scrub through here,
  // then cuts the part you choose into a short silent loop (with a poster frame) that's committed with the
  // next Save and plays in place on Play ----------
  var LOOP_MAX = 30;
  function driveVideos() {
    if (!E.source) return Promise.resolve([]);
    if (DRIVEVID) return Promise.resolve(DRIVEVID);
    return api('inbox', null, '&f=' + encodeURIComponent(E.source))
      .then(function (j) { return (DRIVEVID = j.files.filter(function (f) { return f.kind === 'video'; })); })
      .catch(function () { return []; });
  }
  function secs(t) { t = Math.max(0, t || 0); var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  function nextClip() {
    var max = 0;
    E.photos.concat(removed.map(function (n) { return { src: n }; })).forEach(function (p) { var m = /^clip-(\d+)\./.exec(photoName(p)); if (m) max = Math.max(max, +m[1]); });
    return 'clip-' + (max + 1);
  }
  function renderLoops() {
    var box = $('#loopBox'); if (!box) return Promise.resolve();
    return driveVideos().then(function (list) {
      setTimeout(renderNext, 0);
      if (!$('#loopBox')) return;
      if (!list.length) { box.innerHTML = '<p class="muted">No videos in this note\'s Drive folder.</p>'; return; }
      var made = function (n) { return E.photos.filter(function (p) { return p.video && p.from === n; }).length; };
      box.innerHTML = '<p class="muted">Pick a video, find the moment, and make a short loop (' + LOOP_MAX + ' seconds at most). Loops play silently, over and over, in the post. The videos themselves stay on the server.</p>' +
        '<ul class="vids">' + list.map(function (f) {
          var k = made(f.name), on = VT && VT.name === f.name;
          return '<li' + (on ? ' class="on"' : '') + '><span><b>' + esc(f.name.split('/').pop()) + '</b> <small>' + size(f.bytes) + (k ? ' · ' + k + ' loop' + (k > 1 ? 's' : '') + ' made' : '') + '</small></span>' +
            (on ? '' : '<button type="button" class="small trimVid" data-n="' + esc(f.name) + '">' + (k ? 'Trim another' : 'Trim a loop') + '</button>') + '</li>';
        }).join('') + '</ul><div id="trimmer"></div>';
      $$('.trimVid', box).forEach(function (b) { b.onclick = function () { openTrim(b.getAttribute('data-n')); }; });
      if (VT) drawTrim();
    });
  }
  // the end of ffmpeg's log, folded away, for when something goes wrong
  function logBox(lines) {
    return lines && lines.length ? '<details class="vt-log" id="vtLog"><summary>What ffmpeg said</summary><pre>' + esc(lines.join('\n')) + '</pre></details>' : '';
  }
  function stopTrim() { if (VT) { clearTimeout(VT.poll); VT.dead = true; } VT = null; }
  function openTrim(name) {
    stopTrim();
    VT = { name: name, state: 'working', pct: 0 };
    renderLoops(); pollPreview(true);   // opening a video again gives one that failed before a fresh try
  }
  function pollPreview(retry) {
    var vt = VT; if (!vt) return;
    api('video', null, '&f=' + encodeURIComponent(E.source) + '&n=' + encodeURIComponent(vt.name) + (retry ? '&retry=1' : '')).then(function (r) {
      if (vt.dead) return;
      vt.key = r.key; vt.info = r.info; vt.state = r.state; vt.pct = r.pct || 0; vt.error = r.error; vt.log = r.log;
      if (r.state === 'ready' && vt.from == null) { vt.from = 0; vt.to = Math.min(r.info.sec, 8); }
      drawTrim();
      if (r.state === 'working') vt.poll = setTimeout(function () { pollPreview(false); }, 2000);
    }).catch(function (err) { if (vt.dead) return; vt.state = 'failed'; vt.error = err.message; drawTrim(); });
  }
  function drawTrim() {
    var vt = VT, box = $('#trimmer'); if (!vt || !box) return;
    var head = '<div class="vt-head"><b>' + esc(vt.name.split('/').pop()) + '</b>' + (vt.info ? ' <small>' + secs(vt.info.sec) + (vt.info.hdr ? ' · HDR, toned to normal colour' : '') + '</small>' : '') +
      '<button type="button" class="link" id="vtClose">Close</button></div>';
    if (vt.state !== 'ready') {
      box.innerHTML = '<div class="trim">' + head + (vt.state === 'failed'
        ? '<p class="err">The preview didn\'t work: ' + esc(vt.error || 'ffmpeg stopped') + '</p>' + logBox(vt.log) + '<button type="button" class="small" id="vtRetry">Try again</button>'
        : '<p class="muted">Making a small preview to scrub through… ' + (vt.pct ? vt.pct + '%' : '') + '</p><div class="vt-prog"><i></i></div>') + '</div>';
      var bar = $('.vt-prog i', box); if (bar) bar.style.width = vt.pct + '%';
      $('#vtClose').onclick = function () { stopTrim(); renderLoops(); };
      var rt = $('#vtRetry'); if (rt) rt.onclick = function () { vt.state = 'working'; drawTrim(); pollPreview(true); };
      return;
    }
    if (box.getAttribute('data-k') === vt.key && $('#vtv', box)) return;   // already showing this one
    box.setAttribute('data-k', vt.key);
    var sec = vt.info.sec, st = sec > 120 ? 0.1 : 0.05;
    box.innerHTML = '<div class="trim">' + head +
      '<video id="vtv" muted playsinline controls preload="auto" src="api.php?a=vfile&t=preview&k=' + vt.key + '"></video>' +
      '<div class="vt-sel"><i></i></div>' +
      '<label class="vt-r">Start <input type="range" id="vtS" min="0" max="' + sec + '" step="' + st + '" value="' + vt.from + '"><output id="vtSo"></output></label>' +
      '<label class="vt-r">End <input type="range" id="vtE" min="0" max="' + sec + '" step="' + st + '" value="' + vt.to + '"><output id="vtEo"></output></label>' +
      '<div class="row vt-btns"><button type="button" class="small" id="vtAtS">Start at the playhead</button><button type="button" class="small" id="vtAtE">End at the playhead</button>' +
        '<button type="button" class="small" id="vtLoop">▶ Play the loop</button><span id="vtLen" class="muted"></span></div>' +
      field('Caption', '<input id="vtCap" placeholder="What\'s happening in it">') +
      '<div class="row"><button type="button" class="primary" id="vtMake">Make the loop</button><span id="vtMsg" class="muted"></span></div><div id="vtLog"></div></div>';
    var v = $('#vtv'), S = $('#vtS'), En = $('#vtE'), looping = false;
    var show = function () {
      $('#vtSo').textContent = secs(vt.from); $('#vtEo').textContent = secs(vt.to);
      var len = vt.to - vt.from, over = len > LOOP_MAX;
      $('#vtLen').textContent = 'Loop: ' + len.toFixed(1) + ' s' + (over ? ' (too long: ' + LOOP_MAX + ' s at most)' : '');
      $('#vtLen').className = over ? 'err' : 'muted';
      $('#vtMake').disabled = over || len < 0.5;
      var sel = $('.vt-sel i'); sel.style.left = (vt.from / sec * 100) + '%'; sel.style.width = ((vt.to - vt.from) / sec * 100) + '%';
    };
    var seek = function (t) { try { v.currentTime = t; } catch (e) {} };
    S.oninput = function () { vt.from = Math.min(+S.value, vt.to - 0.5); S.value = vt.from; if (!looping) { v.pause(); seek(vt.from); } show(); };
    En.oninput = function () { vt.to = Math.max(+En.value, vt.from + 0.5); En.value = vt.to; if (!looping) { v.pause(); seek(vt.to); } show(); };
    $('#vtAtS').onclick = function () { vt.from = Math.min(v.currentTime, vt.to - 0.5); S.value = vt.from; show(); };
    $('#vtAtE').onclick = function () { vt.to = Math.max(v.currentTime, vt.from + 0.5); En.value = vt.to; show(); };
    // playing the loop: back to the start whenever the playhead passes the end, checked every frame
    var tick = function () {
      if (!looping || VT !== vt) return;
      if (v.currentTime >= vt.to || v.currentTime < vt.from - 0.25) seek(vt.from);
      requestAnimationFrame(tick);
    };
    var lb = $('#vtLoop');
    lb.onclick = function () {
      looping = !looping; lb.textContent = looping ? '■ Stop' : '▶ Play the loop';
      if (looping) { seek(vt.from); v.play(); requestAnimationFrame(tick); } else v.pause();
    };
    v.addEventListener('pause', function () { if (looping && !v.seeking) { looping = false; lb.textContent = '▶ Play the loop'; } });
    $('#vtClose').onclick = function () { stopTrim(); renderLoops(); };
    $('#vtMake').onclick = function () { makeLoop(vt, $('#vtCap').value.trim()); };
    show();
  }
  function makeLoop(vt, cap) {
    var b = $('#vtMake'), msg = $('#vtMsg'), from = +vt.from.toFixed(2), to = +vt.to.toFixed(2), retry = false;
    b.disabled = true;
    var ask = function () {
      api('loop', { f: E.source, n: vt.name, from: from, to: to, retry: retry }).then(function (r) {
        retry = false;
        if (vt.dead) return;
        if (r.state === 'working') { if (msg) msg.textContent = 'Making the loop… ' + (r.pct ? r.pct + '%' : ''); setTimeout(ask, 2000); return; }
        if (r.state === 'failed') { var lg = $('#vtLog'); if (lg) lg.outerHTML = logBox(r.log); throw new Error(r.error || 'ffmpeg stopped'); }
        collect();
        var name = nextClip();
        clipsNew[name + '.mp4'] = { token: r.token };
        E.photos.push({ src: 'data/photos/' + (E.id || 'new') + '/' + name + '.mp4', poster: 'data/photos/' + (E.id || 'new') + '/' + name + '.jpg', video: true,
          caption: cap, takenAt: r.taken || null, w: r.w, h: r.h, use: 'post', cover: false, from: vt.name, range: [from, to] });
        E.photos.sort(function (a, c) { var x = String(a.takenAt || '~'), y = String(c.takenAt || '~'); return x < y ? -1 : x > y ? 1 : 0; });
        markDirty(); renderPhotos();
        toast('Loop made. Save to keep it.');
        return renderLoops().then(function () {
          var m = $('#vtMsg'); if (m) m.textContent = 'Made ' + name + ': ' + size(r.bytes) + ', ' + r.w + '×' + r.h + '. It\'s in Photos above; Save to keep it.';
        });
      }).catch(function (err) { retry = true; if (msg) msg.textContent = ''; if (b) b.disabled = false; toast('The loop didn\'t work: ' + err.message, true); });
    };
    if (msg) msg.textContent = 'Making the loop…';
    ask();
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
  // How ready the note is to publish: every part the post, the card and the episode need. Title and post
  // text are a must (it can't go out without them); the rest only make the Publish button brighter, from
  // yellow to green, and are listed when you publish with something still missing.
  function readiness() {
    var val = function (id) { var el = $('#' + id); return el ? el.value.trim() : ''; };
    var used = E.photos.filter(function (p) { return p.use !== 'skip'; });
    var capd = used.filter(function (p) { var d = $('.ph[data-i="' + E.photos.indexOf(p) + '"] textarea'); return (d ? d.value : p.caption || '').trim(); });
    var kind = val('kind') || E.kind, needsTrack = kind === 'ride' || kind === 'hike';
    var list = [
      { go: '#title', t: 'Title', ok: !!val('title'), must: true },
      { go: '#postBody', t: 'The post\'s text', ok: !!val('postBody'), must: true },
      { go: '#postTitle', t: 'The post\'s title', ok: !!val('postTitle') },
      { go: '#summary', t: 'Card summary', ok: !!val('summary') },
      { go: '#place', t: 'Place', ok: !!val('place') },
      { go: '#consent', t: 'Who appears', ok: !!val('consent') },
      { go: '#photos', t: 'Photos', ok: used.some(function (p) { return !p.video; }) },
      { go: '#photos', t: 'Captions on every photo and loop', ok: used.length > 0 && capd.length === used.length },
      { go: '#track', t: needsTrack ? 'The track' : 'The track (none needed)', ok: !needsTrack || !!E.track },
      { go: '#track', t: 'No ride from home on the map', ok: !(E.track && E.track.homeWarning) },
      { go: '#questions', t: 'Claude\'s questions answered', ok: !(E.questions || []).length },
      { go: '#epScript', t: 'The episode script', ok: !!val('epScript') },
      { go: '#audio', t: 'The episode audio', ok: !!(audioNew || (E.episode.audio && !audioGone)) }
    ];
    var n = list.filter(function (x) { return x.ok; }).length;
    return { list: list, done: n, score: n / list.length, able: list.every(function (x) { return !x.must || x.ok; }) };
  }
  function renderPublish() {
    var b = $('#publish'); if (!b || !E) return;
    if (!owner()) { b.hidden = true; return; }
    var r = readiness(), live = savedStatus === 'published';
    // yellow (hue 48) when barely ready, green (hue 135) when every part is there; the glow grows with it
    b.style.setProperty('--h', live ? '135' : String(Math.round(48 + 87 * r.score * r.score)));
    b.style.setProperty('--g', live ? '.35' : r.able ? (0.15 + 0.85 * r.score * r.score).toFixed(2) : '0');
    b.classList.toggle('full', r.score === 1 && !live);
    b.classList.toggle('live', live);
    b.disabled = !r.able && !live;
    $('.pub-t', b).textContent = live ? (dirty ? 'Live: Save updates it' : 'Live on Play') : r.score === 1 ? 'Ready to publish' : 'Publish';
    $('.pub-n', b).textContent = live ? '' : r.done + ' of ' + r.list.length;
    b.title = r.list.map(function (x) { return (x.ok ? '✓ ' : '○ ') + x.t; }).join('\n');
  }
  function publish() {
    var r = readiness();
    if (savedStatus === 'published') { if (dirty) save(); else window.open('/play/' + E.id + '/', '_blank', 'noopener'); return; }
    if (!r.able) return;
    var miss = r.list.filter(function (x) { return !x.ok; }).map(function (x) { return '  · ' + x.t; });
    if (miss.length && !confirm('Not everything is ready yet:\n' + miss.join('\n') + '\n\nPublish anyway?')) return;
    $('#status').value = 'published'; publishing = true;
    save(true);
  }
  function nextSteps() {
    var val = function (id) { var el = $('#' + id); return el ? el.value.trim() : ''; };
    var drafted = !!(val('postBody') || val('epScript')), q = (E.questions || []).length;
    var vn = (DRIVEAUD || []).filter(function (f) { return roleOf(f.name) === 'notes'; }).length;
    var audio = !!(audioNew || (E.episode.audio && !audioGone));
    var videos = (DRIVEVID || []).length, loops = E.photos.some(function (p) { return p.video && p.from; });
    var out = [];
    if (vn && !E.voiceNotesDone) out.push({ t: 'Listen to your voice notes', d: 'Add what matters to Your notes: Claude can only use what\'s written there.', b: 'Listen', go: '#voiceNotes', done: 'voice' });
    if (!drafted) out.push({ t: 'Draft with Claude', d: 'Claude writes the post, the captions and the episode script from your notes, track and photos.', b: 'Draft', run: function () { draft(); } });
    if (q) out.push({ t: 'Answer Claude\'s ' + (q === 1 ? 'question' : q + ' questions'), d: 'The script isn\'t final until they\'re answered. Answer them one by one, then send them all at once.', b: 'Answer', go: '#questions' });
    if (drafted && !q && !val('epScript')) out.push({ t: 'Write the episode script', d: 'The episode is read from it. Draft with Claude writes one from the post, or write your own.', b: 'Go to the script', go: '#epScript' });
    if (drafted && !q && val('epScript') && !audio) out.push({ t: 'Record the episode', d: 'Copy the audio prompt, render it with your voice tool, then drop the audio in or choose it from Drive.', b: 'Go to the audio', go: '#copyPrompt' });
    if (videos && !loops && !E.loopsDone) out.push({ t: 'Trim video loops', d: videos + ' video' + (videos > 1 ? 's' : '') + ' in the Drive folder. Pick the moments worth a short silent loop.', b: 'Trim loops', go: '#loops', done: 'loops' });
    if (dirty) out.push({ t: 'Save', d: 'Keep what you have so far.', b: 'Save', run: save });
    if (!owner()) {
      if (REVIEW && REVIEW.state === 'returned') out.unshift({ t: 'Sent back for changes', d: REVIEW.note || 'Make the changes, then save it for review again.', b: 'Save for review', run: save });
      else if (dirty) out.push({ t: 'Save for review', d: 'The owner reviews it and puts it live. Nothing on the site changes until then.', b: 'Save for review', run: save });
      return out.filter(function (x) { return x.t !== 'Save'; });
    }
    if (drafted && !q && audio && savedStatus !== 'published') out.push({ t: 'Publish', d: 'Everything the episode needs is here. Play and the podcast feed update about a minute after you publish.', b: 'Publish', run: publish });
    if (!out.length && E.id && savedStatus === 'published') out.push({ t: 'All done', d: 'It\'s live on Play.', b: 'Open on Play', href: '/play/' + E.id + '/' });
    return out;
  }
  // The note's status follows what's in it: notes in, then a draft, a finished script, the audio, and
  // Published once you publish it. Worked out each time anything changes, and kept in the saved note.
  var publishing = false;   // between Publish and the end of its save, the status stays Published
  var STAGES = [['notes', 'Notes in'], ['draft', 'Draft'], ['script', 'Script ready'], ['audio', 'Audio done'], ['published', 'Published']];
  function stageOf() {
    var val = function (id) { var el = $('#' + id); return el ? el.value.trim() : ''; };
    var done = {
      notes: !!(E.photos.length || E.track || val('fieldNotes') || E.source || val('postBody')),
      draft: !!val('postBody'),
      script: !!val('epScript') && !(E.questions || []).length,
      audio: !!(audioNew || (E.episode.audio && !audioGone)),
      published: savedStatus === 'published'
    };
    var at = 0; while (at < 4 && done[STAGES[at][0]]) at++;   // the first step not yet done (Published is only ever set by you)
    return { done: done, at: done.published ? 5 : at, status: done.published ? 'published' : STAGES[Math.max(0, at - 1)][0] };
  }
  // only what changed is redrawn: a click on a chip lands even when leaving a field just redrew the summary
  function put(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }
  function renderNext() {
    renderPublish();
    if (!E || !$('#sum')) return;
    var st = stageOf(), stEl = $('#status');
    if (stEl && !publishing && savedStatus !== 'published' && stEl.value !== st.status) { stEl.value = st.status; E.status = st.status; }
    // the stages, with the one you're on lit
    put($('#stages'), STAGES.map(function (x, i) {
      var cls = i < st.at ? 'done' : i === st.at ? 'now' : '';
      return '<li class="' + cls + '"><span>' + (cls === 'done' ? '✓' : i + 1) + '</span>' + esc(x[1]) + '</li>';
    }).join(''));
    // what the note holds, each a jump to its part
    var used = E.photos.filter(function (p) { return p.use !== 'skip'; }), loops = used.filter(function (p) { return p.video; }).length, vids = (DRIVEVID || []).length;
    var dt = $('#date') ? $('#date').value : E.date, place = $('#place') ? $('#place').value.trim() : E.place, kind = $('#kind') ? $('#kind').value : E.kind;
    var chip = function (txt, to, warn) { return '<button type="button" class="chip' + (warn ? ' warn' : '') + '" data-go="' + to + '">' + txt + '</button>'; };
    var ts = E.track && E.track.stats, nq = (E.questions || []).length, np = used.length - loops;
    put($('#sumMeta'), '<span>' + esc(dt ? new Date(dt + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '') + ' · ' + esc(kind) + '</span>' +
      (place ? chip(esc(place), '#place') : chip('Add the place', '#place', true)) +
      (ts ? chip(mi(ts.distanceKm || 0) + ' mi · ↑ ' + ft(ts.gainM || 0).toLocaleString() + ' ft', '#track') : (kind === 'ride' || kind === 'hike' ? chip('No track yet', '#track', true) : '')) +
      chip(np + ' photo' + (np === 1 ? '' : 's'), '#photos', !np) +
      (loops || vids ? chip(loops + ' loop' + (loops === 1 ? '' : 's') + (vids ? ' · ' + vids + ' video' + (vids === 1 ? '' : 's') : ''), E.source ? '#loops' : '#photos') : '') +
      (nq ? chip(nq + ' open question' + (nq > 1 ? 's' : ''), '#questions', true) : '') +
      (E.source ? '<span class="src" title="Made from this Drive folder">Drive: ' + esc(E.source) + '</span>' : ''));
    put($('#sumLive'), savedStatus === 'published' && E.id ? '<a class="live" href="/play/' + esc(E.id) + '/" target="_blank" rel="noopener">● Live on Play ↗</a><button type="button" class="link" id="unpub">Take it down</button>' : '');
    var up = $('#unpub'); if (up) { if (!owner()) up.remove(); else up.onclick = unpublish; }
    renderReviewBar();
    // the one thing to do next, and the two after it
    var steps = nextSteps().filter(function (x) { return !x.href; }).slice(0, 3), box = $('#next');   // "live on Play" is already at the top
    box.hidden = !steps.length;
    put(box, steps.length ? '<div class="now"><div><small>Next</small><b>' + esc(steps[0].t) + '</b><span>' + esc(steps[0].d) + '</span></div><div class="nb">' + stepBtn(steps[0], 0, true) + '</div></div>' +
      (steps.length > 1 ? '<div class="then"><small>Then</small>' + steps.slice(1).map(function (x, i) { return stepBtn(x, i + 1, false); }).join('') + '</div>' : '') : '');
    $$('button[data-i]', box).forEach(function (b) {
      var x = steps[+b.getAttribute('data-i')];
      b.onclick = function () { if (x.run) x.run(); else go(x.go); };
    });
    $$('button[data-done]', box).forEach(function (b) { b.onclick = function () { E[b.getAttribute('data-done') === 'loops' ? 'loopsDone' : 'voiceNotesDone'] = true; markDirty(); }; });
    // what's still missing for a full post: a bar from yellow to green, and each missing part a jump
    var r = readiness(), miss = r.list.filter(function (x) { return !x.ok; }), left = $('#left');
    put(left, '<div class="rbar"><i></i></div><span class="rn"><b>' + r.done + ' of ' + r.list.length + '</b> ready</span>' +
      (miss.length ? '<span class="rmiss">' + miss.map(function (x) { return '<button type="button" class="chip' + (x.must ? ' warn' : '') + '" data-go="' + x.go + '">' + esc(x.t) + '</button>'; }).join('') + '</span>'
        : '<span class="rmiss ok">Everything a full post needs is here.</span>'));
    var bar = $('.rbar i', left); bar.style.width = Math.round(r.score * 100) + '%'; bar.style.setProperty('--h', String(Math.round(48 + 87 * r.score * r.score)));
    $$('#sum [data-go]').forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-go')); }; });
  }
  // ---------- review: an editor's saves wait on a review copy until the owner approves them ----------
  function renderReviewBar() {
    var box = $('#revBar'); if (!box) return;
    if (!REVIEW) { put(box, ''); return; }
    var r = REVIEW;
    if (!owner()) {
      put(box, '<div class="revbar ' + (r.state === 'returned' ? 'back' : '') + '"><b>' + (r.state === 'returned' ? 'Sent back for changes' : 'Waiting for review') + '</b>' +
        '<span>' + (r.state === 'returned' ? esc(r.note || 'Make the changes, then save it for review again.') : 'Saved ' + esc(when(r.at)) + '. Nothing on the site changes until it\'s approved.') + '</span></div>');
      return;
    }
    var ch = changes();
    put(box, '<div class="revbar"><div><b>' + esc(r.by) + '\'s ' + (LIVE ? 'changes' : 'new note') + ' wait for your review</b><span>Saved ' + esc(when(r.at)) + (r.state === 'returned' ? ' · sent back' + (r.note ? ': ' + esc(r.note) : '') : '') + '</span></div>' +
      '<div class="rb-btns"><button type="button" class="primary" id="rvOk">' + (r.live ? 'Approve and update the live post' : 'Approve') + '</button><button type="button" class="small" id="rvBack">Send back</button><button type="button" class="link" id="rvDrop">Discard</button></div>' +
      (ch.length ? '<details class="rb-ch"><summary>What changed (' + ch.length + ')</summary><ul>' + ch.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></details>' : '') + '</div>');
    $('#rvOk').onclick = function () {
      if (dirty && !confirm('You have unsaved changes of your own. Approve without them?')) return;
      var b = this; b.disabled = true; b.textContent = 'Approving…';
      api('approve', { id: E.id }).then(function () { toast(r.live ? 'Approved. The live post updates in about a minute.' : 'Approved. It\'s in the notes now.'); dirty = false; edit(E.id); })
        .catch(function (err) { b.disabled = false; b.textContent = 'Approve'; toast(err.message, true); });
    };
    $('#rvBack').onclick = function () {
      var note = prompt('What should ' + r.by + ' change? (they see this on the note)'); if (note === null) return;
      api('sendback', { id: E.id, note: note }).then(function () { REVIEW.state = 'returned'; REVIEW.note = note; box._h = null; renderReviewBar(); toast('Sent back to ' + r.by + '.'); }).catch(function (err) { toast(err.message, true); });
    };
    $('#rvDrop').onclick = function () {
      if (!confirm('Throw away ' + r.by + '\'s changes to this note? This can\'t be undone.')) return;
      api('discard', { id: E.id }).then(function () { toast('Discarded.'); dirty = false; if (LIVE) edit(E.id); else showList(); }).catch(function (err) { toast(err.message, true); });
    };
  }
  // what the review copy changes, part by part, against the live note
  function changes() {
    var a = LIVE, b = E, out = [];
    if (!a) return ['A new note: ' + (b.title || b.id)];
    var w = function (t) { return (String(t || '').match(/\S+/g) || []).length; };
    var txt = function (label, x, y) { if ((x || '') !== (y || '')) out.push(label + (x && y ? ' edited (' + w(x) + ' → ' + w(y) + ' words)' : y ? ' added' : ' removed')); };
    [['Title', 'title'], ['Place', 'place'], ['Card summary', 'summary'], ['Who appears', 'consent'], ['Your notes', 'fieldNotes']].forEach(function (f) { if ((a[f[1]] || '') !== (b[f[1]] || '')) out.push(f[0] + (f[1] === 'fieldNotes' ? ' edited' : ': “' + (b[f[1]] || '') + '”')); });
    txt('Post text', a.post && a.post.body, b.post && b.post.body);
    if ((a.post && a.post.title) !== (b.post && b.post.title)) out.push('Post title: “' + ((b.post && b.post.title) || '') + '”');
    txt('Episode script', a.episode && a.episode.script, b.episode && b.episode.script);
    if ((a.episode && a.episode.audio) !== (b.episode && b.episode.audio)) out.push(b.episode && b.episode.audio ? 'Episode audio added or replaced' : 'Episode audio removed');
    var an = (a.photos || []).map(photoName), bn = (b.photos || []).map(photoName);
    var add = bn.filter(function (n) { return an.indexOf(n) < 0; }), gone = an.filter(function (n) { return bn.indexOf(n) < 0; });
    if (add.length) out.push(add.length + ' photo' + (add.length > 1 ? 's' : '') + ' or loop' + (add.length > 1 ? 's' : '') + ' added (' + add.join(', ') + ')');
    if (gone.length) out.push(gone.length + ' removed (' + gone.join(', ') + ')');
    var cap = (b.photos || []).filter(function (p) { var o = (a.photos || []).filter(function (q) { return photoName(q) === photoName(p); })[0]; return o && ((o.caption || '') !== (p.caption || '') || o.use !== p.use || !!o.cover !== !!p.cover); });
    if (cap.length) out.push(cap.length + ' photo' + (cap.length > 1 ? 's' : '') + ' with a new caption, cover or use');
    var ta = a.track && a.track.stats, tb = b.track && b.track.stats;
    if (!!ta !== !!tb) out.push(tb ? 'Track added' : 'Track removed');
    else if (ta && tb && Math.abs((ta.distanceKm || 0) - (tb.distanceKm || 0)) > 0.01) out.push('Track trimmed: ' + mi(ta.distanceKm) + ' → ' + mi(tb.distanceKm) + ' mi');
    if (JSON.stringify(a.dashboard || null) !== JSON.stringify(b.dashboard || null)) out.push('Trail stats shown on the post');
    if ((a.questions || []).length !== (b.questions || []).length) out.push('Claude\'s questions: ' + (a.questions || []).length + ' → ' + (b.questions || []).length);
    return out;
  }

  function stepBtn(x, i, main) {
    if (x.href) return '<a class="btn' + (main ? ' primary' : ' small') + '" href="' + x.href + '" target="_blank" rel="noopener">' + esc(main ? x.b : x.t) + ' ↗</a>';
    return '<button type="button" class="' + (main ? 'primary' : 'small') + '" data-i="' + i + '" title="' + esc(x.d) + '">' + esc(main ? x.b : x.t) + '</button>' +
      (main && x.done ? '<button type="button" class="link" data-done="' + x.done + '">Done</button>' : '');
  }
  function unpublish() {
    if (!confirm('Take this note off Play? It goes back to its last step and stays here to work on.')) return;
    savedStatus = null; E.status = stageOf().status; $('#status').value = E.status;
    save();
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
    var stage = 'reading it';
    var stepped = function (t, pc) { stage = t.toLowerCase(); step(t, pc); };
    master(file, stepped).catch(function (err) { throw new Error('While ' + stage + ': ' + (err && err.message || err)); }).then(function (m) {
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
      chain = chain.then(function () { return api('audiopart', file.slice(i * CH, (i + 1) * CH), '&up=' + up + '&i=' + i + '&last=' + (i === n - 1 ? 1 : 0)); })
        .then(function (r) { res = r; var b = $('#audio .aup b'); if (b) b.textContent = Math.round((i + 1) / n * 100) + '%'; });
    })(i);
    chain.then(function () {
      audioNew = { sha: res.sha, name: name, bytes: file.size, url: URL.createObjectURL(file) }; audioGone = false;
      markDirty(); renderAudio(); toast('Audio attached. Save to keep it.');
    }).catch(function (err) { toast('While uploading: ' + err.message, true); renderAudio(); });
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
  function save(asked) {   // asked: Publish already listed what's missing and you said go ahead
    collect();
    if (!E.title) { toast('Give it a title first.', true); return; }
    if (E.status === 'published' && asked !== true) {
      if (E.track && E.track.homeWarning && !confirm('This track starts or ends at home. Publish it with the map anyway?')) return;
      if ((E.questions || []).length && !confirm('There are still open questions. Publish anyway?')) return;
    }
    var first = !E.id;
    if (first) {
      E.id = E.date + '-' + (slug(E.title) || E.kind);
      E.photos.forEach(function (p) { p.src = 'data/photos/' + E.id + '/' + photoName(p); if (p.poster) p.poster = 'data/photos/' + E.id + '/' + p.poster.split('/').pop(); });
    }
    var btn = $('#save'); btn.disabled = true; btn.textContent = 'Saving…';
    var names = Object.keys(fresh).concat(Object.keys(posterNew)), uploaded = [];
    var L = loader(E.status === 'published' ? 'Saving and publishing' : 'Saving', ['Upload the photos', 'Save the note', E.status === 'published' ? 'Publishing starts (live in about a minute)' : 'Saved']);
    if (!names.length) L.skip(0);
    var chain = Promise.resolve();
    names.forEach(function (n, i) {
      chain = chain.then(function () {
        btn.textContent = 'Uploading photo ' + (i + 1) + ' of ' + names.length + '…'; L.at(0, (i + 1) + ' of ' + names.length);
        return api('blob', (fresh[n] || posterNew[n]).blob).then(function (r) { uploaded.push({ name: n, sha: r.sha }); });
      });
    });
    chain.then(function () {
      btn.textContent = 'Saving…'; L.at(1);
      var hadAudio = E.episode.audio;
      if (audioNew) E.episode.audio = 'data/audio/' + E.id + '.mp3'; else if (audioGone) E.episode.audio = null;
      var clips = Object.keys(clipsNew).map(function (n) { return { name: n.replace(/\.mp4$/, ''), loop: clipsNew[n].token }; });
      if (clips.length) L.at(1, clips.length + ' video loop' + (clips.length > 1 ? 's' : ''));
      return api('save', { entry: E, newPhotos: uploaded, newClips: clips, removePhotos: removed, newAudio: audioNew ? audioNew.sha : '', removeAudio: audioGone && !!hadAudio })
        .catch(function (err) { E.episode.audio = hadAudio; throw err; });
    }).then(function () {
      var hadNew = !!audioNew;
      var hadClips = Object.keys(clipsNew).length + Object.keys(posterNew).length;
      if (Object.keys(posterNew).length) posterBust = '&v=' + Date.now().toString(36);
      fresh = {}; removed = []; clipsNew = {}; posterNew = {}; dirty = false; audioNew = null; audioGone = false; savedStatus = E.status;
      setTimeout(renderNext, 0); DRIVEAUD = null;
      if (hadNew && !first) renderAudio();
      if (hadClips && !first) renderPhotos();
      if (!owner()) REVIEW = { by: CFG.me.name, at: Math.floor(Date.now() / 1000), state: 'ready', live: savedStatus === 'published' }; else REVIEW = null;
      $('#saveState').textContent = !owner() ? 'Saved for review' : E.status === 'published' ? 'Saved and publishing: live in about a minute' : 'Saved';
      if (first) { route('note/' + E.id, true); render(); }
      toast(!owner() ? 'Saved. It waits for review; nothing on the site changes until it\'s approved.' : E.status === 'published' ? 'Saved. The site updates in about a minute.' : 'Saved.');
      L.at(2); L.done();
    }).catch(function (err) {
      L.fail(err.message);
      if (first) { E.id = ''; }
      toast('Not saved: ' + err.message, true);
    }).then(function () { var b = $('#save'); if (b) { b.disabled = false; b.textContent = owner() ? 'Save' : 'Save for review'; } publishing = false; renderNext(); });
  }

  // ---------- start ----------
  api('config').then(function (c) {
    CFG = c; listen();
    var m = /[?&]e=([^&]+)/.exec(location.search);            // older ?e=<id> links still open their note
    if (m) edit(decodeURIComponent(m[1]));
    else open(window.StudioHash ? StudioHash.view() : '');
  }).catch(function (err) { app.innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
})();
