// ============================================================
// creatures.js -- small animal rigs for the scene engine.
//
// Art comes from creature-shapes.js (window.CREATURE_SHAPES): each animal was
// cut out of animal-sprite-master.svg (plus chipmunk.svg / fisherman-boat.svg)
// into its own tight viewBox. The art is a flat silhouette, often ONE path,
// so there are no separate head/tail/wing pieces to move. Instead, each moving
// "part" is the same art drawn a second time, clipped to a polygon around the
// part, and rotated about a pivot. The body copy is clipped to exclude that
// polygon. The part's clip reaches `ov` units past the seam into the body so small
// rotations never open a visible gap, and because it's all one fill color the
// overlap is invisible.
//
// Usage:
//   const c = Creatures.build('doe', { season: 'summer', night: false });
//   someParent.appendChild(c.svg);   // <svg> in the animal's own units
//   c.setSeason('fall'); c.setNight(true); c.setBehavior('idle'); c.destroy();
//   opts.rate speeds the motion up/down; rig.palette overrides colours per season.
//
// One shared requestAnimationFrame loop drives every live creature and
// sleeps when the tab is hidden or when no creature is on screen.
// ============================================================
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  const SHAPES = () => window.CREATURE_SHAPES || {};

  // ── palette: silhouette (d) + accent (l) per season, plus night ──────
  // Muted, slightly season-tinted darks rather than pure black, so they sit
  // in the painted scene instead of reading as cut-out holes.
  const PALETTE = {
    spring: { d: '#27352a', l: '#e9efe1' },
    summer: { d: '#1d2a22', l: '#f2f0e6' },
    fall:   { d: '#2d2319', l: '#efe1cc' },
    winter: { d: '#343a40', l: '#f3f6f8' },
    night:  { d: '#0b100e', l: '#8e98a4' },
  };

  // ── motion helpers ───────────────────────────────────────────────────
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const osc = (t, hz, ph = 0) => Math.sin(TAU * hz * t + ph);
  // A repeating "event": 0 at rest, eases to 1 over `rise`, holds, eases back
  // over `fall`. `at` = seconds into the period the event starts.
  function pulse(t, period, at, rise, hold, fall) {
    const u = (((t - at) % period) + period) % period;
    if (u < rise) return ease(u / rise);
    if (u < rise + hold) return 1;
    if (u < rise + hold + fall) return 1 - ease((u - rise - hold) / fall);
    return 0;
  }
  // Snap between held poses (birds, chipmunks): list of [seconds, value];
  // each change takes `snap` seconds, so the motion is quick then still.
  function poses(t, list, snap) {
    const total = list.reduce((a, p) => a + p[0], 0);
    let u = ((t % total) + total) % total, prev = list[list.length - 1][1];
    for (const [dur, v] of list) {
      if (u < dur) return prev + (v - prev) * ease(u / snap);
      u -= dur; prev = v;
    }
    return prev;
  }

  // ── rigs ─────────────────────────────────────────────────────────────
  // parts: seam = polyline through the art where the part is cut from the
  // body; hull = the rest of the part polygon (from seam end back to seam
  // start, in open space). pivot = rotation point. ov = overlap in art units.
  // behaviors: name -> (t, seed) => { root:{x,y,r,sy}, parts:{name:deg}, eyes }
  //   root transforms are about the anchor (bottom-centre of the art).
  // travel: host-side horizontal speed in body-widths per second (optional).
  // zones: the Engine Intake zone tags this animal belongs in.
  const RIGS = {
    bear: {
      label: 'Black bear', zones: ['shoreline', 'grass'], seasons: ['spring', 'summer', 'fall'],
      travel: { walk: 0.09 },
      parts: [{ name: 'head', seam: [[1790, 1680], [1790, 1990]], hull: [[2030, 1935], [2030, 1670]], pivot: [1790, 1850], ov: 18 }],
      behaviors: {
        walk: (t) => ({ root: { y: -4 * Math.abs(osc(t, 0.45)), r: 0.7 * osc(t, 0.9) }, parts: { head: 1.5 * osc(t, 0.9, 1) - 0.5 } }),
        forage: (t) => ({ root: { sy: 1 + 0.008 * osc(t, 0.28) }, parts: { head: 3.5 * pulse(t, 8, 1, 1.2, 2.2, 1.2) + 0.8 * osc(t, 0.7) * pulse(t, 8, 1, 1.2, 2.2, 1.2) } }),
      },
    },
    deer: {
      label: 'Mule deer buck', zones: ['shoreline', 'grass', 'treeline'], seasons: 'all',
      parts: [{ name: 'head', seam: [[1588, 390], [1792, 482]], hull: [[1900, 482], [1900, 30], [1560, 30], [1560, 375]], pivot: [1705, 432], ov: 16 }],
      behaviors: {
        idle: (t) => ({ root: { sy: 1 + 0.006 * osc(t, 0.25) }, parts: { head: 1.2 * osc(t, 0.13) } }),
        alert: (t) => ({ root: { sy: 1 + 0.006 * osc(t, 0.3) }, parts: { head: -3.5 * pulse(t, 7, 0.5, 0.5, 2.4, 0.9) + 2 * pulse(t, 7, 4.5, 0.6, 1.2, 0.7) } }),
      },
    },
    elk: {
      label: 'Elk bull', zones: ['grass', 'treeline'], seasons: 'all',
      parts: [{ name: 'head', seam: [[575, 468], [800, 572]], hull: [[930, 572], [930, -20], [350, -20], [350, 300], [560, 440]], pivot: [690, 505], ov: 16 }],
      behaviors: {
        idle: (t) => ({ root: { sy: 1 + 0.005 * osc(t, 0.2) }, parts: { head: 1 * osc(t, 0.1) } }),
        alert: (t) => ({ root: { sy: 1 + 0.005 * osc(t, 0.22) }, parts: { head: -3 * pulse(t, 9, 0.5, 0.8, 3, 1.2) + 2 * pulse(t, 9, 6, 0.8, 1.2, 0.8) } }),
      },
    },
    doe: {
      label: 'Doe, grazing', zones: ['shoreline', 'grass'], seasons: 'all',
      parts: [{ name: 'head', seam: [[2775, 245], [2795, 392], [2842, 440], [2885, 560]], hull: [[2885, 725], [3030, 725], [3030, 240]], pivot: [2800, 330], ov: 34 }],
      behaviors: {
        graze: (t) => {
          const lift = pulse(t, 9, 5, 0.7, 1.6, 0.9);
          return { root: { sy: 1 + 0.006 * osc(t, 0.3) }, parts: { head: 1 * osc(t, 1.4) * (1 - lift) - 3.5 * lift } };
        },
        idle: (t) => ({ root: { sy: 1 + 0.006 * osc(t, 0.25) }, parts: { head: 0.8 * osc(t, 0.2) } }),
      },
    },
    eagle: {
      label: 'Eagle, soaring', zones: ['sky'], seasons: 'all', airborne: true,
      travel: { soar: 0.12, flap: 0.16 },
      parts: [
        { name: 'wingL', seam: [[2585, 1075], [2545, 1285]], hull: [[2330, 1300], [2170, 1180], [2170, 860], [2460, 860]], pivot: [2570, 1175], ov: 14 },
        { name: 'wingR', seam: [[2765, 1195], [2735, 1385]], hull: [[2800, 1470], [3170, 1490], [3170, 1195]], pivot: [2760, 1290], ov: 14 },
      ],
      behaviors: {
        soar: (t) => {
          const burst = pulse(t, 8, 2, 0.3, 1.2, 0.3), f = 6 * burst * osc(t, 2.2);
          return { root: { y: 10 * osc(t, 0.3, 1), r: 3 * osc(t, 0.23) }, parts: { wingL: f + osc(t, 0.3), wingR: -f - osc(t, 0.3) } };
        },
        flap: (t) => { const f = 6 * osc(t, 1.8); return { root: { y: -6 * osc(t, 1.8, 0.8), r: 1.5 * osc(t, 0.25) }, parts: { wingL: f, wingR: -f } }; },
      },
    },
    hawk: {
      label: 'Hawk, perched', zones: ['tree', 'boulder'], seasons: 'all',
      parts: [{ name: 'head', seam: [[3740, 990], [3900, 1072]], hull: [[3995, 1072], [3995, 870], [3740, 870]], pivot: [3820, 1030], ov: 12 }],
      behaviors: {
        perch: (t) => ({ root: { sy: 1 + 0.007 * osc(t, 0.35) }, parts: { head: poses(t, [[1.8, 0], [1.2, -3], [2.1, 2], [0.9, -2], [1.6, 3], [1.4, 0]], 0.18) } }),
      },
    },
    owl: {
      label: 'Great horned owl', zones: ['tree'], seasons: 'all', nightOnly: true,
      // Winter: a snowy owl (white, dark eyes), which is also out by day.
      palette: { winter: { d: '#eef1f3', l: '#3f4850' }, 'winter-night': { d: '#b3bdc9', l: '#343c44' } },
      eyes: [1, 2], // indices in the shape's path list (the two white eye arcs)
      parts: [{ name: 'head', seam: [[335, 1812], [650, 1812]], hull: [[650, 1600], [335, 1600]], pivot: [490, 1805], ov: 12 }],
      behaviors: {
        perch: (t) => {
          const blink = 1 - pulse(t, 5.3, 2, 0.07, 0.05, 0.09);
          return { root: { sy: 1 + 0.008 * osc(t, 0.25) }, parts: { head: 3 * pulse(t, 11, 1, 0.9, 3, 0.9) - 2.5 * pulse(t, 11, 6.5, 0.9, 2.2, 0.9) }, eyes: blink };
        },
      },
    },
    fox: {
      label: 'Red fox, sitting', zones: ['grass', 'boulder', 'shoreline'], seasons: 'all',
      parts: [
        { name: 'tail', seam: [[1320, 1335], [1450, 1395], [1560, 1418], [1650, 1442], [1700, 1487], [1760, 1497]], hull: [[1760, 1545], [1320, 1545]], pivot: [1400, 1370], ov: 8 },
        { name: 'head', seam: [[1445, 1112], [1800, 1135]], hull: [[1800, 860], [1445, 860]], pivot: [1620, 1120], ov: 12 },
      ],
      behaviors: {
        sit: (t) => ({
          root: { sy: 1 + 0.007 * osc(t, 0.3) },
          parts: { head: 3 * pulse(t, 8, 1, 0.5, 2, 0.6) - 2 * pulse(t, 8, 5, 0.5, 1.2, 0.5), tail: 0.8 * osc(t, 0.25) - 1.2 * pulse(t, 6, 3, 0.25, 0.1, 0.5) },
        }),
      },
    },
    hare: {
      label: 'Hare, running', zones: ['grass'], seasons: 'all',
      // Snowshoe hare: white coat in winter.
      palette: { winter: { d: '#eef2f5', l: '#aeb8c2' }, 'winter-night': { d: '#a9b3c0', l: '#6b7582' } },
      travel: { hop: 0.55 },
      parts: [{ name: 'ears', seam: [[2690, 1860], [2850, 1885]], hull: [[2870, 1660], [2690, 1660]], pivot: [2800, 1885], ov: 10 }],
      behaviors: {
        hop: (t) => {
          const p = (t * 0.9) % 1, air = p < 0.55, q = p / 0.55;
          return {
            root: air ? { y: -70 * Math.sin(Math.PI * q), r: -6 * Math.cos(Math.PI * q) } : { sy: 1 - 0.035 * Math.sin(Math.PI * (p - 0.55) / 0.45) },
            parts: { ears: 2 * Math.sin(TAU * p - 1) },
          };
        },
      },
    },
    squirrel: {
      label: 'Squirrel with acorn', zones: ['tree', 'boulder'], seasons: ['spring', 'summer', 'fall'],
      parts: [
        { name: 'tail', seam: [[3770, 1690], [3776, 1860], [3830, 1905], [3868, 1990], [3880, 2100]], hull: [[4070, 2100], [4070, 1630], [3770, 1630]], pivot: [3900, 2085], ov: 10 },
        { name: 'head', seam: [[3712, 1790], [3712, 1870], [3695, 2000], [3605, 2020], [3595, 2066]], hull: [[3500, 2046], [3478, 1990], [3470, 1720], [3712, 1720]], pivot: [3665, 1985], ov: 10 },
      ],
      behaviors: {
        nibble: (t) => {
          const chew = pulse(t, 2.6, 0.4, 0.1, 0.9, 0.15);
          return { root: { sy: 1 + 0.008 * osc(t, 0.5) }, parts: { head: 1.5 * chew * osc(t, 6), tail: 0.5 * osc(t, 0.3) + 0.9 * pulse(t, 5, 3.5, 0.12, 0.05, 0.35) } };
        },
      },
    },
    'wolf-howl': {
      label: 'Wolf, howling', zones: ['foothill', 'boulder'], seasons: ['winter', 'fall'], nightOnly: true,
      parts: [{ name: 'head', seam: [[3760, 300], [4000, 420]], hull: [[4090, 420], [4090, 40], [3700, 40], [3700, 280]], pivot: [3880, 350], ov: 16 }],
      behaviors: {
        howl: (t) => {
          const up = pulse(t, 10, 2.5, 1.2, 4.2, 1.6);
          return { root: { sy: 1 + 0.01 * up + 0.005 * osc(t, 0.3) }, parts: { head: 4 * (1 - up) + 0.4 * up * osc(t, 5) } };
        },
      },
    },
    'wolf-run': {
      label: 'Wolf, running', zones: ['grass', 'shoreline'], seasons: 'all',
      travel: { run: 0.7 },
      parts: [{ name: 'tail', seam: [[250, 1140], [230, 1255]], hull: [[-20, 1255], [-20, 1140]], pivot: [240, 1197], ov: 10 }],
      behaviors: {
        run: (t) => ({ root: { y: -9 * Math.abs(osc(t, 0.8)), r: 2.2 * osc(t, 1.6) }, parts: { tail: 3 * osc(t, 1.6, -1.2) } }),
      },
    },
    chipmunk: {
      label: 'Chipmunk', zones: ['boulder', 'grass'], seasons: ['spring', 'summer', 'fall'],
      parts: [
        { name: 'tail', seam: [[1300, 2620], [1200, 1600], [1420, 1000], [1420, 330]], hull: [[250, 330], [250, 2620]], pivot: [1150, 2450], ov: 10 },
        { name: 'head', seam: [[1600, 1150], [2330, 1000]], hull: [[2720, 1000], [2720, 330], [1500, 330]], pivot: [1950, 1080], ov: 20 },
      ],
      behaviors: {
        alert: (t) => ({
          root: { sy: 1 + 0.01 * osc(t, 0.9) },
          parts: { head: poses(t, [[1.1, 0], [0.8, -2.5], [1.4, 2], [0.6, -1.5], [1.3, 3], [0.9, 0.5]], 0.09), tail: 1.2 * pulse(t, 2.7, 1.2, 0.08, 0.04, 0.25) },
        }),
      },
    },
    fisherman: {
      label: 'Fisherman in a boat', zones: ['water-surface'], seasons: ['spring', 'summer', 'fall'], onWater: true,
      travel: { fish: 0.02 },
      parts: [{ name: 'rod', seam: [[1440, 1700], [1440, 1560], [1395, 1480], [1395, 640]], hull: [[2300, 640], [2300, 1420], [1525, 1470], [1510, 1700]], pivot: [1465, 1640], ov: 10 }],
      behaviors: {
        fish: (t) => ({ root: { y: 7 * osc(t, 0.23, 1), r: 1.3 * osc(t, 0.23) }, parts: { rod: 0.7 * osc(t, 0.6) - 2.5 * pulse(t, 7, 3, 0.25, 0.3, 0.8) } }),
      },
    },
  };

  // ── geometry helpers ─────────────────────────────────────────────────
  const pts = (list) => list.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  function partPolygon(part) {
    // The part's clip polygon grown `ov` units outward (every vertex pushed
    // away from the centroid). The body is clipped with the ungrown polygon,
    // so along the seam the part also draws a thin band of body: every pixel
    // stays covered by at least one copy while the part rotates.
    const all = part.seam.concat(part.hull);
    const cx = all.reduce((a, p) => a + p[0], 0) / all.length;
    const cy = all.reduce((a, p) => a + p[1], 0) / all.length;
    return all.map(([x, y]) => {
      const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1;
      return [x + (dx / L) * part.ov, y + (dy / L) * part.ov];
    });
  }

  let uid = 0;
  const live = new Set();

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function build(id, opts = {}) {
    if (!opts.silhouette && ORIGAMI[id] && window.ORIGAMI_ART && window.ORIGAMI_ART[ORIGAMI[id].art || id]) return buildOrigami(id, opts);
    const shape = SHAPES()[id], rig = RIGS[id];
    if (!shape || !rig) throw new Error('Unknown creature: ' + id);
    const [vx, vy, vw, vh] = shape.vb;
    const ax = vx + vw / 2, ay = vy + vh; // anchor: bottom-centre
    const key = 'cr' + (++uid);

    const svg = el('svg', { viewBox: shape.vb.join(' '), class: 'creature creature-' + id, overflow: 'visible', 'aria-hidden': 'true' });
    svg.style.overflow = 'visible';
    const defs = el('defs', null, svg);
    // Body clip: everything except each part's (slightly smaller) cut polygon.
    const big = 'M' + (vx - vw) + ',' + (vy - vh) + 'h' + vw * 3 + 'v' + vh * 3 + 'h' + -vw * 3 + 'Z';
    const bodyClip = el('clipPath', { id: key + '-body' }, defs);
    el('path', { d: big + rig.parts.map((p) => 'M' + pts(p.seam.concat(p.hull)).replace(/ /g, 'L') + 'Z').join(''), 'clip-rule': 'evenodd' }, bodyClip);

    const root = el('g', { class: 'cr-root' }, svg);
    rig.parts.forEach((part) => {
      const cp = el('clipPath', { id: key + '-' + part.name }, defs);
      el('polygon', { points: pts(partPolygon(part)) }, cp);
    });
    // Paint in RUNS of same-colour paths, and for each run draw the body copy
    // then every part copy before moving to the next run. Drawing whole copies
    // one after another would let a part's dark base (with its anti-aliased
    // clip edge) land on top of the body's light accents, leaving a faint
    // dark hairline wherever a seam crosses a light patch (fox ruff, chipmunk
    // stripes). Run-by-run keeps the original paint order for every pixel.
    const runs = [];
    shape.p.forEach((entry, i) => {
      const k = entry[0][0];
      if (!runs.length || runs[runs.length - 1].k !== k) runs.push({ k, items: [] });
      runs[runs.length - 1].items.push([entry, i]);
    });
    const eyes = [];
    const partEls = {};
    rig.parts.forEach((part) => { partEls[part.name] = { gs: [], pivot: part.pivot }; });
    const drawRun = (run, parent) => run.items.forEach(([[kind, d], i]) => {
      const p = el('path', { d, class: kind === 'd' || kind === 'de' ? 'cr-d' : 'cr-l' }, parent);
      if (kind.endsWith('e')) p.setAttribute('fill-rule', 'evenodd');
      if (rig.eyes && rig.eyes.includes(i)) eyes.push(p);
    });
    runs.forEach((run) => {
      drawRun(run, el('g', { 'clip-path': 'url(#' + key + '-body)' }, root));
      rig.parts.forEach((part) => {
        const g = el('g', { class: 'cr-part', 'data-part': part.name }, root);
        drawRun(run, el('g', { 'clip-path': 'url(#' + key + '-' + part.name + ')' }, g));
        partEls[part.name].gs.push(g);
      });
    });
    // Eye blink scales each eye about its own centre (computed once).
    const eyeBoxes = eyes.map(() => null);

    const inst = {
      id, rig, svg, anchor: [ax, ay], viewBox: shape.vb,
      behavior: opts.behavior || Object.keys(rig.behaviors)[0],
      t0: performance.now() / 1000 - (opts.phase != null ? opts.phase : Math.random() * 20),
      visible: true,
      season: opts.season || 'summer', night: !!opts.night,
      rate: opts.rate || 1,   // playback speed (e.g. a hare running faster than its catalog loop)
    };

    function applyPalette() {
      // A rig can override colours per season (and per season at night), e.g. white winter coats.
      // opts.paint(season, night) lets a host (the scene) colour the animal naturally; it
      // returns null to fall back to the rig's own palette.
      const ov = rig.palette || {};
      const pal = (opts.paint && opts.paint(inst.season, inst.night)) ||
        (inst.night ? (ov[inst.season + '-night'] || PALETTE.night)
        : (ov[inst.season] || PALETTE[inst.season] || PALETTE.summer));
      svg.style.setProperty('--cr-d', pal.d);
      svg.style.setProperty('--cr-l', pal.l);
    }
    applyPalette();

    inst.frame = function (now) {
      const t = (now - inst.t0) * inst.rate;
      const m = rig.behaviors[inst.behavior](t) || {};
      const r = m.root || {};
      root.setAttribute('transform',
        'translate(' + (r.x || 0).toFixed(2) + ' ' + (r.y || 0).toFixed(2) + ') ' +
        'rotate(' + (r.r || 0).toFixed(3) + ' ' + ax + ' ' + ay + ') ' +
        (r.sy ? 'translate(' + ax + ' ' + ay + ') scale(1 ' + r.sy.toFixed(4) + ') translate(' + -ax + ' ' + -ay + ')' : ''));
      const parts = m.parts || {};
      for (const name in partEls) {
        const a = parts[name] || 0, pe = partEls[name];
        const tf = 'rotate(' + a.toFixed(3) + ' ' + pe.pivot[0] + ' ' + pe.pivot[1] + ')';
        for (let k = 0; k < pe.gs.length; k++) pe.gs[k].setAttribute('transform', tf);
      }
      if (eyes.length) {
        const open = m.eyes == null ? 1 : Math.max(0.08, m.eyes);
        eyes.forEach((e, i) => {
          if (!eyeBoxes[i]) { try { const b = e.getBBox(); eyeBoxes[i] = [b.x + b.width / 2, b.y + b.height / 2]; } catch (_) { return; } }
          const [cx, cy] = eyeBoxes[i];
          e.setAttribute('transform', open >= 0.999 ? '' : 'translate(' + cx + ' ' + cy + ') scale(1 ' + open.toFixed(3) + ') translate(' + -cx + ' ' + -cy + ')');
        });
      }
    };

    inst.api = {
      svg, rig, anchor: [ax, ay], viewBox: shape.vb.slice(),
      behaviors: Object.keys(rig.behaviors),
      get behavior() { return inst.behavior; },
      travelSpeed() { return ((rig.travel && rig.travel[inst.behavior]) || 0) * inst.rate; },
      setSeason(s) { inst.season = s; applyPalette(); },
      setNight(n) { inst.night = !!n; applyPalette(); },
      setBehavior(b) { if (rig.behaviors[b]) inst.behavior = b; },
      seek(t) { inst.t0 = performance.now() / 1000 - t; inst.frame(performance.now() / 1000); },
      destroy() { live.delete(inst); unwatch(inst); svg.remove(); },
    };

    live.add(inst);
    inst.frame(performance.now() / 1000);
    ensureLoop();
    return inst.api;
  }

  // ── shared loop: one rAF for all creatures, skips off-screen ones ─────
  // Visibility: each creature watches its nearest HTML ancestor, not its own <svg>. Safari reports
  // an <svg> nested inside another <svg> (every catalog card) as never intersecting, which froze
  // the catalog animals mid-pose in Safari. Attached lazily, once the svg is in the page.
  const byEl = new Map();
  const htmlHost = (el) => { let e = el.parentNode; while (e && e.namespaceURI === NS) e = e.parentNode; return e && e.nodeType === 1 ? e : null; };
  function watch(inst) {
    if (!io || inst.host || !inst.svg.isConnected) return;
    const h = htmlHost(inst.svg); if (!h) return;
    inst.host = h;
    let set = byEl.get(h); if (!set) { set = new Set(); byEl.set(h, set); io.observe(h); }
    set.add(inst);
  }
  function unwatch(inst) {
    const h = inst.host; if (!h) return;
    const set = byEl.get(h); if (set) { set.delete(inst); if (!set.size) { byEl.delete(h); io.unobserve(h); } }
    inst.host = null;
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((en) => { const set = byEl.get(en.target); if (set) set.forEach((i) => { i.visible = en.isIntersecting; }); });
    ensureLoop();
  }) : null;

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  function tick(ms) {
    raf = 0;
    const now = ms / 1000;
    let any = false;
    live.forEach((i) => { if (!i.host) watch(i); if (i.visible && i.svg.isConnected) { i.frame(now); any = true; } });
    if (any && !document.hidden && !reduced) raf = requestAnimationFrame(tick);
  }
  function ensureLoop() { if (!raf && !reduced) raf = requestAnimationFrame(tick); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ensureLoop(); });

  // Fill comes from the per-instance custom properties; the transition gives
  // the same 0.7s season crossfade the rest of the scene uses.
  if (!document.getElementById('creature-style')) {
    const st = document.createElement('style');
    st.id = 'creature-style';
    st.textContent = '.creature .cr-d{fill:var(--cr-d,#1f1f1d);transition:fill .7s ease}.creature .cr-l{fill:var(--cr-l,#fff);transition:fill .7s ease}';
    document.head.appendChild(st);
  }

  // ── natural coats ──
  // Real colours per species (d = body, l = the art's light markings), used by the scene and the
  // catalog instead of the plain silhouette palette. Rig palettes still win where they exist
  // (white winter hare, snowy owl). graded = the host already darkens for night (the scene's
  // foreground plate), so no extra night shading is applied here.
  // The bear is a cinnamon-phase black bear: a near-black coat vanished against the far treeline.
  const COAT = {
    deer: ['#8a6446', '#eadfcd'], doe: ['#9b7352', '#eadfcd'], elk: ['#6e4a2e', '#e3cfae'],
    bear: ['#7a5234', '#c9a57e'], 'wolf-howl': ['#6c7076', '#d9dde0'], 'wolf-run': ['#727880', '#dfe2e4'],
    hare: ['#8d6c4c', '#efe6d8'], fox: ['#c8662c', '#f6efe4'], chipmunk: ['#8e5d35', '#f3e6cf'],
    squirrel: ['#8f5433', '#ecd9c1'], hawk: ['#5e412b', '#f0e5d3'], owl: ['#6c5a47', '#f1dc98'],
    eagle: ['#3d2c21', '#f3f0e8'], fisherman: ['#2c343b', '#e8ecef'],
  };
  const WINTER_COAT = { deer: ['#7a6552', '#eadfcd'], elk: ['#6a5340', '#e3cfae'], fox: ['#c25f2c', '#f6efe4'] };
  const shade = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.substr(i, 2), 16) * k).toString(16).padStart(2, '0')).join('');
  function naturalPaint(id, graded) {
    const fn = (s, n) => {
      const rig = RIGS[id];
      if (rig && rig.palette && rig.palette[n && !graded ? s + '-night' : s]) return null;
      const c = (s === 'winter' && WINTER_COAT[id]) || COAT[id];
      if (!c) return null;
      if (n && !graded) return { d: shade(c[0], 0.42), l: shade(c[1], 0.5) };
      return { d: c[0], l: c[1] };
    };
    fn.graded = !!graded;   // origami animals read this: they carry their own colours
    return fn;
  }


  // ── origami puppets ───────────────────────────────────────────────────
  // Flat papercraft animals traced from AI images (see puppet-refs/ on the Mac). Unlike the
  // silhouettes above, every part is PRE-CUT at build time (origami-art.js holds the pieces), so
  // the browser draws plain filled paths in nested groups and only turns groups: no clip paths,
  // no masks. Each piece carries a few px of overlap across its seam and a round cap around its
  // pivot, so turning a part never opens a gap.
  // ORIGAMI_ART[id] = { vb, fills:[hex], body:[[fill,d]..], parts:[{n,p:[x,y],z,L:[[fill,d]..],k:[..]}] }
  // z < 0 draws a part behind its parent (far legs, tail, neck, ears); z >= 0 in front.
  // Rigs below: behaviours (same names the scene already asks for), travel speeds, coats.
  // Coats: fills are the traced colours; `coats[season]` swaps some by index (winter greys, the
  // white winter hare). At night on ungraded stages every colour is darkened and cooled here.
  const O_TAU = Math.PI * 2;
  const sw = (t, hz, ph) => Math.sin(O_TAU * hz * t + (ph || 0));
  // A walk cycle for four legs: diagonal pairs swing together. amp in degrees.
  const legs4 = (t, hz, amp, names) => {
    const s = sw(t, hz);
    return { [names[0]]: amp * s, [names[1]]: -amp * s, [names[2]]: -amp * s * 0.9, [names[3]]: amp * s * 0.9 };
  };
  const DEER_LEGS = ['nearFront', 'farFront', 'nearHind', 'farHind'];
  // graze cycle (seconds): lower 1.8, crop 4.7, raise 1.7, look about 2.8
  function deerGraze(t) {
    const c = ((t % 11) + 11) % 11;
    const down = c < 1.8 ? ease(c / 1.8) : c < 6.5 ? 1 : c < 8.2 ? 1 - ease((c - 6.5) / 1.7) : 0;
    const chew = c > 1.8 && c < 6.5 ? 1 : 0;
    return {
      root: { sy: 1 + 0.004 * osc(t, 0.25) },
      parts: {
        neck: 116 * down + 2 * osc(t, 0.25), head: -48 * down + chew * 3 * osc(t, 5.5) + (c > 8.2 ? -4 * Math.sin((c - 8.2) * 1.6) : 0),
        earL: -12 * pulse(c, 11, 8.6, 0.15, 0.1, 0.2) + 5 * down, earR: 10 * pulse(c, 11, 9.4, 0.15, 0.1, 0.2) - 5 * down,
        tail: -24 * pulse(t, 3.7, 1.2, 0.2, 0.1, 0.3),
      },
    };
  }
  const deerIdle = (t) => ({ root: { sy: 1 + 0.005 * osc(t, 0.25) }, parts: { neck: 2 * osc(t, 0.1), head: 1.5 * osc(t, 0.13),
    earL: -14 * pulse(t, 5.2, 1, 0.12, 0.08, 0.2), earR: 12 * pulse(t, 6.7, 3.2, 0.12, 0.08, 0.2), tail: -20 * pulse(t, 4.1, 2, 0.2, 0.1, 0.3) } });
  const deerAlert = (t) => ({ root: { sy: 1 + 0.004 * osc(t, 0.3) }, parts: { neck: -9, head: -5 + 2 * pulse(t, 3.3, 1.5, 0.3, 0.6, 0.4),
    earL: 8 + 6 * pulse(t, 2.6, 0.4, 0.1, 0.1, 0.2), earR: -6 - 8 * pulse(t, 3.1, 1.8, 0.1, 0.1, 0.2), tail: -12 } });
  const deerWalk = (t) => ({ root: { y: -10 * Math.abs(sw(t, 1.05)) }, parts: Object.assign(legs4(t, 1.05, 15, DEER_LEGS),
    { neck: 3 * sw(t, 2.1), head: -2 * sw(t, 2.1), tail: 6 * sw(t, 1.05), earL: 3 * sw(t, 2.1), earR: -3 * sw(t, 2.1) }) });
  const DEER_WINTER = { '#bd8054': '#8f7b69', '#d49b6e': '#ab9784', '#ab7247': '#7f6c5c', '#916240': '#6e5d4f', '#dfc2a1': '#d3c8bb',
    '#b97e55': '#8f7b69', '#a76f4a': '#7f6c5c', '#ca9c78': '#ab9784', '#876045': '#6e5d4f', '#daba9b': '#d3c8bb' };

  const ORIGAMI = {
    doe: { behaviors: { graze: deerGraze, idle: deerIdle, alert: deerAlert, walk: deerWalk }, travel: { walk: 0.09 }, coats: { winter: DEER_WINTER } },
    // The buck shares the doe's body and cuts (same image, antlers added); scene id is 'deer'.
    elk: { behaviors: { idle: deerIdle, alert: deerAlert, graze: deerGraze, walk: deerWalk,
      look: (t) => ({ root: { sy: 1 + 0.006 * osc(t, 0.25) }, parts: {
        neck: poses(t, [[2.4, -4], [2, -8], [2.6, 2], [1.8, -6]], 0.8), head: poses(t, [[2.4, 0], [2, -5], [2.6, 4], [1.8, -2]], 0.8),
        earL: 8 + 10 * pulse(t, 3.1, 0.8, 0.12, 0.2, 0.2) } }) }, travel: { walk: 0.08 },
      coats: { winter: { '#b06535': '#8a6a52', '#96522a': '#735641', '#c47640': '#9b7a5f', '#d29661': '#b3977b' } } },
    // Fox: standing art. The scene still asks for 'sit' (the old silhouette sat), so 'sit' is its
    // standing idle: ear flicks, a look round, a slow tail sweep.
    fox: { behaviors: {
      sit: (t) => ({ root: { sy: 1 + 0.006 * osc(t, 0.3) }, parts: { neck: 2 * osc(t, 0.12), head: poses(t, [[2, 0], [1.4, -6], [2.2, 3], [1.2, 8], [1.6, 0]], 0.25),
        earL: -12 * pulse(t, 4.3, 1, 0.1, 0.08, 0.18), earR: 10 * pulse(t, 5.9, 2.6, 0.1, 0.08, 0.18), tail: 5 * osc(t, 0.2) - 6 * pulse(t, 6, 3, 0.5, 0.6, 0.8) } }),
      sniff: (t) => { const dn = pulse(t, 6, 0.5, 0.8, 2.6, 0.9); return { root: { sy: 1 + 0.005 * osc(t, 0.3) },
        parts: { neck: 38 * dn, head: -12 * dn + 2 * dn * osc(t, 3.2), tail: 4 * osc(t, 0.25) } }; },
      walk: (t) => ({ root: { y: -10 * Math.abs(sw(t, 1.3)) }, parts: Object.assign(legs4(t, 1.3, 16, DEER_LEGS),
        { neck: 3 * sw(t, 2.6), head: -3 * sw(t, 2.6), tail: 6 * sw(t, 1.3, 1) }) }),
    }, travel: { walk: 0.12 }, coats: { winter: { '#eb7338': '#d9692f', '#ef864e': '#e07a44' } } },
    // Howling wolf: the art IS the howl (head up, mouth open). The cycle lowers the head to look
    // out, then lifts it into the howl and holds it with a slight tremble.
    'wolf-howl': { behaviors: {
      howl: (t) => { const c = ((t % 10) + 10) % 10; const up = c < 2.5 ? 0 : c < 3.6 ? ease((c - 2.5) / 1.1) : c < 7.4 ? 1 : c < 8.6 ? 1 - ease((c - 7.4) / 1.2) : 0;
        return { root: { sy: 1 + 0.006 * osc(t, 0.3) + 0.01 * up }, parts: { neck: 30 * (1 - up) + 0.7 * up * osc(t, 7), ear: 8 * up - 10 * pulse(t, 5, 1, 0.1, 0.1, 0.2), tail: 3 * osc(t, 0.2) - 4 * up } }; },
    }, coats: {} },
    // Trotting wolf (scene id 'wolf-run'): diagonal pairs swing, the body rises on each stride.
    'wolf-run': { art: 'wolf-trot', behaviors: {
      run: (t) => ({ root: { y: -12 * Math.abs(sw(t, 1.6)), r: 0.8 * sw(t, 3.2) },
        parts: Object.assign(legs4(t, 1.6, 17, DEER_LEGS), { head: 3 * sw(t, 3.2, 0.6), tail: 5 * sw(t, 1.6, -1.2) }) }),
      walk: (t) => ({ root: { y: -7 * Math.abs(sw(t, 1)) }, parts: Object.assign(legs4(t, 1, 12, DEER_LEGS), { head: 2 * sw(t, 2), tail: 4 * sw(t, 1) }) }),
    }, travel: { run: 0.7, walk: 0.25 }, coats: {} },
    // Bear: heavy, slow. walk = a rolling amble; forage = head down, nosing about.
    bear: { behaviors: {
      walk: (t) => ({ root: { y: -5 * Math.abs(sw(t, 0.6)), r: 0.8 * sw(t, 0.6) },
        parts: Object.assign(legs4(t, 0.6, 6, DEER_LEGS), { head: 2.5 * sw(t, 1.2, 1) }) }),
      forage: (t) => { const dn = pulse(t, 8, 1, 1.2, 3.2, 1.2); return { root: { sy: 1 + 0.006 * osc(t, 0.28) },
        parts: { head: 20 * dn + 2 * dn * osc(t, 1.3) } }; },
      // Wary: slow looks about, a lift of the nose to test the air.
      look: (t) => ({ root: { sy: 1 + 0.008 * osc(t, 0.3) }, parts: {
        head: poses(t, [[2.2, 0], [1.8, -9], [2.4, 5], [1.6, -4], [2, 8]], 0.7) } }),
    }, travel: { walk: 0.09 }, coats: {} },
    // Hare: sits upright. hop = crouch, spring (front paws reach, ears stream back), land.
    hare: { behaviors: {
      hop: (t) => { const u = ((t % 0.85) + 0.85) % 0.85 / 0.85; const air = u > 0.22 && u < 0.78 ? Math.sin(Math.PI * (u - 0.22) / 0.56) : 0;
        const crouch = u < 0.22 ? Math.sin(Math.PI * u / 0.22) : 0;
        return { root: { y: -150 * air, r: -7 * air + 3 * crouch, sy: 1 - 0.05 * crouch }, parts: { nearFront: -28 * air, farFront: -22 * air, ears: -14 * air, head: -4 * air, tail: -12 * air } }; },
      sit: (t) => ({ root: { sy: 1 + 0.006 * osc(t, 0.4) }, parts: { head: 3 * pulse(t, 5, 1, 0.3, 1.4, 0.4) + 0.8 * osc(t, 6) * pulse(t, 5, 1, 0.3, 1.4, 0.4),
        ears: -8 * pulse(t, 3.7, 0.5, 0.12, 0.3, 0.25) + 5 * pulse(t, 6.1, 3, 0.2, 0.8, 0.4), tail: -10 * pulse(t, 4.3, 2, 0.1, 0.05, 0.2) } }),
    }, travel: { hop: 0.55 },
      // Snowshoe hare: white in winter (greys to near-white, the cream stays).
      coats: { winter: { '#ada59d': '#dfe3e7', '#978f87': '#c7cdd3', '#c4bdb4': '#eef1f4', '#a09890': '#d3d8dd', '#7b756e': '#aab3bc', '#6f6a63': '#8f99a4' } } },
    // Squirrel: nibble = paws up to the mouth, head bobbing, tail twitching.
    squirrel: { behaviors: {
      nibble: (t) => { const up = pulse(t, 4.2, 0.4, 0.35, 2.2, 0.4); return { root: { sy: 1 + 0.008 * osc(t, 0.5) },
        parts: { arm: -22 * up + 3 * up * osc(t, 5), head: 6 * up + 1.5 * up * osc(t, 5, 1) - 4 * pulse(t, 4.2, 3.2, 0.15, 0.5, 0.2), tail: 2.5 * osc(t, 0.4) - 3 * pulse(t, 3.1, 1.5, 0.08, 0.05, 0.25) } }; },
    }, coats: {} },
    // Chipmunk: alert = quick looks, paw tucks, tail flicks (held poses, snapping between them).
    chipmunk: { behaviors: {
      alert: (t) => ({ root: { sy: 1 + 0.01 * osc(t, 0.8) }, parts: {
        head: poses(t, [[0.9, 0], [0.6, -8], [1.1, 4], [0.5, -3], [0.8, 7], [0.7, 0]], 0.12),
        arm: poses(t, [[1.5, 0], [1, -18], [1.2, 0], [0.8, -10]], 0.15),
        tail: poses(t, [[0.7, 0], [0.3, -6], [0.9, 2], [0.4, -4]], 0.1) } }),
    }, coats: {} },
    // Perched birds: snappy head turns between held poses, a slow breath, a tail flick (hawk).
    hawk: { behaviors: {
      perch: (t) => ({ root: { sy: 1 + 0.007 * osc(t, 0.35) }, parts: {
        head: poses(t, [[1.8, 0], [1.2, -7], [2.1, 4], [0.9, -4], [1.6, 8], [1.4, 0]], 0.16), tail: -3 * pulse(t, 5.3, 2, 0.12, 0.2, 0.3) } }),
    }, coats: {} },
    owl: { behaviors: {
      perch: (t) => ({ root: { sy: 1 + 0.008 * osc(t, 0.25) }, parts: {
        head: poses(t, [[2.5, 0], [1.8, -9], [2.6, 6], [1.2, 10], [2, 0]], 0.35) } }),
    },
      // Snowy owl in winter: the browns go pale, the face disc stays warm.
      coats: { winter: { '#644e40': '#e9ecef', '#4d3b33': '#c9d0d7', '#7e6451': '#dde2e7', '#a28469': '#cfd5db' } } },
    // Eagle: the art is the top of the wingbeat. flap = a full downstroke and back; soar = wings
    // held a little below the top, rocking on the air. The scene tilts the whole bird for the dive.
    eagle: { behaviors: {
      soar: (t) => ({ root: { y: 10 * osc(t, 0.3, 1), r: 2.5 * osc(t, 0.23) }, parts: { wingNear: -18 + 3 * osc(t, 0.3), wingFar: 14 - 2 * osc(t, 0.3), tail: 3 * osc(t, 0.23) } }),
      flap: (t) => { const f = (1 - Math.cos(O_TAU * 1.4 * t)) / 2; return { root: { y: 18 * f - 8 }, parts: { wingNear: -58 * f, wingFar: 40 * f, tail: 4 * f } }; },
    }, travel: { soar: 0.12, flap: 0.16 }, coats: {} },
    // Fisherman in his paper boat. The line hangs from the rod tip (drawn here, not traced).
    fisherman: { behaviors: {
      fish: (t) => ({ root: { y: 9 * osc(t, 0.23, 1), r: 1.4 * osc(t, 0.23) }, parts: {
        arm: 1.2 * osc(t, 0.6) - 4 * pulse(t, 7, 3, 0.25, 0.3, 0.8), head: poses(t, [[3, 0], [2, -4], [2.5, 3], [2, 0]], 0.5) } }),
    }, travel: { fish: 0.02 }, line: { part: 'arm', from: [1660, 345], len: 1180 }, lamp: [10, 78],
      // Clothes: the traced art gave his shirt and trousers the same cream/peach as his face, so from
      // the shore he read as unclothed. `refill` moves the clothing pieces (by part and fill index)
      // onto fills of their own, `fills` adds those colours, and `coats` dresses him per season:
      // a green shirt in summer, blue in spring, a rust flannel in fall, a dark parka in winter.
      // Face, hands, hat, boots and boat keep their traced colours.
      refill: { body: { 2: { to: 8, y: [700, 900] }, 4: { to: 7, y: [780, 1300] }, 6: { to: 9, y: [800, 1300] }, 3: { to: 9, y: [1000, 1300] } }, arm: { 2: 8, 6: 9 }, head: { 2: 8 } },
      fills: ['#7d7058', '#5f8a55', '#574c3a'],            // 7 trousers, 8 shirt / sleeve, 9 fold shadow
      coats: {
        spring: { '#5f8a55': '#4f7fa6', '#7d7058': '#80735a' },
        fall: { '#5f8a55': '#a2502f', '#7d7058': '#5c574b', '#574c3a': '#3f3a31' },
        winter: { '#5f8a55': '#2e4a63', '#7d7058': '#3b3f48', '#574c3a': '#262a31', '#8f6f5a': '#5a3a2e' },
      } },
    // Marley (Rhodesian ridgeback x beagle), the dog from the tent. idle = tail wagging, looking
    // about; sniff = nose to the grass, tail going; walk = a happy trot with the tail up.
    marley: { behaviors: {
      idle: (t) => ({ root: { sy: 1 + 0.006 * osc(t, 0.4) }, parts: {
        tail: 12 * osc(t, 3.2), head: poses(t, [[2, 0], [1.4, -7], [1.8, 4], [1.2, -3]], 0.25) } }),
      sniff: (t) => { const dn = pulse(t, 5, 0.3, 0.6, 3, 0.7); return { root: { sy: 1 + 0.005 * osc(t, 0.4) },
        parts: { head: 30 * dn + 2.5 * dn * osc(t, 4.5), tail: 10 * osc(t, 2.2) } }; },
      walk: (t) => ({ root: { y: -9 * Math.abs(sw(t, 1.6)) }, parts: Object.assign(legs4(t, 1.6, 10, DEER_LEGS),
        { head: 3 * sw(t, 3.2), tail: 6 * sw(t, 3.2) }) }),
    }, travel: { walk: 0.3 }, collar: { part: 'head', from: [1300, 690], to: [1455, 842], w: 46, color: '#6dffc0', core: '#e8fff4' }, coats: {} },
    deer: { art: 'buck', behaviors: { idle: deerIdle, alert: deerAlert, graze: deerGraze, walk: deerWalk }, travel: { walk: 0.09 }, coats: { winter: DEER_WINTER } },
  };

  const shadeNight = (hex) => '#' + [[1, 0.36], [3, 0.4], [5, 0.5]].map(([i, k]) =>
    Math.round(parseInt(hex.substr(i, 2), 16) * k).toString(16).padStart(2, '0')).join('');

  function buildOrigami(id, opts) {
    const rig = ORIGAMI[id], A = window.ORIGAMI_ART[rig.art || id];
    const [vx, vy, vw, vh] = A.vb;
    const ax = vx + vw / 2, ay = vy + vh;
    const svg = el('svg', { viewBox: A.vb.join(' '), class: 'creature origami origami-' + id, overflow: 'visible', 'aria-hidden': 'true' });
    svg.style.overflow = 'visible';
    const root = el('g', { class: 'cr-root' }, svg);
    const partEls = {};
    // rig.refill = { partName|'body': { fromFill: toFill } } recolours some pieces onto the extra
    // fills in rig.fills (indexed after the traced ones); see the fisherman's clothes.
    const fills = A.fills.concat(rig.fills || []), refill = rig.refill || {};
    // A rule is a fill index, or { to, y: [min, max] } to move only the subpaths lying within that
    // band of the art (a traced colour can cover both a sleeve and the boat, say).
    const paint = (layers, parent, name) => layers.forEach(([f, d]) => {
      const r = refill[name] && refill[name][f];
      if (r == null) { el('path', { d, class: 'of' + f, 'fill-rule': 'evenodd' }, parent); return; }
      if (typeof r === 'number') { el('path', { d, class: 'of' + r, 'fill-rule': 'evenodd' }, parent); return; }
      const keep = [], move = [];
      d.split(/(?=M)/).forEach((sp) => {
        const ys = (sp.match(/-?[\d.]+/g) || []).map(Number).filter((_, i) => i % 2);
        (Math.min(...ys) >= r.y[0] && Math.max(...ys) <= r.y[1] ? move : keep).push(sp);
      });
      if (keep.length) el('path', { d: keep.join(''), class: 'of' + f, 'fill-rule': 'evenodd' }, parent);
      if (move.length) el('path', { d: move.join(''), class: 'of' + r.to, 'fill-rule': 'evenodd' }, parent);
    });
    function drawPart(node, parent) {
      const g = el('g', { 'data-part': node.n }, parent);
      partEls[node.n] = { g, x: node.p[0], y: node.p[1] };
      node.k.filter((k) => k.z < 0).forEach((k) => drawPart(k, g));
      paint(node.L, g, node.n);
      node.k.filter((k) => k.z >= 0).forEach((k) => drawPart(k, g));
    }
    A.parts.filter((p) => p.z < 0).forEach((p) => drawPart(p, root));
    paint(A.body, root, 'body');
    A.parts.filter((p) => p.z >= 0).forEach((p) => drawPart(p, root));
    // A hanging line (fisherman): drawn from a point on a part, always straight down to the water,
    // so it stays plumb while the rod moves. Updated each frame from the tip's current position.
    // Glow-in-the-dark collar (Marley): a band across the neck, drawn inside the head part so it
    // follows every head move. Two plain strokes (a soft halo and a bright core), no filters.
    // Shown only at night (applyPalette).
    let collar = null;
    if (rig.collar && partEls[rig.collar.part]) {
      const C = rig.collar, g = partEls[C.part].g;
      const d = 'M' + C.from.join(' ') + ' L' + C.to.join(' ');
      collar = el('g', { class: 'o-collar' }, g);
      el('path', { d, fill: 'none', stroke: C.color, 'stroke-width': C.w * 4.2, 'stroke-linecap': 'round', opacity: 0.3 }, collar);
      el('path', { d, fill: 'none', stroke: C.color, 'stroke-width': C.w * 1.8, 'stroke-linecap': 'round', opacity: 0.45 }, collar);
      el('path', { d, fill: 'none', stroke: C.core, 'stroke-width': C.w, 'stroke-linecap': 'round' }, collar);
    }
    let line = null;
    if (rig.line && partEls[rig.line.part]) {
      line = el('path', { class: 'o-line', fill: 'none', 'stroke-width': 5, 'stroke-linecap': 'round' }, root);
    }

    const behaviors = rig.behaviors;
    const inst = {
      id, svg, visible: true,
      behavior: opts.behavior && behaviors[opts.behavior] ? opts.behavior : Object.keys(behaviors)[0],
      t0: performance.now() / 1000 - (opts.phase != null ? opts.phase : Math.random() * 20),
      season: opts.season || 'summer', night: !!opts.night, rate: opts.rate || 1,
      graded: !!(opts.paint && opts.paint.graded),
    };
    function applyPalette() {
      const swap = (rig.coats && rig.coats[inst.season]) || {};
      fills.forEach((hex, i) => {
        let c = swap[hex] || hex;
        if (inst.night && !inst.graded) c = shadeNight(c);
        svg.style.setProperty('--o' + i, c);
      });
      if (collar) collar.style.display = inst.night ? '' : 'none';
      svg.style.setProperty('--oline', inst.night && !inst.graded ? 'rgba(200,210,220,.35)' : 'rgba(60,50,45,.55)');
    }
    applyPalette();
    inst.frame = function (now) {
      const t = (now - inst.t0) * inst.rate;
      const m = behaviors[inst.behavior](t) || {};
      const r = m.root || {};
      root.setAttribute('transform',
        'translate(' + (r.x || 0).toFixed(1) + ' ' + (r.y || 0).toFixed(1) + ') ' +
        'rotate(' + (r.r || 0).toFixed(2) + ' ' + ax + ' ' + ay + ') ' +
        (r.sy ? 'translate(' + ax + ' ' + ay + ') scale(1 ' + r.sy.toFixed(4) + ') translate(' + -ax + ' ' + -ay + ')' : ''));
      const parts = m.parts || {};
      for (const name in partEls) {
        const a = parts[name] || 0, pe = partEls[name];
        if (pe.a === a) continue;                        // unchanged: skip the DOM write
        pe.a = a;
        pe.g.setAttribute('transform', a ? 'rotate(' + a.toFixed(2) + ' ' + pe.x + ' ' + pe.y + ')' : '');
      }
      if (line) {
        const pe = partEls[rig.line.part], a = (pe.a || 0) * Math.PI / 180, [fx, fy] = rig.line.from;
        const dx = fx - pe.x, dy = fy - pe.y;
        const tx = pe.x + dx * Math.cos(a) - dy * Math.sin(a), ty = pe.y + dx * Math.sin(a) + dy * Math.cos(a);
        const by = fy + rig.line.len, sag = 30 * Math.sin(t * 0.8);
        line.setAttribute('d', 'M' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ' Q' + (tx + 25 + sag).toFixed(1) + ' ' + ((ty + by) / 2).toFixed(1) + ' ' + (tx + 10).toFixed(1) + ' ' + by);
      }
    };
    inst.api = {
      svg, rig: Object.assign({}, RIGS[id] || {}, rig), anchor: [ax, ay], viewBox: A.vb.slice(), facing: 1, origami: true,
      behaviors: Object.keys(behaviors),
      get behavior() { return inst.behavior; },
      travelSpeed() { return ((rig.travel && rig.travel[inst.behavior]) || 0) * inst.rate; },
      setSeason(s) { inst.season = s; applyPalette(); },
      setNight(n) { inst.night = !!n; applyPalette(); },
      setBehavior(b) { if (behaviors[b]) inst.behavior = b; },
      // Playback speed; negative plays the motion backwards (a walk cycle stepping in reverse).
      // Re-anchors t0 so the pose doesn't jump when the rate changes.
      setRate(r) { const now = performance.now() / 1000, t = (now - inst.t0) * inst.rate; inst.rate = r; inst.t0 = now - t / r; },
      seek(t) { inst.t0 = performance.now() / 1000 - t; inst.frame(performance.now() / 1000); },
      destroy() { live.delete(inst); unwatch(inst); svg.remove(); },
    };
    live.add(inst);
    inst.frame(performance.now() / 1000);
    ensureLoop();
    return inst.api;
  }
  if (!document.getElementById('origami-style')) {
    const st = document.createElement('style');
    st.id = 'origami-style';
    st.textContent = Array.from({ length: 12 }, (_, i) => '.origami .of' + i + '{fill:var(--o' + i + ');transition:fill .7s ease}').join('') + '.origami .o-line{stroke:var(--oline)}';
    document.head.appendChild(st);
  }

  window.Creatures = { build, RIGS, ORIGAMI, PALETTE, COAT, naturalPaint, ids: () => Object.keys(RIGS) };
})();
