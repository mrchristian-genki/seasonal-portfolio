// SPYGLASS CAMERA -- phones held upright see the lake through a spyglass instead of a shrunken
// postcard. css/scene.css (the "SPYGLASS" block) makes .scene-core, the whole plate stack, about
// twice as wide as the phone and much taller. Every world layer is sized from the core, so nothing
// inside it changes. This file is the camera: it slides the core sideways under the hero's window.
//
//   - Shots: each tab (season) has its own framing. A season change closes the iris shutter,
//     cuts to the new shot and opens again; the page also loads behind the closed iris.
//   - Swipe sideways on the scene to look around (vertical swipes still scroll the page).
//   - Left alone, the glass drifts to a nearby spot now and then, and swings to any animal that
//     walks in out of view.
//   - Parallax: sun/moon, aurora and clouds are further away, so they slide less than the ground.
//
// At rest the camera is plain layout (`left`, see place()); a glide is a CSS transition the browser
// runs itself (see setCam() for why not a resting transform). Only a drag writes every frame.
// Wide screens and landscape phones never see any of this.
(function spyglass() {
  const $ = (id) => document.getElementById(id);
  const hero = $('hero'), core = $('sceneCore'), copy = $('heroCopy');
  if (!hero || !core || !copy || !window.matchMedia) return;
  const mq = matchMedia('(max-width: 820px) and (orientation: portrait)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Where each tab points the glass, as the world-x fraction at the centre of the view.
  // data-season: 1 Books/spring, 2 Web/summer, 3 Workshop/fall, 0 Lab/winter.
  const SHOTS = { 1: 0.30, 2: 0.62, 3: 0.78, 0: 0.47 };
  // Spots the idle glass drifts between: left pines, boulders, the peaks, lake, sun and pines, tent, tree.
  const GLANCES = [0.18, 0.3, 0.44, 0.55, 0.66, 0.78, 0.86];
  // How far each plate slides when the camera pans (1 = with the ground). Sky has no features.
  const PARALLAX = { plateCelestial: 0.45, plateAurora: 0.3, plateClouds: 0.7 };

  let on = false, viewW = 0, coreW = 0, camX = 0;
  let userUntil = 0, subject = null, glanceT = 0, followT = 0;
  const parEls = Object.keys(PARALLAX).map((id) => [$(id), PARALLAX[id]]).filter((p) => p[0]);
  let lens = null, track = null, win = null;

  const clampX = (x) => Math.max(0, Math.min(coreW - viewW, x));
  const selectedSeason = () => { const t = document.querySelector('.tab[aria-selected="true"]'); return t ? +t.dataset.season : 1; };
  const xForFrac = (f) => clampX(f * coreW - viewW / 2);

  // Placement at rest is plain layout (`left`), so a resting camera adds no composited layers:
  // a transform on the core would keep the whole 2x-wide plate stack as one big layer, and layer
  // memory is what reloads the page on iPhone (see the will-change note in scene.css). A glide is
  // a FLIP: jump the layout to the destination, offset back with `translate`, and transition the
  // offset to zero. The browser promotes layers only while that runs and drops them after.
  let animT = 0;
  function place(x) {
    core.style.left = `${-x}px`;
    parEls.forEach(([el, f]) => { const o = (x * (1 - f)).toFixed(1); el.style.left = `${o}px`; el.style.right = `${-o}px`; });
    // The hero text stays in the UI plate (lifting it out above the plates cost ~2 s of first
    // paint in headless Chromium: extra overlap layers), counter-placed so it holds still.
    copy.style.left = `${x + 18}px`;
    if (win) win.style.left = (x / coreW * 100).toFixed(2) + '%';
  }
  // Where the view is right now, mid-glide or mid-drag included.
  function visualX() {
    const t = core.style.translate ? parseFloat(getComputedStyle(core).translate) || 0 : 0;
    return camX - t;
  }
  function offset(from, tr) {               // draw the camera at `from` while laid out at camX
    const d = camX - from;
    core.style.transition = tr; core.style.translate = d ? `${d}px 0` : '';
    parEls.forEach(([el, f]) => { el.style.transition = tr; el.style.transform = d ? `translateX(${(-d * (1 - f)).toFixed(1)}px)` : ''; });
    copy.style.transition = tr; copy.style.translate = d ? `${-d}px 0` : '';
  }
  function settle() {
    clearTimeout(animT);
    core.style.transition = core.style.translate = '';
    parEls.forEach(([el]) => { el.style.transition = el.style.transform = ''; });
    copy.style.transition = copy.style.translate = '';
  }
  // ms 0 = jump. Eased like a hand swinging the glass: slow off, slow in.
  function setCam(x, ms, ease) {
    const from = visualX();
    camX = clampX(x);
    settle();
    place(camX);
    if (!ms || reduced || Math.abs(camX - from) < 1) return;
    offset(from, 'none');
    core.offsetWidth; // commit the start state
    const tr = `translate ${ms}ms ${ease || 'cubic-bezier(.45,0,.2,1)'}, transform ${ms}ms ${ease || 'cubic-bezier(.45,0,.2,1)'}`;
    offset(camX, tr);
    animT = setTimeout(settle, ms + 60);
    if (win) { win.style.transition = `left ${ms}ms ease`; setTimeout(() => { if (win) win.style.transition = ''; }, ms); }
    if (lens && ms > 900) { lens.classList.add('sweep'); clearTimeout(lens.__t);
      lens.__t = setTimeout(() => lens.classList.remove('sweep'), ms * 0.8); }
  }
  // During a drag: layout stays at the drag's start, only the offset follows the finger.
  function dragTo(x) {
    x = clampX(x);
    offset(x, 'none');
    if (win) win.style.left = (x / coreW * 100).toFixed(2) + '%';
  }
  const glide = (x, ms) => setCam(x, ms == null ? 2600 : ms);

  // ── iris shutter ──
  // Six blades, like an old lens aperture. It opens on load and closes over every season cut, so
  // the camera can jump (no huge promoted layers for a long glide) and the scene repaints unseen.
  // Each blade is a plain solid-colour box: browsers composite those without a bitmap, so the
  // blades cost next to nothing to move, even full-screen on a phone.
  // Blade i covers the half-plane beyond a line r px from the centre, turned i*60deg; at r = 0 the
  // six cover everything, and a twist while they move gives the iris its swirl.
  const iris = {
    el: null, blades: [], D: 0, t: 0,
    build() {
      const el = document.createElement('div');
      el.className = 'spy-iris'; el.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 6; i++) { const b = document.createElement('b'); el.appendChild(b); iris.blades.push(b); }
      iris.el = el;
    },
    pose(open, ms) {
      const D = iris.D = Math.ceil(Math.hypot(hero.clientWidth, hero.clientHeight));
      iris.blades.forEach((b, i) => {
        Object.assign(b.style, { width: `${2 * D}px`, height: `${D}px`, marginLeft: `${-D}px`, marginTop: `${-D}px` });
        b.style.transition = ms ? `transform ${ms}ms cubic-bezier(.6,0,.3,1)` : 'none';
        b.style.transform = `rotate(${i * 60 + (open ? 0 : 32)}deg) translateY(${open ? -0.62 * D : 0}px)`;
      });
    },
    run(open, ms) {
      if (!iris.el) return Promise.resolve();
      clearTimeout(iris.t);
      iris.el.hidden = false;
      iris.el.offsetWidth;
      iris.pose(open, ms);
      return new Promise((res) => { iris.t = setTimeout(() => { if (open) iris.el.hidden = true; res(); }, ms + 30); });
    },
    close: (ms) => iris.run(false, ms),
    open: (ms) => iris.run(true, ms),
  };
  const frames = (n) => new Promise((res) => { const f = () => (--n > 0 ? requestAnimationFrame(f) : res()); requestAnimationFrame(f); });
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  // Season change: shutter down, cut to the new shot, give it a moment to paint, shutter up.
  let cutting = 0;
  async function cut(x) {
    if (reduced || !iris.el) { setCam(x, 0); return; }
    const my = ++cutting;
    await iris.close(360);
    if (my !== cutting || !on) return;
    setCam(x, 0);
    await frames(2); await wait(180);
    if (my === cutting && on) iris.open(620);
  }

  function measure() {
    viewW = hero.clientWidth;
    coreW = core.offsetWidth;
  }

  function enter() {
    on = true;
    hero.classList.add('spyglass');
    if (!lens) {
      lens = document.createElement('div'); lens.className = 'spy-lens'; lens.setAttribute('aria-hidden', 'true');
      track = document.createElement('div'); track.className = 'spy-track';
      track.setAttribute('aria-hidden', 'true');
      win = document.createElement('i'); track.appendChild(win);
      track.addEventListener('click', (e) => {
        const r = track.getBoundingClientRect();
        userUntil = performance.now() + 12000;
        glide((e.clientX - r.left) / r.width * coreW - viewW / 2, 1400);
      });
    }
    hero.insertBefore(lens, core.nextSibling);
    hero.appendChild(track);
    if (!reduced && !iris.el) {
      // First time only: the page loads behind a closed iris, which opens once the scene has
      // been built and had a moment to paint.
      iris.build(); hero.appendChild(iris.el); iris.pose(false, 0);
      const reveal = () => frames(2).then(() => wait(350)).then(() => on && iris.open(900));
      if (document.readyState === 'complete') reveal(); else addEventListener('load', reveal, { once: true });
    } else if (iris.el) hero.appendChild(iris.el);
    measure();
    win.style.width = (viewW / coreW * 100).toFixed(2) + '%';
    setCam(xForFrac(SHOTS[selectedSeason()] ?? 0.5), 0);
  }

  function exit() {
    on = false;
    hero.classList.remove('spyglass');
    copy.style.left = '';
    [lens, track, iris.el].forEach((el) => el && el.remove());
    settle(); core.style.left = '';
    parEls.forEach(([el]) => { el.style.left = el.style.right = ''; });
  }

  function relayout() {
    if (mq.matches !== on) (mq.matches ? enter : exit)();
    else if (on) { const f = (camX + viewW / 2) / (coreW || 1); measure();
      win.style.width = (viewW / coreW * 100).toFixed(2) + '%'; setCam(xForFrac(f), 0); }
  }
  relayout();
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(relayout); });

  // ── tabs: every season has its shot. The camera leaves as the dark dip starts. ──
  let lastSeason = selectedSeason();
  new MutationObserver(() => {
    const s = selectedSeason();
    if (s === lastSeason) return;
    lastSeason = s; subject = null;
    if (on) { userUntil = performance.now() + 9000; cut(xForFrac(SHOTS[s] ?? 0.5)); }
  }).observe(document.querySelector('.tabs') || document.body, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });

  // ── swipe to look around ──
  let drag = null;
  hero.addEventListener('pointerdown', (e) => {
    if (!on || e.button > 0 || e.target.closest('a,button,.spy-track')) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, cam0: 0, live: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
  });
  addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.live) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // a scroll
      if (Math.abs(dx) < 10) return;
      drag.live = true; hero.classList.add('panning');
      setCam(visualX(), 0); drag.cam0 = camX; drag.x0 = e.clientX;
    }
    const dt = Math.max(1, e.timeStamp - drag.lastT);
    drag.v = drag.v * 0.6 + ((e.clientX - drag.lastX) / dt) * 0.4;
    drag.lastX = e.clientX; drag.lastT = e.timeStamp;
    dragTo(drag.cam0 - (e.clientX - drag.x0));
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.live) {
      hero.classList.remove('panning');
      userUntil = performance.now() + 14000; subject = null;
      // Fling: carry the finger's speed on for a moment, then settle.
      const coast = Math.max(-viewW, Math.min(viewW, -drag.v * 200));
      setCam(visualX() + coast, 700, 'cubic-bezier(.2,.7,.3,1)');
      hero.__dragged = performance.now();
    }
    drag = null;
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) { if (drag.live) setCam(visualX(), 0); hero.classList.remove('panning'); drag = null; } });
  // A drag that ends on a link or hidden spot isn't a tap.
  hero.addEventListener('click', (e) => {
    if (hero.__dragged && performance.now() - hero.__dragged < 350) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // ── visitors: swing the glass to an animal that turns up out of view, and keep it framed ──
  if (!reduced) {
    new MutationObserver((recs) => {
      if (!on) return;
      for (const r of recs) for (const n of r.addedNodes) {
        if (n.nodeType === 1 && n.classList.contains('wl-actor')) { subject = n; followSoon(400); return; }
      }
    }).observe(core, { childList: true, subtree: true });
  }
  function followSoon(ms) { clearTimeout(followT); followT = setTimeout(follow, ms); }
  function follow() {
    if (!on || !subject) return;
    if (!subject.isConnected || subject.classList.contains('out')) { subject = null; return; }
    if (performance.now() > userUntil && !drag) {
      const r = subject.getBoundingClientRect(), c = core.getBoundingClientRect();
      if (r.width) {
        const x = r.left + r.width / 2 - c.left;           // in core px
        const vx = x - camX;                               // in view px
        if (vx < viewW * 0.22 || vx > viewW * 0.78) glide(x - viewW / 2, 1800);
      }
    }
    followSoon(1500);
  }

  // ── idle: the glass wanders to a neighbouring spot now and then ──
  function glance() {
    glanceT = setTimeout(glance, 11000 + Math.random() * 9000);
    if (!on || reduced || drag || subject || document.hidden || performance.now() < userUntil) return;
    if (hero.getBoundingClientRect().bottom < 0) return;
    const here = (camX + viewW / 2) / coreW;
    const near = GLANCES.filter((g) => Math.abs(g - here) > 0.05 && Math.abs(g - here) < 0.2);
    if (near.length) glide(xForFrac(near[Math.floor(Math.random() * near.length)]), 4200);
  }
  glanceT = setTimeout(glance, 16000);

  window.__camera = { glide: (f, ms) => on && glide(xForFrac(f), ms), get x() { return camX; }, get on() { return on; } };
})();
