/* ROUTE VIEW: the map, elevation profile, stat tiles and route sketch shared by the Field Notes
   manager (field/) and the public Notes pages (notes/). Leaflet must be loaded first for maps;
   everything else works without it. Units default to miles/feet and are remembered per browser. */
(function () {
  'use strict';
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var R = 6371008.8;
  function dist(a, b) {
    var r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  var maps = [];
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
  function cumKm(line) { var c = [0]; for (var i = 1; i < line.length; i++) c.push(c[i - 1] + dist({ lat: line[i - 1][0], lon: line[i - 1][1] }, { lat: line[i][0], lon: line[i][1] }) / 1000); return c; }
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

  window.RouteView = {
    U: U, dur: dur, day: day, KIND: KIND, esc: esc, sketch: sketch, solid: solid, parts: parts,
    makeMap: makeMap, routeLayers: routeLayers, profileSVG: profileSVG, scrubber: scrubber, statTiles: statTiles,
    maps: maps, clearMaps: function () { maps.forEach(function (m) { m.remove(); }); maps.length = 0; },
    units: function () { return units; },
    setUnits: function (u) { units = u; store('fieldUnits', u); }
  };
})();
