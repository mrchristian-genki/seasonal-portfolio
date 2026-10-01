/* FIELD NOTES MANAGER. Reads data/events.json, data/events/<id>.json, data/show.json and
   data/trailheads.json and shows:
     #/            every adventure as a card (route sketch or cover photo, stats, status)
     #/e/<id>      one adventure: map + elevation, trim report, photos, post draft, episode script,
                   and the audio prompt ready to copy
     #/check       drop a Cyclemeter GPX to see exactly what would be cut before it's published;
                   private zones (home) live only in this browser
   Nothing here writes to the server: events are added with tools/ingest.mjs and tools/photos.py
   (or by asking Claude), and this page is the window onto them. */
(function () {
  'use strict';
  var T = window.FieldTrack, app = document.getElementById('app');
  var cache = {}, maps = [];

  // ── Small helpers ────────────────────────────────────────────────────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(url) {
    if (cache[url]) return Promise.resolve(cache[url]);
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); })
      .then(function (j) { return (cache[url] = j); });
  }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  var units = store('fieldUnits') || 'imperial';
  var U = {
    dist: function (km) { return units === 'imperial' ? (km * 0.621371).toFixed(km * 0.621371 < 10 ? 1 : 0) + ' mi' : km.toFixed(km < 10 ? 1 : 0) + ' km'; },
    distP: function (km) { return units === 'imperial' ? (km * 0.621371).toFixed(2) + ' mi' : km.toFixed(2) + ' km'; },
    ele: function (m) { return m == null ? '–' : units === 'imperial' ? Math.round(m * 3.28084).toLocaleString() + ' ft' : Math.round(m).toLocaleString() + ' m'; },
    speed: function (kmh) { return units === 'imperial' ? (kmh * 0.621371).toFixed(1) + ' mph' : kmh.toFixed(1) + ' km/h'; },
    pace: function (km, sec) { if (!km || !sec) return '–'; var per = sec / (units === 'imperial' ? km * 0.621371 : km); return Math.floor(per / 60) + ':' + ('0' + Math.round(per % 60)).slice(-2) + (units === 'imperial' ? ' /mi' : ' /km'); }
  };
  function dur(sec) { if (!sec) return '–'; var h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60); return h ? h + ' h ' + ('0' + m).slice(-2) + ' m' : m + ' min'; }
  function day(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
  var KIND = { ride: 'Ride', hike: 'Hike', forage: 'Foraging' };
  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, 1800); }
  function copy(text, what) {
    function ok() { toast((what || 'Text') + ' copied'); }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(ok, fallback);
    fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = 0; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Select and copy by hand'); } ta.remove(); }
  }
  function words(s) { return (s || '').trim().split(/\s+/).filter(Boolean).length; }

  // ── Route sketch for cards (no map tiles, just the line) ─────────────
  function sketch(pts, onPhoto) {
    if (!pts || pts.length < 2) return '';
    var lat0 = pts[0][0] * Math.PI / 180, xs = pts.map(function (p) { return p[1] * Math.cos(lat0); }), ys = pts.map(function (p) { return -p[0]; });
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
    var W = 160, H = 90, pad = 12, s = Math.min((W - 2 * pad) / ((x1 - x0) || 1e-9), (H - 2 * pad) / ((y1 - y0) || 1e-9));
    var ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
    var d = xs.map(function (x, i) { return (i ? 'L' : 'M') + ((x - x0) * s + ox).toFixed(1) + ' ' + ((ys[i] - y0) * s + oy).toFixed(1); }).join('');
    var c = onPhoto ? '#fff' : 'var(--accent)';
    return '<svg viewBox="0 0 160 90" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + (onPhoto ? 'rgba(0,0,0,.35)' : '#fff') + '" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + ((xs[0] - x0) * s + ox).toFixed(1) + '" cy="' + ((ys[0] - y0) * s + oy).toFixed(1) + '" r="3.2" fill="#fff" stroke="' + c + '" stroke-width="2"/></svg>';
  }

  // ── Map ──────────────────────────────────────────────────────────────
  // A line may hold null breaks (a private zone mid-way). solid() drops them for the scrubber and
  // sketches; parts() splits at them for drawing.
  function solid(line) { return (line || []).filter(Boolean); }
  function parts(line) { var out = [[]]; (line || []).forEach(function (p) { if (p) out[out.length - 1].push([p[0], p[1]]); else out.push([]); }); return out.filter(function (x) { return x.length > 1; }); }
  function cumKm(line) { var c = [0]; for (var i = 1; i < line.length; i++) c.push(c[i - 1] + T.dist({ lat: line[i - 1][0], lon: line[i - 1][1] }, { lat: line[i][0], lon: line[i][1] }) / 1000); return c; }
  function makeMap(el, layers) {
    if (!window.L) { el.innerHTML = '<p class="muted" style="padding:16px">Map library did not load (offline?). The numbers below still work.</p>'; return null; }
    var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)' });
    var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' });
    // A starting view first: circles (zones, trailheads) can only report bounds on a map that has one.
    var map = L.map(el, { layers: [topo], scrollWheelZoom: false }).setView([0, 0], 2);
    L.control.layers({ Topo: topo, Streets: osm }, null, { position: 'topright' }).addTo(map);
    var fg = L.featureGroup(layers).addTo(map);
    map.fitBounds(fg.getBounds(), { padding: [24, 24] });
    maps.push(map);
    return map;
  }
  function routeLayers(line, color) {
    var ps = parts(line), ll = solid(line).map(function (p) { return [p[0], p[1]]; });
    return [
      L.polyline(ps, { color: '#fff', weight: 7, opacity: 0.9 }),
      L.polyline(ps, { color: color || '#d8618f', weight: 4 }),
      L.circleMarker(ll[0], { radius: 7, color: '#fff', weight: 3, fillColor: '#2f8f6b', fillOpacity: 1 }).bindTooltip('Start'),
      L.circleMarker(ll[ll.length - 1], { radius: 7, color: '#fff', weight: 3, fillColor: '#0f4d47', fillOpacity: 1 }).bindTooltip('Finish')
    ];
  }

  // ── Elevation profile with a scrubber that drives a dot on the map ───
  function profileSVG(el, prof, onAt) {
    var pts = prof.filter(function (p) { return p[1] != null; });
    if (pts.length < 2) { el.innerHTML = '<p class="muted">No elevation in this track.</p>'; return; }
    var W = 1000, H = 150, padB = 18, padT = 10, kmMax = pts[pts.length - 1][0] || 1;
    var e0 = Math.min.apply(0, pts.map(function (p) { return p[1]; })), e1 = Math.max.apply(0, pts.map(function (p) { return p[1]; }));
    var span = Math.max(30, e1 - e0), lo = e0 - span * 0.12, hi = e1 + span * 0.08;
    function X(k) { return k / kmMax * W; } function Y(e) { return padT + (1 - (e - lo) / (hi - lo)) * (H - padT - padB); }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('');
    var ticks = '', step = niceStep((units === 'imperial' ? kmMax * 0.621371 : kmMax) / 6);
    for (var v = step; v < (units === 'imperial' ? kmMax * 0.621371 : kmMax); v += step) {
      var kx = X(units === 'imperial' ? v / 0.621371 : v);
      ticks += '<line x1="' + kx + '" x2="' + kx + '" y1="' + padT + '" y2="' + (H - padB) + '" stroke="#e3ecee"/><text x="' + kx + '" y="' + (H - 4) + '" font-size="11" fill="#7d929b" text-anchor="middle">' + +v.toFixed(1) + '</text>';
    }
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Elevation profile: ' + U.ele(e0) + ' to ' + U.ele(e1) + '">' +
      '<defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8618f" stop-opacity=".35"/><stop offset="1" stop-color="#d8618f" stop-opacity=".03"/></linearGradient></defs>' + ticks +
      '<path d="' + d + 'L' + W + ' ' + (H - padB) + 'L0 ' + (H - padB) + 'Z" fill="url(#pg)"/><path d="' + d + '" fill="none" stroke="#d8618f" stroke-width="2.2" vector-effect="non-scaling-stroke"/>' +
      '<line class="cur" x1="-10" x2="-10" y1="' + padT + '" y2="' + (H - padB) + '" stroke="#0f4d47" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><div class="tip"></div>';
    var svg = el.querySelector('svg'), cur = el.querySelector('.cur'), tip = el.querySelector('.tip');
    function at(ev) {
      var r = svg.getBoundingClientRect(), cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left, f = Math.max(0, Math.min(1, cx / r.width));
      var k = f * kmMax, i = Math.min(pts.length - 1, Math.round(f * (pts.length - 1)));
      cur.setAttribute('x1', f * W); cur.setAttribute('x2', f * W);
      tip.style.left = cx + 'px'; tip.style.opacity = 1; tip.textContent = U.distP(k) + ' · ' + U.ele(pts[i][1]);
      onAt && onAt(k);
    }
    svg.addEventListener('pointermove', at); svg.addEventListener('pointerdown', at);
    svg.addEventListener('pointerleave', function () { tip.style.opacity = 0; cur.setAttribute('x1', -10); cur.setAttribute('x2', -10); onAt && onAt(null); });
  }
  function niceStep(x) { var p = Math.pow(10, Math.floor(Math.log10(x || 1))), n = x / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
  function scrubber(map, line) {
    if (!map) return null;
    line = solid(line);
    var c = cumKm(line), dot = L.circleMarker([line[0][0], line[0][1]], { radius: 8, color: '#fff', weight: 3, fillColor: '#0f4d47', fillOpacity: 1 });
    return function (k) {
      if (k == null) { dot.remove(); return; }
      var i = 1; while (i < c.length - 1 && c[i] < k) i++;
      var f = c[i] > c[i - 1] ? (k - c[i - 1]) / (c[i] - c[i - 1]) : 0;
      dot.setLatLng([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f]).addTo(map);
    };
  }
  function statTiles(s, kind) {
    var tiles = [
      [U.dist(s.distanceKm), 'Distance'], [dur(s.movingSec), 'Moving time'],
      [U.ele(s.gainM), 'Climbing'], [U.ele(s.maxEleM), 'High point'],
      kind === 'ride' ? [U.speed(s.avgKmh), 'Average speed'] : [U.pace(s.distanceKm, s.movingSec), 'Pace'],
      kind === 'ride' ? [U.speed(s.maxKmh), 'Top speed'] : [dur(s.elapsedSec), 'Total time']
    ];
    return tiles.map(function (t) { return '<div class="stat"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>'; }).join('');
  }

  // ── Views ────────────────────────────────────────────────────────────
  function list() {
    return get('data/events.json').then(function (idx) {
      var ev = idx.events || [], f = store('fieldFilter') || 'all';
      var real = ev.filter(function (e) { return !e.sample; });
      var sum = function (k) { return real.reduce(function (a, e) { return a + (e.stats ? e.stats[k] || 0 : 0); }, 0); };
      var html = '<h1>Adventures</h1><p class="lede">Rides, hikes and foraging walks, from field notes to finished episode. New ones arrive through the Drive inbox and Claude; this page tracks where each one is.</p>' +
        '<div class="totals">' +
        '<div class="total"><b>' + real.length + '</b><span>adventures logged</span></div>' +
        '<div class="total"><b>' + U.dist(sum('distanceKm')) + '</b><span>covered</span></div>' +
        '<div class="total"><b>' + U.ele(sum('gainM')) + '</b><span>climbed</span></div>' +
        '<div class="total"><b>' + real.filter(function (e) { return e.status !== 'published'; }).length + '</b><span>in progress</span></div>' +
        '</div>' + (ev.length > real.length ? '<p class="count" style="margin:-6px 0 10px">Samples are not counted in the totals.</p>' : '') + '<div class="filters" role="group" aria-label="Filter">' +
        ['all', 'ride', 'hike', 'forage'].map(function (k) { return '<button type="button" class="chip' + (f === k ? ' on' : '') + '" data-f="' + k + '">' + (k === 'all' ? 'All' : k === 'forage' ? 'Foraging' : KIND[k] + 's') + '</button>'; }).join('') + '</div>';
      var shown = ev.filter(function (e) { return f === 'all' || e.kind === f; });
      html += shown.length ? '<div class="cards">' + shown.map(card).join('') + '</div>' :
        '<div class="empty">Nothing here yet. Drop a Cyclemeter export, photos and a voice note in the Drive inbox and ask Claude to add it.</div>';
      app.innerHTML = html;
      app.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { store('fieldFilter', b.dataset.f); list(); }; });
    });
  }
  function card(e) {
    var s = e.stats || {};
    return '<a class="card" href="#/e/' + encodeURIComponent(e.id) + '"><div class="art">' +
      (e.cover ? '<img src="' + esc(e.cover) + '" alt="" loading="lazy">' : '') + sketch(e.thumb, !!e.cover) + '</div>' +
      '<div class="body"><div class="meta"><span class="kind ' + e.kind + '">' + (KIND[e.kind] || e.kind) + '</span><span>' + day(e.date) + '</span>' +
      (e.sample ? '<span class="pill sample">Sample</span>' : '') + '</div><h3>' + esc(e.title) + '</h3>' +
      (e.place ? '<div class="meta">' + esc(e.place) + '</div>' : '') +
      '<div class="stats-mini">' + (s.distanceKm ? '<span>' + U.dist(s.distanceKm) + '</span><span>↑ ' + U.ele(s.gainM) + '</span><span>' + dur(s.movingSec) + '</span>' : '') + '</div>' +
      '<div class="meta"><span class="pill s-' + e.status + '">' + statusLabel(e.status) + '</span><span>' + e.photos + ' photo' + (e.photos === 1 ? '' : 's') + '</span></div></div></a>';
  }
  var SHOW = null;
  function statusLabel(id) { var s = SHOW && SHOW.statuses.find(function (x) { return x.id === id; }); return s ? s.label : id; }

  function event(id) {
    return get('data/events/' + id + '.json').then(function (e) {
      var tr = e.track || {}, s = tr.stats || {}, st = SHOW.statuses, si = st.findIndex(function (x) { return x.id === e.status; });
      var prompt = SHOW.audioPrompt.replace('{{title}}', e.episode.title || e.title).replace('{{script}}', e.episode.script || '');
      var html = '<a class="back" href="#/">← All adventures</a>' +
        '<div class="ev-head"><div><div class="meta"><span class="kind ' + e.kind + '">' + (KIND[e.kind] || e.kind) + '</span><span>' + day(e.date) + '</span>' + (e.place ? '<span>' + esc(e.place) + '</span>' : '') +
        (e.sample ? '<span class="pill sample">Sample</span>' : '') + '</div><h1>' + esc(e.title) + '</h1>' + (e.summary ? '<p class="lede">' + esc(e.summary) + '</p>' : '') + '</div></div>' +
        '<div class="steps">' + st.map(function (x, i) { return '<div class="step' + (i < si ? ' done' : i === si ? ' now' : '') + '">' + x.label + '</div>'; }).join('') + '</div>' +
        '<p class="step-about">' + esc(si >= 0 ? st[si].about : '') + '</p>';

      if (tr.line && tr.line.length > 1) {
        html += '<section class="panel"><h2>The route</h2><div class="ridecard"><div class="map" id="map"></div><div class="statgrid">' + statTiles(s, e.kind) + '</div></div>' +
          '<div class="profile" id="prof"></div>' +
          '<div class="trim"><b>Privacy trim</b> · the numbers count the whole ' + (KIND[e.kind] || 'outing').toLowerCase() + '; the map shows ' + (tr.trim.shownKm != null ? U.dist(tr.trim.shownKm) + ' of it' : 'the published part') + '. ' + tr.trim.rawPoints + ' GPS points reduced to ' + tr.line.length + '.<ul>' +
          tr.trim.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>' +
          (e.links && e.links.length ? '<p style="margin:10px 0 0;font-size:14px">Trail info: ' + e.links.map(function (l) { return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>'; }).join(' · ') + '</p>' : '') +
          '</section>';
      }

      if (e.questions && e.questions.length) html += '<section class="panel" style="border-color:#f3c98b;background:#fffaf0"><h2>Questions for Christian <span class="count">' + e.questions.length + ' open</span></h2><ol style="margin:0;padding-left:20px">' +
        e.questions.map(function (q) { return '<li style="margin:0 0 6px">' + esc(q) + '</li>'; }).join('') + '</ol><p class="count" style="margin:8px 0 0">The draft doesn\'t guess at these. Answer in a voice note or in chat and they go into the next pass.</p></section>';

      html += '<section class="panel"><h2>Photos <span class="count">' + e.photos.length + ' added · ' + e.photos.filter(function (p) { return !p.caption; }).length + ' need captions</span></h2>' +
        (e.photos.length ? '<div class="photos">' + e.photos.map(function (p, i) {
          return '<figure class="photo"><button type="button" data-ph="' + i + '"><img src="' + esc(p.src) + '" alt="' + esc(p.caption) + '" loading="lazy"></button><figcaption>' +
            (p.caption ? esc(p.caption) : '<i class="muted">No caption yet</i>') + '<div class="tags">' + (p.cover ? '<span class="pill s-script">Cover</span>' : '') +
            '<span class="pill">' + (p.use === 'episode' ? 'Episode art' : p.use === 'skip' ? 'Not used' : 'In post') + '</span>' + (p.takenAt ? '<span class="pill">' + esc(String(p.takenAt).slice(11, 16)) + '</span>' : '') + '</div></figcaption></figure>';
        }).join('') + '</div>' : '<div class="empty">No photos yet. Add them to the Drive inbox; location data is stripped when they come in.</div>') + '</section>';

      html += '<div class="cols"><section class="panel"><h2>Post draft <span class="btns"><button type="button" class="btn ghost" data-copy="post">Copy post</button></span></h2>' +
        (e.post.body ? '<h3 style="font-size:20px;margin-bottom:8px">' + esc(e.post.title || e.title) + '</h3><div class="text">' + esc(e.post.body) + '</div><p class="count">' + words(e.post.body) + ' words</p>' : '<div class="empty">Not written yet.</div>') + '</section>' +
        '<section class="panel"><h2>Episode <span class="btns"><button type="button" class="btn" data-copy="prompt">Copy audio prompt</button><button type="button" class="btn ghost" data-copy="script">Script only</button></span></h2>' +
        (e.episode.script ? '<h3 style="font-size:20px;margin-bottom:8px">' + esc(e.episode.title) + '</h3><p class="count">' + words(e.episode.script) + ' words · about ' + Math.max(1, Math.round(words(e.episode.script) / 150)) + ' min at 150 wpm</p><div class="text script">' + esc(e.episode.script) + '</div>' +
          '<details style="margin-top:12px"><summary>What the audio prompt looks like</summary><div class="prompt">' + esc(prompt) + '</div></details>' : '<div class="empty">No script yet.</div>') +
        (e.episode.audio ? '<p style="margin-top:12px"><audio controls preload="none" src="' + esc(e.episode.audio) + '" style="width:100%"></audio></p>' : '<p class="count" style="margin-top:12px">No audio attached yet. Render it from the prompt, master to -16 LUFS, then send it over to attach.</p>') +
        '</section></div>';

      if (e.fieldNotes) html += '<section class="panel"><details><summary>Field notes as they came in</summary><div class="text" style="margin-top:10px">' + esc(e.fieldNotes) + '</div></details></section>';
      app.innerHTML = html;

      if (tr.line && tr.line.length > 1) {
        var map = window.L ? makeMap(document.getElementById('map'), routeLayers(tr.line)) : makeMap(document.getElementById('map'), []);
        profileSVG(document.getElementById('prof'), tr.profile, scrubber(map, tr.line));
      }
      app.querySelectorAll('[data-copy]').forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.copy;
          if (k === 'post') copy((e.post.title || e.title) + '\n\n' + e.post.body, 'Post');
          else if (k === 'script') copy(e.episode.script, 'Script');
          else copy(prompt, 'Audio prompt');
        };
      });
      app.querySelectorAll('[data-ph]').forEach(function (b) {
        b.onclick = function () { var p = e.photos[+b.dataset.ph], d = document.getElementById('lightbox'); d.querySelector('img').src = p.src; d.querySelector('img').alt = p.caption; d.querySelector('p').textContent = p.caption; d.showModal(); };
      });
    });
  }

  // ── Check a ride: what gets cut, before anything is published ─────────
  function check() {
    return get('data/trailheads.json').then(function (thj) {
      var th = thj.trailheads || [], zones = store('fieldZones') || [];
      app.innerHTML = '<h1>Check a ride</h1><p class="lede">Drop a Cyclemeter export to see exactly what would be published. The file stays on this device; nothing is uploaded. ' +
        'Private zones (home, a friend\'s place) are kept in this browser only and are never part of the site.</p>' +
        '<section class="panel" style="margin-top:16px"><label class="drop" id="drop"><input type="file" accept=".gpx,.csv,.txt,application/gpx+xml,text/csv,text/plain" id="file"><b>Drop a Cyclemeter export here</b> or tap to choose one<br><span class="muted">GPX or the point-by-point CSV</span></label>' +
        '<div class="form" style="margin-top:12px"><label>Activity<select id="kind"><option value="">From the file</option><option value="ride">Ride</option><option value="hike">Hike</option><option value="forage">Foraging walk</option></select></label>' +
        '<label>Trailhead snap range<select id="range"><option value="1000">1 km</option><option value="2500" selected>2.5 km</option><option value="5000">5 km</option></select></label></div></section>' +
        '<section class="panel" id="result" hidden></section>' +
        '<div class="cols"><section class="panel"><h2>Private zones <span class="count">this browser only</span></h2><div id="zones"></div>' +
        '<div class="form" style="margin-top:10px"><label>Name<input id="zn" placeholder="Home"></label><label>Latitude<input id="zlat" inputmode="decimal"></label><label>Longitude<input id="zlon" inputmode="decimal"></label>' +
        '<label>Radius (m)<input id="zr" value="500" inputmode="numeric"></label><button type="button" class="btn" id="zadd">Add zone</button></div>' +
        '<p class="count" style="margin-top:8px">Tip: after loading a ride that started at home, “Use the start as a private zone” fills this in for you.</p></section>' +
        '<section class="panel"><h2>Known trailheads <span class="count">' + th.length + '</span></h2><ul class="links">' +
        th.map(function (t) { return '<li><b>' + esc(t.name) + '</b>' + (t.area ? ' · ' + esc(t.area) : '') + (t.source ? ' · <a href="' + esc(t.source) + '" target="_blank" rel="noopener">info</a>' : '') + '</li>'; }).join('') +
        '</ul><p class="count" style="margin-top:8px">A track that starts or ends within the snap range of one of these is trimmed to begin and end exactly there. Ask Claude to add your regular trailheads (from AllTrails or the land agency).</p></section></div>';

      var gpxText = null;
      function drawZones() {
        document.getElementById('zones').innerHTML = zones.length ? '<table class="zones"><tr><th>Name</th><th>Radius</th><th></th></tr>' + zones.map(function (z, i) {
          return '<tr><td>' + esc(z.name || 'Zone') + '</td><td>' + z.radius + ' m</td><td><button type="button" class="chip" data-zdel="' + i + '">Remove</button></td></tr>'; }).join('') + '</table>' :
          '<p class="muted">None set. Add home so a ride that starts from the door never shows it.</p>';
        app.querySelectorAll('[data-zdel]').forEach(function (b) { b.onclick = function () { zones.splice(+b.dataset.zdel, 1); store('fieldZones', zones); drawZones(); run(); }; });
      }
      drawZones();
      document.getElementById('zadd').onclick = function () {
        var lat = parseFloat(document.getElementById('zlat').value), lon = parseFloat(document.getElementById('zlon').value), r = parseFloat(document.getElementById('zr').value) || 500;
        if (!isFinite(lat) || !isFinite(lon)) return toast('Enter a latitude and longitude');
        zones.push({ name: document.getElementById('zn').value || 'Zone', lat: lat, lon: lon, radius: r }); store('fieldZones', zones); drawZones(); run();
      };
      var drop = document.getElementById('drop'), file = document.getElementById('file');
      function load(f) { if (!f) return; var rd = new FileReader(); rd.onload = function () { gpxText = rd.result; run(); }; rd.readAsText(f); }
      file.onchange = function () { load(file.files[0]); };
      ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (ev) { load(ev.dataTransfer.files[0]); });
      document.getElementById('kind').onchange = run; document.getElementById('range').onchange = run;

      function run() {
        if (!gpxText) return;
        var b = T.build(gpxText, { kind: document.getElementById('kind').value || null, trailheads: th, privateZones: zones, snapRange: +document.getElementById('range').value });
        var res = document.getElementById('result'); res.hidden = false;
        if (b.raw.length < 2) { res.innerHTML = '<p>That file has no track points.</p>'; return; }
        res.innerHTML = '<h2>' + esc(b.name || (KIND[b.kind] || 'Track') + (b.stats.start ? ', ' + new Date(b.stats.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '')) + ' <span class="btns"><button type="button" class="btn ghost" id="zstart">Use the start as a private zone</button><button type="button" class="btn" id="dl">Download trimmed GPX</button></span></h2>' +
          '<div class="ridecard"><div class="map" id="cmap"></div><div class="statgrid">' + statTiles(b.stats, b.kind) + '</div></div>' +
          '<div class="legend"><span><i style="background:#d8618f"></i>Published</span><span><i style="background:#c0392b"></i>Cut</span><span><i style="background:rgba(15,77,71,.35)"></i>Private zone</span><span><i style="background:#2f8f6b"></i>Trailhead</span></div>' +
          '<div class="profile" id="cprof"></div><div class="trim"><b>What happened</b> · ' + b.raw.length + ' points in the file, ' + (b.kept[1] - b.kept[0] + 1) + ' shown on the map (' + U.dist(b.trim.shownKm) + ' of ' + U.dist(b.stats.distanceKm) + '). The numbers count the whole activity.<ul>' +
          (b.trim.notes.length ? b.trim.notes : ['Nothing to cut.']).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
        if (window.L) {
          var raw = b.raw.map(function (p) { return [p.lat, p.lon]; }), k0 = b.kept[0], k1 = b.kept[1];
          var layers = [];
          if (k0 > 0) layers.push(L.polyline(raw.slice(0, k0 + 1), { color: '#c0392b', weight: 3, dashArray: '6 6' }));
          if (k1 < raw.length - 1) layers.push(L.polyline(raw.slice(k1), { color: '#c0392b', weight: 3, dashArray: '6 6' }));
          layers = layers.concat(routeLayers(b.line));
          zones.forEach(function (z) { layers.push(L.circle([z.lat, z.lon], { radius: z.radius, color: '#0f4d47', weight: 1, fillOpacity: 0.18 }).bindTooltip(esc(z.name))); });
          th.forEach(function (t) { layers.push(L.circle([t.lat, t.lon], { radius: t.radius || 150, color: '#2f8f6b', weight: 2, fillOpacity: 0.12 }).bindTooltip(esc(t.name))); });
          maps.forEach(function (m) { m.remove(); }); maps = [];
          var map = makeMap(document.getElementById('cmap'), layers);
          map.fitBounds(L.polyline(raw).getBounds(), { padding: [24, 24] });
          profileSVG(document.getElementById('cprof'), b.profile, scrubber(map, b.line));
        }
        document.getElementById('zstart').onclick = function () {
          var p = b.raw[b.activity[0]]; document.getElementById('zlat').value = p.lat.toFixed(5); document.getElementById('zlon').value = p.lon.toFixed(5);
          document.getElementById('zn').value = 'Home'; document.getElementById('zn').focus(); toast('Check the name and radius, then Add zone');
        };
        document.getElementById('dl').onclick = function () {
          var kept = b.raw.slice(b.kept[0], b.kept[1] + 1);
          var x = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Field Notes (trimmed)" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>' + esc(b.name) + '</name><trkseg>\n' +
            kept.map(function (p) { return '<trkpt lat="' + p.lat + '" lon="' + p.lon + '">' + (p.ele != null ? '<ele>' + p.ele + '</ele>' : '') + (p.t ? '<time>' + new Date(p.t).toISOString() + '</time>' : '') + '</trkpt>'; }).join('\n') + '\n</trkseg></trk></gpx>\n';
          var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([x], { type: 'application/gpx+xml' })); a.download = (b.name || 'track').replace(/[^\w-]+/g, '-') + '-trimmed.gpx'; a.click();
        };
      }
    });
  }

  // ── Router ───────────────────────────────────────────────────────────
  function route() {
    maps.forEach(function (m) { m.remove(); }); maps = [];
    var h = location.hash.replace(/^#\/?/, ''), m = /^e\/(.+)$/.exec(h);
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('on', (a.dataset.nav === 'check') === (h === 'check')); });
    var p = h === 'check' ? check() : m ? event(decodeURIComponent(m[1])) : list();
    p.then(function () { window.scrollTo(0, 0); }, function (err) {
      app.innerHTML = '<div class="empty">Could not load that.<br><span class="muted">' + esc(err.message) + '</span><br><br><a href="#/">Back to all adventures</a></div>';
    });
  }
  var ub = document.getElementById('units');
  function unitLabel() { ub.textContent = units === 'imperial' ? 'mi · ft' : 'km · m'; }
  ub.onclick = function () { units = units === 'imperial' ? 'metric' : 'imperial'; store('fieldUnits', units); unitLabel(); route(); };
  unitLabel();
  var lb = document.getElementById('lightbox');
  lb.querySelector('.x').onclick = function () { lb.close(); };
  lb.addEventListener('click', function (ev) { if (ev.target === lb) lb.close(); });
  get('data/show.json').then(function (s) { SHOW = s; addEventListener('hashchange', route); route(); });
})();
