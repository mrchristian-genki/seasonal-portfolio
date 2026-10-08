/* THE GETAWAY -- a hidden tropical beach, reached by the fisherman's paper boat.
   Tap the boat on the lake (spring to fall): it sails off, a wave washes over the view and
   recedes on a beach where the same boat sails into the bay. "Sail home" (or tapping the boat)
   brings you back the same way. Links: ?beach or ?getaway (+ sunset or night for the evening look).
   Nothing of the beach loads until someone goes: its stylesheet, drawing code and ~0.9 MB of
   art are fetched on the first trip. While away the lake is hidden, its main loop and its
   wildlife pause, and its tap spots are off, so only one scene is ever running. The beach is
   drawn from a scene recipe (the parts catalog's tropical-beach test), cover-fitted to the
   hero box with mouse parallax on desktop. */
(function () {
  const core = document.getElementById('sceneCore');
  if (!core) return;
  const V = '?v=1793260000', A = (f) => 'assets/getaway/' + f + V;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SEA = 'hue-rotate(38deg) saturate(.7) brightness(.72)', BACKLIT = 'sepia(.35) hue-rotate(-25deg) saturate(.9) brightness(.55)';
  const SCENE = {
    world: { w: 1375, h: 767 },
    sky: ['#028fce 0%', '#1b9dd4 16%', '#33aad8 30%', '#4fb7dc 44%', '#76c4df 58%', '#98cfe1 72%', '#a9d6e3 100%'],
    layers: [
      { proc: 'sky', box: [-420, -20, 2215, 450], depth: 0.3, time: 'sunset',
        opts: { stops: [[0, '#2f2656'], [0.25, '#5d3a72'], [0.5, '#a9527a'], [0.72, '#e98363'], [0.9, '#fbbd73'], [1, '#fde0a0']] } },
      { proc: 'sun', box: [560, 285, 280, 280], depth: 0.3, time: 'sunset', opts: { r: 46 } },
      { src: A('clouds-bank.webp'), box: [-40, 0, 1455, 452], depth: 0.45, anim: 'drift-slow', time: 'day' },
      { src: A('cloud-drift.webp'), box: [246, 90, 423, 96], depth: 0.5, anim: 'drift', time: 'day' },
      { src: A('cloud-sunset-06.webp'), box: [620, 20, 440, 221], depth: 0.4, anim: 'drift-slow', time: 'sunset' },
      { src: A('cloud-sunset-05.webp'), box: [-60, 150, 560, 346], depth: 0.45, anim: 'drift-slow', time: 'sunset' },
      { src: A('cloud-sunset-07.webp'), box: [860, 170, 580, 323], depth: 0.45, anim: 'drift-slow', time: 'sunset' },
      { src: A('cloud-sunset-04.webp'), box: [300, 80, 330, 102], depth: 0.5, anim: 'drift', time: 'sunset' },
      { src: A('cloud-dusk-05.webp'), box: [420, 368, 440, 101], depth: 0.4, time: 'sunset' },
      { proc: 'sea', box: [-120, 425, 1615, 260], depth: 0.75, time: 'day', opts: { sunX: 0.508 } },
      { proc: 'sea', box: [-120, 425, 1615, 260], depth: 0.75, time: 'sunset',
        opts: { sunX: 0.508, glint: '#ffe2a6', horizon: '#3a2f63', streak: '#ffd9c2',
                colors: [[0, '#3b3470'], [0.06, '#4d4282'], [0.4, '#65539a'], [0.75, '#8a66a0'], [1, '#b27f9e']] } },
      { proc: 'sunpath', box: [360, 427, 700, 200], depth: 0.75, time: 'sunset', opts: { x: 0.49 } },
      { proc: 'beach', box: [-80, 560, 1535, 240], depth: 0.9, time: 'day', opts: { shore: 0.37, reach: 0.26, surf: 0.17 } },
      { proc: 'beach', box: [-80, 560, 1535, 240], depth: 0.9, time: 'sunset',
        opts: { shore: 0.37, reach: 0.26, surf: 0.17, foam: '#ffe9df', foamBack: '#caa6c4', wet: '#a8684f',
                sand: [[0, '#f0bf8e'], [0.5, '#e7a878'], [1, '#d38b62']],
                wash: [[0, '#7c66a8', 0.95], [0.6, '#a07fae', 0.85], [1, '#e2b0b0', 0.75]] } },
      { id: 'boat', src: A('boat.webp'), box: [408, 348, 73, 97], depth: 0.75, anim: 'bob', grade: { sunset: 'sepia(.45) saturate(1.3) brightness(.9)' } },
      { svg: 'birds', box: [380, 0, 600, 190], depth: 0.6, anim: 'glide', grade: { sunset: 'brightness(.22)' } },
      { src: A('palm-left.webp'), box: [20, 8, 392, 475], depth: 1.0, anim: 'sway', origin: '6% 100%', grade: { sunset: BACKLIT } },
      { src: A('palm-right.webp'), box: [954, 4, 420, 463], depth: 1.0, anim: 'sway-b', origin: '94% 100%', grade: { sunset: BACKLIT } },
      { src: A('frame-flowers.webp'), box: [-60, 300, 1496, 490], depth: 1.12, anim: 'rustle', origin: '50% 100%', grade: { sunset: BACKLIT } },
    ],
    birds: [[22, 44, 13], [106, 18, 11], [130, 38, 11], [160, 20, 9], [95, 72, 11], [126, 96, 10],
            [200, 124, 12], [325, 50, 10], [420, 130, 8], [420, 168, 8], [575, 98, 12]],
  };

  let ready = null, stage = null, world = null, home = null, wave = null, boatEl = null;
  const els = [];
  let active = false, busy = false, sc = 1, range = 0, cam = 0, target = 0, raf = 0;

  const addCss = () => new Promise((res) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/getaway.css?v=1794800000'; l.onload = l.onerror = res; document.head.appendChild(l); });
  const addJs = () => new Promise((res) => { const s = document.createElement('script'); s.src = 'js/getaway-procedural.js' + V; s.onload = s.onerror = res; document.head.appendChild(s); });
  let cssP = null;
  const css = () => cssP || (cssP = addCss());
  function makeWave() {   // the wave exists before the beach does: it covers the view while the beach loads
    if (wave) return;
    wave = document.createElement('div'); wave.className = 'gw-wave'; wave.setAttribute('aria-hidden', 'true');
    core.insertBefore(wave, document.getElementById('plateUi'));
  }
  function load() {
    if (ready) return ready;
    ready = Promise.all([css(), addJs()]).then(() => {
      build();
      const imgs = [...stage.querySelectorAll('img')];
      return Promise.race([Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))), new Promise((r) => setTimeout(r, 6000))]);
    });
    return ready;
  }

  function gulls(list, w, h) {
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    list.forEach(([x, y, s], i) => {
      const g = document.createElementNS(NS, 'g'); g.setAttribute('transform', `translate(${x} ${y})`);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${-s} ${-s * 0.35} Q${-s * 0.45} ${-s * 0.5} 0 ${s * 0.12} Q${s * 0.45} ${-s * 0.5} ${s} ${-s * 0.35} Q${s * 0.45} ${-s * 0.2} 0 ${s * 0.3} Q${-s * 0.45} ${-s * 0.2} ${-s} ${-s * 0.35}Z`);
      p.setAttribute('class', 'gw-gull'); p.style.animationDelay = `${-(i * 0.37) % 1.4}s`;
      g.appendChild(p); svg.appendChild(g);
    });
    return svg;
  }
  function build() {
    stage = document.createElement('div'); stage.className = 'gw-stage'; stage.hidden = true;
    stage.setAttribute('aria-label', 'A tropical beach: the getaway');
    stage.style.background = `linear-gradient(180deg, ${SCENE.sky.join(', ')})`;
    world = document.createElement('div'); world.className = 'gw-world'; stage.appendChild(world);
    SCENE.layers.forEach((l) => {
      const outer = document.createElement('div'); outer.className = 'gw-layer';
      const inner = document.createElement('div'); inner.className = 'gw-inner' + (l.anim && !reduced ? ' a-' + l.anim : '');
      if (l.origin) inner.style.transformOrigin = l.origin;
      if (l.svg === 'birds') inner.appendChild(gulls(SCENE.birds, l.box[2], l.box[3]));
      else if (l.proc) { if (window.PROC) inner.appendChild(window.PROC[l.proc](l.box[2], l.box[3], l.opts)); }
      else { const img = new Image(); img.src = l.src; img.alt = ''; img.decoding = 'async'; inner.appendChild(img); }
      if (l.time) outer.dataset.time = l.time;
      if (l.grade) for (const t in l.grade) outer.style.setProperty(`--grade-${t}`, l.grade[t]);
      if (l.id === 'boat') { boatEl = outer; outer.style.cursor = 'pointer'; outer.style.pointerEvents = 'auto'; outer.addEventListener('click', () => goHome()); }
      outer.appendChild(inner); world.appendChild(outer); els.push({ l, el: outer });
    });
    home = document.createElement('button'); home.type = 'button'; home.className = 'gw-home'; home.textContent = '⛵ Sail home';
    home.addEventListener('click', () => goHome());
    const ui = document.getElementById('plateUi');
    core.insertBefore(stage, wave || ui);
    home.hidden = true;
    (core.closest('.hero') || core).appendChild(home);   // on the visible hero, not the (wider on phones) scene
    stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && range) aim((e.offsetX / stage.clientWidth) * range); });
    addEventListener('resize', () => { if (active) layout(); });
  }
  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight;
    sc = Math.max(W / SCENE.world.w, H / SCENE.world.h) * 1.08;
    const ww = SCENE.world.w * sc, wh = SCENE.world.h * sc;
    Object.assign(world.style, { width: ww + 'px', height: wh + 'px', top: (H - wh) + 'px' });   // bottom-anchored, like the lake
    range = Math.max(0, ww - W);
    els.forEach(({ l, el }) => { const [x, y, w, h] = l.box; Object.assign(el.style, { left: x * sc + 'px', top: y * sc + 'px', width: w * sc + 'px', height: h * sc + 'px' }); });
    target = cam = range * 0.5; paint();
  }
  function paint() { const mid = range / 2; els.forEach(({ l, el }) => { el.style.transform = `translate3d(${-mid - (cam - mid) * l.depth}px,0,0)`; }); }
  function glide() { cam += (target - cam) * 0.12; paint(); raf = Math.abs(target - cam) > 0.3 ? requestAnimationFrame(glide) : 0; }
  const aim = (x) => { target = Math.min(Math.max(x, 0), range); if (!raf) raf = requestAnimationFrame(glide); };

  const isNight = () => document.documentElement.classList.contains('night-page') || (window.__moonEligible || 0) > 0.5;
  let forceSunset = false;
  const setTime = () => { stage.dataset.time = forceSunset || isNight() ? 'sunset' : 'day'; };
  setInterval(() => { if (active) setTime(); }, 1500);   // night mode switched while away

  function washOver(up) {   // the wave rises over the view (up) or falls away (down)
    if (reduced) return Promise.resolve();
    const kf = up ? [{ transform: 'translateY(102%)' }, { transform: 'translateY(-12%)' }] : [{ transform: 'translateY(-12%)' }, { transform: 'translateY(102%)' }];
    return wave.animate(kf, { duration: up ? 950 : 1100, easing: up ? 'cubic-bezier(.45,0,.7,1)' : 'cubic-bezier(.3,0,.55,1)', fill: 'forwards' }).finished;
  }
  function setUrl(on) {
    try {
      const words = decodeURIComponent(location.search.slice(1)).split(/[+&,;\s]+/).filter((w) => w && !/^(beach|getaway|sunset)$/i.test(w));
      if (on) words.push('beach');
      history.replaceState(null, '', location.pathname + (words.length ? '?' + words.join('+') : '') + location.hash);
    } catch (e) { /* ignore */ }
  }
  function pauseLake(on) {
    window.__away = on;
    core.classList.toggle('gw-away', on);
    const af = document.getElementById('auroraFill'); if (af) af.style.visibility = on ? 'hidden' : '';
    if (window.__wildlife) window.__wildlife.paused = on;
    if (on && window.__storm && window.__storm.on) window.__storm.set(false);
  }

  async function go(opts) {
    if (active || busy) return;
    busy = true;
    await css(); makeWave();
    const loading = load();
    if (!(opts && opts.instant)) await washOver(true); else await loading;
    await loading;
    if (!stage) { busy = false; return; }
    setTime(); pauseLake(true); stage.hidden = false; home.hidden = false; layout();
    if (boatEl && !reduced) { boatEl.classList.remove('gw-arrive'); void boatEl.offsetWidth; boatEl.classList.add('gw-arrive'); }
    active = true; setUrl(true);
    if (!(opts && opts.instant)) await washOver(false); else wave.style.transform = 'translateY(102%)';
    busy = false;
  }
  async function goHome() {
    if (!active || busy) return;
    busy = true;
    home.classList.add('gw-out');   // the button fades as the wave comes
    await washOver(true);
    stage.hidden = true; home.hidden = true; home.classList.remove('gw-out'); pauseLake(false); active = false; setUrl(false); forceSunset = false;
    if (boatEl) boatEl.classList.remove('gw-arrive');
    await washOver(false);
    busy = false;
  }
  window.__getaway = { go, home: goHome, get active() { return active; } };

  // ?beach / ?getaway open straight on it (+ sunset or night for the evening look).
  const words = window.__linkWords || [];
  if (words.some((w) => w === 'beach' || w === 'getaway')) {
    forceSunset = words.includes('sunset');
    setTimeout(() => go({ instant: true }), 900);
  }
})();
