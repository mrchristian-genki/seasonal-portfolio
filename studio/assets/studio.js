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
  // the copy of the note this page holds: its version (the blob shas of the live and review copies, from api.php) goes
  // back with every save, which is refused if the repo's copy has changed since; the copy itself, to see what was edited
  var BASE = { version: { live: null, review: null }, entry: null };
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
  var UPVID = [];                           // videos dropped into this note: { name, bytes, up } (on the server two weeks)

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function toast(msg, bad) { var t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(t._h); t._h = setTimeout(function () { t.className = ''; }, bad ? 7000 : 3500); }
  // Read as text, not r.json(): a reply that isn't clean JSON (a PHP warning printed before it, or a host's
  // error page) then still works, or at least says what came back (Safari's own message for a bad reply is
  // only "The string did not match the expected pattern").
  // A Blob goes up as a file in a form post (multipart), not a raw request body: the host's firewall blocks any
  // raw binary body (a 418), and takes base64 in JSON for an attack now and then, but lets file uploads through.
  // It also goes up scrambled with a random key (X-Mask; api.php unscrambles it), so no run of its bytes looks
  // like an attack, and a blocked one is sent again with a new key.
  function masked(blob) {
    return blob.arrayBuffer().then(function (buf) {
      var k = crypto.getRandomValues(new Uint8Array(32)), a = new Uint8Array(buf);
      for (var i = 0; i < a.length; i++) a[i] ^= k[i & 31];
      return { body: a, key: Array.from(k, function (b) { return b.toString(16).padStart(2, '0'); }).join('') };
    });
  }
  // CANCEL UPLOAD: whatever is going up (or saving) for more than a few seconds brings in a Cancel button at the foot of
  // the screen; it stops every request still on its way, and each box shows "Cancelled." and can be tried again. A save
  // the server had already taken in may still go through: reloading shows what's there.
  var UPS = [];
  function upGuard(ac) {
    UPS.push(ac);
    var t = setTimeout(upShow, 4000);
    return function () { clearTimeout(t); UPS = UPS.filter(function (x) { return x !== ac; }); upShow(); };
  }
  function upShow() {
    var b = document.getElementById('upCancel');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'upCancel'; b.textContent = 'Cancel upload'; document.body.appendChild(b);
      b.onclick = function () { var n = UPS.length; UPS.slice().forEach(function (x) { x.why = 'cancel'; x.abort(); }); UPS = []; upShow(); if (n) toast('Cancelled. Anything the server had already taken in may still save; reload to see what\'s there.'); }; }
    b.classList.toggle('on', UPS.length > 0);
  }
  function api(a, body, q, tries) {
    // every body goes up scrambled as a form file: an upload as it is, the JSON of everything else marked X-Body, so the
    // web host's firewall never reads a Note's words (a prompt or a caption can look like an attack to it: a 418)
    var raw = body instanceof Blob, json = !!body && !raw;
    var ready = body ? masked(raw ? body : new Blob([JSON.stringify(body)])) : Promise.resolve(null);
    return ready.then(function (m) {
      var h = { 'X-CSRF': CSRF }, payload;
      if (m) { h['X-Mask'] = m.key; if (json) h['X-Body'] = 'json'; payload = new FormData(); payload.append('f', new Blob([m.body], { type: 'application/octet-stream' }), 'part.bin'); }
      var opt = body ? { method: 'POST', headers: h, body: payload } : {};
      // an upload the server never answers shouldn't leave a button on "Uploading…" for ever, and one taking a while can
      // be cancelled (the Cancel button, upGuard; Christian, Oct 14)
      var ac = body && window.AbortController ? new AbortController() : null, done;
      if (ac) { opt.signal = ac.signal; setTimeout(function () { if (!ac.signal.aborted) { ac.why = 'slow'; ac.abort(); } }, 120000); done = upGuard(ac); }
      return fetch('api.php?a=' + a + (q || ''), opt).then(function (r) { if (done) done(); return r; }, function (e) {
        if (done) done();
        if (e && e.name === 'AbortError') throw new Error(ac.why === 'slow' ? 'The server didn\'t answer the ' + a + ' request within two minutes. Check your connection and try again.' : 'Cancelled.');
        throw new Error('The ' + a + ' request didn\'t reach the server (' + (e && e.message || 'network error') + '). Check your connection and try again.');
      });
    }).then(function (r) {
      if (r.status === 401) { location.reload(); throw new Error('Logged out'); }
      if (r.status === 418 && body && (tries || 0) < 4) return api(a, body, q, (tries || 0) + 1);   // blocked: again, with a new key
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) {
          var k = t.search(/[{\[]/);   // JSON after something printed before it
          try { if (k >= 0) { j = JSON.parse(t.slice(k)); if (window.console) console.warn('Studio: the server printed this before its reply:', t.slice(0, k)); } } catch (e2) { j = null; }
        }
        if (j === null && r.status === 418) throw new Error('The web host\'s firewall blocked the ' + a + ' request (418), five times running. Reload the Studio and try again; if it keeps happening, tell me.');
        if (j === null) {
          var said = t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
          throw new Error('The server\'s reply to ' + a + ' wasn\'t readable (' + r.status + (said ? ': ' + said : ', empty') + ')');
        }
        if (!r.ok) { var er = new Error(j.error || ('Error ' + r.status)); er.status = r.status; er.data = j; throw er; }
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

  // Styles for HTML built here, set from script: the Studio's Content-Security-Policy (style-src 'self',
  // lib/bootstrap.php) drops style="" attributes written into the page, but not styles set by script. So HTML carries
  // them as data: data-h / data-w (a bar's height or length, the --h / --w its CSS uses), data-b (a gridline's place),
  // data-bg / data-fg (a colour), data-x / data-y (a marker's place); call this once it's on the page.
  function dataStyles(root) {
    var pct = function (v) { return (+v || 0) + '%'; };
    $$('[data-h],[data-w],[data-b],[data-bg],[data-fg],[data-x]', root).forEach(function (e) {
      var g = function (k) { return e.getAttribute('data-' + k); };
      if (g('h') != null) e.style.setProperty('--h', pct(g('h')));
      if (g('w') != null) e.style.setProperty('--w', pct(g('w')));
      if (g('b') != null) e.style.bottom = pct(g('b'));
      if (g('bg') != null) e.style.background = g('bg');
      if (g('fg') != null) e.style.color = g('fg');
      if (g('x') != null) { e.style.left = pct(g('x')); e.style.top = pct(g('y')); }
    });
  }

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
  // a shot's exposure compensation in EV (EXIF ExposureBiasValue), or null: a drone bracket's shots carry
  // their step (-2, 0, +2 or so), which labels the bracket strip
  function exifBias(file) {
    return file.slice(0, 131072).arrayBuffer().then(function (buf) {
      var v = new DataView(buf), o = 2;
      if (v.getUint16(0) !== 0xFFD8) return null;
      while (o < v.byteLength - 4) {
        var mk = v.getUint16(o), len = v.getUint16(o + 2);
        if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
          var t = o + 10, le = v.getUint16(t) === 0x4949;
          var u16 = function (p) { return v.getUint16(t + p, le); }, u32 = function (p) { return v.getUint32(t + p, le); };
          var find = function (ifd, tag) { var n = u16(ifd); for (var i = 0; i < n; i++) { var e = ifd + 2 + i * 12; if (u16(e) === tag) return e; } return 0; };
          var ex = find(u32(4), 0x8769); if (!ex) return null;
          var d = find(u32(ex + 8), 0x9204); if (!d) return null;
          var at = u32(d + 8), num = v.getInt32(t + at, le), den = v.getInt32(t + at + 4, le);
          return den ? num / den : null;
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
    if (v === 'drive' || ((v === 'categories' || v === 'characters' || v === 'people' || v === 'stats') && owner())) return showList(v);
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
  // the list's tabs: the Notes and Google Drive (everyone), their Categories (GlazyArray's looks), People and the
  // site's Stats (owner only). Drive has its own tab, since bringing in is now and then and the Notes are every day;
  // the Notes tab says in a line when Drive has something new (driveHint)
  function showList(tab) {
    tab = tab === 'drive' || ((tab === 'categories' || tab === 'characters' || tab === 'people' || tab === 'stats') && owner()) ? tab : 'notes';
    if (dirty && !confirm('Leave without saving?')) return;
    dirty = false; E = null; fresh = {}; removed = []; INBOX = null; audioNew = null; audioGone = false; DRIVEAUD = null; DRIVETRK = null; trackRaw = null; trackSwap = false; clipsNew = {}; posterNew = {}; DRIVEVID = null; UPVID = []; stopTrim();
    route(tab);
    var tabs = '<nav class="tabs" role="tablist">' + [['notes', 'Notes'], ['drive', 'Drive']].concat(owner() ? [['categories', 'Categories'], ['characters', 'Characters'], ['people', 'People'], ['stats', 'Stats']] : []).map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + t[1] + '</button>'; }).join('') + '</nav>';
    app.innerHTML = '<div class="head"><h1>Field Notes</h1>' + tabs + '<span class="me">' + esc(CFG.me ? CFG.me.name : '') + (owner() ? '' : ' · editor') + '</span>' +
      (tab === 'notes' ? '<button id="new" class="primary">New entry</button>' : '') + '</div>' +
      '<section id="queue" class="panel queue" hidden></section><section id="peopleBox" class="panel people"' + (tab === 'people' ? '' : ' hidden') + '></section><section id="catsBox" class="panel cats"' + (tab === 'categories' ? '' : ' hidden') + '></section>' +
      '<section id="statsBox" class="panel site-stats"' + (tab === 'stats' ? '' : ' hidden') + '></section>' +
      '<section id="charsBox" class="panel cats chars"' + (tab === 'characters' ? '' : ' hidden') + '></section>' +
      '<p id="driveHint" class="drive-hint" hidden></p>' +
      '<section id="drive" class="panel drive"' + (tab === 'drive' ? '' : ' hidden') + '><p class="muted">Checking Google Drive…</p></section><section id="wsOrder" class="panel wsorder" hidden></section><div id="list" class="cards"' + (tab === 'notes' ? '' : ' hidden') + '><p class="muted">Loading entries…</p></div>';
    if ($('#new')) $('#new').onclick = function () { edit(null); };
    $$('.tabs [data-tab]').forEach(function (b) { b.onclick = function () { showList(b.getAttribute('data-tab')); }; });
    if (tab === 'people') renderPeople();
    if (tab === 'stats') renderStats();
    driveStatus();
    api('list').then(function (j) {
      ENTRIES = j.entries;
      if (tab === 'stats' && SV.data) drawStats();   // the Notes' titles, now they're here
      if (lastDrive) renderDrive(lastDrive);
      if (tab === 'categories') renderCats();
      if (tab === 'characters') renderChars();
      if (tab !== 'notes') return;   // the other tabs only needed the list for their counts
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
      renderGrid(j.entries, st);
      if (owner()) renderWsOrder(j.entries);
    }).catch(function (err) { $('#list').innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
  }

  // Page buttons for a long list: Previous, the page numbers (first, last and either side of this one), Next.
  // pager(box, page, pages, go): fills box (empty when one page does it) and calls go(page) on a click.
  function pager(box, page, pages, go) {
    if (!box) return;
    if (pages < 2) { box.innerHTML = ''; box.hidden = true; return; }
    var nums = [], last = 0;
    for (var p = 1; p <= pages; p++) {
      if (p !== 1 && p !== pages && Math.abs(p - page) > 1) continue;
      if (p - last > 1) nums.push('<span class="pg-gap">…</span>');
      nums.push('<button type="button" data-pg="' + p + '"' + (p === page ? ' aria-current="page"' : '') + ' aria-label="Page ' + p + '">' + p + '</button>'); last = p;
    }
    box.hidden = false;
    box.innerHTML = '<button type="button" class="pg-step" data-pg="' + (page - 1) + '"' + (page > 1 ? '' : ' disabled') + '>← Previous</button><span class="pg-nums">' + nums.join('') +
      '</span><button type="button" class="pg-step" data-pg="' + (page + 1) + '"' + (page < pages ? '' : ' disabled') + '>Next →</button>';
    $$('button[data-pg]', box).forEach(function (b) { b.onclick = function () { go(+b.getAttribute('data-pg')); }; });
  }
  // back up to a list's top when a new page leaves it out of sight, with the site's eased scroll
  function toTop(el) { if (el && el.getBoundingClientRect().top < 0) { if (window.easeScroll) easeScroll.to(el); else el.scrollIntoView({ block: 'start' }); } }

  // ---------- the Workshop tab's order (owner): its projects first to last, moved up or down, saved together ----------
  function renderWsOrder(all) {
    var box = $('#wsOrder'); if (!box) return;
    var ws = all.filter(function (e) { return e.ws; }).sort(function (a, b) { return (a.ws.order || 999) - (b.ws.order || 999) || (a.id < b.id ? -1 : 1); });
    if (ws.length < 2) { box.hidden = true; return; }
    var ids = ws.map(function (e) { return e.id; }), was = ids.join(), byId = {}, moved = null;
    ws.forEach(function (e) { byId[e.id] = e; });
    var open = box.querySelector('details') ? box.querySelector('details').open : false;
    box.hidden = false;
    function draw() {
      var changed = ids.join() !== was;
      box.innerHTML = '<details' + (open ? ' open' : '') + '><summary><h2>Workshop order</h2> <small class="muted">' + ws.length + ' projects · the order of the cards on the Workshop tab</small></summary>' +
        '<ol class="wso">' + ids.map(function (id, i) {
          var e = byId[id];
          return '<li data-id="' + esc(id) + '"><span class="wso-n">' + (i + 1) + '</span><span class="wso-t"><b>' + esc(e.ws.name || e.title || id) + '</b><small>' + esc(e.date) + (e.status !== 'published' ? ' · not published yet, so not on the tab' : '') + '</small></span>' +
            '<button type="button" class="small" data-mv="-1"' + (i ? '' : ' disabled') + ' aria-label="Move ' + esc(e.ws.name || e.title) + ' up">↑</button><button type="button" class="small" data-mv="1"' + (i < ids.length - 1 ? '' : ' disabled') + ' aria-label="Move ' + esc(e.ws.name || e.title) + ' down">↓</button>' +
            '<button type="button" class="small" data-top' + (i ? '' : ' disabled') + '>To the top</button></li>';
        }).join('') + '</ol><div class="row"><button type="button" class="primary" id="wsoSave"' + (changed ? '' : ' disabled') + '>Save the order</button>' +
        (changed ? '<button type="button" class="link" id="wsoUndo">Undo</button>' : '') + '<small class="muted">The site updates on the next deploy.</small></div></details>';
      box.querySelector('details').ontoggle = function () { open = this.open; };
      $$('.wso li', box).forEach(function (li) {
        var id = li.getAttribute('data-id'), at = ids.indexOf(id);
        var go = function (to) { ids.splice(at, 1); ids.splice(to, 0, id); moved = id; draw(); };
        $$('[data-mv]', li).forEach(function (b) { b.onclick = function () { go(at + +b.getAttribute('data-mv')); }; });
        li.querySelector('[data-top]').onclick = function () { go(0); };
      });
      // the one just moved glows, easing in and then away
      var mv = moved && box.querySelector('.wso li[data-id="' + moved + '"]');
      if (mv) { requestAnimationFrame(function () { requestAnimationFrame(function () { mv.classList.add('moved'); }); }); setTimeout(function () { mv.classList.remove('moved'); }, 1400); }
      var u = $('#wsoUndo'); if (u) u.onclick = function () { ids = was.split(','); moved = null; draw(); };
      $('#wsoSave').onclick = function () {
        var b = this; b.disabled = true; b.textContent = 'Saving…';
        api('wsorder', { ids: ids }).then(function () {
          ids.forEach(function (id, i) { byId[id].ws.order = i + 1; }); was = ids.join(); moved = null; draw();
          toast('Workshop order saved. The site updates on the next deploy.');
        }).catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Save the order'; });
      };
    }
    draw();
  }

  // ---------- the notes, as a grid of covers (or a compact list), with search, filters and sorting ----------
  // every kind a Note can be (field/data/kinds.json, through api.php config): the outings, the Mini-Cast and one for
  // each magazine category, with its name, category word and whether it has a track
  var KINDS0 = [{ id: 'ride', name: 'Ride', tag: 'ride', track: true }, { id: 'hike', name: 'Hike', tag: 'hike', track: true },
    { id: 'forage', name: 'Foraging walk', tag: 'foraging' }, { id: 'make', name: 'Mini-Cast', tag: 'mini-cast' }];   // if the config has none
  function allKinds() { return (CFG && CFG.kinds && CFG.kinds.length) ? CFG.kinds : KINDS0; }
  function kindOf(id) { return allKinds().filter(function (k) { return k.id === id; })[0] || null; }
  function kindName(id) { var k = kindOf(id); return k ? k.name : id; }
  function kindTag(id) { var k = kindOf(id); return k ? k.tag : id; }
  function hasTrack(id) { var k = kindOf(id); return !!(k && k.track); }
  var LV = (function () { try { return JSON.parse(localStorage.getItem('studio-list') || '{}'); } catch (e) { return {}; } })();
  function saveLV() { try { localStorage.setItem('studio-list', JSON.stringify(LV)); } catch (e) { /* private window */ } }
  function renderGrid(all, st) {
    var list = $('#list'); if (!list) return;
    if (!all.length) { list.className = 'cards'; list.innerHTML = '<p class="muted">No entries yet.</p>'; return; }
    var kinds = all.map(function (e) { return e.kind; }).filter(function (k, i, a) { return k && a.indexOf(k) === i; }).sort();
    var years = all.map(function (e) { return (e.date || '').slice(0, 4); }).filter(function (y, i, a) { return y && a.indexOf(y) === i; }).sort().reverse();
    var opt = function (v, t, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(t) + '</option>'; };
    var tools = document.createElement('div'); tools.className = 'ltools';
    tools.innerHTML = '<input id="lq" type="search" placeholder="Search titles, places, summaries" value="' + esc(LV.q || '') + '" aria-label="Search notes">' +
      '<select id="lstat" aria-label="Status">' + opt('', 'Any status', LV.stat) + opt('published', 'Published', LV.stat) + opt('working', 'Not published yet', LV.stat) + opt('review', 'In review', LV.stat) + opt('noaudio', 'Needs audio', LV.stat) + '</select>' +
      '<select id="lkind" aria-label="Kind">' + opt('', 'Every kind', LV.kind) + kinds.map(function (k) { return opt(k, kindName(k), LV.kind); }).join('') + '</select>' +
      '<select id="lyear" aria-label="Year">' + opt('', 'Every year', LV.year) + years.map(function (y) { return opt(y, y, LV.year); }).join('') + '</select>' +
      '<select id="lsort" aria-label="Sort">' + opt('new', 'Newest first', LV.sort) + opt('old', 'Oldest first', LV.sort) + opt('title', 'Title A to Z', LV.sort) + opt('status', 'By status', LV.sort) + opt('media', 'Most photos and loops', LV.sort) + '</select>' +
      '<span class="lview" role="group" aria-label="View"><button type="button" data-v="grid" aria-pressed="' + (LV.view !== 'list') + '">Grid</button><button type="button" data-v="list" aria-pressed="' + (LV.view === 'list') + '">List</button></span>' +
      '<small id="lcount"></small>';
    list.parentNode.insertBefore(tools, list);
    var pg = document.createElement('nav'); pg.className = 'pager'; pg.setAttribute('aria-label', 'Pages of notes'); pg.hidden = true;
    list.parentNode.insertBefore(pg, list.nextSibling);
    var order = { notes: 0, draft: 1, script: 2, audio: 3, published: 4 }, page = 1, PER = 12;
    var draw = function (keepPage) {
      if (!keepPage) page = 1;
      var q = (LV.q || '').trim().toLowerCase();
      var rows = all.filter(function (e) {
        if (q && (e.title + ' ' + e.place + ' ' + e.summary + ' ' + e.id).toLowerCase().indexOf(q) < 0) return false;
        if (LV.stat === 'published' && e.status !== 'published') return false;
        if (LV.stat === 'working' && e.status === 'published') return false;
        if (LV.stat === 'review' && !e.review) return false;
        if (LV.stat === 'noaudio' && e.audio) return false;
        if (LV.kind && e.kind !== LV.kind) return false;
        if (LV.year && (e.date || '').slice(0, 4) !== LV.year) return false;
        return true;
      });
      var by = LV.sort || 'new';
      rows.sort(function (a, b) {
        if (by === 'old') return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
        if (by === 'title') return (a.title || a.id).localeCompare(b.title || b.id);
        if (by === 'status') return (order[a.status] || 0) - (order[b.status] || 0) || (a.date < b.date ? 1 : -1);
        if (by === 'media') return (b.photos + b.loops) - (a.photos + a.loops);
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });
      list.className = 'cards' + (LV.view === 'list' ? '' : ' grid');
      var pages = Math.max(1, Math.ceil(rows.length / PER)); page = Math.min(page, pages);
      var from = (page - 1) * PER, total = rows.length;
      $('#lcount').textContent = (total > PER ? (from + 1) + '–' + Math.min(total, from + PER) + ' of ' : '') + (total === all.length ? all.length + ' notes' : total + (total > PER ? '' : ' of ' + all.length) + ' notes' + (total > PER ? ' (' + all.length + ' in all)' : ''));
      rows = rows.slice(from, from + PER);
      pager(pg, page, pages, function (p) { page = p; draw(true); toTop(tools); });
      list.innerHTML = rows.length ? rows.map(function (e) {
        var img = LV.view !== 'list' ? '<span class="cv">' + (e.cover ? '<img loading="lazy" alt="" src="api.php?a=photo&id=' + encodeURIComponent(e.id) + '&n=' + encodeURIComponent(e.cover) + '">' : '<i>' + esc(kindName(e.kind) || 'Note') + '</i>') + '</span>' : '';
        var media = [e.photos ? e.photos + ' photo' + (e.photos === 1 ? '' : 's') : '', e.loops ? e.loops + ' loop' + (e.loops === 1 ? '' : 's') : '', e.audio ? 'audio' : ''].filter(Boolean).join(' · ');
        return '<button class="card" data-id="' + esc(e.id) + '">' + img + '<span class="cb"><span class="tags"><span class="st st-' + esc(e.status) + '">' + esc(st[e.status] || e.status) + '</span>' + (e.review ? '<span class="st st-review">' + (e.review.state === 'returned' ? 'Sent back' : 'In review') + '</span>' : '') + '</span>' +
          '<b>' + esc(e.title || e.id) + '</b><small>' + esc(e.date) + ' · ' + esc(kindName(e.kind)) + (e.place ? ' · ' + esc(e.place) : '') + '</small>' +
          (media ? '<small class="md">' + esc(media) + '</small>' : '') + '<span class="sum">' + esc(e.summary) + '</span></span></button>';
      }).join('') : '<p class="muted">No notes match. <button type="button" class="link" id="lclear">Clear the filters</button></p>';
      $$('.card', list).forEach(function (b) { b.onclick = function () { edit(b.getAttribute('data-id')); }; });
      var c = $('#lclear'); if (c) c.onclick = function () { LV.q = LV.stat = LV.kind = LV.year = ''; saveLV(); $('#lq').value = ''; ['lstat', 'lkind', 'lyear'].forEach(function (i) { $('#' + i).value = ''; }); draw(); };
    };
    $('#lq').oninput = function () { LV.q = this.value; saveLV(); draw(); };
    [['lstat', 'stat'], ['lkind', 'kind'], ['lyear', 'year'], ['lsort', 'sort']].forEach(function (x) { $('#' + x[0]).onchange = function () { LV[x[1]] = this.value; saveLV(); draw(); }; });
    $$('.lview button', tools).forEach(function (b) { b.onclick = function () { LV.view = b.getAttribute('data-v'); saveLV(); $$('.lview button', tools).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); draw(true); }; });
    draw();
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

  // ---------- Stats (owner only): the site's visits, from the server's own access logs (api.php stats, lib/stats.php).
  // No analytics on the pages: each day is summed up on the server from its log, bots, the Studio and page files left
  // out, and kept, so the history outlives the logs. Pick a span; every chart and list sums the days in it. ----------
  var SV = (function () { try { return JSON.parse(localStorage.getItem('studio-stats') || '{}'); } catch (e) { return {}; } })();
  SV.span = [7, 30, 90, 365].indexOf(SV.span) >= 0 ? SV.span : 30; SV.page = 1; SV.data = null;
  function saveSV() { try { localStorage.setItem('studio-stats', JSON.stringify({ span: SV.span })); } catch (e) { /* private window */ } }
  function renderStats() {
    var box = $('#statsBox'); if (!box) return;
    if (!SV.data) box.innerHTML = '<h2>Site stats</h2><p class="muted">Reading the server\'s logs…</p>';
    else box.classList.add('stx-busy');
    api('stats', null, '&days=' + SV.span).then(function (j) { SV.data = j; SV.page = 1; drawStats(); })
      .catch(function (err) { box.classList.remove('stx-busy'); box.innerHTML = '<h2>Site stats</h2><p class="err">' + esc(err.message) + '</p>'; });
  }
  function drawStats() {
    var box = $('#statsBox'), j = SV.data; if (!box || !j) return;
    box.classList.remove('stx-busy');
    var days = j.days || [], N = function (n) { return (n || 0).toLocaleString(); };
    var title = {}; (ENTRIES || []).forEach(function (e) { title[e.id] = e.title || e.id; });
    var noteName = function (id) { return title[id] || id; };
    var sum = function (k) { return days.reduce(function (a, d) { return a + (d[k] || 0); }, 0); };
    var add = function (into, obj, f) { Object.keys(obj || {}).forEach(function (k) { into[k] = (into[k] || 0) + (f ? f(obj[k]) : obj[k]); }); return into; };
    var areas = {}, areaV = {}, notes = {}, listens = {}, refs = {};
    days.forEach(function (d) {
      add(areas, d.areas, function (a) { return a.views; }); add(areaV, d.areas, function (a) { return a.visits; });
      add(notes, d.notes); add(listens, d.listens); add(refs, d.refs);
    });
    var listenN = Object.keys(listens).reduce(function (a, k) { return a + listens[k]; }, 0);
    var spans = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, 'A year']].map(function (s) {
      return '<button type="button" data-span="' + s[0] + '" aria-pressed="' + (SV.span === s[0]) + '">' + s[1] + '</button>'; }).join('');
    var tile = function (n, label, hint) { return '<div class="stx-tile"><b>' + N(n) + '</b><span>' + label + '</span>' + (hint ? '<small>' + hint + '</small>' : '') + '</div>'; };
    var html = '<div class="stx-head"><div><h2>Site stats</h2><p class="muted">From the server\'s own logs: no cookies or scripts on the pages. Bots, the Studio and the files a page pulls in are left out.</p></div>' +
      '<div class="stx-span" role="group" aria-label="Span">' + spans + '</div></div>';
    html += healthHtml(j);
    if (!j.source || !j.source.found) {
      html += srcNote(j, true);
      box.innerHTML = html; spanClicks(box); healthClicks(box); return;
    }
    html += '<div class="stx-tiles">' + tile(sum('visits'), 'Visits', 'a person on a given day') + tile(sum('views'), 'Page views') +
      tile(listenN, 'Episode listens', 'people who pressed play') + tile(sum('feed'), 'Podcast feed checks', 'apps looking for new episodes') + '</div>';
    html += '<h3>Visits per day</h3>' + dayChart(days, j.today);
    html += '<div class="stx-two"><div><h3>Areas</h3>' + hbars(Object.keys(areas).map(function (a) { return [a, areas[a], N(areaV[a]) + ' visit' + (areaV[a] === 1 ? '' : 's')]; }), 'views') +
      '</div><div><h3>Where visitors came from</h3>' + (Object.keys(refs).length ? hbars(Object.keys(refs).map(function (r) { return [r, refs[r]]; }).slice(0), 'views', 10) :
      '<p class="muted">No visits from other sites in this span. Visits typed in, from bookmarks or from inside the site don\'t name a site.</p>') + '</div></div>';
    var ids = Object.keys(notes).concat(Object.keys(listens).filter(function (k) { return !(k in notes); }));
    ids.sort(function (a, b) { return (notes[b] || 0) - (notes[a] || 0) || (listens[b] || 0) - (listens[a] || 0); });
    var top = Math.max.apply(null, ids.map(function (k) { return notes[k] || 0; }).concat([1]));
    html += '<h3>Field Notes</h3>' + (ids.length ? '<div class="stx-tw"><table class="stx-t"><thead><tr><th>Note</th><th class="n">Opened</th><th class="n">Listens</th></tr></thead><tbody>' + ids.slice(0, 25).map(function (k) {
      return '<tr><td><button type="button" class="link" data-note="' + esc(k) + '">' + esc(noteName(k)) + '</button><i class="stx-mini" data-w="' + ((notes[k] || 0) / top * 100).toFixed(1) + '"></i></td><td class="n">' + N(notes[k]) + '</td><td class="n">' + N(listens[k]) + '</td></tr>';
    }).join('') + '</tbody></table></div>' + (ids.length > 25 ? '<p class="muted stx-more">And ' + (ids.length - 25) + ' more.</p>' : '') : '<p class="muted">No Notes opened in this span.</p>');
    html += troubleHtml(days, j.logins || {});
    html += '<h3>Visitor log</h3><p class="muted">The last week\'s page views, newest first. A visitor\'s tag is new every day, so one visit\'s pages read together but no one can be followed from day to day; no addresses are kept.</p><div id="stxLog"></div><div class="pager" id="stxPg" hidden></div>';
    html += srcNote(j, false);
    box.innerHTML = html;
    dataStyles(box);
    spanClicks(box); healthClicks(box);
    $$('[data-note]', box).forEach(function (b) { b.onclick = function () { edit(b.getAttribute('data-note')); }; });
    chartHover(box);
    drawLog(days, noteName);
    // the bars grow in, eased (css .stx-in), once they're on the page
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('stx-in'); }); });
  }
  // Site health (lib/health.php): a check each for the domain, the certificate, the redirect to HTTPS, HSTS, email
  // protection and disk space; good, check or fix, each with an icon and a word as well as its colour, and what to do
  function healthHtml(j) {
    var h = j.health || {}, cs = h.checks || [];
    if (!cs.length) return h.error ? '<p class="err">Site health: ' + esc(h.error) + '</p>' : '';
    var word = { good: 'OK', warn: 'Check', bad: 'Fix' }, icon = { good: '✓', warn: '!', bad: '✕' };
    var worst = cs.some(function (c) { return c.state === 'bad'; }) ? 'bad' : cs.some(function (c) { return c.state === 'warn'; }) ? 'warn' : 'good';
    return '<div class="stx-health"><div class="stx-hh"><h3>Site health</h3><span class="stx-hsum" data-state="' + worst + '">' +
      (worst === 'good' ? 'All good' : cs.filter(function (c) { return c.state !== 'good'; }).length + ' to look at') + '</span>' +
      '<small class="muted">Checked ' + esc(when(h.at)) + '</small><button type="button" class="small" id="stxHealthGo">Check again</button></div>' +
      '<ul class="stx-hc">' + cs.map(function (c) {
        var st = word[c.state] ? c.state : 'warn';
        return '<li data-state="' + st + '"><span class="stx-hi" aria-hidden="true">' + icon[st] + '</span><div><b>' + esc(c.label) + ' <em>' + word[st] + '</em></b>' +
          '<span>' + esc(c.say || '') + '</span>' + (c.todo ? '<span class="stx-todo">' + esc(c.todo) + '</span>' : '') + '</div></li>';
      }).join('') + '</ul></div>';
  }
  function healthClicks(box) {
    var b = $('#stxHealthGo', box); if (!b) return;
    b.onclick = function () {
      b.disabled = true; b.textContent = 'Checking…';
      api('stats', null, '&days=' + SV.span + '&fresh=1').then(function (j) { SV.data = j; drawStats(); toast('Site health checked.'); })
        .catch(function (err) { b.disabled = false; b.textContent = 'Check again'; toast(err.message, true); });
    };
  }
  // trouble in the logs over the span: missing pages people asked for, the server's own errors, probes and failed logins
  function troubleHtml(days, logins) {
    var missing = {}, errors = {}, probes = 0, add = function (into, obj) { Object.keys(obj || {}).forEach(function (k) { into[k] = (into[k] || 0) + obj[k]; }); };
    days.forEach(function (d) { add(missing, d.missing); add(errors, d.errors); probes += d.probes || 0; });
    var errN = Object.keys(errors).reduce(function (a, k) { return a + errors[k]; }, 0);
    var fails = 0, locks = 0; Object.keys(logins).forEach(function (k) { fails += logins[k].fails || 0; locks += logins[k].lockouts || 0; });
    var top = function (o, n) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, n); };
    var line = function (n, label, hint) { return '<li><b>' + n.toLocaleString() + '</b><span>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span></li>'; };
    return '<h3>Problems in the logs</h3><div class="stx-two"><div><h4 class="stx-h4">Missing pages people asked for</h4>' +
      (Object.keys(missing).length ? hbars(top(missing, 10).map(function (k) { return [k, missing[k]]; }), 'requests', 10) + '<p class="muted stx-more">An old link to one of these may be worth a redirect.</p>' :
        '<p class="muted">None in this span.</p>') + '</div><div><ul class="stx-tl">' +
      line(errN, 'server errors', errN ? top(errors, 3).map(esc).join(', ') : 'none: nothing broke') +
      line(probes, 'probes', 'bots trying weak spots of other kinds of site (WordPress, .env files); normal noise, a sudden rush is worth knowing') +
      line(fails, 'failed Studio logins', locks ? locks + ' locked an address out for 15 minutes' : 'none locked an address out') + '</ul></div></div>';
  }
  function spanClicks(box) {
    $$('[data-span]', box).forEach(function (b) { b.onclick = function () { var n = +b.getAttribute('data-span'); if (n === SV.span) return; SV.span = n; saveSV(); box.classList.remove('stx-in'); $$('[data-span]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); renderStats(); }; });
  }
  // a round top for an axis: 1, 2 or 5 times a power of ten, at least n
  function niceTop(n) { if (n <= 4) return 4; var p = Math.pow(10, Math.floor(Math.log10(n))); return [1, 2, 5, 10].map(function (m) { return m * p; }).filter(function (v) { return v >= n; })[0]; }
  // visits per day, a column a day (every day in the span, the quiet ones too), with a hover note and a table view
  function dayChart(days, today) {
    var by = {}; days.forEach(function (d) { by[d.date] = d; });
    var list = [], t = new Date((today || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
    for (var i = SV.span - 1; i >= 0; i--) { var d = new Date(t); d.setDate(t.getDate() - i); var k = d.toISOString().slice(0, 10); list.push(by[k] || { date: k, visits: 0, views: 0 }); }
    var top = niceTop(Math.max.apply(null, list.map(function (d) { return d.visits || 0; }).concat([0])));
    var fmt = function (k, long) { return new Date(k + 'T12:00:00').toLocaleDateString(undefined, long ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }); };
    var grid = [top, top / 2, 0].map(function (v) { return '<div class="stx-gl" data-b="' + (v / top * 100) + '"><span>' + Math.round(v).toLocaleString() + '</span></div>'; }).join('');
    var cols = list.map(function (d) {
      return '<div class="stx-col" data-tip="' + esc(fmt(d.date, true) + '|' + (d.visits || 0) + '|' + (d.views || 0)) + '"><i data-h="' + ((d.visits || 0) / top * 100).toFixed(2) + '"></i></div>'; }).join('');
    var ticks = [0, Math.floor((list.length - 1) / 2), list.length - 1].map(function (i, n) { return '<span class="t' + n + '">' + fmt(list[i].date) + '</span>'; }).join('');
    var rows = list.slice().reverse().map(function (d) { return '<tr><td>' + fmt(d.date, true) + '</td><td class="n">' + (d.visits || 0).toLocaleString() + '</td><td class="n">' + (d.views || 0).toLocaleString() + '</td></tr>'; }).join('');
    return '<div class="stx-chart" role="img" aria-label="Visits per day, the last ' + SV.span + ' days"><div class="stx-plot">' + grid + '<div class="stx-cols' + (SV.span > 60 ? ' dense' : '') + '">' + cols + '</div></div>' +
      '<div class="stx-x">' + ticks + '</div><div class="stx-tip" aria-hidden="true"></div></div>' +
      '<details class="stx-table"><summary>As a table</summary><div class="stx-tw"><table class="stx-t"><thead><tr><th>Day</th><th class="n">Visits</th><th class="n">Page views</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>';
  }
  function chartHover(box) {
    var ch = $('.stx-chart', box); if (!ch) return;
    var tip = $('.stx-tip', ch);
    $$('.stx-col', ch).forEach(function (c) {
      c.onmouseenter = function () {
        var p = c.getAttribute('data-tip').split('|'), r = c.getBoundingClientRect(), b = ch.getBoundingClientRect();
        tip.innerHTML = '<b>' + esc(p[0]) + '</b><span>' + Number(p[1]).toLocaleString() + ' visit' + (p[1] === '1' ? '' : 's') + '</span><span>' + Number(p[2]).toLocaleString() + ' page view' + (p[2] === '1' ? '' : 's') + '</span>';
        tip.style.left = Math.min(Math.max(r.left - b.left + r.width / 2, 70), b.width - 70) + 'px';
        tip.classList.add('on'); c.classList.add('hot');
      };
      c.onmouseleave = function () { tip.classList.remove('on'); c.classList.remove('hot'); };
    });
  }
  // horizontal bars, biggest first: [label, value, note], the value at the bar's end
  function hbars(items, unit, max) {
    items = items.filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, max || 12);
    if (!items.length) return '<p class="muted">Nothing yet.</p>';
    var top = items[0][1];
    return '<ul class="stx-bars">' + items.map(function (x) {
      return '<li title="' + esc(x[0] + ': ' + x[1].toLocaleString() + ' ' + unit) + '"><span class="l">' + esc(x[0]) + '</span><span class="b"><i data-w="' + (x[1] / top * 100).toFixed(1) + '"></i></span>' +
        '<span class="v">' + x[1].toLocaleString() + (x[2] ? '<small>' + esc(x[2]) + '</small>' : '') + '</span></li>'; }).join('') + '</ul>';
  }
  // the visitor log: the last week's page views (newest first), a page of 25 at a time
  function drawLog(days, noteName) {
    var rows = [];
    days.forEach(function (d) { (d.log || []).forEach(function (r) { rows.push([d.date].concat(r)); }); });
    rows.sort(function (a, b) { return a[0] + a[1] < b[0] + b[1] ? 1 : a[0] + a[1] > b[0] + b[1] ? -1 : 0; });   // newest first
    var box = $('#stxLog'); if (!box) return;
    if (!rows.length) { box.innerHTML = '<p class="muted">No page views in the last week.</p>'; return; }
    var per = 25, pages = Math.ceil(rows.length / per); SV.page = Math.min(SV.page, pages);
    var page = function (p) {
      var label = function (path) { var m = /^\/play\/(\d{4}-\d{2}-\d{2}-[a-z0-9-]+)\/$/.exec(path); return m ? noteName(m[1]) : path === '/' ? 'Home' : path === '/?workshop' ? 'Home · Workshop' : path; };
      box.innerHTML = '<div class="stx-tw"><table class="stx-t stx-log"><thead><tr><th>When</th><th>Page</th><th>From</th><th>Browser</th><th>Visitor</th></tr></thead><tbody>' + rows.slice((p - 1) * per, p * per).map(function (r) {
        return '<tr><td>' + esc(new Date(r[0] + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + r[1]) + '</td><td>' + esc(label(r[2])) + '</td><td>' + esc(r[3] || '—') + '</td><td>' + esc(r[4]) + '</td><td><code>' + esc(r[5]) + '</code></td></tr>';
      }).join('') + '</tbody></table></div>';
      pager($('#stxPg'), p, pages, function (n) { SV.page = n; page(n); toTop($('#stxLog')); });
    };
    page(SV.page);
  }
  // where the numbers come from: the log files the Studio reads, or, if it finds none, where it looked
  function srcNote(j, missing) {
    var s = j.source || {}, files = s.files || [];
    var mb = function (b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; };
    if (missing) return '<div class="stx-src warn"><b>The Studio can\'t see the server\'s logs yet.</b><p>It looked for ' + (s.looked || []).map(function (g) { return '<code>' + esc(g) + '</code>'; }).join(' and ') + '.' +
      (s.logsDir ? ' The logs folder holds: ' + (s.logsDir.length ? s.logsDir.map(function (d) { return '<code>' + esc(d) + '</code>'; }).join(', ') : 'nothing') + '.' : ' There\'s no <code>~/logs</code> folder.') + '</p>' +
      '<p>In the DreamHost panel, check that this site\'s logs are kept (Websites, Manage, the site\'s settings). If they\'re somewhere else, add <code>\'stats_logs\' => \'/home/…/access.log*\'</code> to <code>~/studio-private/config.php</code>.</p>' + (j.error ? '<p class="err">' + esc(j.error) + '</p>' : '') + '</div>';
    var days = (j.days || []).map(function (d) { return d.date; });
    return '<details class="stx-src"><summary>Where these numbers come from</summary><p>' + files.length + ' log file' + (files.length === 1 ? '' : 's') + ' on the server, summed up into a file a day in <code>~/studio-private/stats</code> (kept after the logs rotate away)' +
      (days.length ? '; this span has days from ' + esc(days[0]) + ' to ' + esc(days[days.length - 1]) : '') + '.</p><ul>' + files.map(function (f) { return '<li><code>' + esc(f.name) + '</code> · ' + mb(f.bytes) + ' · ' + esc(when(f.changed)) + '</li>'; }).join('') + '</ul>' +
      (j.error ? '<p class="err">' + esc(j.error) + '</p>' : '') + '</details>';
  }

  // ---------- Categories (owner only): every category the Notes use (Play's filter tags: their kind and their own tags),
  // new ones as soon as a Note has them, and the look each one gives GlazyArray (looks.json "categories"). Most have
  // none. A Note's own look beats its category's, which beats the holiday look. Her looks are here too, with a way to
  // add one from a render. ----------
  var CATP = {}, CATBP = {}, CATRP = {}, CATNP = {}, CATTP = {}, DEFP = {}, HOLBP = {}, NEWCATP = {}, CATNEWLOOK = null, CATNEWBD = null, CATNEWTANK = null, CATBCP = {}, CATTCP = {};   // CATBCP/CATTCP: a category's other choices   // pending: looks, backdrops, priorities, defaults, holiday backdrops
  // FIND NOTES FOR A CATEGORY (Christian, Oct 14: smart tags): the Notes not in it yet whose words fit it (resolve.js
  // catFit: its name, kin words, its Notes' words, its pools), best first, the strong ones ticked; you choose, and the
  // category is added to them in one commit (api.php retag). Nothing changes on a Note you don't tick.
  var FINDCAT = '', FINDSEL = null;
  function findList(c, J) {
    var all = (ENTRIES || []).map(function (e) { return { id: e.id, cats: e.cats || [], words: e.words || e.title || '' }; });
    return (ENTRIES || []).filter(function (e) { return (e.cats || []).indexOf(c) < 0; }).map(function (e) {
      var me = all.filter(function (x) { return x.id === e.id; })[0], r = window.GAResolve && GAResolve.catFit(J, all, { words: me.words, cats: me.cats, self: me }, c)[0];
      return { e: e, s: r ? r.s : 0, why: r ? r.why : [] };
    }).filter(function (x) { return x.s >= 2; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 30);
  }
  function findNotes(c, J) {
    var l = findList(c, J); if (!FINDSEL) { FINDSEL = {}; l.forEach(function (x) { if (x.s >= 3.5) FINDSEL[x.e.id] = 1; }); }
    var n = Object.keys(FINDSEL).length;
    return '<div class="catfind">' + (l.length ? '<p class="muted">Notes not in ' + esc(catName(c)) + ' whose words fit it, best first. Tick the ones it belongs on; the strong matches are ticked for you. Only the ticked ones change.</p>' +
        l.map(function (x) { return '<label class="ga-check"><input type="checkbox" data-fn="' + esc(x.e.id) + '"' + (FINDSEL[x.e.id] ? ' checked' : '') + '> <b>' + esc(x.e.title || x.e.id) + '</b> <small>' + esc(x.why.join(', ')) + (x.e.cats && x.e.cats.length ? ' · now in ' + esc(x.e.cats.map(catName).join(', ')) : '') + '</small></label>'; }).join('') +
        '<div class="row"><button type="button" class="fnall">Select all</button><button type="button" class="primary fnadd"' + (n ? '' : ' disabled') + '>Add ' + esc(catName(c)) + ' to ' + n + ' Note' + (n === 1 ? '' : 's') + '</button></div>'
      : '<p class="muted">No other Note\'s words fit ' + esc(catName(c)) + ' yet. As it gains Notes and images it learns what it\'s about.</p>') + '</div>';
  }
  function renderCats() {
    var box = $('#catsBox'); box.innerHTML = '<p class="muted">Loading…</p>';
    LOOKS = null; renderLookData().then(function (r) {
      var list = r[0], cats = r[1], count = {}, bds = r[2].list, bcats = r[2].cats, J = r[3] || {}, rank = J.categoryRank || {}, defs = J.defaults || {};
      var rk = function (c) { return c in CATRP ? CATRP[c] : (rank[c] || 0); }, df = function (k) { return k in DEFP ? DEFP[k] : (defs[k] || ''); };
      var hols = list.filter(function (l) { return l.from && l.to; }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
      var hb = function (h) { return h.name in HOLBP ? HOLBP[h.name] : (h.backdrop || ''); };
      (ENTRIES || []).forEach(function (e) { (e.cats || []).forEach(function (c) { count[c] = (count[c] || 0) + 1; }); });
      allCats(J).concat(Object.keys(NEWCATP)).forEach(function (c) { if (!(c in count)) count[c] = 0; });
      var names = Object.keys(count).sort(function (a, b) { return !!(cats[b] || bcats[b]) - !!(cats[a] || bcats[a]) || count[b] - count[a] || (a < b ? -1 : 1); });
      var bdopts = '<option value="">No backdrop</option>' + bds.map(function (b) { return '<option value="' + esc(b.name) + '">' + esc(b.name + (b.about ? ' · ' + b.about : '')) + '</option>'; }).join('');
      var bsrc = function (n) { var b = bds.filter(function (x) { return x.name === n; })[0]; return b ? bdSrc(b) : ''; };
      var opts = '<option value="">No look</option><option value="curls">curls</option>' + list.map(function (l) { return '<option value="' + esc(l.name) + '">' + esc(l.name + (l.about ? ' · ' + l.about : '')) + '</option>'; }).join('');
      var src = function (n) { var l = list.filter(function (x) { return x.name === n; })[0]; return n === 'curls' ? '/assets/narrator/head-base.webp' : l ? lookSrc(l) : ''; };
      var cnar = J.categoryNarrators || {}, nv = function (c) { return c in CATNP ? CATNP[c] : (cnar[c] || ''); };
      var NOPTS = '<option value="">The default</option><option value="glazyarray">GlazyArray</option><option value="alta">A.L.T.A.</option><option value="marley">Robot Marley</option>';
      // A.L.T.A.'s tank backdrops (looks.json tankBackdrops, files in assets/alta/backdrops): a column once there are any
      var tanks = J.tankBackdrops || [], ctank = J.categoryTanks || {}, tv = function (c) { return c in CATTP ? CATTP[c] : (ctank[c] || ''); };
      var TOPTS = '<option value="">The default</option>' + tanks.map(function (b) { return '<option value="' + esc(b.name) + '">' + esc(b.name + (b.about ? ' · ' + b.about : '')) + '</option>'; }).join('');
      var bch = J.categoryBackdropChoices || {}, tch = J.categoryTankChoices || {};
      var pending = Object.keys(CATBCP).length + Object.keys(CATTCP).length + Object.keys(CATTP).length + Object.keys(CATNP).length + Object.keys(CATP).length + Object.keys(CATBP).length + Object.keys(CATRP).length + Object.keys(DEFP).length + Object.keys(HOLBP).length + Object.keys(NEWCATP).length;
      box.innerHTML = '<h2>Categories</h2><p class="muted">Every category the Notes use: their kind (Ride, Hike, Mini-Cast) and their own tags. Give one a look and a backdrop and GlazyArray wears them on every Note in it. What she wears is decided in this order: a holiday on its dates (on every Note, unless the Note ignores holidays), the Note\'s own, its categories (the one ticked on the Note, then the highest priority here, then the one changed last), then the defaults ticked below.</p>' +
        '<ul class="catl">' + names.map(function (c) {
          var v = c in CATP ? CATP[c] : (cats[c] || ''), im = v && src(v);
          var bv = c in CATBP ? CATBP[c] : (bcats[c] || ''), bim = bv && bsrc(bv);
          return '<li><span class="catn"><b>' + esc(catName(c)) + '</b><small>' + count[c] + ' Note' + (count[c] === 1 ? '' : 's') + '</small><button type="button" class="link" data-find="' + esc(c) + '">' + (FINDCAT === c ? 'Close' : 'Find Notes for it') + '</button></span>' +
            '<span class="catc"><small>Her look</small><span>' + (im ? '<img alt="" src="' + im + '">' : '<i class="noimg"></i>') + '<select data-cat="' + esc(c) + '">' + opts + '</select></span></span>' +
            '<span class="catc"><small>Backdrop</small><span>' + (bim ? '<img class="bd" alt="" src="' + bim + '">' : '<i class="noimg bd"></i>') + '<select data-catbd="' + esc(c) + '">' + bdopts + '</select></span></span>' +
            '<span class="catc"><small>Narrator</small><span><select data-catnar="' + esc(c) + '">' + NOPTS + '</select></span></span>' +
            (tanks.length ? '<span class="catc"><small>Her tank</small><span><select data-cattank="' + esc(c) + '">' + TOPTS + '</select></span></span>' : '') +
            '<span class="catc catr"><small>Priority</small><input type="number" min="0" max="9" step="1" data-catr="' + esc(c) + '" value="' + rk(c) + '" title="0 to 9: when a Note\'s categories disagree, the higher wins"></span>' +
            (FINDCAT === c ? findNotes(c, J) : '') + '</li>';
        }).join('') + '</ul>' +
        '<div class="row"><label class="f catnd"><span>Who narrates when nothing else says</span><select id="defNar"><option value="">GlazyArray</option><option value="alta">A.L.T.A.</option><option value="marley">Robot Marley</option></select></label>' +
          (tanks.length ? '<label class="f catnd"><span>Behind her tank when nothing else says</span><select id="defTank"><option value="">The hall (her own)</option>' + TOPTS.replace('<option value="">The default</option>', '') + '</select></label>' : '') +
          '<span class="muted">A Note can choose its own narrator in its Episode script panel; otherwise its categories\' narrator tells it (the highest priority wins), else this one.</span></div>' +
        '<div class="row"><input id="newCat" placeholder="A new category, e.g. Night ride" maxlength="40"><button type="button" id="newCatAdd">Add the category</button><span class="muted">Then give it a look, a backdrop and a priority above, save, and add it to Notes in their style panel.</span></div>' +
        '<div class="row"><button type="button" class="primary" id="catSave"' + (pending ? '' : ' disabled') + '>Save the categories' + (pending ? ' (' + pending + ')' : '') + '</button><span class="muted">Live in about a minute.</span></div>' +
        '<h3>Image pools</h3><div class="chips ppick" role="tablist"><button type="button" class="chip' + (POOLV.who !== 'tank' ? ' on' : '') + '" data-pk="bd">GlazyArray and Robot Marley\'s backdrops</button><button type="button" class="chip' + (POOLV.who === 'tank' ? ' on' : '') + '" data-pk="tank">A.L.T.A.\'s tank scenes</button></div><div class="cpool" id="catPool"></div>' +
        '<h3>Holidays</h3><p class="muted">On its dates a holiday dresses every Note, except the ones that ignore holidays. Give one a backdrop and that shows too.</p><ul class="catl">' + hols.map(function (h) {
          var b = hb(h), bim = b && bsrc(b);
          return '<li><span class="catn"><b>' + esc(h.name.replace(/-/g, ' ')) + '</b><small>' + esc(h.from + ' to ' + h.to) + '</small></span>' +
            '<span class="catc"><small>Her look</small><span><img alt="" src="' + src(h.name) + '"></span></span>' +
            '<span class="catc"><small>Backdrop</small><span>' + (bim ? '<img class="bd" alt="" src="' + bim + '">' : '<i class="noimg bd"></i>') + '<select data-holbd="' + esc(h.name) + '">' + bdopts + '</select></span></span></li>';
        }).join('') + '</ul>' +
        '<h3>Her looks</h3><p class="muted">Tick the default, like a Note\'s poster: what she wears when nothing else gives her a look. None ticked: the holiday coming up.</p><div class="lookg">' + [{ name: 'curls', about: 'her own curls' }].concat(list).map(function (l) {
          return '<figure' + (df('look') === l.name ? ' class="on"' : '') + '><img alt="" src="' + src(l.name) + '"><figcaption>' + esc(l.name) + '<label class="ga-def"><input type="checkbox" data-deflook="' + esc(l.name) + '"' + (df('look') === l.name ? ' checked' : '') + '> Default</label></figcaption></figure>'; }).join('') + '</div>' +
        '<h3>Add a look</h3><p class="muted">Start from <a href="/assets/narrator/kit/her-template.png" download>her template</a> (<button type="button" class="link" id="catTpl">copy the image</button> · <a href="/assets/narrator/kit/her-edit-mask.png" download>mask</a> · <a href="/assets/narrator/kit/her-contact-sheet.jpg" target="_blank" rel="noopener">rules</a>), change only the hair and what\'s on it, and bring the render back here.</p>' +
        '<div class="grid2">' + field('Name', '<input id="nlName" placeholder="e.g. rain-hood" maxlength="40">', 'Lowercase, with dashes') + field('What it is', '<input id="nlAbout" placeholder="e.g. a brass rain hood" maxlength="120">') + '</div>' +
        '<label class="drop ga-drop" id="nlDrop"><input type="file" id="nlFile" accept="image/png,image/jpeg,image/webp" hidden><b>' + (CATNEWLOOK ? 'Choose a different render' : 'Bring the render here') + '</b> <span class="muted">or drop it here</span></label><div id="nlOut"></div>' +
        '<div class="row">' + field('Give it to', '<select id="nlCat"><option value="">No category yet</option>' + names.map(function (c) { return '<option value="' + esc(c) + '">' + esc(catName(c)) + '</option>'; }).join('') + '</select>') +
        '<label class="ga-check"><input type="checkbox" id="nlBulb" checked> Her antenna bulb shows</label><button type="button" class="primary" id="nlAdd"' + (CATNEWLOOK ? '' : ' disabled') + '>Add the look</button></div>' +
        '<h3>Her backdrops</h3><p class="muted">Tick the default: the scene behind every Note that nothing else gives one.</p><div class="lookg bdg">' + (bds.length ? bds.map(function (b) {
          return '<figure' + (df('backdrop') === b.name ? ' class="on"' : '') + '><img alt="" src="' + bdSrc(b) + '"><figcaption>' + esc(b.name) + '<label class="ga-def"><input type="checkbox" data-defbd="' + esc(b.name) + '"' + (df('backdrop') === b.name ? ' checked' : '') + '> Default</label></figcaption></figure>'; }).join('') : '<p class="muted">None yet.</p>') + '</div>' +
        '<h3>Add a backdrop</h3><p class="muted">A softly blurred scene behind the Listen bar: a library for case studies, a bike shop for rides. Say the place in a few words, copy the prompt and the template into your image tool, and bring the render back.</p>' +
        '<div class="grid2">' + field('Name', '<input id="nbName" placeholder="e.g. bike-shop" maxlength="40">', 'Lowercase, with dashes') + field('Give it to', '<select id="nbCat"><option value="">No category yet</option>' + names.map(function (c) { return '<option value="' + esc(c) + '">' + esc(catName(c)) + '</option>'; }).join('') + '</select>') + '</div>' +
        field('The place', '<textarea id="nbScene" rows="2" placeholder="e.g. ' + esc(SCENES.ride) + '"></textarea>', 'Picking a category fills in a suggestion') +
        field('Image prompt', '<textarea id="nbPrompt" rows="5" readonly></textarea>') + '<div class="row"><button type="button" id="nbCopy">Copy the image prompt</button></div>' + bdTpl() +
        '<label class="drop ga-drop" id="nbDrop"><input type="file" id="nbFile" accept="image/png,image/jpeg,image/webp" hidden><b>Bring the render here</b> <span class="muted">or drop it here</span></label><div id="nbOut"></div>' +
        '<div class="row"><button type="button" class="primary" id="nbAdd" disabled>Add the backdrop</button></div>' +
        '<h3>A.L.T.A.\'s tank scenes</h3><p class="muted">The place behind her glass, so she\'s on location. Only the strip above her copper ledge shows (the top 38%): the horizon or treeline sits about a quarter of the way down, and everything that matters is in the top third. A Note picks one in its Episode panel, a category in its column above. Without one of hers she\'s in her hall; she doesn\'t use the backdrops.</p>' +
        (tanks.length ? '<div class="lookg bdg tkg">' + tanks.map(function (b) { return '<figure><img alt="" src="/assets/alta/backdrops/' + esc(b.file) + (b.v ? '?r=' + esc(b.v) : '') + '"><figcaption>' + esc(b.name) + '</figcaption></figure>'; }).join('') + '</div>' : '<p class="muted">None yet.</p>') +
        '<div class="grid2">' + field('Name', '<input id="ntName" placeholder="e.g. tahoe-beach-dusk" maxlength="40">', 'Lowercase, with dashes') + field('Give it to', '<select id="ntCat"><option value="">No category yet</option>' + names.map(function (c) { return '<option value="' + esc(c) + '">' + esc(catName(c)) + '</option>'; }).join('') + '</select>') + '</div>' +
        field('The place', '<textarea id="ntScene" rows="2" placeholder="e.g. ' + esc(TANK_SCENES['lake-tahoe']) + '"></textarea>', 'Picking a category fills in a suggestion') +
        field('How you\'ll make it', '<select id="ntWay"><option value="edit">Edit her template (keeps the framing)</option><option value="new">A new picture from the prompt</option></select>') +
        field('Image prompt', '<textarea id="ntPrompt" rows="6" readonly></textarea>') + '<div class="row"><button type="button" id="ntCopy">Copy the image prompt</button></div>' +
        '<div class="ga-tpl"><img alt="Her tank template" src="/assets/alta/kit/tank-template.jpg?v=3"><span><b>Her tank template</b><br><span class="muted">16:9, 1376 x 768. Her empty tank: the green is the place; the ledge and everything below it stay.</span><br>' +
          '<button type="button" id="ntTplCopy">Copy the image</button> <a href="/assets/alta/kit/tank-template.jpg?v=3" download>Download</a> · <a href="/assets/alta/kit/tank-backdrop-guide.jpg" target="_blank" rel="noopener">Layout guide</a></span></div>' +
        '<label class="drop ga-drop" id="ntDrop"><input type="file" id="ntFile" accept="image/png,image/jpeg,image/webp" hidden><b>Bring the render here</b> <span class="muted">or drop it here: you\'ll see her in front of it</span></label><div id="ntOut"></div>' +
        '<div class="row"><button type="button" class="primary" id="ntAdd" disabled>Add the scene</button></div>';
      var cpd = $('#catPool', box); renderPool(cpd, POOLV.who === 'tank' ? 'tank' : 'bd');
      $$('[data-find]', box).forEach(function (b) { b.onclick = function () { var c = b.getAttribute('data-find'); FINDCAT = FINDCAT === c ? '' : c; FINDSEL = null; renderCats(); }; });
      $$('input[data-fn]', box).forEach(function (i) { i.onchange = function () { if (i.checked) FINDSEL[i.getAttribute('data-fn')] = 1; else delete FINDSEL[i.getAttribute('data-fn')]; renderCats(); }; });
      var fna = $('.fnall', box); if (fna) fna.onclick = function () { var all = $$('input[data-fn]', box), on = all.every(function (i) { return i.checked; }); all.forEach(function (i) { if (on) delete FINDSEL[i.getAttribute('data-fn')]; else FINDSEL[i.getAttribute('data-fn')] = 1; }); renderCats(); };
      var fad = $('.fnadd', box); if (fad) fad.onclick = function () {
        var c = FINDCAT, ids = Object.keys(FINDSEL); fad.disabled = true; fad.textContent = 'Adding…';
        api('retag', { cat: c, ids: ids }).then(function (j) {
          (ENTRIES || []).forEach(function (e) { if ((j.added || []).indexOf(e.id) >= 0) e.cats = (e.cats || []).concat([c]); });
          toast(catName(c) + ' is on ' + (j.added || []).length + ' more Note' + ((j.added || []).length === 1 ? '' : 's') + (j.skipped && j.skipped.length ? '; ' + j.skipped.length + ' waiting for review were left as they are' : '') + '. The site updates in about a minute.');
          FINDCAT = ''; FINDSEL = null; renderCats();
        }).catch(function (err) { toast(err.message, true); fad.disabled = false; });
      };
      $$('[data-pk]', box).forEach(function (b) { b.onclick = function () { POOLV.who = b.getAttribute('data-pk'); POOLV.to = null; $$('[data-pk]', box).forEach(function (x) { x.classList.toggle('on', x === b); }); renderPool(cpd, POOLV.who); }; });
      $$('.catl select[data-catnar]', box).forEach(function (sel) {
        var c = sel.getAttribute('data-catnar'); sel.value = nv(c);
        sel.onchange = function () { if (sel.value === (cnar[c] || '')) delete CATNP[c]; else CATNP[c] = sel.value; renderCats(); };
      });
      $$('.catl select[data-cattank]', box).forEach(function (sel) {
        var c = sel.getAttribute('data-cattank'); sel.value = tv(c);
        sel.onchange = function () { if (sel.value === (ctank[c] || '')) delete CATTP[c]; else CATTP[c] = sel.value; renderCats(); };
      });
      var dtk = $('#defTank'); if (dtk) { dtk.value = df('tank') || ''; dtk.onchange = function () { if (dtk.value === (defs.tank || '')) delete DEFP.tank; else DEFP.tank = dtk.value; renderCats(); }; }
      var dn = $('#defNar'); dn.value = df('narrator') === 'alta' || df('narrator') === 'marley' ? df('narrator') : '';
      dn.onchange = function () { if (dn.value === (defs.narrator || '')) delete DEFP.narrator; else DEFP.narrator = dn.value; renderCats(); };
      $$('.catl select[data-catbd]', box).forEach(function (sel) {
        var c = sel.getAttribute('data-catbd'); sel.value = c in CATBP ? CATBP[c] : (bcats[c] || '');
        sel.onchange = function () { if (sel.value === (bcats[c] || '')) delete CATBP[c]; else CATBP[c] = sel.value; renderCats(); };
      });
      $$('.catl select[data-cat]', box).forEach(function (sel) {
        var c = sel.getAttribute('data-cat'); sel.value = c in CATP ? CATP[c] : (cats[c] || '');
        sel.onchange = function () { if (sel.value === (cats[c] || '')) delete CATP[c]; else CATP[c] = sel.value; renderCats(); };
      });
      var nca = $('#newCatAdd'), nci = $('#newCat');
      var addCat = function () {
        var t = String(nci.value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        if (!t || /^\d{4}$/.test(t)) { toast('Give the category a name.', true); return; }
        if (t in count) { toast(catName(t) + ' is already here.', true); return; }
        NEWCATP[t] = nci.value.trim().slice(0, 40); renderCats();
      };
      nca.onclick = addCat; nci.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); addCat(); } };
      $$('.catl input[data-catr]', box).forEach(function (inp) {
        var c = inp.getAttribute('data-catr');
        inp.onchange = function () { var n = Math.max(0, Math.min(9, parseInt(inp.value, 10) || 0)); if (n === (rank[c] || 0)) delete CATRP[c]; else CATRP[c] = n; renderCats(); };
      });
      $$('.catl select[data-holbd]', box).forEach(function (sel) {
        var h = sel.getAttribute('data-holbd'), was = (hols.filter(function (x) { return x.name === h; })[0] || {}).backdrop || '';
        sel.value = h in HOLBP ? HOLBP[h] : was;
        sel.onchange = function () { if (sel.value === was) delete HOLBP[h]; else HOLBP[h] = sel.value; renderCats(); };
      });
      [['data-deflook', 'look'], ['data-defbd', 'backdrop']].forEach(function (d) {   // one default each, like a Note's poster: ticking one unticks the other
        $$('input[' + d[0] + ']', box).forEach(function (inp) {
          inp.onchange = function () { var v = inp.checked ? inp.getAttribute(d[0]) : ''; if (v === (defs[d[1]] || '')) delete DEFP[d[1]]; else DEFP[d[1]] = v; renderCats(); };
        });
      });
      $('#catSave').onclick = function () {
        var b = this; b.disabled = true; b.textContent = 'Saving…';
        var ne = function (o) { return Object.keys(o).length ? o : null; };
        api('looks', { categoryBackdropChoices: ne(CATBCP), categoryTankChoices: ne(CATTCP), categoryTanks: ne(CATTP), categoryNarrators: ne(CATNP), categoryLooks: ne(CATP), categoryBackdrops: ne(CATBP), categoryRank: ne(CATRP), defaults: ne(DEFP), holidayBackdrops: ne(HOLBP), categoryNames: ne(NEWCATP) })
          .then(function () { CATBCP = {}; CATTCP = {}; CATTP = {}; CATNP = {}; CATP = {}; CATBP = {}; CATRP = {}; DEFP = {}; HOLBP = {}; NEWCATP = {}; LOOKS = null; toast('Saved. The site updates in about a minute.'); renderCats(); })
          .catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Save the categories'; });
      };
      // Add a backdrop
      var nbScene = $('#nbScene'), nbPrompt = $('#nbPrompt'), upd = function () { nbPrompt.value = GALook.bdPrompt(nbScene.value || SCENES[$('#nbCat').value] || ''); };
      var BDNAMES = { 'case-study': 'library', ride: 'bike-shop', hike: 'trailhead', 'mini-cast': 'workshop', automaton: 'clockmaker', 'lake-tahoe': 'lakeshore', 'with-marley': 'meadow', foraging: 'desert-hill', 'high-desert': 'sagebrush' };
      $('#nbCat').onchange = function () { if (!nbScene.value.trim() && SCENES[this.value]) nbScene.value = SCENES[this.value]; if (!$('#nbName').value.trim()) $('#nbName').value = BDNAMES[this.value] || (this.value ? this.value + '-backdrop' : ''); upd(); };
      nbScene.oninput = upd; upd();
      $('#nbCopy').onclick = function () { navigator.clipboard.writeText(nbPrompt.value).then(function () { toast('Image prompt copied.'); }); };
      wireTpl(box);
      var takeBd = function (f) {
        if (!f) return; $('#nbOut').innerHTML = '<p class="muted">Working…</p>';
        GALook.backdrop(f).then(function (res) { CATNEWBD = res; var o = $('#nbOut'); o.innerHTML = res.warn ? '<p class="warn">' + esc(res.warn) + '</p>' : ''; res.preview.className = 'ga-prev'; o.appendChild(res.preview); $('#nbAdd').disabled = false; })
          .catch(function (e) { $('#nbOut').innerHTML = ''; toast(e.message, true); });
      };
      $('#nbFile').onchange = function () { takeBd(this.files[0]); this.value = ''; };
      var nd = $('#nbDrop'); ['dragover', 'dragenter'].forEach(function (t) { nd.addEventListener(t, function (ev) { ev.preventDefault(); }); });
      nd.addEventListener('drop', function (ev) { ev.preventDefault(); takeBd(ev.dataTransfer.files[0]); });
      $('#nbAdd').onclick = function () {
        var name = slug($('#nbName').value).slice(0, 40), cat = $('#nbCat').value, b = this;
        if (!name) { toast('Give the backdrop a name.', true); return; }
        if (bds.some(function (x) { return x.name === name; }) && !confirm(name + ' already exists. Replace its image with this one?')) return;
        b.disabled = true; b.textContent = 'Adding…';
        api('lookblob', CATNEWBD.blob).then(function (r) {
          var cb = {}; if (cat) cb[cat] = name;
          return blobColors(CATNEWBD.blob).then(function (cols) { return api('looks', { newBackdrop: { name: name, ext: CATNEWBD.ext, sha: r.sha, about: '', scene: nbScene.value.trim(), colors: cols }, categoryBackdrops: cat ? cb : null }); });
        }).then(function () { CATNEWBD = null; LOOKS = null; toast(name + ' added. The site updates in about a minute.'); renderCats(); })
          .catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Add the backdrop'; });
      };
      // A.L.T.A.'s tank scenes: the prompt (an edit of her template, or a new picture), the render cropped to her frame,
      // and a preview with her and her tank in front of it (assets/alta/kit/tank-overlay.webp)
      var ntScene = $('#ntScene'), ntPrompt = $('#ntPrompt'), ntUpd = function () { ntPrompt.value = tankPrompt(ntScene.value || TANK_SCENES[$('#ntCat').value] || SCENES[$('#ntCat').value] || '', $('#ntWay').value); };
      $('#ntCat').onchange = function () { var c = this.value, sc = TANK_SCENES[c] || SCENES[c]; if (!ntScene.value.trim() && sc) ntScene.value = sc; if (!$('#ntName').value.trim() && c) $('#ntName').value = c + '-tank'; ntUpd(); };
      ntScene.oninput = ntUpd; $('#ntWay').onchange = ntUpd; ntUpd();
      $('#ntCopy').onclick = function () { navigator.clipboard.writeText(ntPrompt.value).then(function () { toast('Image prompt copied.'); }); };
      $('#ntTplCopy').onclick = function () { GALook.copyImage('/assets/alta/kit/tank-template.jpg?v=3').then(function () { toast('Her tank template is on the clipboard.'); }, function (e) { toast(e.message, true); }); };
      var takeTank = function (f) {
        if (!f) return; $('#ntOut').innerHTML = '<p class="muted">Working…</p>';
        tankImage(f).then(function (res) { CATNEWTANK = res; $('#ntAdd').disabled = !tankShow($('#ntOut'), res); })
          .catch(function (e) { $('#ntOut').innerHTML = '<p class="warn">That picture didn\'t open: ' + esc(e.message) + '</p>'; toast(e.message, true); });
      };
      $('#ntFile').onchange = function () { takeTank(this.files[0]); this.value = ''; };
      var ntd = $('#ntDrop'); ['dragover', 'dragenter'].forEach(function (t) { ntd.addEventListener(t, function (ev) { ev.preventDefault(); }); });
      ntd.addEventListener('drop', function (ev) { ev.preventDefault(); takeTank(ev.dataTransfer.files[0]); });
      if (CATNEWTANK) { CATNEWTANK.preview.className = 'ga-prev'; $('#ntOut').appendChild(CATNEWTANK.preview); $('#ntAdd').disabled = false; }
      $('#ntAdd').onclick = function () {
        var name = slug($('#ntName').value).slice(0, 40), cat = $('#ntCat').value, b = this;
        if (!name) { toast('Give the scene a name.', true); return; }
        if (tanks.some(function (x) { return x.name === name; }) && !confirm(name + ' already exists. Replace its image with this one?')) return;
        b.disabled = true; b.textContent = 'Adding…';
        api('lookblob', CATNEWTANK.blob).then(function (r) {
          var ct = {}; if (cat) ct[cat] = name;
          return api('looks', { newTank: { name: name, ext: CATNEWTANK.ext, sha: r.sha, scene: ntScene.value.trim(), colors: CATNEWTANK.colors }, categoryTanks: cat ? ct : null });
        }).then(function () { CATNEWTANK = null; LOOKS = null; toast(name + ' added. The site updates in about a minute.'); renderCats(); })
          .catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Add the scene'; });
      };
      if (PREFILL_LOOK) { $('#nlName').value = PREFILL_LOOK.name; $('#nlAbout').value = PREFILL_LOOK.about || ''; var nn = $('#nlName'); PREFILL_LOOK = null; setTimeout(function () { if (window.easeScroll) easeScroll.to(nn); nn.focus({ preventScroll: true }); }, 50); }
      $('#catTpl').onclick = function () { GALook.copyTemplate().then(function () { toast('Her template is on the clipboard.'); }, function (e) { toast(e.message, true); }); };
      function take(f) {
        if (!f) return; $('#nlOut').innerHTML = '<p class="muted">Working…</p>';
        GALook.make(f).then(function (r) {
          CATNEWLOOK = r; var o = $('#nlOut'); o.innerHTML = r.warn ? '<p class="warn">' + esc(r.warn) + '</p>' : ''; r.preview.className = 'ga-prev'; o.appendChild(r.preview); o.appendChild(flairBox(r, PAL_SAMPLE));
          $('#nlAdd').disabled = false; $('#nlDrop b').textContent = 'Choose a different render';
        }).catch(function (e) { $('#nlOut').innerHTML = ''; toast(e.message, true); });
      }
      if (CATNEWLOOK) { var o = $('#nlOut'); CATNEWLOOK.preview.className = 'ga-prev'; o.appendChild(CATNEWLOOK.preview); o.appendChild(flairBox(CATNEWLOOK, PAL_SAMPLE)); if (CATNEWLOOK.warn) o.insertAdjacentHTML('afterbegin', '<p class="warn">' + esc(CATNEWLOOK.warn) + '</p>'); }
      $('#nlFile').onchange = function () { take(this.files[0]); this.value = ''; };
      var d = $('#nlDrop'); ['dragover', 'dragenter'].forEach(function (t) { d.addEventListener(t, function (ev) { ev.preventDefault(); }); });
      d.addEventListener('drop', function (ev) { ev.preventDefault(); take(ev.dataTransfer.files[0]); });
      $('#nlAdd').onclick = function () {
        var name = slug($('#nlName').value).slice(0, 40), about = $('#nlAbout').value.trim(), cat = $('#nlCat').value, b = this;
        if (!name) { toast('Give the look a name.', true); return; }
        if (name === 'curls' || list.some(function (l) { return l.name === name && (l.to || l.rotate); })) { toast('That name is taken by one of her holiday looks or hair styles.', true); return; }
        if (list.some(function (l) { return l.name === name && l.file; }) && !confirm(name + ' already exists. Replace its image with this one?')) return;
        b.disabled = true; b.textContent = 'Adding…';
        var nlSha = null;
        api('lookblob', CATNEWLOOK.blob).then(function (r) { nlSha = r.sha; return flairUp(CATNEWLOOK); }).then(function (f) {
          var cl = {}; if (cat) cl[cat] = name;
          return api('looks', { newLook: { name: name, ext: CATNEWLOOK.ext, sha: nlSha, about: about, bulb: $('#nlBulb').checked, flair: f }, categoryLooks: cat ? cl : null });
        }).then(function () { CATNEWLOOK = null; LOOKS = null; toast(name + ' added. The site updates in about a minute.'); renderCats(); })
          .catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Add the look'; });
      };
    }).catch(function (err) { box.innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
  }

  // ---------- Characters (owner, Christian, Oct 13): who wears what. assets/narrator/characters.json says each one's
  // pieces, template and prompts; looks.json says what exists. A matrix of the looks more than one of them wears, then
  // any category or Note applied (on a day you pick) to show what each of them gets and where it comes from, the same
  // rule as the site (assets/narrator/resolve.js). A gap is a click from its prompt. ----------
  var CHARS = null, CHV = { t: '', d: '', ct: '' }, PREFILL_LOOK = null, PREFILL_ML = null, openBi = function () {};
  function charsData() {
    if (!CHARS) CHARS = fetch('/assets/narrator/characters.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) { return j.characters || []; }).catch(function () { return []; });
    return Promise.all([CHARS, renderLookData()]);
  }
  function fillIn(t, v) { return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return k in v ? v[k] : m; }); }
  // a character's prompt for a piece: a look (by its looks.json entry) or a tank scene (by its place)
  function charPrompt(ch, kind, l, place) {
    var P = ch[kind] || {};
    if (kind === 'tank') return fillIn(P.prompt, { place: place || '[ INSERT SCENE ]' });
    if (P.has === 'file') return fillIn(P.prompt, { look: l.gaLook || l.about || l.name.replace(/-/g, ' '), a: l.gaA || '[the part that takes the first colour]', b: l.gaB || '[the part that takes the second colour]' });
    var i = (P.ideas || {})[l.name] || ['[a hat for ' + l.name.replace(/-/g, ' ') + ']', '[a small charm]', 'hat', 'charm'];
    return fillIn(P.prompt, { hat: i[0], charm: i[1], hatShort: i[2], charmShort: i[3] });
  }
  function hasLook(ch, l) { return !!l && (l.name === 'curls' ? ch.look.has === 'file' : ch.look.has === 'file' ? !!l.file : !!l[ch.look.has]); }
  function renderChars() {
    var box = $('#charsBox'); if (!box) return; box.innerHTML = '<p class="muted">Loading…</p>';
    charsData().then(function (rr) {
      var chars = rr[0], r = rr[1], list = r[0], J = r[3] || {}, bds = r[2].list;
      var byName = {}; list.forEach(function (l) { byName[l.name] = l; });
      var occ = list.filter(function (l) { return (l.from && l.to) || l.marley; });
      var hols = list.filter(function (l) { return l.from && l.to; }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
      var cats = {}; (ENTRIES || []).forEach(function (e) { (e.cats || []).forEach(function (c) { cats[c] = 1; }); }); allCats(J).forEach(function (c) { cats[c] = 1; });
      // what each category offers (its own pick and its choices), by how many Notes it holds
      var nCat = {}; (ENTRIES || []).forEach(function (e) { (e.cats || []).forEach(function (c) { nCat[c] = (nCat[c] || 0) + 1; }); });
      var tks = J.tankBackdrops || [], offer = function (base, more, c) { return [base[c]].concat(more[c] || []).filter(function (n, i, a) { return n && a.indexOf(n) === i; }); };
      var head = '<tr><th></th>' + chars.map(function (c) { return '<th><img alt="" src="' + esc(c.avatar) + '">' + esc(c.name) + '</th>'; }).join('') + '</tr>';
      var gapBtn = function (c, kind, n, place, label) { return '<button type="button" class="chg" data-c="' + esc(c.id) + '" data-k="' + kind + '" data-n="' + esc(n || '') + '" data-p="' + esc(place || '') + '">' + (label || 'Missing: the prompt') + '</button>'; };
      // each character's tab: who you're working on (a profile), what they wear now, what's missing, and their own box
      var thumbOf = function (c, l) {   // a look's picture for a character: GlazyArray's head in it, Robot Marley's hat
        if (c.id !== 'marley') return lookSrc(l);
        var m = l.marley, h = m && typeof m === 'object' ? m.hat : BUILTIN_HAT[l.name];
        return h ? '/assets/marley/parts/web/hat-' + h + '.' + (m && m.ext === 'png' ? 'png' : 'webp') + (m && m.v ? '?v=' + m.v : '') : c.avatar;
      };
      var BUILTIN_HAT = { halloween: 'halloween', 'winter-holidays': 'winter', 'st-patricks': 'stpatricks', hawaii: 'hawaii', 'tahoe-winter': 'beanie' };   // her built-in looks' hats (js/marley.js HOL)
      var styles = function (c) {
        if (c.id === 'alta') return (J.tankBackdrops || []).map(function (b) { return { name: b.name, img: '/assets/alta/backdrops/' + b.file + (b.v ? '?r=' + b.v : ''), sub: b.scene || '' }; });
        if (c.pieces.indexOf('look') < 0) return [];
        return list.filter(function (l) { return hasLook(c, l); }).map(function (l) {
          return { name: l.name, img: thumbOf(c, l), sub: l.from ? l.from + ' to ' + l.to : l.rotate ? 'a hair day' : (l.about || 'picked') };
        });
      };
      var missing = function (c) { return c.pieces.indexOf('look') >= 0 ? occ.filter(function (l) { return !hasLook(c, l); }) : []; };
      var WHAT = { glazyarray: 'Wears looks: her hair and what\'s on it. Made from her template with two prompts; the Studio keys the render and puts her face back, so she still talks and blinks.',
        marley: 'Wears looks: a hat and a charm. Made from two renders of her seated template, one in its own colours and one with the pieces painted cyan; the Studio cuts them.',
        alta: 'Has scenes behind her tank: the place above her copper ledge. Made from her tank template; without one she stays in her hall (she doesn\'t use the backdrops).' };
      var prof = function (id) {
        var c = chars.filter(function (x) { return x.id === id; })[0]; if (!c) return '';
        var st = styles(c), ms = missing(c), unit = id === 'alta' ? 'scene' : 'look';
        return '<div class="cprof"><img alt="" src="' + esc(c.avatar) + '"><div><h3>' + esc(c.name) + '</h3><p class="muted">' + esc(WHAT[id] || '') + '</p>' +
            '<p><b>' + st.length + '</b> ' + unit + (st.length === 1 ? '' : 's') + (ms.length ? ' · <b>' + ms.length + '</b> missing' : '') + '</p></div></div>' +
          (ms.length ? '<h4>Missing</h4><div class="cmiss">' + ms.map(function (l) { return '<span>' + esc(l.name.replace(/-/g, ' ')) + (l.from ? ' <small>' + esc(l.from + ' to ' + l.to) + '</small>' : '') + gapBtn(c, 'look', l.name, '', 'The prompt') + '</span>'; }).join('') + '</div>' : '') +
          '<div class="cprompt"></div>' +
          '<h4>' + (id === 'alta' ? 'Her scenes' : 'Her looks') + '</h4><div class="cgal">' + (st.length ? st.map(function (x) { return '<figure title="' + esc(x.sub) + '"><img alt="" loading="lazy" src="' + esc(x.img) + '"><figcaption>' + esc(x.name.replace(/-/g, ' ')) + gapBtn(c, id === 'alta' ? 'tank' : 'look', x.name, id === 'alta' ? (x.sub || x.name.replace(/-/g, ' ')) : '', 'Its prompt') + '</figcaption></figure>'; }).join('') : '<p class="muted">None yet.</p>') + '</div>' +
          '<h4 id="bi-' + esc(id) + '">Bring in ' + (id === 'alta' ? 'a scene' : 'a look') + '</h4>';
      };
      // ---------- WHAT'S NEEDED (Christian, Oct 14): where each character is light, most useful first. Pools: a category's
      // images for a character, weighed by how many Notes it holds (none is worse than one; two or more give a Note a
      // choice). Colours: a Note's two colours with nothing close among its categories' images (resolve.js cdist; the
      // images' colours come from the pictures, so they run softer than a Note's). Words: an image without a description
      // can only be matched by its name. Each has its prompt; the colour map shows where each character's images sit
      // against the Notes' colours. ----------
      var lookGaps = chars.reduce(function (t, c) { return t + missing(c).length; }, 0);
      var KINDS = [{ k: 'bd', who: 'GlazyArray and Robot Marley', unit: 'backdrop', lib: bds, first: J.categoryBackdrops || {}, more: J.categoryBackdropChoices || {}, ch: chars.filter(function (c) { return c.id === 'glazyarray'; })[0] },
        { k: 'tank', who: 'A.L.T.A.', unit: 'tank scene', lib: tks, first: J.categoryTanks || {}, more: J.categoryTankChoices || {}, ch: chars.filter(function (c) { return c.id === 'alta'; })[0] }];
      var hex2hsl = function (h) { var n = parseInt(String(h).slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0, hu = 0;
        if (d) hu = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return [(hu + 360) % 360, sat, l]; };
      var hueName = function (h) { var x = hex2hsl(h), hu = x[0], sa = x[1], l = x[2];
        if (sa < 0.18) return l < 0.25 ? 'near-black' : l > 0.8 ? 'white and pale stone' : 'grey and stone';
        var n = hu < 15 || hu >= 345 ? 'red' : hu < 40 ? 'orange' : hu < 65 ? 'gold' : hu < 160 ? 'green' : hu < 195 ? 'teal' : hu < 250 ? 'blue' : hu < 290 ? 'violet' : 'pink';
        return (l < 0.3 ? 'deep ' : l > 0.72 ? 'pale ' : sa > 0.7 ? 'bright ' : '') + n; };
      var poolOfCat = function (K, c) { return [K.first[c]].concat(K.more[c] || []).filter(function (n, i, a) { return n && a.indexOf(n) === i && K.lib.some(function (b) { return b.name === n; }); }); };
      var imgOf = function (K, n) { return K.lib.filter(function (b) { return b.name === n; })[0]; };
      var notePool2 = function (K, e) { var p = []; (e.cats || []).forEach(function (x) { poolOfCat(K, x).forEach(function (n) { if (p.indexOf(n) < 0) p.push(n); }); }); return p; };
      var withNotes = Object.keys(nCat).filter(function (c) { return nCat[c] > 0; });
      var NEED = [];
      KINDS.forEach(function (K) {
        if (!K.ch) return;
        // a category is light for the Notes in it that have no choice across all their categories (a Note also in
        // Lake Tahoe has Lake Tahoe's images, whatever With Marley offers)
        var notePool = function (e) { var p = []; (e.cats || []).forEach(function (x) { poolOfCat(K, x).forEach(function (n) { if (p.indexOf(n) < 0) p.push(n); }); }); return p; };
        withNotes.forEach(function (c) {
          var n = poolOfCat(K, c).length; if (n >= 2) return;
          var lack = (ENTRIES || []).filter(function (e) { return (e.cats || []).indexOf(c) >= 0 && notePool(e).length < 2; });
          if (lack.length) NEED.push({ t: 'pool', K: K, c: c, n: n, lack: lack, score: lack.length * (lack.some(function (e) { return !notePool(e).length; }) ? 3 : 1.2) });
        });
        // colours: each Note's colours against everything its categories offer this character
        var far = {};
        (ENTRIES || []).forEach(function (e) {
          var pool = []; (e.cats || []).forEach(function (c) { poolOfCat(K, c).forEach(function (n) { if (pool.indexOf(n) < 0) pool.push(n); }); });
          if (!pool.length) return;
          var cols = []; pool.forEach(function (n) { (imgOf(K, n).colors || []).forEach(function (x) { cols.push(x); }); });
          (e.pal || []).filter(function (x) { return /^#[0-9a-f]{6}$/i.test(x); }).forEach(function (pc) {
            var d = Math.min.apply(null, cols.map(function (x) { return GAResolve.cdist(pc, x); }));
            if (d > 200) { var hn = hueName(pc); (far[hn] = far[hn] || { notes: [], cols: [], cats: {} }).notes.push(e); far[hn].cols.push(pc); (e.cats || []).forEach(function (c) { far[hn].cats[c] = (far[hn].cats[c] || 0) + 1; }); }
          });
        });
        Object.keys(far).forEach(function (hn) { var f = far[hn], seen = {}; f.notes = f.notes.filter(function (e) { return seen[e.id] ? false : (seen[e.id] = 1); });
          var top = Object.keys(f.cats).sort(function (a, b) { return f.cats[b] - f.cats[a]; })[0];
          NEED.push({ t: 'colour', K: K, hn: hn, notes: f.notes, cols: f.cols, c: top, score: f.notes.length * 1.3 }); });
        var bare = K.lib.filter(function (b) { return !b.scene; });
        if (bare.length) NEED.push({ t: 'words', K: K, list: bare, score: bare.length * 0.6 + 2 });
      });
      chars.forEach(function (c) { var ms = missing(c); if (ms.length) NEED.push({ t: 'looks', ch: c, list: ms, score: ms.length * 2 }); });
      NEED.sort(function (a, b) { return b.score - a.score; });
      var swatch = function (cols) { return '<canvas class="swatch" width="' + Math.max(1, cols.length) * 14 + '" height="14" data-cols="' + esc(cols.join(' ')) + '"></canvas>'; };
      var needRow = function (x) {
        var K = x.K, place;
        if (x.t === 'pool') {
          place = (K.k === 'tank' ? TANK_SCENES[x.c] : SCENES[x.c]) || ('a place that suits ' + catName(x.c));
          var have = poolOfCat(K, x.c);
          return '<li><span class="nd-t"><b>' + esc(catName(x.c)) + '</b> holds ' + nCat[x.c] + ' Note' + (nCat[x.c] === 1 ? '' : 's') + ' and offers ' + (x.n ? 'only one ' + K.unit + ' (' + esc(have[0]) + ')' : 'no ' + K.unit + 's') + ' for ' + esc(K.who) + '; ' + (x.lack.length === nCat[x.c] ? 'none' : x.lack.length) + ' of its Notes ' + (x.lack.length === 1 ? 'has' : 'have') + (x.lack.some(function (e) { return !notePool2(K, e).length; }) ? (K.k === 'tank' ? ' no scene at all (her hall)' : ' no backdrop at all') : ' no choice') + ' <small>(' + esc(x.lack.slice(0, 3).map(function (e) { return e.title; }).join(', ') + (x.lack.length > 3 ? ' and ' + (x.lack.length - 3) + ' more' : '')) + ')</small></span>' +
            '<span class="nd-a">' + gapBtn(K.ch, K.k === 'tank' ? 'tank' : 'backdrop', '', place, 'A prompt for it') + '<button type="button" class="link" data-openpool="' + esc(K.k + ':' + x.c) + '">Open its pool</button></span></li>';
        }
        if (x.t === 'colour') {
          place = ((K.k === 'tank' ? TANK_SCENES[x.c] : SCENES[x.c]) || ('a place that suits ' + catName(x.c))) + ', with ' + x.hn + ' tones';
          return '<li><span class="nd-t">' + swatch(x.cols.slice(0, 6)) + ' <b>' + esc(x.hn.charAt(0).toUpperCase() + x.hn.slice(1)) + '</b> for ' + esc(K.who) + ': ' + x.notes.length + ' Note' + (x.notes.length === 1 ? '\'s colours have' : 's\' colours have') + ' nothing close among their ' + K.unit + 's <small>(' + esc(x.notes.slice(0, 3).map(function (e) { return e.title; }).join(', ') + (x.notes.length > 3 ? ' and ' + (x.notes.length - 3) + ' more' : '')) + ')</small></span>' +
            '<span class="nd-a">' + gapBtn(K.ch, K.k === 'tank' ? 'tank' : 'backdrop', '', place, 'A prompt in those colours') + '</span></li>';
        }
        if (x.t === 'words') {
          return '<li class="nd-words"><span class="nd-t"><b>' + x.list.length + ' ' + K.unit + (x.list.length === 1 ? '' : 's') + '</b> for ' + esc(K.who) + ' have no description, so a Note can only match them by name. Say what each shows:</span>' +
            '<div class="nd-desc">' + x.list.map(function (b) { var src = K.k === 'tank' ? '/assets/alta/backdrops/' + esc(b.file) + (b.v ? '?r=' + esc(b.v) : '') : bdSrc(b);
              return '<label><img alt="" loading="lazy" src="' + src + '"><span>' + esc(b.name) + '</span><input data-desc="' + esc(K.k + ':' + b.name) + '" maxlength="200" placeholder="What it shows, in a few words" value="' + esc(DESCP[K.k + ':' + b.name] || '') + '"></label>'; }).join('') + '</div>' +
            '<div class="row"><button type="button" class="primary nd-save" data-k="' + K.k + '" disabled>Save the descriptions</button></div></li>';
        }
        if (x.t === 'looks') return '<li><span class="nd-t"><b>' + esc(x.ch.name) + '</b> is missing ' + x.list.length + ' look' + (x.list.length === 1 ? '' : 's') + ': ' + esc(x.list.map(function (l) { return l.name.replace(/-/g, ' '); }).join(', ')) + '</span><span class="nd-a">' + gapBtn(x.ch, 'look', x.list[0].name, '', 'A prompt for ' + x.list[0].name.replace(/-/g, ' ')) + '</span></li>';
        return '';
      };
      var card = function (c) {
        var tank = c.pieces.indexOf('tank') >= 0, K = KINDS[tank ? 1 : 0], st = styles(c), ms = missing(c);
        var withC = withNotes.filter(function (x) { return poolOfCat(K, x).length >= 2; }).length, none = withNotes.filter(function (x) { return !poolOfCat(K, x).length; }).length;
        var noneN = (ENTRIES || []).filter(function (e) { return !notePool2(K, e).length; }).length;
        var notesChoice = (ENTRIES || []).filter(function (e) { var p = []; (e.cats || []).forEach(function (x) { poolOfCat(K, x).forEach(function (n) { if (p.indexOf(n) < 0) p.push(n); }); }); return p.length >= 2; }).length;
        return '<div class="ncard"><img alt="" src="' + esc(c.avatar) + '"><div><b>' + esc(c.name) + '</b>' +
          (tank ? '<span>' + K.lib.length + ' tank scenes</span>' : '<span>' + st.length + ' looks' + (ms.length ? ', ' + ms.length + ' missing' : ', all there') + ' · ' + K.lib.length + ' backdrops' + (c.id === 'marley' ? ' (shared)' : '') + '</span>') +
          '<span>' + notesChoice + ' of ' + (ENTRIES || []).length + ' Notes have a choice' + (noneN ? ' · ' + noneN + ' ha' + (noneN === 1 ? 's' : 've') + (tank ? ' only her hall' : ' no backdrop') : '') + '</span>' +
          '<canvas class="nspec" width="300" height="56" data-k="' + K.k + '" data-mini="1"></canvas></div></div>';
      };
      var DESCP = window.__DESCP = window.__DESCP || {};
      var needsHtml = function () {
        var shown = CHV.allNeeds ? NEED : NEED.slice(0, 10);
        return '<h3>What\'s needed</h3><p class="muted">Where each character is light, the most useful first: categories with few images for their Notes, Notes whose colours nothing in their pools comes close to, and images without words. Each has its prompt.</p>' +
          '<div class="ncards">' + chars.map(card).join('') + '</div>' +
          (NEED.length ? '<ol class="needs">' + shown.map(needRow).join('') + '</ol>' + (NEED.length > 10 ? '<button type="button" class="link" id="ndAll">' + (CHV.allNeeds ? 'Show the top ten' : 'Show all ' + NEED.length) + '</button>' : '') : '<p>Nothing needed: every category with Notes offers each character a choice, and every colour has something close.</p>') +
          '<h3>Where they sit in colour</h3><p class="muted">Each dot is a colour from an image (across: the hue, greys at the far right; dark at the top, light at the bottom); each ring is a colour from a Note. Rings far from any dot are colours their images don\'t have yet.</p>' +
          '<div class="nspecs"><figure><figcaption>Backdrops: GlazyArray and Robot Marley</figcaption><canvas class="nspec" width="720" height="150" data-k="bd"></canvas></figure><figure><figcaption>Tank scenes: A.L.T.A.</figcaption><canvas class="nspec" width="720" height="150" data-k="tank"></canvas></figure></div>';
      };
      var ctTabs = '<div class="chips ct-tabs" role="tablist"><button type="button" class="chip" data-ct="overview">Overview</button>' + chars.map(function (c) { return '<button type="button" class="chip" data-ct="' + esc(c.id) + '"><img alt="" src="' + esc(c.avatar) + '">' + esc(c.name) + '</button>'; }).join('') + '</div>';
      box.innerHTML = '<h2>Characters</h2>' + ctTabs + '<div class="ct" data-ct="overview">' + needsHtml() + '<p class="muted">Who wears what. A category sets a base, a Note can change it, and a holiday on its dates comes first (unless the Note ignores holidays). Each character\'s pieces, template and prompts are in <code>assets/narrator/characters.json</code>; a new character is an entry there plus its player and kit.</p>' +
        '<details class="chfold"' + (lookGaps ? ' open' : '') + '><summary><h3>Who has which look</h3> <small>' + (lookGaps ? lookGaps + ' missing' : 'all covered') + '</small></summary><p class="muted">The holidays, and the looks made for more than one of them.</p><div class="chm-wrap"><table class="chm"><thead>' + head + '</thead><tbody>' + occ.map(function (l) {
          return '<tr><th>' + esc(l.name.replace(/-/g, ' ')) + '<small>' + esc(l.from ? l.from + ' to ' + l.to : 'picked, no dates') + '</small></th>' + chars.map(function (c) {
            if (c.pieces.indexOf('look') < 0) return '<td class="na" title="' + esc(c.name) + ' doesn\'t wear looks">—</td>';
            return hasLook(c, l) ? '<td class="ok"><img alt="" src="' + thumbOf(c, l) + '"><span>Has hers</span></td>' : '<td class="gap">' + gapBtn(c, 'look', l.name) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div></details>' +
        '<h3>What a category or a Note gives them</h3><div class="row"><label class="f"><span>Apply</span><select id="chT"><option value="">Pick a category or a Note</option><optgroup label="Categories">' +
          Object.keys(cats).sort().map(function (c) { return '<option value="c:' + esc(c) + '">' + esc(catName(c)) + '</option>'; }).join('') + '</optgroup><optgroup label="Notes">' +
          (ENTRIES || []).map(function (e) { return '<option value="n:' + esc(e.id) + '">' + esc(e.title || e.id) + '</option>'; }).join('') + '</optgroup></select></label>' +
          '<label class="f"><span>On</span><select id="chD"><option value="">Today</option>' + hols.map(function (h) { return '<option value="' + esc(h.from) + '">' + esc(h.name.replace(/-/g, ' ') + ' (' + h.from + ')') + '</option>'; }).join('') + '</select></label></div>' +
        '<div id="chOut"></div><div id="chPrompt" class="cprompt"></div></div>' +
          // GlazyArray: her look, the two-step render from her template (the Studio keys it and puts her face back, look.js)
          '<div class="ct" data-ct="glazyarray" hidden>' + prof('glazyarray') +
            '<div class="row"><label class="f"><span>Which look</span><select id="gaLook"><option value="">Pick the look…</option>' +
              list.filter(function (l) { return !l.file; }).map(function (l) { return '<option value="' + esc(l.name) + '">' + esc(l.name.replace(/-/g, ' ')) + ' (she hasn\'t got it)</option>'; }).join('') +
              '<option value="__new">A new look of hers…</option>' +
              list.filter(function (l) { return l.file && !l.to && !l.rotate; }).map(function (l) { return '<option value="' + esc(l.name) + '">' + esc(l.name.replace(/-/g, ' ')) + ' (replace hers)</option>'; }).join('') + '</select></label>' +
              '<label class="f" id="gaNewF" hidden><span>Its name</span><input id="gaName" placeholder="e.g. rain-hood" maxlength="40"></label>' +
              '<label class="f"><span>What it is</span><input id="gaAbout" placeholder="e.g. a brass rain hood" maxlength="120"></label></div>' +
            '<div class="row"><button type="button" id="gaPr">Copy the prompts</button><button type="button" id="gaTpl">Copy her template</button><a href="/assets/narrator/kit/her-template.png" download>Download it</a> · <a href="/assets/narrator/kit/her-edit-mask.png" download>Mask</a> · <a href="/assets/narrator/kit/her-contact-sheet.jpg" target="_blank" rel="noopener">Rules</a></div>' +
            '<label class="drop ga-drop" id="gaDrop"><input type="file" id="gaFile" accept="image/png,image/jpeg,image/webp" hidden><b>Bring her render here</b> <span class="muted">(the one Prompt 2 made) or drop it here</span></label><div id="gaOut"></div>' +
            '<div class="row"><label class="ga-check"><input type="checkbox" id="gaBulb" checked> Her antenna bulb shows</label><button type="button" class="primary" id="gaSave" disabled>Add it to her looks</button></div></div>' +
          '<div class="ct" data-ct="marley" hidden>' + prof('marley') +
          '<p class="muted">Her two renders of a look, from her flat-green seated template: one in its own colours, one with the hat and the charm painted flat cyan (the prompts: Missing above, or a gap in the Overview matrix). Your browser cuts her hat (the cyan above her collar) and her charm (the cyan below it), and shows her wearing them, in their own colours and in a sample Note\'s, before you add them.</p>' +
          '<div class="row"><label class="f"><span>Which look</span><select id="mlLook"><option value="">Pick the look…</option>' + list.filter(function (l) { return !l.marley && l.from; }).map(function (l) { return '<option value="' + esc(l.name) + '">' + esc(l.name.replace(/-/g, ' ')) + (l.from ? ' (' + esc(l.from + ' to ' + l.to) + ')' : '') + '</option>'; }).join('') +
            '<option value="__new">A new look of hers…</option>' + list.filter(function (l) { return l.marley; }).map(function (l) { return '<option value="' + esc(l.name) + '">' + esc(l.name.replace(/-/g, ' ')) + ' (replace hers)</option>'; }).join('') + '</select></label>' +
            '<label class="f" id="mlNewF" hidden><span>Its name</span><input id="mlName" placeholder="e.g. ski-day" maxlength="40"></label></div>' +
          '<div class="grid2"><label class="drop" id="mlOwnD"><input type="file" id="mlOwn" accept="image/png,image/jpeg,image/webp" hidden><b>Her own colours</b> <span class="muted">or drop it here</span></label>' +
            '<label class="drop" id="mlCyD"><input type="file" id="mlCy" accept="image/png,image/jpeg,image/webp" hidden><b>The cyan one</b> <span class="muted">hat and charm painted cyan</span></label></div>' +
          '<div id="mlOut"></div><div class="row"><button type="button" class="primary" id="mlSave" disabled>Add it to her looks</button></div>' +
          '</div>' +
          // A.L.T.A.: a scene behind her tank (her template with the place green; only the strip above her ledge shows)
          '<div class="ct" data-ct="alta" hidden>' + prof('alta') +
            '<div class="row"><label class="f"><span>Which scene</span><select id="alWhich"><option value="">A new scene</option>' + (J.tankBackdrops || []).map(function (b) { return '<option value="' + esc(b.name) + '">' + esc(b.name.replace(/-/g, ' ')) + ' (replace hers)</option>'; }).join('') + '</select></label></div>' +
            '<div class="grid2">' + field('Name', '<input id="alName" placeholder="e.g. boathouse-night" maxlength="40">', 'Lowercase, with dashes') + field('Give it to', '<select id="alCat"><option value="">No category yet</option>' + Object.keys(cats).sort().map(function (c) { return '<option value="' + esc(c) + '">' + esc(catName(c)) + '</option>'; }).join('') + '</select>') + '</div>' +
            field('The place', '<textarea id="alScene" rows="2" placeholder="e.g. ' + esc(TANK_SCENES['lake-tahoe']) + '"></textarea>', 'Picking a category fills in a suggestion') +
            '<div class="row"><select id="alWay"><option value="edit">Edit her template (keeps the framing)</option><option value="new">A new picture from the prompt</option></select><button type="button" id="alPr">Copy the prompt</button><button type="button" id="alTpl">Copy her tank template</button><a href="/assets/alta/kit/tank-template.jpg?v=3" download>Download it</a></div>' +
            '<label class="drop ga-drop" id="alDrop"><input type="file" id="alFile" accept="image/png,image/jpeg,image/webp" hidden><b>Bring the render here</b> <span class="muted">or drop it here: you\'ll see her in front of it</span></label><div id="alOut"></div>' +
            '<div class="row"><button type="button" class="primary" id="alSave" disabled>Add the scene</button></div></div>';
      // what the target gives each character
      var show = function () {
        var o = $('#chOut'), t = CHV.t; if (!t) { o.innerHTML = ''; return; }
        var e = t.slice(0, 2) === 'n:' ? (ENTRIES || []).filter(function (x) { return x.id === t.slice(2); })[0] : null, cat = t.slice(0, 2) === 'c:' ? t.slice(2) : '';
        var note = e ? { look: e.look || undefined, backdrop: e.bd || undefined, tank: e.tank || undefined, narrator: e.nar || undefined, cats: e.cats || [], prefer: e.prefer || undefined, ignoreHolidays: !!e.noh, words: e.words || e.title, palette: e.pal, month: +(e.date || '').slice(5, 7) || 0 } : { cats: [cat], words: catName(cat) };
        var md = CHV.d, day = md ? new Date(new Date().getFullYear(), +md.slice(0, 2) - 1, +md.slice(3, 5)) : undefined;
        var p = GAResolve.pick(J, note, day), place = SCENES[cat || (note.cats || [])[0]] || TANK_SCENES[cat || (note.cats || [])[0]] || '';
        var tplace = TANK_SCENES[cat || (note.cats || [])[0]] || place;
        var bdOf = function (n) { return bds.filter(function (b) { return b.name === n; })[0]; };
        var why = function (x) { return x && x.why ? '<small>' + esc(x.why) + '</small>' : ''; };
        var row = function (label, f) { return '<tr><th>' + label + '</th>' + chars.map(f).join('') + '</tr>'; };
        o.innerHTML = '<div class="chm-wrap"><table class="chm chi"><thead>' + head + '</thead><tbody>' +
          row('Tells it', function (c) { return p.narrator.name === c.id ? '<td class="ok"><span>★ Narrates</span>' + why(p.narrator) + '</td>' : '<td class="na"></td>'; }) +
          row('Look', function (c) {
            if (c.pieces.indexOf('look') < 0) return '<td class="na">—</td>';
            var l = byName[p.look.name] || (p.look.name === 'curls' ? { name: 'curls' } : null);
            if (c.look.has === 'file') return hasLook(c, l) ? '<td class="ok">' + (l.file ? '<img alt="" src="' + lookSrc(l) + '">' : '') + '<span>' + esc(p.look.name) + '</span>' + why(p.look) + '</td>' : '<td class="gap"><span>' + esc(p.look.name) + '</span>' + why(p.look) + gapBtn(c, 'look', p.look.name) + '</td>';
            // the others wear a look only when it's a holiday's or one made for them; a cap stays GlazyArray's
            if (l && hasLook(c, l)) return '<td class="ok"><span>' + esc(l.name) + '</span>' + why(p.look) + '</td>';
            if (l && (l.from || l.marley)) return '<td class="gap"><span>' + esc(l.name) + '</span>' + why(p.look) + gapBtn(c, 'look', l.name) + '</td>';
            return '<td class="na"><span>Her own</span><small>' + esc(p.look.name) + ' is GlazyArray\'s</small></td>';
          }) +
          row('Backdrop', function (c) {
            if (c.pieces.indexOf('backdrop') < 0) return '<td class="na">—</td>';
            var b = p.backdrop && bdOf(p.backdrop.name);
            return b ? '<td class="ok"><img class="bd" alt="" src="' + bdSrc(b) + '"><span>' + esc(b.name) + '</span>' + why(p.backdrop) + '</td>' : '<td class="gap"><span>None</span>' + gapBtn(c, 'backdrop', '', place, 'The backdrop prompt') + '</td>';
          }) +
          row('Tank scene', function (c) {
            if (c.pieces.indexOf('tank') < 0) return '<td class="na">—</td>';
            if (p.tank) return '<td class="ok"><img class="bd" alt="" src="/assets/alta/backdrops/' + esc(p.tank.file) + '"><span>' + esc(p.tank.name) + '</span>' + why(p.tank) + '</td>';
            return '<td class="gap"><span>Her hall</span>' + gapBtn(c, 'tank', '', tplace, 'Her own: the prompt') + '</td>';
          }) +
          '</tbody></table></div>';
        wireGaps(o);
      };
      var wireGaps = function (root) {
        $$('button.chg', root).forEach(function (b) {
          b.onclick = function () {
            var c = chars.filter(function (x) { return x.id === b.getAttribute('data-c'); })[0], k = b.getAttribute('data-k'), n = b.getAttribute('data-n'), place = b.getAttribute('data-p');
            var l = byName[n] || { name: n }, P = c[k] || {}, text, how, tpl = P.template || '', title;
            if (k === 'backdrop') { text = GALook.bdPrompt(place || ''); how = 'Copy it with the backdrop template (Categories, Add a backdrop) into your image tool, and bring the render back there.'; tpl = GALook.BD_TEMPLATE; title = 'A backdrop'; }
            else { text = charPrompt(c, k, l, place); how = P.how || ''; title = c.name + '\'s ' + (k === 'tank' ? 'tank scene' : n.replace(/-/g, ' ')); }
            var pbox = (b.closest('.ct') || box).querySelector('.cprompt'); $$('.cprompt', box).forEach(function (x) { x.innerHTML = ''; });
            pbox.innerHTML = '<div class="sync-box"><p><b>' + esc(title) + '.</b> ' + esc(how) + '</p>' + field('The prompt', '<textarea id="chP" rows="10">' + esc(text) + '</textarea>', 'Change anything before you copy') +
              '<div class="row"><button type="button" id="chCopy">Copy the prompt</button>' + (tpl ? '<button type="button" id="chTpl">Copy the template</button><a href="' + esc(tpl) + '" download>Download the template</a>' : '') +
              (k === 'look' || k === 'tank' ? '<button type="button" id="chBi">Bring in ' + (c.id === 'marley' ? 'her renders' : 'her render') + '</button>' : '') + '</div></div>';
            $('#chCopy').onclick = function () { navigator.clipboard.writeText($('#chP').value).then(function () { toast('Prompt copied.'); }); };
            if ($('#chTpl')) $('#chTpl').onclick = function () { GALook.copyImage(tpl).then(function () { toast('The template is on the clipboard.'); }, function (err) { toast(err.message, true); }); };
            if ($('#chBi')) $('#chBi').onclick = function () {
              var pick = function (id) { var sel = $(id); if (sel && [].some.call(sel.options, function (o) { return o.value === n; })) { sel.value = n; sel.onchange(); } };
              if (c.id === 'glazyarray') openBi('glazyarray', function () { pick('#gaLook'); });
              else if (c.id === 'marley') openBi('marley', function () { pick('#mlLook'); });
              else openBi(c.id, function () { if (place && !$('#alScene').value.trim()) $('#alScene').value = place; });
            };
            if (window.easeScroll && pbox.getBoundingClientRect().top > innerHeight - 120) easeScroll.to(pbox);
          };
        });
      };
      // Bring in a look for Robot Marley: both renders in, cut here (studio/assets/marleycut.js), seen on her, added
      var ML = { own: null, cy: null, cut: null }, mlLook = $('#mlLook');
      var mlShow = function () { $('#mlNewF').hidden = mlLook.value !== '__new'; };
      mlLook.onchange = mlShow; if (PREFILL_ML && [].some.call(mlLook.options, function (o) { return o.value === PREFILL_ML; })) mlLook.value = PREFILL_ML; PREFILL_ML = null; mlShow();
      var mlCut = function () {
        $('#mlSave').disabled = true; ML.cut = null;
        if (!ML.own || !ML.cy) { $('#mlOut').innerHTML = '<p class="muted">' + (ML.own ? 'Now the cyan one.' : ML.cy ? 'Now the one in its own colours.' : '') + '</p>'; return; }
        $('#mlOut').innerHTML = '<p class="muted">Cutting…</p>';
        MarleyCut.cut(ML.own, ML.cy).then(function (res) {
          ML.cut = res; var o = $('#mlOut'); o.innerHTML = '<div class="ml-prev"></div>' + (res.warn.length ? '<p class="warn">' + res.warn.map(esc).join('<br>') + '</p>' : '');
          res.previews.forEach(function (c) { c.className = 'ml-cv'; o.firstChild.appendChild(c); });
          $('#mlSave').disabled = !(res.hat && res.charm);
        }).catch(function (err) { $('#mlOut').innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
      };
      [['mlOwn', 'mlOwnD', 'own'], ['mlCy', 'mlCyD', 'cy']].forEach(function (d) {
        var take = function (f) { if (!f) return; ML[d[2]] = f; $('#' + d[1] + ' b').textContent = (d[2] === 'own' ? 'Her own colours: ' : 'The cyan one: ') + f.name; mlCut(); };
        $('#' + d[0]).onchange = function () { take(this.files[0]); this.value = ''; };
        var dz = $('#' + d[1]); ['dragover', 'dragenter'].forEach(function (t) { dz.addEventListener(t, function (ev) { ev.preventDefault(); }); });
        dz.addEventListener('drop', function (ev) { ev.preventDefault(); take(ev.dataTransfer.files[0]); });
      });
      $('#mlSave').onclick = function () {
        var name = mlLook.value === '__new' ? slug($('#mlName').value).slice(0, 40) : mlLook.value, b = this, res = ML.cut;
        if (!name) { toast(mlLook.value === '__new' ? 'Give the look a name.' : 'Pick which look this is.', true); return; }
        if (byName[name] && byName[name].marley && !confirm('Robot Marley already has her ' + name.replace(/-/g, ' ') + ' look. Replace it with this one?')) return;
        // her pieces' file names: the look's letters, kept clear of the hats and charms she already has (js/marley.js)
        var key = name.replace(/[^a-z0-9]/g, '').slice(0, 20) || 'look', TAKEN = ['halloween', 'winter', 'stpatricks', 'hawaii', 'beanie', 'bone', 'heart', 'paw', 'star', 'pinecone', 'ball', 'bike', 'leaf', 'broom', 'snowglobe', 'clover', 'lei', 'wintercone'];
        var mine = (byName[name] && typeof byName[name].marley === 'object') ? byName[name].marley : null;
        var hk = mine ? mine.hat : TAKEN.indexOf(key) >= 0 ? key + '2' : key, ck = mine ? mine.charm : TAKEN.indexOf(key) >= 0 ? key + '2' : key;
        b.disabled = true; b.textContent = 'Uploading her pieces…';
        var up = function (p) { return Promise.all([api('lookblob', p.own), api('lookblob', p.dye), api('lookblob', p.mask)]).then(function (r) { return { ext: p.ext, box: p.box, own: r[0].sha, dye: r[1].sha, mask: r[2].sha }; }); };
        Promise.all([up(res.hat), up(res.charm)]).then(function (pp) {
          pp[0].key = hk; pp[1].key = ck; b.textContent = 'Saving…';
          return api('looks', { marleyLook: { name: name, hat: pp[0], charm: pp[1] } });
        }).then(function () { LOOKS = null; toast('Robot Marley\'s ' + name.replace(/-/g, ' ') + ' is added. The site updates in about a minute.'); renderChars(); })
          .catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Add it to her looks'; });
      };
      // Bring in a piece: who it's for (the chips), each character's box
      var ctShow = function (who) {
        CHV.ct = who;
        $$('.ct-tabs [data-ct]', box).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-ct') === who); b.setAttribute('aria-selected', b.getAttribute('data-ct') === who); });
        $$('.ct[data-ct]', box).forEach(function (d) { d.hidden = d.getAttribute('data-ct') !== who; });
        var pd = $('.ct[data-ct="' + who + '"] .cpool', box); if (pd) renderPool(pd, pd.getAttribute('data-k'));   // GlazyArray and Robot Marley share one pool
      };
      $$('.ct-tabs [data-ct]', box).forEach(function (b) { b.onclick = function () { ctShow(b.getAttribute('data-ct')); }; });
      ctShow(CHV.ct || 'overview');
      openBi = function (who, set) { ctShow(who); if (set) set(); var h = $('#bi-' + who); if (h && window.easeScroll) easeScroll.to(h); };

      [['glazyarray', 'bd'], ['marley', 'bd'], ['alta', 'tank']].forEach(function (w) {   // each character's category pools (renderPool)
        var sec = $('.ct[data-ct="' + w[0] + '"]', box); if (!sec) return;
        var d = document.createElement('div'); d.className = 'cpool'; d.setAttribute('data-k', w[1]); sec.appendChild(d); renderPool(d, w[1]);
      });
      // GlazyArray's: the render keyed and her face put back (look.js GALook.make), her flair picked, added as a look
      var GA = { rec: null }, gaLook = $('#gaLook'), gaChar = chars.filter(function (c) { return c.id === 'glazyarray'; })[0];
      var gaName = function () { return gaLook.value === '__new' ? slug($('#gaName').value).slice(0, 40) : gaLook.value; };
      gaLook.onchange = function () { $('#gaNewF').hidden = gaLook.value !== '__new'; var l = byName[gaLook.value]; if (l && !$('#gaAbout').value.trim()) $('#gaAbout').value = l.about || ''; };
      $('#gaPr').onclick = function () {
        var n = gaName(); if (!n || !gaChar) { toast('Pick the look first.', true); return; }
        var l = byName[n] || { name: n, about: $('#gaAbout').value.trim() };
        navigator.clipboard.writeText(charPrompt(gaChar, 'look', l)).then(function () { toast('Her two prompts are copied.'); });
      };
      $('#gaTpl').onclick = function () { GALook.copyTemplate().then(function () { toast('Her template is on the clipboard.'); }, function (e) { toast(e.message, true); }); };
      var gaTake = function (f) {
        if (!f) return; $('#gaOut').innerHTML = '<p class="muted">Working…</p>'; $('#gaSave').disabled = true;
        GALook.make(f).then(function (r) {
          GA.rec = r; var o = $('#gaOut'); o.innerHTML = r.warn ? '<p class="warn">' + esc(r.warn) + '</p>' : ''; r.preview.className = 'ga-prev'; o.appendChild(r.preview); o.appendChild(flairBox(r, PAL_SAMPLE));
          $('#gaSave').disabled = false; $('#gaDrop b').textContent = 'Choose a different render';
        }).catch(function (e) { $('#gaOut').innerHTML = ''; toast(e.message, true); });
      };
      $('#gaFile').onchange = function () { gaTake(this.files[0]); this.value = ''; };
      var gd = $('#gaDrop'); ['dragover', 'dragenter'].forEach(function (t) { gd.addEventListener(t, function (ev) { ev.preventDefault(); }); });
      gd.addEventListener('drop', function (ev) { ev.preventDefault(); gaTake(ev.dataTransfer.files[0]); });
      $('#gaSave').onclick = function () {
        var n = gaName(), b = this, about = $('#gaAbout').value.trim();
        if (!n) { toast(gaLook.value === '__new' ? 'Give the look a name.' : 'Pick which look this is.', true); return; }
        if (n === 'curls' || list.some(function (l) { return l.name === n && (l.to || l.rotate); })) { toast('That name is taken by one of her holiday looks or hair styles.', true); return; }
        if (list.some(function (l) { return l.name === n && l.file; }) && !confirm('GlazyArray already has her ' + n.replace(/-/g, ' ') + ' look. Replace it with this one?')) return;
        b.disabled = true; b.textContent = 'Adding…';
        var sha = null;
        api('lookblob', GA.rec.blob).then(function (r) { sha = r.sha; return flairUp(GA.rec); }).then(function (f) {
          return api('looks', { newLook: { name: n, ext: GA.rec.ext, sha: sha, about: about, bulb: $('#gaBulb').checked, flair: f } });
        }).then(function () { GA.rec = null; LOOKS = null; toast('GlazyArray\'s ' + n.replace(/-/g, ' ') + ' is added. The site updates in about a minute.'); renderChars(); })
          .catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Add it to her looks'; });
      };
      // A.L.T.A.'s: a scene for her tank, cropped to her frame and shown with her in front (tankImage), added
      var AL = { rec: null }, alScene = $('#alScene');
      var alPrompt = function () { return tankPrompt(alScene.value.trim() || TANK_SCENES[$('#alCat').value] || SCENES[$('#alCat').value] || '', $('#alWay').value); };
      $('#alWhich').onchange = function () { var b2 = (J.tankBackdrops || []).filter(function (x) { return x.name === this.value; }, this)[0]; if (b2) { $('#alName').value = b2.name; alScene.value = b2.scene || ''; } else { $('#alName').value = ''; } };
      $('#alCat').onchange = function () { var c = this.value, sc = TANK_SCENES[c] || SCENES[c]; if (!alScene.value.trim() && sc) alScene.value = sc; if (!$('#alName').value.trim() && c) $('#alName').value = c + '-tank'; };
      $('#alPr').onclick = function () { navigator.clipboard.writeText(alPrompt()).then(function () { toast('Her prompt is copied.'); }); };
      $('#alTpl').onclick = function () { GALook.copyImage('/assets/alta/kit/tank-template.jpg?v=3').then(function () { toast('Her tank template is on the clipboard.'); }, function (e) { toast(e.message, true); }); };
      var alTake = function (f) {
        if (!f) return; $('#alOut').innerHTML = '<p class="muted">Working…</p>'; $('#alSave').disabled = true;
        tankImage(f).then(function (res) { AL.rec = res; $('#alSave').disabled = !tankShow($('#alOut'), res); })
          .catch(function (e) { $('#alOut').innerHTML = '<p class="warn">That picture didn\'t open: ' + esc(e.message) + '</p>'; toast(e.message, true); });
      };
      $('#alFile').onchange = function () { alTake(this.files[0]); this.value = ''; };
      var ad = $('#alDrop'); ['dragover', 'dragenter'].forEach(function (t) { ad.addEventListener(t, function (ev) { ev.preventDefault(); }); });
      ad.addEventListener('drop', function (ev) { ev.preventDefault(); alTake(ev.dataTransfer.files[0]); });
      $('#alSave').onclick = function () {
        var n = slug($('#alName').value).slice(0, 40), cat = $('#alCat').value, b = this, tks = J.tankBackdrops || [];
        if (!n) { toast('Give the scene a name.', true); return; }
        if (tks.some(function (x) { return x.name === n; }) && !confirm(n + ' already exists. Replace its image with this one?')) return;
        b.disabled = true; b.textContent = 'Adding…';
        api('lookblob', AL.rec.blob).then(function (r) {
          var ct = {}; if (cat) ct[cat] = n;
          return api('looks', { newTank: { name: n, ext: AL.rec.ext, sha: r.sha, scene: alScene.value.trim(), colors: AL.rec.colors }, categoryTanks: cat ? ct : null });
        }).then(function () { AL.rec = null; LOOKS = null; toast(n + ' is added behind her tank. The site updates in about a minute.'); renderChars(); })
          .catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Add the scene'; });
      };
      wireGaps(box);
      // What's needed: its colour swatches and maps, Show all, Open its pool, the descriptions
      $$('canvas.swatch', box).forEach(function (cv) { var g = cv.getContext('2d'); (cv.getAttribute('data-cols') || '').split(' ').filter(Boolean).forEach(function (c, i) { g.fillStyle = c; g.fillRect(i * 14 + 1, 1, 12, 12); }); });
      $$('canvas.nspec', box).forEach(function (cv) {
        var K = KINDS[cv.getAttribute('data-k') === 'tank' ? 1 : 0], g = cv.getContext('2d'), W = cv.width, H = cv.height, mini = cv.getAttribute('data-mini');
        var bg = g.createLinearGradient(0, 0, W, 0); for (var h = 0; h <= 360; h += 30) bg.addColorStop(h / 360, 'hsl(' + h + ',45%,92%)'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        var at = function (c) { var x = hex2hsl(c); return [x[1] < 0.15 ? W - 6 : x[0] / 360 * (W - 14) + 4, 4 + x[2] * (H - 8)]; };   // greys sit at the right edge
        K.lib.forEach(function (b) { (b.colors || []).forEach(function (c) { var p = at(c); g.beginPath(); g.arc(p[0], p[1], mini ? 3 : 4.5, 0, 7); g.fillStyle = c; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke(); }); });
        if (!mini) (ENTRIES || []).forEach(function (e) { (e.pal || []).filter(function (c) { return /^#[0-9a-f]{6}$/i.test(c); }).forEach(function (c) { var p = at(c); g.beginPath(); g.arc(p[0], p[1], 7, 0, 7); g.lineWidth = 2.5; g.strokeStyle = c; g.stroke(); g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(p[0], p[1], 8.5, 0, 7); g.stroke(); }); });
      });
      var nda = $('#ndAll', box); if (nda) nda.onclick = function () { CHV.allNeeds = !CHV.allNeeds; renderChars(); };
      $$('[data-openpool]', box).forEach(function (b) { b.onclick = function () {
        var v = b.getAttribute('data-openpool').split(':'); POOLV.who = v[0]; POOLV[v[0]] = v[1]; POOLV.to = null; showList('categories');
        var tries = 0, go = function () { var el = $('#catPool'); if (el && el.querySelector('.pcat')) { if (window.easeScroll) easeScroll.to(el); } else if (tries++ < 40) setTimeout(go, 150); }; setTimeout(go, 150);
      }; });
      $$('input[data-desc]', box).forEach(function (inp) { inp.oninput = function () {
        var k = inp.getAttribute('data-desc'); if (inp.value.trim()) DESCP[k] = inp.value; else delete DESCP[k];
        var li = inp.closest('li'), sb = li && $('.nd-save', li); if (sb) sb.disabled = !$$('input[data-desc]', li).some(function (x) { return x.value.trim(); });
      }; });
      $$('.nd-save', box).forEach(function (b) { b.onclick = function () {
        var k = b.getAttribute('data-k'), li = b.closest('li'), edits = $$('input[data-desc]', li).filter(function (x) { return x.value.trim(); }).map(function (x) { return { kind: k, name: x.getAttribute('data-desc').split(':')[1], scene: x.value.trim() }; });
        if (!edits.length) return; b.disabled = true; b.textContent = 'Saving…';
        api('looks', { sceneEdits: edits }).then(function () {
          var lib = k === 'tank' ? J.tankBackdrops : J.backdrops; edits.forEach(function (x) { var im = lib.filter(function (y) { return y.name === x.name; })[0]; if (im) im.scene = x.scene; delete DESCP[k + ':' + x.name]; });
          toast(edits.length + ' description' + (edits.length === 1 ? '' : 's') + ' saved. The site updates in about a minute.'); renderChars();
        }).catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Save the descriptions'; });
      }; });
      var ct = $('#chT'), cd = $('#chD'); ct.value = CHV.t; cd.value = CHV.d;
      ct.onchange = function () { CHV.t = ct.value; $('#chPrompt').innerHTML = ''; show(); };
      cd.onchange = function () { CHV.d = cd.value; show(); };
      show();
    }).catch(function (err) { box.innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
  }

  // ---------- Google Drive: new files come to the server with rclone (one way, never deletes) ----------
  var drivePoll = null, lastDrive = null, ENTRIES = null, INBOX = null, INBOX_PAGE = 1, INBOX_PER = 8;
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
    driveHint(j);
    var names = j.folders.map(function (f) { return '“' + esc(f) + '”'; }).join(', ');
    var line;
    if (j.running) line = 'Bringing in new files… ' + esc(j.progress || 'starting') + (j.copiedCount ? ' · ' + j.copiedCount + ' copied so far' : '');
    else if (j.finished) line = (j.ok ? 'Last brought in ' : 'Last try stopped with a problem, ') + esc(when(j.finished)) + (j.ok ? ' · ' + (j.copiedCount ? j.copiedCount + ' new file' + (j.copiedCount === 1 ? '' : 's') : 'nothing new') : '');
    else line = 'Not brought in yet.';
    // folders, plus loose files only once they belong to a note (the rest is left for tidying in Drive)
    var items = j.inbox.filter(function (f) { return f.dir || f.note; });
    var pages = Math.max(1, Math.ceil(items.length / INBOX_PER)); INBOX_PAGE = Math.min(INBOX_PAGE, pages);
    var inbox = items.length ? '<ul class="inbox">' + items.slice((INBOX_PAGE - 1) * INBOX_PER, INBOX_PAGE * INBOX_PER).map(inboxRow).join('') + '</ul><nav class="pager" id="inboxPg" aria-label="Pages of the Drive inbox" hidden></nav>' : '';
    d.innerHTML = '<div class="drive-head"><div><h2>Google Drive</h2><p class="muted">Watching ' + names + '. New files are copied to the server; nothing is deleted on either side.</p></div>' +
      '<button id="driveGo" class="primary"' + (j.running || !j.ready ? ' disabled' : '') + '>' + (j.running ? 'Bringing in…' : 'Bring in from Drive') + '</button></div>' +
      (j.problem ? '<p class="err">' + esc(j.problem) + '</p>' : '<p class="drive-line">' + line + '</p>') +
      (j.errors.length ? '<p class="err">' + j.errors.map(esc).join('<br>') + '</p>' : '') +
      // why the last try stopped (lib/drive.php status): rclone's exit code in words, the fix for an expired Drive
      // login, and rclone's last lines when no error line says more
      (j.why ? '<p class="drive-why">What it means: ' + esc(j.why) + '.</p>' : '') +
      (j.reconnect ? '<p class="drive-why">The Drive login looks expired. Over SSH, run <code>~/bin/rclone config reconnect ' + esc((j.remote || 'gdrive') + ':') + '</code> and sign in again, then bring in again.</p>' : '') +
      ((j.lastLines || []).length ? '<details class="drive-last"><summary>rclone\'s last words</summary><pre>' + j.lastLines.map(esc).join('\n') + '</pre></details>' : '') + inbox +
      ((j.ignored || []).length && owner() ? '<details class="ignored"><summary>Ignored (' + j.ignored.length + ')</summary><ul>' + j.ignored.map(function (x) {
        return '<li>' + esc(x.source) + ' <small>' + esc(when(x.at)) + (x.dropped ? ' · server copy deleted' : '') + '</small> <button class="link unignore" data-src="' + esc(x.source) + '">Restore</button></li>'; }).join('') + '</ul></details>' : '');
    pager($('#inboxPg'), INBOX_PAGE, pages, function (p) { INBOX_PAGE = p; renderDrive(lastDrive); toTop($('#drive .inbox')); });
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

  // on the Notes tab, one line when Drive has something to do: bringing in now, a problem, or folders not yet made
  // into notes and new files for notes already made; it opens the Drive tab
  function driveHint(j) {
    var h = $('#driveHint'); if (!h) return;
    if ($('#drive') && !$('#drive').hidden) { h.hidden = true; return; }
    var items = ENTRIES ? (j.inbox || []).filter(function (f) { return f.dir || f.note; }) : [];   // (until the notes are in, every folder would look new)
    var fresh = items.filter(function (f) { return !noteFor(f); }).length, more = items.filter(function (f) { return noteFor(f) && f.since; }).length;
    var say = j.running ? 'Bringing in new files from Google Drive…' : j.problem || (j.errors || []).length ? 'Google Drive: the last try had a problem.' :
      fresh || more ? 'Google Drive: ' + [fresh ? fresh + ' new folder' + (fresh === 1 ? '' : 's') + ' to make into notes' : '', more ? more + ' note' + (more === 1 ? '' : 's') + ' with new files' : ''].filter(Boolean).join(' and ') + '.' : '';
    h.hidden = !say;
    h.innerHTML = say ? esc(say) + ' <button type="button" class="link" id="driveHintGo">Open Drive</button>' : '';
    var b = $('#driveHintGo'); if (b) b.onclick = function () { showList('drive'); };
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
      // matched only by its date (no note was made from this folder): it may well be a different day out
      // that shares the date, so it can also start a note of its own
      act = (!f.note ? '<button class="process" data-src="' + esc(f.source) + '">Process as a new note</button>' : '') +
        '<button class="link open" data-id="' + esc(note.id) + '">Open “' + esc(note.title || note.id) + '”</button>' +
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
      INBOX = j; dirty = false; fresh = {}; removed = []; audioNew = null; audioGone = false; DRIVEAUD = null; DRIVETRK = null; trackRaw = null; trackSwap = false; clipsNew = {}; posterNew = {}; DRIVEVID = null; UPVID = []; stopTrim();
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
    dirty = false; fresh = {}; removed = []; audioNew = null; audioGone = false; DRIVEAUD = null; DRIVETRK = null; trackRaw = null; trackSwap = false; clipsNew = {}; posterNew = {}; DRIVEVID = null; UPVID = []; stopTrim();
    REVIEW = null; LIVE = null; BASE = { version: { live: null, review: null }, entry: null }; staleClose();
    if (!id) { E = blank(); savedStatus = null; route('new'); render(); return Promise.resolve(); }
    app.innerHTML = '<p class="muted">Opening…</p>';
    return api('entry', null, '&id=' + encodeURIComponent(id)).then(function (j) {
      E = j.entry; savedStatus = E.status; REVIEW = j.review || null; LIVE = j.live || null; E.post = E.post || { title: '', body: '' }; E.episode = E.episode || { title: '', script: '', audio: null }; E.questions = E.questions || []; E.photos = E.photos || [];
      BASE = { version: j.version || { live: null, review: null }, entry: clone(E) };
      route('note/' + id); render();
    }).catch(function (err) { toast(err.message, true); showList(); });
  }

  // a section of the editor that folds: open or closed by the note's stage, unless you've toggled it on this note
  var FOLD = {};
  function fold(key, title, hint, open, inner) {
    var mine = (FOLD[E.id || '_new'] || {})[key];
    return '<details class="panel fold" data-fold="' + key + '" id="f-' + key + '"' + ((mine == null ? open : mine) ? ' open' : '') + '><summary><h2>' + esc(title) + '</h2>' +
      (hint ? '<small>' + esc(hint) + '</small>' : '') + '</summary><div class="fold-in">' + inner + '</div></details>';
  }
  function field(label, html, hint) { return '<label class="f"><span>' + label + '</span>' + html + (hint ? '<small>' + hint + '</small>' : '') + '</label>'; }
  // the Narrator style panel's line: who tells this Note, and (when it's GlazyArray) her cap and backdrop
  function lookHint(who) {
    var gl = [E.narratorLook ? E.narratorLook.look : '', E.narratorBackdrop ? E.narratorBackdrop.backdrop : ''].filter(Boolean).join(' · ') || 'from her categories or the holiday';
    return !who || who === 'glazyarray' ? 'GlazyArray · ' + gl : (NAR_NAME[who] || who) + ' tells it';
  }
  function render() {
    // a note made from a Drive folder, or already saved, has its content: the drop zones wait at the bottom
    var later = !!(E.id || E.source), trackTop = !later || !!E.track;
    var dropPhotos = '<div id="drop-photos" class="drop">Drop photos or videos here, or <label class="pick">choose<input type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.mov,.m4v" multiple hidden id="pickPhotos"></label>. Photos are resized and their location data removed before upload; a video goes to Video loops, to trim a loop from.</div>';
    var kList = allKinds().concat(E.kind && !kindOf(E.kind) ? [{ id: E.kind, name: E.kind }] : []);   // an old kind not in the list stays picked
    var kOpts = kList.map(function (k) { return '<option value="' + esc(k.id) + '"' + (E.kind === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>'; }).join('');
    // The page follows the note's stage: what's needed now sits open near the top, the rest folds away (one
    // click opens it). Once the script is final, the audio prompt and the audio file come up under the summary;
    // the notes and Claude's drafting fold away unless questions are still open; once it's live, the parts that
    // are done fold too. Whatever you open or close stays that way for this note while you're here.
    var qs = (E.questions || []).length, hasScript = !!E.episode.script && !qs, isLive = savedStatus === 'published', isNew = !E.id && !E.source;
    var nPh = E.photos.filter(function (p) { return !p.video; }).length, nLoop = E.photos.length - nPh;
    var audioPanel = fold('audio', 'Episode audio', E.episode.audio ? 'attached' : hasScript ? 'next: record it' : '', hasScript,
      '<div class="row"><button id="copyPrompt" class="primary">Copy the audio prompt</button><span class="muted">Paste it into your voice tool, then drop the file here.</span></div><div id="audio"></div><div id="driveFiles"></div>');
    app.innerHTML =
      '<section class="panel sum" id="sum"><div class="sum-top"><button class="back" id="back">← Entries</button><h1 id="sumTitle">' + esc(E.title || 'New entry') + '</h1><span id="sumLive"></span></div>' +
        '<div class="sum-meta" id="sumMeta"></div><ol class="stages" id="stages"></ol>' +
        '<div class="sum-next" id="next" aria-live="polite"></div><div class="sum-left" id="left"></div>' + inboxHint() + '<div id="revBar"></div></section>' +
      (hasScript ? audioPanel : '') +
      fold('details', 'Details', [E.date, E.kind && kindName(E.kind), E.place].filter(Boolean).join(' · '), isNew || !E.post.body, '<div class="grid2">' +
        field('Title', '<input id="title" value="' + esc(E.title) + '">') +
        field('Date', '<input id="date" type="date" value="' + esc(E.date) + '"' + (E.id ? ' disabled' : '') + '>', E.id ? 'The address is <code>' + esc(E.id) + '</code>' : 'Sets the address with the title, on first save') +
        field('Kind', '<select id="kind">' + kOpts + '</select>', 'Rides and hikes carry a track; the rest match the magazine categories') +
        field('Place', '<input id="place" value="' + esc(E.place) + '" placeholder="Trailhead or public land, never closer to home">') +
        '<input type="hidden" id="status" value="' + esc(E.status) + '">' +
        field('Who appears', '<input id="consent" value="' + esc(E.consent || '') + '" placeholder="e.g. Christian and Marley only">') +
      '</div>') +
      fold('drafting', 'Notes and drafting', qs ? qs + ' open question' + (qs > 1 ? 's' : '') : hasScript ? 'done' : '', !hasScript || qs > 0,
        '<h3>Your notes</h3><div id="voiceNotes"></div>' + field('', '<textarea id="fieldNotes" rows="8" placeholder="What happened, in your words: who came, what you saw, what to leave out.">' + esc(E.fieldNotes) + '</textarea>') +
        '<div class="draft"><h3>Draft with Claude</h3><div class="row"><input id="instr" placeholder="Optional: e.g. shorter, or add the bit about the hammock"><button id="draft" class="primary">Draft with Claude</button></div>' +
        '<div id="questions"></div></div>') +
      fold('post', 'Post', E.post.title || '', !isLive, field('Card summary', '<textarea id="summary" rows="2">' + esc(E.summary) + '</textarea>') +
        field('Title', '<input id="postTitle" value="' + esc(E.post.title) + '">') + field('Text', '<textarea id="postBody" rows="14">' + esc(E.post.body) + '</textarea>', 'First person. A blank line between paragraphs. End with "What I learned: …" when there is something real.')) +
      fold('episode', 'Episode script', E.episode.title || '', !isLive, field('Title', '<input id="epTitle" value="' + esc(E.episode.title) + '">') +
        field('Narrator', '<select id="epNarrator"><option value="">From its categories</option><option value="glazyarray"' + (E.episode.narrator === 'glazyarray' ? ' selected' : '') + '>GlazyArray</option>' +
          '<option value="alta"' + (E.episode.narrator === 'alta' ? ' selected' : '') + '>A.L.T.A.</option>' +
          '<option value="marley"' + (E.episode.narrator === 'marley' ? ' selected' : '') + '>Robot Marley</option></select>', '<span id="epWho"></span>') +
        '<div id="epTankBox"></div>' + field('Script', '<textarea id="epScript" rows="16">' + esc(E.episode.script) + '</textarea>', '<span id="epCount"></span>')) +
      fold('look', 'Narrator style', lookHint(), false,
        '<div id="styleBox"></div><details class="ga-own" id="gaOwn"' + (gaOwnOpen() ? ' open' : '') + '><summary>Or give this Note its own cap or backdrop</summary>' +
        '<h3 class="ga-h">Her cap</h3><div id="lookBox"></div><h3 class="ga-h">The backdrop</h3><div id="bdBox"></div></details>') +
      (hasScript ? '' : audioPanel) +
      fold('photos', 'Photos', [nPh ? nPh + ' photo' + (nPh > 1 ? 's' : '') : '', nLoop ? nLoop + ' loop' + (nLoop > 1 ? 's' : '') : ''].filter(Boolean).join(' · '), !isLive,
        (later ? '' : dropPhotos) + '<p class="swapBar" id="swapBar" hidden></p><p class="muted" id="photoOrderHint">The post shows them in this order, top to bottom: ↑ and ↓ move one. Once the post has subheads ("## " lines), each can sit right under one.</p><div id="photos" class="photos"></div>' + (later ? '<p class="muted" id="noPhotos">No photos yet. Add some under Add more.</p>' : '')) +
      (E.id ? fold('social', 'Social', E.social && E.social.instagram ? 'captions written' : isLive ? 'next: share it' : 'Instagram and Facebook', false, '<div id="socialBox"></div>') : '') +
      (trackTop ? fold('track', 'Track', E.track ? 'on the map' : '', !isLive, '<div id="track"></div>') : '') +
      fold('loops', 'Video loops', '', false, '<div id="loopBox"></div>') +
      fold('magazine', 'Magazine template', magHint(), false, '<div id="magBox"></div>') +
      fold('spread', 'Photo spread', spreadHint(), false, '<div id="spreadBox"></div>') +
      fold('feature', 'Workshop feature', E.workshop ? (E.workshop.name || 'on the Workshop tab') : 'not a feature', false, '<div id="featBox"></div>') +
      (later ? fold('more', 'Add more', 'photos' + (trackTop ? '' : ', a track'), false, '<p class="muted">Only if you want to add to what\'s here.</p>' + (trackTop ? '' : '<h3>Track</h3><div id="track"></div>') + '<h3>Photos</h3>' + dropPhotos) : '') +
      '<footer class="savebar"><span id="saveState" class="muted">' + (E.id ? 'Saved' : 'Not saved yet') + '</span>' +
        '<button type="button" id="publish" class="pub"><span class="pub-t">Publish</span><small class="pub-n"></small></button><button id="save" class="primary">' + (owner() ? 'Save' : 'Save for review') + '</button></footer>';
    // remember what's opened or closed on this note
    $$('details.fold', app).forEach(function (d) { d.addEventListener('toggle', function () { (FOLD[E.id || '_new'] = FOLD[E.id || '_new'] || {})[d.getAttribute('data-fold')] = d.open; if (d.open) setTimeout(function () { dispatchEvent(new Event('resize')); }, 30); }); });   // a map drawn while folded needs to measure itself again

    // the Social panel is drawn from full-size photos, so only once it's opened
    var sf = $('#f-social');
    if (sf) { var socialOn = function () { if (!sf.open || sf._on) return; sf._on = true; StudioSocial.mount($('#socialBox'), socialHelpers); }; sf.addEventListener('toggle', socialOn); socialOn(); }
    $('#back').onclick = showList;
    ['title', 'place', 'consent', 'fieldNotes', 'summary', 'postTitle', 'postBody', 'epTitle', 'epScript'].forEach(function (k) { $('#' + k).addEventListener('input', markDirty); });
    ['kind', 'date'].forEach(function (k) { $('#' + k).addEventListener('change', markDirty); });
    $('#title').addEventListener('input', function () { $('#sumTitle').textContent = this.value.trim() || 'New entry'; });
    $('#epScript').addEventListener('input', count); count();
    SWAP = null; renderTrack(); renderPhotos(); renderSwapBar(); renderQuestions(); renderAudio(); renderLoops();
    driveAudio().then(function () { renderDriveFiles(); renderVoiceNotes(); renderNext(); });
    ['postBody', 'epScript', 'fieldNotes'].forEach(function (k) { $('#' + k).addEventListener('change', renderNext); });
    $('#postBody').addEventListener('change', renderFeature);   // the feature's "after paragraph" picks follow the paragraphs
    $('#postBody').addEventListener('change', function () { collect(); renderPhotos(); });    // the photos' "under a subhead" picks follow the subheads (and the template's checklist)
    $('#summary').addEventListener('change', renderMag);
    ['title', 'place', 'summary', 'postTitle', 'postBody', 'epTitle'].forEach(function (k) { $('#' + k).addEventListener('change', function () { collect(); renderStyle(); }); });   // suggested categories follow what it says
    renderNext();
    var dp = $('#drop-photos');
    ['dragover', 'dragenter'].forEach(function (t) { dp.addEventListener(t, function (ev) { ev.preventDefault(); dp.classList.add('on'); }); });
    dp.addEventListener('dragleave', function () { dp.classList.remove('on'); });
    dp.addEventListener('drop', function (ev) { ev.preventDefault(); dp.classList.remove('on'); addPhotos(ev.dataTransfer.files); });
    $('#pickPhotos').onchange = function () { addPhotos(this.files); this.value = ''; };
    $('#draft').onclick = function () { draft(); };
    LOOKREPL = false; if (BDNEW === 'replace') BDNEW = null;
    renderLook(); renderBd();
    $('#save').onclick = save;
    $('#publish').onclick = publish;
    // who tells it: its own choice, else its categories' (the site's one rule), shown under the picker; her voice prompt follows
    var who = function () {
      return renderLookData().then(function (r) { var p = window.GAResolve && GAResolve.pick(r[3], { narrator: E.episode.narrator, cats: noteCats() }); return p ? p.narrator : { name: E.episode.narrator || 'glazyarray', why: '' }; });
    };
    var whoNow = NARNOW = E.episode.narrator || 'glazyarray';
    var showWho = function () { who().then(function (n) { whoNow = NARNOW = n.name; var w = $('#epWho'); var lh = document.querySelector('#f-look > summary small'); if (lh) lh.textContent = lookHint(n.name); if (w) w.textContent = (NAR_NAME[n.name] || 'GlazyArray') + ' tells it' + (n.why ? ' (' + n.why + ')' : '') + '. The audio prompt is in their voice.'; }); };
    $('#epNarrator').onchange = function () { collect(); markDirty(); showWho(); };
    // the scene behind A.L.T.A.'s tank, when she tells it and there are scenes to pick from (looks.json tankBackdrops)
    var showTank = function () {
      Promise.all([renderLookData(), who()]).then(function (rr) {
        var r = rr[0];
        var J = r[3] || {}, tanks = J.tankBackdrops || [], b = $('#epTankBox'); if (!b) return;
        if (rr[1].name !== 'alta') { b.innerHTML = ''; return; }
        var Bk = E.narratorBackdrop && E.narratorBackdrop.backdrop;
        var nf = noteFit(), p = window.GAResolve && GAResolve.pick(J, { tank: E.altaBackdrop, cats: noteCats(), backdrop: Bk || undefined, ignoreHolidays: !!E.ignoreHolidays, words: nf.words, palette: nf.palette, month: nf.month }), t = p && p.tank;
        if (!tanks.length) { b.innerHTML = '<p class="muted">Behind her tank: her hall. Her own scenes are made in Characters, A.L.T.A.</p>'; return; }
        var np = notePool(J, 'tank'), pinned = !!E.altaBackdrop, nc = noteCats(), AT = TANKNEW;
        b.innerHTML = '<h3 class="ga-h">Behind her tank</h3>' + (np.length ? '<p class="muted"><b>From its categories\' pools</b> (' + np.length + '): ' + (pinned ? 'this Note keeps the one you picked.' : 'it shows the one that fits its words and colours best.') + ' Pick one to keep it on this Note.</p>' +
            poolGrid(np, t ? t.name : '', t && t.from === 'category' ? (t.why || '').replace(/^from [^,]*,? ?/, '').replace(/^fits /, '') || 'the only one' : '', true) +
            (pinned ? '<div class="row"><button type="button" id="epTankLet">Let it choose again</button></div>' : '') : '<p class="muted">Its categories\' pools have none of her scenes yet.</p>') +
          field('Or any of her scenes', '<select id="epTank"><option value="">From its categories</option>' + tanks.map(function (x) { return '<option value="' + esc(x.name) + '"' + (E.altaBackdrop === x.name ? ' selected' : '') + '>' + esc(x.name + (x.about ? ' · ' + x.about : '')) + '</option>'; }).join('') + '</select>',
            t ? esc(t.name) + ' (' + esc(t.why) + ')' : 'The hall, her own (no scene of hers fits)') +
          (owner() ? '<details class="ga-new"' + (AT ? ' open' : '') + '><summary>+ A new scene for this Note</summary><p class="muted">It\'s picked for this Note, and joins the pools of the categories you tick.</p>' + imgCatsHtml('tank') +
            '<div class="grid2">' + field('Name', '<input id="ntnName" maxlength="40" placeholder="e.g. sumo-snow-pitch">', 'Lowercase, with dashes') + field('The place', '<input id="ntnScene" maxlength="200" placeholder="e.g. a snowy soccer pitch with sumo wrestlers">', 'Goes in the prompt, and helps Notes choose it') + '</div>' +
            '<div class="row"><button type="button" id="ntnPr">Copy the prompt</button><button type="button" id="ntnTpl">Copy her tank template</button></div>' +
            '<label class="drop ga-drop" id="ntnDrop"><input type="file" id="ntnFile" accept="image/png,image/jpeg,image/webp" hidden><b>Bring the render here</b> <span class="muted">or drop it here</span></label><div id="ntnOut"></div>' +
            '<div class="row"><button type="button" class="primary" id="ntnAdd" disabled>Add it and use it here</button></div></details>' : '');
        $('#epTank').onchange = function () { if (this.value) E.altaBackdrop = this.value; else delete E.altaBackdrop; markDirty(); showTank(); };
        $$('[data-np]', b).forEach(function (el) { el.onclick = function () { E.altaBackdrop = el.getAttribute('data-np'); markDirty(); showTank(); }; });
        var tl = $('#epTankLet'); if (tl) tl.onclick = function () { delete E.altaBackdrop; markDirty(); showTank(); };
        if (!$('#ntnAdd')) return;
        imgCatsWire(b, 'tank', showTank);
        var nn = $('#ntnName'), ns = $('#ntnScene'); if (AT) { nn.value = AT.name || ''; ns.value = AT.scene || ''; }
        nn.oninput = function () { TANKNEW = TANKNEW || {}; TANKNEW.name = slug(nn.value).slice(0, 40); };
        ns.oninput = function () { TANKNEW = TANKNEW || {}; TANKNEW.scene = ns.value; };
        $('#ntnPr').onclick = function () { navigator.clipboard.writeText(tankPrompt(ns.value.trim(), 'edit')).then(function () { toast('Her prompt is copied.'); }); };
        $('#ntnTpl').onclick = function () { GALook.copyImage('/assets/alta/kit/tank-template.jpg?v=3').then(function () { toast('Her tank template is on the clipboard.'); }, function (e) { toast(e.message, true); }); };
        var ntake = function (f) {
          if (!f) return; $('#ntnOut').innerHTML = '<p class="muted">Working…</p>';
          tankImage(f).then(function (res) { TANKNEW = Object.assign(TANKNEW || {}, { rec: res, name: slug(nn.value).slice(0, 40), scene: ns.value }); $('#ntnAdd').disabled = !tankShow($('#ntnOut'), res); })
            .catch(function (e) { $('#ntnOut').innerHTML = ''; toast(e.message, true); });
        };
        $('#ntnFile').onchange = function () { ntake(this.files[0]); this.value = ''; };
        var nd = $('#ntnDrop'); ['dragover', 'dragenter'].forEach(function (t) { nd.addEventListener(t, function (ev) { ev.preventDefault(); }); });
        nd.addEventListener('drop', function (ev) { ev.preventDefault(); ntake(ev.dataTransfer.files[0]); });
        $('#ntnAdd').onclick = function () {
          var btn = this, x = TANKNEW, n = slug(nn.value).slice(0, 40), ic = imgCats('tank');
          if (!x || !x.rec) return;
          if (!/^[a-z0-9-]{1,40}$/.test(n)) { toast('Give it a name (lowercase, with dashes).', true); return; }
          if (tanks.some(function (y) { return y.name === n; })) { toast('There\'s already a scene called ' + n + '.', true); return; }
          btn.disabled = true; btn.textContent = 'Adding…';
          Promise.all([api('lookblob', x.rec.blob), x.rec.colors]).then(function (rr) {
            return api('looks', { newTank: { name: n, ext: x.rec.ext, sha: rr[0].sha, scene: ns.value.trim(), colors: rr[1] }, offerTank: ic.length ? { names: [n], cats: ic } : null });
          }).then(function () {
            TANKNEW = null; E.altaBackdrop = n; markDirty(); TANKSAVED[n] = URL.createObjectURL(x.rec.blob);
            LOOKJ = LOOKJ.then(function (j) { j = Object.assign({}, j); j.tankBackdrops = (j.tankBackdrops || []).concat([{ name: n, file: n + '.' + x.rec.ext, scene: ns.value.trim() }]);
              var tc = Object.assign({}, j.categoryTankChoices || {}); ic.forEach(function (c) { if ((j.categoryTanks || {})[c] !== n) tc[c] = (tc[c] || []).concat([n]); }); j.categoryTankChoices = tc; return j; });
            IMGCATS.tank = null;
            toast('Her ' + n.replace(/-/g, ' ') + ' scene is added and picked for this Note. Save the Note to keep the pick.'); showTank();
          }).catch(function (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Add it and use it here'; });
        };
      }).catch(function (e) { console.error('tank', e); });
    };
    var showWho0 = showWho; showWho = function () { showWho0(); showTank(); };
    showWho();
    $('#copyPrompt').onclick = function () {
      collect();   // copied at once (Safari only lets a click write to the clipboard), in the voice worked out above
      var p = ((CFG.audioPrompts && CFG.audioPrompts[whoNow]) || CFG.audioPrompt || '').replace('{{title}}', E.episode.title || E.title).replace('{{script}}', E.episode.script);
      navigator.clipboard.writeText(p).then(function () { toast('Audio prompt copied.'); });
    };
  }
  // ---------- GlazyArray's look for this Note (SHOW-GUIDE.md, "GlazyArray's look") ----------
  // Claude picks it when drafting: one of her looks, a new one (with the image prompt to render it), or none. It's her
  // default on this Note's Listen bar once it's made (published as data-look); a new one is made in the Workshop.
  // Her template is always here to copy or download, so any image tool on any device can use it; a rendered look
  // comes back here too (look.js keys it, cuts it and puts her face back), and Save adds it to her looks.
  var LOOKPICK = false, LOOKREPL = false;   // LOOKREPL: Replace pressed, so the prompt and the drop zone show   // two category looks on this Note and none picked yet (for the next steps)
  var LOOKS = null, LOOKCATS = null, CATNEW = {}, LOOKNEW = null, LOOKSAVED = {}, LOOKDEL = null;   // CATNEW: category -> look ('' for none), waiting for Save   // LOOKNEW: { name, blob, ext, url } waiting for Save;
  // LOOKSAVED: name -> this session's image, shown until the site has it; LOOKDEL: a look to take off the site on Save
  function lookSrc(l) { return LOOKSAVED[l.name] || (l.file ? '/assets/narrator/looks/' + esc(l.file) + (l.v ? '?r=' + esc(l.v) : '') : '/assets/marley/marley-avatar.jpg'); }   // a look with no file is Robot Marley's alone (hawaii)
  // this Note's categories (Play's filter tags, as field/tools/publish.mjs makes them): its own tags, then its kind
  function noteCats() {
    var slug = function (t) { return String(t || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
    var out = []; (E.tags || []).concat([kindTag(E.kind)]).forEach(function (t) { t = slug(t); if (t && !/^\d{4}$/.test(t) && out.indexOf(t) < 0) out.push(t); });
    return out;
  }
  // every category there is: on a Note, styled in looks.json, or made in the Categories tab (looks.json "categoryNames")
  function allCats(J) {
    J = J || {}; var out = {};
    (ENTRIES || []).forEach(function (e) { (e.cats || []).forEach(function (c) { out[c] = 1; }); });
    ['categories', 'categoryBackdrops', 'categoryRank', 'categoryNames'].forEach(function (k) { Object.keys(J[k] || {}).forEach(function (c) { out[c] = 1; }); });
    return Object.keys(out).sort();
  }
  function catName(t) { return t === 'mini-cast' ? 'Mini-Cast' : t.replace(/^with-/, 'with ').replace(/-/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
  // which look this Note shows, and why: its own, else its first category's, else the holiday look; then a picker per
  // category (every Note in it wears that look, unless the Note has its own)
  // ---------- her flair: the Note's two colours, from its hero; and on a new look, the parts that take them ----------
  var PAL_SAMPLE = ['#e0533d', '#2f9fd8'];   // to show a new look's flair before a Note has a palette
  function heroImg() {
    var ph = E.photos.filter(function (p) { return p.cover; })[0] || E.photos[0]; if (!ph) return Promise.resolve(null);
    var n = photoName(ph);
    if (fresh[n]) return createImageBitmap(fresh[n].blob);
    if (ph.video) {
      if (!ph.poster) return Promise.resolve(null);
      var pn = ph.poster.split('/').pop();
      if (posterNew[pn]) return imgFromUrl(posterNew[pn].url);
      if (clipsNew[n]) return imgFromUrl('api.php?a=vfile&t=poster&k=' + clipsNew[n].token);
      return E.id ? imgFromUrl('api.php?a=photo&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(pn) + posterBust) : Promise.resolve(null);
    }
    return imgFromUrl(photoUrl(ph));
  }
  // the hero is the master of the palette: a new cover (or poster frame) picks it again, unless it was set by hand
  function repalette(force) {
    if (!E || (E.paletteBy === 'hand' && !force)) return Promise.resolve();
    var was = JSON.stringify(E.palette || null);
    return heroImg().then(function (im) {
      var pal = im ? GALook.palette(im) : null;
      if (pal) E.palette = pal; else delete E.palette;
      delete E.paletteBy;
      if (JSON.stringify(E.palette || null) !== was) { markDirty(); renderLook(); }
    }).catch(function () {});
  }
  function palField() {
    var p = E.palette;
    return '<div class="ga-pal"><b>Her colours</b> <span class="muted">' + (p ? (E.paletteBy === 'hand' ? 'set by hand' : 'from the hero') : 'none yet: pick a cover') + '</span>' +
      (p ? p.map(function (c, k) { return '<input type="color" class="ga-sw" data-k="' + k + '" value="' + esc(c) + '" title="Change this colour">'; }).join('') : '') +
      ' <button type="button" class="link" id="palAgain">From the hero</button>' + (p ? ' <button type="button" class="link" id="palOff">None</button>' : '') +
      '<span class="muted ga-pal-n">Her flair (the coloured parts of her look), the glass player and the backdrop take these.</span></div>';
  }
  function palWire(box) {
    box.querySelectorAll('.ga-sw').forEach(function (i) { i.oninput = function () { E.palette = E.palette.slice(); E.palette[+i.getAttribute('data-k')] = i.value; E.paletteBy = 'hand'; markDirty(); }; i.onchange = function () { renderLook(); }; });
    var a = $('#palAgain', box); if (a) a.onclick = function () { repalette(true).then(function () { if (!E.palette) toast('The hero has no strong colours to take.', true); renderLook(); }); };
    var o = $('#palOff', box); if (o) o.onclick = function () { delete E.palette; E.paletteBy = 'hand'; markDirty(); renderLook(); };
  }
  // a new look's flair: what it adds, in two colour groups; tick which take the palette, or swap them
  function flairBox(rec, pal, onchange) {
    var f = rec.flair || {}, st = rec.fl || (rec.fl = { a: !!f.a, b: !!f.b, swap: false, whole: false });
    var d = document.createElement('div'); d.className = 'ga-flair';
    if (!f.a && !f.b && !f.whole) { d.innerHTML = '<p class="muted">No coloured accessory to give her flair to: this look shows as it is on every Note.</p>'; return d; }
    function draw() {
      var m = flairMasks(rec), c = GALook.flairPreview(rec.out, m, pal); c.className = 'ga-prev';
      d.innerHTML = '<p class="muted"><b>Her flair.</b> The parts tinted here take each Note\'s colours (shown in ' + (pal === PAL_SAMPLE ? 'two sample colours' : 'this Note\'s') + ').</p>';
      d.appendChild(c);
      d.insertAdjacentHTML('beforeend', (st.whole ? [] : ['a', 'b'].filter(function (k) { return f[k]; })).map(function (k) {
        return '<label class="ga-check"><input type="checkbox" data-k="' + k + '"' + (st[k] ? ' checked' : '') + '> ' + (k === 'a' ? 'The main coloured parts' : 'The second colour\'s parts') + '</label>';
      }).join('') + (f.a && f.b && !st.whole ? '<button type="button" class="link" data-swap>Swap the two colours</button>' : '') +
        (f.whole ? '<label class="ga-check"><input type="checkbox" data-k="whole"' + (st.whole ? ' checked' : '') + '> The whole accessory takes the first colour' + (f.a ? '' : ' (it\'s all brass, so nothing else stood out)') + '</label>' : ''));
      d.querySelectorAll('input[data-k]').forEach(function (i) { i.onchange = function () { st[i.getAttribute('data-k')] = i.checked; draw(); if (onchange) onchange(); }; });
      var sw = d.querySelector('[data-swap]'); if (sw) sw.onclick = function () { st.swap = !st.swap; draw(); if (onchange) onchange(); };
    }
    draw(); return d;
  }
  function flairMasks(rec) {
    var f = rec.flair || {}, st = rec.fl || { a: true, b: true }, a = st.a ? f.a : null, b = st.b ? f.b : null;
    if (st.whole && f.whole) return { a: f.whole, b: null };
    return st.swap ? { a: b, b: a } : { a: a, b: b };
  }
  function flairUp(rec) {   // the chosen masks up as blobs: { a: sha, b: sha }, or null
    var m = flairMasks(rec), out = {}, ks = ['a', 'b'].filter(function (k) { return m[k]; });
    if (!rec.flair) return Promise.resolve(null);
    if (!m.a && m.b) { m = { a: m.b, b: null }; ks = ['a']; }   // the only colour is always the first
    return ks.reduce(function (ch, k) {
      return ch.then(function () { return GALook.png(m[k]); }).then(function (b) { return api('lookblob', b); }).then(function (r) { out[k] = r.sha; });
    }, Promise.resolve()).then(function () { return ks.length ? out : null; });
  }
  // the own-look section starts open when the Note has its own (not a category's), or one is being made
  function gaOwnOpen() {
    var L = E.narratorLook, B = E.narratorBackdrop;
    return !!((L && L.fit !== 'category') || (B && B.fit !== 'category') || LOOKNEW || (BDNEW && BDNEW.blob));
  }
  // ---------- her style on this Note: just its categories, each with the cap and backdrop it gives; tick the one this Note
  // takes. The categories' own caps and backdrops are set in the Categories tab, not here ----------
  // SUGGESTED CATEGORIES while a Note is written (Christian, Oct 14: smart tags): the categories its words fit best
  // (resolve.js catFit: title, summary, place, episode and post), the strong ones only; one click adds one. Nothing is
  // added on its own.
  var ENTLOAD = null;
  function catSuggest(J) {
    if (!window.GAResolve || !GAResolve.catFit || !E) return [];
    if (!ENTRIES) {   // a Note opened straight from its link: the other Notes (what each category is about) come first
      if (!ENTLOAD) ENTLOAD = api('list').then(function (j) { ENTRIES = ENTRIES || j.entries; renderStyle(); }).catch(function () {});
      return [];
    }
    var all = (ENTRIES || []).filter(function (x) { return x.id !== E.id; }).map(function (x) { return { id: x.id, cats: x.cats || [], words: x.words || x.title || '' }; });
    var words = [E.title, E.summary, E.place, E.episode && E.episode.title, E.post && E.post.title, E.post && String(E.post.body || '').slice(0, 1200)].filter(Boolean).join(' ');
    if (wordsCount(words) < 4) return [];
    return GAResolve.catFit(J, all, { words: words, cats: noteCats() }).filter(function (x) { return x.s >= 3; }).slice(0, 4);
  }
  function wordsCount(t) { return (String(t || '').match(/[a-z]{3,}/gi) || []).length; }
  function renderStyle() {
    var box = $('#styleBox'); if (!box) return;
    renderLookData().then(function (r) {
      var list = r[0], cats = r[1], bds = r[2].list, bcats = r[2].cats, nc = noteCats(), L = E.narratorLook, B = E.narratorBackdrop;
      var lk = function (n) { return list.filter(function (l) { return l.name === n; })[0]; }, bd = function (n) { return bds.filter(function (b) { return b.name === n; })[0]; };
      var styled = nc.filter(function (c) { return lk(cats[c]) || bd(bcats[c]); });
      var ownL = L && L.fit !== 'category', ownB = B && B.fit !== 'category';
      var chosen = (L && L.fit === 'category' && L.from) || (B && B.fit === 'category' && B.from) || '';
      var implied = !chosen && !ownL && !ownB && styled.length === 1 ? styled[0] : '';
      var wasPick = LOOKPICK; LOOKPICK = false; if (wasPick !== LOOKPICK) setTimeout(renderNext, 0);   // priorities settle two categories now
      var now = gaPick(r[3]);
      var row = function (c) {
        var l = lk(cats[c]), b = bd(bcats[c]), on = chosen === c || implied === c;
        return '<label class="ga-sty' + (on ? ' on' : '') + '"><input type="checkbox" data-c="' + esc(c) + '"' + (on ? ' checked' : '') + (implied === c ? ' disabled' : '') + '>' +
          '<span class="ga-sty-n">' + esc(catName(c)) + (implied === c ? '<small>its only category with a style</small>' : '') + '</span>' +
          '<span class="ga-sty-t">' + (l ? '<img alt="" title="' + esc(l.name) + '" src="' + lookSrc(l) + '">' : '<i>no cap</i>') + '</span>' +
          '<span class="ga-sty-t bd">' + (b ? '<img alt="" title="' + esc(b.name) + '" src="' + bdSrc(b) + '">' : '<i>no backdrop</i>') + '</span></label>';
      };
      if (box.getAttribute('data-for') !== (E.id || 'new')) { box.setAttribute('data-for', E.id || 'new'); var ow = $('#gaOwn'); if (ow) ow.open = gaOwnOpen(); }
      box.innerHTML = palField() +
        '<div class="ga-catedit"><span class="ga-cats-h">Categories</span><small>Where this Note is filed on Play, and the categories she can take her style from. Add one, or make a new one by typing its name.</small><span class="chips">' +
          '<span class="chip fixed" title="Its kind, set by the Note\'s type">' + esc(catName(kindTag(E.kind) || '')) + '</span>' +
          (E.tags || []).map(function (t) { return '<span class="chip">' + esc(catName(t)) + '<button type="button" data-untag="' + esc(t) + '" aria-label="Remove ' + esc(catName(t)) + '">×</button></span>'; }).join('') +
          '<input id="gaTagIn" list="gaCatList" placeholder="Add a category" maxlength="40"><datalist id="gaCatList">' + allCats(r[3]).filter(function (c) { return nc.indexOf(c) < 0; }).map(function (c) { return '<option value="' + esc(catName(c)) + '">'; }).join('') + '</datalist></span>' +
          (function () { var sg = catSuggest(r[3]); return sg.length ? '<span class="ga-sugg"><small>Suggested from what it says:</small> ' + sg.map(function (x) { return '<button type="button" class="chip sugg" data-sugg="' + esc(x.c) + '" title="' + esc('Its words: ' + x.why.join(', ')) + '">+ ' + esc(catName(x.c)) + '</button>'; }).join('') + '</span>' : ''; })() + '</div>' +
        '<div class="ga-stys"><span class="ga-cats-h">Her style from a category</span>' +
        (nc.length ? '<small>The cap and backdrop each of this Note\'s categories gives her. Tick the one this Note takes. Categories get their styles in the Categories tab.</small>' + nc.map(row).join('') : '<small>This Note has no categories yet.</small>') +
        (now ? '<p class="ga-now"><b>Wearing now:</b> ' + esc(now.look.name.replace(/-/g, ' ')) + ' <small>(' + esc(now.look.why) + ')</small> · ' +
          (now.backdrop ? esc(now.backdrop.name.replace(/-/g, ' ')) + ' <small>(' + esc(now.backdrop.why) + ')</small>' : 'no backdrop') + '</p>' : '') +
        '<label class="ga-check"><input type="checkbox" id="gaNoHol"' + (E.ignoreHolidays ? ' checked' : '') + '> Ignore holidays <small>(holiday looks and backdrops dress every Note on their dates, except this one)</small></label>' +
        (ownL || ownB ? '<p class="ga-shows">This Note has its own ' + [ownL ? 'cap (<b>' + esc(L.look) + '</b>)' : '', ownB ? 'backdrop (<b>' + esc(B.backdrop) + '</b>)' : ''].filter(Boolean).join(' and ') + ', below; ticking a category replaces ' + (ownL && ownB ? 'them' : 'it') + '.</p>' : '') +
        '</div>';
      palWire(box);
      var tslug = function (t) { return String(t || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); };
      $$('button[data-untag]', box).forEach(function (b) { b.onclick = function () {
        var t = b.getAttribute('data-untag'); E.tags = (E.tags || []).filter(function (x) { return x !== t; });
        if (E.narratorLook && E.narratorLook.fit === 'category' && E.narratorLook.from === t) E.narratorLook = null;
        if (E.narratorBackdrop && E.narratorBackdrop.fit === 'category' && E.narratorBackdrop.from === t) E.narratorBackdrop = null;
        markDirty(); renderStyle(); renderLook(); renderBd(); };
      });
      $$('[data-sugg]', box).forEach(function (b) { b.onclick = function () { var t = b.getAttribute('data-sugg'); if (noteCats().indexOf(t) < 0) { E.tags = (E.tags || []).concat([t]); markDirty(); } renderStyle(); renderLook(); renderBd(); }; });
      var ti = $('#gaTagIn', box);
      if (ti) { var addTag = function () { var t = tslug(ti.value); if (!t || /^\d{4}$/.test(t)) return; if (noteCats().indexOf(t) < 0) { E.tags = (E.tags || []).concat([t]); markDirty(); } renderStyle(); renderLook(); renderBd(); };
        ti.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); addTag(); } }; ti.onchange = addTag; }
      var nh = $('#gaNoHol', box); if (nh) nh.onchange = function () { if (nh.checked) E.ignoreHolidays = true; else delete E.ignoreHolidays; markDirty(); renderStyle(); };
      var hs = $('#f-look > summary'), sm = hs && $('small', hs), ht = now ? [now.look.name, now.backdrop ? now.backdrop.name : ''].filter(Boolean).join(' · ') : [L ? L.look : '', B ? B.backdrop : ''].filter(Boolean).join(' · ') || 'from her categories or the holiday';
      if (hs) { if (!sm) { sm = document.createElement('small'); hs.appendChild(sm); } sm.textContent = NARNOW && NARNOW !== 'glazyarray' ? lookHint(NARNOW) : 'GlazyArray · ' + ht; }   // the fold's header follows the pick (and who tells it)
      $$('input[data-c]', box).forEach(function (i) { i.onchange = function () {
        var c = i.getAttribute('data-c');
        if (i.checked) {
          var l = lk(cats[c]);
          E.narratorLook = l ? { look: l.name, fit: 'category', from: c, about: l.about || '', why: 'Picked from ' + catName(c) + '.', prompt: '', bulb: l.bulb !== false } : null;
          E.narratorBackdrop = bd(bcats[c]) ? { backdrop: bcats[c], fit: 'category', from: c, scene: '' } : null;
        } else {
          if (E.narratorLook && E.narratorLook.from === c) E.narratorLook = null;
          if (E.narratorBackdrop && E.narratorBackdrop.from === c) E.narratorBackdrop = null;
        }
        markDirty(); renderLook(); renderBd(); renderNext();
      }; });
    });
  }
  // what she wears on this Note, by the site's one rule (/assets/narrator/resolve.js): a holiday on its dates unless the
  // Note ignores holidays, the Note's own, its categories (the ticked one, then priority, then the latest changed), the default
  var NAR_NAME = { glazyarray: 'GlazyArray', alta: 'A.L.T.A.', marley: 'Robot Marley' };   // the narrators' names (assets/narrator/resolve.js NARRATORS)
  var LOOKJ = null, NARNOW = 'glazyarray';   // who tells the open Note, as the site decides it (render's showWho)
  // what the Note says about itself, for picking among a category's choices (resolve.js fit(); publish.mjs noteWords)
  function noteFit(e) {
    e = e || E || {};
    return { words: [e.title, e.summary, e.place, (e.tags || []).join(' '), e.episode && e.episode.title].filter(Boolean).join(' '), palette: e.palette, month: +(e.date || '').slice(5, 7) || 0 };
  }
  function gaPick(J) {
    if (!window.GAResolve || !E) return null;
    var L = E.narratorLook, B = E.narratorBackdrop, f = noteFit();
    return GAResolve.pick(J, { look: L && L.fit !== 'category' ? L.look : null, backdrop: B && B.fit !== 'category' ? B.backdrop : null, cats: noteCats(),
      prefer: (L && L.fit === 'category' && L.from) || (B && B.fit === 'category' && B.from) || null, ignoreHolidays: !!E.ignoreHolidays, words: f.words, palette: f.palette, month: f.month });
  }
  function renderLookData() {
    if (!LOOKS) {
      var lj = fetch('/assets/narrator/looks.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return {}; });
      LOOKS = lj.then(function (j) { return j.looks || []; }); LOOKCATS = lj.then(function (j) { return j.categories || {}; });
      LOOKBD = lj.then(function (j) { return { list: j.backdrops || [], cats: j.categoryBackdrops || {} }; }); LOOKJ = lj;
    }
    return Promise.all([LOOKS, LOOKCATS, LOOKBD, LOOKJ]).then(function (r) { gaNormal(r); return r; });
  }
  // a Note whose cap (and backdrop, if any) are just one of its categories' is taking that category's style: it reads as
  // ticked there, not as a look of its own (the site shows the same either way)
  function gaNormal(r) {
    var L = E && E.narratorLook, B = E && E.narratorBackdrop; if (!E || (!L && !B)) return;
    if ((L && L.fit === 'category') || (B && B.fit === 'category')) return;
    noteCats().some(function (c) {
      var lc = r[1][c] || '', bc = r[2].cats[c] || '';
      if ((L ? L.look === lc : true) && (B ? B.backdrop === bc : true) && (lc || bc)) {
        if (L) { L.fit = 'category'; L.from = c; } if (B) { B.fit = 'category'; B.from = c; }
        return true;
      }
    });
  }

  // ---------- her backdrop for this Note: the scene behind the Listen bar, shown softly blurred. Like her look: the
  // Note's own, else its categories' (one; two different ones are picked here, unpicked means none), else the bar's
  // teal. A new one starts as a few words about the place; the prompt is built from them (look.js bdPrompt), rendered
  // on the backdrop template in any image tool, and brought back here ----------
  var TANKNEW = null;   // a new tank scene being made on a Note (its Episode panel)
  var LOOKBD = null, BDNEW = null, BDSAVED = {}, CATBDNEW = {}, BDPICK = false;
  // ---------- a picture's three main colours (most of it first), for matching a Note's palette (resolve.js fit()):
  // a small copy (its top part only, for a tank scene: band), grouped three ways ----------
  function imageColors(src, band) {
    var sw = src.width, sh = src.height * (band || 1), w = 64, h = Math.max(1, Math.round(w * sh / sw));
    var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
    var d = g.getImageData(0, 0, w, h).data, px = [];
    for (var i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    px.sort(function (a, b) { return (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]); });
    var k = [px[Math.floor(px.length / 6)], px[Math.floor(px.length / 2)], px[Math.floor(px.length * 5 / 6)]].map(function (p) { return p.slice(); }), n = [0, 0, 0];
    for (var it = 0; it < 12; it++) {
      var sum = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; n = [0, 0, 0];
      px.forEach(function (p) { var bi = 0, bd = 1e9; k.forEach(function (q, j) { var dd = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2]); if (dd < bd) { bd = dd; bi = j; } }); n[bi]++; sum[bi][0] += p[0]; sum[bi][1] += p[1]; sum[bi][2] += p[2]; });
      k = k.map(function (q, j) { return n[j] ? [sum[j][0] / n[j], sum[j][1] / n[j], sum[j][2] / n[j]] : q; });
    }
    return [0, 1, 2].sort(function (a, b) { return n[b] - n[a]; }).map(function (j) { return '#' + k[j].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); });
  }
  function blobColors(blob) {
    if (!blob || !window.createImageBitmap) return Promise.resolve([]);
    return createImageBitmap(blob).then(function (bm) { return imageColors(bm); }).catch(function () { return []; });
  }
  // ---------- A.L.T.A.'s tank scenes (assets/alta/KIT.md Round 8): only the strip above her ledge shows ----------
  var TANK_SCENES = {
    'lake-tahoe': 'a sandy Lake Tahoe beach at dusk, smooth granite boulders and pines along the far shore',
    'case-study': 'a quiet old library with tall wooden bookshelves and warm reading lamps',
    ride: 'a small bike shop with mountain bikes hanging on the far wall',
    hike: 'a pine forest trailhead in late afternoon light',
    'mini-cast': 'a cozy maker\'s workshop with tools on the far wall and warm hanging lamps',
    automaton: 'a clockmaker\'s workshop with brass gears and glass jars on shelves',
    'with-marley': 'a sunny backyard lawn with a wooden fence and trees beyond',
    aerial: 'a wide mountain valley seen from a high ridge, a lake far below',
    science: 'a bright science classroom with a long chalkboard and shelves of equipment',
    showcase: 'a gallery with soft spotlights on the far wall'
  };
  // Christian's layout (Oct 14): the place on a line of its own between the two halves, so it's the one part to change
  function tankPrompt(place, way) {
    place = place || '[ INSERT SCENE ]';
    var look = 'Shot like a cinematic film still from about table height, straight ahead and level, as if from behind a large aquarium standing there. Very shallow depth of field: the whole place softly out of focus, with gentle bokeh and nothing sharp. Warm, soft, late-afternoon light; calm, tidy and uncluttered. The far wall, the horizon or the treeline sits about halfway between the top of the picture and the ledge.';
    var tail = ' Empty of people and animals. No writing, signs, logos or brands anywhere. Natural colours, nothing neon, that sit well beside a teal-green tank and weathered copper.';
    if (way === 'new') return 'A softly blurred photograph, wide 16:9, of\n\n' + place + '\n\n' + look.replace(' The far wall, the horizon or the treeline sits about halfway between the top of the picture and the ledge.', ' The far wall, the horizon or the treeline sits about a quarter of the way down the frame; everything that matters is in the top third, and the lower part is plain floor or ground. Keep the middle of that top third calm and evenly lit, with no bright lights or strong shapes (her head goes there).') + tail;
    return 'Same image, exactly as it is: the empty tank, its copper ledge, the water and everything below the ledge stay exactly the same. Replace only the flat green wall above the copper ledge with a softly blurred photograph of\n\n' + place + '\n\n' + look +
      ' Composition, in pixels on this 1376 x 768 image: everything that matters sits above the ledge, from y 0 to y 290. Keep the middle, from x 560 to x 820 and y 40 to y 290, calm, evenly lit and slightly darker, with no bright lights or strong shapes (her head goes there). Nothing added in the tank, on the ledge or in front of it.' + tail;
  }
  // a tank scene's preview: her resting in front of it, and the same scene as she dives (her head and shoulders gone, so
  // only the scene shows above the ledge). A scene with her painted in is refused: her head would stay behind when she
  // dives (Christian, Oct 14); so is one with her template's green still showing. Returns whether it can be added.
  function tankShow(o, res) {
    o.innerHTML = (res.her ? '<p class="warn">She\'s painted into this picture: when she dives, that copy of her head would stay behind. Make it from her empty tank template (Copy her tank template), or a new picture.</p>' : '') +
      (res.green ? '<p class="warn">Some of her template\'s green is still showing above the ledge: run it again until the whole wall is the place.</p>' : '') +
      (res.warn ? '<p class="warn">' + esc(res.warn) + '</p>' : '') + '<p class="muted">Resting, and as she dives:</p>';
    res.preview.className = 'ga-prev'; o.appendChild(res.preview); res.dive.className = 'ga-prev'; o.appendChild(res.dive);
    return !res.her && !res.green;
  }
  // a render cropped to her frame (1376 x 768) as webp, and a preview with her and her tank in front of it
  function tankImage(file) {
    var url = URL.createObjectURL(file), W = 1376, H = 768;
    var load = function (src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { no(new Error('That image didn\'t open.')); }; i.src = src; }); };
    return Promise.all([load(url), load('/assets/alta/kit/tank-overlay.webp'), load('/assets/alta/parts/rest-cut.webp')]).then(function (r) {
      URL.revokeObjectURL(url);
      var src = r[0], c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d'), sw = src.naturalWidth, sh = src.naturalHeight, k = Math.max(W / sw, H / sh);
      g.imageSmoothingQuality = 'high'; g.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
      var warn = Math.abs(sw / sh - W / H) > 0.15 ? 'It isn\'t 16:9 like her template, so it was cropped to fit.' : '';
      var pv = document.createElement('canvas'); pv.width = 688; pv.height = 384;
      var pg = pv.getContext('2d'); pg.drawImage(c, 0, 0, 688, 384); pg.drawImage(r[1], 0, 0, 688, 384);
      var dv = document.createElement('canvas'); dv.width = 688; dv.height = 384;
      var dg = dv.getContext('2d'); dg.drawImage(c, 0, 0, 688, 384); dg.drawImage(r[2], 0, 0, 688, 384);
      // is she painted in? her head, where the overlay has it, against the render there (the old template had her in it)
      var oc = document.createElement('canvas'); oc.width = W; oc.height = 250;
      var og = oc.getContext('2d'); og.drawImage(r[1], 0, 0);
      var od = og.getImageData(0, 0, W, 250).data, sd = g.getImageData(0, 0, W, 250).data, sum = 0, n = 0;
      for (var q = 0; q < od.length; q += 4) if (od[q + 3] > 128) { sum += Math.abs(od[q] - sd[q]) + Math.abs(od[q + 1] - sd[q + 1]) + Math.abs(od[q + 2] - sd[q + 2]); n++; }
      var her = n > 0 && sum / n / 3 < 30;
      // is her template's green still showing above the ledge (the tool left some of the wall)?
      var gd = g.getImageData(0, 0, W, 285).data, gn = 0;
      // the template's chroma green (about #00A549 to #00B140: almost no red, strong green): grass and trees always
      // carry more red than that, so a leafy scene isn't mistaken for it
      for (var z = 0; z < gd.length; z += 16) if (gd[z] < 60 && gd[z + 1] > 130 && gd[z + 1] - gd[z] > 100 && gd[z + 2] < 120 && gd[z + 1] - gd[z + 2] > 50) gn++;
      var green = gn / (gd.length / 16) > 0.04;
      return new Promise(function (ok) { c.toBlob(ok, 'image/webp', 0.85); }).then(function (b) {
        if (b && b.type === 'image/webp') return b;
        return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.86); });
      }).then(function (blob) { return { blob: blob, ext: blob.type === 'image/webp' ? 'webp' : 'jpg', preview: pv, dive: dv, her: her, green: green, warn: warn, colors: imageColors(c, 0.38) }; });
    });
  }
  var SCENES = { 'case-study': 'an old library with tall wooden bookshelves, brass reading lamps and a long study table',
    ride: 'a small bike shop garage with mountain bikes hanging on a wall rack, tools on a pegboard and a wooden workbench',
    hike: 'a pine forest trailhead with a wooden trail sign and a dirt path in late light',
    'mini-cast': 'a cozy maker\'s workshop with a workbench, tools on the wall and warm hanging lamps',
    automaton: 'a clockmaker\'s workshop full of brass gears, cogs and glass jars on wooden shelves',
    'lake-tahoe': 'a Lake Tahoe shoreline with clear turquoise water, smooth granite boulders and pines at golden hour',
    'with-marley': 'a sunny pine meadow with a dog\'s ball and leash resting on a log',
    foraging: 'a high-desert hillside with sagebrush and scattered stones in warm evening light',
    'high-desert': 'open high-desert sagebrush hills under a wide dusk sky' };
  function sceneFor(cats) { for (var i = 0; i < cats.length; i++) if (SCENES[cats[i]]) return SCENES[cats[i]]; return ''; }
  function bdSrc(b) { return BDSAVED[b.name] || '/assets/narrator/backdrops/' + esc(b.file) + (b.v ? '?r=' + esc(b.v) : ''); }
  function bdTpl() {
    return '<div class="ga-tpl"><img alt="The backdrop template" src="' + GALook.BD_GUIDE + '">' +
      '<span><b>The backdrop template</b><br><span class="muted">21:9. Give it to your image tool with the prompt.</span><br>' +
      '<button type="button" class="bdTplCopy">Copy the image</button> <a href="' + GALook.BD_TEMPLATE + '" download>Download</a> · ' +
      '<a href="' + GALook.BD_GUIDE + '" target="_blank" rel="noopener">Layout guide</a></span></div>';
  }
  function wireTpl(root) { $$('.bdTplCopy', root).forEach(function (b) { b.onclick = function () { GALook.copyImage(GALook.BD_TEMPLATE).then(function () { toast('The backdrop template is on the clipboard.'); }, function (e) { toast(e.message, true); }); }; }); }
  // ---------- Category pools (Christian, Oct 14): each category holds a pool of images for each character (backdrops
  // for GlazyArray and Robot Marley, who share them; A.L.T.A.'s own tank scenes), and a Note chooses from all its
  // categories' pools the one that fits its words and colours best (resolve.js). Drop several in at once and tick every
  // category they belong in; open any image to tick its categories; copy a similar category's pool into a new one. A
  // category's first pick (its column above) is in its pool already. Shown in Categories and in each character's tab. ----------
  var TANKSAVED = {}, POOLP = { bd: {}, tank: {} }, POOLNEW = { bd: [], tank: [] }, POOLV = { bd: '', tank: '', open: '', to: null };
  function renderPool(d, k) {
    renderLookData().then(function (r) {
      var J = r[3] || {}, tank = k === 'tank', lib = tank ? (J.tankBackdrops = J.tankBackdrops || []) : (J.backdrops = J.backdrops || []);
      var first = tank ? (J.categoryTanks || {}) : (J.categoryBackdrops || {}), saved = tank ? (J.categoryTankChoices || {}) : (J.categoryBackdropChoices || {}), pend = POOLP[k];
      var ccount = {}; (ENTRIES || []).forEach(function (e) { (e.cats || []).forEach(function (c) { ccount[c] = (ccount[c] || 0) + 1; }); });
      allCats(J).forEach(function (c) { if (!(c in ccount)) ccount[c] = 0; });
      var catList = Object.keys(ccount).sort(function (a, b) { return ccount[b] - ccount[a] || (a < b ? -1 : 1); });
      var cat = POOLV[k] && catList.indexOf(POOLV[k]) >= 0 ? POOLV[k] : catList[0] || '';
      var has = function (n) { return lib.filter(function (b) { return b.name === n; })[0]; };
      var more = function (c) { return c in pend ? pend[c] : (saved[c] || []); };
      var poolOf = function (c) { return [first[c]].concat(more(c)).filter(function (n, i, a) { return n && has(n) && a.indexOf(n) === i; }); };
      var src = function (b) { return tank ? TANKSAVED[b.name] || '/assets/alta/backdrops/' + esc(b.file) + (b.v ? '?r=' + esc(b.v) : '') : bdSrc(b); };
      var inCats = function (n) { return catList.filter(function (c) { return poolOf(c).indexOf(n) >= 0; }); };
      var pool = poolOf(cat), rest = lib.filter(function (b) { return pool.indexOf(b.name) < 0; }), news = POOLNEW[k];
      if (!POOLV.to || POOLV.toK !== k) { POOLV.to = [cat]; POOLV.toK = k; }
      var to = POOLV.to.filter(function (c) { return catList.indexOf(c) >= 0; });
      var npend = Object.keys(pend).length, nok = news.filter(function (x) { return x.ok; }).length;
      var ticks = function (attr, on, fixed) { return '<div class="chips">' + catList.map(function (c) { var f = fixed && fixed(c); return '<label class="chip"><input type="checkbox" ' + attr + '="' + esc(c) + '"' + (on(c) ? ' checked' : '') + (f ? ' disabled title="its first pick: change it in its column"' : '') + '>' + esc(catName(c)) + '</label>'; }).join('') + '</div>'; };
      var openN = POOLV.open && has(POOLV.open) ? POOLV.open : '';
      d.innerHTML = '<h4>Category pools · ' + (tank ? 'A.L.T.A.\'s tank scenes' : 'backdrops for GlazyArray and Robot Marley') + '</h4><p class="muted">The images each category offers. A Note chooses from the pools of all its categories the one that fits its words and colours best; with only one, that one. An image can be in any number of pools, and one added on a Note joins the pools of all its categories.</p>' +
        '<div class="row"><label class="f"><span>Category</span><select class="pcat">' + catList.map(function (c) { return '<option value="' + esc(c) + '"' + (c === cat ? ' selected' : '') + '>' + esc(catName(c)) + ' (' + ccount[c] + ' Note' + (ccount[c] === 1 ? '' : 's') + ', ' + poolOf(c).length + ' in its pool)</option>'; }).join('') + '</select></label>' +
          '</div>' +
        (pool.length ? '<div class="lookg bdg' + (tank ? ' tkg' : '') + ' ppool">' + pool.map(function (n) { var b = has(n), al = inCats(n).filter(function (c) { return c !== cat; }).map(catName);
          return '<figure><img alt="" src="' + src(b) + '"><figcaption>' + esc(n) + (n === first[cat] ? ' <small>its first pick</small>' : '<button type="button" class="link" data-prm="' + esc(n) + '">Take out</button>') +
            '<button type="button" class="link" data-pop="' + esc(n) + '">Its categories</button><button type="button" class="link" data-ppr="' + esc(n) + '">Its prompt</button>' +
            (al.length ? '<small>also in ' + esc(al.slice(0, 4).join(', ') + (al.length > 4 ? ' and ' + (al.length - 4) + ' more' : '')) + '</small>' : '') + '</figcaption></figure>'; }).join('') + '</div>'
          : '<p class="muted">Nothing in ' + esc(catName(cat)) + '\'s pool yet' + (tank ? ': its Notes show her hall.' : '.') + '</p>') +
        (openN ? '<div class="sync-box pone"><p><b>' + esc(openN) + '</b>: tick every category it belongs in.</p>' + ticks('data-pin', function (c) { return poolOf(c).indexOf(openN) >= 0; }, function (c) { return first[c] === openN; }) + '<button type="button" class="link pclose">Done</button></div>' : '') +
        // add images it hasn't got: all of them, or another category's pool (Christian: filter by another tag), one at a time or all
        (rest.length ? '<details class="padd"' + (POOLV.addOpen ? ' open' : '') + '><summary>Add images to ' + esc(catName(cat)) + '\'s pool</summary>' +
          '<div class="row"><label class="f"><span>Show</span><select class="pfrom"><option value="">All ' + (tank ? 'her scenes' : 'the backdrops') + ' it hasn\'t got (' + rest.length + ')</option>' + catList.filter(function (c) { return c !== cat && poolOf(c).some(function (n) { return pool.indexOf(n) < 0; }); }).map(function (c) { var m = poolOf(c).filter(function (n) { return pool.indexOf(n) < 0; }).length; return '<option value="' + esc(c) + '"' + (POOLV.from === c ? ' selected' : '') + '>' + esc(catName(c)) + '\'s pool (' + m + ' it hasn\'t got)</option>'; }).join('') + '</select></label>' +
            '<button type="button" class="pall">Select all</button><button type="button" class="primary paddsel" disabled>Add the selected</button></div>' +
          '<div class="npool' + (tank ? ' tk' : '') + ' ppickg">' + rest.filter(function (b) { return !POOLV.from || poolOf(POOLV.from).indexOf(b.name) >= 0; }).map(function (b) {
            return '<button type="button" data-psel="' + esc(b.name) + '" aria-pressed="false"><img alt="" src="' + src(b) + '"><span>' + esc(b.name) + '<small>' + esc(inCats(b.name).map(catName).slice(0, 3).join(', ') || 'in no pool yet') + '</small></span></button>'; }).join('') + '</div></details>' : '') +
        '<label class="drop ga-drop pdrop"><input type="file" class="pfile" accept="image/png,image/jpeg,image/webp" multiple hidden><b>Drop new ' + (tank ? 'scenes for A.L.T.A.' : 'backdrops for GlazyArray and Robot Marley') + ' here</b> <span class="muted">several at once' + (tank ? ' (made on her tank template)' : ' (21:9, made on the backdrop template)') + '</span></label>' +
        (news.length ? '<div class="pnew">' + news.map(function (x, i) { return '<div class="pn" data-i="' + i + '"></div>'; }).join('') + '</div><p><b>Add ' + (nok === 1 ? 'it' : 'them') + ' to these categories\' pools:</b></p>' + ticks('data-pto', function (c) { return to.indexOf(c) >= 0; }) : '') +
        '<div class="row"><button type="button" class="primary psave"' + (npend || nok ? '' : ' disabled') + '>Save the pools' + (nok ? ' (' + nok + ' new)' : '') + '</button>' + (npend ? '<span class="muted">' + (npend > 1 ? npend + ' categories\' pools' : '1 category\'s pool') + ' changed, not saved yet</span>' : '') + '</div>';
      news.forEach(function (x, i) {
        var el = $('.pn[data-i="' + i + '"]', d);
        el.innerHTML = (x.warn ? '<p class="warn">' + esc(x.warn) + '</p>' : '') + '<div class="grid2">' + field('Name', '<input class="pnn" maxlength="40" value="' + esc(x.name) + '">', 'Lowercase, with dashes') + field('What it shows', '<input class="pns" maxlength="200" placeholder="e.g. sumo wrestlers on a snowy soccer pitch" value="' + esc(x.scene || '') + '">', 'A few words: Notes are matched by them') + '</div><button type="button" class="link pnx">Leave it out</button>';
        if (x.prev) { x.prev.className = 'ga-prev'; el.insertBefore(x.prev, el.firstChild); }
        if (x.dive) { x.dive.className = 'ga-prev'; el.insertBefore(x.dive, el.children[1]); }
        $('.pnn', el).oninput = function () { x.name = slug(this.value).slice(0, 40); };
        $('.pns', el).oninput = function () { x.scene = this.value; };
        $('.pnx', el).onclick = function () { news.splice(i, 1); renderPool(d, k); };
      });
      var setMore = function (c, l) { if (l.join() === (saved[c] || []).join()) delete pend[c]; else pend[c] = l; };
      $('.pcat', d).onchange = function () { POOLV[k] = this.value; POOLV.to = null; POOLV.from = ''; renderPool(d, k); };
      $$('[data-prm]', d).forEach(function (b) { b.onclick = function () { var n = b.getAttribute('data-prm'); setMore(cat, more(cat).filter(function (x) { return x !== n; })); renderPool(d, k); }; });
      var padd = $('.padd', d);
      if (padd) {
        padd.ontoggle = function () { POOLV.addOpen = padd.open; };
        var selN = function () { return $$('[data-psel].on', d).map(function (x) { return x.getAttribute('data-psel'); }); };
        var selUpd = function () { var n = selN().length, b = $('.paddsel', d); b.disabled = !n; b.textContent = n ? 'Add the ' + n + ' selected' : 'Add the selected'; };
        $$('[data-psel]', d).forEach(function (x) { x.onclick = function () { x.classList.toggle('on'); x.setAttribute('aria-pressed', x.classList.contains('on')); selUpd(); }; });
        $('.pall', d).onclick = function () { var all = $$('[data-psel]', d), on = all.every(function (x) { return x.classList.contains('on'); }); all.forEach(function (x) { x.classList.toggle('on', !on); x.setAttribute('aria-pressed', !on); }); selUpd(); };
        $('.pfrom', d).onchange = function () { POOLV.from = this.value; renderPool(d, k); };
        $('.paddsel', d).onclick = function () { setMore(cat, more(cat).concat(selN())); renderPool(d, k); };
      }
      $$('[data-pop]', d).forEach(function (b) { b.onclick = function () { POOLV.open = b.getAttribute('data-pop'); renderPool(d, k); }; });
      // every image keeps its prompt (Christian, Oct 14): built from what it shows, or its name until it has words
      $$('[data-ppr]', d).forEach(function (b) { b.onclick = function () { var im = has(b.getAttribute('data-ppr')), place = im.scene || im.name.replace(/-/g, ' ');
        navigator.clipboard.writeText(tank ? tankPrompt(place, 'edit') : GALook.bdPrompt(place)).then(function () { toast(im.scene ? 'Its prompt is copied.' : 'Its prompt is copied (from its name: give it a description in Characters, What\'s needed).'); }); }; });
      var pc = $('.pclose', d); if (pc) pc.onclick = function () { POOLV.open = ''; renderPool(d, k); };
      $$('input[data-pin]', d).forEach(function (inp) { inp.onchange = function () { var c = inp.getAttribute('data-pin'); setMore(c, inp.checked ? more(c).concat([openN]) : more(c).filter(function (x) { return x !== openN; })); renderPool(d, k); }; });
      $$('input[data-pto]', d).forEach(function (inp) { inp.onchange = function () { POOLV.to = $$('input[data-pto]', d).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-pto'); }); }; });
      var take = function (fl) {
        fl = [].slice.call(fl || [], 0, 20); if (!fl.length) return;
        Promise.all(fl.map(function (f) {
          var base = slug(f.name.replace(/\.[a-z0-9]+$/i, '')).slice(0, 40) || 'scene';
          return (tank ? tankImage(f) : GALook.backdrop(f)).then(function (res) {
            var x = { name: base, blob: res.blob, ext: res.ext, prev: res.preview, dive: res.dive, warn: res.warn, colors: res.colors, ok: true };
            if (res.her) { x.ok = false; x.warn = 'She\'s painted into this picture, so it can\'t be added: when she dives, that copy of her head would stay behind.'; }
            if (res.green) { x.ok = false; x.warn = 'Some of her template\'s green is still showing above the ledge, so it can\'t be added.'; }
            news.push(x);
          }, function (e) { toast(f.name + ': ' + e.message, true); });
        })).then(function () { renderPool(d, k); });
      };
      $('.pfile', d).onchange = function () { take(this.files); this.value = ''; };
      var dz = $('.pdrop', d);
      ['dragover', 'dragenter'].forEach(function (t) { dz.addEventListener(t, function (ev) { ev.preventDefault(); }); });
      dz.addEventListener('drop', function (ev) { ev.preventDefault(); take(ev.dataTransfer.files); });
      $('.psave', d).onclick = function () {
        var b = this, ok = news.filter(function (x) { return x.ok; }), names = {}, toNow = POOLV.to || [cat];
        lib.forEach(function (x) { names[x.name] = 1; });
        for (var i = 0; i < ok.length; i++) {
          if (!/^[a-z0-9-]{1,40}$/.test(ok[i].name)) { toast('Give each new one a name (lowercase, with dashes).', true); return; }
          if (names[ok[i].name]) { toast('There\'s already one called ' + ok[i].name + ': give the new one another name.', true); return; }
          names[ok[i].name] = 1;
        }
        if (ok.length && !toNow.length) { toast('Tick at least one category for the new ones.', true); return; }
        b.disabled = true; b.textContent = ok.length ? 'Uploading…' : 'Saving…';
        // one at a time, saying which (a batch of big images all at once can choke the web host)
        var up = [], one = function (i) {
          if (i >= ok.length) return Promise.resolve(up);
          var x = ok[i]; b.textContent = 'Uploading ' + (i + 1) + ' of ' + ok.length + '…';
          return Promise.all([api('lookblob', x.blob), x.colors || blobColors(x.blob)]).then(function (rr) { up.push({ name: x.name, ext: x.ext, sha: rr[0].sha, scene: (x.scene || '').trim(), colors: rr[1], about: '' }); return one(i + 1); },
            function (err) { throw new Error(x.name + ': ' + err.message); });
        };
        one(0)
          .then(function (up) { b.textContent = 'Saving…';
            var body = {}, sentP = pend; body[tank ? 'categoryTankChoices' : 'categoryBackdropChoices'] = Object.keys(pend).length ? pend : null;
            if (up.length) { body[tank ? 'newTanks' : 'newBackdrops'] = up; body[tank ? 'offerTank' : 'offerBackdrop'] = { names: up.map(function (x) { return x.name; }), cats: toNow }; }
            return api('looks', body).then(function () {
              // what was saved, in the Studio's copy at once (the site's looks.json follows in about a minute)
              var key = tank ? 'categoryTankChoices' : 'categoryBackdropChoices', ch = J[key] = Object.assign({}, J[key] || {});
              Object.keys(sentP).forEach(function (c) { if (sentP[c].length) ch[c] = sentP[c]; else delete ch[c]; });
              up.forEach(function (x, i) { lib.push({ name: x.name, file: x.name + '.' + x.ext, about: '', scene: x.scene, colors: x.colors }); if (ok[i].prev && !tank) BDSAVED[x.name] = URL.createObjectURL(ok[i].blob);
                toNow.forEach(function (c) { if (first[c] !== x.name) ch[c] = (ch[c] || []).filter(function (n) { return n !== x.name; }).concat([x.name]); }); });
              if (tank) up.forEach(function (x, i) { TANKSAVED[x.name] = URL.createObjectURL(ok[i].blob); });
            });
          })
          .then(function () { POOLP[k] = {}; POOLNEW[k] = []; POOLV.to = null; toast('Saved. The site updates in about a minute.'); renderPool(d, k); })
          .catch(function (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Save the pools'; });
      };
    });
  }
  // everything a Note's categories offer one character (their pools: a category's first pick and its choices), in the
  // order resolve.js weighs them (Christian, Oct 14): kind 'bd' (GlazyArray's and Robot Marley's backdrops) or 'tank'
  function notePool(J, kind) {
    var first = kind === 'tank' ? J.categoryTanks || {} : J.categoryBackdrops || {}, more = kind === 'tank' ? J.categoryTankChoices || {} : J.categoryBackdropChoices || {};
    var lib = kind === 'tank' ? J.tankBackdrops || [] : J.backdrops || [], out = [];
    noteCats().forEach(function (c) { [first[c]].concat(more[c] || []).forEach(function (n) {
      var b = lib.filter(function (x) { return x.name === n; })[0]; if (!b) return;
      var o = out.filter(function (x) { return x.b.name === n; })[0]; if (o) o.cats.push(c); else out.push({ b: b, cats: [c] });
    }); });
    return out;
  }
  // which of the Note's categories a new image made on it joins (Christian, Oct 14): all of them unless some are
  // unticked; a category typed here is new to the Note too (and to the site once saved)
  var IMGCATS = { bd: null, tank: null };
  function imgCats(k) { var nc = noteCats(); return IMGCATS[k] ? IMGCATS[k].filter(function (c) { return nc.indexOf(c) >= 0; }) : nc; }
  function imgCatsHtml(k) {
    var nc = noteCats(), on = imgCats(k);
    return '<div class="imgcats"><span class="ga-cats-h">It joins the pools of</span><span class="chips">' + nc.map(function (c) { return '<label class="chip"><input type="checkbox" data-ic="' + esc(c) + '"' + (on.indexOf(c) >= 0 ? ' checked' : '') + '>' + esc(catName(c)) + '</label>'; }).join('') +
      '<input class="icnew" placeholder="Add a category" maxlength="40"></span><small>A category you add here goes on this Note too.</small></div>';
  }
  function imgCatsWire(root, k, again) {
    $$('input[data-ic]', root).forEach(function (i) { i.onchange = function () { IMGCATS[k] = $$('input[data-ic]', root).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-ic'); }); }; });
    var n = $('.icnew', root); if (!n) return;
    var add = function () {
      var t = String(n.value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); if (!t || /^\d{4}$/.test(t)) return;
      if (noteCats().indexOf(t) < 0) { E.tags = (E.tags || []).concat([t]); markDirty(); }
      IMGCATS[k] = imgCats(k).concat([t]).filter(function (c, i, a) { return a.indexOf(c) === i; }); renderStyle(); again();
    };
    n.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); add(); } }; n.onchange = add;
  }
  function poolGrid(list, on, picked, tank) {
    return '<div class="npool' + (tank ? ' tk' : '') + '">' + list.map(function (x) {
      var src = tank ? TANKSAVED[x.b.name] || '/assets/alta/backdrops/' + esc(x.b.file) + (x.b.v ? '?r=' + esc(x.b.v) : '') : bdSrc(x.b);
      return '<button type="button" data-np="' + esc(x.b.name) + '" class="' + (x.b.name === on ? 'on' : '') + '" aria-pressed="' + (x.b.name === on) + '"><img alt="" src="' + src + '"><span>' + esc(x.b.name) +
        '<small>' + (x.b.name === on ? (picked ? 'chosen: ' + esc(picked) : 'this Note\'s own') : 'in ' + esc(x.cats.map(catName).join(', '))) + '</small></span></button>'; }).join('') + '</div>';
  }
  function renderBd() {
    var box = $('#bdBox'); if (!box) return;
    renderLookData().then(function (r) {
      var bds = r[2].list, bcats = {}, nc = noteCats(), Bk = E.narratorBackdrop; if (Bk && Bk.fit === 'category') Bk = null;   // a category's is ticked above
      Object.keys(r[2].cats).concat(Object.keys(CATBDNEW)).forEach(function (k) { var v = k in CATBDNEW ? CATBDNEW[k] : r[2].cats[k]; if (v) bcats[k] = v; });
      var has = function (n) { return bds.filter(function (b) { return b.name === n; })[0]; };
      var own = Bk && has(Bk.backdrop), waiting = BDNEW && Bk && BDNEW.name === Bk.backdrop;

      var opts = '<option value="">None: her category\'s, or the plain teal</option>' + bds.map(function (b) { return '<option value="' + esc(b.name) + '">' + esc(b.name + (b.about ? ' · ' + b.about : '')) + '</option>'; }).join('') +
        (Bk && !own ? '<option value="' + esc(Bk.backdrop) + '">' + esc(Bk.backdrop) + (waiting ? ' (new: saves with the Note)' : ' (not made yet)') + '</option>' : '') + '<option value="__new">+ A new backdrop just for this Note…</option>';
      var scene = Bk ? (Bk.scene || (own && own.scene) || '') : '';
      var making = Bk && (!own || waiting || BDNEW === 'replace');
      var J = r[3] || {}, np = notePool(J, 'bd'), now = gaPick(J), auto = now && now.backdrop && now.backdrop.from === 'category' ? now.backdrop : null;
      var pinned = Bk && own && !waiting && np.some(function (x) { return x.b.name === Bk.backdrop; });
      box.innerHTML = (np.length ? '<p class="muted"><b>From its categories\' pools</b> (' + np.length + '): ' + (pinned ? 'this Note keeps the one you picked.' : auto ? 'it wears the one that fits its words and colours best.' : 'a holiday or its own backdrop comes first.') + ' Pick one to keep it on this Note.</p>' +
          poolGrid(np, pinned ? Bk.backdrop : auto ? auto.name : '', pinned ? '' : auto ? (auto.why || '').replace(/^from [^,]*,? ?/, '').replace(/^fits /, '') || 'the only one' : '', false) +
          (pinned ? '<div class="row"><button type="button" id="bdLet">Let it choose again</button></div>' : '') : '') +
        '<p class="muted">Or any backdrop, or a new one made for this Note: when you save, a new one joins the pools of the categories you tick for it.</p>' +
        field('This Note\'s own backdrop', '<select id="bdPickSel">' + opts + '</select>') +
        (own && !waiting ? '<img class="ga-bdimg" alt="" src="' + bdSrc(own) + '"><div class="row"><button type="button" id="bdReplace">Replace it with a new render</button></div>' : '') +
        (making ? field('The place', '<textarea id="bdScene" rows="2" placeholder="e.g. ' + esc(sceneFor(nc) || 'a cozy, warmly lit room') + '">' + esc(scene) + '</textarea>', 'A few words; the prompt below is built from them') +
          field('Image prompt', '<textarea id="bdPrompt" rows="5" readonly>' + esc(GALook.bdPrompt(scene || sceneFor(nc))) + '</textarea>') +
          '<div class="row"><button type="button" id="bdCopy">Copy the image prompt</button></div>' + bdTpl() +
          '<label class="drop ga-drop" id="bdDrop"><input type="file" id="bdFile" accept="image/png,image/jpeg,image/webp" hidden><b>' + (waiting ? 'Choose a different render' : 'Bring the render back') + '</b> <span class="muted">or drop it here</span></label><div id="bdOut"></div>' +
          (!own ? imgCatsHtml('bd') : '') : '');
      $('#bdPickSel').value = Bk ? Bk.backdrop : ''; renderStyle();
      $('#bdPickSel').onchange = function () {
        var v = this.value;
        if (v === '__new') {
          var n = slug(prompt('A name for the new backdrop (lowercase, with dashes), e.g. bike-shop:') || '').slice(0, 40);
          if (!n) { renderBd(); return; }
          if (has(n)) { toast(n + ' already exists: pick it from the list.', true); renderBd(); return; }
          E.narratorBackdrop = { backdrop: n, fit: 'new', scene: sceneFor(nc) }; markDirty(); renderBd(); return;
        }
        E.narratorBackdrop = v ? { backdrop: v, fit: 'existing', scene: (has(v) || {}).scene || '' } : null; BDNEW = null; markDirty(); renderBd();
      };
      var rp = $('#bdReplace'); if (rp) rp.onclick = function () { BDNEW = 'replace'; renderBd(); };
      $$('[data-np]', box).forEach(function (el) { el.onclick = function () { var v = el.getAttribute('data-np'); E.narratorBackdrop = { backdrop: v, fit: 'existing', scene: (has(v) || {}).scene || '' }; BDNEW = null; markDirty(); renderBd(); }; });
      var bl = $('#bdLet'); if (bl) bl.onclick = function () { E.narratorBackdrop = null; BDNEW = null; markDirty(); renderBd(); };
      var sc = $('#bdScene'); if (sc) sc.oninput = function () { E.narratorBackdrop.scene = sc.value; $('#bdPrompt').value = GALook.bdPrompt(sc.value || sceneFor(nc)); markDirty(); };
      var cp = $('#bdCopy'); if (cp) cp.onclick = function () { navigator.clipboard.writeText($('#bdPrompt').value).then(function () { toast('Image prompt copied.'); }); };
      wireTpl(box); imgCatsWire(box, 'bd', renderBd);
      var drop = $('#bdDrop'); if (!drop) return;
      function take(f) {
        if (!f) return; $('#bdOut').innerHTML = '<p class="muted">Working…</p>';
        GALook.backdrop(f).then(function (res) { BDNEW = { name: Bk.backdrop, blob: res.blob, ext: res.ext, url: URL.createObjectURL(res.blob), preview: res.preview, warn: res.warn }; markDirty(); renderBd(); })
          .catch(function (e) { $('#bdOut').innerHTML = ''; toast(e.message, true); });
      }
      $('#bdFile').onchange = function () { take(this.files[0]); this.value = ''; };
      ['dragover', 'dragenter'].forEach(function (t) { drop.addEventListener(t, function (ev) { ev.preventDefault(); }); });
      drop.addEventListener('drop', function (ev) { ev.preventDefault(); take(ev.dataTransfer.files[0]); });
      if (waiting) {
        var o = $('#bdOut'); o.innerHTML = (BDNEW.warn ? '<p class="warn">' + esc(BDNEW.warn) + '</p>' : '') + '<p class="muted">As the bar shows it. It goes live as <code>' + esc(Bk.backdrop) + '</code> when you Save' + (own ? ', in place of the one there now' : '') + '.</p>';
        BDNEW.preview.className = 'ga-prev'; o.insertBefore(BDNEW.preview, o.firstChild);
      }
    });
  }
  function renderLook() {
    var box = $('#lookBox'); if (!box) return;
    renderLookData().then(function (r) {
      var list = r[0], cats = {}; Object.keys(r[1]).concat(Object.keys(CATNEW)).forEach(function (k) { var v = k in CATNEW ? CATNEW[k] : r[1][k]; if (v) cats[k] = v; });
      var L = E.narratorLook; if (L && L.fit === 'category') L = null;   // a category's cap is ticked above, not here
      var entry = L && list.filter(function (l) { return l.name === L.look; })[0];
      var made = L && (L.look === 'curls' || !!entry), own = !!entry && !entry.to && !entry.rotate && !entry.marley;   // own: a Note look (not a holiday or hair style)
      var waiting = LOOKNEW && L && LOOKNEW.name === L.look;
      var opts = '<option value="">None: her category or holiday look</option><option value="curls">curls</option>' + list.filter(function (l) { return l.name !== LOOKDEL; }).map(function (l) { return '<option value="' + esc(l.name) + '">' + esc(l.name + (l.about ? ' · ' + l.about : '')) + '</option>'; }).join('') +
        (L && !made ? '<option value="' + esc(L.look) + '">' + esc(L.look) + (waiting ? ' (new: saves with the Note)' : ' (not made yet)') + '</option>' : '') +
        '<option value="__new">+ A new look just for this Note…</option>';
      var tpl = '<div class="ga-tpl"><img alt="Her template" src="/assets/narrator/kit/her-template.png">' +
        '<span><b>Her template</b><br><span class="muted">Start every look from this image.</span><br>' +
        '<button type="button" id="copyTpl">Copy the image</button> <a href="/assets/narrator/kit/her-template.png" download>Download</a> · ' +
        '<a href="/assets/narrator/kit/her-edit-mask.png" download>Mask</a> · <a href="/assets/narrator/kit/her-contact-sheet.jpg" target="_blank" rel="noopener">Rules</a></span></div>';
      var canMake = L && (!made || (own && (LOOKREPL || waiting)));   // a new look, or a Note look being replaced (after Replace)
      box.innerHTML = '<p class="muted">A cap just for this Note, in place of its category\'s. Claude may suggest one when drafting.</p>' +
        (LOOKDEL ? '<p class="warn"><b>' + esc(LOOKDEL) + '</b> comes off the site when you Save (its image and its line). Notes that wore it go back to her holiday look. <button type="button" id="lookUndel">Keep it</button></p>' : '') +
        field('This Note\'s own cap', '<select id="lookPick">' + opts + '</select>', L && L.why ? esc(L.why) : '') +
        (made && entry && !waiting ? '<img class="ga-made" alt="" src="' + lookSrc(entry) + '">' : '') +
        (L && !made && !waiting ? '<p><b>Not made yet.</b> Copy the prompt and her template into your image tool, render it, and bring the image back here. Until then she wears her holiday look.</p>' : '') +
        (canMake ? field('Image prompt', '<textarea id="lookPrompt" rows="5">' + esc(L.prompt || '') + '</textarea>') + (L.prompt ? '<div class="row"><button type="button" id="copyLook">Copy the image prompt</button></div>' : '') : '') +
        (canMake ? tpl : '') +
        (canMake ? '<label class="drop ga-drop" id="lookDrop"><input type="file" id="lookFile" accept="image/png,image/jpeg,image/webp" hidden><b>' +
          (waiting ? 'Choose a different render' : made ? 'Replace it with a new render' : 'Bring the rendered image back') + '</b> <span class="muted">or drop it here</span></label><div id="lookOut"></div>' : '') +
        (own && !waiting && !LOOKREPL ? '<div class="row"><button type="button" id="lookRepl">Replace it with a new render</button><button type="button" class="danger" id="lookDel">Remove ' + esc(entry.name) + ' from the site</button></div>' : '') +
        (waiting ? '<div class="row"><button type="button" id="lookCancel">Don\'t use this render</button></div>' : '');
      $('#lookPick').value = L && L.fit !== 'category' ? L.look : ''; renderStyle();
      $('#lookPick').onchange = function () {
        if (this.value === '__new') {   // her own look for this Note only: a name, then a render brought back below
          var n = slug(prompt('A name for her new look (lowercase, with dashes), e.g. rain-hood:') || '').slice(0, 40);
          if (!n) { renderLook(); return; }
          if (n === 'curls' || list.some(function (x) { return x.name === n; })) { toast(n + ' already exists: pick it from the list.', true); renderLook(); return; }
          E.narratorLook = { look: n, fit: 'new', about: '', why: '', prompt: '', bulb: true }; markDirty(); renderLook(); return;
        }
        var v = this.value, l = list.filter(function (x) { return x.name === v; })[0];
        E.narratorLook = !v ? null : L && L.look === v ? L : { look: v, fit: 'existing', about: (l && l.about) || '', why: '', prompt: '', bulb: !(l && l.bulb === false) };
        markDirty(); renderLook();
      };
      var ct = $('#copyTpl'); if (ct) ct.onclick = function () { GALook.copyTemplate().then(function () { toast('Her template is on the clipboard: paste it into your image tool.'); }, function (e) { toast(e.message, true); }); };
      var lp = $('#lookPrompt'); if (lp) lp.oninput = function () { E.narratorLook.prompt = lp.value; markDirty(); };
      var cb = $('#copyLook'); if (cb) cb.onclick = function () { navigator.clipboard.writeText($('#lookPrompt').value).then(function () { toast('Image prompt copied.'); }); };
      var rpl = $('#lookRepl'); if (rpl) rpl.onclick = function () { LOOKREPL = true; renderLook(); };
      var del = $('#lookDel'); if (del) del.onclick = function () {
        if (!confirm('Take ' + entry.name + ' off the site when you Save? Its image and its line go; any Note that wore it goes back to her holiday look.')) return;
        LOOKDEL = entry.name; E.narratorLook = null; markDirty(); renderLook();
      };
      var und = $('#lookUndel'); if (und) und.onclick = function () { LOOKDEL = null; renderLook(); };
      var cn = $('#lookCancel'); if (cn) cn.onclick = function () { URL.revokeObjectURL(LOOKNEW.url); LOOKNEW = null; renderLook(); };
      var drop = $('#lookDrop'); if (!drop) return;
      function take(f) {
        if (!f) return;
        $('#lookOut').innerHTML = '<p class="muted">Working…</p>';
        GALook.make(f).then(function (r) {
          if (LOOKNEW && LOOKNEW.url) URL.revokeObjectURL(LOOKNEW.url);
          LOOKNEW = { name: L.look, blob: r.blob, ext: r.ext, url: URL.createObjectURL(r.blob), preview: r.preview, warn: r.warn, out: r.out, flair: r.flair }; markDirty();
          renderLook();
        }).catch(function (e) { $('#lookOut').innerHTML = ''; toast(e.message, true); });
      }
      $('#lookFile').onchange = function () { take(this.files[0]); this.value = ''; };
      ['dragover', 'dragenter'].forEach(function (t) { drop.addEventListener(t, function (ev) { ev.preventDefault(); }); });
      drop.addEventListener('drop', function (ev) { ev.preventDefault(); take(ev.dataTransfer.files[0]); });
      if (waiting) {
        var out = $('#lookOut'); out.innerHTML = (LOOKNEW.warn ? '<p class="warn">' + esc(LOOKNEW.warn) + '</p>' : '') +
          '<p class="muted">At rest, talking and blinking. It goes live as <code>' + esc(L.look) + '</code> when you Save' + (made ? ', in place of the one there now' : '') + '.</p>' +
          '<label class="ga-check"><input type="checkbox" id="lookBulb"' + (L.bulb !== false ? ' checked' : '') + '> Her antenna bulb shows (untick if the look covers it)</label>';
        LOOKNEW.preview.className = 'ga-prev'; out.insertBefore(LOOKNEW.preview, out.firstChild);
        $('#lookBulb').onchange = function () { E.narratorLook.bulb = this.checked; markDirty(); };
        if (LOOKNEW.out) out.appendChild(flairBox(LOOKNEW, E.palette || PAL_SAMPLE, markDirty));
      }
    });
  }
  // what the Social panel (social.js) needs from here
  var socialHelpers = {
    entry: function () { return E; }, cfg: function () { return CFG; }, esc: esc, toast: toast, api: api, name: photoName,
    dirty: markDirty,
    still: function (p) { return p.video ? 'api.php?a=photo&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(p.poster.split('/').pop()) : photoUrl(p); },
    clip: function (p) { return 'api.php?a=clip&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(photoName(p)); },
    audio: function () { return 'api.php?a=audio&id=' + encodeURIComponent(E.id); }
  };
  function count() { var n = words($('#epScript').value); $('#epCount').textContent = n + ' words, about ' + (Math.round(n / 150 * 10) / 10) + ' minutes at the show\'s pace.'; }

  function collect() {
    E.title = $('#title').value.trim(); E.kind = $('#kind').value; E.place = $('#place').value.trim(); E.status = $('#status').value;
    E.consent = $('#consent').value.trim(); E.fieldNotes = $('#fieldNotes').value; E.summary = $('#summary').value.trim();
    E.post.title = $('#postTitle').value.trim(); E.post.body = $('#postBody').value.trim();
    E.episode.title = $('#epTitle').value.trim(); E.episode.script = $('#epScript').value.trim();
    var nv = $('#epNarrator') ? $('#epNarrator').value : ''; if (nv) E.episode.narrator = nv; else delete E.episode.narrator;
    if (!E.id) E.date = $('#date').value;
    $$('.ph').forEach(function (d) {
      var p = E.photos[+d.getAttribute('data-i')]; if (!p) return;
      p.caption = $('textarea', d).value.trim();
      p.use = $('.use', d).checked ? (p.use === 'skip' ? 'post' : (p.use || 'post')) : 'skip';
      p.cover = $('.cover', d).checked;
      var a = $('.phAt', d); if (a) { if (a.value) p.at = a.value; else delete p.at; }
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
  // The post shows its photos and loops top to bottom in this order (an HDR photo's exposure strip moves with it), so
  // ↑ and ↓ on each one set the order. Once the post has "## " subheads, each picture can also sit right under one.
  function photoUnits() { var u = []; E.photos.forEach(function (p, i) { if (p.strip && u.length) u[u.length - 1].push(i); else u.push([i]); }); return u; }
  function movePhoto(i, d) {
    collect();
    var U = photoUnits(), k = -1;
    U.forEach(function (u, j) { if (u[0] === i) k = j; });
    var j = k + d; if (k < 0 || j < 0 || j >= U.length) return;
    var a = U[k]; U[k] = U[j]; U[j] = a;
    var moved = photoName(E.photos[i]), all = E.photos.slice();
    E.photos = [].concat.apply([], U.map(function (u) { return u.map(function (x) { return all[x]; }); }));
    markDirty(); renderPhotos();
    // the moved one glows, then the glow eases away
    var c = $$('.ph', $('#photos')).filter(function (el) { return photoName(E.photos[+el.getAttribute('data-i')]) === moved; })[0];
    if (c) { c.classList.add('moved'); setTimeout(function () { c.classList.remove('moved'); }, 900); var b = $(d < 0 ? '.phUp' : '.phDn', c); if (b && !b.disabled) b.focus(); }
  }
  // New pictures: while the Note is still in the order they were taken, they join it by time; once it's been put in
  // an order by hand, they join at the end, so the order chosen stays. A swap waiting for one puts it in that place.
  var ORDER = null;
  function byTime(a, b) { var x = String(a.takenAt || '~'), y = String(b.takenAt || '~'); return x < y ? -1 : x > y ? 1 : 0; }
  function markOrder() {
    var n = E.photos.length, t = true;
    for (var i = 1; i < n; i++) if (byTime(E.photos[i - 1], E.photos[i]) > 0) t = false;
    ORDER = { n: n, timed: t };
  }
  function settleNew() {
    var o = ORDER || { n: E.photos.length, timed: true }; ORDER = null;
    var added = E.photos.slice(o.n);
    if (SPSWAP != null && added.length) {
      SPI = SPSWAPB;
      var nwp = added.filter(function (p) { return !p.strip; })[0], L = spreadItems();
      if (nwp && L[SPSWAP]) { spreadPut(SPSWAP, nwp); toast('Swapped into the photo spread. Save to keep it.'); SPSWAP = null; renderSwapBar(); if (o.timed) E.photos.sort(byTime); renderSpread(); return; }
    }
    if (SWAP && added.length) {
      var slot = E.photos.map(photoName).indexOf(SWAP.name), nw = added.filter(function (p) { return !p.strip; })[0];
      if (slot >= 0 && nw) {
        var k = E.photos.indexOf(nw), old = photoName(E.photos[slot]);
        swapContents(slot, k);
        var gone = E.photos[k]; gone.use = 'skip'; gone.cover = false; delete gone.at;   // the one swapped out waits at the end, not used
        toast('Swapped in. ' + old + ' is at the end of Photos, not used: Remove it if you don\'t need it.');
        var keep = photoName(E.photos[slot]); SWAP = null; renderSwapBar();
        setTimeout(function () { glowPhoto(keep); }, 0);
        return;
      }
    }
    if (o.timed) E.photos.sort(byTime);
    else E.photos = E.photos.slice(0, o.n).concat(added.sort(byTime));
  }
  // Swap: a picture's place stays (its spot in the order, the subhead it sits under, the cover, and where the
  // magazine and Workshop features use it) while the picture in it changes, to one already in this Note or a new
  // photo or loop. The caption goes with its picture.
  var SWAP = null;   // { name }: the place waiting for a new photo or loop
  var SPSWAP = null, SPSWAPB = 0;   // the photo spread place (its index, in spread SPSWAPB) waiting for a new photo or loop
  var CONTENT = ['src', 'poster', 'video', 'w', 'h', 'caption', 'from', 'takenAt', 'ai', 'hdr', 'range'];
  function swapContents(i, j) {
    var a = E.photos[i], b = E.photos[j], na = photoName(a), nb = photoName(b);
    var pa = a.poster ? a.poster.split('/').pop() : '', pb = b.poster ? b.poster.split('/').pop() : '';
    CONTENT.forEach(function (k) { var x = a[k], y = b[k]; if (y === undefined) delete a[k]; else a[k] = y; if (x === undefined) delete b[k]; else b[k] = x; });
    // what pointed at a place keeps pointing at it: rename references to follow the pictures' new homes
    var map = {}; map[na] = nb; map[nb] = na; if (pa) map[pa] = pb || nb; if (pb) map[pb] = pa || na;
    var fix = function (v) { return v && map.hasOwnProperty(v) ? map[v] : v; };
    if (E.workshop) { (E.workshop.media || []).forEach(function (x) { if (!x.note) x.photo = fix(x.photo); }); if (E.workshop.cover) E.workshop.cover = fix(E.workshop.cover); }
    if (E.feature) (E.feature.blocks || []).forEach(function (bk) { bk.photo = fix(bk.photo); if (!bk.photo) delete bk.photo; (bk.type === 'steps' && bk.items || []).forEach(function (x) { if (x.photo) x.photo = fix(x.photo); }); });
    if (a.cover || b.cover) repalette();
    markDirty();
  }
  function glowPhoto(n) {
    var c = $$('.ph', $('#photos')).filter(function (el) { return photoName(E.photos[+el.getAttribute('data-i')]) === n; })[0];
    if (c) { c.classList.add('moved'); setTimeout(function () { c.classList.remove('moved'); }, 900); }
  }
  function thumbOf(p) {
    var n = photoName(p);
    if (!p.video) return photoUrl(p);
    if (clipsNew[n]) return 'api.php?a=vfile&t=poster&k=' + clipsNew[n].token;
    var pn = p.poster ? p.poster.split('/').pop() : '';
    return posterNew[pn] ? posterNew[pn].url : E.id && pn ? 'api.php?a=photo&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(pn) + posterBust : '';
  }
  function canSwap(p, i) { return !p.strip && !(p.hdr && E.photos[i + 1] && E.photos[i + 1].strip); }   // an HDR photo stays with its exposure strip
  function renderSwapBar() {
    var b = $('#swapBar'); if (!b) return;
    b.hidden = !SWAP && SPSWAP == null;
    if (!SWAP && SPSWAP == null) { b.innerHTML = ''; return; }
    b.innerHTML = '<span>The next photo or loop you add goes into the place of <b>' + esc(SWAP ? SWAP.name : 'picture ' + (SPSWAP + 1) + ' of the photo spread' + (spreads().length > 1 ? ' "' + (spreads()[SPSWAPB] || {}).title + '"' : '')) + '</b>.</span> <button type="button" class="link" id="swapX">Cancel the swap</button>';
    $('#swapX').onclick = function () { SWAP = null; SPSWAP = null; renderSwapBar(); };
  }
  function swapPicker(i) {
    collect();
    var p = E.photos[i], n = photoName(p);
    var d = document.createElement('dialog'); d.className = 'pfp swp';
    var others = E.photos.map(function (q, j) { return { q: q, j: j }; }).filter(function (o) { return o.j !== i && canSwap(o.q, o.j); });
    d.innerHTML = '<h2>Swap <small>' + esc(n) + '</small></h2><p class="muted">The new one takes this place: its spot in the order' + (p.at ? ', under "' + esc(p.at) + '"' : '') + (p.cover ? ', the cover' : '') + ', and anywhere a feature uses it. Captions go with their pictures.</p>' +
      '<h3>With a new photo or video</h3><div class="row"><label class="pick swNew">Choose a file<input type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.mov,.m4v" hidden></label>' +
      '<span class="muted">A video opens in Video loops: the loop you make goes here.</span></div>' +
      (others.length ? '<h3>With one already in this Note</h3><p class="muted">The two trade places.</p><div class="swGrid">' + others.map(function (o) {
        var t = thumbOf(o.q);
        return '<button type="button" class="swK" data-j="' + o.j + '" title="' + esc(o.q.caption || photoName(o.q)) + '">' + (t ? '<img src="' + esc(t) + '" alt="">' : '<span class="wsNo"></span>') + '<small>' + esc(photoName(o.q)) + (o.q.use === 'skip' ? ' · not used' : '') + '</small></button>';
      }).join('') + '</div>' : '') +
      '<div class="row"><span class="sp"></span><button type="button" class="link swX">Cancel</button></div>';
    document.body.appendChild(d); d.showModal();
    var close = function () { d.close(); d.remove(); };
    $('.swX', d).onclick = close; d.addEventListener('cancel', close);
    $$('.swK', d).forEach(function (b) { b.onclick = function () {
      var j = +b.getAttribute('data-j'), was = E.photos[j].use;
      swapContents(i, j);
      if (was === 'skip' && p.use !== 'skip') { E.photos[j].use = 'skip'; }   // a picture brought back in from the unused ones: the old one takes its place among them
      close(); renderPhotos(); renderLoops(); glowPhoto(photoName(E.photos[i])); glowPhoto(photoName(E.photos[j]));
      toast('Swapped. Save to keep it.');
    }; });
    $('.swNew input', d).onchange = function () {
      var f = this.files[0]; if (!f) return;
      SWAP = { name: n }; close(); renderSwapBar();
      if (isVideo(f)) { upVideo(f); toast('Make the loop under Video loops; it goes into the place of ' + n + '.'); }
      else addPhotos([f]);
    };
  }
  function subheads() { return ($('#postBody') ? $('#postBody').value : E.post.body || '').split(/\n\s*\n/).map(function (t) { return t.trim(); }).filter(function (t) { return /^## /.test(t); }).map(function (t) { return t.slice(3).trim(); }); }
  function renderPhotos() {
    var box = $('#photos'), none = $('#noPhotos');
    if (none) none.hidden = E.photos.length > 0;   // photos brought in after the page was drawn
    var U = photoUnits(), first = U.length ? U[0][0] : -1, last = U.length ? U[U.length - 1][0] : -1, subs = subheads();
    var oh = $('#photoOrderHint');
    if (oh) oh.hidden = E.photos.length < 2;
    var mv = function (i) { return '<span class="phMv"><button type="button" class="link phUp" aria-label="Move earlier" title="Earlier in the post"' + (i === first ? ' disabled' : '') + '>↑</button><button type="button" class="link phDn" aria-label="Move later" title="Later in the post"' + (i === last ? ' disabled' : '') + '>↓</button></span>'; };
    var at = function (p) {
      if (!subs.length || p.table) return '';
      var cur = p.at || '', known = !cur || subs.indexOf(cur) >= 0;
      return '<select class="phAt" aria-label="Where it sits"><option value="">Spread through the story</option>' + subs.map(function (t) { return '<option value="' + esc(t) + '"' + (t === cur ? ' selected' : '') + '>Under "' + esc(t) + '"</option>'; }).join('') +
        (known ? '' : '<option value="' + esc(cur) + '" selected>Under "' + esc(cur) + '" (not in the post now)</option>') + '</select>';
    };
    box.innerHTML = E.photos.map(function (p, i) {
      var n = photoName(p), clip = !!p.video;
      // a bracket's exposure strip spans the row, whole, right under its HDR photo, so it reads as the three shots it is
      if (p.strip) {
        var hd = E.photos[i - 1] && E.photos[i - 1].hdr ? photoName(E.photos[i - 1]) : '';
        return '<div class="ph strip' + (p.use === 'skip' ? ' off' : '') + '" data-i="' + i + '">' +
          '<img src="' + esc(photoUrl(p)) + '" alt="" loading="lazy">' +
          '<div class="meta"><small><b>Exposure strip</b>' + (hd ? ' for ' + esc(hd) : '') + ' · its ' + p.strip + ' shots, darkest to brightest, as they came off the camera · ' + esc(n) + (fresh[n] ? ' · new' : '') + '</small>' +
          '<textarea rows="1" placeholder="Caption">' + esc(p.caption) + '</textarea>' +
          '<div class="opts"><label><input type="checkbox" class="use"' + (p.use !== 'skip' ? ' checked' : '') + '> Show in the post</label>' +
          '<input type="radio" name="cover" class="cover" hidden' + (p.cover ? ' checked' : '') + '>' +
          '<button class="link rm">Remove</button></div></div></div>';
      }
      return '<div class="ph' + (p.use === 'skip' ? ' off' : '') + '" data-i="' + i + '">' +
        (clip ? clipView(p, n) : '<img src="' + esc(photoUrl(p)) + '" alt="" loading="lazy">') +
        '<div class="meta"><small>' + esc(n) + (p.hdr ? ' · HDR of ' + p.hdr : '') + (p.strip ? ' · its ' + p.strip + ' exposures' : '') + (p.table ? ' · on the table' : '') + (p.takenAt ? ' · ' + esc(String(p.takenAt).slice(11, 16)) : '') + (fresh[n] || clipsNew[n] ? ' · new' : '') + '</small>' +
        '<textarea rows="2" placeholder="Caption">' + esc(p.caption) + '</textarea>' +
        '<div class="opts"><label><input type="checkbox" class="use"' + (p.use !== 'skip' ? ' checked' : '') + '> Use</label>' +
        '<label><input type="radio" name="cover" class="cover"' + (p.cover ? ' checked' : '') + '> Cover</label>' + (clip ? '<button type="button" class="link pfBtn">Poster frame</button>' : '') +
        (canSwap(p, i) ? '<button type="button" class="link swBtn">Swap</button>' : '') + '<button class="link rm">Remove</button>' + mv(i) + '</div>' + at(p) + '</div></div>';
    }).join('');
    $$('.ph', box).forEach(function (d) {
      $('textarea', d).addEventListener('input', markDirty);
      $$('input', d).forEach(function (i) { i.addEventListener('change', function () { markDirty(); collect(); d.classList.toggle('off', !$('.use', d).checked); if (i.classList.contains('cover')) repalette(); renderFeature(); renderMag(); }); });
      var pa = $('.phAt', d); if (pa) pa.onchange = function () { markDirty(); collect(); };
      var pu = $('.phUp', d), pd = $('.phDn', d), ix = +d.getAttribute('data-i');
      if (pu) pu.onclick = function () { movePhoto(ix, -1); };
      if (pd) pd.onclick = function () { movePhoto(ix, 1); };
      var sw = $('.swBtn', d); if (sw) sw.onclick = function () { swapPicker(ix); };
      $('textarea', d).addEventListener('change', renderFeature);
      $('.rm', d).onclick = function () {
        if (!confirm('Remove this photo from the entry?')) return;
        collect();
        var i = +d.getAttribute('data-i'), p = E.photos[i], n = photoName(p);
        if (p.poster) delete posterNew[p.poster.split('/').pop()];
        // a picture the photo spread still shows keeps its file (it leaves the photo list, not the spread)
        var inSpread = function (m) { return spreadItems().some(function (x) { return x.src.split('/').pop() === m || (x.poster && x.poster.split('/').pop() === m); }); };
        if (fresh[n]) { if (!inSpread(n)) delete fresh[n]; } else if (clipsNew[n]) delete clipsNew[n]; else { if (!inSpread(n)) removed.push(n); if (p.poster && !inSpread(p.poster.split('/').pop())) removed.push(p.poster.split('/').pop()); }
        E.photos.splice(i, 1);
        if (SWAP && SWAP.name === n) { SWAP = null; renderSwapBar(); }
        if (E.workshop && E.workshop.media) E.workshop.media = E.workshop.media.filter(function (x) { return x.note || featFind(x); });
        markDirty(); renderPhotos(); renderLoops();
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
    renderFeature(); renderMag(); renderSpread();
  }

  // ---------- the Workshop feature: this Note as one of the big projects on the Workshop tab (E.workshop). The
  // build (field/tools/wsprojects.py, from publish.mjs) makes assets/workshop/projects.json from the Published Notes,
  // so this is where a feature is edited: the card's name and tagline, its place on the tab, the pull quote, the
  // numbers, the buttons, the picture on the card, and where each picture sits in the story ----------
  function featFind(x) {   // a feature entry's photo or loop on this Note (a loop's poster frame can stand in as a still)
    return x.note ? null : E.photos.filter(function (p) { return photoName(p) === x.photo || (p.poster && p.poster.split('/').pop() === x.photo); })[0] || null;
  }
  function featPics() {   // the feature's pictures in order: the ones it lists, then the Note's others (they join at the end)
    var out = [], hidden = [], seen = {};
    (E.workshop.media || []).forEach(function (x) {
      var p = featFind(x);
      if (x.note || (p && p.use !== 'skip')) out.push(x); else if (p) hidden.push(x);   // kept for when it's used again
      if (p) seen[photoName(p)] = 1;
    });
    E.photos.forEach(function (p) { if (p.use !== 'skip' && !seen[photoName(p)]) out.push({ photo: photoName(p) }); });
    return { list: out, hidden: hidden };
  }
  function featThumb(x) {
    var p = featFind(x); if (!p) return '';
    var n = photoName(p);
    if (!p.video || x.photo !== n) return p.video ? 'api.php?a=photo&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(x.photo) : photoUrl(p);
    return clipsNew[n] ? 'api.php?a=vfile&t=poster&k=' + clipsNew[n].token : E.id ? 'api.php?a=photo&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(p.poster.split('/').pop()) + posterBust : '';
  }
  function renderFeature() {
    var box = $('#featBox'); if (!box || !E) return;
    var W = E.workshop;
    if (!W) {
      box.innerHTML = '<p class="muted">Make this Note one of the big projects on the Workshop tab: a magazine feature with its post as the story, its photos and loops through the column, a pull quote and its numbers, all edited here. It shows once the Note is published.</p>' +
        '<button type="button" class="small" id="wsOn">Make it a Workshop feature</button>';
      $('#wsOn').onclick = function () { collect(); E.workshop = { order: null, name: E.title, tagline: '', pull: '', numbers: [], links: [], media: [] }; markDirty(); renderFeature(); };
      return;
    }
    var paras = ($('#postBody') ? $('#postBody').value : E.post.body || '').split(/\n\s*\n/).map(function (t) { return t.trim(); }).filter(Boolean);
    var P = featPics(), cov = W.cover || ((E.photos.filter(function (p) { return p.cover && p.use !== 'skip'; })[0] || {}).src || '').split('/').pop();
    var inp = function (k, v, ph) { return '<input class="wsF" data-k="' + k + '" value="' + esc(v || '') + '" placeholder="' + esc(ph || '') + '">'; };
    var ln = W.links || [];
    box.innerHTML = '<p class="muted">Its story is the post, its headline the post\'s title, its deck the card summary. Shows once the Note is published; the site updates on the next deploy.</p>' +
      '<div class="grid2">' + field('Name on the card', inp('name', W.name, E.title)) + field('Tagline', inp('tagline', W.tagline, 'One line under the name')) +
        field('Place on the tab', '<input class="wsF" data-k="order" type="number" min="1" max="99" value="' + esc(W.order || '') + '">', '1 comes first; left empty, it goes last') + '</div>' +
      field('Pull quote', '<textarea class="wsF" data-k="pull" rows="2" placeholder="A line from the story, set large after the second paragraph">' + esc(W.pull || '') + '</textarea>') +
      '<h3>By the numbers</h3><div class="wsNums">' + (W.numbers || []).map(function (x, i) {
        return '<div class="row wsNum" data-i="' + i + '"><input class="wsN0" value="' + esc(x[0]) + '" placeholder="124" aria-label="Figure"><input class="wsN1" value="' + esc(x[1]) + '" placeholder="video files behind one header" aria-label="What it counts"><button type="button" class="link wsNx">Remove</button></div>';
      }).join('') + '</div><button type="button" class="small" id="wsNadd">Add a number</button>' +
      '<h3>Buttons</h3>' + [0, 1].map(function (i) {
        var l = ln[i] || {};
        return '<div class="row wsLink" data-i="' + i + '"><input class="wsL0" value="' + esc(l.label || '') + '" placeholder="' + (i ? 'Another link (optional)' : 'e.g. Open the Studio') + '" aria-label="Label"><input class="wsL1" value="' + esc(l.url || '') + '" placeholder="' + (i ? 'Its address' : '/studio/') + '" aria-label="Address"></div>';
      }).join('') + '<small class="muted">"Listen to its episode" is always there too.</small>' +
      '<h3>Pictures</h3><p class="muted">In this order through the story: each one spread evenly, or right after the paragraph you pick. Card is the one on the Workshop card and at the top of the feature.</p>' +
      '<ul class="wsPics">' + P.list.map(function (x, k) {
        var p = featFind(x), t = featThumb(x), at = x.off ? 'off' : x.after ? String(x.after) : '';
        var label = x.note ? 'From ' + x.note + ': ' + x.photo : x.photo + (p && p.video && x.photo === photoName(p) ? ' · loop' : p && p.video ? ' · still of a loop' : '');
        return '<li class="wsPic' + (x.off ? ' off' : '') + '" data-k="' + k + '">' + (t ? '<img src="' + esc(t) + '" alt="" loading="lazy">' : '<span class="wsNo"></span>') +
          '<span class="wsPicT"><b>' + esc(label) + '</b><small>' + esc((x.caption || (p && p.caption) || '').slice(0, 90)) + '</small></span>' +
          '<select class="wsAt" aria-label="Where it goes"><option value="">Spread through the story</option>' + paras.map(function (t, i) {
            return '<option value="' + (i + 1) + '"' + (at === String(i + 1) ? ' selected' : '') + '>After paragraph ' + (i + 1) + ': ' + esc(t.split(/\s+/).slice(0, 6).join(' ')) + '…</option>';
          }).join('') + (+at > paras.length ? '<option value="' + at + '" selected>After paragraph ' + at + ' (there are ' + paras.length + ')</option>' : '') +
          '<option value="off"' + (at === 'off' ? ' selected' : '') + '>Not in the feature</option></select>' +
          (x.note ? '' : '<label><input type="radio" name="wsCov" class="wsCov"' + (x.photo === cov ? ' checked' : '') + '> Card</label>') +
          (x.note || !p ? '' : '<button type="button" class="link wsSw">Swap</button>') +
          '<span class="wsMv"><button type="button" class="link wsUp" aria-label="Earlier"' + (k ? '' : ' disabled') + '>↑</button><button type="button" class="link wsDn" aria-label="Later"' + (k < P.list.length - 1 ? '' : ' disabled') + '>↓</button></span></li>';
      }).join('') + '</ul>' + (P.list.length ? '' : '<p class="muted">No photos or loops yet.</p>') +
      '<button type="button" class="link" id="wsOff">Take it off the Workshop tab</button>';
    var save = function () { E.workshop.media = P.list.concat(P.hidden).map(function (x) { var o = {}; ['note', 'photo', 'caption', 'after', 'off'].forEach(function (k) { if (x[k]) o[k] = x[k]; }); return o; }); markDirty(); };
    $$('.wsF', box).forEach(function (el) { el.addEventListener('input', function () { var k = el.getAttribute('data-k'); W[k] = k === 'order' ? (+el.value || null) : el.value.trim(); markDirty(); }); });
    var nums = function () { W.numbers = $$('.wsNum', box).map(function (r) { return [$('.wsN0', r).value.trim(), $('.wsN1', r).value.trim()]; }); markDirty(); };
    $$('.wsN0, .wsN1', box).forEach(function (el) { el.addEventListener('input', nums); });
    $$('.wsNx', box).forEach(function (b) { b.onclick = function () { W.numbers.splice(+b.parentNode.getAttribute('data-i'), 1); markDirty(); renderFeature(); }; });
    $('#wsNadd').onclick = function () { (W.numbers = W.numbers || []).push(['', '']); renderFeature(); var r = $$('.wsN0', box).pop(); if (r) r.focus(); };
    $$('.wsL0, .wsL1', box).forEach(function (el) { el.addEventListener('input', function () {
      W.links = $$('.wsLink', box).map(function (r) { return { label: $('.wsL0', r).value.trim(), url: $('.wsL1', r).value.trim() }; }).filter(function (l) { return l.label || l.url; }); markDirty();
    }); });
    $$('.wsPic', box).forEach(function (li) {
      var k = +li.getAttribute('data-k'), x = P.list[k];
      $('.wsAt', li).onchange = function () { var v = this.value; delete x.after; delete x.off; if (v === 'off') x.off = true; else if (v) x.after = +v; save(); renderFeature(); };
      var c = $('.wsCov', li); if (c) c.onchange = function () { W.cover = x.photo; markDirty(); };
      var sw = $('.wsSw', li); if (sw) sw.onclick = function () { var p = featFind(x), i = E.photos.indexOf(p); if (i >= 0) swapPicker(i); };
      $('.wsUp', li).onclick = function () { P.list.splice(k - 1, 0, P.list.splice(k, 1)[0]); save(); renderFeature(); };
      $('.wsDn', li).onclick = function () { P.list.splice(k + 1, 0, P.list.splice(k, 1)[0]); save(); renderFeature(); };
    });
    $('#wsOff').onclick = function () { if (!confirm('Take this Note off the Workshop tab? Its pull quote, numbers and picture places go too.')) return; delete E.workshop; markDirty(); renderFeature(); };
  }
  // ---------- the Magazine template: this Note dressed as a feature in one of the made-up magazines
  // (field/data/magazines.json; e.feature, built by field/tools/publish.mjs, looks in css/feature.css). Pick any
  // template; the checklist shows what that template wants that the Note doesn't have yet, and Claude can write the
  // missing words from the Note (never new facts) and the prompts for pictures still to be made ----------
  var MAG_OPEN = false;   // the template picker, opened on a Note that already has one
  var MAG_BUSY = false;
  var MAG_WANTS = { specs: 'A spec box', stats: 'A stats strip', goodbad: 'Good and bad', verdict: 'A verdict with a score', box: 'A sidebar box',
    callouts: 'A picture with numbered callouts', steps: 'Numbered steps', timeline: 'A timeline', code: 'A code or prompt block', qa: 'A Q&A', spotted: 'A Spotted box' };
  function mags() { return (CFG && CFG.magazines) || []; }
  function magOf(F) { var id = F && F.theme || 'riveting'; return mags().filter(function (t) { return t.id === id; })[0] || null; }
  // THE PHOTO SPREAD (feature.lookbook): a grid of pictures with a name and a line each, set just before a subhead of
  // the post (field/tools/publish.mjs). Pictures come from this Note's photos (a loop gives its poster frame); once in
  // the spread they show there instead of between the paragraphs, and keep their files even if they leave Photos.
  // A Note can have more than one (feature.lookbook: one spread, or a list of them); the panel edits one at a time (SPI)
  var SPI = 0;
  function spreads() { var L = E && E.feature && E.feature.lookbook; return Array.isArray(L) ? L : L ? [L] : []; }
  function setSpreads(list) { if (!list.length) delete E.feature.lookbook; else E.feature.lookbook = list.length === 1 ? list[0] : list; SPI = Math.max(0, Math.min(SPI, list.length - 1)); }
  function spreadCur() { var b = spreads(); if (SPI >= b.length) SPI = Math.max(0, b.length - 1); return b[SPI] || null; }
  function spreadItems() { var b = spreadCur(); return (b && b.items) || []; }
  function spreadHint() {
    var b = spreads(); if (!b.length) return 'none yet';
    if (b.length > 1) return b.length + ' spreads · ' + b.reduce(function (n, x) { return n + (x.items || []).length; }, 0) + ' pictures';
    var n = spreadItems().length; return n + ' picture' + (n > 1 ? 's' : '') + (b[0].before ? ' · before "' + b[0].before + '"' : ' · at the end');
  }
  // put a Note photo or loop into spread place i (its name and line stay)
  function spreadPut(i, p) {
    var x = spreadItems()[i]; if (!x || !p) return;
    x.src = p.src; x.w = p.w || 1600; x.h = p.h || 900;
    if (p.video) { x.video = true; x.poster = p.poster; } else { delete x.video; delete x.poster; }
    markDirty();
  }
  // swap spread place i: for another photo or loop of this Note, or a new file (it joins Photos and comes here)
  function spreadSwap(i) {
    collect();
    var x = spreadItems()[i], d = document.createElement('dialog'); d.className = 'pfp swp';
    var others = (E.photos || []).filter(function (p) { return p.src && !p.strip && p.src !== x.src; });
    d.innerHTML = '<h2>Swap <small>' + esc(x.name || x.src.split('/').pop()) + '</small></h2><p class="muted">The new one takes this place in the photo spread, with its name and line.</p>' +
      '<h3>With a new photo or video</h3><div class="row"><label class="pick swNew">Choose a file<input type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.mov,.m4v" hidden></label>' +
      '<span class="muted">It joins Photos; a video opens in Video loops, and the loop you make comes here.</span></div>' +
      (others.length ? '<h3>With a photo or loop of this Note</h3><div class="swGrid">' + others.map(function (p, j) {
        var t = thumbOf(p); return '<button type="button" class="swK" data-j="' + j + '" title="' + esc(p.caption || photoName(p)) + '">' + (t ? '<img src="' + esc(t) + '" alt="">' : '<span class="wsNo"></span>') + '<small>' + esc(photoName(p)) + (p.video ? ' · loop' : '') + '</small></button>';
      }).join('') + '</div>' : '') +
      '<div class="row"><span class="sp"></span><button type="button" class="link swX">Cancel</button></div>';
    document.body.appendChild(d); d.showModal();
    var close = function () { d.close(); d.remove(); };
    $('.swX', d).onclick = close; d.addEventListener('cancel', close);
    $$('.swK', d).forEach(function (b) { b.onclick = function () { spreadPut(i, others[+b.getAttribute('data-j')]); close(); renderSpread(); toast('Swapped. Save to keep it.'); }; });
    $('.swNew input', d).onchange = function () {
      var f = this.files[0]; if (!f) return;
      SWAP = null; SPSWAP = i; SPSWAPB = SPI; close(); renderSwapBar();
      if (isVideo(f)) { upVideo(f); toast('Make the loop under Video loops; it goes into the photo spread.'); } else addPhotos([f]);
    };
  }
  function spreadThumb(x) {
    var n = x.src.split('/').pop(), p = (E.photos || []).find(function (q) { return q.src === x.src || q.poster === x.src; });
    if (p) return thumbOf(p);
    if (x.video && x.poster) n = x.poster.split('/').pop();
    return fresh[n] ? fresh[n].thumb : posterNew[n] ? posterNew[n].thumb || '' : 'api.php?a=photo&id=' + encodeURIComponent(E.id) + '&n=' + encodeURIComponent(n);
  }
  function renderSpread() {
    var box = $('#spreadBox'); if (!box || !E) return;
    var hs = $('#f-spread > summary small'); if (hs) hs.textContent = spreadHint();
    var LB = spreadCur(), items = spreadItems(), all = spreads();
    var subs = (E.post.body || '').split(/\n/).filter(function (l) { return /^## /.test(l); }).map(function (l) { return l.slice(3).trim(); });
    var have = {}; all.forEach(function (b) { (b.items || []).forEach(function (x) { have[x.src] = 1; }); });
    var pick = (E.photos || []).filter(function (p) { return p.src && !p.strip && !have[p.src]; });
    box.innerHTML = '<p class="muted">A grid of pictures with a name and a line each, set before one of the post\'s subheads (a feature\'s look book). Add pictures from this Note\'s photos; in the spread they show there instead of between the paragraphs.</p>' +
      // one tab per spread, and a new one
      (all.length ? '<div class="row spTabs">' + all.map(function (b, n) { return '<button type="button" class="chip spTab' + (n === SPI ? ' on' : '') + '" data-n="' + n + '">' + esc((n + 1) + '. ' + (b.title || 'Untitled')) + '</button>'; }).join('') +
        '<button type="button" class="link" id="spNew">+ A new spread</button></div>' : '') +
      (LB ? '<div class="grid2">' + field('Title', '<input id="spTitle" value="' + esc(LB.title || '') + '" placeholder="Out and about">') +
        field('Before the subhead', '<select id="spBefore"><option value="">At the end of the story</option>' + subs.map(function (s) { return '<option' + (s === LB.before ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>') + '</div>' +
        field('Line under the title', '<textarea id="spDek" rows="2">' + esc(LB.dek || '') + '</textarea>') : '') +
      '<div class="spItems">' + items.map(function (x, i) {
        return '<div class="spItem" data-i="' + i + '"><img src="' + esc(spreadThumb(x)) + '" alt="" loading="lazy"><div class="spF">' +
          '<input class="spName" value="' + esc(x.name || '') + '" placeholder="Its name (set in capitals)">' +
          '<input class="spWhen" value="' + esc(x.when || '') + '" placeholder="A line about it">' +
          '<div class="row"><button type="button" class="link spUp"' + (i ? '' : ' disabled') + '>Up</button><button type="button" class="link spDown"' + (i < items.length - 1 ? '' : ' disabled') + '>Down</button>' +
          '<button type="button" class="link spSw">Swap</button><button type="button" class="link spRm">Remove from the spread</button>' + (x.video ? '<small class="muted">Loop</small>' : '') + (i === 0 ? '<small class="muted">The first is set wide.</small>' : '') + '</div></div></div>';
      }).join('') + '</div>' +
      '<div class="row">' + (pick.length ? '<select id="spAdd"><option value="">Add a picture from this Note…</option>' + pick.map(function (p) {
        return '<option value="' + esc(p.src) + '">' + esc(photoName(p) + (p.video ? ' (loop)' : '') + (p.caption ? ': ' + p.caption.slice(0, 50) : '')) + '</option>'; }).join('') + '</select>'
        : '<span class="muted">' + ((E.photos || []).length ? 'Every photo of this Note is in the spread.' : 'Add photos under Photos first.') + '</span>') +
      (LB ? '<button type="button" class="link" id="spDrop">Remove the whole spread</button>' : '') + '</div>';
    var ensure = function () { E.feature = E.feature || {}; if (!spreads().length) { E.feature.lookbook = { title: 'The photo spread', dek: '', before: '', items: [] }; SPI = 0; } return spreadCur(); };
    var changed = function () { markDirty(); renderSpread(); };
    var add = $('#spAdd'); if (add) add.onchange = function () {
      if (!this.value) return; var s = this.value, p = (E.photos || []).find(function (q) { return q.src === s; }); if (!p) return;
      ensure().items.push({ name: '', when: p.caption || '', alt: p.caption || '' }); spreadPut(ensure().items.length - 1, p); changed();
    };
    var t = $('#spTitle'); if (t) t.oninput = function () { ensure().title = this.value; markDirty(); };
    var dk = $('#spDek'); if (dk) dk.oninput = function () { ensure().dek = this.value; markDirty(); };
    var bf = $('#spBefore'); if (bf) bf.onchange = function () { ensure().before = this.value; changed(); };
    $$('.spItem', box).forEach(function (d) {
      var i = +d.getAttribute('data-i'), L = spreadCur().items;
      $('.spName', d).oninput = function () { L[i].name = this.value; markDirty(); };
      $('.spWhen', d).oninput = function () { L[i].when = this.value; L[i].alt = this.value; markDirty(); };
      $('.spUp', d).onclick = function () { if (i) { L.splice(i - 1, 0, L.splice(i, 1)[0]); changed(); } };
      $('.spDown', d).onclick = function () { if (i < L.length - 1) { L.splice(i + 1, 0, L.splice(i, 1)[0]); changed(); } };
      $('.spSw', d).onclick = function () { spreadSwap(i); };
      $('.spRm', d).onclick = function () { L.splice(i, 1); if (!L.length) setSpreads(spreads().filter(function (b) { return b !== spreadCur(); })); changed(); renderPhotos(); };
    });
    var dr = $('#spDrop'); if (dr) dr.onclick = function () { if (!confirm('Remove this whole photo spread? Its pictures stay in the Note\'s folder.')) return; var c = spreadCur(); setSpreads(spreads().filter(function (b) { return b !== c; })); changed(); };
    $$('.spTab', box).forEach(function (b) { b.onclick = function () { SPI = +b.getAttribute('data-n'); renderSpread(); }; });
    var nw = $('#spNew'); if (nw) nw.onclick = function () { var l = spreads().slice(); l.push({ title: 'A new spread', dek: '', before: '', items: [] }); E.feature.lookbook = l; SPI = l.length - 1; changed(); };
  }
  function magHint() {
    var F = E.feature, t = F && F.masthead ? magOf(F) : null;
    if (!F || !F.masthead) return 'any Note can be a magazine feature';
    var n = magNeeds(F, t).filter(function (x) { return !x.ok; }).length;
    return F.masthead + (n ? ' · ' + n + ' to add' : ' · ready');
  }
  function magNeeds(F, t) {
    var body = $('#postBody') ? $('#postBody').value : E.post.body || '';
    var ps = body.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var used = E.photos.filter(function (p) { return p.use !== 'skip' && !p.strip; }), cov = used.filter(function (p) { return p.cover; })[0];
    var B = F.blocks || [], has = function (ty) { return B.some(function (b) { return b.type === ty; }); };
    var T = (t && t.titles) || {}, want = (t && t.pictures) || 4, pics = used.length - (cov ? 1 : 0);
    var sum = $('#summary') ? $('#summary').value.trim() : E.summary;
    var out = [
      { k: 'masthead', l: 'Masthead', ok: !!F.masthead, by: 'claude' },
      { k: 'tagline', l: 'Tagline', ok: !!F.tagline, by: 'claude' },
      { k: 'issue', l: 'Issue name', ok: !!F.issue, by: 'claude' },
      { k: 'label', l: 'Section label over the headline', ok: !!F.label, by: 'claude' },
      { k: 'byline', l: 'Byline', ok: !!F.byline, by: 'claude' },
      { k: 'coverLines', l: 'Cover lines (3 to 5)', ok: (F.coverLines || []).filter(Boolean).length >= 3, by: 'claude' },
      { k: 'summary', l: 'Card summary (the standfirst)', ok: !!sum, by: 'claude' },
      { k: 'subheads', l: 'Subheads in the post ("## " lines)', ok: ps.filter(function (x) { return /^## /.test(x); }).length >= 2, by: 'claude' },
      { k: 'pull', l: 'A pull quote in the post (a "> " line)', ok: ps.some(function (x) { return /^> /.test(x); }), by: 'claude' },
      { k: 'cover', l: 'A cover picture', ok: !!cov, by: 'picture', why: 'Tick Cover on a photo or loop under Photos' }
    ];
    ((t && t.wants) || []).forEach(function (w) {
      var ok = w === 'qa' ? !!(F.qa && (F.qa.items || []).length) : w === 'spotted' ? (F.spotted || []).length > 0 : has(w);
      out.push({ k: w, l: (MAG_WANTS[w] || w) + (T[w] ? ': "' + T[w] + '"' : ''), ok: ok, by: w === 'callouts' ? 'hand' : 'claude',
        why: w === 'callouts' ? 'Add one under Edit the parts: pick a picture, then click it to place each label' : w === 'qa' ? 'Its answers come from your own words in the notes' : '' });
    });
    out.push({ k: 'pictures', l: 'At least ' + want + ' pictures besides the cover (' + pics + ' now)', ok: pics >= want, by: 'picture', why: pics < want ? (want - pics) + ' more: photos, loops or renders' : '' });
    return out;
  }
  function magNote() {   // what Claude is shown: the Note as it stands in the editor
    collect();
    var s = E.track && E.track.stats;
    return { title: E.title, date: E.date, kind: E.kind, place: E.place, whoAppears: E.consent, notes: E.fieldNotes, summary: E.summary,
      postTitle: E.post.title, postBody: E.post.body, episodeScript: E.episode.script,
      figures: s ? { distanceMiles: mi(s.distanceKm), highPointFeet: ft(s.maxEleM), movingTime: dur(s.movingSec) } : null,
      photos: E.photos.filter(function (p) { return p.use !== 'skip' && !p.strip; }).map(function (p) { return { file: photoName(p), caption: p.caption || '', loop: !!p.video, ai: !!p.ai, cover: !!p.cover }; }),
      feature: E.feature };
  }
  function magBlock(b) {   // Claude's block (flat fields) as publish.mjs wants it
    var o = { type: b.type }, set = function (k, v) { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) o[k] = v; };
    set('title', b.title); set('before', b.before);
    if (b.type === 'specs') { set('rows', b.pairs); set('note', b.note); }
    else if (b.type === 'stats' || b.type === 'timeline') { set('items', b.pairs); set('note', b.note); }
    else if (b.type === 'goodbad') { set('good', b.good); set('bad', b.bad); }
    else if (b.type === 'verdict') { set('score', b.score); set('outOf', b.out_of); set('seal', b.seal); set('scores', (b.scores || []).map(function (x) { return [x.label, x.value, x.max]; })); set('text', b.text); }
    else if (b.type === 'box') { set('kicker', b.kicker); set('text', b.text); }
    else if (b.type === 'steps') set('items', b.steps);
    else if (b.type === 'code') { set('file', b.file); set('code', b.code); set('note', b.note); }
    return o;
  }
  // the post with subheads and a pull quote added is only taken when its own words are all still there, in order
  function sameWords(a, b) {
    var plain = function (t) { return t.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^## /.test(x) && !/^> /.test(x); }).map(function (x) { return x.replace(/\s+/g, ' '); }).join('\n'); };
    return plain(a) === plain(b);
  }
  function magApply(t) {
    collect();
    var F = E.feature || {}, old = magOf(F) || {};
    var keep = function (k) { return F[k] && F[k] !== old[k]; };   // what was written for this Note stays; the old template's defaults change
    F.theme = t.id;
    ['masthead', 'tagline', 'issue', 'label', 'byline'].forEach(function (k) { if (!keep(k) && t[k]) F[k] = t[k]; });
    F.blocks = F.blocks || [];   // the parts keep their own titles: they were written for what they say
    E.feature = F; MAG_OPEN = false; markDirty(); renderMag();
    var n = magNeeds(F, t).filter(function (x) { return !x.ok; }).length;
    toast(t.masthead + ' it is. ' + (n ? n + ' thing' + (n > 1 ? 's' : '') + ' to add: see the checklist.' : 'Nothing missing.'));
  }
  function magWrite(missing, t, btn) {
    if (MAG_BUSY) return; MAG_BUSY = true;
    btn.disabled = true; btn.textContent = 'Claude is writing…';
    api('feature', { note: magNote(), template: t, missing: missing }).then(function (r) {
      var x = r.feature || {}, F = E.feature, got = [], miss = {};
      missing.forEach(function (k) { miss[k] = 1; });
      ['masthead', 'tagline', 'issue', 'label', 'byline'].forEach(function (k) { if (miss[k] && x[k]) { F[k] = x[k]; got.push(k); } });
      if (miss.coverLines && (x.cover_lines || []).length) { F.coverLines = x.cover_lines.slice(0, 5); got.push('cover lines'); }
      if (miss.summary && x.summary) { E.summary = x.summary; if ($('#summary')) $('#summary').value = x.summary; got.push('summary'); }
      if ((miss.subheads || miss.pull) && x.post_body) {
        var cur = $('#postBody').value;
        if (sameWords(cur, x.post_body)) { $('#postBody').value = x.post_body.trim(); E.post.body = x.post_body.trim(); got.push(miss.subheads && miss.pull ? 'subheads and a pull quote' : miss.subheads ? 'subheads' : 'a pull quote'); }
        else toast('Claude changed some of the post\'s words, so its subheads and pull quote weren\'t added. Try again.', true);
      }
      (x.blocks || []).forEach(function (b) { if (miss[b.type] && !(F.blocks || []).some(function (y) { return y.type === b.type; })) { (F.blocks = F.blocks || []).push(magBlock(b)); got.push(MAG_WANTS[b.type].toLowerCase()); } });
      if (miss.qa && x.qa && (x.qa.items || []).length) { F.qa = { title: x.qa.title || (t.titles || {}).qa || 'Questions', items: x.qa.items }; got.push('a Q&A'); }
      if (miss.spotted && (x.spotted || []).length) { F.spotted = x.spotted.map(function (y) { var o = { label: y.label, text: y.text }; if (y.url) o.url = y.url; return o; }); got.push('Spotted'); }
      if ((x.renders || []).length) F.renders = x.renders;
      F.questions = x.questions || [];
      markDirty(); collect(); renderPhotos();
      toast(got.length ? 'Added ' + got.join(', ') + '. Read them over before you publish.' : 'Nothing new came back. See Claude\'s questions.', !got.length);
    }).catch(function (err) { toast('Couldn\'t write them: ' + err.message, true); })
      .then(function () { MAG_BUSY = false; renderMag(); });
  }
  function magGallery(cur) {
    // the template that suits this Note's kind (kinds.json "magazine") comes first, marked
    var fit = (kindOf(E && E.kind) || {}).magazine || '';
    var list = mags().filter(function (t) { return t.id === fit; }).concat(mags().filter(function (t) { return t.id !== fit; }));
    return '<div class="magGal">' + list.map(function (t) {
      var sw = (t.swatches || []).map(function (c) { return '<i data-bg="' + esc(c) + '"></i>'; }).join('');
      var on = cur && cur.id === t.id;
      return '<div class="magCard' + (on ? ' on' : '') + '" data-id="' + esc(t.id) + '"><div class="magSw">' + sw + '</div>' +
        '<b class="magMast" data-fg="' + esc((t.swatches || [])[0] || '#000') + '">' + esc(t.masthead) + '</b><span class="magCat">' + esc(t.category) + (t.id === fit ? ' · suits its kind' : '') + '</span>' +
        '<small>' + esc(t.format) + '</small><span class="magWants">' + (t.wants || []).map(function (w) { return '<em>' + esc((MAG_WANTS[w] || w).replace(/^(A|An) /, '')) + '</em>'; }).join('') + '</span>' +
        '<button type="button" class="small magUse"' + (on ? ' disabled' : '') + '>' + (on ? 'In use' : 'Use this template') + '</button></div>';
    }).join('') + '</div>';
  }
  function renderMag() {
    var box = $('#magBox'); if (!box || !E) return;
    var hs = $('#f-magazine > summary small'); if (hs) hs.textContent = magHint();
    var F = E.feature && E.feature.masthead ? E.feature : null, t = F ? magOf(F) : null;
    if (!mags().length) { box.innerHTML = '<p class="muted">No magazine templates found (field/data/magazines.json).</p>'; return; }
    if (!F) {
      box.innerHTML = '<p class="muted">Dress this Note as a feature in one of the made-up magazines: its cover becomes a magazine cover, its post the cover story, with the template\'s look and building blocks. Pick one; the checklist then shows what it still needs, and Claude can write the missing parts from the Note.</p>' + magGallery(null);
    } else {
      var N = magNeeds(F, t), todo = N.filter(function (x) { return !x.ok; });
      var canWrite = todo.filter(function (x) { return x.by === 'claude' || x.by === 'picture'; }).map(function (x) { return x.k; });
      var inp = function (k, ph) { return '<input class="magF" data-k="' + k + '" value="' + esc(F[k] || '') + '" placeholder="' + esc(ph || '') + '">'; };
      box.innerHTML =
        '<div class="magNow"><div class="magSw">' + ((t && t.swatches) || []).map(function (c) { return '<i data-bg="' + esc(c) + '"></i>'; }).join('') + '</div>' +
          '<div><b>' + esc(t ? t.masthead : F.theme || 'RIVETING TONE') + '</b><small>' + esc(t ? t.category + ' · ' + t.format : '') + '</small></div>' +
          '<button type="button" class="small" id="magPick">' + (MAG_OPEN ? 'Keep this one' : 'Change template') + '</button></div>' +
        '<div class="magPickBox' + (MAG_OPEN ? ' open' : '') + '"' + (MAG_OPEN ? '' : ' inert') + '><div><p class="muted">Switching keeps everything written for this Note; only the template\'s own defaults change. Parts the new one doesn\'t usually have stay in, and you can remove them below.</p>' + magGallery(t) + '</div></div>' +
        '<h3>' + (todo.length ? 'What it still needs' : 'Everything it needs is here') + '</h3><ul class="magNeeds">' + N.map(function (x) {
          return '<li class="' + (x.ok ? 'ok' : 'no') + '"><span class="magTick" aria-hidden="true">' + (x.ok ? '✓' : '○') + '</span><span>' + esc(x.l) +
            (!x.ok && x.why ? '<small>' + esc(x.why) + '</small>' : '') + '</span>' + (x.ok ? '' : '<em>' + (x.by === 'claude' ? 'Claude can write it' : x.by === 'picture' ? 'needs a picture' : 'by hand') + '</em>') + '</li>';
        }).join('') + '</ul>' +
        (canWrite.length ? '<div class="row"><button type="button" class="primary" id="magWrite"' + (MAG_BUSY ? ' disabled' : '') + '>' + (MAG_BUSY ? 'Claude is writing…' : 'Write the missing parts with Claude') + '</button><span class="muted">From the Note only: your notes, the post, the captions, the track. Picture prompts come with it.</span></div>' : '') +
        ((F.questions || []).length ? '<div class="magQs"><h3>Claude asks</h3><ul>' + F.questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul></div>' : '') +
        ((F.renders || []).length ? '<div class="magRenders"><h3>Pictures to make</h3><p class="muted">Paste a prompt into your image tool, then add the result under Photos. No text or logos inside a render.</p>' + F.renders.map(function (r, i) {
          return '<div class="magRender"><b>' + esc(r.for) + '</b><p>' + esc(r.prompt) + '</p><button type="button" class="link magCopy" data-i="' + i + '">Copy</button> <button type="button" class="link magDone" data-i="' + i + '">Done, remove it</button></div>';
        }).join('') + '</div>' : '') +
        '<h3>The cover</h3><div class="grid2">' + field('Masthead', inp('masthead', t && t.masthead)) + field('Tagline', inp('tagline', t && t.tagline)) +
          field('Issue', inp('issue', t && t.issue)) + field('Label over the headline', inp('label', t && t.label)) + field('Byline', inp('byline', t && t.byline)) + '</div>' +
        field('Cover lines', '<textarea class="magF" data-k="coverLines" rows="4" placeholder="One per line, 3 to 5. The first is set large.">' + esc((F.coverLines || []).join('\n')) + '</textarea>', 'Each one points at something really in the Note.') +
        '<h3>The parts</h3>' + magParts(F) +
        '<button type="button" class="link" id="magOff">Take the magazine look off</button>';
    }
    dataStyles(box);   // the templates' colours
    // wiring
    $$('.magUse', box).forEach(function (b) { b.onclick = function () { var id = b.closest('.magCard').getAttribute('data-id'); magApply(mags().filter(function (t) { return t.id === id; })[0]); }; });
    if (!F) return;
    $('#magPick').onclick = function () {   // the picker eases open and shut (css .magPickBox)
      MAG_OPEN = !MAG_OPEN; var pb = $('.magPickBox', box);
      pb.classList.toggle('open', MAG_OPEN); pb.inert = !MAG_OPEN; this.textContent = MAG_OPEN ? 'Keep this one' : 'Change template';
    };
    $$('.magF', box).forEach(function (el) { el.addEventListener('input', function () {
      var k = el.getAttribute('data-k');
      if (k === 'coverLines') F.coverLines = el.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean); else F[k] = el.value.trim();
      markDirty();
    }); el.addEventListener('change', function () { renderMag(); }); });
    var w = $('#magWrite'); if (w) w.onclick = function () { magWrite(magNeeds(F, t).filter(function (x) { return !x.ok && x.by !== 'hand'; }).map(function (x) { return x.k; }), t, w); };
    $$('.magCopy', box).forEach(function (b) { b.onclick = function () { navigator.clipboard.writeText(F.renders[+b.getAttribute('data-i')].prompt).then(function () { toast('Prompt copied.'); }); }; });
    $$('.magDone', box).forEach(function (b) { b.onclick = function () { F.renders.splice(+b.getAttribute('data-i'), 1); if (!F.renders.length) delete F.renders; markDirty(); renderMag(); }; });
    magPartsWire(F, box);
    $('#magOff').onclick = function () {
      if (!confirm('Take the magazine look off this Note? Its cover text, blocks, Q&A and Spotted box go too (the post and photos stay).')) return;
      delete E.feature; markDirty(); renderMag();
    };
  }
  // the feature's building blocks, in story order: each sits before the subhead it names (or at the end); ↑ ↓ change
  // the order among those at one spot, Edit opens its fields as JSON, and a callouts block places labels by click
  function magParts(F) {
    var subs = subheads(), B = F.blocks || [];
    var row = function (b, i) {
      var sum = b.type === 'callouts' ? (b.photo || 'no picture yet') + ' · ' + (b.items || []).length + ' labels' : b.type === 'specs' ? (b.rows || []).length + ' rows' : (b.items || []).length ? b.items.length + ' items' : b.text ? b.text.slice(0, 60) : '';
      return '<li class="magPart" data-i="' + i + '"><span><b>' + esc(MAG_WANTS[b.type] || b.type) + (b.title ? ': ' + esc(b.title) : '') + '</b><small>' + esc(sum) + '</small></span>' +
        '<select class="magBefore" aria-label="Where it sits"><option value="">At the end of the story</option>' + subs.map(function (s) { return '<option value="' + esc(s) + '"' + (s === b.before ? ' selected' : '') + '>Before "' + esc(s) + '"</option>'; }).join('') +
          (b.before && subs.indexOf(b.before) < 0 ? '<option value="' + esc(b.before) + '" selected>Before "' + esc(b.before) + '" (not in the post now)</option>' : '') + '</select>' +
        '<span class="wsMv"><button type="button" class="link magUp" aria-label="Earlier"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="link magDn" aria-label="Later"' + (i < B.length - 1 ? '' : ' disabled') + '>↓</button></span>' +
        '<button type="button" class="link magEd">Edit</button><button type="button" class="link magRm">Remove</button>' +
        '<div class="magEdBox" hidden></div></li>';
    };
    var types = Object.keys(MAG_WANTS).filter(function (k) { return k !== 'qa' && k !== 'spotted'; });
    return '<ul class="magParts">' + B.map(row).join('') + '</ul>' +
      '<div class="row"><select id="magAddT">' + types.map(function (k) { return '<option value="' + k + '">' + esc(MAG_WANTS[k]) + '</option>'; }).join('') + '</select><button type="button" class="small" id="magAdd">Add a part</button></div>' +
      '<details class="magJson"><summary>Q&A, Spotted and everything else, as JSON</summary><textarea id="magAll" rows="14" spellcheck="false">' + esc(JSON.stringify({ qa: F.qa || null, spotted: F.spotted || [], lookbook: F.lookbook || null }, null, 2)) + '</textarea><small class="muted">Saved when you click out of it, if it reads as JSON.</small></details>';
  }
  var MAG_EMPTY = { specs: { rows: [['', '']] }, stats: { items: [['', '']] }, goodbad: { good: [''], bad: [''] }, verdict: { score: '', outOf: '/10', seal: '', scores: [], text: '' },
    box: { kicker: '', text: '' }, callouts: { photo: '', items: [] }, steps: { items: [{ title: '', text: '' }] }, timeline: { items: [['', '']] }, code: { file: '', code: '', note: '' } };
  function magPartsWire(F, box) {
    var B = F.blocks = F.blocks || [];
    $$('.magPart', box).forEach(function (li) {
      var i = +li.getAttribute('data-i'), b = B[i];
      $('.magBefore', li).onchange = function () { if (this.value) b.before = this.value; else delete b.before; markDirty(); };
      $('.magUp', li).onclick = function () { B.splice(i - 1, 0, B.splice(i, 1)[0]); markDirty(); renderMag(); };
      $('.magDn', li).onclick = function () { B.splice(i + 1, 0, B.splice(i, 1)[0]); markDirty(); renderMag(); };
      $('.magRm', li).onclick = function () { if (!confirm('Remove this part?')) return; B.splice(i, 1); markDirty(); renderMag(); };
      $('.magEd', li).onclick = function () {
        var ed = $('.magEdBox', li);
        if (!ed.hidden) { ed.hidden = true; ed.innerHTML = ''; return; }
        var pics = E.photos.filter(function (p) { return !p.strip && !p.video; });
        ed.innerHTML = (b.type === 'callouts' ? '<label class="f"><span>Picture</span><select class="mcPic"><option value="">Pick one</option>' + pics.map(function (p) { var n = photoName(p); return '<option' + (n === b.photo ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label>' +
            '<div class="mcPlace">' + (b.photo ? '<img src="' + esc(photoUrl(pics.filter(function (p) { return photoName(p) === b.photo; })[0] || {})) + '" alt="">' + (b.items || []).map(function (x, k) { return '<i data-x="' + Number(x.x) + '" data-y="' + Number(x.y) + '">' + (k + 1) + '</i>'; }).join('') : '') + '</div>' +
            (b.photo ? '<small class="muted">Click the picture to add a label there; then name it in the JSON (x and y are percentages across and down).</small>' : '') : '') +
          '<textarea class="magPartJ" rows="10" spellcheck="false">' + esc(JSON.stringify(b, null, 2)) + '</textarea><div class="row"><button type="button" class="small magPartOk">Keep these changes</button><span class="muted magPartErr"></span></div>';
        ed.hidden = false; dataStyles(ed);   // the callouts' markers
        var ta = $('.magPartJ', ed);
        $('.magPartOk', ed).onclick = function () {
          try { var nb = JSON.parse(ta.value); if (!nb || typeof nb !== 'object' || !nb.type) throw new Error('it needs a "type"'); B[i] = nb; markDirty(); renderMag(); toast('Part changed. Save to keep it.'); }
          catch (err) { $('.magPartErr', ed).textContent = 'That isn\'t valid JSON: ' + err.message; }
        };
        var sel = $('.mcPic', ed); if (sel) sel.onchange = function () { try { b = JSON.parse(ta.value); } catch (e) {} b.photo = this.value; B[i] = b; markDirty(); renderMag(); $('.magEd', $$('.magPart', $('#magBox'))[i]).click(); };
        var pl = $('.mcPlace img', ed); if (pl) pl.onclick = function (ev) {
          var r = pl.getBoundingClientRect(), x = Math.round((ev.clientX - r.left) / r.width * 100), y = Math.round((ev.clientY - r.top) / r.height * 100);
          try { b = JSON.parse(ta.value); } catch (e) {}
          (b.items = b.items || []).push({ x: x, y: y, label: 'Label ' + ((b.items || []).length + 1) });
          ta.value = JSON.stringify(b, null, 2);
          var dot = document.createElement('i'); dot.style.left = x + '%'; dot.style.top = y + '%'; dot.textContent = b.items.length; pl.parentNode.appendChild(dot);
        };
      };
    });
    $('#magAdd').onclick = function () {
      var ty = $('#magAddT').value, T = (magOf(F) || {}).titles || {};
      B.push(Object.assign({ type: ty, title: T[ty] || '' }, JSON.parse(JSON.stringify(MAG_EMPTY[ty] || {}))));
      markDirty(); renderMag();
      var last = $$('.magPart', $('#magBox')).pop(); if (last) $('.magEd', last).click();
    };
    var all = $('#magAll'); if (all) all.addEventListener('change', function () {
      try { var j = JSON.parse(all.value); ['qa', 'spotted', 'lookbook'].forEach(function (k) { if (j[k] == null || (Array.isArray(j[k]) && !j[k].length)) delete F[k]; else F[k] = j[k]; }); markDirty(); renderMag(); toast('Changed. Save to keep it.'); }
      catch (err) { toast('That isn\'t valid JSON: ' + err.message, true); }
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
        if (p.cover) repalette();
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
  // The bracket behind an HDR photo, as one picture: its shots side by side, darkest to brightest, each
  // labelled with its exposure. Kept beside the merge, switched off (tick Use to show it, e.g. for a write-up).
  function bracketStrip(set, order, bias) {
    return Promise.all(set.map(function (f) { return createImageBitmap(f, { imageOrientation: 'from-image' }); })).then(function (bms) {
      var H = 400, gap = 8, ws = order.map(function (i) { return Math.round(bms[i].width * H / bms[i].height); });
      var c = document.createElement('canvas'); c.width = ws.reduce(function (a, b) { return a + b; }, 0) + gap * (order.length - 1); c.height = H;
      var g = c.getContext('2d'), x = 0;
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, H);
      order.forEach(function (i, k) {
        g.drawImage(bms[i], x, 0, ws[k], H);
        var b = bias[i], label = b == null ? ['Darkest', 'Middle', 'Brightest'][Math.round(k * 2 / Math.max(1, order.length - 1))] || ''
          : (b > 0.05 ? '+' : b < -0.05 ? '\u2212' : '') + (Math.abs(b) < 0.05 ? '0' : Math.abs(b).toFixed(1).replace(/\.0$/, '')) + ' EV';
        g.font = '600 24px system-ui,-apple-system,Segoe UI,sans-serif';
        var tw = g.measureText(label).width;
        g.fillStyle = 'rgba(0,0,0,.62)'; g.beginPath(); if (g.roundRect) g.roundRect(x + 14, H - 52, tw + 24, 36, 18); else g.rect(x + 14, H - 52, tw + 24, 36); g.fill();
        g.fillStyle = '#fff'; g.fillText(label, x + 26, H - 26);
        x += ws[k] + gap;
      });
      bms.forEach(function (bm) { if (bm.close) bm.close(); });
      return new Promise(function (ok) { c.toBlob(function (b) { ok({ blob: b, w: c.width, h: H }); }, 'image/jpeg', 0.86); });
    });
  }
  function mergeBracket(set) {
    return Promise.all([Promise.all(set.map(exifDate)), Promise.all(set.map(exifBias))]).then(function (meta) {
      var ts = meta[0], bias = meta[1];
      return window.StudioHDR.merge(set, 1600).then(function (r) {
        if (!r) return false;
        return new Promise(function (ok) { r.canvas.toBlob(ok, 'image/jpeg', 0.86); }).then(function (big) {
          return shrink(big, 360, 0.7).then(function (th) {
            return blobToB64(th.blob).then(function (tb64) {
              var n = nextName();
              fresh[n] = { blob: big, thumb: 'data:image/jpeg;base64,' + tb64 };
              E.photos.push({ src: 'data/photos/' + (E.id || 'new') + '/' + n, caption: '', takenAt: ts.filter(Boolean).sort()[0] || null, w: r.w, h: r.h, use: 'post',
                cover: !E.photos.some(function (p) { return p.cover; }), from: set.map(function (f) { return f.name; }).join(' + '), hdr: set.length });
              var taken = ts.filter(Boolean).sort()[0] || null;
              return bracketStrip(set, r.order, bias).then(function (st) {
                return Promise.all([shrink(st.blob, 640, 0.7), Promise.resolve(st)]);
              }).then(function (two) {
                return blobToB64(two[0].blob).then(function (sb64) {
                  var n2 = nextName();
                  fresh[n2] = { blob: two[1].blob, thumb: 'data:image/jpeg;base64,' + sb64 };
                  E.photos.push({ src: 'data/photos/' + (E.id || 'new') + '/' + n2, caption: 'The ' + set.length + ' exposures behind the HDR photo, darkest to brightest.', takenAt: taken, w: two[1].w, h: two[1].h,
                    use: 'skip', cover: false, from: set.map(function (f) { return f.name; }).join(' + '), strip: set.length });
                });
              }).catch(function () { /* the merge stands without its strip */ }).then(function () { return true; });
            });
          });
        });
      });
    }).catch(function () { return false; });
  }
  function addPhotos(files) {
    collect(); markOrder();
    if (SWAP) files = [].slice.call(files, 0, 1);   // a swap takes one picture
    [].slice.call(files).filter(isVideo).forEach(upVideo);   // a video goes to Video loops, to trim a loop from
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
    if (!list.length) { settleNew(); markDirty(); renderPhotos(); if (merged) toast('Merged ' + merged + ' HDR photo' + (merged > 1 ? 's' : '') + '.'); return Promise.resolve(); }
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
      settleNew();
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
  var UPING = null;   // a dropped video on its way up: { name, pct }
  function renderLoops() {
    var box = $('#loopBox'); if (!box) return Promise.resolve();
    return driveVideos().then(function (drv) {
      setTimeout(renderNext, 0);
      if (!$('#loopBox')) return;
      var list = drv.concat(UPVID);
      var made = function (n) { return E.photos.filter(function (p) { return p.video && p.from === n; }).length; };
      box.innerHTML = '<p class="muted">Pick a video, find the moment, and make a short loop (' + LOOP_MAX + ' seconds at most). Loops play silently, over and over, in the post, and join Photos, where you choose the cover and caption (and under Workshop feature, where it goes in the feature). The videos themselves stay on the server.</p>' +
        '<div id="drop-video" class="drop">Drop a video here (MP4, MOV or WebM, up to 500 MB), or <label class="pick">choose<input type="file" accept="video/mp4,video/quicktime,video/webm,.mov,.m4v" multiple hidden id="pickVideo"></label>. It goes up to the Studio\'s server, not to the site, and is kept there two weeks.</div>' +
        (UPING ? '<p class="muted vup">Uploading ' + esc(UPING.name) + '… <b>' + UPING.pct + '%</b></p>' : '') +
        (list.length ? '<ul class="vids">' + list.map(function (f) {
          var k = made(f.name), on = VT && VT.name === f.name;
          return '<li' + (on ? ' class="on"' : '') + '><span><b>' + esc(f.name.split('/').pop()) + '</b> <small>' + size(f.bytes) + (f.up ? ' · dropped in' : '') + (k ? ' · ' + k + ' loop' + (k > 1 ? 's' : '') + ' made' : '') + '</small></span>' +
            (on ? '' : '<button type="button" class="small trimVid" data-n="' + esc(f.name) + '" data-u="' + esc(f.up || '') + '">' + (k ? 'Trim another' : 'Trim a loop') + '</button>') + '</li>';
        }).join('') + '</ul>' : E.source ? '<p class="muted">No videos in this note\'s Drive folder.</p>' : '') + '<div id="trimmer"></div>';
      $$('.trimVid', box).forEach(function (b) { b.onclick = function () { openTrim(b.getAttribute('data-n'), b.getAttribute('data-u')); }; });
      var dz = $('#drop-video');
      ['dragover', 'dragenter'].forEach(function (t) { dz.addEventListener(t, function (ev) { ev.preventDefault(); dz.classList.add('on'); }); });
      dz.addEventListener('dragleave', function () { dz.classList.remove('on'); });
      dz.addEventListener('drop', function (ev) { ev.preventDefault(); dz.classList.remove('on'); [].slice.call(ev.dataTransfer.files).forEach(upVideo); });
      $('#pickVideo').onchange = function () { [].slice.call(this.files).forEach(upVideo); this.value = ''; };
      if (VT) drawTrim();
    });
  }
  // A video dropped into the note goes up in pieces to the server's video work folder (api.php videopart), then
  // opens in the trimmer like a Drive one. One at a time; the rest wait their turn.
  var VCH = 2000000, upChain = Promise.resolve();
  function isVideo(f) { return /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name); }
  function upVideo(file) {
    if (!isVideo(file)) { toast(file.name + ' isn\'t a video. Drop an MP4, MOV or WebM.', true); return; }
    if (file.size > 500e6) { toast(file.name + ' is too big (500 MB at most). Trim it on the phone first.', true); return; }
    var ext = (/\.(mp4|mov|m4v|webm)$/i.exec(file.name) || [, /webm/.test(file.type) ? 'webm' : /quicktime/.test(file.type) ? 'mov' : 'mp4'])[1].toLowerCase();
    var f = $('#f-loops'); if (f) f.open = true;
    upChain = upChain.then(function () {
      var up = Array.from(crypto.getRandomValues(new Uint8Array(8)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      var n = Math.ceil(file.size / VCH), chain = Promise.resolve();
      UPING = { name: file.name, pct: 0 }; renderLoops();
      for (var i = 0; i < n; i++) (function (i) {
        chain = chain.then(function () { return api('videopart', file.slice(i * VCH, (i + 1) * VCH), '&up=' + up + '&ext=' + ext + '&i=' + i + '&last=' + (i === n - 1 ? 1 : 0)); })
          .then(function () { UPING.pct = Math.round((i + 1) / n * 100); var b = $('#loopBox .vup b'); if (b) b.textContent = UPING.pct + '%'; });
      })(i);
      return chain.then(function () {
        UPING = null; UPVID.push({ name: file.name, bytes: file.size, up: up });
        toast(file.name + ' is up. Find the moment and make a loop.');
        openTrim(file.name, up);
      }).catch(function (err) { UPING = null; renderLoops(); toast('While uploading ' + file.name + ': ' + err.message, true); });
    });
  }
  // the end of ffmpeg's log, folded away, for when something goes wrong
  function logBox(lines) {
    return lines && lines.length ? '<details class="vt-log" id="vtLog"><summary>What ffmpeg said</summary><pre>' + esc(lines.join('\n')) + '</pre></details>' : '';
  }
  function stopTrim() { if (VT) { clearTimeout(VT.poll); VT.dead = true; } VT = null; }
  function openTrim(name, up) {
    stopTrim();
    VT = { name: name, up: up || '', state: 'working', pct: 0 };
    renderLoops(); pollPreview(true);   // opening a video again gives one that failed before a fresh try
  }
  // which video: a dropped one by its upload id, else the one in the note's Drive folder
  function vidQ(vt) { return vt.up ? '&u=' + vt.up : '&f=' + encodeURIComponent(E.source) + '&n=' + encodeURIComponent(vt.name); }
  function pollPreview(retry) {
    var vt = VT; if (!vt) return;
    api('video', null, vidQ(vt) + (retry ? '&retry=1' : '')).then(function (r) {
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
      api('loop', vt.up ? { u: vt.up, from: from, to: to, retry: retry } : { f: E.source, n: vt.name, from: from, to: to, retry: retry }).then(function (r) {
        retry = false;
        if (vt.dead) return;
        if (r.state === 'working') { if (msg) msg.textContent = 'Making the loop… ' + (r.pct ? r.pct + '%' : ''); setTimeout(ask, 2000); return; }
        if (r.state === 'failed') { var lg = $('#vtLog'); if (lg) lg.outerHTML = logBox(r.log); throw new Error(r.error || 'ffmpeg stopped'); }
        collect(); markOrder();
        var name = nextClip();
        clipsNew[name + '.mp4'] = { token: r.token };
        E.photos.push({ src: 'data/photos/' + (E.id || 'new') + '/' + name + '.mp4', poster: 'data/photos/' + (E.id || 'new') + '/' + name + '.jpg', video: true,
          caption: cap, takenAt: r.taken || null, w: r.w, h: r.h, use: 'post', cover: false, from: vt.name, range: [from, to] });
        settleNew();
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
    for (var d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
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
    var kind = val('kind') || E.kind, needsTrack = hasTrack(kind);
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
    var sv = $('#save'); if (sv) sv.classList.toggle('dirty', !!dirty);   // the Save button's ring lights while there's something to save
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
    if (vn && !E.voiceNotesDone) out.push({ t: 'Paste in your voice notes', d: 'Claude only reads Your notes. In Voice Memos, tap ••• then Copy Transcript, and Paste it here.', b: 'Go to them', go: '#voiceNotes', done: 'voice' });
    if (!drafted) out.push({ t: 'Draft with Claude', d: 'Claude writes the post, the captions and the episode script from your notes, track and photos.', b: 'Draft', run: function () { draft(); } });
    if (q) out.push({ t: 'Answer Claude\'s ' + (q === 1 ? 'question' : q + ' questions'), d: 'The script isn\'t final until they\'re answered. Answer them one by one, then send them all at once.', b: 'Answer', go: '#questions' });
    if (drafted && !q && !val('epScript')) out.push({ t: 'Write the episode script', d: 'The episode is read from it. Draft with Claude writes one from the post, or write your own.', b: 'Go to the script', go: '#epScript' });
    if (drafted && !q && LOOKPICK) out.push({ t: 'Pick the narrator style', d: 'More than one of this Note\'s categories gives her a cap or backdrop. Tick the one this Note takes.', b: 'Pick it', go: '#f-look' });
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
    put($('#sumMeta'), '<span>' + esc(dt ? new Date(dt + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '') + ' · ' + esc(kindName(kind)) + '</span>' +
      (place ? chip(esc(place), '#place') : chip('Add the place', '#place', true)) +
      (ts ? chip(mi(ts.distanceKm || 0) + ' mi · ↑ ' + ft(ts.gainM || 0).toLocaleString() + ' ft', '#track') : (hasTrack(kind) ? chip('No track yet', '#track', true) : '')) +
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
  // Each voice note's words come from the iPhone's own transcript (Voice Memos: ••• then Copy Transcript):
  // Paste reads the clipboard (or takes a typed paste) and adds it to Your notes, which is all Claude reads.
  function renderVoiceNotes() {
    var box = $('#voiceNotes'); if (!box) return;
    var vn = (DRIVEAUD || []).filter(function (f) { return roleOf(f.name) === 'notes'; }), had = E.voiceAdded || {};
    box.innerHTML = vn.length ? '<div class="vnotes"><b>Your voice notes</b> <span class="muted">Claude only reads Your notes, so paste each one\'s transcript in. In Voice Memos, tap ••• on the recording, then Copy Transcript.</span>' + vn.map(function (f, i) {
      var n = f.name.split('/').pop();
      return '<div class="vn"><small>' + esc(n) + '</small><audio controls preload="metadata" src="' + driveUrl(f.name) + '"></audio>' +
        '<div class="row"><button type="button" class="small" data-vp="' + i + '">' + (had[f.name] ? 'Paste again' : 'Paste transcript') + '</button>' +
        (had[f.name] ? '<span class="muted">In Your notes ✓</span>' : '') + '</div>' +
        '<div class="vpaste" hidden><textarea rows="4" placeholder="Paste the transcript here"></textarea><div class="row"><button type="button" class="small">Add to Your notes</button><button type="button" class="link">Cancel</button></div></div></div>';
    }).join('') + '</div>' : '';
    $$('button[data-vp]', box).forEach(function (b) {
      var f = vn[+b.getAttribute('data-vp')], vnBox = b.closest('.vn'), pane = $('.vpaste', vnBox), ta = $('textarea', pane), bs = $$('button', pane);
      function manual() { pane.hidden = false; ta.focus(); }
      b.onclick = function () {
        if (!navigator.clipboard || !navigator.clipboard.readText) { manual(); return; }
        navigator.clipboard.readText().then(function (t) { if (t && t.trim()) addTranscript(f.name, t); else manual(); }, manual);
      };
      bs[0].onclick = function () { if (ta.value.trim()) addTranscript(f.name, ta.value); else ta.focus(); };
      bs[1].onclick = function () { pane.hidden = true; };
    });
  }
  function addTranscript(name, text) {
    var ta = $('#fieldNotes'), t = String(text).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    var label = 'From my voice note (' + name.split('/').pop().replace(/\.[^.]+$/, '') + '):';
    ta.value = (ta.value.trim() ? ta.value.trim() + '\n\n' : '') + label + '\n' + t;
    E.voiceAdded = E.voiceAdded || {}; E.voiceAdded[name] = true;
    var vn = (DRIVEAUD || []).filter(function (f) { return roleOf(f.name) === 'notes'; });
    if (vn.every(function (f) { return E.voiceAdded[f.name]; })) E.voiceNotesDone = true;
    markDirty(); renderVoiceNotes(); renderNext();
    toast('Added to Your notes (' + t.split(/\s+/).length + ' words). Draft again to use it.');
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
    var CH = 1000000, n = Math.ceil(file.size / CH), chain = Promise.resolve(), res = null, box = $('#audio');
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
        narrator: NAR_NAME[NARNOW] || 'GlazyArray',   // who tells the episode (its own choice or its categories'): the script is in their voice
        narratorLook: E.narratorLook ? E.narratorLook.look : null, narratorBackdrop: E.narratorBackdrop ? E.narratorBackdrop.backdrop : null,   // her look already chosen: Claude keeps it (fit existing) unless asked
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
      // her look for this Note: Claude's pick goes in only when the Note has none yet, so a redraft (answering its
      // questions, say) never undoes a look that was chosen or already made; change it in her look panel
      var nl = d.narrator_look;
      if (!E.narratorLook && nl && nl.fit !== 'none' && /^[a-z0-9-]{1,40}$/.test(nl.look || '')) E.narratorLook = { look: nl.look, fit: nl.fit, about: nl.about || '', why: nl.why || '', prompt: nl.prompt || '', bulb: nl.bulb !== false };
      var nb = d.narrator_backdrop;   // and her backdrop: Claude's pick only fills an empty one too
      if (!E.narratorBackdrop && nb && nb.fit !== 'none' && /^[a-z0-9-]{1,40}$/.test(nb.backdrop || '')) E.narratorBackdrop = { backdrop: nb.backdrop, fit: nb.fit, scene: nb.scene || '' };
      renderLook(); renderBd();
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
    var chain = !E.palette && E.paletteBy !== 'hand' ? repalette() : Promise.resolve();   // a Note's first save takes its colours from the hero
    names.forEach(function (n, i) {
      chain = chain.then(function () {
        btn.textContent = 'Uploading photo ' + (i + 1) + ' of ' + names.length + '…'; L.at(0, (i + 1) + ' of ' + names.length);
        return api('blob', (fresh[n] || posterNew[n]).blob).then(function (r) { uploaded.push({ name: n, sha: r.sha }); });
      });
    });
    var lookUp = null;
    if (LOOKNEW && E.narratorLook && LOOKNEW.name === E.narratorLook.look) chain = chain.then(function () {
      btn.textContent = 'Uploading her new look…';
      return api('lookblob', LOOKNEW.blob).then(function (r) { lookUp = { name: LOOKNEW.name, ext: LOOKNEW.ext, sha: r.sha, about: E.narratorLook.about || '', bulb: E.narratorLook.bulb !== false }; })
        .then(function () { return flairUp(LOOKNEW); }).then(function (f) { if (f) lookUp.flair = f; });
    });
    var bdUp = null;
    if (BDNEW && BDNEW.blob && E.narratorBackdrop && BDNEW.name === E.narratorBackdrop.backdrop) chain = chain.then(function () {
      btn.textContent = 'Uploading the backdrop…';
      return Promise.all([api('lookblob', BDNEW.blob), blobColors(BDNEW.blob)]).then(function (rr) { bdUp = { name: BDNEW.name, ext: BDNEW.ext, sha: rr[0].sha, about: '', scene: E.narratorBackdrop.scene || '', colors: rr[1] }; });
    });
    chain.then(function () {
      btn.textContent = 'Saving…'; L.at(1);
      var hadAudio = E.episode.audio;
      if (audioNew) E.episode.audio = 'data/audio/' + E.id + '.mp3'; else if (audioGone) E.episode.audio = null;
      var clips = Object.keys(clipsNew).map(function (n) { return { name: n.replace(/\.mp4$/, ''), loop: clipsNew[n].token }; });
      if (clips.length) L.at(1, clips.length + ' video loop' + (clips.length > 1 ? 's' : ''));
      return api('save', { entry: E, base: BASE.version, newPhotos: uploaded, newClips: clips, removePhotos: removed, newAudio: audioNew ? audioNew.sha : '', removeAudio: audioGone && !!hadAudio, newLook: lookUp, removeLook: LOOKDEL, categoryLooks: Object.keys(CATNEW).length ? CATNEW : null,
        newBackdrop: bdUp, categoryBackdrops: Object.keys(CATBDNEW).length ? CATBDNEW : null, offerBackdrop: bdUp && imgCats('bd').length ? { names: [bdUp.name], cats: imgCats('bd') } : null })
        .catch(function (err) { E.episode.audio = hadAudio; throw err; });
    }).then(function (j) {
      if (j.entry && j.entry.publishedAt) E.publishedAt = j.entry.publishedAt;   // set by the server the first time it goes live
      BASE = { version: j.version, entry: clone(j.entry || E) };
      var hadNew = !!audioNew;
      var hadClips = Object.keys(clipsNew).length + Object.keys(posterNew).length;
      if (Object.keys(posterNew).length) posterBust = '&v=' + Date.now().toString(36);
      if (lookUp) { LOOKSAVED[lookUp.name] = LOOKNEW.url; LOOKNEW = null; LOOKREPL = false; LOOKS = LOOKS.then(function (l) { return l.filter(function (x) { return x.name !== lookUp.name; }).concat([{ name: lookUp.name, file: lookUp.name + '.' + lookUp.ext, about: lookUp.about, flair: lookUp.flair ? Object.keys(lookUp.flair).join('') : undefined }]); }); setTimeout(renderLook, 0); }
      if (bdUp || Object.keys(CATBDNEW).length) {
        if (bdUp) BDSAVED[bdUp.name] = BDNEW.url;
        var sentB = CATBDNEW, up = bdUp; BDNEW = null; CATBDNEW = {}; IMGCATS.bd = null;
        LOOKBD = LOOKBD.then(function (d) { var l = d.list.filter(function (x) { return !up || x.name !== up.name; }); if (up) l = l.concat([{ name: up.name, file: up.name + '.' + up.ext, scene: up.scene }]);
          var c = Object.assign({}, d.cats); Object.keys(sentB).forEach(function (k) { if (sentB[k]) c[k] = sentB[k]; else delete c[k]; }); return { list: l, cats: c }; });
        setTimeout(renderBd, 0);
      }
      if (Object.keys(CATNEW).length) { var sent = CATNEW; CATNEW = {}; LOOKCATS = LOOKCATS.then(function (c) { c = Object.assign({}, c); Object.keys(sent).forEach(function (k) { if (sent[k]) c[k] = sent[k]; else delete c[k]; }); return c; }); setTimeout(renderLook, 0); }
      if (LOOKDEL) { var gone = LOOKDEL; LOOKDEL = null; delete LOOKSAVED[gone]; LOOKS = LOOKS.then(function (l) { return l.filter(function (x) { return x.name !== gone; }); }); setTimeout(renderLook, 0); }
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
      if (err.data && err.data.stale) staleSave(err.data, first); else toast('Not saved: ' + err.message, true);
    }).then(function () { var b = $('#save'); if (b) { b.disabled = false; b.textContent = owner() ? 'Save' : 'Save for review'; } publishing = false; renderNext(); });
  }

  // ---------- a save from a stale page ----------
  // The repo's copy of the note changed after this page loaded it (a merged PR, another tab, an editor's review).
  // The save was refused; this says so, and when the edits made here and the newer changes touch different parts
  // of the note (field by field, nested objects part by part, lists whole), offers to put them on the latest copy.
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function canon(x) {   // key order and stray spaces at the ends of text don't count as a change
    if (typeof x === 'string') return x.trim();
    if (Array.isArray(x)) return x.map(canon);
    if (isObj(x)) { var o = {}; Object.keys(x).sort().forEach(function (k) { if (x[k] !== undefined) o[k] = canon(x[k]); }); return o; }
    return x;
  }
  function same(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }
  // base: the copy loaded; mine: this page's; theirs: the repo's now. Fills r.mine, r.theirs and r.both (paths).
  function merge3(base, mine, theirs, path, r) {
    if (same(mine, theirs)) return theirs;
    if (isObj(base) && isObj(mine) && isObj(theirs)) {   // part by part, so the notice names just what changed
      var out = {};
      Object.keys(theirs).concat(Object.keys(mine).filter(function (k) { return !(k in theirs); })).forEach(function (k) {
        var v = merge3(base[k], mine[k], theirs[k], path ? path + '.' + k : k, r);
        if (v !== undefined) out[k] = v;
      });
      return out;
    }
    if (same(mine, base)) { r.theirs.push(path); return theirs; }
    if (same(theirs, base)) { r.mine.push(path); return mine; }
    r.both.push(path); return mine;
  }
  function staleClose() {
    var el = $('#stale'); if (!el) return;
    el.removeAttribute('id'); el.classList.remove('on'); setTimeout(function () { el.remove(); }, 900);
  }
  function staleSave(j, first) {
    staleClose();
    var r = { mine: [], theirs: [], both: [] }, merged = null;
    if (!first && BASE.entry && j.current) merged = merge3(BASE.entry, E, j.current, '', r);
    var list = function (a) { return a.map(function (p) { return '<code>' + esc(p) + '</code>'; }).join(', '); };
    var msg, can = merged && !r.both.length && r.mine.length;
    if (first) msg = 'A note with this date and title is already in the notes. Change the title, or open that note from the list.';
    else if (can) msg = 'Your edits here (' + list(r.mine) + ') don\'t touch what changed there (' + list(r.theirs) + '). Put them on the latest copy, read it through and Save again, or reload to get the latest without them.';
    else if (r.both.length) msg = 'You and the newer copy both changed ' + list(r.both) + '. Reload to get the latest, then make your edits again.';
    else msg = 'Reload to get the latest.';
    var el = document.createElement('div'); el.id = 'stale'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-labelledby', 'staleH');
    el.innerHTML = '<div class="stale-card"><h2 id="staleH">This Note changed since you opened it</h2><p>' + msg + '</p><div class="rb-btns">' +
      (can ? '<button type="button" class="primary" id="staleMerge">Put my edits on the latest</button>' : '') +
      (first ? '' : '<button type="button" class="' + (can ? 'small' : 'primary') + '" id="staleReload">Reload the latest</button>') +
      '<button type="button" class="link" id="staleKeep">Not now</button></div></div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    var b = $('#staleMerge', el) || $('#staleReload', el) || $('#staleKeep', el); if (b) b.focus();
    if (can) $('#staleMerge', el).onclick = function () {
      E = merged; savedStatus = j.current.status; BASE = { version: j.version, entry: clone(j.current) };
      staleClose(); render(); markDirty();
      toast('Your edits are on the latest copy. Read it through, then Save.');
    };
    if (!first) $('#staleReload', el).onclick = function () {
      if (!confirm('Reload the latest copy? Your edits here are left out.')) return;
      dirty = false; staleClose(); edit(E.id);
    };
    $('#staleKeep', el).onclick = staleClose;
  }

  // ---------- start ----------
  api('config').then(function (c) {
    CFG = c; listen();
    var m = /[?&]e=([^&]+)/.exec(location.search);            // older ?e=<id> links still open their note
    if (m) edit(decodeURIComponent(m[1]));
    else open(window.StudioHash ? StudioHash.view() : '');
  }).catch(function (err) { app.innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
})();
