/* ROUTE VIEW: the map, elevation profile, stat tiles and route sketch shared by the Field Notes
   manager (field/) and the public Play pages (play/). Leaflet must be loaded first for maps;
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

  // ── Dashboard: what the track says beyond the four tiles ──────────────
  // Everything here is worked out in the browser from the published line (lat, lon, elevation, seconds
  // from the start), its elevation profile and the stats. The line is only the mapped part, so the charts
  // follow it; the headline numbers are the whole activity's.
  var TZ = 'America/Los_Angeles';
  function clock(ms) { return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).toLowerCase().replace(' ', ' '); }
  function mmss(sec) { sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60; return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + x).slice(-2); }
  function spd(kmh) { return units === 'imperial' ? kmh * 0.621371 : kmh; }
  function spdU() { return units === 'imperial' ? 'mph' : 'km/h'; }
  function upU() { return units === 'imperial' ? 'ft' : 'm'; }
  function upV(m) { return Math.round(units === 'imperial' ? m * 3.28084 : m); }
  function bearing(a, b) {
    var r = Math.PI / 180, y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r);
    var x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r);
    return (Math.atan2(y, x) / r + 360) % 360;
  }
  function D(a, b) { return dist({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }); }
  // sunrise and sunset (the sunrise equation; within a minute or two)
  function sun(ms, lat, lon) {
    // the day number of the ride's local date (noon UTC that day), then solar noon there from the longitude
    var ymd = new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ }).split('-');
    var r = Math.PI / 180, jd = Date.UTC(+ymd[0], +ymd[1] - 1, +ymd[2], 12) / 86400000 + 2440587.5, n = Math.round(jd - 2451545 + 0.0008), J = n - lon / 360;
    var M = (357.5291 + 0.98560028 * J) % 360, C = 1.9148 * Math.sin(M * r) + 0.02 * Math.sin(2 * M * r) + 0.0003 * Math.sin(3 * M * r);
    var lam = (M + C + 180 + 102.9372) % 360, Jt = 2451545 + J + 0.0053 * Math.sin(M * r) - 0.0069 * Math.sin(2 * lam * r);
    var dec = Math.asin(Math.sin(lam * r) * Math.sin(23.44 * r)), cw = (Math.sin(-0.833 * r) - Math.sin(lat * r) * Math.sin(dec)) / (Math.cos(lat * r) * Math.cos(dec));
    if (cw < -1 || cw > 1) return null;
    var w = Math.acos(cw) / r / 360, toMs = function (j) { return (j - 2440587.5) * 86400000; };
    return { rise: toMs(Jt - w), set: toMs(Jt + w) };
  }
  function analyse(d) {
    var s = d.stats || {}, L = solid(d.line), out = { s: s };
    if (L.length < 2) return out;
    var c = [0], timed = L[0].length > 3 && L[L.length - 1][3] != null;
    for (var i = 1; i < L.length; i++) c.push(c[i - 1] + D(L[i - 1], L[i]));
    out.km = c[c.length - 1] / 1000;
    // speed along the way: over windows of at least 150 m, so GPS jitter between close points doesn't spike it
    if (timed) {
      var sp = [], j = 0;
      for (i = 0; i < L.length; i++) {
        var a = i, b = i;
        while (a > 0 && c[i] - c[a] < 75) a--;
        while (b < L.length - 1 && c[b] - c[i] < 75) b++;
        var dt = L[b][3] - L[a][3];
        sp.push(dt > 0 ? (c[b] - c[a]) / dt * 3.6 : 0);
      }
      out.speed = sp.map(function (v, k) { return [c[k] / 1000, Math.min(v, (s.maxKmh || 80) * 1.05)]; });
      // time by terrain, moving only: climbing (over 2%), level, descending, and stopped
      var tc = 0, tf = 0, td = 0, ts = 0, up = 0;
      for (i = 1; i < L.length; i++) {
        var dd = c[i] - c[i - 1], t = L[i][3] - L[i - 1][3], g = dd > 0 && L[i][2] != null && L[i - 1][2] != null ? (L[i][2] - L[i - 1][2]) / dd : 0;
        if (t <= 0) continue;
        if (dd / t * 3.6 < 2.5) { ts += t; continue; }
        if (g > 0.02) { tc += t; up += L[i][2] - L[i - 1][2]; } else if (g < -0.02) td += t; else tf += t;
      }
      out.time = { climb: tc, flat: tf, down: td, stop: ts };
      // splits: the time for each whole mile (or km)
      var unit = units === 'imperial' ? 1609.344 : 1000, splits = [], last = 0, k = 1;
      for (i = 1; i < L.length; i++) {
        while (c[i] >= k * unit) {
          var f = (k * unit - c[i - 1]) / ((c[i] - c[i - 1]) || 1), at = L[i - 1][3] + (L[i][3] - L[i - 1][3]) * f;
          splits.push(at - last); last = at; k++;
        }
      }
      out.splits = splits;
      out.climbRate = tc > 600 && up > 30 ? up / (tc / 3600) : null;
    }
    // grades, from the evenly spaced profile (a little smoothed)
    var P = (d.profile || []).filter(function (q) { return q[1] != null; });
    if (P.length > 4) {
      var bins = [0, 0, 0, 0, 0, 0, 0], edges = [-8, -4, -1.5, 1.5, 4, 8];
      var steep = { g: 0 }, climb = null, best = null;
      for (i = 1; i < P.length; i++) {
        var dk = (P[i][0] - P[i - 1][0]) * 1000; if (dk <= 0) continue;
        var i0 = Math.max(0, i - 2), i1 = Math.min(P.length - 1, i + 1), gr = (P[i1][1] - P[i0][1]) / (((P[i1][0] - P[i0][0]) * 1000) || 1) * 100;
        var bi = 0; while (bi < edges.length && gr >= edges[bi]) bi++;
        bins[bi] += dk;
      }
      out.grades = bins;
      // steepest stretch of at least 200 m
      for (i = 0; i < P.length; i++) {
        for (j = i + 1; j < P.length && (P[j][0] - P[i][0]) * 1000 < 200; j++);
        if (j >= P.length) break;
        var gg = (P[j][1] - P[i][1]) / ((P[j][0] - P[i][0]) * 1000) * 100;
        if (gg > steep.g) steep = { g: gg, at: P[i][0] };
      }
      out.steepest = steep.g > 1 ? steep : null;
      // longest climb: up and up, letting dips of under 10 m pass
      for (i = 1; i < P.length; i++) {
        if (!climb) climb = { from: P[i - 1], top: P[i - 1] };
        if (P[i][1] >= climb.top[1]) climb.top = P[i];
        else if (climb.top[1] - P[i][1] > 10) {
          if (!best || climb.top[1] - climb.from[1] > best.up) best = { up: climb.top[1] - climb.from[1], km: climb.top[0] - climb.from[0], at: climb.from[0] };
          climb = { from: P[i], top: P[i] };
        }
      }
      if (climb && (!best || climb.top[1] - climb.from[1] > best.up)) best = { up: climb.top[1] - climb.from[1], km: climb.top[0] - climb.from[0], at: climb.from[0] };
      out.longest = best && best.up >= 15 ? best : null;
    }
    // the shape of it: a loop, an out-and-back or one way, how far it ever got from the start, and which way it went
    var far = 0, rose = [0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 1; i < L.length; i++) {
      far = Math.max(far, D(L[0], L[i]));
      rose[Math.round(bearing(L[i - 1], L[i]) / 45) % 8] += c[i] - c[i - 1];
    }
    out.far = far / 1000; out.rose = rose;
    var gap = D(L[0], L[L.length - 1]);
    if (gap > Math.max(400, far * 0.35)) out.shape = 'One way';
    else {
      var half = Math.floor(L.length / 2), near = 0, cnt = 0;
      for (i = half; i < L.length; i += 2) { cnt++; for (j = 0; j < half; j += 2) if (D(L[i], L[j]) < 60) { near++; break; } }
      out.shape = cnt && near / cnt > 0.6 ? 'Out and back' : 'Loop';
    }
    // the clock and the sun
    if (s.start) {
      var t0 = Date.parse(s.start), t1 = t0 + (s.elapsedSec || 0) * 1000, sn = sun(t0, L[0][0], L[0][1]);
      out.clock = { start: t0, end: t1, sun: sn };
    }
    return out;
  }

  // a speedometer: an arc from 0 to `max`, filled to the value, with a needle that swings up to it
  function gauge(label, v, max, color, sub) {
    var W = 220, cx = 110, cy = 112, r = 88, ang = Math.PI * (1 - Math.min(v, max) / max);
    function pt(a, rr) { return [(cx + rr * Math.cos(a)).toFixed(1), (cy - rr * Math.sin(a)).toFixed(1)]; }
    var p0 = pt(Math.PI, r), p1 = pt(0, r), pv = pt(ang, r), step = niceStep(max / 5), ticks = '';
    for (var t = 0; t <= max + 1e-9; t += step / 2) {
      var a = Math.PI * (1 - t / max), major = Math.abs(t / step - Math.round(t / step)) < 1e-6, q0 = pt(a, r - 13), q1 = pt(a, r - (major ? 24 : 19));
      ticks += '<line x1="' + q0[0] + '" y1="' + q0[1] + '" x2="' + q1[0] + '" y2="' + q1[1] + '" class="tk' + (major ? ' mj' : '') + '"/>';
      if (major) { var ql = pt(a, r - 36); ticks += '<text x="' + ql[0] + '" y="' + (+ql[1] + 4) + '" class="tl">' + +t.toFixed(1) + '</text>'; }
    }
    var deg = 180 * Math.min(v, max) / max, n = pt(ang, r - 16), anim = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? '' :
      '<animateTransform attributeName="transform" type="rotate" from="' + (-deg) + ' ' + cx + ' ' + cy + '" to="0 ' + cx + ' ' + cy + '" dur="1.4s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .9 .25 1"/>';
    return '<figure class="gauge"><svg viewBox="0 0 ' + W + ' 132" role="img" aria-label="' + esc(label) + ': ' + v.toFixed(1) + ' ' + spdU() + '">' +
      '<path d="M' + (cx - r - 14) + ' ' + cy + ' A' + (r + 14) + ' ' + (r + 14) + ' 0 0 1 ' + (cx + r + 14) + ' ' + cy + ' L' + (cx + r + 14) + ' ' + (cy + 14) + ' L' + (cx - r - 14) + ' ' + (cy + 14) + 'Z" class="face"/>' +
      '<path d="M' + p0 + ' A' + r + ' ' + r + ' 0 0 1 ' + p1 + '" class="trk"/>' +
      '<path d="M' + p0 + ' A' + r + ' ' + r + ' 0 0 1 ' + pv + '" class="val ' + color + '"/>' + ticks +
      '<g><line x1="' + cx + '" y1="' + cy + '" x2="' + n[0] + '" y2="' + n[1] + '" class="ndl"/>' + anim + '</g><circle cx="' + cx + '" cy="' + cy + '" r="7" class="hub"/></svg>' +
      '<figcaption><b>' + v.toFixed(1) + '</b> <small>' + spdU() + '</small><span>' + esc(label) + (sub ? ' · ' + esc(sub) : '') + '</span></figcaption></figure>';
  }
  // speed along the way, with the average as a dashed line and the top speed marked
  function speedChart(sp, avg, top) {
    var W = 1000, H = 150, pb = 18, pt = 8, kmMax = sp[sp.length - 1][0] || 1, vMax = niceStep(spd(top) / 3) * 4 || 1;
    function X(k) { return k / kmMax * W; } function Y(v) { return pt + (1 - spd(v) / vMax) * (H - pt - pb); }
    var d = sp.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('');
    var mi = 0; sp.forEach(function (p, i) { if (p[1] > sp[mi][1]) mi = i; });
    var grid = '', st = niceStep(vMax / 3);
    for (var v = st; v < vMax; v += st) grid += '<line x1="0" x2="' + W + '" y1="' + (pt + (1 - v / vMax) * (H - pt - pb)).toFixed(1) + '" y2="' + (pt + (1 - v / vMax) * (H - pt - pb)).toFixed(1) + '" class="gl"/><text x="4" y="' + (pt + (1 - v / vMax) * (H - pt - pb) - 3).toFixed(1) + '" class="ax">' + v + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="chart" role="img" aria-label="Speed along the way">' +
      '<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>' + grid +
      '<path d="' + d + 'L' + W + ' ' + (H - pb) + 'L0 ' + (H - pb) + 'Z" fill="url(#sg)"/><path d="' + d + '" class="ln"/>' +
      (avg ? '<line x1="0" x2="' + W + '" y1="' + Y(avg).toFixed(1) + '" y2="' + Y(avg).toFixed(1) + '" class="avg"/>' : '') +
      '<circle cx="' + X(sp[mi][0]).toFixed(1) + '" cy="' + Y(sp[mi][1]).toFixed(1) + '" r="5" class="topdot"/></svg>';
  }
  function donut(parts) {
    var tot = parts.reduce(function (a, p) { return a + p[1]; }, 0) || 1, R = 52, C = 2 * Math.PI * R, off = 0;
    var arcs = parts.map(function (p) {
      var len = p[1] / tot * C, a = '<circle cx="70" cy="70" r="' + R + '" class="seg ' + p[2] + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
      off += len; return a;
    }).join('');
    return '<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="Where the time went"><g transform="rotate(-90 70 70)">' + arcs + '</g>' +
      '<text x="70" y="66" class="dn-b">' + dur(tot) + '</text><text x="70" y="84" class="dn-s">in all</text></svg><ul>' +
      parts.map(function (p) { return '<li><i class="' + p[2] + '"></i>' + esc(p[0]) + ' <b>' + dur(p[1]) + '</b> <small>' + Math.round(p[1] / tot * 100) + '%</small></li>'; }).join('') + '</ul></div>';
  }
  function gradeBars(bins) {
    var labs = ['Steep down', 'Down', 'Easing down', 'Level', 'Easing up', 'Up', 'Steep up'];
    var tot = bins.reduce(function (a, b) { return a + b; }, 0) || 1, mx = Math.max.apply(0, bins) || 1;
    return '<div class="grades">' + bins.map(function (b, i) {
      return '<div class="gb"><span class="gv">' + Math.round(b / tot * 100) + '%</span><i class="g' + i + '" data-st="height:' + Math.max(2, b / mx * 100).toFixed(0) + '%"></i><small>' + labs[i] + '</small></div>';
    }).join('') + '</div>';
  }
  function splitBars(sp) {
    var mn = Math.min.apply(0, sp), mx = Math.max.apply(0, sp), fast = sp.indexOf(mn);
    return '<div class="spl">' + sp.map(function (t, i) {
      var h = mx > mn ? 22 + 50 * (mx - t) / (mx - mn) : 50;
      return '<div class="sb' + (i === fast ? ' best' : '') + '" title="' + (units === 'imperial' ? 'Mile ' : 'Km ') + (i + 1) + ': ' + mmss(t) + '"><span>' + mmss(t) + '</span><i data-st="height:' + h.toFixed(0) + '%"></i><small>' + (i + 1) + '</small></div>';
    }).join('') + '</div>';
  }
  function roseSVG(rose) {
    var mx = Math.max.apply(0, rose) || 1, out = '', names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (var i = 0; i < 8; i++) {
      var a0 = (i * 45 - 20 - 90) * Math.PI / 180, a1 = (i * 45 + 20 - 90) * Math.PI / 180, r = 12 + 46 * Math.sqrt(rose[i] / mx);
      out += '<path d="M70 70 L' + (70 + r * Math.cos(a0)).toFixed(1) + ' ' + (70 + r * Math.sin(a0)).toFixed(1) + ' A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + (70 + r * Math.cos(a1)).toFixed(1) + ' ' + (70 + r * Math.sin(a1)).toFixed(1) + 'Z" class="pet"/>';
    }
    var top = rose.indexOf(mx);
    return '<svg viewBox="0 0 140 140" class="rose" role="img" aria-label="Mostly headed ' + names[top] + '"><circle cx="70" cy="70" r="60" class="rr"/><circle cx="70" cy="70" r="34" class="rr"/>' + out +
      '<text x="70" y="12" class="rl">N</text><text x="133" y="74" class="rl">E</text><text x="70" y="137" class="rl">S</text><text x="7" y="74" class="rl">W</text></svg><p class="rose-c">Mostly <b>' + names[top] + '</b></p>';
  }
  // Which parts a post shows. A note can pick its own (the Studio has a switch on each); without a pick,
  // the speed, the climbing and the hidden numbers show and the rest wait to be switched on.
  var PARTS = { speed: 'Speed', updown: 'Up and down', grade: 'How steep', time: 'Where the time went', splits: 'Mile by mile', dir: 'Which way', facts: 'Hidden in the numbers' };
  var SHOWN = { speed: true, updown: true, facts: true };
  function shown(show, k) { return show && show[k] != null ? !!show[k] : !!SHOWN[k]; }
  // opts.show: the note's pick; opts.edit(key, on): draw every part with an On Play switch (the Studio)
  function dashboard(el, d, opts) {
    if (!el) return;
    opts = opts || {};
    var a = analyse(d), s = a.s, ride = d.kind !== 'hike';
    var html = '', card = function (cls, title, body) {
      var on = shown(opts.show, cls);
      if (!opts.edit && !on) return '';
      return '<section class="dc ' + cls + (on ? '' : ' off') + '" data-k="' + cls + '"><h3>' + title + '</h3>' +
        (opts.edit ? '<label class="dsw" title="Show this on the post"><input type="checkbox" data-k="' + cls + '"' + (on ? ' checked' : '') + '><span>On Play</span></label>' : '') + body + '</section>';
    };
    // speed gauges
    if (s.avgKmh || s.maxKmh) {
      var top = spd(s.maxKmh || 0), max = Math.max(ride ? 20 : 5, niceStep(top / 4) * 5);
      while (max < top * 1.08) max += niceStep(max / 5);
      html += card('speed', 'Speed', '<div class="sp-row"><div class="gauges">' + gauge('Average, moving', spd(s.avgKmh || 0), max, 'g-ink') + gauge('Top speed', top, max, 'g-acc') + '</div>' +
        (a.speed ? '<div class="sp-ch">' + speedChart(a.speed, s.avgKmh, s.maxKmh) + '<p class="cap"><span class="k ln"></span>speed along the way <span class="k avg"></span>average <span class="k top"></span>top</p></div>' : '') + '</div>');
    }
    // up and down
    if (s.gainM != null) {
      var lo = s.minEleM, hi = s.maxEleM, mxv = Math.max(s.gainM || 0, s.lossM || 0) || 1;
      html += card('updown', 'Up and down',
        '<div class="ud"><div class="udb up"><i data-st="height:' + Math.max(4, (s.gainM || 0) / mxv * 100).toFixed(0) + '%"></i><b>↑ ' + upV(s.gainM || 0).toLocaleString() + '</b><small>' + upU() + ' ascent</small></div>' +
        '<div class="udb down"><i data-st="height:' + Math.max(4, (s.lossM || 0) / mxv * 100).toFixed(0) + '%"></i><b>↓ ' + upV(s.lossM || 0).toLocaleString() + '</b><small>' + upU() + ' descent</small></div>' +
        (lo != null && hi != null ? '<div class="range"><span class="hi"><b>' + upV(hi).toLocaleString() + '</b> ' + upU() + '<small>high point</small></span><span class="bar"></span><span class="lo"><b>' + upV(lo).toLocaleString() + '</b> ' + upU() + '<small>low point</small></span><p>' + upV(hi - lo).toLocaleString() + ' ' + upU() + ' between them</p></div>' : '') + '</div>');
    }
    if (a.grades) html += card('grade', 'How steep', gradeBars(a.grades) + '<p class="cap">Share of the distance at each grade: level is within 1.5%, steep is over 8%.</p>');
    if (a.time) html += card('time', 'Where the time went', donut([['Climbing', a.time.climb, 't-up'], ['Level', a.time.flat, 't-flat'], ['Descending', a.time.down, 't-down'], ['Stopped', a.time.stop, 't-stop']].filter(function (p) { return p[1] > 30; })));
    if (a.splits && a.splits.length > 1) html += card('splits', (units === 'imperial' ? 'Mile' : 'Kilometre') + ' by ' + (units === 'imperial' ? 'mile' : 'kilometre'), splitBars(a.splits) + '<p class="cap">Time for each whole ' + (units === 'imperial' ? 'mile' : 'km') + '; taller is quicker, the quickest is marked.</p>');
    if (a.rose) html += card('dir', 'Which way', roseSVG(a.rose));
    // the things the numbers don't say out loud
    var facts = [];
    if (a.steepest) facts.push(['Steepest stretch', Math.round(a.steepest.g) + '%', 'over 200 m, ' + U.dist(a.steepest.at) + ' in']);
    if (a.longest) facts.push(['Longest climb', upV(a.longest.up).toLocaleString() + ' ' + upU(), 'over ' + U.dist(a.longest.km) + (a.longest.at < 0.05 ? ', from the start' : ', from ' + U.dist(a.longest.at) + ' in')]);
    if (a.climbRate) facts.push(['Climbing rate', upV(a.climbRate).toLocaleString() + ' ' + upU() + '/h', 'while going up']);
    if (a.splits && a.splits.length) { var f = Math.min.apply(0, a.splits); facts.push(['Quickest ' + (units === 'imperial' ? 'mile' : 'km'), mmss(f), (units === 'imperial' ? 'mile ' : 'km ') + (a.splits.indexOf(f) + 1)]); }
    if (s.elapsedSec && s.movingSec) facts.push(['Stopped', dur(Math.max(0, s.elapsedSec - s.movingSec)), Math.round(100 * (1 - s.movingSec / s.elapsedSec)) + '% of the time out']);
    if (a.far) facts.push(['Farthest from the start', U.dist(a.far), 'as the crow flies']);
    if (a.shape) facts.push(['The shape of it', a.shape, U.dist(a.km) + ' on the map']);
    if (a.clock) {
      facts.push(['Out', clock(a.clock.start) + ' to ' + clock(a.clock.end), new Date(a.clock.start).toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ })]);
      var sn = a.clock.sun;
      if (sn) {
        var gapS = (sn.set - a.clock.end) / 1000, gapR = (a.clock.start - sn.rise) / 1000;
        // the sun only when it was part of it: out near sunrise, or back near (or after) sunset
        if (gapR < 2 * 3600) facts.push(['Sunrise', clock(sn.rise), gapR < 0 ? 'out ' + dur(-gapR) + ' before it' : 'out ' + dur(gapR) + ' after it']);
        if (gapS < 3 * 3600) facts.push(['Sunset', clock(sn.set), gapS >= 0 ? 'back ' + dur(gapS) + ' before it' : 'back ' + dur(-gapS) + ' after dark']);
      }
    }
    if (facts.length) html += card('facts', 'Hidden in the numbers', '<dl>' + facts.map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></dd></div>'; }).join('') + '</dl>');
    el.innerHTML = html;
    el.hidden = !html;
    // sizes are set here, not in the markup, so a page that forbids inline styles (the Studio) draws it too
    [].forEach.call(el.querySelectorAll('[data-st]'), function (n) { n.style.cssText = n.getAttribute('data-st'); });
    if (opts.edit) [].forEach.call(el.querySelectorAll('.dsw input'), function (c) {
      c.onchange = function () { c.closest('.dc').classList.toggle('off', !c.checked); opts.edit(c.getAttribute('data-k'), c.checked); };
    });
  }

  window.RouteView = {
    U: U, dur: dur, day: day, KIND: KIND, esc: esc, sketch: sketch, solid: solid, parts: parts,
    makeMap: makeMap, routeLayers: routeLayers, profileSVG: profileSVG, scrubber: scrubber, statTiles: statTiles,
    dashboard: dashboard, analyse: analyse, PARTS: PARTS, shown: shown,
    maps: maps, clearMaps: function () { maps.forEach(function (m) { m.remove(); }); maps.length = 0; },
    units: function () { return units; },
    setUnits: function (u) { units = u; store('fieldUnits', u); }
  };
})();
