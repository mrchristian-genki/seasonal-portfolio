// V2 Scene — keyframe engine + travel() wired, per-season color grading live
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
    // Handles both "#rrggbb" hex and "rgb(r,g,b)" strings -- needed because
    // skyStops() returns mix()'s own rgb(...) output, which then gets fed
    // into another mix() call in render(). hx() previously only understood
    // hex, so that second call produced NaN for every channel, silently
    // invalidating the whole gradient string (confirmed directly: the sky
    // background was empty on the live site, in every season).
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

  // Tahoe palette — [winter, spring, summer, fall] per layer
  const GRADE = {
    // Sky stop colours — match skyStops() transitions but colour-shift per season
    sky0: ['#080e22', '#7eb8d8', '#4a80cc', '#8a6080'],  // top
    sky1: ['#1a2a52', '#a8d8e8', '#7ab8e0', '#a86050'],  // mid
    sky2: ['#a8b0b8', '#b8dce8', '#c8e8f4', '#d09060'],  // horizon

    // Per-layer CSS filter strings — applied on top of the tod brightness
    // format: [winter, spring, summer, fall]
    // mountains: winter reads as bright, pale, and cool rather than dark --
    // frost/snow is high-brightness and desaturated, not dim. The previous
    // 195deg hue-rotate was close to a full inversion, which on this art's
    // already-blue base palette pushed it toward orange/brown -- the exact
    // opposite of "frosted". The base blue tone IS the cool winter look;
    // it just needed to stay in place, not get rotated away from itself.
    mtn:  [
      'saturate(.55) brightness(1.18)',
      'hue-rotate(-8deg) saturate(1.12) brightness(1.04)',
      'saturate(1) brightness(1)',   // summer baseline
      'hue-rotate(10deg) saturate(1.18) sepia(.10)',
    ],
    // midground (lake/hills): same brightness fix -- was darkening in
    // winter (brightness(.82)) when frost should brighten. Hue-rotate kept
    // small (was already modest, not the main offender), just reduced
    // slightly further since brightening surfaces a hue shift more than
    // darkening did.
    lake: [
      'saturate(.9) brightness(0.95) hue-rotate(10deg)',
      'hue-rotate(-5deg) saturate(2.3) brightness(0.88)',
      'saturate(2.6) brightness(0.86)',
      'hue-rotate(8deg) saturate(2.1) brightness(0.88) sepia(.06)',
    ],
    // foreground/foliage: grey-white in winter, vivid in spring, amber in fall
    foliage: [
      'saturate(.12) brightness(1.35)',
      'hue-rotate(-6deg) saturate(1.18) brightness(1.06)',
      'saturate(1) brightness(1)',
      'hue-rotate(14deg) saturate(1.28) sepia(.14)',
    ],
  };

  // Interpolate a filter string between two season values.
  // We decompose each filter into its numeric components, lerp them, reassemble.
  // Seasons are integers 0-3; we smooth-step between adjacent ones via kfRaw.
  function interpFilter(s, filters) {
    // Extract numeric value from a filter token like "hue-rotate(-8deg)" → -8
    // FIXED: the old /-?\d+(\.\d+)?/ requires a digit before the decimal
    // point, so shorthand values with no leading zero (".28", ".10", as
    // used throughout GRADE below) were silently misread as "28"/"10" --
    // 100x too large. \d*\.?\d+ matches both "1.12" and ".28" correctly.
    const num = str => {
      const m = str.match(/-?\d*\.?\d+/);
      return m ? parseFloat(m[0]) : 1;
    };
    // Decompose each filter string into sorted token list with values
    // FIXED: \w+ doesn't include hyphens, so "hue-rotate(195deg)" was
    // silently truncated to just "rotate(195deg)" by the tokenizer --
    // "rotate" isn't a valid CSS *filter* function (it's a *transform*
    // function), so the whole reassembled filter string the browser saw
    // was invalid and got silently discarded, leaving style.filter stuck
    // empty forever. This is why mountains/lake/foliage never visibly
    // changed with season or time-of-day despite render() computing a
    // new value every frame -- confirmed directly: lakeAsset.style.filter
    // was empty on the live site, and that code path was never touched
    // this session. [\w-]+ keeps the hyphen intact through both the
    // tokenizer and the name extraction below.
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
    const keys = [...new Set([...Object.keys(da), ...Object.keys(db)])];
    // Neutral default per function when a key is missing from one side --
    // NOT a blanket 1. saturate/brightness/contrast are multiplicative, so
    // "not mentioned" correctly means 1 (no change). hue-rotate/sepia/
    // grayscale/invert are additive-effect functions where "not mentioned"
    // means 0 (no effect) -- defaulting them to 1 was applying their
    // MAXIMUM effect instead of NO effect, which is what caused summer to
    // silently inherit a full sepia wash from fall's filter (the only
    // season with sepia() in it, and summer's wraparound-next season).
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

  // ── WIND FIELD ───────────────────────────────────────────────────────────
  const WIND = { base: 0.30, gust: 0, target: 0 };
  try { CSS.registerProperty({ name: '--wind', syntax: '<number>', inherits: true, initialValue: '0.30' }); } catch(e) {}
  const heroEl = $('hero');
  (function windTick() {
    let lastWindTime = performance.now();
    (function tick(now) {
      const dt = Math.min((now - lastWindTime) / 1000, 0.5);
      lastWindTime = now;
      if (Math.random() < 0.006) WIND.target = WIND.base + Math.random() * 0.5;
      else if (Math.random() < 0.006) WIND.target = WIND.base;
      // Frame-rate-independent exponential ease -- equivalent feel to the
      // old fixed 0.02-per-frame-at-60fps rate, but tied to real elapsed
      // time instead of frame count.
      const decay = 1 - Math.pow(1 - 0.02, dt * 60);
      WIND.gust += (WIND.target - WIND.gust) * decay;
      heroEl.style.setProperty('--wind', Math.max(0, Math.min(1.5, WIND.gust)).toFixed(3));
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

  // ── 1. PLATE-SKY ─────────────────────────────────────────────────────────
  const sky = Object.assign(document.createElement('div'), { id: 'skyGradient' });
  $('plateSky').appendChild(sky);

  // ── 2. PLATE-CELESTIAL: sun + moon ───────────────────────────────────────
  const cel = mk('svg', {
    id: 'celestial', viewBox: `0 0 ${VW} ${VH}`,
    preserveAspectRatio: 'xMidYMid slice', style: 'position:absolute;inset:0'
  });
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
    const cloudSvg = mk('svg', {
      id: 'cloudSvg', viewBox: `0 0 ${VW} ${VH}`,
      preserveAspectRatio: 'xMidYMid slice',
      style: 'position:absolute;inset:0;overflow:visible'
    });
    plate.appendChild(cloudSvg);
    const rainCanvas = document.createElement('canvas');
    rainCanvas.id = 'rainCanvas';
    rainCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity 2s';
    const fxPlateForRain = $('plateFx') || plate;
    fxPlateForRain.appendChild(rainCanvas);

    function makeCloud(id, x, y, scale=1, opacity=0.88) {
      const g = mk('g', { id, style: `transform:translateX(${x}px)` }, cloudSvg);
      [[0,0,320,180],[-220,60,240,160],[220,60,240,160],[-120,30,280,170],[120,30,280,170],[0,-50,260,160]]
        .forEach(([dx,dy,rx,ry]) => mk('ellipse', { cx:x+dx*scale, cy:y+dy*scale, rx:rx*scale, ry:ry*scale, fill:'#fff', opacity:String(opacity) }, g));
      return g;
    }
    const clouds = [
      makeCloud('cloud0', VW*0.10, VH*0.12, 0.55, 0.82),
      makeCloud('cloud1', VW*0.38, VH*0.08, 0.70, 0.78),
      makeCloud('cloud2', VW*0.68, VH*0.10, 0.60, 0.85),
      makeCloud('cloud3', VW*0.85, VH*0.14, 0.45, 0.75),
      makeCloud('cloud4', VW*0.22, VH*0.16, 0.40, 0.72),
    ];
    const speeds = [18, 12, 22, 15, 9];
    const baseX = clouds.map(c => { const m = c.style.transform.match(/translateX\(([^p]+)/); return m ? parseFloat(m[1]) : 0; });
    let offsets = baseX.slice();
    const drops = Array.from({length:180}, () => ({
      x: Math.random()*VW, y: Math.random()*VH,
      len: 18+Math.random()*26, speed: 18+Math.random()*14, opacity: 0.3+Math.random()*0.5
    }));
    // Snow flakes: separate pool, separate motion (slow fall + side-to-side
    // drift instead of a fast angled streak), separate season binding (winter
    // only, not shared with fall's rain).
    const flakes = Array.from({length:140}, () => ({
      x: Math.random()*VW, y: Math.random()*VH,
      r: 3+Math.random()*5, speed: 4+Math.random()*5, opacity: 0.4+Math.random()*0.5,
      driftPhase: Math.random()*Math.PI*2, driftSpeed: 0.6+Math.random()*0.8, driftAmp: 15+Math.random()*25,
    }));
    let rainOpacity = 0, snowOpacity = 0, lastTime = 0;

    function updateClouds(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.5);
      lastTime = now;
      // Cloud opacity driven by season: winter heavy, summer sparse, fall stormy
      // [winter, spring, summer, fall]
      const cloudOp = kf(s, [0.90, 0.50, 0.20, 0.82]);
      // Rain (fall only) and snow (winter only) now ease independently instead
      // of sharing one "targetRain" value that got reused as snow in winter
      // with no visual difference at all.
      const targetRain = kf(s, [0.0, 0.0, 0.0, 0.45]);
      const targetSnow = kf(s, [0.55, 0.0, 0.0, 0.0]);
      clouds.forEach((c, i) => {
        offsets[i] += speeds[i] * dt;
        if (offsets[i] > VW * 1.3) offsets[i] = -VW * 0.4;
        c.setAttribute('transform', `translate(${offsets[i] - baseX[i]}, 0)`);
        c.style.opacity = cloudOp;
      });
      rainOpacity += (targetRain - rainOpacity) * dt * 0.8;
      snowOpacity += (targetSnow - snowOpacity) * dt * 0.8;
      window.__rainOpacity = rainOpacity;
      window.__snowOpacity = snowOpacity;
      // Wire into the water shimmer's existing precip API -- it already
      // handles spawning falling drops and their landing ripples, it just
      // had nothing calling it. Threshold avoids flickering on/off right at
      // the edge of a season crossfade; only calls setPrecip on an actual
      // change, since it resets an internal spawn timer each call.
      if (window.__waterAPI) {
        const target = snowOpacity > 0.1 && snowOpacity >= rainOpacity ? 'snow'
          : rainOpacity > 0.1 ? 'rain' : 'none';
        if (target !== window.__waterPrecipState) {
          window.__waterAPI.setPrecip(target);
          window.__waterPrecipState = target;
        }
      }
      const active = Math.max(rainOpacity, snowOpacity);
      rainCanvas.style.opacity = active;
      if (active > 0.05) {
        const rect = plate.getBoundingClientRect();
        if (rainCanvas.width !== rect.width || rainCanvas.height !== rect.height) {
          rainCanvas.width = rect.width; rainCanvas.height = rect.height;
        }
        const ctx = rainCanvas.getContext('2d');
        ctx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
        const sx = rainCanvas.width/VW, sy = rainCanvas.height/VH;
        if (rainOpacity > 0.02) {
          drops.forEach(d => {
            d.y += d.speed * dt * 60;
            if (d.y > VH) { d.y = -d.len; d.x = Math.random()*VW; }
            ctx.strokeStyle = `rgba(180,210,240,${d.opacity * rainOpacity})`;
            ctx.lineWidth = 1.6; ctx.beginPath();
            ctx.moveTo(d.x*sx, d.y*sy); ctx.lineTo((d.x+2)*sx, (d.y+d.len)*sy); ctx.stroke();
          });
        }
        if (snowOpacity > 0.02) {
          flakes.forEach(f => {
            f.y += f.speed * dt * 60;
            f.driftPhase += f.driftSpeed * dt;
            if (f.y > VH) { f.y = -f.r * 2; f.x = Math.random()*VW; }
            const dx = Math.sin(f.driftPhase) * f.driftAmp;
            ctx.fillStyle = `rgba(255,255,255,${f.opacity * snowOpacity})`;
            ctx.beginPath();
            ctx.arc((f.x+dx)*sx, f.y*sy, f.r*Math.min(sx,sy), 0, Math.PI*2);
            ctx.fill();
          });
        }
      }
    }
    window.__updateClouds = updateClouds;
    window.__cloudSvg = cloudSvg;
  })();

  // ── 4. PLATE-BACKGROUND: mountain assets ─────────────────────────────────
  // ── 4/5/6. UNIFIED WORLD COORDINATES ──────────────────────────────────────
  // Everything below (mountains, lake, hero peak, isolated tree, boulders,
  // plants, water) now shares the SAME viewBox (0 0 VW VH) + the SAME
  // preserveAspectRatio ("xMidYMid slice") that plateCelestial/plateClouds/
  // the generated-trees overlay already used correctly. That match is what
  // makes elements move together as the window resizes -- it's the "look
  // through one lens at a fixed world" behaviour, not a bug fix on any one
  // element. Before this, the lake/mountain/hero-tree images and this
  // session's boulders/plants were positioned with plain CSS percentages of
  // the hero's own pixel box -- a DIFFERENT scaling rule than the
  // viewBox+slice system the pines already used, so they drifted apart from
  // each other exactly as the pine-vs-boulder measurement at three widths
  // showed (one pine's rendered height jumped from 152px to 654px between
  // 2000px and 900px wide, while boulders barely moved -- two different
  // cameras on the same scene).
  //
  // Every existing builder function (buildBoulderGrass, buildForegroundPlant,
  // buildFoothillsRange, buildWaterShimmer) is used completely UNCHANGED --
  // they all fetch into a plain <div>. The fix is only in how that div gets
  // POSITIONED: instead of a CSS-percent div sitting directly in a plate,
  // it's now wrapped in an SVG <foreignObject> placed at explicit VW×VH
  // coordinates inside each plate's own shared-viewBox <svg>. Percentages
  // were converted to VW×VH units directly (e.g. the lake's old
  // left:-18%/width:136% becomes x:-0.18*VW/width:1.36*VW) -- same intended
  // placement, now expressed in the coordinate space everything else uses.
  function worldSvg(plateId) {
    const plate = $(plateId);
    if (!plate) return null;
    return mk('svg', {
      viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: 'xMidYMid slice',
      style: 'position:absolute;inset:0;overflow:visible',
    }, plate);
  }
  // Wrap an HTML-based builder (all of them fetch into a plain div) in a
  // foreignObject at explicit world coordinates, then hand that div to the
  // builder exactly as before.
  function placeHtml(svg, id, x, y, w, h, build) {
    const fo = mk('foreignObject', { id: id + 'FO', x, y, width: w, height: h }, svg);
    const div = document.createElement('div');
    div.id = id;
    Object.assign(div.style, { width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' });
    fo.appendChild(div);
    const result = build(div);
    return { fo, div, result };
  }
  // Same, for a plain image asset (lake, hero peak, isolated tree) that
  // doesn't need a builder function -- still via foreignObject+<img> rather
  // than a native SVG <image>, so the existing object-fit/object-position
  // styling and the tree's CSS sway class keep working exactly as before.
  function placeImage(svg, id, x, y, w, h, src, extraStyle) {
    // SVG's native <image> element, not an HTML <img> inside a
    // foreignObject. Confirmed directly in WebKit (the engine Safari uses):
    // <img>-in-foreignObject computes a correct layout box and reports the
    // image as loaded, but silently fails to paint anything under this
    // scene's viewBox scaling -- while native SVG content in the same
    // foreignObject setup renders correctly. This sidesteps that whole
    // category of bug by never using foreignObject for images at all.
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
    const svg = worldSvg('plateBackground');
    if (!svg) return;
    // Mountain_Range_Long.svg foothills -- same buildFoothillsRange crop-
    // window call as before (unchanged), just placed via foreignObject at
    // the world coordinates equivalent to the old top:46%/height:30%.
    placeHtml(svg, 'foothillsWrap', 0, 0.46 * VH, VW, 0.30 * VH, (div) => {
      if (window.SceneComponents && window.SceneComponents.buildFoothillsRange) {
        window.SceneComponents.buildFoothillsRange(div, 'assets/Mountain_Range_Long.svg', 'summer', { cropWidth: 2999.72 });
        window.__foothillsWrap = div;
      }
    });

    // Hero peak -- old CSS was left:50%/translateX(-50%)/width:68%/height:70%,
    // i.e. horizontally centered; world-space x is (VW - width)/2 directly.
    const peakH = 0.70 * VH, peakW = peakH * (4000 / 2933.3333); // matches hero_peak_snow.svg's native aspect ratio exactly, avoiding any stretch
    placeImage(svg, 'heroPeak', (VW - peakW) / 2, 0, peakW, peakH,
      'art/hero_peak_snow.svg', { objectFit: 'contain', objectPosition: 'center bottom' });
  })();

  // ── 5. PLATE-MIDGROUND ───────────────────────────────────────────────────
  (function buildMidground() {
    const svg = worldSvg('plateMidground');
    if (!svg) return;
    // landscape-hills-scenic-green-no-trees.svg -- old CSS was
    // left:-18%/width:136%/height:100%; same fractions in world units.
    placeImage(svg, 'lakeAsset', -8016.8, 0, 21037.49, VH,
      'assets/landscape-hills-scenic-green-no-trees.svg',
      { objectFit: 'fill', objectPosition: 'center bottom' });

    // Water shimmer -- moved from plateFx into this plate (plateMidground),
    // which sits BEFORE plateForeground in DOM order. It was in plateFx
    // before, which draws AFTER (on top of) plateForeground -- meaning the
    // water was rendering OVER the boulders/plants, making them look
    // submerged rather than sitting on the shore in front of the water.
    // Height also shrunk and repositioned: it was 56% of the world's full
    // height (reaching to the very bottom), overlapping the same zone the
    // boulders sit in. Now ends before the shoreline starts (y:1300 to
    // y:1750, just above where the boulders' tops begin at y:1650-1820),
    // using the same real-world coordinate reference as that fix rather
    // than a converted percentage.
    if (window.SceneComponents && window.SceneComponents.buildWaterShimmer) {
      const { div } = placeHtml(svg, 'waterShimmerWrap', 0, 1850, VW, 550, () => {});
      window.__waterAPI = window.SceneComponents.buildWaterShimmer(div, 1600, 550, { skyFrac: 0 });
      const waterSvgEl = div.querySelector('svg');
      if (waterSvgEl) {
        const bgRect = waterSvgEl.querySelector('rect');
        if (bgRect) bgRect.style.display = 'none';
      }
    }

    // Birds -- stay in plateFx (topmost, correct for distant flying birds
    // that shouldn't be occluded by anything). Previously its own separate
    // <svg> with a DIFFERENT preserveAspectRatio ("xMidYMin meet" vs
    // everyone else's "xMidYMid slice"), itself a small instance of the
    // same mismatch this whole pass is fixing. A nested <svg> at world
    // coordinates scales and crops together with everything else
    // automatically, since nested SVGs inherit their parent's transform.
    const fxSvg = worldSvg('plateFx');
    if (fxSvg && window.SceneComponents && window.SceneComponents.buildRealBirdFlock) {
      const birdVh = VH * 0.42;
      const birdSvg = mk('svg', {
        id: 'birdFlockSvg', x: 0, y: 0, width: VW, height: birdVh,
        viewBox: `0 0 ${VW} ${birdVh}`, style: 'overflow:visible',
      }, fxSvg);
      window.__birdAPI = window.SceneComponents.buildRealBirdFlock(birdSvg, VW, birdVh);
    }
  })();

  // ── 6. PLATE-FOREGROUND: boulders + foliage ──────────────────────────────
  (function buildForeground() {
    const svg = worldSvg('plateForeground');
    if (!svg) return;

    // Boulders -- same 3 real extracted variants as before. Previously
    // positioned by converting old CSS hero-percentages into world
    // fractions, which was wrong: those percentages were tuned by eye
    // against a different reference frame than pines use. Confirmed
    // empirically -- boulder1 rendered at 101%-118% down the hero, entirely
    // off-screen. Positioned directly in world coordinates instead, with
    // bottom edges landing just in front of the pines' own y:1700-1840
    // shoreline reference (the same calibration convention pines use, not
    // a converted percentage).
    function placeBoulder(id, x, yTop, w, h, src, opts) {
      opts = opts || {};
      const { div } = placeHtml(svg, id, x, yTop, w, h, (d) => {
        if (window.SceneComponents && window.SceneComponents.buildBoulderGrass) {
          window.SceneComponents.buildBoulderGrass(d, src, opts.season || 'summer');
        }
      });
      if (opts.flipped) div.style.transform = 'scaleX(-1)';
      return div;
    }
    const boulderInstances = [
      placeBoulder('boulder1', 60,  1350,  550, 433, 'assets/boulder-grass-0_0.svg'),
      placeBoulder('boulder2', 550, 1416,  450, 367, 'assets/boulder-grass-1_1.svg'),
      placeBoulder('boulder3', 950, 1316,  600, 467, 'assets/boulder-grass-0_2.svg'),
      // Variety pass: reusing the same 3 extracted assets at new positions/
      // scales/flips rather than extracting new ones -- avoids "exactly one
      // of everything" reading as a curated display instead of a real shore.
      placeBoulder('boulder4', 1780, 1400, 340, 267, 'assets/boulder-grass-1_1.svg', { flipped: true }),
      placeBoulder('boulder5', 2550, 1330, 420, 327, 'assets/boulder-grass-0_0.svg'),
    ];
    window.__boulderInstances = boulderInstances;

    // Foreground plants -- same 5 real variants, same fix: direct world
    // coordinates near the shoreline reference instead of a converted
    // percentage, spread across x to sit near/among the boulders above.
    function placePlant(id, x, yTop, w, h, src, opts) {
      opts = opts || {};
      const { div } = placeHtml(svg, id, x, yTop, w, h, (d) => {
        if (window.SceneComponents && window.SceneComponents.buildForegroundPlant) {
          window.SceneComponents.buildForegroundPlant(d, src, opts.season || 'summer');
        }
      });
      if (opts.flipped) div.style.transform = 'scaleX(-1)';
      return div;
    }
    const plantInstances = [
      // Hero plants -- three anchors, generously spaced, each doing real
      // visual work rather than competing with neighbors of the same size.
      placePlant('plant1', 300,  1583, 260, 260, 'assets/fg-plant-fern.svg'),
      placePlant('plant2', 1300, 1483, 320, 320, 'assets/fg-plant-agave.svg'),
      placePlant('plant3', 2300, 1450, 380, 317, 'assets/fg-plant-rounded-bush.svg'),
      // Accent plants -- genuinely small (roughly a third the hero scale),
      // each tucked into a specific gap near a boulder rather than bunched
      // with the hero plants. Their job is to soften an empty patch of
      // grass, not draw attention on their own.
      placePlant('plant4', 780,  1620, 110, 116, 'assets/fg-plant-yellow-flower-stem.svg'),
      placePlant('plant5', 1780, 1600, 130, 130, 'assets/fg-plant-spiky-yucca.svg', { flipped: true }),
      placePlant('plant6', 2680, 1580, 120, 120, 'assets/fg-plant-agave.svg', { flipped: true }),
    ];
    window.__plantInstances = plantInstances;

    // Isolated hero tree -- old CSS was identical to the lake's (left:-18%/
    // width:136%/height:100%), same world-space conversion. Sway pivot
    // stays a CSS transform-origin percentage on the <img> itself (fill-box
    // now, since the previous border-box default doesn't apply the same
    // way once the image sits inside a foreignObject rather than directly
    // in the hero) -- kept explicit here rather than assumed.
    const isoTree = placeImage(svg, 'isoTree', 242.25, 1136.47, 12374.97, 1960.78,
      'assets/landscape-hills-scenic-green-isolated-tree.svg',
      { objectFit: 'fill', objectPosition: 'center bottom', transformBox: 'fill-box', transformOrigin: '24.4% 82.8%' });
    isoTree.classList.add('tree-isolated-sway');
    isoTree.style.setProperty('--dur', '6.2s');
    isoTree.style.setProperty('--delay', '0.4s');
    window.__heroTree = null;

    // Seasonal flowers -- unchanged generator, now placed via a world-space
    // foreignObject wrapper the same as everything else in this plate
    // (previously flowerSvg was its own viewBox="0 0 VW VH" svg sitting
    // directly in the plate, which already matched the shared system on
    // its own -- kept as a direct child of the plate's own svg here rather
    // than re-wrapped, since it was never part of the mismatch).
    const flowerSvg = mk('svg', {
      id: 'flowerSvg', viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: 'xMidYMid slice',
      style: 'position:absolute;inset:0;pointer-events:none',
    }, $('plateForeground'));
    const FLOWER_SEASON_COLS = {
      spring: ['#e85fa0', '#d94b8a', '#f07ab0'],
      summer: ['#d64b4b', '#e0552f', '#c8382a'],
      fall:   ['#d4822a', '#c8a020', '#b86818'],
      winter: ['#8a9898', '#7a8888', '#6a7878'],
    };
    const flowerDefs = [
      { x: 320,  y: 2820, h: 200 },
      { x: 520,  y: 2870, h: 170 },
      { x: 180,  y: 2900, h: 220 },
      { x: 680,  y: 2840, h: 185 },
      { x: 820,  y: 2810, h: 160 },
    ];
    const { makeFlower } = window.SceneComponents || {};
    const flowerEls = [];
    if (makeFlower) {
      flowerDefs.forEach(({ x, y, h }) => {
        const f = makeFlower({ x, y, h, color: '#d64b4b', tier: 'd' });
        f.style.transition = 'opacity 0.7s linear';
        f.querySelectorAll('ellipse').forEach(e => e.style.transition = 'fill 0.7s linear');
        flowerSvg.appendChild(f);
        flowerEls.push(f);
      });
    }
    window.__updateFlowers = function(season) {
      const cols = FLOWER_SEASON_COLS[season] || FLOWER_SEASON_COLS.summer;
      const isWinter = season === 'winter';
      flowerEls.forEach((f, i) => {
        const col = cols[i % cols.length];
        f.querySelectorAll('ellipse').forEach(e => e.setAttribute('fill', col));
        f.style.opacity = isWinter ? '0.3' : '1';
      });
    };
    window.__foliageSvg = flowerSvg;
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
  function render(now) {
    now = now || performance.now();
    window.__frameCount = ++__frameCount;
    const { tod, dim } = LIGHT;

    // ── sky gradient: tod-based colour × season shift ───────────────────────
    const d = 1 - dim * 0.28;
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
    lbri *= (1 - dim * 0.2);

    // ── per-layer filter: tod brightness × season colour grade ─────────────
    function layerFilter(gradeKey) {
      const seasonGrade = interpFilter(s, GRADE[gradeKey]);
      return `brightness(${lbri.toFixed(3)}) ${seasonGrade}`;
    }

    // Mountains
    const mtnFilter = layerFilter('mtn');
    const foothillsWrap = window.__foothillsWrap;
    const foothillsSvg = foothillsWrap && foothillsWrap._svg;
    const heroPeak = $('heroPeak');
    if (foothillsSvg) foothillsSvg.style.filter = mtnFilter;
    if (heroPeak) heroPeak.style.filter = mtnFilter;

    // Midground / lake
    const lakeFilter = layerFilter('lake');
    const lakeAsset = $('lakeAsset');
    if (lakeAsset) lakeAsset.style.filter = lakeFilter;
    const foliageFilterForTree = layerFilter('foliage');
    const isoTree = $('isoTree');
    if (isoTree) isoTree.style.filter = foliageFilterForTree;

    // Foreground / foliage
    const folFilter = layerFilter('foliage');
    const foliageSvg = $('foliageSvg');
    if (foliageSvg) foliageSvg.style.filter = folFilter;
    ['rock_L1','rock_L2','rock_L3','rock_R1','rock_R2'].forEach(id => {
      const el = $(id); if (el) el.style.filter = layerFilter('foliage');
    });

    // Lake amp for water shimmer wiring
    window.__lakeAmp = kf(s, [0.60, 0.90, 1.00, 1.40]);
    // Map the continuous amp (0.6 winter -> 1.4 fall) onto the water
    // shimmer's 0-3 wind range as a FLOAT, not rounded -- setWind now
    // interpolates its dominant visual parameter (scale) continuously
    // between config entries itself, so passing it a smooth value every
    // frame is what makes the wind intensity actually ease rather than
    // jump between seasons.
    if (window.__waterAPI) {
      const lvl = Math.max(0, Math.min(3, (window.__lakeAmp - 0.6) / 0.8 * 3));
      window.__waterAPI.setWind(lvl);
    }

    // ── snow overlay on hero peak ───────────────────────────────────────────
    function setSnowOp(id, op) {
      // hero_peak_snow.svg loaded as <img>; can't reach its internals from JS.
      // Snow is handled via the applySnow() system in the catalog.
      // For the live scene, we drive snow through the CSS filter on the img
      // and trust the embedded polygon opacities to match (set on upload).
    }
    // Drive snow via postMessage to the img's SVG (or via objectFit if inline)
    // For now: heroPeak gets a saturation boost in winter (appears snow-capped)
    // Full snow polygon animation requires inlining the SVG — mark as TODO.

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
      // Moon only appears when winter is actually the relevant season (see
      // window.__moonEligible, set during travel() below) -- not just
      // because tod happens to dip through night as a device to hide a
      // transition between two non-winter seasons. Outside a transition
      // this defaults to 1, so real winter nights are unaffected.
      const moonGate = window.__moonEligible != null ? window.__moonEligible : 1;
      moonBody.setAttribute('transform', `translate(${(VW*0.72).toFixed(0)} ${(VH*(0.62-0.28*moonArc)).toFixed(0)})`);
      moonBody.setAttribute('opacity', (Math.max(0, Math.min(1, moonArc*1.5)) * moonGate).toFixed(2));
    } else {
      moonBody.setAttribute('opacity', '0');
    }
  }

  // Main rAF loop
  function mainLoop(now) {
    render(now);
    if (window.__updateClouds) window.__updateClouds(now);
    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);

  window.LIGHT = LIGHT;
  window.setTOD = v => { LIGHT.tod = v; render(); };
  window.setDim = v => { LIGHT.dim = v; render(); };
  window.play  = () => {
    let running = true;
    (function t(now) { LIGHT.tod = (LIGHT.tod + 0.0008) % 1; if (running) requestAnimationFrame(t); })();
    window.pause = () => { running = false; };
  };

  const seasonNames = { 0:'winter', 1:'spring', 2:'summer', 3:'fall' };

  // ── 8. GENERATED TREES ───────────────────────────────────────────────────────
  (function buildTrees() {
    if (!window.SceneComponents) return;
    const { makeDetailedPine, makeFlower, makeDeciduous } = window.SceneComponents;

    // ── LAYER ORDER STRATEGY ──────────────────────────────────────────────
    // plateMidground: pines + deciduous — these sit on the grass banks, BEHIND
    //                 the large foreground foliage bush
    // plateFx:        large right-side foliage bush — topmost generated element,
    //                 in front of everything including the pines

    const mg = $('plateMidground');
    const treeOverlay = mk('svg', {
      id: 'generatedTrees', viewBox: `0 0 ${VW} ${VH}`,
      preserveAspectRatio: 'xMidYMid slice',
      style: 'position:absolute;inset:0;pointer-events:none;overflow:visible'
    });
    mg.appendChild(treeOverlay);

    // ── PINE POSITIONS ────────────────────────────────────────────────────
    // The landscape art grass tops sit at Y≈1400–1500 in the 3333-unit scene.
    // Trees base slightly below the grass top so they root into the hill.
    // Nudged down ~120-150 units from the previous pass, which was reading as
    // floating above the bank rather than rooted in the grass.
    const pines = [
      // Left bank — this shoreline reads closer to camera, so these are bigger
      // and grounded lower than the right bank. Pulled further left/down from
      // the lake edge so none of them sit over open water.
      // Scale increased ~1.7x from the original values here -- those were
      // tuned before boulders/plants existed this session and were never
      // checked against them. Confirmed directly: at the old scale, a pine
      // rendered SMALLER than the boulder next to it (130px vs 147px tall),
      // when a real tree should tower over a boulder, not lose to it.
      { x: 90,   y: 1800, scale: 0.18 },
      { x: 380,  y: 1840, scale: 0.20 },
      { x: 220,  y: 1820, scale: 0.19 },
      { x: 560,  y: 1810, scale: 0.17 },
      // Right bank — pulled further right/down for the same reason, and
      // scaled up from the previous pass.
      { x: 4180, y: 1700, scale: 0.13 },
      { x: 4400, y: 1730, scale: 0.14 },
      { x: 4600, y: 1690, scale: 0.13 },
      { x: 4780, y: 1720, scale: 0.12 },
      { x: 4920, y: 1740, scale: 0.11 },
    ];

    if (makeDetailedPine) window.__pineInstances = pines.map(p => {
      const tree = makeDetailedPine({...p, season: 'spring'});
      treeOverlay.appendChild(tree);
      return tree;
    });
    window.__generatedTreeCount = pines.length;

    // ── HERO TREE (isolated aspen cutout) ────────────────────────────────
    // isoTree is now created in buildForeground() using the unified
    // world-coordinate system (see placeImage('isoTree', ...) above) -- this
    // used to be a second, separate creation here using the old CSS-percent
    // positioning system, left behind when that refactor happened. Having
    // both meant two #isoTree elements existed at once, one correctly
    // positioned and one not, which is exactly what was causing the tree to
    // appear to float independently of everything else.
    window.__heroTree = null;

    // ── BIG FOREGROUND FOLIAGE BUSH ──────────────────────────────────────────
    // This goes into plateFx AFTER the pine treeOverlay in plateMidground,
    // so it renders on top of everything except UI.
    // It's the large-leaf tropical-ish plant cluster on the right edge.
    // Moved here from plateForeground so it correctly occludes all trees.
    const fgBush = mk('svg', {
      id: 'fgBush', viewBox: `0 0 ${VW} ${VH}`,
      preserveAspectRatio: 'xMidYMid slice',
      style: 'position:absolute;inset:0;pointer-events:none;overflow:visible'
    });
    $('plateFx').appendChild(fgBush);

    const mkB = (tag, attrs) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      fgBush.appendChild(e); return e;
    };
    const lb = { x: VW * 1.02, y: VH * 0.78 };
    [
      [-80,-280,-200,-520,-80,-560], [0,-320,-80,-600,60,-620],
      [80,-260,80,-500,220,-520],    [160,-180,300,-380,340,-360],
      [-160,-180,-320,-340,-360,-300],[0,-200,0,-420,80,-440],
    ].forEach(([cx1,cy1,cx2,cy2,ex,ey]) => {
      mkB('path', { d:`M${lb.x},${lb.y} C${lb.x+cx1},${lb.y+cy1} ${lb.x+cx2},${lb.y+cy2} ${lb.x+ex},${lb.y+ey}`,
        stroke:'#1e5e35', 'stroke-width':'28', fill:'none', 'stroke-linecap':'round', opacity:'0.9' });
      mkB('path', { d:`M${lb.x},${lb.y} C${lb.x+cx1},${lb.y+cy1} ${lb.x+ex+20},${lb.y+ey} ${lb.x+ex},${lb.y+ey} C${lb.x+cx2-20},${lb.y+cy2} ${lb.x+cx1+20},${lb.y+cy1} ${lb.x},${lb.y}`,
        fill:'#2d8050', opacity:'0.85' });
    });
    mkB('line', { x1:lb.x, y1:lb.y, x2:lb.x, y2:VH,
      stroke:'#4a3020', 'stroke-width':'28', 'stroke-linecap':'round' });
  })();

  // ── 9. SEASON TABS + TRAVEL() ─────────────────────────────────────────────
  const SEASON_VIEW = { 1:'studio', 2:'signal', 3:'workshop', 0:'lab' };
  // tod targets: spring=late-morning, summer=noon, fall=dusk, winter=deep-night
  const SEASON_TOD  = { 0:0.50, 1:0.50, 2:0.50, 3:0.50 };
  // wind base: [winter, spring, summer, fall] → matches kf() index order
  // kf(s, [winter, spring, summer, fall])
  const SEASON_S    = { 0:0, 1:1, 2:2, 3:3 }; // int season → kf s index
  let SEASON = 1;
  let NIGHT_MODE = false;
  let _travelRaf = null;

  function showViews(season) {
    const view = SEASON_VIEW[season];
    document.querySelectorAll('.hero-copy .view, .about .view').forEach(v =>
      v.classList.toggle('on', v.getAttribute('data-view') === view));
  }

  // travel(fromS, toS): animated season crossfade — 4.2s total
  // TWEEN holds {a,b,p,mc}: a=from, b=to, p=raw 0-1, mc=content-mix 0-1
  // mc: 0 until 36%, crosses 0→1 between 36-64% (under the darkest frame), holds 1 after.
  function travel(fromS, toS, onDone) {
    if (_travelRaf) cancelAnimationFrame(_travelRaf);
    // Longer than before (was 4.2s) so each phase below has room to actually
    // read as fading rather than snapping -- per the brief: nature's own
    // rhythm is a timelapse rushing through the change, then slowing down
    // to play the new season's timeline in real time, not a hard cut.
    const DURATION = 7000; // ms
    const startTime = performance.now();
    TWEEN = { a: fromS, b: toS, p: 0, mc: 0 };
    let contentSwapped = false;

    // Night mode is a manual toggle (see modeBtn wiring below), independent
    // of season -- it can apply to any of the four. Moon eligibility now
    // follows that flag directly rather than "is winter involved", since
    // winter itself is no longer tied to night (that was the bug fixed
    // last round: winter should be cold/snowy, not literally nighttime).

    // Snap to .hiding during transition
    const hero = $('hero');
    if (hero) hero.classList.add('hiding');

    // Three phases, each with a deliberately different feel:
    //   A "fade down"  0%-25%  -- brisk, steady pace: a sped-up timelapse
    //                             rushing through the change, not eased.
    //   B "hold/swap"  25%-35% -- brief neutral dark pause where season
    //                             content and colors actually swap, hidden
    //                             by darkness rather than visible mid-fade.
    //   C "fade up"    35%-100%-- slow, decelerating settle into the new
    //                             season -- the dominant portion, "starts
    //                             to play that season's timeline" rather
    //                             than popping into its final state.
    const PHASE_A_END = 0.25, PHASE_B_END = 0.35;

    (function step(now) {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / DURATION, 1);

      // mc: content/color swap happens across phase B only, not the old
      // 36%-64% window -- narrower and earlier, matching the new phase
      // boundaries.
      const mc = p < PHASE_A_END ? 0 : p > PHASE_B_END ? 1 : (p - PHASE_A_END) / (PHASE_B_END - PHASE_A_END);
      TWEEN.mc = mc;

      // Overall progress: linear (steady, brisk) through A+B, then a cubic
      // ease-out through C. Deliberately asymmetric -- the old symmetric
      // smoothstep treated "hiding the transition" and "revealing the new
      // season" as mirror images, when they should feel different: quick
      // and businesslike going dark, slow and natural settling in.
      let ps;
      if (p < PHASE_B_END) {
        ps = p;
      } else {
        const t = (p - PHASE_B_END) / (1 - PHASE_B_END);
        const eased = 1 - Math.pow(1 - t, 3);
        ps = PHASE_B_END + eased * (1 - PHASE_B_END);
      }
      TWEEN.p = ps;

      // Time of day: sets from the FROM season's tod down to night by the
      // end of phase A, holds at night through phase B, then rises to the
      // TO season's tod across phase C with the same ease-out as
      // everything else -- a direct interpolation between two daytime
      // tods (spring's 0.40 to summer's 0.52, say) would never pass
      // through darkness at all, which is why this dips through night on
      // every transition regardless of the specific endpoints.
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

      // Moon eligibility follows night mode directly -- constant for the
      // whole transition, unlike the old winter-specific version where
      // "from" and "to" could genuinely differ.
      window.__moonEligible = NIGHT_MODE ? 1 : 0;

      // Swap content right as colors finish swapping (end of phase B),
      // then the rest of phase C is the slow settle with content already
      // in place -- not a separate, later swap point.
      if (p >= PHASE_B_END && !contentSwapped) {
        contentSwapped = true;
        showViews(SEASON);
        if (hero) hero.classList.remove('hiding');
      }

      if (p < 1) {
        _travelRaf = requestAnimationFrame(step);
      } else {
        // Done — settle
        TWEEN = null;
        s = toS;
        LIGHT.tod = targetTod;
        window.__moonEligible = NIGHT_MODE ? 1 : 0;
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

    // Boulders, plants, flowers, and deciduous trees previously updated
    // their target color immediately at t=0, with the boulders/plants
    // easing continuously via CSS across the full 4.2s. But the mountain/
    // lake system (driven by travel()'s TWEEN.mc) holds at the OLD color
    // for the first 36% of that duration, crossfades during the middle
    // 28%, then holds at the NEW color for the last 36% -- deliberately
    // timed so the season swap happens during the darkest point of the
    // simulated day/night transition, not visibly mid-scene. Two different
    // rhythms sharing only a total duration meant boulders were often
    // already mostly transitioned while mountains sat frozen, then
    // mountains did a compressed catch-up after boulders had settled --
    // confirmed directly by sampling both over an actual transition.
    // Delaying these calls to fire at the same 36% mark (and shortening
    // their CSS transition to the same 28% window, in components.js)
    // synchronizes both systems to one shared rhythm instead of two.
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
    }, MC_START_DELAY);

    // Wind base: [winter, spring, summer, fall]
    const windTarget = kfRaw(SEASON_S[season], [0.15, 0.30, 0.35, 0.55]);
    setWind(windTarget);

    // Animated crossfade via travel()
    const fromS = SEASON_S[prevSeason];
    const toS   = SEASON_S[season];
    travel(fromS, toS, () => {
      showViews(season);
    });
  }

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => setSeason(+t.dataset.season));
  });

  // Night mode: a manual toggle independent of season, previously a dead
  // button with no JS behind it at all. Lighter-weight than a full season
  // travel() -- only tod and moon visibility change here, not colors or
  // page content, so a simple smoothstep is enough; no need for the
  // asymmetric timelapse pacing that's specifically there to hide a season
  // swap. Switching seasons while this is on is handled in travel() itself
  // (targetTod respects NIGHT_MODE), so night mode stays applied across
  // whichever season you switch to next.
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

  // Boot on spring
  s = 1;
  showViews(1);
  LIGHT.tod = SEASON_TOD[1];
  setWind(kfRaw(1, [0.15, 0.30, 0.35, 0.55]));

  window.s = () => s; // expose season clock for debugging
  console.log('scene.js v1789290000 — keyframe engine + travel() live. setSeason/setTOD/setDim/play available.');
}
