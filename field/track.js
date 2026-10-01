/* FIELD TRACK ENGINE. Reads a Cyclemeter export (GPX, or the point-by-point CSV), trims it so nothing private is published,
   and works out the card numbers. The same file runs in the browser (field manager preview) and
   in Node (tools/ingest.mjs), so a ride is trimmed the same way everywhere.

   Trimming, in order:
     1. Driving. Forgot to stop Cyclemeter and drove home? Car speed held for a while (faster than
        a bike or a hiker can keep up, and not just a fast downhill) ends the activity there.
        The same check runs at the start, for a track started in the car.
     2. Trailheads. If the start (or end) is near a known trailhead, the published track begins
        (or ends) at that trailhead, and anything before it (riding from home) is cut.
     3. Private zones. Any stretch at either end inside a private zone (home) is cut. Private zones
        never live in the published data: the browser keeps them in this device's storage and
        ingest reads them from field/private-zones.json, which git ignores.
     4. Fallback. An end with no trailhead loses its first/last 300 m, so it never points at a door. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FieldTrack = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var R = 6371008.8;
  function rad(d) { return d * Math.PI / 180; }
  function dist(a, b) {
    var dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // ── GPX ──────────────────────────────────────────────────────────────
  // Regex-based so it runs in Node without a DOM. Reads <trkpt> (and <rtept> as a fallback).
  function parseGPX(text) {
    var pts = [], re = /<(trkpt|rtept)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g, m;
    var name = (/<trk>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(text) || /<name>([\s\S]*?)<\/name>/.exec(text) || [])[1];
    while ((m = re.exec(text))) {
      var attrs = m[2], body = m[4] || '';
      var lat = parseFloat((/lat="([^"]+)"/.exec(attrs) || [])[1]);
      var lon = parseFloat((/lon="([^"]+)"/.exec(attrs) || [])[1]);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      var ele = parseFloat((/<ele>([^<]+)<\/ele>/.exec(body) || [])[1]);
      var time = (/<time>([^<]+)<\/time>/.exec(body) || [])[1];
      pts.push({ lat: lat, lon: lon, ele: isFinite(ele) ? ele : null, t: time ? Date.parse(time) : null });
    }
    if (name) name = name.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    if (/^(Cycle|Ride|Hike|Walk|Run)-\d{8}|^New Route$/i.test(name || '')) name = '';   // Cyclemeter's file name or default route name, not a title
    var desc = (/<desc>([\s\S]*?)<\/desc>/.exec(text) || [])[1] || '';
    return { name: name || '', points: pts, kind: kindFrom(desc) };
  }

  // Cyclemeter's point-by-point CSV export: one row every few seconds with Time, Latitude,
  // Longitude and "Elevation (feet)" or "Elevation (meters)". Times have no zone, so they're read
  // as local time on whatever device runs this (only their differences matter).
  function parseCSV(text) {
    var lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    var cells = function (l) { var out = [], f = '', q = false; for (var i = 0; i < l.length; i++) { var c = l[i]; if (q) { if (c === '"') { if (l[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { out.push(f); f = ''; } else f += c; } out.push(f); return out; };
    var head = cells(lines[0] || '').map(function (h) { return h.trim().toLowerCase(); });
    var col = function (re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; };
    var iT = col(/^time$/), iLa = col(/^latitude/), iLo = col(/^longitude/), iE = col(/^elevation/);
    var feet = iE >= 0 && /feet|\(ft\)/.test(head[iE]), pts = [];
    if (iLa < 0 || iLo < 0) return { name: '', points: [] };
    for (var r = 1; r < lines.length; r++) {
      var c = cells(lines[r]), lat = parseFloat(c[iLa]), lon = parseFloat(c[iLo]);
      if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) continue;
      var e = iE >= 0 ? parseFloat(c[iE]) : NaN, t = iT >= 0 ? Date.parse((c[iT] || '').trim().replace(' ', 'T')) : NaN;
      pts.push({ lat: lat, lon: lon, ele: isFinite(e) ? (feet ? e * 0.3048 : e) : null, t: isFinite(t) ? t : null });
    }
    return { name: '', points: pts, kind: kindFrom(head[1] || '') };
  }
  // Cyclemeter says what the activity was: "Cyclemeter Hike Aug 16…" in a GPX, "Hike Time" or
  // "Ride Time" as the CSV's second column.
  function kindFrom(s) { return /hike|walk|run/i.test(s) ? 'hike' : /cycle|ride/i.test(s) ? 'ride' : null; }
  // GPX or Cyclemeter CSV, whichever this is.
  function parse(text) { return /<gpx[\s>]/i.test(text.slice(0, 2000)) ? parseGPX(text) : parseCSV(text); }

  // ── Activity profiles ────────────────────────────────────────────────
  // car: speed (km/h) that means "in a vehicle" when held for `hold` seconds on ground that isn't
  // a steep downhill. move: below this counts as stopped for moving time.
  var KINDS = {
    ride: { car: 45, hold: 90, move: 3, label: 'Ride' },
    hike: { car: 14, hold: 60, move: 1, label: 'Hike' },
    forage: { car: 14, hold: 60, move: 1, label: 'Foraging walk' }
  };

  // Rolling speed (km/h) and grade over a time window centred on each point.
  function rolling(pts, win) {
    var out = new Array(pts.length), j0 = 0, j1 = 0, cum = cumDist(pts);
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].t == null) { out[i] = { v: 0, g: 0 }; continue; }
      while (j0 < i && pts[i].t - pts[j0].t > win * 500) j0++;
      if (j1 < i) j1 = i;
      while (j1 < pts.length - 1 && pts[j1 + 1].t != null && pts[j1 + 1].t - pts[i].t <= win * 500) j1++;
      var dt = (pts[j1].t - pts[j0].t) / 1000, dd = cum[j1] - cum[j0];
      var de = (pts[j1].ele != null && pts[j0].ele != null) ? pts[j1].ele - pts[j0].ele : 0;
      out[i] = { v: dt > 0 ? dd / dt * 3.6 : 0, g: dd > 20 ? de / dd : 0 };
    }
    return out;
  }
  function cumDist(pts) {
    var c = [0];
    for (var i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i - 1], pts[i]));
    return c;
  }

  // Runs of points that look like driving: fast, held, and not a downhill run (grade > -4%).
  function drivingRuns(pts, kind) {
    var k = KINDS[kind] || KINDS.ride, sp = rolling(pts, 30), runs = [], s = -1;
    for (var i = 0; i <= pts.length; i++) {
      var car = i < pts.length && sp[i].v > k.car && sp[i].g > -0.04;
      if (car && s < 0) s = i;
      if (!car && s >= 0) {
        var a = pts[s].t, b = pts[i - 1].t;
        if (a != null && b != null && (b - a) / 1000 >= k.hold) runs.push([s, i - 1]);
        s = -1;
      }
    }
    return runs;
  }

  function nearest(list, p) {
    var best = null, bd = Infinity;
    (list || []).forEach(function (z) {
      var d = dist(z, p);
      if (d < bd) { bd = d; best = z; }
    });
    return best ? { item: best, d: bd } : null;
  }

  // ── Trim ─────────────────────────────────────────────────────────────
  // opts: { kind, trailheads:[{id,name,lat,lon,radius}], privateZones:[{lat,lon,radius}],
  //         snapRange (m, how far a trailhead may be from the raw end to count; default 2500),
  //         fallback (m, default 300) }
  // Returns { points, from, to, notes:[...], startTrailhead, endTrailhead }.
  function trim(pts, opts) {
    opts = opts || {};
    var kind = opts.kind || 'ride', notes = [], a = 0, b = pts.length - 1;
    if (pts.length < 2) return { points: pts.slice(), from: 0, to: b, notes: ['Too few points to trim.'] };

    // 0. GPS warm-up. In the first minute a phone's first fixes can be stale and then jump to the
    //    real spot (a few hundred metres in seconds). Points before such a jump are dropped.
    //    Any step over 40 m at an impossible speed (over 60 km/h) counts; the last one wins, since a
    //    warm-up can settle in a few hops.
    var warm = -1;
    for (var w = a + 1; w <= b && pts[w].t != null && pts[a].t != null && pts[w].t - pts[a].t <= 60000; w++) {
      var jd = dist(pts[w - 1], pts[w]), jt = (pts[w].t - pts[w - 1].t) / 1000;
      if (jd > 40 && jt > 0 && jd / jt * 3.6 > 60) warm = w;
    }
    if (warm > a) { notes.push('Dropped ' + (warm - a) + ' GPS warm-up points (the first fixes jumped around before settling).'); a = warm; }

    // 1. Driving at either end. A drive with more of the activity before it than after it is the
    //    drive home: the track ends where it starts. One with more after it is a drive to the start.
    //    Judged by distance, not time, so hours of the phone sitting at home don't confuse it.
    var runs = drivingRuns(pts, kind), cum = cumDist(pts), total = cum[cum.length - 1];
    runs.forEach(function (r) {
      var before = cum[r[0]], after = total - cum[r[1]];
      if (after < before && r[0] - 1 < b) {
        b = Math.min(b, Math.max(a + 1, r[0] - 1));
        notes.push('Cut ' + km(pts, r[0], pts.length - 1) + ' at the end that looks like driving (' + clock(pts[r[0]].t) + ').');
      } else if (after >= before && r[1] + 1 > a) {
        a = Math.max(a, Math.min(b - 1, r[1] + 1));
        notes.push('Cut ' + km(pts, 0, r[1]) + ' at the start that looks like driving.');
      }
    });

    // The activity itself (what the stats count) is everything left after the warm-up and the
    // drive. The steps below only decide how much of it the map shows.
    var act = [a, b];

    // 2. Trailheads: start at the first time the track reaches the start trailhead, end at the last
    //    time it leaves the end trailhead.
    var range = opts.snapRange || 2500, th = opts.trailheads || [];
    var sTH = nearestOnSpan(th, pts, a, b, range, true), eTH = nearestOnSpan(th, pts, a, b, range, false);
    if (sTH) {
      if (sTH.index > a) notes.push('Starts at ' + sTH.item.name + ' (cut ' + km(pts, a, sTH.index) + ' before it).');
      else notes.push('Starts at ' + sTH.item.name + '.');
      a = sTH.index;
    }
    if (eTH) {
      if (eTH.index < b) notes.push('Ends at ' + eTH.item.name + ' (cut ' + km(pts, eTH.index, b) + ' after it).');
      else notes.push('Ends at ' + eTH.item.name + '.');
      b = eTH.index;
    }

    // 3. Private zones at either end.
    var pz = opts.privateZones || [];
    if (pz.length) {
      var a0 = a, b0 = b;
      while (a < b && inZone(pz, pts[a])) a++;
      while (b > a && inZone(pz, pts[b])) b--;
      if (a > a0 || b < b0) notes.push('Cut the stretch inside a private zone.');
      for (var i = a; i <= b; i++) if (inZone(pz, pts[i])) { notes.push('Passes through a private zone mid-way: that stretch is left off the map.'); break; }
    }

    // 4. Fallback trim for an end with no trailhead. A loop that starts and finishes at the same
    //    spot that isn't a trailhead is very likely home, so it gets a wider trim and a warning.
    var fb = opts.fallback == null ? 300 : opts.fallback;
    if (!sTH && !eTH && dist(pts[a], pts[b]) < 200 && !pz.length) {
      fb = Math.max(fb, 800);
      notes.push('Warning: starts and ends at the same spot, and it isn\'t a known trailhead. If that\'s home, add it as a private zone before publishing.');
    }
    if (!sTH && fb) { var a1 = walk(pts, a, b, fb, 1); if (a1 > a) { notes.push('No trailhead near the start: trimmed the first ' + fb + ' m.'); a = a1; } }
    if (!eTH && fb) { var b1 = walk(pts, b, a, fb, -1); if (b1 < b) { notes.push('No trailhead near the end: trimmed the last ' + fb + ' m.'); b = b1; } }

    return {
      points: pts.slice(a, b + 1), from: a, to: b, notes: notes, activity: act,
      startTrailhead: sTH ? sTH.item.id : null, endTrailhead: eTH ? eTH.item.id : null
    };
  }
  function inZone(z, p) { for (var i = 0; i < z.length; i++) if (dist(z[i], p) <= (z[i].radius || 400)) return true; return false; }
  function walk(pts, i, stop, m, dir) {
    var d = 0;
    while (i !== stop && d < m) { d += dist(pts[i], pts[i + dir]); i += dir; }
    return i;
  }
  // The trailhead nearest the start (or end) within range, and the index where the track is
  // closest to it: searched over the first (or last) 40% of the kept track.
  function nearestOnSpan(th, pts, a, b, range, fromStart) {
    if (!th.length) return null;
    var n = b - a, lim = Math.max(1, Math.floor(n * 0.4)), best = null;
    th.forEach(function (t) {
      var r = t.radius || 150, bi = -1, bd = Infinity;
      for (var k = 0; k <= lim; k++) {
        var i = fromStart ? a + k : b - k, d = dist(t, pts[i]);
        if (d < bd) { bd = d; bi = i; }
        if (d <= r) { bd = d; bi = i; break; }   // first entry into the trailhead circle
      }
      var endD = dist(t, pts[fromStart ? a : b]);
      if (bd <= r && endD <= range && (!best || endD < best.endD)) best = { item: t, index: bi, endD: endD };
    });
    return best;
  }

  // ── Stats, profile, simplify ─────────────────────────────────────────
  function stats(pts, kind) {
    var k = KINDS[kind] || KINDS.ride, d = 0, moving = 0, gain = 0, loss = 0, maxV = 0;
    var lo = Infinity, hi = -Infinity, ref = null, sp = rolling(pts, 20);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p.ele != null) {
        lo = Math.min(lo, p.ele); hi = Math.max(hi, p.ele);
        // 3 m hysteresis keeps GPS elevation jitter out of the climb total.
        if (ref == null) ref = p.ele;
        else if (p.ele - ref >= 3) { gain += p.ele - ref; ref = p.ele; }
        else if (ref - p.ele >= 3) { loss += ref - p.ele; ref = p.ele; }
      }
      if (i) {
        var seg = dist(pts[i - 1], p); d += seg;
        if (p.t != null && pts[i - 1].t != null) {
          var dt = (p.t - pts[i - 1].t) / 1000;
          if (dt > 0 && dt < 120 && seg / dt * 3.6 >= k.move) moving += dt;
        }
        maxV = Math.max(maxV, sp[i].v);
      }
    }
    var elapsed = pts.length > 1 && pts[0].t != null ? (pts[pts.length - 1].t - pts[0].t) / 1000 : 0;
    return {
      distanceKm: +(d / 1000).toFixed(2), movingSec: Math.round(moving), elapsedSec: Math.round(elapsed),
      gainM: Math.round(gain), lossM: Math.round(loss),
      minEleM: isFinite(lo) ? Math.round(lo) : null, maxEleM: isFinite(hi) ? Math.round(hi) : null,
      avgKmh: moving ? +(d / moving * 3.6).toFixed(1) : 0, maxKmh: +maxV.toFixed(1),
      start: pts[0] && pts[0].t ? new Date(pts[0].t).toISOString() : null
    };
  }

  // [distanceKm, elevationM] pairs, evenly spaced by distance, `n` samples.
  function profile(pts, n) {
    n = n || 240;
    var c = cumDist(pts), total = c[c.length - 1] || 1, out = [], j = 0;
    for (var s = 0; s < n; s++) {
      var at = total * s / (n - 1);
      while (j < c.length - 2 && c[j + 1] < at) j++;
      var f = c[j + 1] > c[j] ? (at - c[j]) / (c[j + 1] - c[j]) : 0, e0 = pts[j].ele, e1 = pts[j + 1] ? pts[j + 1].ele : e0;
      out.push([+(at / 1000).toFixed(3), e0 == null ? null : Math.round(e0 + (e1 - e0) * f)]);
    }
    return out;
  }

  // Douglas-Peucker on a local flat projection; `tol` in metres.
  function simplify(pts, tol) {
    tol = tol || 6;
    if (pts.length < 3) return pts.slice();
    var lat0 = rad(pts[0].lat), xy = pts.map(function (p) { return [rad(p.lon) * Math.cos(lat0) * R, rad(p.lat) * R]; });
    var keep = new Uint8Array(pts.length), stack = [[0, pts.length - 1]];
    keep[0] = keep[pts.length - 1] = 1;
    while (stack.length) {
      var s = stack.pop(), i0 = s[0], i1 = s[1], md = 0, mi = -1;
      for (var i = i0 + 1; i < i1; i++) {
        var d = segDist(xy[i], xy[i0], xy[i1]);
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol) { keep[mi] = 1; stack.push([i0, mi], [mi, i1]); }
    }
    return pts.filter(function (_, i) { return keep[i]; });
  }
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }

  // Everything an event's "track" field holds: trimmed, simplified, rounded, with times made
  // relative (seconds from the start) so the published file carries the date but not a timeline.
  function build(gpxText, opts) {
    var g = parse(gpxText), kind = (opts && opts.kind) || g.kind || 'ride';
    opts = Object.assign({}, opts, { kind: kind });
    var tr = trim(g.points, opts), pts = tr.points;
    // Stats count the whole activity (riding from home to the trailhead is still riding); the line
    // and the elevation profile show only the published part.
    var st = tr.activity ? stats(g.points.slice(tr.activity[0], tr.activity[1] + 1), kind) : stats(pts, kind);
    var shownKm = +(stats(pts, kind).distanceKm).toFixed(2);
    var t0 = pts[0] && pts[0].t, pz = (opts && opts.privateZones) || [];
    // Points inside a private zone mid-way become a break in the line (null), so the map never
    // draws a path through one; the simplifier runs on each visible stretch separately.
    var runs = [], cur = [];
    pts.forEach(function (p) { if (pz.length && inZone(pz, p)) { if (cur.length) runs.push(cur); cur = []; } else cur.push(p); });
    if (cur.length) runs.push(cur);
    var line = [];
    runs.forEach(function (r, k) {
      if (k) line.push(null);
      simplify(r, (opts && opts.tolerance) || 6).forEach(function (p) {
        line.push([+p.lat.toFixed(5), +p.lon.toFixed(5), p.ele == null ? null : Math.round(p.ele), p.t != null && t0 != null ? Math.round((p.t - t0) / 1000) : null]);
      });
    });
    return {
      name: g.name, kind: kind, stats: st, line: line, profile: profile(pts),
      trim: { notes: tr.notes, rawPoints: g.points.length, shownKm: shownKm, keptFrom: tr.from, keptTo: tr.to, startTrailhead: tr.startTrailhead, endTrailhead: tr.endTrailhead },
      raw: g.points, kept: [tr.from, tr.to], activity: tr.activity || [tr.from, tr.to]
    };
  }

  function km(pts, i, j) {
    var d = 0; for (var k = i + 1; k <= j; k++) d += dist(pts[k - 1], pts[k]);
    return d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m';
  }
  function clock(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  return { parse: parse, parseCSV: parseCSV, parseGPX: parseGPX, trim: trim, stats: stats, profile: profile, simplify: simplify, build: build, dist: dist, KINDS: KINDS, drivingRuns: drivingRuns };
});
