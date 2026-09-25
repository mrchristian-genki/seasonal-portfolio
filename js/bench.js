// Scene benchmark: open index.html?bench (loaded only then; see index.html).
// Runs the scene through a fixed set of states and switches parts of it off one at a time,
// measuring frames per second and slow frames (> 34 ms) for each. Results show in a table at
// the end, ready to screenshot. Nothing here runs on the normal page.
(function () {
  const TOGGLES = [
    ['everything on', ''],
    ['no colour grading', '.grade-layer,.plate{filter:none!important}'],
    ['no clouds', '#plateClouds{display:none!important}'],
    ['no birds', '#plateBirds{display:none!important}'],
    ['no lake shimmer', '#mgFx{display:none!important}'],
    ['no rain/snow/leaves', '#rainCanvas,#mgFxAnim canvas{display:none!important}'],
    ['no stars/aurora', '#plateAurora{display:none!important}'],
    ['no grass/flower sway', '.sway-grass,.sway-grass-mirror,.sway-flower{animation:none!important}'],
    ['no tree/pine sway', '.pine-detailed-sway,.tree-isolated-sway,.aurora-drift{animation:none!important}'],
  ];
  const BARE = TOGGLES.slice(1).filter(t => t[0] !== 'no layer hints' && t[0] !== 'plus big-layer hints').map(t => t[1]).join('\n');
  TOGGLES.push(['all of the above off', BARE]);
  const SCENES = [
    { name: 'Spring day', tab: 1, night: false },
    { name: 'Fall day', tab: 3, night: false },
    { name: 'Winter night', tab: 0, night: true },
  ];
  // Animals: the timers are paused for the whole run (a visitor arriving mid-row made the
  // Sept 24 numbers swing 50 -> 20 fps with nothing toggled), then each is measured on purpose.
  const ANIMALS = [
    ['+ deer walking', 'deer', ''],
    ['+ deer, no layer hint', 'deer', '.wl-actor{will-change:auto!important}'],
    ['+ fisherman', 'fisherman', ''],
    ['+ fox', 'fox', ''],
    ['+ eagle', 'eagle', ''],
  ];
  const W = () => window.__wildlife;
  function clearAnimals() { const w = W(); if (w) w.live.forEach(v => { if (!v.done) v.leave(); }); }
  const liveCount = () => { const w = W(); return w ? [...w.live].filter(v => !v.done).length : 0; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const style = document.createElement('style');
  document.head.appendChild(style);

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:10000;font:13px/1.35 monospace;' +
    'background:rgba(0,0,0,.82);color:#9f9;padding:8px 10px;border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(hud);

  function measure(ms) {
    return new Promise(resolve => {
      let n = 0, slow = 0, t0 = null, prev = null;
      function f(t) {
        if (t0 === null) { t0 = prev = t; }
        else { n++; if (t - prev > 34) slow++; prev = t; }
        if (t - t0 < ms) requestAnimationFrame(f);
        else resolve({ fps: Math.round(n * 1000 / (t - t0)), slow: Math.round(slow * 1000 / (t - t0)) });
      }
      requestAnimationFrame(f);
    });
  }
  const clickTab = s => { const t = document.querySelector(`.tab[data-season="${s}"]`); if (t) t.click(); };
  const nightBtn = () => document.getElementById('modeBtn');
  const isNight = () => nightBtn() && nightBtn().getAttribute('aria-pressed') === 'true';

  async function run() {
    window.scrollTo(0, 0);
    hud.textContent = 'Benchmark starting... keep the page still and at the top, and leave the window in front (about 7 minutes).';
    for (let i = 0; i < 40 && !W(); i++) await sleep(250);          // wildlife loads lazily
    if (W()) W().paused = true;
    clearAnimals();
    await sleep(3000);
    const rows = [];
    for (const sc of SCENES) {
      clickTab(sc.tab);
      if (sc.night !== isNight()) nightBtn().click();
      hud.textContent = `${sc.name}: settling...`;
      await sleep(8500);
      // Paired: each toggle is measured twice, alternating with "everything on" right before it,
      // so anything that drifts during the run (a gust, a passing flock, heat) hits both sides.
      // The row shows the toggle's fps and, after the arrow, the baseline measured beside it.
      hud.textContent = `${sc.name}: everything on`;
      rows.push([sc.name, 'everything on', await measure(4000)]);
      for (const [label, css] of TOGGLES) {
        if (!css) continue;
        hud.textContent = `${sc.name}: ${label}`;
        let on = [], off = [];
        for (let k = 0; k < 2; k++) {
          style.textContent = ''; await sleep(400); on.push(await measure(1800));
          style.textContent = css; await sleep(400); off.push(await measure(1800));
        }
        style.textContent = '';
        const avg = (a, f) => Math.round(a.reduce((n, x) => n + x[f], 0) / a.length);
        rows.push([sc.name, label, { fps: avg(off, 'fps'), slow: avg(off, 'slow'), base: avg(on, 'fps') }]);
      }

      style.textContent = '';
      if (W()) {
        for (const [label, key, css] of ANIMALS) {
          clearAnimals();
          for (let i = 0; i < 20 && liveCount(); i++) await sleep(250);
          style.textContent = css;
          const v = W().start(key, { force: true });
          hud.textContent = `${sc.name}: ${label}`;
          await sleep(2500);                                          // fade in, start moving
          const r = await measure(4000);
          rows.push([sc.name, v ? label : label + ' (n/a)', r]);
        }
        clearAnimals(); style.textContent = '';
        await sleep(1500);
        hud.textContent = `${sc.name}: everything on (no animals)`;
        rows.push([sc.name, 'no animals (again)', await measure(4000)]);
      }
    }
    // Season change (the crossfade is the heaviest moment): measure during the travel itself.
    if (isNight()) { nightBtn().click(); await sleep(3500); }
    for (const [label, css] of [['everything on', ''], ['no colour grading', TOGGLES[1][1]]]) {
      style.textContent = css;
      clickTab(2); await sleep(8500);
      hud.textContent = `Season change: ${label}`;
      clickTab(3); await sleep(500);
      const r = await measure(5000);
      rows.push(['Season change', label, r]);
    }
    style.textContent = '';
    if (W()) W().paused = false;
    const dpr = window.devicePixelRatio, w = innerWidth, h = innerHeight;
    let out = `SCENE BENCHMARK  ${w}x${h} @${dpr}x  ${new Date().toLocaleTimeString()}\n`;
    let last = '';
    rows.forEach(([sc, label, r]) => {
      if (sc !== last) { out += `\n${sc}\n`; last = sc; }
      out += `  ${label.padEnd(24)} ${String(r.fps).padStart(3)} fps  ${String(r.slow).padStart(2)} slow/s` + (r.base != null ? `   (on: ${r.base})` : '') + '\n';
    });
    out += '\n(on: N) = fps with everything on, measured alternately beside that row.\nScreenshot this and send it over.';
    hud.textContent = out;
    hud.style.top = '8px'; hud.style.overflow = 'auto'; hud.style.fontSize = '11px';
    console.log(out);
  }
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
})();
