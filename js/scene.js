// V2 Scene -- keyframe engine + travel() wired, per-season color grading live
// Season index: 0=winter 1=spring 2=summer 3=fall  (matches kf array order)
// Plates (DOM order = depth, no z-index anywhere):
//   plateSky → plateCelestial → plateAurora → plateClouds →
//   plateBackground → plateMidground → plateForeground → plateFx → plateUi

(function boot() {
  try { _bootInner(); }
  catch(e) {
    const d = document.getElementById('__dbg') ||
      Object.assign(document.body.appendChild(document.createElement('div')),
        {id:'__dbg', style:'position:fixed;bottom:8px;left:8px;z-index:9999;background:#300;color:#f88;font:12px monospace;padding:10px;border-radius:6px;white-space:pre-wrap;max-width:90vw'});
    d.textContent = 'BOOT ERROR:\n' + (e && e.message) + '\n' + ((e && e.stack) || '').split('\n').slice(0,4).join('\n');
    console.error('boot threw', e);
  }
})();

function _bootInner() {
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const VW = 5003.8931, VH = 3333.3333;

  // ── KEYFRAME ENGINE (inlined) ─────────────────────────────────────────────
  // Season index: 0=winter, 1=spring, 2=summer, 3=fall
  // s is a float season clock; kf() interpolates smoothly between neighbours.
  const smooth = t => t * t * (3 - 2 * t);
  const clamp  = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap   = s => ((s % 4) + 4) % 4;
  const lerp   = (a, b, t) => a + (b - a) * t;
  // TWEEN is set by travel() during a handoff: { a, b, p, mc }
  let TWEEN = null;
  const kfRaw = (s, v) => { s = wrap(s); const i = Math.floor(s), t = smooth(s - i); return lerp(v[i], v[(i+1)%4], t); };
  const kf    = (s, v) => TWEEN ? lerp(kfRaw(TWEEN.a, v), kfRaw(TWEEN.b, v), TWEEN.mc) : kfRaw(s, v);
  const hx    = c => {
    // Accepts both "#rrggbb" and "rgb(r,g,b)": skyStops() returns mix() output that is fed
    // back into mix(). Hex-only parsing gives NaN and silently invalidates the sky gradient.
    if (c.charCodeAt(0) === 35) return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
    const m = c.match(/[\d.]+/g);
    return [+m[0], +m[1], +m[2]];
  };
  const rgb   = a => `rgb(${a.map(v => Math.max(0,Math.min(255,Math.round(v)))).join(',')})`;
  const mix   = (c1, c2, t) => { const a=hx(c1), b=hx(c2); return rgb([lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]); };
  const kfcArr= (s, cols) => { const c = cols.map(hx); return [0,1,2].map(k => Math.round(kf(s, c.map(x => x[k])))); };
  const kfc   = (s, cols) => `rgb(${kfcArr(s, cols).join(',')})`;

  // ── SEASON CLOCK & GRADING PALETTES ──────────────────────────────────────
  // s: float, 0=winter 1=spring 2=summer 3=fall
  let s = 1; // start on spring

  // Tahoe palette -- [winter, spring, summer, fall] per layer
  const GRADE = {
    // Sky stop colours -- match skyStops() transitions but colour-shift per season
    sky0: ['#080e22', '#7eb8d8', '#4a80cc', '#8a6080'],  // top
    sky1: ['#1a2a52', '#a8d8e8', '#7ab8e0', '#a86050'],  // mid
    sky2: ['#a8b0b8', '#b8dce8', '#c8e8f4', '#d09060'],  // horizon

    // Per-layer CSS filter strings -- applied on top of the tod brightness
    // format: [winter, spring, summer, fall]
    // mountains: winter is bright, pale and cool (frost is bright and desaturated, not dim).
    // No large hue-rotate: on this already-blue art it pushes toward orange/brown.
    mtn:  [
      'saturate(.55) brightness(1.18)',
      'hue-rotate(-8deg) saturate(1.12) brightness(1.04)',
      'saturate(1) brightness(1)',   // summer baseline
      'hue-rotate(10deg) saturate(1.18) sepia(.10)',
    ],
    // midground (lake/hills): keep hue-rotate small; brightening surfaces a hue shift more
    // than darkening does.
    lake: [
      'brightness(0.5) saturate(4.5) hue-rotate(-3deg)',
      'brightness(0.82) saturate(3.2) hue-rotate(12deg)',
      'saturate(2.6) brightness(0.86)',
      'brightness(0.78) saturate(2.6) hue-rotate(-40deg)',
    ],
    // foreground/foliage: grey-white in winter, vivid in spring, amber in fall.
    // Fall needs heavy sepia + saturate + hue-rotate (same direction as
    // BOULDER_GRASS_SEASON_FILTER); a light warm tint just reads as tinted green.
    foliage: [
      'saturate(.12) brightness(1.35)',
      'hue-rotate(-6deg) saturate(1.18) brightness(1.06)',
      'saturate(1) brightness(1)',
      'sepia(.55) saturate(2.4) hue-rotate(-14deg) brightness(1.03)',
    ],
    // Hero tree, on top of the foliage grade: the foliage grade leaves its big canopy olive in
    // fall, so it gets an extra push to a burnt orange-brown to match the pines.
    heroTree: [
      'sepia(0) hue-rotate(0deg) saturate(1) brightness(1)',
      'sepia(0) hue-rotate(0deg) saturate(1) brightness(1)',
      'sepia(0) hue-rotate(0deg) saturate(1) brightness(1)',
      'sepia(.45) hue-rotate(-22deg) saturate(1.35) brightness(.9)',
    ],
  };

  // Interpolate a filter string between two season values.
  // We decompose each filter into its numeric components, lerp them, reassemble.
  // Seasons are integers 0-3; we smooth-step between adjacent ones via kfRaw.
  function interpFilter(s, filters) {
    // Extract numeric value from a filter token like "hue-rotate(-8deg)" → -8
    // Must accept values with no leading zero (".28"): /-?\d+(\.\d+)?/ misreads them as "28".
    const num = str => {
      const m = str.match(/-?\d*\.?\d+/);
      return m ? parseFloat(m[0]) : 1;
    };
    // Decompose into {name: value}. Use [\w-]+, not \w+: \w truncates "hue-rotate" to
    // "rotate" (not a filter function) and the browser silently drops the whole string.
    const decompose = f => {
      const parts = {};
      (f.match(/[\w-]+\([^)]+\)/g) || []).forEach(tok => {
        const name = tok.match(/^[\w-]+/)[0];
        parts[name] = num(tok);
      });
      return parts;
    };
    const sw = wrap(s);
    const i = Math.floor(sw), t = smooth(sw - i);
    const ia = TWEEN ? TWEEN.a : i;
    const ib = TWEEN ? TWEEN.b : (i+1)%4;
    const tc = TWEEN ? TWEEN.mc : t;
    const da = decompose(filters[ia]), db = decompose(filters[ib]);
    // Token order = the order written in the season that dominates the blend (the target
    // season once settled). Filter functions don't commute, and each season's string was tuned
    // in its own written order; taking the order from the season you travelled FROM made fall
    // look different depending on which tab you came from.
    const [pa, pb] = tc < 0.5 ? [da, db] : [db, da];
    const keys = [...new Set([...Object.keys(pa), ...Object.keys(pb)])];
    // Neutral default for a key missing on one side: multiplicative functions
    // (saturate/brightness/contrast) -> 1, additive ones (hue-rotate/sepia/grayscale/invert)
    // -> 0. A blanket 1 gave summer full sepia from fall, its wraparound neighbour.
    const NEUTRAL = { 'hue-rotate': 0, 'sepia': 0, 'grayscale': 0, 'invert': 0 };
    return keys.map(k => {
      const fallback = NEUTRAL[k] ?? 1;
      const va = da[k] ?? fallback, vb = db[k] ?? fallback;
      const v = lerp(va, vb, tc);
      if (k === 'hue-rotate') return `hue-rotate(${v.toFixed(1)}deg)`;
      if (k === 'sepia' || k === 'saturate' || k === 'brightness') return `${k}(${v.toFixed(3)})`;
      return `${k}(${v.toFixed(3)})`;
    }).join(' ');
  }

  // ── SEASON FILTER (SVG attribute, not CSS) ─────────────────────────────
  // WebKit: CSS `filter` is a no-op on anything except the outermost <svg>. Nested <svg>, <g>
  // and leaf <image> silently ignore it, and nearly every seasonal target here is one of those
  // (placeSvg shores/boulders/plants, tree and canopy groups, the hero tree <image>).
  // Fix: build a real SVG <filter> (feColorMatrix for saturate/hue-rotate/sepia,
  // feComponentTransfer for brightness -- the primitives the CSS spec defines those functions
  // by, so the math matches) and apply it via the filter="url(#…)" ATTRIBUTE, which WebKit
  // honours on <g> and nested <svg>.
  // One <filter> per element, cached on it and updated in place. render() calls this every rAF
  // frame, so it must stay cheap: `__lastFilterStr` early-outs on unchanged input.
  // CSS transitions don't animate attributes set from JS; discrete season jumps use
  // applySeasonFilterTweened() below instead.
  function parseCssFilterTokens(str) {
    const tokens = [];
    const re = /([\w-]+)\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(str || '')) !== null) {
      const name = m[1];
      const arg = parseFloat(m[2]);
      if (Number.isNaN(arg)) continue;
      if (name === 'brightness' || name === 'saturate' || name === 'hue-rotate' || name === 'sepia') {
        tokens.push({ name, value: arg });
      }
    }
    return tokens;
  }
  // sepia(amount) per the CSS spec: identity matrix lerped toward the fixed sepia matrix.
  // hue-rotate/saturate map 1:1 to feColorMatrix type="hueRotate"/"saturate".
  function sepiaMatrixValues(amount) {
    const a = Math.max(0, Math.min(1, amount));
    const S = [0.393, 0.769, 0.189, 0, 0,  0.349, 0.686, 0.168, 0, 0,  0.272, 0.534, 0.131, 0, 0,  0, 0, 0, 1, 0];
    const I = [1, 0, 0, 0, 0,  0, 1, 0, 0, 0,  0, 0, 1, 0, 0,  0, 0, 0, 1, 0];
    return S.map((v, i) => (I[i] * (1 - a) + v * a).toFixed(4)).join(' ');
  }
  function buildFilterPrimitive(gNS, tok) {
    if (tok.name === 'saturate' || tok.name === 'hue-rotate') {
      const p = document.createElementNS(gNS, 'feColorMatrix');
      p.setAttribute('type', tok.name === 'saturate' ? 'saturate' : 'hueRotate');
      p.setAttribute('values', String(tok.value));
      return p;
    }
    if (tok.name === 'sepia') {
      const p = document.createElementNS(gNS, 'feColorMatrix');
      p.setAttribute('type', 'matrix');
      p.setAttribute('values', sepiaMatrixValues(tok.value));
      return p;
    }
    // brightness: feComponentTransfer linear slope on R/G/B; alpha passes through.
    const p = document.createElementNS(gNS, 'feComponentTransfer');
    ['feFuncR', 'feFuncG', 'feFuncB'].forEach((fn) => {
      const f = document.createElementNS(gNS, fn);
      f.setAttribute('type', 'linear');
      f.setAttribute('slope', String(tok.value));
      p.appendChild(f);
    });
    return p;
  }
  function updateFilterPrimitive(p, tok) {
    if (tok.name === 'saturate' || tok.name === 'hue-rotate') { p.setAttribute('values', String(tok.value)); return; }
    if (tok.name === 'sepia') { p.setAttribute('values', sepiaMatrixValues(tok.value)); return; }
    Array.from(p.children).forEach((f) => f.setAttribute('slope', String(tok.value)));
  }
  // Where to hang this element's own <defs>: <svg>/<g> can hold children
  // directly; a leaf like <image> can't, so its filter def lives on its
  // parent instead (shared across any siblings that also need one).
  function ensureFilterHost(el) {
    const tag = el.tagName && el.tagName.toLowerCase();
    return (tag === 'svg' || tag === 'g') ? el : el.parentNode;
  }
  let __seasonFilterUid = 0;
  // Identity filters (every step a no-op) are dropped entirely: they still cost a full
  // offscreen pass per frame on anything animating underneath.
  const FILTER_IDENTITY = { 'hue-rotate': 0, saturate: 1, brightness: 1, sepia: 0 };
  const isIdentity = (tokens) => tokens.every((t) => Math.abs(t.value - FILTER_IDENTITY[t.name]) < 0.0015);
  // Apply a filter chain to one colour exactly as an SVG filter would (linearRGB working space,
  // clamp after each primitive; feColorMatrix saturate/hueRotate/sepia, linear-slope brightness).
  // Used for the lake, whose colour was calibrated against reference photos under that maths.
  function lakeColour(hex, tokens) {
    const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const toSrgb = (c) => { c = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, c)) * 255); };
    let v = hx(hex).map(toLin);
    const cl = (x) => Math.max(0, Math.min(1, x));
    const mat = (m) => { v = [0, 1, 2].map((r) => cl(m[r * 5] * v[0] + m[r * 5 + 1] * v[1] + m[r * 5 + 2] * v[2])); };
    tokens.forEach((t) => {
      if (t.name === 'brightness') v = v.map((x) => cl(x * t.value));
      else if (t.name === 'saturate') {
        const k = t.value;
        mat([0.213 + 0.787 * k, 0.715 - 0.715 * k, 0.072 - 0.072 * k, 0, 0,
             0.213 - 0.213 * k, 0.715 + 0.285 * k, 0.072 - 0.072 * k, 0, 0,
             0.213 - 0.213 * k, 0.715 - 0.715 * k, 0.072 + 0.928 * k, 0, 0]);
      } else if (t.name === 'hue-rotate') {
        const a = t.value * Math.PI / 180, c = Math.cos(a), n = Math.sin(a);
        mat([0.213 + c * 0.787 - n * 0.213, 0.715 - c * 0.715 - n * 0.715, 0.072 - c * 0.072 + n * 0.928, 0, 0,
             0.213 - c * 0.213 + n * 0.143, 0.715 + c * 0.285 + n * 0.140, 0.072 - c * 0.072 - n * 0.283, 0, 0,
             0.213 - c * 0.213 - n * 0.787, 0.715 - c * 0.715 + n * 0.715, 0.072 + c * 0.928 + n * 0.072, 0, 0]);
      } else if (t.name === 'sepia') mat(sepiaMatrixValues(t.value).split(' ').map(Number));
    });
    return '#' + v.map((x) => toSrgb(x).toString(16).padStart(2, '0')).join('');
  }
  function applySeasonFilter(el, cssString, pad) {
    if (!el) return;
    if (el.__lastFilterStr === cssString) return; // idle frame -- skip all DOM work
    el.__lastFilterStr = cssString;
    const gNS = 'http://www.w3.org/2000/svg';
    let tokens = parseCssFilterTokens(cssString);
    if (isIdentity(tokens)) tokens = [];
    let rec = el.__filterRec;
    const sig = tokens.map((t) => t.name).join(',');
    if (!rec || rec.sig !== sig) {
      if (rec && rec.filterEl && rec.filterEl.parentNode) rec.filterEl.parentNode.removeChild(rec.filterEl);
      const host = ensureFilterHost(el);
      if (!host) return;
      let defs = host.__seasonDefs;
      if (!defs || !defs.isConnected) {
        defs = document.createElementNS(gNS, 'defs');
        host.appendChild(defs);
        host.__seasonDefs = defs;
      }
      const id = `seasonFilt${__seasonFilterUid++}`;
      const filterEl = document.createElementNS(gNS, 'filter');
      filterEl.setAttribute('id', id);
    filterEl.setAttribute('color-interpolation-filters', 'sRGB'); // match the CSS grade layers
      filterEl.setAttribute('color-interpolation-filters', 'sRGB'); // match the CSS grade layers
      // Filter region = element bbox plus `pad` on every side (default 30%,
      // room for swaying parts). Colour-only filters never spread, so large
      // groups pass a small pad to keep the offscreen buffer small.
      const pp = pad != null ? pad : 0.3;
      filterEl.setAttribute('x', `${-pp * 100}%`); filterEl.setAttribute('y', `${-pp * 100}%`);
      filterEl.setAttribute('width', `${100 + pp * 200}%`); filterEl.setAttribute('height', `${100 + pp * 200}%`);
      const prims = tokens.map((t) => { const p = buildFilterPrimitive(gNS, t); filterEl.appendChild(p); return p; });
      defs.appendChild(filterEl);
      if (tokens.length) el.setAttribute('filter', `url(#${id})`);
      else el.removeAttribute('filter');
      rec = { sig, filterEl, prims };
      el.__filterRec = rec;
    } else {
      tokens.forEach((t, i) => updateFilterPrimitive(rec.prims[i], t));
    }
  }
  window.__applySeasonFilter = applySeasonFilter;

  // ── SEASON FILTER TWEEN ────────────────────────────────────────────────
  // JS-driven crossfade for the discrete per-season jumps in components.js (boulder rock/grass,
  // treeline, foreground plants, foothills). Continuous callers keep applySeasonFilter:
  // `s`/`tod` already interpolate there, and a second smoothing layer would only add lag.
  // Rebuilds the chain in the TARGET string's own token order, so the settled result equals a
  // direct snap (hand-tuned combos are never reordered). Start values are looked up by name
  // from the current chain, falling back to identity (e.g. hue-rotate tweens in from 0).
  // An interrupted tween retargets from its current values, so it never jumps backward.
  function applySeasonFilterTweened(el, cssString, tweenMs) {
    if (!el) return;
    const targetTokens = parseCssFilterTokens(cssString);
    const same = el.__lastFilterStr === cssString;
    el.__lastFilterStr = cssString;

    const prevRec = el.__filterRec;
    if (prevRec && prevRec.raf) cancelAnimationFrame(prevRec.raf);
    const currentByName = {};
    if (prevRec) prevRec.names.forEach((n, i) => { currentByName[n] = prevRec.current[i]; });

    const gNS = 'http://www.w3.org/2000/svg';
    if (prevRec && prevRec.filterEl && prevRec.filterEl.parentNode) prevRec.filterEl.parentNode.removeChild(prevRec.filterEl);
    const host = ensureFilterHost(el);
    if (!host) return;
    let defs = host.__seasonDefs;
    if (!defs || !defs.isConnected) {
      defs = document.createElementNS(gNS, 'defs');
      host.appendChild(defs);
      host.__seasonDefs = defs;
    }
    const id = `seasonFilt${__seasonFilterUid++}`;
    const filterEl = document.createElementNS(gNS, 'filter');
    filterEl.setAttribute('id', id);
    filterEl.setAttribute('x', '-30%'); filterEl.setAttribute('y', '-30%');
    filterEl.setAttribute('width', '160%'); filterEl.setAttribute('height', '160%');
    const fromValues = targetTokens.map((t) => (currentByName[t.name] != null ? currentByName[t.name] : FILTER_IDENTITY[t.name]));
    const prims = targetTokens.map((t, i) => { const p = buildFilterPrimitive(gNS, { name: t.name, value: fromValues[i] }); filterEl.appendChild(p); return p; });
    defs.appendChild(filterEl);
    if (targetTokens.length) el.setAttribute('filter', `url(#${id})`);
    else el.removeAttribute('filter');

    const rec = { filterEl, prims, names: targetTokens.map((t) => t.name), current: fromValues.slice(), raf: null };
    el.__filterRec = rec;

    const toValues = targetTokens.map((t) => t.value);
    if (same && fromValues.every((v, i) => v === toValues[i])) { // already settled here, nothing to animate
      if (isIdentity(targetTokens)) el.removeAttribute('filter');
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / tweenMs);
      for (let i = 0; i < targetTokens.length; i++) {
        const v = fromValues[i] + (toValues[i] - fromValues[i]) * t;
        updateFilterPrimitive(rec.prims[i], { name: targetTokens[i].name, value: v });
        rec.current[i] = v;
      }
      rec.raf = t < 1 ? requestAnimationFrame(step) : null;
      // Settled on a no-op filter: drop it (see isIdentity above).
      if (t >= 1 && isIdentity(targetTokens)) el.removeAttribute('filter');
    };
    rec.raf = requestAnimationFrame(step);
  }
  window.__applySeasonFilterTweened = applySeasonFilterTweened;

  // ── WIND FIELD ───────────────────────────────────────────────────────────
  const WIND = { base: 0.30, gust: 0, target: 0 };
  // PERF (Safari): the gust used to be mirrored into a CSS variable (--wind) on #hero every frame.
  // Nothing in the CSS read it, but an inherited variable on the scene's root makes the browser
  // re-check the style of every element in the scene each time it changes, so frame rates swung
  // from ~55 to ~6 fps whenever a gust was ramping. Consumers read WIND.gust directly instead.
  (function windTick() {
    let lastWindTime = performance.now();
    (function tick(now) {
      const dt = Math.min((now - lastWindTime) / 1000, 0.5);
      lastWindTime = now;
      if (Math.random() < 0.006) WIND.target = WIND.base + Math.random() * 0.5;
      else if (Math.random() < 0.006) WIND.target = WIND.base;
      // Frame-rate-independent exponential ease (0.02 per frame at 60fps).
      const decay = 1 - Math.pow(1 - 0.02, dt * 60);
      WIND.gust += (WIND.target - WIND.gust) * decay;
      requestAnimationFrame(tick);
    })(performance.now());
  })();
  window.WIND = WIND;
  window.setWind = v => { WIND.base = v; WIND.target = v; };

  // ── SVG HELPER ───────────────────────────────────────────────────────────
  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  // ── WORLD-SPACE SVG SIZING ─────────────────────────────────────────────
  // World-space svgs render TALLER than their box (bottom-anchored, see `celestial`) so
  // .scene-core's overflow:hidden crops the excess off the top as sky. Height is set in JS
  // pixels, not CSS aspect-ratio: Safari/WebKit ignores aspect-ratio for intrinsic sizing
  // of <svg>, which collapsed the scene to a thin strip. Don't reintroduce aspect-ratio.
  // registerWorldSvg() sizes now; resizeAllWorldSvgs() re-syncs on rAF-debounced resize.
  const __worldSvgs = [];
  // Core width is read once per pass (cached) - reading it per svg forced a layout each time.
  let __coreW = 0;
  function coreWidth() {
    if (!__coreW) { const core = document.getElementById('sceneCore');
      if (core) __coreW = core.getBoundingClientRect().width || core.clientWidth; }
    return __coreW;
  }
  function sizeWorldSvg(svg) {
    const w = coreWidth(); if (!w) return;
    svg.style.height = (w * (VH / VW)) + 'px';
  }
  function registerWorldSvg(svg) {
    __worldSvgs.push(svg);
    sizeWorldSvg(svg);
    return svg;
  }
  function resizeAllWorldSvgs() { __coreW = 0; __worldSvgs.forEach(sizeWorldSvg); }
  let __resizeRaf = null;
  window.addEventListener('resize', () => {
    if (__resizeRaf) cancelAnimationFrame(__resizeRaf);
    __resizeRaf = requestAnimationFrame(resizeAllWorldSvgs);
  });
  window.__resizeAllWorldSvgs = resizeAllWorldSvgs;

  // ── 1. PLATE-SKY ─────────────────────────────────────────────────────────
  const sky = Object.assign(document.createElement('div'), { id: 'skyGradient' });
  $('plateSky').appendChild(sky);

  // ── 2. PLATE-CELESTIAL: sun + moon ───────────────────────────────────────
  const cel = mk('svg', {
    id: 'celestial', viewBox: `0 0 ${VW} ${VH}`,
    // Bottom-anchor: preserveAspectRatio Y-alignment had no observable effect here (the plate's
    // overflow:hidden clips first), so don't rely on it. Use 'none' with a box whose aspect
    // equals the viewBox (1:1 scale), anchor with bottom:0, and let the plate crop the sky.
    preserveAspectRatio: 'none',
    style: `position:absolute;left:0;bottom:0;width:100%`
  });
  registerWorldSvg(cel);
  $('plateCelestial').appendChild(cel);
  const defs = mk('defs', {}, cel);
  defs.innerHTML = `
    <radialGradient id="sunGlow"><stop offset="0" stop-color="#fff7d6" stop-opacity=".9"/><stop offset=".4" stop-color="#ffe9a8" stop-opacity=".35"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
    <radialGradient id="moonGlow"><stop offset="0" stop-color="#eaf0ff" stop-opacity=".8"/><stop offset=".5" stop-color="#cdd8f0" stop-opacity=".3"/><stop offset="1" stop-color="#cdd8f0" stop-opacity="0"/></radialGradient>`;
  const sunBody = mk('g', { id: 'sunBody' }, cel);
  mk('circle', { r: 640, fill: 'url(#sunGlow)' }, sunBody);
  mk('circle', { r: 200, fill: '#ffe9a8' }, sunBody);
  const moonBody = mk('g', { id: 'moonBody' }, cel);
  mk('circle', { r: 500, fill: 'url(#moonGlow)' }, moonBody);
  mk('circle', { r: 155, fill: '#eef1f7' }, moonBody);
  mk('circle', { cx: -56, cy: 31, r: 31, fill: '#d4dcec', opacity: '.5' }, moonBody);
  mk('circle', { cx: 46, cy: -46, r: 20, fill: '#d4dcec', opacity: '.45' }, moonBody);

  // ── 3. PLATE-CLOUDS: procedural drifting clouds + rain ─────────────────
  (function buildClouds() {
    const plate = $('plateClouds');
    if (!plate) return;
    // World-frame DIV (sized like every world svg); clouds are HTML layers, see
    // buildCloudFamilyLayers. Bottom-anchored like `celestial`.
    const cloudSvg = document.createElement('div');
    cloudSvg.id = 'cloudSvg';
    cloudSvg.style.cssText = 'position:absolute;left:0;bottom:0;width:100%';
    registerWorldSvg(cloudSvg);
    plate.appendChild(cloudSvg);
    const rainCanvas = document.createElement('canvas');
    rainCanvas.id = 'rainCanvas';
    rainCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity 2s';
    const fxPlateForRain = $('plateFx') || plate;
    fxPlateForRain.appendChild(rainCanvas);

    // ── CLOUD FAMILIES (cumulus/cirrus/altocumulus/cumulonimbus) ───────────
    // Sole cloud system (old generic makeCloud() clouds removed). Per-season mix comes from
    // CLOUD_GATES: cirrus in fall, altocumulus in spring, rare summer cumulonimbus, etc.
    // Each family gets a nested <svg> in its own CLOUD_VIEWBOX space, width VW and height
    // matched to the viewBox aspect, so there is no meet/slice scaling ambiguity.
    const cloudFamilies = {};
    if (window.SceneComponents && window.SceneComponents.buildCloudFamilyLayers) {
      const SC = window.SceneComponents;
      // yFrac: top of band as a fraction of VH, staggered by real altitude (cirrus highest);
      // cumulonimbus gets a tall band since its shapes stack vertically.
      const FAMILY_LAYOUT = { cirrus: 0.00, altocumulus: 0.05, cumulus: 0.04, cumulonimbus: 0.00 };
      Object.keys(SC.CLOUD_VIEWBOX).forEach(name => {
        const [, , vbW, vbH] = SC.CLOUD_VIEWBOX[name].split(' ').map(Number);
        const height = VW * (vbH / vbW);
        const band = document.createElement('div');
        band.className = 'cloud-family';
        band.style.cssText = `position:absolute;left:0;width:100%;overflow:hidden;top:${(FAMILY_LAYOUT[name] * 100).toFixed(4)}%;height:${(height / VH * 100).toFixed(4)}%`;
        cloudSvg.appendChild(band);
        // Boots on spring (s = 1); updateClouds() eases opacity per frame from there.
        cloudFamilies[name] = SC.buildCloudFamilyLayers(name, band, 'spring', () => WIND.gust);
      });
    }
    const CLOUD_SEASON_NAMES = { 0: 'winter', 1: 'spring', 2: 'summer', 3: 'fall' };
    const familyOpacity = { cumulus: 0.5, cirrus: 0.5, altocumulus: 0.5, cumulonimbus: 0.1 };

    const drops = Array.from({length:180}, () => ({
      x: Math.random()*VW, y: Math.random()*VH,
      len: 24+Math.random()*30, speed: 18+Math.random()*14, opacity: 0.45+Math.random()*0.45
    }));
    // Snow: separate pool and motion (slow fall + side drift), winter only.
    const flakes = Array.from({length:140}, () => ({
      x: Math.random()*VW, y: Math.random()*VH,
      r: 5+Math.random()*7, speed: 4+Math.random()*5, opacity: 0.55+Math.random()*0.4,
      driftPhase: Math.random()*Math.PI*2, driftSpeed: 0.6+Math.random()*0.8, driftAmp: 15+Math.random()*25,
    }));
    // Leaf-fall (fall only): pre-rasterized PNG sprites (assets/leaves/) drawn on the rain/snow
    // canvas, rotating + swaying. No SVG filters (rule: no runtime SVG filters in steady state).
    const LEAF_SPRITE_NAMES = ['leaf-aspen-green','leaf-aspen-chartreuse','leaf-aspen-gold','leaf-aspen-orange','leaf-maple-red'];
    // Loaded on first use (fall), not at boot: ~50KB the other seasons never need.
    const leafSprites = LEAF_SPRITE_NAMES.map(() => new Image());
    let leafSpritesLoaded = false;
    const loadLeafSprites = () => { if (leafSpritesLoaded) return; leafSpritesLoaded = true;
      leafSprites.forEach((img, i) => { img.src = `assets/leaves/${LEAF_SPRITE_NAMES[i]}.png`; }); };
    const leaves = Array.from({length: 46}, () => ({
      x: Math.random()*VW, y: Math.random()*VH,
      size: 60+Math.random()*70, speed: 6+Math.random()*7,
      rot: Math.random()*Math.PI*2, rotSpeed: (Math.random()-0.5)*1.4,
      swayPhase: Math.random()*Math.PI*2, swaySpeed: 0.5+Math.random()*0.7, swayAmp: 40+Math.random()*70,
      opacity: 0.6+Math.random()*0.35, sprite: leafSprites[Math.floor(Math.random()*leafSprites.length)],
    }));
    let rainOpacity = 0, snowOpacity = 0, leafOpacity = 0, lastTime = 0;

    function updateClouds(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.5);
      lastTime = now;
      // Ease each family toward its CLOUD_GATES target (buildCloudFamily sets opacity only
      // once), at the same dt*0.8 rate as rain/snow.
      if (window.SceneComponents) {
        const CLOUD_GATES = window.SceneComponents.CLOUD_GATES;
        const CLOUD_SEASON_IDX = window.SceneComponents.CLOUD_SEASON_IDX;
        const seasonName = CLOUD_SEASON_NAMES[window.__currentSeason ?? 1] || 'spring';
        for (const name in cloudFamilies) {
          const target = CLOUD_GATES[name][CLOUD_SEASON_IDX[seasonName]];
          const prev = familyOpacity[name];
          familyOpacity[name] += (target - prev) * dt * 0.8;
          const gEl = cloudFamilies[name].g;
          // Only touch the DOM when the value visibly changes, and take a
          // family out of rendering entirely once it has faded out (e.g.
          // cumulonimbus in winter) -- its drift loop skips hidden families too.
          const op = familyOpacity[name].toFixed(3);
          if (gEl.__op !== op) { gEl.style.opacity = op; gEl.__op = op; }
          const hide = familyOpacity[name] < 0.01;
          if (gEl.__hidden !== hide) { gEl.style.display = hide ? 'none' : ''; gEl.__hidden = hide; }
        }
      }
      // Rain (fall), snow (winter) and leaves (fall) ease independently.
      const targetRain = kf(s, [0.0, 0.0, 0.0, 0.45]);
      const targetSnow = kf(s, [0.55, 0.0, 0.0, 0.0]);
      const targetLeaf = kf(s, [0.0, 0.0, 0.0, 0.85]);
      if (targetLeaf > 0) loadLeafSprites();
      rainOpacity += (targetRain - rainOpacity) * dt * 0.8;
      snowOpacity += (targetSnow - snowOpacity) * dt * 0.8;
      leafOpacity += (targetLeaf - leafOpacity) * dt * 0.8;
      window.__rainOpacity = rainOpacity;
      window.__snowOpacity = snowOpacity;
      window.__leafOpacity = leafOpacity;
      // Drive the water shimmer's precip API (drops + ripples). Threshold avoids flicker at a
      // crossfade edge; call setPrecip only on change since it resets a spawn timer.
      if (window.__waterAPI) {
        const target = snowOpacity > 0.1 && snowOpacity >= rainOpacity ? 'snow'
          : rainOpacity > 0.1 ? 'rain' : 'none';
        if (target !== window.__waterPrecipState) {
          window.__waterAPI.setPrecip(target);
          window.__waterPrecipState = target;
        }
      }
      const active = Math.max(rainOpacity, snowOpacity, leafOpacity);
      rainCanvas.style.opacity = active;
      if (active > 0.05) {
        const rect = plate.getBoundingClientRect();
        // Rounded: comparing the integer canvas size to fractional rect sizes resized (and
        // reallocated) the canvas on every frame.
        const rw = Math.round(rect.width), rh = Math.round(rect.height);
        if (rainCanvas.width !== rw || rainCanvas.height !== rh) {
          rainCanvas.width = rw; rainCanvas.height = rh;
        }
        const ctx = rainCanvas.getContext('2d');
        ctx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
        const sx = rainCanvas.width/VW, sy = rainCanvas.height/VH;
        if (rainOpacity > 0.02) {
          drops.forEach(d => {
            d.y += d.speed * dt * 60;
            if (d.y > VH) { d.y = -d.len; d.x = Math.random()*VW; }
            ctx.strokeStyle = `rgba(180,210,240,${d.opacity})`;
            ctx.lineWidth = 2.8; ctx.beginPath();
            ctx.moveTo(d.x*sx, d.y*sy); ctx.lineTo((d.x+2)*sx, (d.y+d.len)*sy); ctx.stroke();
          });
        }
        if (snowOpacity > 0.02) {
          flakes.forEach(f => {
            f.y += f.speed * dt * 60;
            f.driftPhase += f.driftSpeed * dt;
            if (f.y > VH) { f.y = -f.r * 2; f.x = Math.random()*VW; }
            const dx = Math.sin(f.driftPhase) * f.driftAmp;
            ctx.fillStyle = `rgba(255,255,255,${f.opacity})`;
            ctx.beginPath();
            ctx.arc((f.x+dx)*sx, f.y*sy, f.r*Math.min(sx,sy), 0, Math.PI*2);
            ctx.fill();
          });
        }
        if (leafOpacity > 0.02) {
          const leafScale = Math.min(sx, sy);
          leaves.forEach(lf => {
            lf.y += lf.speed * dt * 60;
            lf.rot += lf.rotSpeed * dt;
            lf.swayPhase += lf.swaySpeed * dt;
            if (lf.y > VH) { lf.y = -lf.size; lf.x = Math.random()*VW; }
            if (!lf.sprite.complete || !lf.sprite.naturalWidth) return;
            const dx = Math.sin(lf.swayPhase) * lf.swayAmp;
            const px = (lf.x+dx)*sx, py = lf.y*sy;
            const w = lf.size*leafScale, h = w*(lf.sprite.naturalHeight/lf.sprite.naturalWidth);
            ctx.save();
            ctx.globalAlpha = lf.opacity;
            ctx.translate(px, py);
            ctx.rotate(lf.rot);
            ctx.drawImage(lf.sprite, -w/2, -h/2, w, h);
            ctx.restore();
          });
        }
      } else if (rainCanvas.width > 1) {
        // Idle (no rain, snow or leaves): hand the full-screen buffer back.
        rainCanvas.width = 1; rainCanvas.height = 1;
      }
    }
    window.__updateClouds = updateClouds;
    window.__cloudSvg = cloudSvg;
  })();

  // ── AURORA + STARS (winter/fall night sky) ────────────────────────────────
  // Night mode only, and behind the clouds: plateAurora already sits between plateCelestial
  // and plateClouds in the plate stack, so no reordering is needed.
  // Visibility = season gate kf(s,[1,0,0,1]) (0=winter 1=spring 2=summer 3=fall: on for
  // winter/fall) x window.__moonEligible, both eased per frame in render(). Reusing the moon's
  // gate keeps aurora/stars in step with the moon through toggleNightMode() and travel()
  // without a third parallel transition.
  (function buildAurora() {
    const plate = $('plateAurora');
    if (!plate) return;
    // HTML layers, not one big <svg>: in Safari every twinkling star and drifting band
    // repainted the whole sky and re-ran the aurora blur on the CPU every frame. Now stars are
    // tiny divs (opacity animation) and each band is pre-blurred once in its own layer that the
    // GPU moves. auroraSvg is kept as the name render() uses; it's the world-frame container.
    const auroraSvg = document.createElement('div');
    auroraSvg.id = 'auroraSvg';
    auroraSvg.style.cssText = 'position:absolute;left:0;bottom:0;width:100%;pointer-events:none';
    registerWorldSvg(auroraSvg);   // after cssText: it sets the height
    plate.appendChild(auroraSvg);
    // No CSS opacity transition: render() sets opacity every frame from already-eased
    // sources, so a CSS transition chasing it would only add lag.
    auroraSvg.style.opacity = '0';
    const layerDiv = (id, parent) => { const d = document.createElement('div'); if (id) d.id = id;
      d.style.cssText = 'position:absolute;inset:0'; parent.appendChild(d); return d; };

    // Stars: upper sky only, each with its own twinkle timing so the field doesn't pulse in
    // lockstep. Drawn on one canvas at ~15fps (the twinkle is slow), which is far cheaper in
    // Safari than 90 separately animated elements. Same timing curve as the old CSS starTwinkle
    // (ease-in-out, alternate, opacity .25 -> 1, per-star duration and delay).
    const starCanvas = document.createElement('canvas');
    starCanvas.id = 'starField';
    starCanvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:56%;pointer-events:none';
    auroraSvg.appendChild(starCanvas);
    const STAR_COUNT = 90;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * VW, y: Math.random() * VH * 0.55, r: 3 + Math.random() * 5,
      dur: 2 + Math.random() * 3, delay: Math.random() * 4,
    }));
    const easeIO = t => { // cubic-bezier(.42,0,.58,1)
      let u = t; for (let i = 0; i < 6; i++) { const x = 3*.42*u*(1-u)*(1-u) + 3*.58*u*u*(1-u) + u*u*u - t;
        const dx = 3*.42*(1-u)*(1-3*u) + 3*.58*u*(2-3*u) + 3*u*u; if (!dx) break; u = Math.min(1, Math.max(0, u - x/dx)); }
      return 3*u*u*(1-u) + u*u*u; };
    const starT0 = performance.now();
    let starLast = 0;
    (function drawStars(now) {
      requestAnimationFrame(drawStars);
      if (auroraSvg.__hidden || auroraSvg.style.display === 'none') {
        if (starCanvas.width > 1) { starCanvas.width = 1; starCanvas.height = 1; }   // day: free the buffer
        return;
      }
      if (now - starLast < 66) return;
      starLast = now;
      const dpr = window.devicePixelRatio || 1;
      const W = Math.round(starCanvas.clientWidth * dpr), H = Math.round(starCanvas.clientHeight * dpr);
      if (!W || !H) return;
      if (starCanvas.width !== W || starCanvas.height !== H) { starCanvas.width = W; starCanvas.height = H; }
      const ctx = starCanvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      const k = W / VW;                               // world -> canvas px (height is 56% of VH)
      ctx.fillStyle = '#ffffff';
      const t = (now - starT0) / 1000;
      for (const st of stars) {
        let a = 1;                                   // before its delay, a star shows at full
        if (t >= st.delay) {
          const ph = (t - st.delay) / st.dur, cyc = Math.floor(ph);
          let f = ph - cyc; if (cyc % 2) f = 1 - f;
          a = 0.25 + 0.75 * easeIO(f);
        }
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(st.x * k, st.y * (H / (VH * 0.56)), st.r * k, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    })(performance.now());

    // Aurora: blurred, drifting ribbons. SVG feGaussianBlur (not CSS blur()) so softness
    // scales with world units like the water reflection, not a fixed CSS-pixel radius.
    function auroraWavePath(y, h) {
      const segs = 6;
      let d = `M0,${y.toFixed(0)}`;
      for (let i = 0; i < segs; i++) {
        const x1 = VW * (i + 0.33) / segs, x2 = VW * (i + 0.66) / segs, x3 = VW * (i + 1) / segs;
        const dir = i % 2 === 0 ? -1 : 1;
        const yy = (y + dir * h * 0.4).toFixed(0);
        d += ` C${x1.toFixed(0)},${yy} ${x2.toFixed(0)},${yy} ${x3.toFixed(0)},${y.toFixed(0)}`;
      }
      d += ` L${VW.toFixed(0)},${(y + h).toFixed(0)} L0,${(y + h).toFixed(0)} Z`;
      return d;
    }
    const AURORA_BANDS = [
      { color: '#4ee6a0', y: VH * 0.08, h: VH * 0.16, opacity: 0.35 },
      { color: '#7a5ce6', y: VH * 0.14, h: VH * 0.14, opacity: 0.28 },
      { color: '#3ec9d6', y: VH * 0.20, h: VH * 0.12, opacity: 0.25 },
    ];
    const auroraGroup = layerDiv('auroraBands', auroraSvg);
    // Memory: each band used to be a full-screen SVG layer (three of them, ~50 MB each on a
    // retina MacBook, which is what pushed Safari into "this webpage was reloaded"). The bands
    // are pure blur, so each is now drawn once into a small canvas (the same SVG blur, rasterised
    // at 800 px) that the GPU stretches. Only the sky band (top 48% of the world) is covered.
    const AUR_H = 0.48, AUR_CW = 800, AUR_CH = 256;
    AURORA_BANDS.forEach((b, i) => {
      const band = document.createElement('canvas');
      band.width = AUR_CW; band.height = AUR_CH;
      band.className = 'aurora-layer aurora-drift';
      band.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${AUR_H * 100}%`;
      band.style.setProperty('--dur', (18 + i * 6) + 's');
      band.style.transformOrigin = `50% ${((b.y + 0.3 * b.h) / (VH * AUR_H) * 100).toFixed(3)}%`;
      auroraGroup.appendChild(band);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${AUR_CW}" height="${AUR_CH}" viewBox="0 0 ${VW.toFixed(0)} ${(VH * AUR_H).toFixed(0)}" preserveAspectRatio="none">` +
        `<defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="60"/></filter></defs>` +
        `<path d="${auroraWavePath(b.y, b.h)}" fill="${b.color}" opacity="${b.opacity}" filter="url(#b)"/></svg>`;
      const img = new Image();
      img.onload = () => band.getContext('2d').drawImage(img, 0, 0, AUR_CW, AUR_CH);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });

    // Shooting stars live in their own world svg (JS-animated, rare).
    const shootSvg = mk('svg', { viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: 'none',
      style: 'position:absolute;inset:0;width:100%;height:100%;overflow:visible' });
    auroraSvg.appendChild(shootSvg);
    const auroraDefs = mk('defs', {}, shootSvg);

    // Shooting stars: spring/summer counterpart to the aurora. Same night-gated container,
    // opposite season gate, so only one of the two ever shows. Each streak is removed when its
    // animation ends, so there's no per-frame cost between (rare) streaks.
    const shootingStarGroup = mk('g', { id: 'shootingStars' }, shootSvg);
    // Gradient must use gradientUnits:userSpaceOnUse. A vertical line has a zero-width bbox,
    // and a gradient on a degenerate objectBoundingBox isn't painted at all (streak invisible).
    // userSpaceOnUse means y2 must match each star's length, so each star gets its own gradient
    // (unique id, removed with the star). Tail (y=0) is transparent, head (y=len) brightest.
    let shootingStarSeq = 0;
    function spawnShootingStar() {
      // The line runs along its local +y axis (0,0)->(0,len); `outer` rotates that axis, so
      // travel is just translateY on the same axis and always matches the drawn angle.
      const len = 260 + Math.random() * 180;
      const travel = VW * (0.28 + Math.random() * 0.14);
      const angle = (18 + Math.random() * 14) * (Math.random() < 0.5 ? 1 : -1); // shallow, either direction
      const startX = VW * (0.1 + Math.random() * 0.8);
      const startY = VH * (0.04 + Math.random() * 0.18);
      // rotate so the line's local +y axis points along the shallow angle
      // (mostly sideways, a little down) -- 90° would be straight down.
      const rot = (angle > 0 ? 1 : -1) * (90 - Math.abs(angle));
      // Outer g: static position/rotation via the SVG transform ATTRIBUTE. Inner g: motion via
      // the CSS transform PROPERTY. Keep them separate: a CSS transform overrides the SVG
      // transform attribute instead of composing with it.
      const outer = mk('g', {
        transform: `translate(${startX.toFixed(0)},${startY.toFixed(0)}) rotate(${rot.toFixed(1)})`,
      }, shootingStarGroup);
      const inner = mk('g', {}, outer);
      const gradId = `shootingStarGrad${shootingStarSeq++}`;
      const streakGrad = mk('linearGradient', {
        id: gradId, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: len,
      }, auroraDefs);
      mk('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0' }, streakGrad);
      mk('stop', { offset: '80%', 'stop-color': '#ffffff', 'stop-opacity': '0.9' }, streakGrad);
      mk('stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '1' }, streakGrad);
      mk('line', { x1: 0, y1: 0, x2: 0, y2: len, stroke: `url(#${gradId})`, 'stroke-width': 6, 'stroke-linecap': 'round' }, inner);
      const durMs = (600 + Math.random() * 350);
      const cleanup = () => { outer.remove(); streakGrad.remove(); };
      // Animated from JS with rAF, not CSS @keyframes: keyframes reading var(--travel)/var(--dur)
      // sometimes computed their first frame before the custom properties were set and stayed
      // stuck at 0% (invisible, intermittently). Per-frame style writes have no such race.
      const t0 = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - t0) / durMs);
        // opacity: fade in over the first 10%, hold, fade out over the last 20%.
        let op;
        if (t < 0.1) op = t / 0.1;
        else if (t < 0.8) op = 1;
        else op = 1 - (t - 0.8) / 0.2;
        inner.style.opacity = op.toFixed(3);
        inner.style.transform = `translateY(${(t * travel).toFixed(1)}px)`;
        if (t < 1 && outer.parentNode) {
          requestAnimationFrame(tick);
        } else {
          cleanup();
        }
      }
      requestAnimationFrame(tick);
    }
    // Random interval (a regular rhythm reads as mechanical). Only spawns when the
    // spring/summer and night gates are both on; otherwise the timer is a no-op.
    (function scheduleNext() {
      const delay = 4000 + Math.random() * 7000;
      setTimeout(() => {
        const seasonGate = window.__shootingStarGate || 0;
        const nightGate = window.__moonEligible != null ? window.__moonEligible : 0;
        if (seasonGate > 0.5 && nightGate > 0.5) spawnShootingStar();
        scheduleNext();
      }, delay);
    })();

    window.__auroraSvg = auroraSvg;
    window.__auroraBands = auroraGroup;
    window.__shootingStarGroup = shootingStarGroup;
  })();

  // ── 4. PLATE-BACKGROUND: mountain assets ─────────────────────────────────
  // ── 4/5/6. UNIFIED WORLD COORDINATES ──────────────────────────────────────
  // Mountains, lake, trees, boulders, plants and water all share viewBox 0 0 VW VH and the
  // same scaling as plateCelestial/plateClouds/generatedTrees, so everything stays in
  // registration as the window resizes (one camera on a fixed world). Don't position world
  // elements with CSS percentages of the hero box: that's a different scaling rule and the
  // layers drift apart.
  //
  // HTML builders (buildBoulderGrass, buildForegroundPlant, buildFoothillsRange,
  // buildWaterShimmer) are unchanged; only their container is placed at explicit VW x VH
  // coordinates (e.g. old left:-18%/width:136% -> x:-0.18*VW, width:1.36*VW).
  // Cropping is bottom-anchored: .scene-core (scene.css) is shorter than VW:VH, so the crop
  // must come off the empty sky at top, never the shore/foreground. Every world-space svg
  // (celestial, clouds, generatedTrees, flowerSvg, these plates) must crop identically, or that
  // layer drifts out of registration (e.g. pines sliding off their shores).
  // GRADE LAYERS (Sept 23 performance pass). Season/time-of-day colour grading is a CSS
  // `filter` on a plain HTML <div> that wraps a world svg, NOT an SVG filter on elements inside
  // the svg. Why: an SVG filter is re-run over its whole region every frame that anything under
  // it moves (grass/pine sway), which was the scene's dominant frame cost; a CSS filter on an
  // HTML element is applied by the compositor (GPU). WebKit only ignores CSS filters on elements
  // INSIDE an svg (the Sept 21 bug); on an HTML div it works in every engine.
  // Side effect, intended: CSS filters work in sRGB, SVG filters default to linearRGB. The land
  // grades read warmer/cleaner in sRGB (approved Sept 23). The lake keeps its linearRGB look
  // because its colour is computed directly (see lakeColour), not filtered.
  // Layers sharing a plate paint in the order they're created (DOM order = depth, as ever).
  function gradeLayer(plateId, id) {
    const plate = $(plateId);
    if (!plate) return null;
    const div = document.createElement('div');
    div.className = 'grade-layer';
    div.id = id;
    plate.appendChild(div);
    return div;
  }
  // Set a CSS filter only when it changes; identity grades are cleared entirely.
  function setLayerFilter(el, cssString) {
    if (!el) return;
    if (el.__cssFilter === cssString) return;
    el.__cssFilter = cssString;
    const tokens = parseCssFilterTokens(cssString);
    el.style.filter = isIdentity(tokens) ? '' : cssString;
  }

  function worldSvg(plateId) {
    const plate = typeof plateId === 'string' ? $(plateId) : plateId;
    if (!plate) return null;
    // See the bottom-anchor note near `celestial` for why this doesn't rely on
    // preserveAspectRatio's Y-alignment, and registerWorldSvg (near `mk`) for why height is set
    // in JS (CSS aspect-ratio is broken in Safari).
    return registerWorldSvg(mk('svg', {
      viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: 'none',
      style: `position:absolute;left:0;bottom:0;width:100%;overflow:visible`,
    }, plate));
  }
  // Wrap an HTML-based builder (all of them fetch into a plain div) in a
  // foreignObject at explicit world coordinates, then hand that div to the
  // builder exactly as before.
  function placeHtml(svg, id, x, y, w, h, build) {
    // overflow:visible on the foreignObject itself, not just the div: a foreignObject is an
    // SVG viewport that clips by default. Chrome/Firefox let children escape; Safari clips
    // strictly, silently cutting content drawn past the box (water shimmer streaks at negative
    // x, boulder/plant art past its nominal w/h).
    const fo = mk('foreignObject', { id: id + 'FO', x, y, width: w, height: h, style: 'overflow: visible' }, svg);
    const div = document.createElement('div');
    div.id = id;
    // Explicit px size, not 100%: WebKit doesn't reliably resolve percentage sizes for HTML
    // inside a scaled-down foreignObject, and the content silently fails to paint. w/h are in
    // the foreignObject's own units, so this equals 100%.
    Object.assign(div.style, { width: w + 'px', height: h + 'px', overflow: 'visible', pointerEvents: 'none' });
    fo.appendChild(div);
    const result = build(div);
    return { fo, div, result };
  }
  // Fetched SVG assets (shores, boulders, plants, foothills, lagoonForegroundBand2) go in a
  // native nested <svg>, never a foreignObject: WebKit silently won't paint fetched content
  // inside a foreignObject, even with correct sizing (geometry checks out, nothing paints).
  // Same reason placeImage() uses a native <image>.
  // The fetch must also be synchronous: WebKit doesn't paint content appended to the plate
  // <svg> from any callback after the initial synchronous script run (load handler,
  // setTimeout, microtask). Builders use fetchSyncText() (sync XHR) to stay in that first
  // pass; local assets are tiny, so the blocking cost is negligible.
  function placeSvg(svg, id, x, y, w, h, build) {
    const nested = mk('svg', {
      id, x, y, width: w, height: h,
      style: 'overflow: visible; pointer-events: none;',
    }, svg);
    const result = build(nested);
    return { svg: nested, result };
  }
  // Synchronous text fetch (XHR) for the asset builders above -- see the
  // placeSvg comment for why this has to be synchronous in Safari.
  function fetchSyncText(src) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', src, false);
    xhr.send(null);
    if (xhr.status !== 200 && xhr.status !== 0) throw new Error('sync fetch failed: ' + src);
    return xhr.responseText;
  }
  // Rebuild a DOMParser-parsed document's nodes in the CURRENT document and append them into
  // `wrap` (a native <svg> from placeSvg).
  // XML comments are stripped before parsing: image/svg+xml is strict XML and a bare "--"
  // inside a comment is illegal. WebKit then returns an error document (root <html>, with
  // <parsererror> nested in <body>) while Chrome tolerates it, so check for <parsererror>
  // anywhere in the tree, not just at the root. Comments don't render, so stripping is safe.
  function injectFetchedSvg(wrap, text) {
    const stripped = text.replace(/<!--[\s\S]*?-->/g, '');
    const parsed = new DOMParser().parseFromString(stripped, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) return null;
    const root = parsed.documentElement;
    if (!root) return null;
    Array.from(root.childNodes).forEach(n => wrap.appendChild(document.importNode(n, true)));
    // Carry over the fetched root's own viewBox onto our wrap, since wrap's
    // x/y/width/height (world placement) were already set by placeSvg and
    // the fetched content's internal coordinate system still needs mapping.
    const vb = root.getAttribute('viewBox');
    if (vb) wrap.setAttribute('viewBox', vb);
    return root;
  }
  window.__placeSvg = placeSvg;
  window.__fetchSyncText = fetchSyncText;
  window.__injectFetchedSvg = injectFetchedSvg;
  // Same, for a plain image asset (lake, hero peak, isolated tree) that needs no builder.
  function placeImage(svg, id, x, y, w, h, src, extraStyle) {
    // Native SVG <image>, never an HTML <img> in a foreignObject: WebKit lays that out and
    // reports it loaded, but paints nothing under this scene's viewBox scaling.
    const img = mk('image', {
      id, x, y, width: w, height: h,
      preserveAspectRatio: 'none', // matches the old object-fit:'fill' (stretch exactly)
    }, svg);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', src);
    img.setAttribute('href', src); // modern browsers also read the unprefixed attribute
    Object.assign(img.style, { pointerEvents: 'none' }, extraStyle || {});
    return img;
  }

  // ── 4. PLATE-BACKGROUND: mountain assets ─────────────────────────────────
  (function buildBackground() {
    // Foothills take the full mtn grade; the mountain range only takes tod brightness, so they
    // sit in separate grade layers (foothills first = behind, as before).
    const svg = worldSvg(gradeLayer('plateBackground', 'bgFoothills'));
    if (!svg) return;
    const mtnSvg = worldSvg(gradeLayer('plateBackground', 'bgMountains'));
    // Mountain_Range_Long.svg foothills via buildFoothillsRange, placed with placeSvg (native
    // <svg>, no foreignObject) at the equivalent of the old top:46%/height:30%.
    placeSvg(svg, 'foothillsWrap', 0, 1065, VW, 450, (nested) => {
      nested.style.webkitMaskImage = 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)';
      nested.style.maskImage = nested.style.webkitMaskImage;
      if (window.SceneComponents && window.SceneComponents.buildFoothillsRange) {
        window.SceneComponents.buildFoothillsRange(nested, 'assets/Mountain_Range_Long.svg', 'summer', { cropWidth: 2999.72 });
        window.__foothillsWrap = nested;
        // Content is injected synchronously straight into `nested`, so its default
        // bottom-aligned crop can be overridden right away (no polling).
        nested.setAttribute('preserveAspectRatio', 'xMidYMin slice');
      }
    });

    // ── MOUNTAIN RANGE (replaces the old single static hero_peak_snow.svg) ──
    // Built from 3 of the 8 isolated mountain shapes (hero + two supports) for per-mountain
    // control and depth. All share one ground line (baseY) despite different native viewBox
    // heights. DOM order = depth: supports are appended first (behind), hero last (front).
    window.__mountainRange = [];
    if (window.SceneComponents && window.SceneComponents.makeMountainIsolated && window.MOUNTAIN_SHAPES) {
      const SC = window.SceneComponents;
      const shapeById = id => window.MOUNTAIN_SHAPES.find(s => s.id === id);
      const baseY = 2350; // shared ground line, world units -- roughly where
                           // the foothills/treeline band begins
      const addMountain = (shapeId, targetH, x, opacity) => {
        const shape = shapeById(shapeId);
        if (!shape) return null;
        const [, , vbW, vbH] = shape.viewBox.split(' ').map(Number);
        const scale = targetH / vbH;
        const g = SC.makeMountainIsolated({ shape, season: 'spring', scale, x, y: baseY - vbH * scale });
        g.style.opacity = String(opacity);
        mtnSvg.appendChild(g);
        window.__mountainRange.push(g);
        return { x, width: vbW * scale };
      };
      // Hero placement is computed first (the right support is positioned from it) but it is
      // appended last, since DOM order = depth.
      const heroTargetH = 1750, heroX = 250;
      const heroVbH = 521.2; // mtn4's native viewBox height
      const heroWidth = 1239.1 * (heroTargetH / heroVbH);
      // Left support (behind, hazier): mostly off the left edge; only peak and right shoulder show.
      addMountain(2, 1500, -400, 0.85);
      // Right support: must start well inside the hero's right edge. mtn4 is wide/flat, so
      // anything starting at or past its right edge is hidden behind it or off-canvas. Taller
      // than the left support so its peak clears the hero's shoulder and the treeline.
      addMountain(6, 1650, heroX + heroWidth - 900, 0.85);
      // Hero (front, full color): appended last. Deliberately narrower than full width and left
      // of center; a full-width mtn4 leaves no sky gap and completely hides the right support.
      addMountain(4, heroTargetH, heroX, 1);
    }
  })();

  // ── 5. PLATE-MIDGROUND ───────────────────────────────────────────────────
  (function buildMidground() {
    // Grade layers, back to front: treeline (foliage) / water (no filter: colour computed) /
    // reflection + shores (foliage) / shimmer + fish (none). The pines (buildTrees) add a fifth,
    // foliage-graded layer on top.
    let svg = worldSvg(gradeLayer('plateMidground', 'mgTreeline'));
    if (!svg) return;
    // WATER PLANE + LEFT/RIGHT SHORE. Rule: every scene object is isolated and independently
    // positionable. Don't reintroduce the old monolithic lakeAsset
    // (landscape-hills-scenic-green-no-trees.svg): it baked water and both shores into one image
    // and was the root cause of the "ghost bank" layering bugs.
    // left-shore.svg / right-shore.svg were extracted from it by bounding box (left: native x
    // -49..3115, right: x 3543..8951), with its <style> block and gradient defs copied wholesale;
    // the background rect, water-tone paths and empty groups were dropped.
    // The water plane is a plain gradient rect; the shores sit on top of it, loaded through
    // buildCroppedSvgAsset (which uniquifies ids/classes).
    // ── DISTANT TREELINE ─────────────────────────────────────────────────
    // Dark forest band at the horizon, between the foothills (ending ~y1515) and the water, so
    // the lake doesn't read as "all underwater". It's the scene's dark middle layer, not a
    // second light-green hill.
    // Paint order: must be appended BEFORE the water plane and shores below (SVG paints in DOM
    // order), or the distant trees render in front of the nearer banks.
    {
      const NSsvg = 'http://www.w3.org/2000/svg';
      const treelineSvg = document.createElementNS(NSsvg, 'svg');
      // y:1300 / height 300 with bandH 220 so the treeline reaches the foothills base instead
      // of floating in the lake.
      treelineSvg.setAttribute('id', 'distantTreeline');
      treelineSvg.setAttribute('x', 0); treelineSvg.setAttribute('y', 1300);
      treelineSvg.setAttribute('width', VW); treelineSvg.setAttribute('height', 300);
      treelineSvg.setAttribute('viewBox', `0 0 ${VW} 300`);
      treelineSvg.setAttribute('preserveAspectRatio', 'none');
      svg.appendChild(treelineSvg);
      if (window.SceneComponents && window.SceneComponents.buildDistantTreeline) {
        const treeline = window.SceneComponents.buildDistantTreeline(VW, 300, { baseY: 288, bandH: 220 });
        treelineSvg.appendChild(treeline);
        window.__distantTreeline = treeline;
      }
      // Don't add a flat water-color patch here: it hid the shore inlets.
    }

    svg = worldSvg(gradeLayer('plateMidground', 'mgWater'));
    {
      const NSsvg = 'http://www.w3.org/2000/svg';
      const waterGradId = 'waterPlaneGrad';
      let waterDefs = svg.querySelector('defs');
      if (!waterDefs) { waterDefs = document.createElementNS(NSsvg, 'defs'); svg.insertBefore(waterDefs, svg.firstChild); }
      const grad = document.createElementNS(NSsvg, 'linearGradient');
      grad.setAttribute('id', waterGradId);
      grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
      const stop1 = document.createElementNS(NSsvg, 'stop'); stop1.setAttribute('offset', '0'); stop1.setAttribute('stop-color', '#cfe8f7');
      const stop2 = document.createElementNS(NSsvg, 'stop'); stop2.setAttribute('offset', '1'); stop2.setAttribute('stop-color', '#a8d4ec');
      grad.appendChild(stop1); grad.appendChild(stop2);
      waterDefs.appendChild(grad);
      // Extra stops so the computed lake colour (render(), lakeColour) follows the filter's
      // non-linear curve across the gradient instead of only matching at the two ends.
      stop2.remove();
      const waterStops = [stop1];
      for (let i = 1; i <= 8; i++) {
        const st = document.createElementNS(NSsvg, 'stop');
        st.setAttribute('offset', String(i / 8));
        grad.appendChild(st);
        waterStops.push(st);
      }
      window.__waterStops = waterStops;
      const waterRect = document.createElementNS(NSsvg, 'rect');
      waterRect.setAttribute('id', 'waterPlane');
      // Top at 1586: tucks 2 units UNDER the treeline's ground line (wrapper y 1300 + baseY 288 =
      // 1588). It used to start at 1590, leaving a 2-unit gap that let the mountain snow show
      // through as a pale sliver wherever a snowy slope came down behind the trees (world x
      // ~2030-2125). The treeline's base is a flat band there, so the overlap hides nothing.
      waterRect.setAttribute('y', 1586);
      // Extends to VH (scene bottom), not a fixed depth: lagoonForegroundBand2's top edge dips
      // as low as world y~3026 on its shallow left stretch, and any unpainted gap shows the page
      // background as a pale, flat-edged band. The plane sits behind plateForeground, so the
      // extra depth costs nothing.
      waterRect.setAttribute('width', VW); waterRect.setAttribute('height', VH - 1586);
      waterRect.setAttribute('fill', `url(#${waterGradId})`);
      svg.appendChild(waterRect);
    }

    // WATER REFLECTION: a faded, blurred mirror of the distant treeline (the element that actually
    // sits at the waterline). A cloneNode of the live group keeps it in sync with each load's random
    // treeline layout.
    // Math: the treeline draws in local 0..300 with ground line baseY=288, so the mirror axis gives
    // y' = 576 - y, i.e. transform="translate(0,576) scale(1,-1)" (applied right-to-left: scale, then
    // translate). The wrapper sits at the same (x, y=1300) as the source but is taller so the flipped
    // copy has room to render instead of clipping.
    // Browser quirk: blur with an SVG <feGaussianBlur> (stdDeviation in local user units), NOT CSS
    // filter: blur(). On this scaled-down viewBox Firefox resolved the CSS blur differently from
    // Chrome and rendered a near-opaque dark smear over the lake.
    // Order: inserted after the water plane and before the shores, so shores hide it on dry land.
    svg = worldSvg(gradeLayer('plateMidground', 'mgShores'));
    {
      const NSsvg = 'http://www.w3.org/2000/svg';
      const treelineSrc = window.__distantTreeline;
      if (treelineSrc) {
        const reflSvg = document.createElementNS(NSsvg, 'svg');
        reflSvg.setAttribute('id', 'distantTreelineReflection');
        reflSvg.setAttribute('x', 0); reflSvg.setAttribute('y', 1300);
        reflSvg.setAttribute('width', VW); reflSvg.setAttribute('height', 500);
        reflSvg.setAttribute('viewBox', `0 0 ${VW} 500`);
        reflSvg.setAttribute('preserveAspectRatio', 'none');
        reflSvg.setAttribute('style', 'overflow:visible');

        const reflDefs = document.createElementNS(NSsvg, 'defs');

        // stdDeviation is in the treeline's local units (~300-unit-tall art), not CSS px, so every
        // engine blurs it by the same amount relative to the art.
        const blurFilter = document.createElementNS(NSsvg, 'filter');
        blurFilter.setAttribute('id', 'reflBlurFilter');
        blurFilter.setAttribute('x', '-20%'); blurFilter.setAttribute('y', '-20%');
        blurFilter.setAttribute('width', '140%'); blurFilter.setAttribute('height', '160%');
        const blurPrim = document.createElementNS(NSsvg, 'feGaussianBlur');
        blurPrim.setAttribute('stdDeviation', '5');
        blurFilter.appendChild(blurPrim);
        reflDefs.appendChild(blurFilter);

        // Fade mask: 0.35 peak opacity at the ground line (y=288) fading to 0 over 160 local units,
        // so the reflection reads as a subtle band at the shore, not a long smear.
        const fadeGrad = document.createElementNS(NSsvg, 'linearGradient');
        fadeGrad.setAttribute('id', 'reflFadeGrad');
        fadeGrad.setAttribute('x1', '0'); fadeGrad.setAttribute('y1', '0');
        fadeGrad.setAttribute('x2', '0'); fadeGrad.setAttribute('y2', '1');
        fadeGrad.setAttribute('gradientUnits', 'objectBoundingBox');
        const fadeStop1 = document.createElementNS(NSsvg, 'stop');
        fadeStop1.setAttribute('offset', '0'); fadeStop1.setAttribute('stop-color', 'white'); fadeStop1.setAttribute('stop-opacity', '0.35');
        const fadeStop2 = document.createElementNS(NSsvg, 'stop');
        fadeStop2.setAttribute('offset', '1'); fadeStop2.setAttribute('stop-color', 'white'); fadeStop2.setAttribute('stop-opacity', '0');
        fadeGrad.appendChild(fadeStop1); fadeGrad.appendChild(fadeStop2);
        reflDefs.appendChild(fadeGrad);

        const fadeMask = document.createElementNS(NSsvg, 'mask');
        fadeMask.setAttribute('id', 'reflFadeMask');
        fadeMask.setAttribute('maskUnits', 'userSpaceOnUse');
        fadeMask.setAttribute('x', '0'); fadeMask.setAttribute('y', '288');
        fadeMask.setAttribute('width', VW); fadeMask.setAttribute('height', '160');
        const fadeMaskRect = document.createElementNS(NSsvg, 'rect');
        fadeMaskRect.setAttribute('x', '0'); fadeMaskRect.setAttribute('y', '288');
        fadeMaskRect.setAttribute('width', VW); fadeMaskRect.setAttribute('height', '160');
        fadeMaskRect.setAttribute('fill', 'url(#reflFadeGrad)');
        fadeMask.appendChild(fadeMaskRect);
        reflDefs.appendChild(fadeMask);
        reflSvg.appendChild(reflDefs);

        const reflGroup = document.createElementNS(NSsvg, 'g');
        reflGroup.setAttribute('mask', 'url(#reflFadeMask)');
        reflGroup.setAttribute('filter', 'url(#reflBlurFilter)');
        const reflClone = treelineSrc.cloneNode(true);
        reflClone.removeAttribute('id');
        reflClone.setAttribute('transform', 'translate(0,576) scale(1,-1)');
        reflGroup.appendChild(reflClone);
        reflSvg.appendChild(reflGroup);

        svg.appendChild(reflSvg);
      }
    }

    // Both shores take the same foliage grade: one group, one filter.
    const shoresGraded = mk('g', { id: 'shoresGraded' }, svg);
    function placeShore(id, src, viewBox, x, y, width, height) {
      const { svg: nested } = placeSvg(shoresGraded, id, x, y, width, height, () => {});
      if (window.SceneComponents && window.SceneComponents.buildCroppedSvgAsset) {
        window.SceneComponents.buildCroppedSvgAsset(nested, src, viewBox, { preserveAspectRatio: 'none' });
      }
      return nested;
    }
    // LEFT SHORE: native viewBox "-100 400 3300 800" (aspect ~4.125).
    // Moving a shore does not move the pines/boulders grounded on it: shift those by the same amount
    // (see the PINES/BOULDERS Y-SHIFT note on the pines array).
    placeShore('leftShore', 'assets/left-shore.svg', '-100 400 3300 800', -200, 1450, 2000, 2000 * 800 / 3300);
    // RIGHT SHORE: native viewBox "3450 0 5550 1298" (aspect ~4.276) -- taller/starts higher than
    // the left shore, matching the real asset. Its y is kept in step with the left shore.
    // Sept 24: lowered 185 so its waterline lines up with the left bank's (~1830). The pines and
    // wildlife positions tied to this bank (RIGHT_BANK_DY in wildlife.js) moved with it.
    placeShore('rightShore', 'assets/right-shore.svg', '3450 0 5550 1298', 2700, 1250 + 185, 2600, 2600 * 1298 / 5550);

    // The full-width foreground hill lives in buildForeground, not here.
    //
    // Water shimmer: must stay in plateMidground, which sits BEFORE plateForeground in DOM order.
    // In plateFx (drawn on top) the water covered the boulders/plants and made them look submerged.
    // The box covers the open water between the raised shores and the foreground band (from y2500).
    // The wrap spans the full lake width; waterXRange only limits where drops/ripples spawn, in the
    // shimmer's 1600-unit local space. Small margins keep drops off the banks/rocks at the edges.
    svg = worldSvg(gradeLayer('plateMidground', 'mgFx'));
    if (window.SceneComponents && window.SceneComponents.buildWaterShimmer) {
      const { svg: nested } = placeSvg(svg, 'waterShimmerWrap', 0, 1550, VW, 900, () => {});
      window.__waterAPI = window.SceneComponents.buildWaterShimmer(nested, 1600, 900, { skyFrac: 0.39, waterXRange: [80, 1500] });
      const waterSvgEl = nested.querySelector('svg');
      if (waterSvgEl) {
        const bgRect = waterSvgEl.querySelector('rect');
        if (bgRect) bgRect.style.display = 'none';
      }
      // PERF (Safari): the shimmer's highlight streaks run an SVG turbulence filter on the CPU,
      // so they stay alone in #mgFx. Rain/snow drops and ripples are drawn on a canvas in
      // #mgFxAnim (right after it, so the same stacking), and the fish follow in an svg there.
      const fxLayer = gradeLayer('plateMidground', 'mgFxAnim');
      const fxCanvas = document.createElement('canvas');
      fxCanvas.style.cssText = 'position:absolute;pointer-events:none';
      fxLayer.appendChild(fxCanvas);
      const animSvg = worldSvg(fxLayer);
      // Place the canvas over the shimmer panel (plus room above for falling drops) and give the
      // shimmer the panel-local -> canvas-px mapping. Recomputed on resize.
      // Geometry from the world frame (getBoundingClientRect on a nested <svg> returns its
      // content bounds, not its viewport): panel = world box (0, 1550, VW, 900), and the shimmer's
      // own svg sits in it with viewBox 0 0 w h, xMidYMax meet.
      const placeFxCanvas = () => {
        if (!waterSvgEl) return null;
        const L = fxLayer.getBoundingClientRect(), F = animSvg.getBoundingClientRect();
        if (!F.width) return null;
        const k = F.width / VW;
        const vb = (waterSvgEl.getAttribute('viewBox') || '0 0 1600 900').split(/\s+/).map(Number);
        const pw = VW * k, ph = 900 * k, px = F.left - L.left, py = F.top - L.top + 1550 * k;
        const sc = Math.min(pw / vb[2], ph / vb[3]);
        const x0 = px + (pw - vb[2] * sc) / 2, y0 = py + (ph - vb[3] * sc);
        const cx = x0 - 30 * sc, cy = y0 - 60 * sc, cw = (vb[2] + 60) * sc, ch = (vb[3] + 60) * sc;
        Object.assign(fxCanvas.style, { left: cx + 'px', top: cy + 'px', width: cw + 'px', height: ch + 'px' });
        return { x0: x0 - cx, y0: y0 - cy, s: sc };
      };
      const api = window.__waterAPI;
      if (api && api.attachCanvas) {
        api.attachCanvas(fxCanvas, placeFxCanvas());
        let rz = 0;
        window.addEventListener('resize', () => { cancelAnimationFrame(rz);
          rz = requestAnimationFrame(() => { const m = placeFxCanvas(); if (m) api.setCanvasMap(m); }); });
        // The first placement can run before layout settles (reveal, fonts): refresh once loaded.
        window.addEventListener('load', () => { const m = placeFxCanvas(); if (m) api.setCanvasMap(m); });
      }
      svg = animSvg;
    }

    // FISH JUMPS (spring/summer only, day or night): a fish silhouette arcs out of the water along a
    // parabola, nose along its direction of travel, with ripple rings at takeoff and landing.
    // Driven by requestAnimationFrame, NOT a CSS @keyframes animation: the shooting stars (see
    // buildAurora) hit a race where a var()-in-@keyframes animation and the classList.add() that
    // triggered it intermittently never rendered. A per-frame style write has no such race.
    (function buildFishJumps() {
      const fishGroup = mk('g', { id: 'fishJumps' }, svg);
      // World-space bounds of open water: the shimmer's waterXRange (80-1500 of its 1600-wide local
      // box) scaled to VW, so fish jump where the shimmer animates, clear of the banks/pines.
      const WATER_X = [80 * (VW / 1600), 1500 * (VW / 1600)];
      const WATERLINE = 2050; // world y of the water surface
      function ripple(rx, ry, size) {
        const sz = size || 1;                          // bigger splash for a big jump
        const ring = mk('ellipse', {
          cx: rx.toFixed(1), cy: (ry || WATERLINE).toFixed(1), rx: 4, ry: 1.6, fill: 'none',
          stroke: '#e8f4fb', 'stroke-width': (2.5 * Math.sqrt(sz)).toFixed(1),
        }, fishGroup);
        const t0 = performance.now();
        const rippleDur = 900 * Math.sqrt(sz);
        function tick(now) {
          const t = Math.min(1, (now - t0) / rippleDur);
          const grow = 1 + t * 9 * sz;
          ring.setAttribute('rx', (4 * grow).toFixed(1));
          ring.setAttribute('ry', (1.6 * grow).toFixed(1));
          ring.setAttribute('opacity', (1 - t).toFixed(2));
          if (t < 1) requestAnimationFrame(tick);
          else ring.remove();
        }
        requestAnimationFrame(tick);
      }
      // Optional (x, y): jump from that world point (a tap on the lake, see wildlife.js).
      // power (0..1, optional): how long the water was held before release. Higher = a stronger
      // leap: height up to ~4.5x, airtime growing with the square root of height (real ballistics:
      // time aloft ~ sqrt(h)), a little more distance, and a bigger splash on the way back in.
      function spawnFishJump(atX, atY, power) {
        const x = atX != null ? atX : WATER_X[0] + Math.random() * (WATER_X[1] - WATER_X[0]);
        const WL = atY != null ? atY : WATERLINE;
        // Fish further up the lake are further away: draw them smaller.
        const k = atY != null ? Math.max(0.45, Math.min(1.1, (atY - 1550) / 500)) : 1;
        const dir = Math.random() < 0.5 ? 1 : -1; // which way it arcs
        const pw = Math.max(0, Math.min(1, power || 0));
        const hBoost = 1 + pw * pw * 3.5;                // eased, so short holds stay natural
        const hopW = (140 + Math.random() * 110) * k * (1 + pw * 0.8); // horizontal distance covered
        const hopH = (70 + Math.random() * 60) * k * hBoost; // peak height above the waterline
        const durMs = (700 + Math.random() * 300) * Math.sqrt(hBoost);

        // Teardrop body + forked tail, drawn nose-first along +x; the per-frame rotate() from the arc
        // tangent handles both facing and arc direction, so no separate horizontal flip is needed.
        const fish = mk('g', {}, fishGroup);
        mk('path', { d: 'M -34 0 Q -18 -11 6 -6 Q 20 -3 30 0 Q 20 3 6 6 Q -18 11 -34 0 Z', fill: '#5b7f95' }, fish);
        mk('path', { d: 'M -34 0 L -50 -10 L -44 0 L -50 10 Z', fill: '#456575' }, fish);
        mk('path', { d: 'M -20 -3 Q -4 -8 14 -4 Q -2 -1 -20 -3 Z', fill: '#9fc2d4', opacity: 0.8 }, fish);

        ripple(x, WL, 1 + pw * 0.8);
        const t0 = performance.now();
        // Handle for the eagle catch (wildlife.js): where/when the arc peaks, and grab() to take
        // the fish out of the water's hands at that moment (no landing splash).
        const handle = { apexX: x + dir * hopW * 0.5, apexY: WL - hopH, apexAt: t0 + durMs / 2, dir, k, caught: false,
          grab() { handle.caught = true; fish.remove(); } };
        function tick(now) {
          if (handle.caught) return;
          const t = Math.min(1, (now - t0) / durMs);
          const px = x + dir * hopW * t;
          // Parabolic arc: 0 at t=0 and t=1 (waterline), peak -hopH at t=0.5.
          const py = WL - hopH * 4 * t * (1 - t);
          // Orient along the arc's tangent (d/dt of px, py), not a fixed tilt, so the nose leads on
          // the way up and the body tips over coming back down.
          const dpxdt = dir * hopW;
          const dpydt = 4 * hopH * (2 * t - 1);
          const angle = Math.atan2(dpydt, dpxdt) * 180 / Math.PI;
          fish.setAttribute('transform', `translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${angle.toFixed(1)})${k !== 1 ? ` scale(${k.toFixed(2)})` : ''}`);
          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            fish.remove();
            const splash = 1 + pw * 1.6;
            ripple(x + dir * hopW, WL, splash);
            if (pw > 0.35) setTimeout(() => ripple(x + dir * hopW, WL, splash * 0.6), 160);
          }
        }
        requestAnimationFrame(tick);
        return handle;
      }
      // Random interval, same "not a metronome" reasoning as the shooting
      // stars. Only actually spawns (gate check inside) in spring/summer.
      (function scheduleNext() {
        const delay = 3000 + Math.random() * 6000;
        setTimeout(() => {
          if ((window.__fishJumpGate || 0) > 0.5) spawnFishJump();
          scheduleNext();
        }, delay);
      })();
      window.__fishJumpGroup = fishGroup;
      window.__spawnFishJump = spawnFishJump;
      window.__lakeRipple = ripple;
    })();

    // Birds live in plateBirds, between plateBackground (mountains) and plateMidground (trees) in
    // DOM order: occluded by trees, but drawn over mountains and the sun/moon. Not plateFx (topmost).
    const birdsSvg = worldSvg('plateBirds');
    if (birdsSvg && window.SceneComponents && window.SceneComponents.buildRealBirdFlock) {
      const birdVh = VH * 0.42;
      const birdSvg = mk('svg', {
        id: 'birdFlockSvg', x: 0, y: 0, width: VW, height: birdVh,
        viewBox: `0 0 ${VW} ${birdVh}`, style: 'overflow:visible',
      }, birdsSvg);
      window.__birdAPI = window.SceneComponents.buildRealBirdFlock(birdSvg, VW, birdVh);
    }
  })();

  // ── 6. PLATE-FOREGROUND: boulders + foliage ──────────────────────────────
  (function buildForeground() {
    const plateSvg = worldSvg('plateForeground');
    if (!plateSvg) return;
    // Everything below (band, boulders, plants, hero tree) takes the same foliage grade, so it
    // lives in ONE group with ONE season filter (see render()), instead of a filter per element
    // re-running on every frame of grass/plant sway.
    const svg = mk('g', { id: 'fgGraded' }, plateSvg);
    // PERF (Safari): every swaying thing (boulder grass, plants, hero tree, flowers) gets its own
    // small GPU layer instead of living in the one big foreground svg. Safari repainted that whole
    // svg every frame for any sway; now only the swaying item's own layer repaints. Each layer is a
    // div at the item's world box inside a world-frame div, holding an svg whose viewBox is that
    // same box, so coordinates inside are unchanged. The static hill band stays in the big svg.
    const fgFrame = document.createElement('div');
    fgFrame.id = 'fgItems';
    fgFrame.style.cssText = 'position:absolute;left:0;bottom:0;width:100%;pointer-events:none';
    registerWorldSvg(fgFrame);
    $('plateForeground').appendChild(fgFrame);
    const pct = (v, of) => (v / of * 100).toFixed(4) + '%';
    function fgLayer(x, y, w, h, cls) {
      const d = document.createElement('div');
      d.className = 'fg-layer' + (cls ? ' ' + cls : '');
      Object.assign(d.style, { left: pct(x, VW), top: pct(y, VH), width: pct(w, VW), height: pct(h, VH) });
      fgFrame.appendChild(d);
      return d;
    }
    function fgItemSvgIn(layer, x, y, w, h) {
      const layerSvg = mk('svg', { viewBox: `${x} ${y} ${w} ${h}`, preserveAspectRatio: 'none',
        style: 'position:absolute;inset:0;width:100%;height:100%;overflow:visible' });
      layer.appendChild(layerSvg);
      return layerSvg;
    }
    function fgItemSvg(x, y, w, h) {
      const layerSvg = mk('svg', { viewBox: `${x} ${y} ${w} ${h}`, preserveAspectRatio: 'none',
        style: 'position:absolute;inset:0;width:100%;height:100%;overflow:visible' });
      fgLayer(x, y, w, h).appendChild(layerSvg);
      return layerSvg;
    }

    // FOREGROUND HILL: the frontmost ground layer, in plateForeground so it draws over the bank
    // pines; boulders/plants/hero tree come later in this plate, so they sit on top of it.
    // Loads grassy-hills-1-nosky.svg, a standalone extract of one flat hill (own clip-path/gradient
    // defs). It must be a sky-free tile, transparent above its silhouette.
    {
      const { svg: nested } = placeSvg(svg, 'lagoonForegroundBand2', 0, 2500, VW, 700, () => {});
      if (window.SceneComponents && window.SceneComponents.buildCroppedSvgAsset) {
        // flip:true puts the dip on the right, opening a lower pocket for the hero tree.
        window.SceneComponents.buildCroppedSvgAsset(nested, 'assets/grassy-hills-1-nosky.svg', '0 886 2832 430', { preserveAspectRatio: 'xMidYMax slice', flip: true });
      }
      // Don't add a grass patch here to hide a pale band under this hill: that band was the water
      // plane being too short, fixed at waterRect (see its "DEEPENED" note in buildMidground).
    }

    // Boulders: positioned directly in world coordinates, bottoms just in front of the pines'
    // y:1700-1840 shoreline reference. Don't convert old CSS hero-percentages: they were tuned against
    // a different reference frame and put boulders off-screen.
  // Mirror a placeSvg() nested <svg> left-to-right INSIDE its own viewBox.
  // Don't use CSS scaleX(-1): on a nested <svg> transform-box defaults to view-box, so it mirrors
  // around the parent world svg's origin and throws the element thousands of units off-screen.
  // An SVG-space <g transform> keeps the mirror inside the element's own box.
  function mirrorNested(nested) {
    const vb = (nested.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some(isNaN)) return;
    const g = mk('g', { transform: `translate(${2 * vb[0] + vb[2]} 0) scale(-1 1)` });
    while (nested.firstChild) g.appendChild(nested.firstChild);
    nested.appendChild(g);
  }
    function placeBoulder(id, x, yTop, w, h, src, opts) {
      opts = opts || {};
      const { svg: nested } = placeSvg(fgItemSvg(x, yTop, w, h), id, x, yTop, w, h, (d) => {
        if (window.SceneComponents && window.SceneComponents.buildBoulderGrass) {
          window.SceneComponents.buildBoulderGrass(d, src, opts.season || 'summer');
        }
      });
      if (opts.flipped) mirrorNested(nested);
      return nested;
    }
    const boulderInstances = [
      // Two rock outcrops framing open water, not one wall of rocks. y values match the measured
      // top edge of the real terrain / foreground band. Shore-side left cluster:
      placeBoulder('boulder1', -100, 2050, 500, 393, 'assets/boulder-grass-0_0.svg'),
      placeBoulder('boulder2', 250,  2100, 400, 327, 'assets/boulder-grass-1_1.svg'),
      // No boulders on the right: right-shore.svg already carries its own rocks along that shore.
      // These two sit further out in the water (deeper y) so they read as rocks poking out of the
      // lake; plant3/plant5 cluster around them.
      placeBoulder('boulder6', 750,  2280, 340, 266, 'assets/boulder-grass-1_1.svg'),
      placeBoulder('boulder7', 1080, 2360, 260, 203, 'assets/boulder-grass-0_0.svg', { flipped: true }),
    ];
    window.__boulderInstances = boulderInstances;

    // Foreground plants, grouped alongside the boulder clusters above.
    function placePlant(id, x, yTop, w, h, src, opts) {
      opts = opts || {};
      const { svg: nested } = placeSvg(fgItemSvg(x, yTop, w, h), id, x, yTop, w, h, (d) => {
        if (window.SceneComponents && window.SceneComponents.buildForegroundPlant) {
          window.SceneComponents.buildForegroundPlant(d, src, opts.season || 'summer');
        }
      });
      if (opts.flipped) mirrorNested(nested);
      return nested;
    }
    // Placement rules: the fern and agave (aloe) are not rock plants, so they stay on grass (the
    // left shore or the hero tree's foreground); only the reeds and spiky yucca sit by the rocks.
    // plant2 sits right of the hero-copy text column; further left it hides behind the text panel.
    const plantInstances = [
      // On leftShore's own grass, above the boulder/water tier.
      placePlant('plant2', 1350, 1550, 320, 320, 'assets/fg-plant-agave.svg'),
      // Foreground, tucked beside the hero tree's flower cluster.
      placePlant('plant1', 3300, 3050, 220, 220, 'assets/fg-plant-fern.svg'),
      placePlant('plant6', 4250, 3040, 140, 140, 'assets/fg-plant-agave.svg', { flipped: true }),
      // Left cluster, near lagoonBankLeft / boulder1-2 (shore-side, shallow).
      placePlant('plant4', 350,  2030, 110, 116, 'assets/fg-plant-yellow-flower-stem.svg'),
      // Second left cluster, around boulder6/7 out in the open water: a clump of reeds at the
      // rock's foot (it replaced the rounded bush, which didn't read as a lake plant).
      placePlant('plant3', 690,  2250, 360, 336, 'assets/fg-plant-reeds.svg'),
      placePlant('plant5', 1150, 2420, 130, 130, 'assets/fg-plant-spiky-yucca.svg', { flipped: true }),
    ];
    window.__plantInstances = plantInstances;

    // Isolated hero tree. The sway pivot is an explicit CSS transform-origin with transform-box:
    // fill-box, since the border-box default behaves differently inside a foreignObject.
    // Anchor math: object-fit:'fill' stretches the whole 8192x1298 source across a box much wider than
    // VW, and only the slice inside 0..VW is visible. Which part of the source shows depends on box_x
    // and box_w TOGETHER, so scaling width and shifting x by half the added width slides the visible
    // window (the tree jumps to frame center). Instead, solve box_x so the same source point stays
    // anchored at the viewport's right edge, and box_y against the source's ground line.
    (function placeHeroTree() {
      const srcW = 8192, srcH = 1298; // native viewBox of the source art
      const oldX = 952.9, oldY = 103.25, oldW = 12369.92, oldH = 1959.98;
      // Size relative to the original box; change only this multiplier, not the anchor formula.
      const scale = 1.3;
      const newW = oldW * scale, newH = oldH * scale;
      // Source-x that currently lands at the viewport's right edge (VW) --
      // keep that same source point anchored there after scaling up.
      const anchorSourceX = (VW - oldX) / oldW * srcW;
      let newX = VW - (anchorSourceX / srcW) * newW;
      // Flat offset past the right-edge anchor: intentionally crops the tree's right side/canopy at
      // the frame edge so it reads as close foreground.
      // Sept 24: 500 -> 850 to open up more of the right bank (the tent sits there). Squirrel,
      // fox and the canopy tap spot in wildlife.js moved +350 with it (HERO_DX there).
      const rightShift = 1100;   // Sept 25: 850 -> 1100 to give the tent room on the bank
      newX += rightShift;
      // World y of the tree's ground line, kept well below the bank cluster so the tree reads as
      // foreground, not part of the mid-ground banks. flowerDefs y values are relative to this.
      const newBottomAnchor = 3150;
      const newY = newBottomAnchor - newH;
      // Own layer; the sway rotates the layer div (GPU) about the same pivot the image used.
      // The image box is ~3x the world's width (only a slice of the source shows), so the layer
      // is cropped to the world plus a margin: a 16000-unit-wide layer cost a lot of memory on
      // iPhone. The pivot stays the same world point (24.4% / 82.8% of the full image box).
      const cx0 = Math.max(newX, -300), cx1 = Math.min(newX + newW, VW + 300);
      const pivotX = newX + 0.244 * newW;
      const treeLayer = fgLayer(cx0, newY, cx1 - cx0, newH, 'tree-isolated-sway');
      treeLayer.id = 'isoTree';
      treeLayer.style.transformOrigin = `${((pivotX - cx0) / (cx1 - cx0) * 100).toFixed(3)}% 82.8%`;
      const isoTree = treeLayer;
      const treeSvg = fgItemSvgIn(treeLayer, cx0, newY, cx1 - cx0, newH);
      treeSvg.style.overflow = 'hidden';
      placeImage(treeSvg, 'isoTreeImg', newX, newY, newW, newH,
        'assets/landscape-hills-scenic-green-isolated-tree.svg');
      isoTree.style.setProperty('--dur', '6.2s');
      isoTree.style.setProperty('--delay', '0.4s');
    })();
    window.__heroTree = null;

    // Seasonal flowers: flowerSvg is its own viewBox="0 0 VW VH" svg, a direct child of the
    // plate (not foreignObject-wrapped), since it already matches the shared world system.
    // Own tight layer (see fgLayer): the flowers nod, so they shouldn't repaint anything else.
    const flowerSvg = fgItemSvg(3200, 2600, 1200, 700);
    flowerSvg.id = 'flowerSvg';
    const FLOWER_SEASON_COLS = {
      spring: ['#e85fa0', '#d94b8a', '#f07ab0'],
      summer: ['#d64b4b', '#e0552f', '#c8382a'],
      fall:   ['#d4822a', '#c8a020', '#b86818'],
      winter: ['#8a9898', '#7a8888', '#6a7878'],
    };
    // Flowers sit under the hero tree so their seasonal recolor pairs with its foliage. y values
    // are ground level relative to the tree's newBottomAnchor (3150): stem bases must land inside the
    // hill's grass, with only the bloom rising above the hill line.
    // variant cycles round/daisy/cup so they read as different plants (see makeFlower in
    // components.js).
    const flowerDefs = [
      { x: 3620, y: 3040, h: 200, variant: 0 },
      { x: 3820, y: 3090, h: 170, variant: 1 },
      { x: 3480, y: 3120, h: 220, variant: 2 },
      { x: 3980, y: 3060, h: 185, variant: 1 },
      { x: 4120, y: 3030, h: 160, variant: 0 },
    ];
    const { makeFlower } = window.SceneComponents || {};
    const flowerEls = [];
    if (makeFlower) {
      flowerDefs.forEach(({ x, y, h, variant }) => {
        // tier: 'mobile' (always visible) -- the 'd' tier hides these flowers below 1024px.
        const f = makeFlower({ x, y, h, color: '#d64b4b', tier: 'mobile', variant });
        f.style.transition = 'opacity 0.7s linear';
        f.querySelectorAll('.petal-base,.petal-highlight').forEach(e => e.style.transition = 'fill 0.7s linear');
        flowerSvg.appendChild(f);
        flowerEls.push(f);
      });
    }
    window.__updateFlowers = function(season) {
      const cols = FLOWER_SEASON_COLS[season] || FLOWER_SEASON_COLS.summer;
      const isWinter = season === 'winter';
      flowerEls.forEach((f, i) => {
        const col = cols[i % cols.length];
        // setColor() re-derives the highlight tone from the new base color
        // so the two-tone shading stays consistent across season crossfades.
        if (f.setColor) f.setColor(col);
        f.style.opacity = isWinter ? '0.3' : '1';
      });
    };
    window.__foliageSvg = flowerSvg;

    // ── SWAY ON THE GPU ────────────────────────────────────────────────────────────────
    // Boulder grass, plants and flowers sway with CSS on SVG groups, which Safari can only do by
    // repainting on the CPU every frame (the biggest Safari cost in ?bench). So each swaying
    // group is lifted into its own layer div (same box, same coordinates) and the DIV rotates,
    // which the GPU does for free. Content drawn after the group (the painterly glow, later
    // flowers) moves to a third layer above it, so stacking order is unchanged.
    // Runs after the painterly pass (queued earlier), so the glow's clip copies still match.
    queueMicrotask(function liftSways() {
      const items = Array.from(fgFrame.querySelectorAll('.grass-clump-sway, .flower-nod'));
      if (!items.length) return;
      const kind = e => e.classList.contains('flower-nod') ? 'flower-nod' : 'grass-clump-sway';
      const kinds = items.map(kind);
      items.forEach((e, i) => e.classList.remove(kinds[i]));   // measure unrotated
      const jobs = items.map((e, i) => {
        const r = e.getBoundingClientRect();
        const d = e.closest('.fg-layer').getBoundingClientRect();
        let flipped = false;
        for (let a = e.parentNode; a && a.tagName !== 'DIV'; a = a.parentNode) {
          if (/scale\(\s*-1/.test(a.getAttribute && a.getAttribute('transform') || '')) flipped = !flipped;
        }
        return { e, k: kinds[i], flipped, ok: r.width > 0 && d.width > 0 && d.height > 0,
          ox: (r.left + r.width / 2 - d.left) / d.width * 100, oy: (r.bottom - d.top) / d.height * 100 };
      });
      const shallow = n => { const c = n.cloneNode(false); if (c.removeAttribute) c.removeAttribute('id'); return c; };
      jobs.forEach(({ e: swayEl, k, flipped, ok, ox, oy }) => {
        if (!ok) { swayEl.classList.add(k); return; }   // not laid out (hidden): keep the SVG sway
        // A flower moves as its whole <g class="flower"> (its setColor/opacity hooks live there).
        const e = k === 'flower-nod' ? (swayEl.closest('.flower') || swayEl) : swayEl;
        const layer = e.closest('.fg-layer');
        const root = layer.firstElementChild;       // the layer's <svg>
        const path = [];                             // root ... e.parent
        for (let a = e.parentNode; a !== layer; a = a.parentNode) path.unshift(a);
        const mkLayer = () => { const d = layer.cloneNode(false); d.removeAttribute('id');
          d.className = 'fg-layer'; d.style.transformOrigin = ''; return d; };
        // Layer 2: the swaying group alone, inside copies of its ancestors.
        const d2 = mkLayer();
        let tip = d2;
        path.forEach(a => { const c = shallow(a); tip.appendChild(c); tip = c; });
        // Layer 3: everything drawn after the group, at each ancestor level.
        const d3 = mkLayer();
        const chain3 = [];
        let t3 = d3;
        path.forEach(a => { const c = shallow(a); t3.appendChild(c); t3 = c; chain3.push(c); });
        let moved = 0;
        for (let lvl = path.length - 1, child = e; lvl >= 0; child = path[lvl], lvl--) {
          let sib = child.nextSibling;
          while (sib) { const next = sib.nextSibling; chain3[lvl].appendChild(sib); moved++; sib = next; }
        }
        tip.appendChild(e);
        d2.classList.add(k === 'flower-nod' ? 'sway-flower' : (flipped ? 'sway-grass-mirror' : 'sway-grass'));
        d2.style.transformOrigin = `${ox.toFixed(3)}% ${oy.toFixed(3)}%`;
        ['--dur', '--delay'].forEach(v => { const x = swayEl.style.getPropertyValue(v); if (x) d2.style.setProperty(v, x); });
        layer.after(d2);
        if (moved) d2.after(d3);
      });
    });
  })();

  // ── 7. LIGHTING + RENDER LOOP ─────────────────────────────────────────────
  const LIGHT = { tod: 0.4, dim: 0 };
  const SKIES = {
    night: ['#080e22', '#0f1a38', '#1a2a52'],
    dawn:  ['#1e2d6b', '#7a5a9a', '#f0a060'],
    noon:  ['#3a80cc', '#7ab8e0', '#c8e8f4'],
    dusk:  ['#1a2255', '#8a4070', '#e06030'],
  };
  function skyStops(tod) {
    let a, b, t;
    if      (tod < 0.25) { a='night'; b='dawn';  t=tod/0.25; }
    else if (tod < 0.50) { a='dawn';  b='noon';  t=(tod-0.25)/0.25; }
    else if (tod < 0.75) { a='noon';  b='dusk';  t=(tod-0.5)/0.25; }
    else                 { a='dusk';  b='night';  t=(tod-0.75)/0.25; }
    return [0,1,2].map(i => mix(SKIES[a][i], SKIES[b][i], t));
  }

  let __frameCount = 0;
  // PERF: render() only redraws when its inputs change, and the heavy part (colour grading of
  // the big plates, sky and lake) is written at most ~20 times a second while it animates
  // (season changes, day/night). Every grade write makes the browser re-filter whole plates,
  // which was the main season-change cost on big-screen Macs; 20 steps a second over a
  // multi-second fade isn't visible. The final state is always written once things settle.
  let __renderKey = '', __gradeKey = '', __gradeT = -1e9;
  const GRADE_MIN_MS = 50;
  function render(now) {
    now = now || performance.now();
    window.__frameCount = ++__frameCount;
    const { tod, dim } = LIGHT;
    const tw = TWEEN ? `${TWEEN.a},${TWEEN.b},${TWEEN.p.toFixed(4)},${TWEEN.mc.toFixed(4)}` : '';
    const key = `${tod.toFixed(4)}|${dim.toFixed(4)}|${s}|${tw}|${window.__moonEligible}|${window.__moonDip}`;
    const gradeDue = key !== __gradeKey && (now - __gradeT >= GRADE_MIN_MS);
    if (key === __renderKey && !gradeDue) return;
    __renderKey = key;
    if (gradeDue) { __gradeKey = key; __gradeT = now; }

    if (gradeDue) {
    // ── sky gradient: tod-based colour × season shift ───────────────────────
    // dim darkens the sky for the night-mode season-change dip; the coefficient and dim's peak
    // (see moonDip) are sized so it reads clearly over the night baseline.
    const d = 1 - dim * 0.45;
    const dk = c => { const a=hx(c); return rgb([a[0]*d, a[1]*d, a[2]*d]); };
    const skyS = skyStops(tod);
    // Tint the sky stops toward the season palette (gentle blend, 20% season influence)
    const st = 0.20;
    const sTop  = mix(skyS[0], kfc(s, GRADE.sky0), st);
    const sMid  = mix(skyS[1], kfc(s, GRADE.sky1), st);
    const sHori = mix(skyS[2], kfc(s, GRADE.sky2), st);
    sky.style.background = `linear-gradient(180deg, ${dk(sTop)} 0%, ${dk(sMid)} 52%, ${dk(sHori)} 100%)`;

    // ── land brightness from tod (shared base for all layers) ─────────────
    let lbri = 1;
    if      (tod < 0.25) { const t=tod/0.25;        lbri=lerp(.50,.85,t); }
    else if (tod < 0.50) { const t=(tod-0.25)/0.25; lbri=lerp(.85,1,t);  }
    else if (tod < 0.75) { const t=(tod-0.5)/0.25;  lbri=lerp(1,.85,t);  }
    else                 { const t=(tod-0.75)/0.25;  lbri=lerp(.85,.50,t);}
    lbri *= (1 - dim * 0.4);

    // ── per-layer filter: tod brightness × season colour grade ─────────────
    // Memoised per frame: ~20 elements ask for the same few grades each frame.
    const gradeCache = {};
    function layerFilter(gradeKey) {
      if (!gradeCache[gradeKey]) gradeCache[gradeKey] = `brightness(${lbri.toFixed(3)}) ${interpFilter(s, GRADE[gradeKey])}`;
      return gradeCache[gradeKey];
    }

    // Grade layers (see gradeLayer): one CSS filter per layer, set only when it changes.
    const folFilter = layerFilter('foliage');
    setLayerFilter($('bgFoothills'), layerFilter('mtn'));
    // The mountain range bakes per-season colour into its fills (components.js), so it only
    // takes tod brightness; the full mtn grade on top would double up.
    setLayerFilter($('bgMountains'), `brightness(${lbri.toFixed(3)})`);
    // Clouds: lbri plus a dim-driven desaturate + cool hue-rotate so the pale palette reads as
    // moonlit (a bare brightness cut barely shows on it).
    setLayerFilter($('plateClouds'), `brightness(${lbri.toFixed(3)}) saturate(${(1 - dim * 0.2).toFixed(3)}) hue-rotate(${(dim * 10).toFixed(1)}deg)`);
    setLayerFilter($('mgTreeline'), folFilter);
    // Reflection shares the treeline's grade (it's a mirror of it) and sits with the shores.
    setLayerFilter($('mgShores'), folFilter);
    setLayerFilter($('mgTrees'), folFilter);
    // Foreground band, boulders, plants, hero tree and flowers: the whole plate, one filter.
    setLayerFilter($('plateForeground'), folFilter);
    setLayerFilter($('isoTree'), interpFilter(s, GRADE.heroTree));
    // Lake: colour computed straight into the gradient stops (no filter at all), with the same
    // linearRGB maths the tuned SVG filter used, so the reference-photo calibration holds.
    const lakeFilter = layerFilter('lake');
    if (window.__waterStops && window.__lakeFilterStr !== lakeFilter) {
      window.__lakeFilterStr = lakeFilter;
      const toks = parseCssFilterTokens(lakeFilter);
      const n = window.__waterStops.length - 1;
      window.__waterStops.forEach((st, i) => st.setAttribute('stop-color', lakeColour(mix('#cfe8f7', '#a8d4ec', i / n), toks)));
    }
    }

    // Lake amp for water shimmer wiring
    window.__lakeAmp = kf(s, [0.60, 0.90, 1.00, 1.40]);
    // Map amp (0.6 winter -> 1.4 fall) onto the shimmer's 0-3 wind range as a FLOAT, not rounded:
    // setWind interpolates scale continuously, so a smooth value is what makes wind ease.
    if (window.__waterAPI) {
      const lvl = Math.max(0, Math.min(3, (window.__lakeAmp - 0.6) / 0.8 * 3));
      window.__waterAPI.setWind(lvl);
    }


    // ── celestial: sun + moon arcs ─────────────────────────────────────────
    const sunUp  = Math.sin(Math.max(0, Math.min(1, (tod-0.22)/0.56)) * Math.PI);
    const sunOp  = Math.max(0, Math.min(1, sunUp * 1.4));
    const sunArc = Math.sin(Math.max(0, Math.min(1, (tod-0.22)/0.56)) * Math.PI);
    sunBody.setAttribute('transform', `translate(${(VW*0.72).toFixed(0)} ${(VH*(0.62-0.28*sunArc)).toFixed(0)})`);
    sunBody.setAttribute('opacity', sunOp.toFixed(2));

    let moonP = -1;
    if (tod >= 0.75) moonP = (tod - 0.75) / 0.5;
    else if (tod < 0.25) moonP = (tod + 0.25) / 0.5;
    if (moonP >= 0) {
      const moonArc = Math.sin(moonP * Math.PI);
      // Moon shows only in night mode (window.__moonEligible, set by travel()/toggleNightMode);
      // defaults to 1 when unset (tod still hides it by day).
      const moonGate = window.__moonEligible != null ? window.__moonEligible : 1;
      // window.__moonDip (1 at rest, 0 at the darkest point of a night-mode tab transition)
      // drops the moon toward the 0.62 horizon baseline and fades it, so it visibly sets rather
      // than flickers. tod can't drive this: in night mode it barely moves.
      const moonDip = window.__moonDip != null ? window.__moonDip : 1;
      const moonY = VH * (0.62 - 0.28 * moonArc * moonDip);
      moonBody.setAttribute('transform', `translate(${(VW*0.72).toFixed(0)} ${moonY.toFixed(0)})`);
      moonBody.setAttribute('opacity', (Math.max(0, Math.min(1, moonArc*1.5)) * moonGate * moonDip).toFixed(2));
    } else {
      moonBody.setAttribute('opacity', '0');
    }

    // ── aurora + stars: night mode only (aurora bands winter/fall only) ────
    // Stars and aurora use separate gates. auroraSvg (and starField inside it) follows the night
    // gate only, so every season gets stars at night; auroraBands additionally need the
    // winter/fall season gate. Stars must not inherit the aurora's season gate.
    // nightGate falls back to 0 (not 1 like the moon): the moon also has tod hiding it by day,
    // aurora/stars have no second safety net, so an unset gate must mean invisible.
    if (window.__auroraSvg) {
      const auroraSeasonGate = kf(s, [1, 0, 0, 1]); // winter, spring, summer, fall
      const nightGate = window.__moonEligible != null ? window.__moonEligible : 0;
      window.__auroraSvg.style.opacity = nightGate.toFixed(2);
      // Fully hidden by day: display:none also stops the ~90 star twinkle animations.
      const hideSky = nightGate < 0.005;
      if (window.__auroraSvg.__hidden !== hideSky) { window.__auroraSvg.style.display = hideSky ? 'none' : ''; window.__auroraSvg.__hidden = hideSky; }
      // Tent light: on with the night (same gate as the stars), hidden entirely by day.
      if (window.__tentNight) { const T = window.__tentNight, o = nightGate.toFixed(2);
        if (T.__o !== o) { T.style.opacity = o; T.style.display = nightGate < 0.005 ? 'none' : ''; T.__o = o; } }
      if (window.__auroraBands) { const B = window.__auroraBands; B.style.opacity = auroraSeasonGate.toFixed(2);
        const off = auroraSeasonGate < 0.005; if (B.__off !== off) { B.style.display = off ? 'none' : ''; B.__off = off; } }
      // Shooting stars: spring/summer counterpart to the aurora. A gate read by the spawn
      // scheduler in buildAurora(), not a container opacity, since streaks are one-shot spawns.
      window.__shootingStarGate = kf(s, [0, 1, 1, 0]); // winter, spring, summer, fall
    }
    // Fish jumps: spring/summer, day or night. Read by the spawn scheduler in buildMidground().
    window.__fishJumpGate = kf(s, [0, 1, 1, 0]); // winter, spring, summer, fall
  }

  // Main rAF loop
  function mainLoop(now) {
    render(now);
    if (window.__updateClouds) window.__updateClouds(now);
    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);

  // PAGE-LOAD REVEAL (one time only). Transform/opacity/delay values live in scene.css
  // ("PAGE-LOAD REVEAL"). Runs here, after every plate-building IIFE, so the reveal plays over a
  // finished scene. Double rAF: the pre-reveal state must be painted once first, or adding
  // `.scene-loaded` in the same tick can coalesce both states into one paint with no transition.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const core = $('sceneCore');
      if (core) core.classList.add('scene-loaded');
    });
  });

  // Add ?fps to the URL for a small frame-rate readout (any device, incl. phones). Off otherwise.
  if (/[?&]fps\b/.test(location.search)) {
    const hud = document.createElement('div');
    hud.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;font:12px/1.3 monospace;background:rgba(0,0,0,.7);color:#8f8;padding:4px 8px;border-radius:4px;pointer-events:none';
    document.body.appendChild(hud);
    let n = 0, slow = 0, t0 = performance.now(), prev = t0;
    const f = (t) => { n++; if (t - prev > 34) slow++; prev = t;
      if (t - t0 >= 1000) { hud.textContent = `${Math.round(n * 1000 / (t - t0))} fps · ${slow} slow`; n = 0; slow = 0; t0 = t; }
      requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }

  window.LIGHT = LIGHT;
  window.setTOD = v => { LIGHT.tod = v; render(); };
  window.setDim = v => { LIGHT.dim = v; render(); };
  window.play  = () => {
    let running = true;
    (function t(now) { LIGHT.tod = (LIGHT.tod + 0.0008) % 1; if (running) requestAnimationFrame(t); })();
    window.pause = () => { running = false; };
  };

  const seasonNames = { 0:'winter', 1:'spring', 2:'summer', 3:'fall' };

  // Keeps #clockLabel (static "Spring" in the markup) in sync with the active season.
  // Called from setSeason() and the "play the whole year" loop.
  function updateClockLabel(season) {
    const clockLabel = $('clockLabel');
    if (!clockLabel) return;
    const sName = seasonNames[season] || 'spring';
    clockLabel.textContent = sName.charAt(0).toUpperCase() + sName.slice(1);
  }

  // ── 8. GENERATED TREES ───────────────────────────────────────────────────────
  (function buildTrees() {
    if (!window.SceneComponents) return;
    const { makeDetailedPine, makeFlower } = window.SceneComponents;

    // ── LAYER ORDER STRATEGY ──────────────────────────────────────────────
    // plateMidground: pines + deciduous, sitting on the grass banks.

    const mg = gradeLayer('plateMidground', 'mgTrees');
    // World-sized frame (same sizing as every world svg), but an HTML div: each pine is its own
    // small <svg> in its own div, and the SWAY is a CSS rotation of that div. HTML transforms run
    // on the compositor, so swaying no longer repaints all six pines (~320 paths) every frame.
    const treeOverlay = registerWorldSvg(Object.assign(document.createElement('div'), { id: 'generatedTrees' }));
    treeOverlay.style.cssText += ';position:absolute;left:0;bottom:0;width:100%;pointer-events:none';
    mg.appendChild(treeOverlay);

    // ── PINE POSITIONS ────────────────────────────────────────────────────
    // Grounded on the banks' ridgeline (banks moved up 250 world units to open more water, so
    // pines moved up with them). Keep them on the bank top, never over water or in the air.
    // Stay clear of the hero wave-mask boundary (~y2735). Foreground boulders/plants
    // (buildForeground) are deliberately NOT shifted: they sit at the water's edge.
    const pines = [
      // Banks are independent objects (leftShore/rightShore), so each cluster tunes freely.
      // Trunk bases sit well inside the light grass (Sept 24: right-bank trunks had been on the
      // dark bush line at the back of the bank).
      { x: 0,    y: 1760, scale: 0.24 },
      { x: 300,  y: 1805, scale: 0.26 },
      { x: 600,  y: 1790, scale: 0.20 },
      { x: 3000, y: 1628 + 185, scale: 0.19 },
      { x: 3290, y: 1640 + 185, scale: 0.21 },
      { x: 3610, y: 1636 + 185, scale: 0.17 },
    ];

    // Pine art bounds (art units, measured; padded) and trunk base (see makeDetailedPine).
    const ART = { x0: 690, y0: 140, x1: 3310, y1: 3830 }, BASE_X = 1916, BASE_Y = 3784;
    const box = p => ({ x0: p.x + (ART.x0 - BASE_X) * p.scale, y0: p.y + (ART.y0 - BASE_Y) * p.scale,
                        x1: p.x + (ART.x1 - BASE_X) * p.scale, y1: p.y + (ART.y1 - BASE_Y) * p.scale });
    const div = (attrs, parent) => { const e = document.createElement('div');
      for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
    const pct = (v, of) => (v / of * 100).toFixed(4) + '%';
    const place = (d, b, fw, fh) => Object.assign(d.style, { position: 'absolute',
      left: pct(b.x0 - fw.x0, fw.x1 - fw.x0), top: pct(b.y0 - fw.y0, fh), 
      width: pct(b.x1 - b.x0, fw.x1 - fw.x0), height: pct(b.y1 - b.y0, fh) });

    // Two side-cluster divs so responsive CSS (scene.css) can nudge/scale one element per side.
    // Each cluster div's box is the union of its pines' boxes (what transform-box:fill-box gave
    // the old <g> clusters), so the translate %/origin rules behave the same.
    const clusters = [pines.filter(p => p.x < VW / 2), pines.filter(p => p.x >= VW / 2)];
    const world = { x0: 0, y0: 0, x1: VW, y1: VH };
    window.__pineInstances = [];
    const pineSeats = [];
    clusters.forEach((group, ci) => {
      const bs = group.map(box);
      const cb = { x0: Math.min(...bs.map(b => b.x0)), y0: Math.min(...bs.map(b => b.y0)),
                   x1: Math.max(...bs.map(b => b.x1)), y1: Math.max(...bs.map(b => b.y1)) };
      const cdiv = div({ class: 'pine-cluster ' + (ci ? 'pine-cluster-right' : 'pine-cluster-left') }, treeOverlay);
      place(cdiv, cb, world, VH);
      const cw = { x0: cb.x0, x1: cb.x1 };
      group.forEach((p, i) => {
        const b = bs[i];
        const pdiv = div({ class: 'pine-detailed-sway pine-layer' }, cdiv);
        place(pdiv, { x0: b.x0 - cb.x0, y0: b.y0 - cb.y0, x1: b.x1 - cb.x0, y1: b.y1 - cb.y0 }, { x0: 0, y0: 0, x1: cb.x1 - cb.x0 }, cb.y1 - cb.y0);
        pdiv.style.transformOrigin = `${pct(p.x - b.x0, b.x1 - b.x0)} ${pct(p.y - b.y0, b.y1 - b.y0)}`;
        pdiv.style.setProperty('--dur', (4.5 + Math.random() * 2).toFixed(1) + 's');
        pdiv.style.setProperty('--delay', (Math.random() * 2).toFixed(1) + 's');
        const svg = mk('svg', { viewBox: `${b.x0} ${b.y0} ${b.x1 - b.x0} ${b.y1 - b.y0}`, preserveAspectRatio: 'none',
          style: 'position:absolute;inset:0;width:100%;height:100%;overflow:visible' }, pdiv);
        // tier:'mobile' is required: makeDetailedPine defaults to tier:'d' (desktop-only), and
        // [data-tier="d"] is display:none at <=1024px. sway:false: the div sways, not the <g>.
        const tree = makeDetailedPine({ ...p, season: 'spring', tier: 'mobile', sway: false });
        tree.id = 'pineArt' + window.__pineInstances.length;   // referenced by the lake reflections
        svg.appendChild(tree);
        window.__pineInstances.push(tree);
        // Zero-size marker at the trunk base (= the sway pivot, so rotation never moves it).
        const mark = div({ class: 'pine-base' }, pdiv);
        mark.style.cssText = `position:absolute;width:0;height:0;left:${pdiv.style.transformOrigin.split(' ')[0]};top:${pdiv.style.transformOrigin.split(' ')[1]}`;
        pineSeats.push({ pdiv, mark, shoreId: ci ? 'rightShore' : 'leftShore' });
      });
    });

    // ── MARLEY & ME: THE TENT ON THE RIGHT BANK ─────────────────────────────────────────
    // assets/tent-scene.svg (Christian's tent-vector.svg cropped to its art: viewBox 290 410 4230 1912)
    // sits on the open grass past the 3rd right-bank pine (opened up by moving the hero tree), inside
    // #mgTrees so it takes the same season/night grade as the pines. An <img>: the browser
    // rasterises it once and caches it (the art has gradients and clips, so no inline SVG).
    // At night a warm light is on inside: a glow clipped to the tent's own shape (mask = the same
    // image), a flickering halo on the lantern and a soft pool of light on the grass. Those live in
    // their own frame just above #mgTrees so the night grade doesn't darken them.
    {
      const TENT = { x: 3990, floorY: 1772, w: 400 };   // Sept 25: up on the grass, not at the water's edge             // world units; floor = tent's base line
      const VB = [290, 410, 4230, 1912], FLOOR_ART = 2090;        // art units (tent floor line in the art)
      const k = TENT.w / VB[2], h = VB[3] * k;
      const box = { x0: TENT.x - TENT.w / 2, y0: TENT.floorY - (FLOOR_ART - VB[1]) * k, w: TENT.w, h };
      const place = (el, b) => Object.assign(el.style, { position: 'absolute', left: pct(b.x0, VW), top: pct(b.y0, VH),
        width: pct(b.w, VW), height: pct(b.h, VH) });
      const tent = document.createElement('div');
      tent.className = 'scene-tent';
      place(tent, box);
      const img = document.createElement('img');
      img.src = 'assets/tent-scene.svg'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
      tent.appendChild(img);
      treeOverlay.appendChild(tent);                                // after the pine clusters: in front
      // Night light (ungraded frame right after #mgTrees).
      const glowFrame = registerWorldSvg(Object.assign(document.createElement('div'), { className: 'tent-night' }));
      glowFrame.style.cssText += ';position:absolute;left:0;bottom:0;width:100%;pointer-events:none';
      mg.parentNode.insertBefore(glowFrame, mg.nextSibling);
      const at = (ux, uy) => [((ux - VB[0]) / VB[2] * 100).toFixed(2) + '%', ((uy - VB[1]) / VB[3] * 100).toFixed(2) + '%'];
      const inner = document.createElement('div');
      place(inner, box);
      const canvasGlow = document.createElement('div'); canvasGlow.className = 'tent-glow';
      const [dx, dy] = at(1520, 1760);                              // just inside the front flap
      canvasGlow.style.setProperty('--gx', dx); canvasGlow.style.setProperty('--gy', dy);
      const lamp = document.createElement('div'); lamp.className = 'tent-lamp';
      const [lx, ly] = at(1950, 2005);                              // the lantern's glass
      lamp.style.left = lx; lamp.style.top = ly;
      const spill = document.createElement('div'); spill.className = 'tent-spill';
      const [sx, sy] = at(1850, 2140);
      spill.style.left = sx; spill.style.top = sy;
      inner.append(canvasGlow, spill, lamp);
      glowFrame.appendChild(inner);
      window.__tentNight = glowFrame;
    }

    // ── BANK + PINE REFLECTIONS ─────────────────────────────────────────────────────────
    // Each bank and its pines mirrored in the lake below it: still (no sway), faint, fading out
    // downward, the way the far treeline's reflection already reads. They are <use> copies of the
    // live art, so seasons carry over for free (pine colours, bank grade), and they are painted
    // into the existing #mgShores layer, before the shores, so each bank covers its own mirror on
    // dry land and the lake shimmer runs over them. No new layer and nothing animated; a small
    // static ripple and blur (bankReflSoft) keep them soft. Kept faint on purpose: less is more.
    {
      const shoresG = document.getElementById('shoresGraded');
      if (shoresG) {
        const host = shoresG.parentNode, NS = 'http://www.w3.org/2000/svg';
        // Waterline per bank as a straight line y = a + b*x (measured on the shore art: the left
        // bank drops ~36 units from its tip to the left edge). The mirror is about THAT line, so
        // every column reflects about its own water's edge and the reflection meets the bank
        // along its whole length (a flat axis left a wedge of bare water at the left tip).
        // Mirror about a sloped line, column by column: y' = 2(a + b*x) - y  ->  matrix(1, 2b, 0, -1, 0, 2a).
        const REFL = [
          { a: 1868, b: -0.0215, x0: -200, x1: 1760, len: 230, peak: 0.2, shore: 'leftShore', pines: [0, 1, 2] },
          { a: 1846, b: -0.0045, x0: 2650, x1: 5200, len: 230, peak: 0.2, shore: 'rightShore', pines: [3, 4, 5] },
        ];
        const defs = mk('defs', {}, host);
        host.insertBefore(defs, shoresG);
        // Shared soften: a gentle static ripple (horizontal only) then a small blur. Drawn once,
        // nothing animates; it only re-rasterises when this layer repaints.
        const flt = mk('filter', { id: 'bankReflSoft', x: '-5%', y: '-10%', width: '110%', height: '130%' }, defs);
        mk('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.0015 0.045', numOctaves: 1, seed: 3, result: 'n' }, flt);
        mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 16, xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }, flt);
        mk('feGaussianBlur', { in: 'd', stdDeviation: '3 1.5' }, flt);
        REFL.forEach((r, i) => {
          const gid = 'bankReflGrad' + i, mid = 'bankReflMask' + i;
          // The mask sits INSIDE the flip, i.e. in the bank's own (unflipped) space: full strength
          // at the waterline, fading out going up the bank (= down the reflection).
          const yw = r.a + r.b * (r.x0 + r.x1) / 2;
          const grad = mk('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: yw, x2: 0, y2: yw - r.len }, defs);
          mk('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': r.peak }, grad);
          mk('stop', { offset: 0.5, 'stop-color': '#fff', 'stop-opacity': (r.peak * 0.35).toFixed(3) }, grad);
          mk('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, grad);
          const mask = mk('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: r.x0, y: yw - r.len - 60, width: r.x1 - r.x0, height: r.len + 120 }, defs);
          mk('rect', { x: r.x0, y: yw - r.len - 60, width: r.x1 - r.x0, height: r.len + 120, fill: `url(#${gid})` }, mask);
          const outer = mk('g', { class: 'bank-reflection', filter: 'url(#bankReflSoft)' }, host);
          host.insertBefore(outer, shoresG);
          const flip = mk('g', { transform: `matrix(1 ${(2 * r.b).toFixed(4)} 0 -1 0 ${2 * r.a})` }, outer);
          const masked = mk('g', { mask: `url(#${mid})` }, flip);
          [r.shore, ...r.pines.map(n => 'pineArt' + n)].forEach(id => {
            const u = document.createElementNS(NS, 'use');
            u.setAttribute('href', '#' + id);
            masked.appendChild(u);
          });
        });
      }
    }

    // ── KEEP PINES ON THE BANK ─────────────────────────────────────────────────────────
    // Below 1024px the clusters are nudged inward and scaled up (scene.css), which lifted some
    // trunks off the sloping banks. After layout (and on resize) each pine's base is checked
    // against the actual bank shape under it (isPointInFill on the shore art) and, only if it
    // floats, the pine is lowered with the CSS `translate` property (independent of the sway).
    function seatPines() {
      pineSeats.forEach(({ pdiv, mark, shoreId }) => {
        pdiv.style.translate = '';
        const shore = document.getElementById(shoreId);
        if (!shore) return;
        // Solid land shapes only: not the painterly glow rects, not defs/clip shapes, and not the
        // translucent water-highlight shapes some shore art carries.
        const paths = Array.from(shore.querySelectorAll('path,polygon,rect,ellipse,circle'))
          .filter(el => typeof el.isPointInFill === 'function' && !el.closest('.paint-glow,defs,clipPath,mask'))
          .filter(el => { const cs = getComputedStyle(el);
            return cs.fill !== 'none' && +cs.opacity >= 0.9 && +cs.fillOpacity >= 0.9; });
        const m = mark.getBoundingClientRect();
        if (!m.width && !m.left && !m.top) return;
        const filledAt = (x, y) => paths.some(el => {
          const ctm = el.getScreenCTM(); if (!ctm) return false;
          const pt = new DOMPoint(x, y).matrixTransform(ctm.inverse());
          try { return el.isPointInFill(pt); } catch (e) { return false; }
        });
        if (filledAt(m.left, m.top)) return;               // base already in the bank
        let gap = 0;
        for (let dy = 1; dy <= 120; dy++) { if (filledAt(m.left, m.top + dy)) { gap = dy; break; } }
        if (!gap) return;                                  // no bank found below: leave it
        const scale = pdiv.getBoundingClientRect().width ? pdiv.parentNode.getBoundingClientRect().width / pdiv.parentNode.offsetWidth : 1;
        pdiv.style.translate = `0 ${((gap + 3) / (scale || 1)).toFixed(2)}px`;
      });
    }
    window.addEventListener('load', seatPines);
    let seatT = 0;
    window.addEventListener('resize', () => { clearTimeout(seatT); seatT = setTimeout(seatPines, 150); });
    window.__seatPines = seatPines;
    window.__generatedTreeCount = pines.length;

    // ── HERO TREE (isolated aspen cutout) ────────────────────────────────
    // isoTree is created in buildForeground() (world coordinates). Do not create a second one
    // here: two #isoTree elements made the tree float out of place.
    window.__heroTree = null;

    // ── BIG FOREGROUND FOLIAGE BUSH -- REMOVED ──────────────────────────────
    // A large off-canvas leaf cluster (fgBush in plateFx) was removed: after the lagoon rework it
    // read as a stray dark curve from the right edge. Nothing depends on it; don't re-add it
    // without redesigning its placement.
  })();

  // ── 9. SEASON TABS + TRAVEL() ─────────────────────────────────────────────
  const SEASON_VIEW = { 1:'studio', 2:'signal', 3:'workshop', 0:'lab' };
  // tod target per season (currently all 0.50, midday).
  const SEASON_TOD  = { 0:0.50, 1:0.50, 2:0.50, 3:0.50 };
  // kf(s, [winter, spring, summer, fall]): 0=winter 1=spring 2=summer 3=fall
  const SEASON_S    = { 0:0, 1:1, 2:2, 3:3 }; // int season → kf s index
  let SEASON = 1;
  let NIGHT_MODE = false;
  let _travelRaf = null;

  function showViews(season) {
    const view = SEASON_VIEW[season];
    document.querySelectorAll('.hero-copy .view, .about .view').forEach(v =>
      v.classList.toggle('on', v.getAttribute('data-view') === view));
  }

  // travel(fromS, toS): animated season crossfade (DURATION ms, phases below).
  // TWEEN holds {a,b,p,mc}: a=from, b=to, p=eased progress, mc=content/colour mix 0-1.
  function travel(fromS, toS, onDone) {
    if (_travelRaf) cancelAnimationFrame(_travelRaf);
    // Timelapse rush into darkness, then a slow settle into the new season.
    const DURATION = 7000; // ms
    const startTime = performance.now();
    TWEEN = { a: fromS, b: toS, p: 0, mc: 0 };
    let contentSwapped = false;

    // Night mode is a manual toggle independent of season (winter is not tied to night).

    // Snap to .hiding during transition
    const hero = $('hero');
    if (hero) hero.classList.add('hiding');

    // Three phases:
    //   A "fade down"  0%-25%   -- brisk, linear: a sped-up timelapse into darkness.
    //   B "hold/swap"  25%-35%  -- dark pause where season content and colours swap, hidden.
    //   C "fade up"    35%-100% -- slow cubic ease-out settle into the new season.
    const PHASE_A_END = 0.25, PHASE_B_END = 0.35;

    (function step(now) {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / DURATION, 1);

      // mc: content/colour swap happens across phase B only.
      const mc = p < PHASE_A_END ? 0 : p > PHASE_B_END ? 1 : (p - PHASE_A_END) / (PHASE_B_END - PHASE_A_END);
      TWEEN.mc = mc;

      // Deliberately asymmetric: linear through A+B, cubic ease-out through C.
      let ps;
      if (p < PHASE_B_END) {
        ps = p;
      } else {
        const t = (p - PHASE_B_END) / (1 - PHASE_B_END);
        const eased = 1 - Math.pow(1 - t, 3);
        ps = PHASE_B_END + eased * (1 - PHASE_B_END);
      }
      TWEEN.p = ps;

      // tod dips to night by the end of A, holds through B, rises to the target through C.
      // Always dips, since interpolating between two daytime tods would never pass through
      // darkness to hide the swap.
      const fromTod = LIGHT.tod;
      const targetTod = NIGHT_MODE ? 0.0 : SEASON_TOD[toS];
      const NIGHT_TOD = 0.0;
      if (p < PHASE_A_END) {
        LIGHT.tod = lerp(fromTod, NIGHT_TOD, p / PHASE_A_END);
      } else if (p < PHASE_B_END) {
        LIGHT.tod = NIGHT_TOD;
      } else {
        const t = (p - PHASE_B_END) / (1 - PHASE_B_END);
        const eased = 1 - Math.pow(1 - t, 3);
        LIGHT.tod = lerp(NIGHT_TOD, targetTod, eased);
      }

      // Moon eligibility follows night mode, constant for the whole transition.
      window.__moonEligible = NIGHT_MODE ? 1 : 0;

      // Night-mode moon set/rise. By day the sun sets/rises for free as tod dips. In night mode
      // targetTod is also 0, so tod barely moves and the tod-driven moon would sit frozen.
      // __moonDip is a separate arc with the same A/B/C shape (1 = up, 0 = down during B);
      // render() drops and fades the moon with it. LIGHT.dim rides the same curve so the scene
      // gets darker while the moon is down. Both are inert (1 / 0) outside night mode.
      let moonDip = 1;
      if (NIGHT_MODE) {
        if (p < PHASE_A_END) {
          moonDip = 1 - (p / PHASE_A_END);
        } else if (p < PHASE_B_END) {
          moonDip = 0;
        } else {
          const t = (p - PHASE_B_END) / (1 - PHASE_B_END);
          moonDip = 1 - Math.pow(1 - t, 3);
        }
      }
      window.__moonDip = moonDip;
      LIGHT.dim = NIGHT_MODE ? (1 - moonDip) : 0;

      // Swap content as colours finish swapping (end of phase B).
      if (p >= PHASE_B_END && !contentSwapped) {
        contentSwapped = true;
        showViews(SEASON);
        if (hero) hero.classList.remove('hiding');
      }

      if (p < 1) {
        _travelRaf = requestAnimationFrame(step);
      } else {
        // Done -- settle
        TWEEN = null;
        s = toS;
        LIGHT.tod = targetTod;
        window.__moonEligible = NIGHT_MODE ? 1 : 0;
        window.__moonDip = 1;
        LIGHT.dim = 0;
        if (hero) hero.classList.remove('hiding');
        if (onDone) onDone();
      }
    })(performance.now());
  }

  function setSeason(season) {
    const prevSeason = SEASON;
    SEASON = season;
    window.__currentSeason = season;

    document.querySelectorAll('.tab').forEach(t =>
      t.setAttribute('aria-selected', String(+t.dataset.season === season)));

    const sName = seasonNames[season] || 'spring';
    updateClockLabel(season);

    // Delay these to travel()'s PHASE_A_END, when the mountain/lake colour swap (TWEEN.mc)
    // starts, so everything changes under the dark frame on one shared rhythm. Their CSS
    // transitions (components.js) are sized to the same window.
    const MC_START_DELAY = 7000 * 0.25; // matches travel()'s PHASE_A_END
    setTimeout(() => {
      document.querySelectorAll('.deciduous').forEach(el => {
        el.classList.remove('winter','spring','summer','fall');
        el.classList.add(sName);
        if (typeof el.setDecidSeason === 'function') el.setDecidSeason(sName);
      });
      if (window.__updateFlowers) window.__updateFlowers(sName);
      (window.__boulderInstances || []).forEach(w => { if (typeof w.setSeason === 'function') w.setSeason(sName); });
      (window.__plantInstances || []).forEach(w => { if (typeof w.setSeason === 'function') w.setSeason(sName); });
      (window.__pineInstances || []).forEach(t => { if (typeof t.setSeason === 'function') t.setSeason(sName); });
      (window.__mountainRange || []).forEach(g => { if (typeof g.setSeason === 'function') g.setSeason(sName); });
    }, MC_START_DELAY);

    // Wind base: [winter, spring, summer, fall]
    const windTarget = kfRaw(SEASON_S[season], [0.15, 0.30, 0.35, 0.55]);
    setWind(windTarget);

    // Animated crossfade via travel()
    const fromS = SEASON_S[prevSeason];
    const toS   = SEASON_S[season];
    if (window.__windShow) window.__windShow.calm();
    travel(fromS, toS, () => {
      showViews(season);
      if (window.__windShow) window.__windShow.settle();
    });
  }

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => setSeason(+t.dataset.season));
  });

  // Night mode: manual toggle independent of season. Only tod and moon visibility change, so a
  // simple smoothstep is enough (the asymmetric pacing is for hiding a season swap).
  // travel() respects NIGHT_MODE, so it persists across season switches.
  let _nightRaf = null;
  function toggleNightMode() {
    NIGHT_MODE = !NIGHT_MODE;
    const modeBtn = $('modeBtn');
    if (modeBtn) {
      modeBtn.setAttribute('aria-pressed', String(NIGHT_MODE));
      modeBtn.textContent = NIGHT_MODE ? 'Day mode' : 'Night mode';
    }
    if (_nightRaf) cancelAnimationFrame(_nightRaf);
    const DURATION = 3000;
    const startTime = performance.now();
    const fromTod = LIGHT.tod;
    const targetTod = NIGHT_MODE ? 0.0 : SEASON_TOD[SEASON];
    (function step(now) {
      const p = Math.min((now - startTime) / DURATION, 1);
      const eased = p * p * (3 - 2 * p);
      LIGHT.tod = lerp(fromTod, targetTod, eased);
      window.__moonEligible = NIGHT_MODE ? eased : (1 - eased);
      if (p < 1) {
        _nightRaf = requestAnimationFrame(step);
      } else {
        LIGHT.tod = targetTod;
        window.__moonEligible = NIGHT_MODE ? 1 : 0;
      }
    })(performance.now());
  }
  const modeBtn = $('modeBtn');
  if (modeBtn) modeBtn.addEventListener('click', toggleNightMode);

  // "Play the whole year": loops all four seasons, one travel() crossfade at a time, with a
  // dwell on each. Works in night mode unchanged, since setSeason()/travel() read NIGHT_MODE.
  const YEAR_ORDER = [0, 1, 2, 3]; // winter -> spring -> summer -> fall -> winter…
  const YEAR_DWELL_MS = 3500; // pause on each season after its crossfade settles
  const TRAVEL_DURATION_MS = 7000; // must match travel()'s own DURATION above
  let _playingYear = false;
  let _yearTimer = null;

  function stopPlayYear() {
    if (!_playingYear) return;
    _playingYear = false;
    if (_yearTimer) { clearTimeout(_yearTimer); _yearTimer = null; }
    const playBtn = $('playYear');
    if (playBtn) {
      playBtn.textContent = 'Play the whole year';
      playBtn.setAttribute('aria-pressed', 'false');
    }
  }

  function advanceYear() {
    if (!_playingYear) return;
    const idx = YEAR_ORDER.indexOf(SEASON);
    const next = YEAR_ORDER[(idx + 1) % YEAR_ORDER.length];
    setSeason(next);
    _yearTimer = setTimeout(advanceYear, TRAVEL_DURATION_MS + YEAR_DWELL_MS);
  }

  function togglePlayYear() {
    if (_playingYear) { stopPlayYear(); return; }
    _playingYear = true;
    const playBtn = $('playYear');
    if (playBtn) {
      playBtn.textContent = 'Stop';
      playBtn.setAttribute('aria-pressed', 'true');
    }
    advanceYear();
  }

  const playBtn = $('playYear');
  if (playBtn) playBtn.addEventListener('click', togglePlayYear);

  // A manual tab click stops the loop so it can't fight the pending _yearTimer.
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', stopPlayYear);
  });

  // Boot on spring
  s = 1;
  showViews(1);
  // Flowers are built with summer colours; give them spring's on first load too.
  if (window.__updateFlowers) window.__updateFlowers('spring');
  LIGHT.tod = SEASON_TOD[1];
  setWind(kfRaw(1, [0.15, 0.30, 0.35, 0.55]));

  window.s = () => s; // expose season clock for debugging

  // ── WIND SHOW: gusts that visibly move things, once someone lingers ──────
  // 5 s after a season has fully settled (first load or a tab change), the wind starts to play:
  // every 6-14 s a gust builds over ~1.5 s, holds, and dies away. During a gust the grass,
  // flowers, pines and the hero tree LEAN downwind (the CSS `rotate` property, which stacks on
  // their sway animation's `transform` about the same pivot) and their sway speeds up; the
  // clouds pick up speed through WIND. Each element gets its own delay and flutter so the gust
  // visibly travels across the scene. Strength by season: fall strongest, summer lightest.
  // PERF: only ~22 small layers, written at ~30 fps and only while a gust is moving; per-element
  // `rotate` is compositor-friendly and, unlike the old --wind variable, restyles nothing else.
  window.__windShow = (function () {
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const KINDS = [['.sway-grass,.sway-grass-mirror', 7, 1.0], ['.sway-flower', 6, 1.2], ['.pine-detailed-sway', 1.4, 0.4], ['.tree-isolated-sway', 0.9, 0.3]];
    const SEASON_GUST = { 0: 0.8, 1: 0.75, 2: 0.55, 3: 1 };      // winter, spring, summer, fall
    let els = null, active = false, startT = null, gust = 0, target = 0, nextAt = 0, holdTo = 0, raf = 0, last = 0;
    function collect() {
      els = [];
      KINDS.forEach(([sel, amp, rate]) => document.querySelectorAll(sel).forEach((e) => {
        if (!(e instanceof HTMLElement)) return;
        const r = e.getBoundingClientRect();
        els.push({ e, amp: amp * (0.8 + Math.random() * 0.4), rate, ph: Math.random() * 6, lag: Math.max(0, r.left) / Math.max(1, innerWidth) * 0.6, anims: null, last: '' });
      }));
    }
    function write(g, t) {
      els.forEach((o) => {
        const gl = g * Math.min(1, Math.max(0, 1 - o.lag * (target > gust ? 1 : 0)));
        const flutter = gl * 0.35 * Math.sin(t * (2.2 + o.rate) + o.ph);
        const deg = gl * o.amp + flutter * o.amp * 0.4;
        const v = Math.abs(deg) < 0.02 ? '' : deg.toFixed(2) + 'deg';
        if (v !== o.last) { o.e.style.rotate = v; o.last = v; }
        if (!o.anims) o.anims = o.e.getAnimations ? o.e.getAnimations() : [];
        const pr = 1 + gl * 1.3 * o.rate;
        o.anims.forEach((a) => { if (Math.abs(a.playbackRate - pr) > 0.03) a.playbackRate = pr; });
      });
    }
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (!active || document.hidden || now - last < 33) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const t = now / 1000;
      if (now >= nextAt && target === 0) {                          // a new gust
        target = (0.55 + Math.random() * 0.45) * (SEASON_GUST[SEASON] || 0.8);
        holdTo = now + 1500 + 1000 + Math.random() * 2500;
        WIND.target = WIND.base + target * 0.6;
      }
      if (target > 0 && now > holdTo) { target = 0; WIND.target = WIND.base; nextAt = now + 6000 + Math.random() * 8000; }
      const rateUp = target > gust ? 0.9 : 0.55;                   // builds a bit faster than it dies
      gust += (target - gust) * Math.min(1, dt * rateUp * 1.6);
      if (gust < 0.004 && target === 0) { if (gust) { gust = 0; write(0, t); } return; }
      write(gust, t);
    }
    function begin() { if (reducedMotion) return; if (!els) collect(); active = true; nextAt = performance.now() + 400; if (!raf) raf = requestAnimationFrame(tick); }
    return {
      settle() { clearTimeout(startT); startT = setTimeout(begin, 5000); },
      calm() { clearTimeout(startT); active = false; target = 0; gust = 0; if (els) write(0, 0); },
      gust: () => gust,
      // Test panel: start a gust right away (turns the show on if it isn't yet).
      gustNow() { if (reducedMotion) return; if (!els) collect(); active = true; target = 0; nextAt = 0; if (!raf) raf = requestAnimationFrame(tick); },
    };
  })();
  // First load: 5 s after the scene has faded in.
  (function waitLoaded() {
    const core = document.querySelector('.scene-core');
    if (!core || core.classList.contains('scene-loaded')) setTimeout(() => window.__windShow.settle(), 900);
    else setTimeout(waitLoaded, 250);
  })();

  // ── SHAREABLE LINKS ──────────────────────────────────────────────────────
  // The address can set the scene: ?summer+night, ?winter, ?fall+day, ?night. Words combine with
  // + (or & , or spaces) in any order. Seasons: spring summer fall/autumn winter, or the tab
  // names books web workshop lab. Also: day, night, play (plays the whole year). Animal names
  // (?fox, ?summer+night+owl) bring that animal in once the wildlife loads (wildlife.js).
  // The page opens straight on that look (no crossfade), and the address bar follows every
  // season/night change after that, so the current view can always be copied and shared.
  // Other flags (?bench ?fps ?wildlife ?diag) are left as they are.
  const LINK_SEASON = { spring: 1, summer: 2, fall: 3, autumn: 3, winter: 0, books: 1, web: 2, workshop: 3, lab: 0 };
  const LINK_KEEP = ['bench', 'fps', 'wildlife', 'diag'];
  const linkWords = decodeURIComponent(location.search.slice(1)).toLowerCase()
    .split(/[+&,;\s]+/).map(w => w.split('=')[0]).filter(Boolean);
  window.__linkWords = linkWords;
  let linkSeason = null, linkNight = null;
  linkWords.forEach(w => {
    if (w in LINK_SEASON) linkSeason = LINK_SEASON[w];
    if (w === 'night') linkNight = true;
    if (w === 'day') linkNight = false;
  });
  if (linkSeason != null && linkSeason !== SEASON) {
    // Jump straight there: everything travel()/setSeason() would set, without the animation.
    SEASON = linkSeason; s = SEASON_S[linkSeason]; window.__currentSeason = linkSeason;
    const sName = seasonNames[linkSeason];
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(+t.dataset.season === linkSeason)));
    updateClockLabel(linkSeason);
    showViews(linkSeason);
    document.querySelectorAll('.deciduous').forEach(el => {
      el.classList.remove('winter', 'spring', 'summer', 'fall'); el.classList.add(sName);
      if (typeof el.setDecidSeason === 'function') el.setDecidSeason(sName);
    });
    if (window.__updateFlowers) window.__updateFlowers(sName);
    ['__boulderInstances', '__plantInstances', '__pineInstances', '__mountainRange'].forEach(k =>
      (window[k] || []).forEach(o => { if (typeof o.setSeason === 'function') o.setSeason(sName); }));
    LIGHT.tod = SEASON_TOD[linkSeason];
    setWind(kfRaw(linkSeason, [0.15, 0.30, 0.35, 0.55]));
  }
  if (linkNight) {
    NIGHT_MODE = true;
    LIGHT.tod = 0; window.__moonEligible = 1; window.__moonDip = 1;
    if (modeBtn) { modeBtn.setAttribute('aria-pressed', 'true'); modeBtn.textContent = 'Day mode'; }
  }
  function writeLink() {
    const words = [seasonNames[SEASON], NIGHT_MODE ? 'night' : 'day']
      .concat(linkWords.filter(w => LINK_KEEP.includes(w)));
    try { history.replaceState(null, '', location.pathname + '?' + words.join('+') + location.hash); } catch (e) { /* file:// */ }
  }
  // Only rewrite the address once someone changes the view (a plain visit keeps a clean URL).
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setTimeout(writeLink, 0)));
  if (modeBtn) modeBtn.addEventListener('click', () => setTimeout(writeLink, 0));
  if (linkWords.includes('play') && playBtn) setTimeout(() => { if (!_playingYear) togglePlayYear(); }, 1500);
}
