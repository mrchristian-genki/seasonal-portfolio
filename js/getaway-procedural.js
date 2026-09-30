/* PROCEDURAL LAYERS -- scenery drawn in code instead of painted: a sea that
   shimmers and a beach that waves wash up. Each builder returns an <svg> sized to
   its recipe box (w x h world units); motion is plain CSS in scene-test.css, so
   it costs nothing when paused and nothing is redrawn per frame.
   Options (all optional) are colours and a seed; the same seed draws the same shore. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  // small seeded random, so a recipe always draws the same scene
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const gradient = (defs, id, stops, x2 = 0, y2 = 1) => {
    const g = el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, defs);
    stops.forEach(([o, c, a = 1]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g));
    return `url(#${id})`;
  };
  let uid = 0;

  // A wavy line across the width: a sum of a few sines, from the seed.
  function waveLine(w, base, amp, r) {
    const k = [0, 1, 2].map(() => ({ f: (1 + r() * 3) * Math.PI * 2 / w, p: r() * 6.3, a: amp * (0.4 + r() * 0.6) }));
    return (x, shift = 0) => base + k.reduce((s, c) => s + Math.sin(x * c.f + c.p + shift) * c.a, 0);
  }

  /* The open sea: deep at the horizon, bright near the shore, with drifting
     streaks that get longer and thicker as they come closer, and glints. */
  function sea(w, h, o = {}) {
    const r = rng(o.seed || 7), id = 'sea' + uid++;
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', class: 'pr-sea' });
    const defs = el('defs', {}, svg);
    const fill = gradient(defs, id, o.colors || [[0, '#0a9fc4'], [0.06, '#0ec2d9'], [0.4, '#2bc9e0'], [0.75, '#5fd5e7'], [1, '#86e0ed']]);
    el('rect', { x: 0, y: 0, width: w, height: h, fill }, svg);
    el('rect', { x: 0, y: 0, width: w, height: 1.5, fill: o.horizon || '#0b8fb3', opacity: 0.8 }, svg);

    const streaks = el('g', { class: 'pr-streaks' }, svg);
    for (let i = 0; i < (o.streaks || 46); i++) {
      const t = Math.pow(r(), 1.5), y = 3 + t * (h - 10);          // denser near the horizon
      const len = (30 + r() * 220) * (0.35 + t), x = r() * (w + len) - len;
      const g = el('g', { class: 'pr-streak' }, streaks);
      g.style.setProperty('--dx', `${(8 + 26 * t) * (r() < 0.5 ? -1 : 1)}px`);
      g.style.animationDuration = `${7 + r() * 9}s`;
      g.style.animationDelay = `${-r() * 16}s`;
      el('line', { x1: x, y1: y, x2: x + len, y2: y, stroke: o.streak || '#fff', 'stroke-opacity': (0.14 + r() * 0.22).toFixed(2),
        'stroke-width': (0.8 + t * 3.2).toFixed(1), 'stroke-linecap': 'round' }, g);
    }
    // glints in a loose column under the sun
    const cx = (o.sunX ?? 0.5) * w;
    for (let i = 0; i < (o.glints || 16); i++) {
      const t = r(), y = 6 + t * t * (h * 0.8), x = cx + (r() - 0.5) * (60 + t * 260), s = 2 + t * 5;
      const g = el('path', { d: `M${x} ${y - s}L${x + s * 0.3} ${y}L${x} ${y + s}L${x - s * 0.3} ${y}Z M${x - s * 1.4} ${y}L${x} ${y - s * 0.22}L${x + s * 1.4} ${y}L${x} ${y + s * 0.22}Z`,
        fill: o.glint || '#fff', class: 'pr-glint' }, svg);
      g.style.animationDelay = `${-r() * 4}s`;
      g.style.animationDuration = `${2.5 + r() * 2.5}s`;
    }
    return svg;
  }

  // Round foam blobs bulging up from y = line(x), as a closed band down to y = foot(x).
  function blobs(w, line, foot, size, r) {
    let x = -30, d = `M${x} ${foot(x)} L${x} ${line(x)}`;
    while (x < w + 30) {
      const step = size * (1.4 + r() * 2.2), nx = x + step, up = size * (0.5 + r() * 0.9);
      d += ` C${x + step * 0.02} ${line(x) - up} ${nx - step * 0.02} ${line(nx) - up} ${nx} ${line(nx)}`;
      x = nx;
    }
    for (let bx = x; bx >= -30; bx -= 10) d += ` L${bx} ${foot(bx)}`;
    return d + 'Z';
  }

  /* The beach: sand with soft dune ridges, the breaking surf along the waterline,
     and a thin wash that runs up the sand, hangs and slides back, leaving the
     sand dark and wet for a moment. Above the surf the layer is transparent:
     the sea layer runs on underneath. */
  function beach(w, h, o = {}) {
    const r = rng(o.seed || 3), id = 'bch' + uid++;
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', class: 'pr-beach' });
    const defs = el('defs', {}, svg);
    const shore = h * (o.shore ?? 0.37);             // the waterline, down from the top of the box
    const reach = h * (o.reach ?? 0.2);              // how far the wash runs up the sand
    const surf = h * (o.surf ?? 0.2);                // height of the breaking surf band
    const period = o.period || 8;
    const sandFill = gradient(defs, id + 's', o.sand || [[0, '#f7dcae'], [0.45, '#f8d59e'], [1, '#f4c27f']]);
    const washFill = gradient(defs, id + 'w', o.wash || [[0, '#8fe3ee', 0.95], [0.7, '#b5edf3', 0.8], [1, '#d6f5f8', 0.7]]);
    const path = (line, from = -30, to = w + 30) => {
      let d = '';
      for (let x = from; x <= to; x += 10) d += `${d ? ' L' : 'M'}${x} ${line(x)}`;
      return d;
    };

    const edge = waveLine(w, shore, h * 0.025, r);
    el('path', { d: `${path(edge)} L${w + 30} ${h + 2} L-30 ${h + 2} Z`, fill: sandFill }, svg);

    // dune ridges: a pale crest over a soft shadow, wider toward the viewer
    for (let i = 0; i < (o.ridges || 2); i++) {
      const line = waveLine(w, shore + reach + h * (0.14 + i * 0.2), h * (0.03 + i * 0.02), r);
      el('path', { d: path(line), fill: 'none', stroke: '#e9b775', 'stroke-opacity': 0.4, 'stroke-width': 6 + i * 4, transform: 'translate(0 5)' }, svg);
      el('path', { d: path(line), fill: 'none', stroke: '#fff4df', 'stroke-opacity': 0.75, 'stroke-width': 2.5 + i * 1.5 }, svg);
    }

    // the wash: a sheet of water runs down the sand, hangs and slides back. Its
    // edge is redrawn at each keyframe (SVG animate on d), so it changes shape as
    // it moves instead of sliding as one piece. A white lace rim trails it and
    // lingers on the way back, and the sand it leaves darkens, then dries.
    const X = [];
    for (let x = -30; x <= w + 30; x += 20) X.push(x);
    const bandD = (top, bottom) => 'M' + X.map((x) => `${x} ${top(x).toFixed(1)}`).join(' L') + ' L' +
      X.slice().reverse().map((x) => `${x} ${bottom(x).toFixed(1)}`).join(' L') + 'Z';
    const morph = (node, frames, times, lag = 0) => el('animate', { attributeName: 'd', dur: period + 's', repeatCount: 'indefinite',
      begin: `${-lag * period}s`, values: frames.join(';'), keyTimes: times.join(';'), calcMode: 'spline',
      keySplines: times.slice(1).map(() => '.45 0 .35 1').join(';') }, node);
    const times = [0, 0.4, 0.52, 1];
    const wob = waveLine(w, 0, h * 0.03, r);
    const lipAt = (k, shift) => (x) => edge(x) + 4 + k * reach + wob(x, shift);
    const lips = [lipAt(0, 0), lipAt(1, 0.9), lipAt(0.95, 1.4), lipAt(0, 0)];

    const wet = el('path', { d: bandD(edge, lipAt(1, 1.1)), fill: o.wet || '#dcaa6c', opacity: 0 }, svg);
    el('animate', { attributeName: 'opacity', dur: period + 's', repeatCount: 'indefinite', values: '0;0;.5;0', keyTimes: '0;.38;.55;1' }, wet);

    const top = (x) => edge(x) - surf * 0.5;
    const sheetF = lips.map((l) => bandD(top, l));
    morph(el('path', { d: sheetF[0], fill: washFill }, svg), sheetF, times);
    const rimF = lips.map((l) => bandD((x) => l(x) - 3, (x) => l(x) + 4 + Math.abs(Math.sin(x / 23)) * 3));
    morph(el('path', { d: rimF[0], fill: o.foam || '#fff', 'fill-opacity': 0.92 }, svg), rimF, times, -0.04);

    // the breaking surf: a pale back row and a white front row of foam blobs
    const rows = [[surf * 1.15, o.foamBack || '#d8f3f6', 0.9, 'pr-surf-b'], [surf, o.foam || '#ffffff', 1, 'pr-surf']];
    rows.forEach(([hgt, fill, op, cls]) => {
      const line = waveLine(w, shore - hgt * 0.55, h * 0.02, r);
      const foot = waveLine(w, shore + h * 0.02, h * 0.012, r);
      el('path', { d: blobs(w, line, foot, hgt * 0.45, r), fill, 'fill-opacity': op, class: cls }, svg);
    });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) svg.pauseAnimations();
    return svg;
  }

  /* A sky: a vertical gradient over the whole box. o.stops = [[offset, colour], ...]. */
  function sky(w, h, o = {}) {
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', class: 'pr-sky' });
    const fill = gradient(el('defs', {}, svg), 'sky' + uid++, o.stops || [[0, '#0590cf'], [1, '#a9d8e4']]);
    el('rect', { width: w, height: h, fill }, svg);
    return svg;
  }

  /* A low sun: a disc with two soft halos, sitting on (or sinking into) the horizon.
     The box is the glow's extent; the disc is o.r units across the middle. */
  function sun(w, h, o = {}) {
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet', class: 'pr-sun' });
    const defs = el('defs', {}, svg), id = 'sun' + uid++;
    const g = el('radialGradient', { id }, defs);
    [[0, o.core || '#fff4c9', 0.95], [0.18, o.core || '#fff4c9', 0.8], [0.4, o.glow || '#ffb86b', 0.35], [1, o.glow || '#ffb86b', 0]]
      .forEach(([off, c, a]) => el('stop', { offset: off, 'stop-color': c, 'stop-opacity': a }, g));
    el('circle', { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2, fill: `url(#${id})`, class: 'pr-halo' }, svg);
    el('circle', { cx: w / 2, cy: h / 2, r: o.r || 40, fill: o.disc || '#fff1c2' }, svg);
    return svg;
  }

  /* The sun's path on the water: short bright dashes in a column under the sun,
     narrow at the horizon and spreading toward the viewer, each drifting a little. */
  function sunpath(w, h, o = {}) {
    const r = rng(o.seed || 5);
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', class: 'pr-sunpath' });
    const cx = (o.x ?? 0.5) * w;
    for (let i = 0; i < (o.dashes || 70); i++) {
      const t = Math.pow(r(), 0.8), y = 2 + t * (h - 4), spread = 12 + t * w * 0.22;
      const len = (6 + r() * 40) * (0.3 + t), x = cx + (r() - 0.5) * 2 * spread * (0.4 + r() * 0.6) - len / 2;
      const g = el('g', { class: 'pr-streak' }, svg);
      g.style.setProperty('--dx', `${(3 + 10 * t) * (r() < 0.5 ? -1 : 1)}px`);
      g.style.animationDuration = `${2.5 + r() * 3}s`; g.style.animationDelay = `${-r() * 5}s`;
      el('line', { x1: x, y1: y, x2: x + len, y2: y, stroke: r() < 0.3 ? (o.hot || '#fff3c4') : (o.color || '#ffc27a'),
        'stroke-opacity': (0.5 + r() * 0.45 - t * 0.2).toFixed(2), 'stroke-width': (1 + t * 3).toFixed(1), 'stroke-linecap': 'round' }, g);
    }
    return svg;
  }

  window.PROC = { sea, beach, sky, sun, sunpath };
})();
