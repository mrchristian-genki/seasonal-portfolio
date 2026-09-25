// ============================================================
// wildlife.js -- animals that visit the scene, on timers and from hidden taps.
//
// Uses the catalog's creature rigs (creature-shapes.js + creatures.js). Loaded after scene.js;
// everything it needs from the scene is found by element id, so the scene doesn't depend on it.
//
// Rules learned from the Sept 23-24 performance work (see scene-punch-list.md):
//   - each animal is one small HTML layer; it moves with a CSS transform on that layer,
//     never by redrawing the big scene svgs;
//   - no will-change hints;
//   - at most one timed visitor plus the fisherman at a time, and nothing runs while the tab
//     is hidden, the scene is scrolled away, or a season change is playing.
//
// World units match scene.js (VW x VH). Stages say where an animal can appear and which plate
// it sits in, so the scene's own art hides it: e.g. deer stand behind the right-bank pines,
// the fisherman slips behind the banks, a fox rises from behind a boulder.
// ============================================================
(function () {
  if (!window.Creatures || !window.CREATURE_SHAPES) return;
  const VW = 5003.8931, VH = 3333.3333;
  const $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const pct = (v, of) => (v / of * 100).toFixed(4) + '%';

  const css = document.createElement('style');
  css.textContent =
    // World frame: full width, height from width (padding trick: works everywhere, incl. Safari).
    '.wl-frame{position:absolute;left:0;bottom:0;width:100%;height:0;padding-top:' + (VH / VW * 100).toFixed(4) + '%;pointer-events:none}' +
    '.wl-box{position:absolute;pointer-events:none}.wl-clip{overflow:hidden}' +
    // Each actor is its own small GPU layer (the one exception to the no-hints rule: actors are a
    // few hundred px, and without it Safari repaints the animal into the big stage layer on every
    // step of a walk). ?bench measures it both ways.
    '.wl-actor{position:absolute;opacity:0;transform-origin:50% 100%;transition:opacity var(--fade,1.2s) ease;will-change:transform,opacity}' +
    '.wl-actor.on{opacity:1}.wl-actor>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}' +
    // Reflection: mirrored about the feet, faded out downward, a touch of blur (the water).
    '.wl-refl{position:absolute;left:0;top:100%;width:100%;height:100%;pointer-events:none;' +
      '-webkit-mask-image:linear-gradient(#000,transparent 75%);mask-image:linear-gradient(#000,transparent 75%)}' +
    '.wl-refl>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}' +
    // Boat lantern (night): a warm point with a soft halo that flickers, plus its streak on the water.
    '.wl-lamp{position:absolute;width:26%;aspect-ratio:1;margin:-13% 0 0 -13%;border-radius:50%;pointer-events:none;opacity:0;transition:opacity 2s ease;' +
      'background:radial-gradient(closest-side,#fff7d6,rgba(255,200,90,.9) 18%,rgba(255,170,60,.35) 45%,rgba(255,170,60,0));animation:wlLamp 2.3s ease-in-out infinite alternate}' +
    '.wl-lamp.on{opacity:1}' +
    '@keyframes wlLamp{0%{transform:scale(.9)}35%{transform:scale(1.04)}60%{transform:scale(.96)}100%{transform:scale(1.08)}}' +
    '.wl-lampstreak{position:absolute;width:7%;height:60%;margin-left:-3.5%;pointer-events:none;opacity:0;transition:opacity 2s ease;' +
      'background:linear-gradient(rgba(255,196,110,.55),rgba(255,196,110,0));filter:blur(1.5px)}' +
    '.wl-lampstreak.on{opacity:1}' +
    '.wl-hot{position:absolute;pointer-events:auto;-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}' +
    // Magic glow on a tapped trigger rock: a soft warm bloom plus a few rising sparkles.
    '.wl-glow{position:absolute;pointer-events:none;border-radius:50%;opacity:0;' +
      'background:radial-gradient(closest-side,rgba(255,250,220,.95),rgba(255,226,140,.6) 40%,rgba(160,215,255,.25) 70%,rgba(160,215,255,0));' +
      'animation:wlGlow 2.6s ease-out forwards}' +
    '@keyframes wlGlow{0%{opacity:0;transform:scale(.85)}12%{opacity:1;transform:scale(1)}40%{opacity:.75}100%{opacity:0;transform:scale(1.12)}}' +
    '.wl-spark{position:absolute;width:9px;height:9px;margin:-4.5px;border-radius:50%;pointer-events:none;opacity:0;' +
      'background:radial-gradient(closest-side,#fff,rgba(255,236,170,.9) 45%,rgba(255,236,170,0));animation:wlSpark var(--d,1.8s) ease-out var(--dl,0s) forwards}' +
    '@keyframes wlSpark{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(var(--dx,0),var(--dy,-40px)) scale(1.1)}}' +
    '@media (prefers-reduced-motion:reduce){.wl-glow,.wl-spark{animation-duration:.01s}}';
  document.head.appendChild(css);

  // ── scene state (read from the page, no coupling to scene.js internals) ──
  const SEASONS = { 0: 'winter', 1: 'spring', 2: 'summer', 3: 'fall' };
  const season = () => { const t = document.querySelector('.tab[aria-selected="true"]'); return SEASONS[t ? t.dataset.season : 1] || 'spring'; };
  const night = () => { const b = $('modeBtn'); return !!b && b.getAttribute('aria-pressed') === 'true'; };
  const traveling = () => { const h = $('hero'); return !!h && h.classList.contains('hiding'); };
  let sceneVisible = true;

  // ── stages: where animals go (world boxes) and which layer holds them ──
  function worldFrame(host, before) {
    const f = document.createElement('div');
    f.className = 'wl-frame';
    host.insertBefore(f, before || null);
    return f;
  }
  function box(parent, r, clip) {
    const b = document.createElement('div');
    b.className = 'wl-box' + (clip ? ' wl-clip' : '');
    Object.assign(b.style, { left: pct(r[0], VW), top: pct(r[1], VH), width: pct(r[2] - r[0], VW), height: pct(r[3] - r[1], VH) });
    parent.appendChild(b);
    b.rect = r;
    return b;
  }
  const mg = $('plateMidground'), fgItems = $('fgItems'), birds = $('plateBirds'), ui = $('plateUi');
  if (!mg || !fgItems) return;
  const FULL = [0, 0, VW, VH];
  const farFrame = worldFrame(mg, $('mgTrees'));        // behind the pines, on the banks
  const lakeFrame = worldFrame(mg, $('mgShores'));      // on the water, behind both banks
  const frontFrame = worldFrame(mg, $('mgTrees') && $('mgTrees').nextSibling);   // on the banks, IN FRONT of the pines
  const skyFrame = birds ? worldFrame(birds) : null;    // with the bird flock
  const iso = $('isoTree');
  const treeBox = document.createElement('div');       // in front of the hero tree, before the flowers
  treeBox.className = 'wl-box';
  Object.assign(treeBox.style, { left: 0, top: 0, width: '100%', height: '100%' });
  treeBox.rect = FULL;
  if (iso && iso.nextSibling) fgItems.insertBefore(treeBox, iso.nextSibling); else fgItems.appendChild(treeBox);
  // Behind the hero tree (its trunk and the bush at its base hide whatever is back here).
  const behindTree = document.createElement('div');
  behindTree.className = 'wl-box';
  Object.assign(behindTree.style, { left: 0, top: 0, width: '100%', height: '100%' });
  behindTree.rect = FULL;
  if (iso) fgItems.insertBefore(behindTree, iso); else fgItems.appendChild(behindTree);
  // Boulder peeks: clipped at the rocks' lower half, so an animal rising from behind a rock
  // never shows below it. First child of the foreground items, so every rock covers it.
  const rockClip = document.createElement('div');
  rockClip.className = 'wl-box wl-clip';
  const RC = [-100, 1700, 700, 2330];
  Object.assign(rockClip.style, { left: pct(RC[0], VW), top: pct(RC[1], VH), width: pct(RC[2] - RC[0], VW), height: pct(RC[3] - RC[1], VH) });
  rockClip.rect = RC;
  fgItems.insertBefore(rockClip, fgItems.firstChild);
  const STAGE = {
    far: box(farFrame, FULL), front: box(frontFrame, FULL), lake: box(lakeFrame, FULL), sky: skyFrame ? box(skyFrame, FULL) : null,
    tree: treeBox, rock: rockClip, behindTree,
  };
  // Aliases: same layer, but separate "one visitor at a time" slots, so the right bank, the
  // pine tops and the left bank don't block each other (and the fisherman doesn't block the shore).
  STAGE.boat = STAGE.lake; STAGE.bank = STAGE.far; STAGE.pines = STAGE.far; STAGE.left = STAGE.far; STAGE.rockR = STAGE.lake; STAGE.fore = STAGE.behindTree; STAGE.catch = STAGE.lake;
  // Foreground stages sit inside the foreground plate, which already carries the scene's
  // season/night colour grade, so animals there use their day palette.
  const GRADED = new Set(['tree', 'rock', 'behindTree']);

  // ── natural colours ──
  // The catalog draws silhouettes; in the painted scene a near-black animal vanishes against the
  // dark treeline, so each species gets its real coat (d = body, l = the art's light markings).
  // Rig palettes still win where they exist (white winter hare, snowy owl). Stages outside the
  // foreground plate aren't colour-graded by the scene, so at night they're darkened here.
  const painter = (id, graded) => window.Creatures.naturalPaint(id, graded);

  // ── actor: one creature in its own layer, positioned by its bottom-centre anchor ──
  function makeActor(stageName, id, o) {
    const stage = STAGE[stageName];
    if (!stage) return null;
    const r = stage.rect;
    o.phase = rand(0, 5);
    const c = window.Creatures.build(id, {
      season: season(), night: GRADED.has(stageName) ? false : night(),
      behavior: o.behavior, rate: o.rate, phase: o.phase, paint: painter(id, GRADED.has(stageName)),
    });
    // Size: o.h was tuned against the silhouette art. An origami animal keeps the silhouette's
    // on-screen WIDTH (its body length), so a standing fox takes the sitting fox's footprint.
    const vb = c.viewBox;
    let h = o.h;
    if (c.origami && o.hReal) h = o.hReal;              // foreground: a true height for the origami art
    else if (c.origami && window.CREATURE_SHAPES[id]) {
      const sv = window.CREATURE_SHAPES[id].vb;
      h = o.h * (sv[2] / sv[3]) * (vb[3] / vb[2]) * (c.rig.size || 1);
    }
    const w = h * vb[2] / vb[3];
    const el = document.createElement('div');
    el.className = 'wl-actor';
    el.style.setProperty('--fade', (o.fade || 1.2) + 's');
    Object.assign(el.style, {
      left: pct(o.x - w / 2 - r[0], r[2] - r[0]), top: pct(o.y - h - r[1], r[3] - r[1]),
      width: pct(w, r[2] - r[0]), height: pct(h, r[3] - r[1]),
    });
    const facing = c.origami ? 1 : (o.facing || 1);  // origami art all faces right; silhouettes vary
    // o.tilt (deg) turns the art so its head leads the direction of travel (the eagle is drawn
    // banking, head up-right); applied before the mirror, so it works in both directions.
    if (o.tilt) c.svg.style.transition = 'transform 1.2s ease-in-out';   // tilt changes ease in
    const orient = (dir) => (dir !== facing ? 'scaleX(-1) ' : '') + (o.tilt ? 'rotate(' + o.tilt + 'deg)' : '');
    c.svg.style.transform = orient(o.dir || 1);
    el.appendChild(c.svg);
    // Reflection (lake animals and the boat): a second, mirrored copy of the same rig under the
    // feet, faded toward the bottom. Built with the same phase so its motion stays in step; every
    // season / night / behaviour change below is applied to both.
    c.__phase = o.phase;
    let r2 = null;
    if (o.reflect) {
      r2 = window.Creatures.build(id, { season: season(), night: night(), behavior: o.behavior, rate: o.rate,
        phase: c.__phase, paint: painter(id, false) });
      const rw = document.createElement('div');
      rw.className = 'wl-refl';
      rw.style.opacity = o.reflect;
      const mirror = () => { r2.svg.style.transform = ((o.dir || 1) !== facing ? 'scaleX(-1) ' : '') + 'scaleY(-1)'; };
      mirror();
      rw.appendChild(r2.svg);
      el.appendChild(rw);
      ['setSeason', 'setNight', 'setBehavior'].forEach((fn) => { const f = c[fn]; c[fn] = (x) => { f(x); r2[fn](x); }; });
      const d = c.destroy; c.destroy = () => { d(); r2.destroy(); };
    }
    stage.appendChild(el);
    const a = {
      id, el, c, w, h, x: o.x, y: o.y, x0: o.x, y0: o.y, stageName,
      // Move to a world point: a transform on the layer, in % of its own size (no px maths).
      s: 1,
      // Scale is about the feet (bottom centre): a little smaller reads as a little further away.
      at(x, y, sc) {
        a.x = x; a.y = y; if (sc != null) a.s = sc;
        el.style.transform = `translate(${((x - a.x0) / w * 100).toFixed(3)}%,${((y - a.y0) / h * 100).toFixed(3)}%)` +
          (a.s !== 1 ? ` scale(${a.s.toFixed(4)})` : '');
      },
      d: o.dir || 1,
      tilt(deg) { o.tilt = deg; c.svg.style.transform = orient(a.d); },
      face(dir) { a.d = dir; c.svg.style.transform = orient(dir); if (r2) r2.svg.style.transform = (dir !== facing ? 'scaleX(-1) ' : '') + 'scaleY(-1)'; },
      show(on) { el.classList.toggle('on', on !== false); },
      remove() { c.destroy(); el.remove(); },
    };
    return a;
  }

  // ── visits: small scripts with cancellation (a tap or a season change ends them early) ──
  class Cancelled extends Error {}
  function visit(def, opts) {
    const v = { def, done: false, leaving: false, actors: [], hot: opts && opts.hot };
    let wake = null;
    v.wait = (ms) => new Promise((res, rej) => {
      if (v.leaving) return rej(new Cancelled());
      const t = setTimeout(() => { wake = null; res(); }, ms);
      wake = () => { clearTimeout(t); wake = null; rej(new Cancelled()); };
    });
    // Walk/fly from the actor's current spot to x (and optionally y) at a speed in world units/s.
    v.move = (a, x, y, speed, yFn, toScale) => new Promise((res, rej) => {
      if (v.leaving) return rej(new Cancelled());
      const sx = a.x, sy = a.y, ty = y == null ? a.y : y, s0 = a.s, s1 = toScale == null ? a.s : toScale;
      const dist = Math.hypot(x - sx, ty - sy), dur = Math.max(1, dist / speed * 1000);
      const t0 = performance.now();
      let raf = 0;
      const step = (now) => {
        if (v.leaving) { rej(new Cancelled()); return; }
        const t = Math.min(1, (now - t0) / dur);
        const px = sx + (x - sx) * t, py = sy + (ty - sy) * t + (yFn ? yFn(t, now) : 0);
        a.at(px, py, s0 + (s1 - s0) * t);
        if (t < 1) raf = requestAnimationFrame(step); else res();
      };
      raf = requestAnimationFrame(step);
      wake = () => { cancelAnimationFrame(raf); wake = null; rej(new Cancelled()); };
    });
    // Fly along any path: pathFn(t 0..1) -> [x, y], over ms (eased by the path itself).
    v.fly = (a, pathFn, ms, stopIf) => new Promise((res, rej) => {
      if (v.leaving) return rej(new Cancelled());
      const t0 = performance.now(); let raf = 0;
      const step = (now) => {
        if (v.leaving) { rej(new Cancelled()); return; }
        const t = Math.min(1, (now - t0) / Math.max(1, ms)); const [x, y] = pathFn(t); a.at(x, y);
        if (stopIf && stopIf()) { res(); return; }
        if (t < 1) raf = requestAnimationFrame(step); else res();
      };
      raf = requestAnimationFrame(step);
      wake = () => { cancelAnimationFrame(raf); wake = null; rej(new Cancelled()); };
    });
    v.actor = (stage, id, o) => { const a = makeActor(stage, id, o); if (a) v.actors.push(a); return a; };
    v.leave = () => {
      if (v.leaving || v.done) return;
      v.leaving = true;
      if (wake) wake();
    };
    live.add(v);
    (async () => {
      try { await def.run(v, opts || {}); } catch (e) { if (!(e instanceof Cancelled)) console.warn('wildlife', e); }
      // Exit: a visit with its own exit (sinking behind a rock) plays it first; then every actor
      // fades out and is removed.
      if (def.exit) { try { v.leaving = false; await def.exit(v); } catch (_) { /* ignore */ } v.leaving = true; }
      // Visits with their own exit have already faded (or sunk) their actors; let that finish.
      if (!def.exit) v.actors.forEach((a) => { a.el.style.setProperty('--fade', '0.9s'); a.show(false); });
      else v.actors.forEach((a) => a.show(false));
      setTimeout(() => { v.actors.forEach((a) => a.remove()); v.done = true; live.delete(v); }, def.exit ? 1500 : 1000);
    })();
    return v;
  }
  const live = new Set();

  // ── the cast ──
  // when: 'day' | 'night' | 'any'. seasons: list. stage: which layer (for the one-per-stage rule).
  // Positions are world units, tuned against the art (see the zoomed grids in the Sept 24 notes).
  // Big animals live on the FAR shore: the strip where the dark treeline under the mountains
  // meets the water (y ~1592, between the two banks). Far away means small, and the water drawn
  // before them keeps their feet on the shoreline. The doe can also graze on the right bank.
  const SHORE_Y = 1596;                                  // far-shore waterline (feet)
  // Open shoreline between the banks, kept right of the hero text (which covers the lake's left
  // side up to about x 1950). Travellers go left to right, into the open part of the scene.
  const SHORE_X = [2000, 2700];
  const shoreX = () => rand(SHORE_X[0] + 80, SHORE_X[1] - 100);
  const RIGHT_BANK = [2890, 3150, 3450];                 // right-bank grass, behind/between pines
  const RIGHT_BANK_DY = 185;                             // the right bank was lowered by this (scene.js)
  const RIGHT_Y = 1610 + RIGHT_BANK_DY;
  const HERO_DX = 600;                                   // hero tree moved right by this (scene.js rightShift 500 -> 1100)
  // Pine tops on the right bank (tip of each tree), for small distant perched birds.
  const PINE_TOPS = [[3016, 945 + 185], [3308, 885 + 185], [3625, 1025 + 185]];
  // Deer-type walk-in / walk-out. They have no leg cycle, so a slow walk is a glide with a
  // small step bob. In: walk forward out of the trees (from slightly further back and smaller)
  // while fading in. Out: walk on, back into the trees, fading out.
  const bob = (t, now) => -1.4 * Math.abs(Math.sin(now / 260));
  const WALK = 20;                                        // world units/s (distant, so slow)
  // Origami animals have a real walk cycle: use it while moving, then the script picks the pose.
  const walking = (a, on) => { if (a.c.behaviors.includes('walk')) { if (on) { a.prevB = a.c.behavior; a.c.setBehavior('walk'); } else if (a.prevB) a.c.setBehavior(a.prevB); } };
  async function walkIn(v, a, dir, dist) {
    const tx = a.x, ty = a.y;
    a.at(tx - dir * dist, ty - dist * 0.12, 0.9);
    a.el.style.setProperty('--fade', (dist / WALK * 0.8).toFixed(2) + 's');
    await v.wait(60); a.show();
    walking(a, true);
    await v.move(a, tx, ty, WALK, bob, 1);
    walking(a, false);
  }
  async function walkOut(v, a, dir, dist) {
    a.el.style.setProperty('--fade', (dist / WALK).toFixed(2) + 's');
    a.el.style.transitionTimingFunction = 'ease-in';     // stays visible, then melts into the trees
    a.show(false);
    walking(a, true);
    await v.move(a, a.x + dir * dist, a.y - dist * 0.12, WALK, bob, 0.9);
  }
  // A visit's `exit` runs when it ends early too (a tap, a season change), so animals always
  // leave the same way they came.
  const walkAway = (v) => { const a = v.actors[0]; return a ? walkOut(v, a, a.dir, 60) : null; };

  const LAMP = [21, 57];                                // lantern spot on the fisherman art (% of its box)
  // ── foreground visitors: in from behind the hero tree, onto the grass, and back ──
  // The big origami animals up close. Each steps out from behind the hero tree's trunk and bush
  // (the behindTree layer, so the tree covers them on the way in and out), walks left onto the
  // open grass in front of the right bank, grazes / forages / sniffs, then turns and walks back
  // behind the tree, fading as it goes. Sizes are true heights for the origami art (world units),
  // set against the flowers (~100) and the bush (~300): a doe stands about 1.5 bushes tall.
  const FORE = { x0: 4950, xStop: [3850, 4100], y: 2688 };   // x0 = behind the hero tree trunk
  // ONE size table for every origami animal, as art height in world units at foreground scale
  // (doe = 430). Set from real proportions by body LENGTH, since the art heights differ (antlers,
  // a raised head): a black bear on all fours is about a doe's length and much lower; a wolf is a
  // little shorter; a fox about two-thirds; a bull elk the biggest, but not by much at a glance.
  // The far shore and the right bank use the same table scaled down (SIZE_AT), so both sets
  // always match each other.
  // Measured Sept 24: shoulder height as a fraction of each art (doe/buck .603, elk .615, bear .98,
  // wolf trot .749, fox .623), scaled to real shoulder heights (mule deer doe ~3.1 ft, buck 3.45,
  // Rocky Mountain elk 4.75, grizzly 3.9 (the art has a brown bear's hump), gray wolf ~2.4, red fox ~1.3) at 83.6 units per foot.
  const SIZE = { doe: 430, deer: 478, elk: 646, bear: 333, 'wolf-run': 268, 'wolf-howl': 390, fox: 175, marley: 192, hare: 110 };
  // hare: sitting upright with its ears up, ~1.3 ft tall (below Marley's 1.6 ft shoulder).
  // marley: Rhodesian ridgeback x beagle, pit bull sized (~1.6 ft at the shoulder; art shoulder .70).
  const SIZE_AT = { fore: 1, bank: 0.4, far: 0.2 };
  const sized = (id, at) => SIZE[id] * SIZE_AT[at];
  const FORE_SIZE = SIZE;
  async function foreVisit(v, id, moves) {
    const a = v.actor('fore', id, { x: FORE.x0, y: FORE.y, h: 100, hReal: FORE_SIZE[id], dir: -1, behavior: 'walk', fade: 2 });
    a.home = { x0: FORE.x0, y: FORE.y };
    await v.wait(60); a.show();
    walking(a, true);
    await v.move(a, rand(FORE.xStop[0], FORE.xStop[1]), FORE.y + rand(-6, 10), moves.speed || 70, bob);
    for (const [b, t] of moves.steps) { if (a.c.behaviors.includes(b)) { a.c.setBehavior(b); await v.wait(t * 1000 * rand(0.85, 1.15)); } }
  }
  // Backing out: no turn. The animal keeps facing the way it came in and steps slowly backwards
  // (its walk cycle played in reverse) behind the tree / out of view, fading as it goes.
  async function backOut(v, speed, fade) {
    const a = v.actors[0]; if (!a) return;
    a.el.style.setProperty('--fade', fade);
    a.el.style.transitionTimingFunction = 'ease-in';
    a.show(false);
    walking(a, true);
    if (a.c.setRate) a.c.setRate(-0.6);
    // Only as far as it takes to fade (fade seconds x speed), not all the way home: it's gone by
    // then, and a long invisible walk kept its area busy for 20+ s.
    const dist = parseFloat(fade) * speed * 1.1, sx = Math.sign(a.home.x0 - a.x) || 1;
    await v.move(a, a.x + sx * Math.min(dist, Math.abs(a.home.x0 - a.x)), a.home.y, speed, (t, now) => -1 * Math.abs(Math.sin(now / 420)));
  }
  const foreExit = (v) => backOut(v, 38, '4.5s');

  // ── close-up beasts: a rare big moment IN FRONT of the hero tree ──
  // A bear or a bull elk walks in from beyond the right edge, much closer than the foreground
  // visitors (1.7x their size, feet down among the flowers, which stay in front of its legs),
  // pauses, then turns and walks back out the right edge, fading. Tree stage = in front of the
  // hero tree, behind the flowers.
  // Close enough to startle (bear ~2.9x, elk ~2.1x their foreground size): the beast fills the right side of the view (elk antlers reach the
  // far bank). Feet on the last strip of grass before the scene's bottom wave.
  // Sept 24: shy, not bold. They only half emerge from beyond the right edge (hind end stays off
  // screen), feet below the bottom of the view, so what you see is a massive body and head
  // looking about, then backing away. xStop = where the body centre stops.
  const CLOSE = { x0: VW + 1400, xStop: { bear: [4560, 4700], elk: [4520, 4660] }, y: 3420, size: { bear: 1350, elk: 2000 } };
  async function closeVisit(v, id, steps) {
    const a = v.actor('tree', id, { x: CLOSE.x0, y: CLOSE.y, h: 100, hReal: CLOSE.size[id], dir: -1, behavior: 'walk', fade: 2.5 });
    a.home = { x0: CLOSE.x0, y: CLOSE.y };
    await v.wait(60); a.show();
    walking(a, true);
    await v.move(a, rand(CLOSE.xStop[id][0], CLOSE.xStop[id][1]), CLOSE.y, 110, (t, now) => -3 * Math.abs(Math.sin(now / 340)));
    for (const [b, t] of steps) { if (a.c.behaviors.includes(b)) { a.c.setBehavior(b); await v.wait(t * 1000 * rand(0.85, 1.15)); } }
  }
  const closeExit = (v) => backOut(v, 70, '4s');

  const CAST = {
    deer: {
      stage: 'lake', seasons: ['spring', 'summer', 'fall', 'winter'], when: 'any', weight: 3,
      async run(v) {
        const dir = 1;
        const a = v.actor('lake', 'deer', { reflect: 0.32, x: shoreX(), y: SHORE_Y, h: 74, hReal: sized('deer', 'far'), dir, behavior: 'idle' });
        a.dir = dir;
        await walkIn(v, a, dir, 60);
        a.c.setBehavior(pick(['idle', 'alert']));
        await v.wait(rand(9000, 13000));
      },
      exit: walkAway,
    },
    doe: {
      // Drinking at the far shore (the graze pose), walking out of and back into the trees.
      stage: 'lake', seasons: ['spring', 'summer', 'fall'], when: 'any', weight: 3,
      async run(v) {
        const dir = 1;
        const a = v.actor('lake', 'doe', { reflect: 0.32, x: shoreX(), y: SHORE_Y + 2, h: 56, hReal: sized('doe', 'far'), dir, behavior: 'idle' });
        a.dir = dir;
        await walkIn(v, a, dir, 50);
        a.c.setBehavior('graze');
        await v.wait(rand(10000, 14000));
        a.c.setBehavior('idle');
      },
      exit: walkAway,
    },
    elk: {
      stage: 'lake', seasons: ['fall', 'winter'], when: 'any', weight: 3,
      async run(v) {
        const dir = 1;
        const a = v.actor('lake', 'elk', { reflect: 0.32, x: shoreX(), y: SHORE_Y, h: 84, hReal: sized('elk', 'far'), dir, behavior: 'idle' });
        a.dir = dir;
        await walkIn(v, a, dir, 60);
        a.c.setBehavior(pick(['idle', 'alert']));
        await v.wait(rand(9000, 13000));
      },
      exit: walkAway,
    },
    bankDeer: {
      // Right bank: a doe (or buck) steps out from behind a pine trunk, grazes or looks around,
      // then turns and walks back behind the same tree, fading as it goes.
      stage: 'bank', seasons: ['spring', 'summer', 'fall', 'winter'], when: 'any', weight: 3,
      async run(v) {
        const trunk = pick([3000, 3290]);
        const dir = pick([1, -1]);
        const buck = season() === 'winter' || Math.random() < 0.4;
        const a = v.actor('bank', buck ? 'deer' : 'doe', { x: trunk, y: RIGHT_Y, h: buck ? 150 : 112, hReal: sized(buck ? 'deer' : 'doe', 'bank'), dir, behavior: 'idle' });
        a.dir = dir; a.trunk = trunk;
        a.el.style.setProperty('--fade', '2.2s');
        await v.wait(60); a.show();
        walking(a, true);
        await v.move(a, trunk + dir * 130, RIGHT_Y + 6, 34, (t, now) => -2.2 * Math.abs(Math.sin(now / 240)));
        a.c.setBehavior(buck ? pick(['idle', 'alert', 'graze']) : 'graze');
        await v.wait(rand(9000, 13000));
        a.c.setBehavior('idle');
      },
      async exit(v) {
        const a = v.actors[0]; if (!a) return;
        a.face(-a.dir);
        a.el.style.setProperty('--fade', '3.6s');
        a.el.style.transitionTimingFunction = 'ease-in';
        a.show(false);
        walking(a, true);
        await v.move(a, a.trunk, RIGHT_Y, 34, (t, now) => -2.2 * Math.abs(Math.sin(now / 240)));
      },
    },
    bear: {
      // Ambles along the far shore, stops to forage, and carries on out of sight.
      stage: 'lake', seasons: ['spring', 'summer', 'fall'], when: 'day', weight: 2,
      async run(v) {
        const dir = 1;
        const a = v.actor('lake', 'bear', { reflect: 0.32, x: SHORE_X[0], y: SHORE_Y, h: 50, hReal: sized('bear', 'far'), dir, behavior: 'walk' });
        const speed = a.c.travelSpeed() * a.w;
        await v.wait(60); a.show();
        await v.move(a, rand(2250, 2450), null, speed);
        a.c.setBehavior('forage');
        await v.wait(rand(6000, 9000));
        a.c.setBehavior('walk');
        await v.move(a, dir > 0 ? SHORE_X[1] + 100 : SHORE_X[0] - 100, null, speed);
      },
    },
    wolfHowl: {
      stage: 'lake', seasons: ['fall', 'winter'], when: 'night', weight: 3,
      async run(v) {
        const a = v.actor('lake', 'wolf-howl', { reflect: 0.32, x: shoreX(), y: SHORE_Y, h: 66, hReal: sized('wolf-howl', 'far'), dir: pick([1, -1]), behavior: 'howl' });
        await v.wait(60); a.show();
        await v.wait(rand(10000, 14000));
      },
    },
    wolfRun: {
      // Lopes along the far shore from one bank to the other.
      stage: 'lake', seasons: ['winter', 'fall'], when: 'any', weight: 2,
      async run(v) {
        const dir = 1;
        const a = v.actor('lake', 'wolf-run', { reflect: 0.32, x: SHORE_X[0], y: SHORE_Y, h: 36, hReal: sized('wolf-run', 'far'), dir, behavior: 'run', rate: 0.8 });
        const speed = a.c.travelSpeed() * a.w;
        a.el.style.setProperty('--fade', '1.2s');
        await v.wait(60); a.show();
        await v.move(a, SHORE_X[1] + 60, null, speed);
      },
    },
    hare: {
      // Hops out of the water's-edge grass at the tip of the right bank and along it, left to
      // right, behind the pines (white in winter: the rig's snowshoe palette).
      stage: 'left', seasons: ['spring', 'summer', 'fall', 'winter'], when: 'any', weight: 2,
      async run(v) {
        // In front of the pines (it used to hop behind the trunks and looked like it was inside them),
        // a little lower on the grass, nearer the water.
        const a = v.actor('front', 'hare', { x: 2780, y: RIGHT_Y + 30, h: 62, hReal: sized('hare', 'bank'), behavior: 'hop', rate: 1.3, fade: 0.8 });
        const speed = a.c.travelSpeed() * a.w;
        await v.wait(60); a.show();
        await v.move(a, 3500, RIGHT_Y + 26, speed);
        a.el.style.setProperty('--fade', '1s');
        a.show(false);
        await v.move(a, 3700, RIGHT_Y + 24, speed);
      },
    },
    foreDeer: {
      // A doe (or a buck) up close: grazes, looks up, grazes again.
      stage: 'fore', seasons: ['spring', 'summer', 'fall', 'winter'], when: 'any', weight: 3,
      async run(v) {
        const buck = season() === 'winter' || Math.random() < 0.4;
        await foreVisit(v, buck ? 'deer' : 'doe', { steps: [['graze', 6], ['alert', 2.5], ['graze', 5], ['idle', 2]] });
      },
      exit: foreExit,
    },
    foreElk: {
      stage: 'fore', seasons: ['fall', 'winter'], when: 'any', weight: 2,
      async run(v) { await foreVisit(v, 'elk', { speed: 60, steps: [['idle', 3], ['graze', 7], ['alert', 3]] }); },
      exit: foreExit,
    },
    foreBear: {
      stage: 'fore', seasons: ['spring', 'summer', 'fall'], when: 'day', weight: 2,
      async run(v) { await foreVisit(v, 'bear', { speed: 50, steps: [['forage', 9]] }); },
      exit: foreExit,
    },
    foreWolf: {
      // Walks (not runs) through: pauses, looks about, heads back.
      stage: 'fore', seasons: ['fall', 'winter'], when: 'any', weight: 2,
      async run(v) { await foreVisit(v, 'wolf-run', { speed: 90, steps: [['walk', 0.01]] }); await v.wait(rand(3000, 5000)); },
      exit: foreExit,
    },
    closeBear: {
      stage: 'tree', seasons: ['spring', 'summer', 'fall'], when: 'day', weight: 1,
      async run(v) { await closeVisit(v, 'bear', [['look', 5], ['forage', 2.5], ['look', 3.5]]); },
      exit: closeExit,
    },
    closeElk: {
      stage: 'tree', seasons: ['fall', 'winter'], when: 'any', weight: 1,
      async run(v) { await closeVisit(v, 'elk', [['look', 5], ['alert', 2.5], ['look', 3]]); },
      exit: closeExit,
    },
    marley: {
      // Marley comes out of the tent (up on the right bank, scene.js THE TENT), trots down behind
      // the first pine and in front of the second to the water's edge, has a drink and a sniff about with her tail going, then
      // trots back up and into the tent. Bank stage = behind the pines and the tent; bank scale.
      stage: 'bank', seasons: ['spring', 'summer', 'fall', 'winter'], when: 'any', weight: 3,
      async run(v) {
        const door = { x: 3905, y: 1772 }, shore = { x: rand(3180, 3300), y: 1830 };
        const a = v.actor('bank', 'marley', { x: door.x, y: door.y, h: 100, hReal: sized('marley', 'bank'), dir: -1, behavior: 'walk', fade: 1.4 });
        a.home = door;
        await v.wait(60); a.show();
        await v.move(a, 3700, 1792, 45, bob);             // out of the tent, down the slope
        await v.move(a, 3450, 1812, 45, bob);             // behind the first pine (x 3610)...
        STAGE.front.appendChild(a.el);                    // ...then in front of the next one (x 3290)
        await v.move(a, shore.x, shore.y, 45, bob);       // down to the water's edge
        a.c.setBehavior('sniff'); await v.wait(rand(4000, 5500));   // a drink
        a.c.setBehavior('idle'); await v.wait(rand(3000, 4500));
        a.c.setBehavior('sniff'); await v.wait(rand(2500, 3500));
        a.c.setBehavior('idle'); await v.wait(rand(1500, 2500));
      },
      async exit(v) {
        const a = v.actors[0]; if (!a) return;
        a.face(1);                                        // back up the bank and into the tent
        a.c.setBehavior('walk');
        await v.move(a, 3450, 1812, 45, bob);
        STAGE.bank.appendChild(a.el);                     // behind the first pine again
        await v.move(a, 3700, 1792, 45, bob);
        a.el.style.setProperty('--fade', '1.6s');
        a.el.style.transitionTimingFunction = 'ease-in';
        a.show(false);
        await v.move(a, a.home.x, a.home.y, 45, bob);
      },
    },
    snowHare: {
      // The foreground hare, every season (white snowshoe coat in winter, brown the rest of the
      // year): hops in from the left along the front grass, sits up and sniffs, then hops away right.
      // Name kept as snowHare so old links and the panel still work.
      stage: 'tree', seasons: ['spring', 'summer', 'fall', 'winter'], when: 'any', weight: 3,
      async run(v) {
        const y = 3030;
        const a = v.actor('tree', 'hare', { x: -250, y, h: 115, hReal: SIZE.hare * 1.25, dir: 1, behavior: 'hop', rate: 1.4 });
        const speed = a.c.travelSpeed() * a.w;
        a.el.style.setProperty('--fade', '0.4s');
        await v.wait(60); a.show();
        await v.move(a, rand(1500, 2300), y + rand(-40, 20), speed);
        a.c.setBehavior('sit'); await v.wait(rand(3500, 5500));
        a.c.setBehavior('hop');
        await v.move(a, VW + 250, y + rand(-50, 30), speed);
      },
    },
    eagleCatch: {
      // The fish-catch: while someone holds on the lake and the charge fills, an eagle drops in
      // high above and circles. Release at full charge and it stoops in a long curve, timed to meet
      // the fish at the very top of its leap, snatches it, and climbs away with it. Release early
      // (or never) and it gives up and glides off. Driven by the lake hotspot (CATCH below).
      stage: 'catch', seasons: ['spring', 'summer', 'fall'], when: 'day', weight: 0,
      async run(v, opts) {
        try {
          const P = opts.at || { x: 2500, y: 2100 };
          const k = Math.max(0.45, Math.min(1.1, (P.y - 1550) / 500));
          const side = P.x > 2600 ? -1 : 1;                 // comes in from the left (1) or right (-1)
          const W = { x: P.x - side * 420 * k, y: P.y - 560 * k - 170 };
          const a = v.actor('catch', 'eagle', { x: P.x - side * 1500, y: W.y - 420, h: 44, hReal: 210 * k, dir: side, tilt: 10, behavior: 'soar', fade: 1.2 });
          await v.wait(40); a.show();
          const s0 = { x: a.x, y: a.y };
          await v.fly(a, (t) => { const e = 1 - (1 - t) * (1 - t); return [s0.x + (W.x - s0.x) * e, s0.y + (W.y - s0.y) * e + 30 * Math.sin(Math.PI * t)]; }, 2200);
          a.tilt(0);
          // Circle lazily until the fish goes up (or 12 s pass).
          const until = performance.now() + 12000;
          while (!CATCH.fish && performance.now() < until) {
            await v.fly(a, (t) => [W.x + side * 70 * k * Math.sin(2 * Math.PI * t), W.y - 22 * k * Math.sin(4 * Math.PI * t)], 1800, () => CATCH.fish);
          }
          const h = CATCH.fish;
          if (h && h !== 'miss') {
            const T = h.apexAt - performance.now();
            if (T > 250) {
              // The stoop: a quadratic curve that dips below the target and scoops up into it, so
              // the talons meet the fish at the peak of its arc exactly when it gets there.
              const p0 = { x: a.x, y: a.y }, p2 = { x: h.apexX, y: h.apexY + 6 * k };
              const c = { x: p2.x - side * 260 * k, y: p2.y + 170 * k };
              a.tilt(24);
              let tilted = false;
              await v.fly(a, (t) => {
                const u = t * t * (3 - 2 * t) * 0.35 + t * 0.65;   // steady, a touch of ease
                if (!tilted && u > 0.7) { tilted = true; a.tilt(-6); }
                return [(1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * c.x + u * u * p2.x, (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * c.y + u * u * p2.y];
              }, T);
              // Catch!
              h.grab();
              const f = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              f.setAttribute('viewBox', '-52 -12 84 24');
              f.innerHTML = '<g transform="' + (side < 0 ? 'scale(-1 1)' : '') + '"><path d="M -34 0 Q -18 -11 6 -6 Q 20 -3 30 0 Q 20 3 6 6 Q -18 11 -34 0 Z" fill="#5b7f95"/><path d="M -34 0 L -50 -10 L -44 0 L -50 10 Z" fill="#456575"/></g>';
              const fw = 84 * k * 1.1 / a.w * 100;
              f.style.cssText = `position:absolute;left:${50 - fw / 2}%;top:80%;width:${fw}%;overflow:visible;transform:rotate(${side * 8}deg)`;
              a.el.appendChild(f);
              if (window.__lakeRipple) window.__lakeRipple(h.apexX, h.apexY + 180 * k, 1.2);
              a.c.setBehavior('flap'); a.tilt(-20);
              const q0 = { x: a.x, y: a.y };
              a.el.style.setProperty('--fade', '2.8s'); a.el.style.transitionTimingFunction = 'ease-in';
              setTimeout(() => a.show(false), 1300);
              await v.fly(a, (t) => { const e = 1 - Math.pow(1 - t, 2); return [q0.x + side * 1500 * k * e, q0.y - 900 * k * e]; }, 4200);
              return;
            }
          }
          // Missed or never released: give up and glide off, climbing.
          a.c.setBehavior('flap'); a.tilt(-16);
          a.el.style.setProperty('--fade', '2.4s'); a.show(false);
          const q0 = { x: a.x, y: a.y };
          await v.fly(a, (t) => [q0.x + side * 1300 * t, q0.y - 500 * t], 2600);
        } finally { CATCH.v = null; CATCH.fish = null; }
      },
    },
    eagle: {
      // A distant hunter: fades in high on one side, stoops on a long diagonal down toward the
      // water, then pulls up and climbs away on the other diagonal, fading out. Head always leads
      // (the art is drawn banking, so it's tilted to fly head-first).
      stage: 'sky', seasons: ['spring', 'summer', 'fall', 'winter'], when: 'day', weight: 2,
      async run(v) {
        const dir = 1;
        const x0 = rand(2000, 2500);             // right of the hero text
        // Tilt: the silhouette is drawn banking (needs 58° to point down); origami flies level.
        const origami = window.Creatures.ORIGAMI && window.Creatures.ORIGAMI.eagle && window.ORIGAMI_ART;
        const a = v.actor('sky', 'eagle', { x: x0, y: rand(520, 640), h: 44, dir, tilt: origami ? 26 : 58, behavior: 'soar', fade: 1.4 });
        await v.wait(60); a.show();
        const lowX = x0 + rand(900, 1150), lowY = rand(1380, 1480);
        await v.move(a, lowX, lowY, 150, (t, now) => 6 * Math.sin(now / 900));   // the stoop
        a.tilt(a.c.origami ? -24 : 22); a.c.setBehavior('flap');
        a.el.style.setProperty('--fade', '3.2s');
        a.el.style.transitionTimingFunction = 'ease-in';
        a.show(false);
        await v.move(a, lowX + dir * 700, lowY - 520, 120);                         // climb away
      },
    },
    hawk: {
      // Perched on a far pine top: small, since the art is a silhouette.
      stage: 'pines', seasons: ['spring', 'summer', 'fall'], when: 'day', weight: 2,
      async run(v) {
        const [x, y] = pick(PINE_TOPS);
        const a = v.actor('pines', 'hawk', { x, y: y + 8, h: 46, dir: pick([1, -1]), behavior: 'perch' });
        await v.wait(60); a.show();
        await v.wait(rand(10000, 15000));
      },
    },
    owl: {
      // Night owl on a pine top; in winter a snowy owl, which is also out by day.
      stage: 'pines', seasons: ['spring', 'summer', 'fall', 'winter'], when: 'any', weight: 3,
      ok: () => night() || season() === 'winter',
      async run(v) {
        const [x, y] = pick(PINE_TOPS);
        const a = v.actor('pines', 'owl', { x, y: y + 10, h: 44, behavior: 'perch' });
        await v.wait(60); a.show();
        await v.wait(rand(12000, 18000));
      },
    },
    squirrel: {
      stage: 'tree', seasons: ['spring', 'summer', 'fall'], when: 'day', weight: 2,
      async run(v) {
        const a = v.actor('tree', 'squirrel', { x: 4222 + HERO_DX, y: 1905, h: 105, facing: -1, dir: -1, behavior: 'nibble' });
        await v.wait(60); a.show();
        await v.wait(rand(9000, 13000));
      },
    },
    fox: {
      // Near the trees: either slips out from behind the hero tree's trunk at its base and sits in
      // the grass, or steps out from behind a right-bank pine. Fades in as it comes out and back
      // out as it returns behind the same tree.
      stage: 'rock', seasons: ['spring', 'summer', 'fall', 'winter'], when: 'any', weight: 3,
      async run(v) {
        const hero = Math.random() < 0.6 && !stageBusy('fore');
        const o = hero
          ? { stage: 'behindTree', x0: FORE.x0, x1: rand(FORE.xStop[0], FORE.xStop[1]) + 150, y: FORE.y, h: 150, hReal: FORE_SIZE.fox, speed: 120 }
          : { stage: 'bank', x0: pick([3000, 3290]), y: RIGHT_Y + 4, h: 70, hReal: sized('fox', 'bank'), speed: 36 };
        if (!hero) o.x1 = o.x0 - 120;
        const a = v.actor(o.stage, 'fox', { x: o.x0, y: o.y, h: o.h, hReal: o.hReal, facing: -1, dir: -1, behavior: 'sit', fade: 1.6 });
        a.home = o;
        await v.wait(60); a.show();
        walking(a, true);
        await v.move(a, o.x1, o.y, o.speed);
        a.c.setBehavior('sit');
        await v.wait(rand(3500, 5000));
        if (a.c.behaviors.includes('sniff')) { a.c.setBehavior('sniff'); await v.wait(rand(3000, 4500)); a.c.setBehavior('sit'); }
        await v.wait(rand(2000, 3500));
      },
      async exit(v) {
        const a = v.actors[0]; if (!a) return;
        if (a.c.origami) a.face(1);                     // turns and trots back the way it came
        a.el.style.setProperty('--fade', '2.2s');
        a.el.style.transitionTimingFunction = 'ease-in';
        a.show(false);
        walking(a, true);
        await v.move(a, a.home.x0, a.home.y, a.home.speed);
      },
    },
    chipmunk: {
      // Pops up from behind the small rock above it.
      stage: 'rock', seasons: ['spring', 'summer', 'fall'], when: 'day', weight: 3,
      async run(v) {
        const a = v.actor('rockR', 'chipmunk', { x: 3590, y: 1995, h: 58, dir: -1, behavior: 'alert', fade: 0.3 });
        await v.wait(60); a.show();
        await v.move(a, 3590, 1945, 70);
        await v.wait(rand(6000, 9000));
      },
      async exit(v) { const a = v.actors[0]; if (a) await v.move(a, a.x, 1995, 90); },
    },
    fisherman: {
      // Drifts across the top of the lake, emerging from behind the left bank and slipping
      // behind the right one. Has its own timer (see below). At night he carries a lantern.
      stage: 'boat', seasons: ['spring', 'summer', 'fall'], when: 'any', weight: 0,
      async run(v) {
        // Fades in on the open lake near the middle, drifts right, and fades out as he slips
        // behind the right bank and its pines (the bank is drawn over the lake layer).
        const a = v.actor('boat', 'fisherman', { reflect: 0.28, x: 2120, y: 1800, h: 200, behavior: 'fish', fade: 5 });
        const lamp = document.createElement('div'); lamp.className = 'wl-lamp';
        const streak = document.createElement('div'); streak.className = 'wl-lampstreak';
        const L = a.c.rig.lamp || LAMP;                         // origami boat: on the stern
        lamp.style.left = L[0] + '%'; lamp.style.top = L[1] + '%';
        streak.style.left = L[0] + '%'; streak.style.top = '100%';
        a.el.appendChild(lamp); a.el.appendChild(streak);
        a.onNight = (n) => { lamp.classList.toggle('on', n); streak.classList.toggle('on', n); };
        a.onNight(night());
        await v.wait(60); a.show();
        await v.move(a, 2700, 1796, 14);
        const out = (3050 - 2700) / 14;                       // seconds left to the fade point
        a.el.style.setProperty('--fade', out.toFixed(1) + 's');
        a.el.style.transitionTimingFunction = 'ease-in';
        a.show(false);
        await v.move(a, 3050, 1794, 14);
      },
    },
  };

  const eligible = (key) => {
    const d = CAST[key];
    if (!d || !d.seasons.includes(season())) return false;
    if (d.when === 'day' && night()) return false;
    if (d.when === 'night' && !night()) return false;
    if (d.ok && !d.ok()) return false;
    if (d.stage === 'sky' && !STAGE.sky) return false;
    return true;
  };
  const stageBusy = (stage) => [...live].some((v) => !v.done && v.def.stage === stage);
  const running = (key) => [...live].find((v) => !v.done && !v.leaving && v.def === CAST[key]);
  function start(key, opts) {
    if (!(opts && opts.force) && !eligible(key)) return null;
    if (stageBusy(CAST[key].stage)) return null;
    const v = visit(CAST[key], opts); if (v) v.key = key; return v;
  }

  // ── timers ──
  const quiet = () => document.hidden || !sceneVisible || traveling() || reduced || (window.__wildlife && window.__wildlife.paused);
  let lastKeys = [];
  function ambient() {
    setTimeout(ambient, rand(30000, 60000));
    if (quiet()) return;
    const timed = [...live].filter((v) => !v.done && !v.hot && v.def !== CAST.fisherman);
    if (timed.length) return;                                   // one timed visitor at a time
    const pool = Object.keys(CAST).filter((k) => CAST[k].weight > 0 && eligible(k) && !lastKeys.includes(k) && !stageBusy(CAST[k].stage));
    if (!pool.length) return;
    const total = pool.reduce((n, k) => n + CAST[k].weight, 0);
    let r = Math.random() * total, key = pool[0];
    for (const k of pool) { r -= CAST[k].weight; if (r <= 0) { key = k; break; } }
    lastKeys = [key].concat(lastKeys).slice(0, 2);
    start(key);
  }
  setTimeout(ambient, rand(14000, 22000));
  (function fisherTimer(first) {
    setTimeout(() => { if (!quiet()) start('fisherman'); fisherTimer(false); }, first ? rand(25000, 40000) : rand(100000, 170000));
  })(true);

  // Season change or day/night: visitors that no longer belong leave (quickly, before the dark).
  let lastState = '';
  setInterval(() => {
    const st = season() + (night() ? 'n' : 'd') + (traveling() ? 't' : '');
    if (st === lastState) return;
    lastState = st;
    live.forEach((v) => {
      if (v.done || v.leaving) return;
      const key = Object.keys(CAST).find((k) => CAST[k] === v.def);
      if (traveling() || !eligible(key)) v.leave();
      else v.actors.forEach((a) => { a.c.setSeason(season()); if (!GRADED.has(a.stageName)) a.c.setNight(night()); if (a.onNight) a.onNight(night()); });
    });
  }, 250);

  const core = $('sceneCore');
  if (core && 'IntersectionObserver' in window) {
    new IntersectionObserver((es) => { sceneVisible = es[es.length - 1].isIntersecting; }).observe(core);
  }

  // ── hidden hotspots ──
  // Invisible tap areas in the UI plate (text and buttons sit above them). A tap starts that
  // spot's visitor; tapping again while it's there sends it away. No cursor change, no focus,
  // hidden from screen readers: they're easter eggs, not controls.
  if (!ui) return;
  const hotFrame = worldFrame(ui);
  hotFrame.setAttribute('aria-hidden', 'true');
  // opts.charge: a press-and-hold that CHARGES instead of cancelling: fn gets (x, y, heldMs), and
  // opts.charge(x, y, heldMs) is called about 3x a second while held (for feedback).
  function hotspot(r, fn, onHold, opts) {
    const h = box(hotFrame, r);
    h.className = 'wl-box wl-hot';
    let down = null, holdT = 0, chargeT = 0;
    const toWorld = (e) => { const fr = hotFrame.getBoundingClientRect(); return [(e.clientX - fr.left) / fr.width * VW, (e.clientY - fr.top) / fr.height * VH]; };
    h.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), held: false };
      if (onHold) { clearTimeout(holdT); holdT = setTimeout(() => { if (down) { down.held = true; onHold(); } }, 900); }
      if (opts && opts.charge) {
        const [wx, wy] = toWorld(e); clearInterval(chargeT);
        chargeT = setInterval(() => { if (down) opts.charge(wx, wy, performance.now() - down.t); else clearInterval(chargeT); }, 300);
      }
    });
    if (opts && opts.charge) {
      h.addEventListener('pointerup', (e) => {
        clearInterval(chargeT);
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 24) { down = null; return; }
        const held = performance.now() - down.t; down = null;
        if (traveling()) return;
        const [wx, wy] = toWorld(e); fn(wx, wy, held);
      });
      const stop = () => { clearInterval(chargeT); down = null; };
      h.addEventListener('pointerleave', stop); h.addEventListener('pointercancel', stop);
      h.addEventListener('contextmenu', (e) => e.preventDefault());
      return h;
    }
    const cancel = () => { clearTimeout(holdT); };
    h.addEventListener('pointerleave', cancel); h.addEventListener('pointercancel', cancel);
    if (onHold) h.addEventListener('contextmenu', (e) => e.preventDefault());   // long-press menu on phones
    h.addEventListener('pointerup', (e) => {
      clearTimeout(holdT);
      if (!down || down.held || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12 || performance.now() - down.t > 700) { down = null; return; }
      down = null;
      if (traveling()) return;
      const fr = hotFrame.getBoundingClientRect();
      fn((e.clientX - fr.left) / fr.width * VW, (e.clientY - fr.top) / fr.height * VH);
    });
    return h;
  }
  // Toggle: send away a visitor from this group if one is here, otherwise invite the first
  // eligible one (shuffled so repeat taps vary).
  function invite(keys) {
    const here = keys.map(running).find(Boolean);
    if (here) { here.leave(); return; }
    const opts = keys.filter(eligible).sort(() => Math.random() - 0.5);
    for (const k of opts) { if (start(k, { hot: true })) return; }
  }
  // The lake: a fish jumps where you tap (a ripple in winter). Big and underneath the others.
  // The lake: tap for a fish jump. Hold longer, jump higher: the charge builds over ~2.5 s, and
  // small rings pulse where you hold (a fish gathering itself). Winter: just a ripple (ice-cold).
  const FISH_CHARGE_MS = 2500;
  // Full charge (daytime, not winter) also calls in the eagle (eagleCatch above).
  const CATCH = { v: null, fish: null };
  hotspot([1500, 1680, 3700, 2700], (x, y, held) => {
    if (season() === 'winter') { if (window.__lakeRipple) window.__lakeRipple(x, y); return; }
    const power = Math.min(1, (held || 0) / FISH_CHARGE_MS);
    const h = window.__spawnFishJump ? window.__spawnFishJump(x, y, power) : null;
    if (CATCH.v) CATCH.fish = power >= 1 && h ? h : 'miss';
  }, null, { charge: (x, y, held) => {
    if (window.__lakeRipple) window.__lakeRipple(x, y, 0.4 + 0.8 * Math.min(1, held / FISH_CHARGE_MS));
    // Nearly full: the eagle arrives early enough to be circling when the charge completes.
    if (held >= FISH_CHARGE_MS * 0.6 && !CATCH.v && !night() && season() !== 'winter' && !traveling()) {
      CATCH.fish = null; CATCH.v = start('eagleCatch', { force: true, at: { x, y } });
    }
  } });
  hotspot([1450, 1470, 2760, 1640], () => invite(['wolfHowl', 'deer', 'doe', 'elk', 'bear', 'wolfRun'])); // far shore
  hotspot([2800, 985, 3700, 1825], () => invite(['owl', 'hawk', 'bankDeer']));    // right-bank pines
  hotspot([3780 + HERO_DX, 1120, 5000, 1900], () => invite(['squirrel']));        // hero tree canopy
  hotspot([0, 1560, 1250, 1860], () => invite(['hare']));                         // left bank
  hotspot([0, 2780, VW, VH], () => invite(['snowHare']));                          // front grass: the hare
  hotspot([3790, 1590, 4190, 1780], () => invite(['marley']));                     // the tent: Marley
  hotspot([3500, 2440, 4400, 2780], () => invite(['foreDeer', 'foreElk', 'foreBear', 'foreWolf', 'fox']));
  hotspot([4500 + HERO_DX, 1900, 4850 + HERO_DX, 2700], () => invite(['closeBear', 'closeElk']));                // hero tree trunk: a close-up beast // foreground grass by the hero tree
  // Sun by day, moon by night (same spot): an eagle, or at night a wolf answers the moon.
  hotspot([3380, 900, 3830, 1370], () => invite(night() ? ['wolfHowl', 'owl'] : ['eagle']));


  // ── test panel ──
  // Press and hold any trigger rock (or add ?wildlife to the URL) to open a small panel listing
  // every visit, so each can be played on demand. "Any season" ignores the season/day rules.
  const PANEL_ITEMS = [
    ['Far shore', [['deer', 'Deer (buck)'], ['doe', 'Doe, drinking'], ['elk', 'Elk'], ['bear', 'Bear'], ['wolfRun', 'Wolf, running'], ['wolfHowl', 'Wolf, howling']]],
    ['Right bank', [['bankDeer', 'Deer from behind a pine'], ['hare', 'Hare'], ['marley', 'Marley (from the tent)'], ['hawk', 'Hawk on a pine top'], ['owl', 'Owl on a pine top']]],
    ['Foreground (by the hero tree)', [['foreDeer', 'Doe or buck, grazing'], ['foreElk', 'Elk'], ['foreBear', 'Bear, foraging'], ['foreWolf', 'Wolf, walking'], ['fox', 'Fox'], ['snowHare', 'Hare across the front (white in winter)']]],
    ['Close-up (in front of the tree)', [['closeBear', 'Grizzly, close-up'], ['closeElk', 'Bull elk, close-up']]],
    ['Rocks & tree', [['chipmunk', 'Chipmunk'], ['squirrel', 'Squirrel (hero tree)']]],
    ['Lake & sky', [['fisherman', 'Fisherman'], ['eagle', 'Eagle'], ['@fish', 'Fish jump'], ['@bigfish', 'Big fish jump (full charge)'], ['@catch', 'Eagle catches a fish']]],
    ['Scene effects', [['@gust', 'Wind gust now'], ['@calm', 'Stop the wind'], ['@night', 'Day / night (fireflies, collar, tent light)']]],
  ];
  let panel = null;
  function openPanel() {
    if (panel) { panel.remove(); panel = null; return; }
    panel = document.createElement('div');
    panel.className = 'wl-panel';
    panel.innerHTML = '<div class="wl-ph"><b>Wildlife test panel</b><span><button type="button" data-side title="Move to the other side">⇄</button><button type="button" data-min title="Fold / unfold">–</button><button type="button" data-x aria-label="Close">×</button></span></div>' +
      '<label class="wl-any"><input type="checkbox" checked> Any season / time of day</label>' +
      PANEL_ITEMS.map(([g, list]) => '<div class="wl-g">' + g + '</div>' +
        list.map(([k, l]) => '<button type="button" data-k="' + k + '">' + l + '</button>').join('')).join('') +
      '<div class="wl-g">Controls</div><button type="button" data-clear>Send everyone away</button>' +
      '<div class="wl-note"></div>';
    document.body.appendChild(panel);
    const note = panel.querySelector('.wl-note');
    const any = panel.querySelector('input');
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-x')) { openPanel(); return; }
      if (b.hasAttribute('data-side')) { panel.classList.toggle('wl-left'); return; }
      if (b.hasAttribute('data-min')) { panel.classList.toggle('wl-min'); b.textContent = panel.classList.contains('wl-min') ? '+' : '–'; return; }
      if (b.hasAttribute('data-clear')) { live.forEach((v) => v.leave()); note.textContent = 'Everyone is leaving.'; return; }
      const k = b.dataset.k;
      if (k === '@gust') {
        const W = window.__windShow; if (W && W.gustNow) W.gustNow();
        note.textContent = 'Gust!'; return;
      }
      if (k === '@calm') { if (window.__windShow) window.__windShow.calm(); note.textContent = 'Wind stopped (it comes back after the next season change).'; return; }
      if (k === '@night') { const m = $('modeBtn'); if (m) m.click(); note.textContent = night() ? 'Night.' : 'Day.'; return; }
      if (k === '@catch') {
        const x = rand(2100, 2800), y = rand(2000, 2250);
        if (!CATCH.v) { CATCH.fish = null; CATCH.v = start('eagleCatch', { force: true, at: { x, y } }); }
        setTimeout(() => { const h = window.__spawnFishJump && window.__spawnFishJump(x, y, 1); if (CATCH.v) CATCH.fish = h || 'miss'; }, 3200);
        note.textContent = 'Eagle circling… big jump in 3 s.'; return;
      }
      if (k === '@bigfish') { if (window.__spawnFishJump) window.__spawnFishJump(rand(2000, 2900), rand(1900, 2300), 1); note.textContent = 'Big jump!'; return; }
      if (k === '@fish') {
        if (window.__spawnFishJump) window.__spawnFishJump(rand(1900, 3000), rand(1800, 2300));
        note.textContent = 'Fish jump.'; return;
      }
      const here = running(k);
      if (here) { here.leave(); note.textContent = 'Sent ' + b.textContent + ' away.'; return; }
      if (!any.checked && !eligible(k)) { note.textContent = b.textContent + ' isn\u2019t out in this season / time of day.'; return; }
      // Its area is taken: send that visitor away first, then play this one.
      const busy = [...live].find((v) => !v.done && v.def.stage === CAST[k].stage);
      const go = () => { note.textContent = start(k, { hot: true, force: any.checked }) ? 'Playing: ' + b.textContent : 'Couldn\u2019t start (area busy).'; };
      if (busy) {
        busy.leave(); note.textContent = 'Clearing the area\u2026';
        const t0 = performance.now();
        const poll = () => (stageBusy(CAST[k].stage) && performance.now() - t0 < 8000) ? setTimeout(poll, 250) : go();
        setTimeout(poll, 250);
      } else go();
    });
  }
  const pcss = document.createElement('style');
  pcss.textContent =
    '.wl-panel.wl-left{right:auto;left:12px}.wl-panel.wl-min>:not(.wl-ph){display:none}.wl-panel.wl-min{width:auto}' +
    '.wl-ph span{display:flex;gap:4px}.wl-ph span button{background:none;border:0;color:inherit;font:inherit;font-size:15px;cursor:pointer;padding:0 4px;opacity:.8}' +
    '.wl-panel{position:fixed;right:12px;bottom:12px;z-index:9999;width:230px;max-height:70vh;overflow:auto;padding:10px 12px;' +
      'background:rgba(20,28,30,.9);color:#eef3ee;font:13px/1.3 system-ui,sans-serif;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);' +
      '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
    '.wl-ph{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}' +
    '.wl-ph button{background:none;border:0;color:#eef3ee;font-size:20px;line-height:1;cursor:pointer;padding:0 2px}' +
    '.wl-any{display:flex;gap:6px;align-items:center;font-size:12px;opacity:.85;margin-bottom:4px}' +
    '.wl-g{margin:8px 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.6}' +
    '.wl-panel button[data-k],.wl-panel button[data-clear]{display:block;width:100%;text-align:left;margin:2px 0;padding:5px 8px;' +
      'border:0;border-radius:6px;background:rgba(255,255,255,.08);color:inherit;font:inherit;cursor:pointer}' +
    '.wl-panel button[data-k]:hover,.wl-panel button[data-clear]:hover{background:rgba(255,236,170,.22)}' +
    '.wl-note{margin-top:8px;font-size:12px;min-height:1.3em;color:#ffe9a8}';
  document.head.appendChild(pcss);
  if (/[?&]wildlife\b/.test(location.search)) openPanel();
  // Links: ?fox, ?summer+night+owl ... bring that animal in once (scene.js parses the words).
  // A few friendly names map to their visit: wolf (howl at night, run by day), deer = the buck.
  const LINK_ALIAS = { dog: 'marley', tent: 'marley', wolf: () => (night() ? 'wolfHowl' : 'wolfRun'), howl: 'wolfHowl', buck: 'deer', rabbit: 'hare', snowhare: 'snowHare', bankdeer: 'bankDeer' };
  // Any visit's own name works too, in any case and with or without dashes: ?foreelk, ?fore-elk,
  // ?closebear, ?bankdeer, ?wolfhowl ... (the list is in the footer trigger guide).
  const CAST_BY_LC = {}; Object.keys(CAST).forEach((k) => { CAST_BY_LC[k.toLowerCase()] = k; });
  const linkAnimals = (window.__linkWords || []).map((w) => {
    const a = LINK_ALIAS[w]; const k = typeof a === 'function' ? a() : (a || w);
    return CAST[k] ? k : (CAST_BY_LC[String(k).replace(/[-_]/g, '')] || null);
  }).filter(Boolean);
  if (linkAnimals.length) setTimeout(() => linkAnimals.forEach((k) => start(k, { force: true })), 1200);

  // Rocks last, so they sit above the bigger areas they overlap.
  // Trigger rocks: each rock always wakes the same part of the scene, and glows when tapped.
  function glow(r) {
    const pad = 0.12, w = r[2] - r[0], h = r[3] - r[1];
    const g = box(hotFrame, [r[0] - w * pad, r[1] - h * pad, r[2] + w * pad, r[3] + h * pad]);
    g.className = 'wl-glow';
    const frame = box(hotFrame, r);
    frame.className = 'wl-box';
    for (let i = 0; i < 12; i++) {
      const sp = document.createElement('div');
      sp.className = 'wl-spark';
      sp.style.left = rand(15, 85) + '%'; sp.style.top = rand(20, 70) + '%';
      sp.style.setProperty('--dx', rand(-14, 14).toFixed(0) + 'px');
      sp.style.setProperty('--dy', -rand(28, 64).toFixed(0) + 'px');
      sp.style.setProperty('--d', rand(1.3, 2.1).toFixed(2) + 's');
      sp.style.setProperty('--dl', rand(0, 0.5).toFixed(2) + 's');
      frame.appendChild(sp);
    }
    setTimeout(() => { g.remove(); frame.remove(); }, 3000);
  }
  // Tap: wake the rock's area. Press and hold (about a second) on any rock: the test panel.
  function rock(r, keys) { hotspot(r, () => { glow(r); invite(keys()); }, () => { glow(r); openPanel(); }); }
  rock([-40, 2070, 340, 2440], () => ['deer', 'doe', 'elk', 'bear', 'wolfRun', 'wolfHowl']);  // big left rock: far shore
  rock([350, 2140, 660, 2430], () => ['bankDeer', 'hawk', 'owl']);                         // its neighbour: right bank
  rock([1040, 2390, 1320, 2580], () => ['hare']);                                         // small rock by the bush: left bank
  rock([3450, 2005, 3930, 2185], () => ['fisherman']);                                    // big lake rock: the fisherman
  rock([3480, 1900, 3710, 1993], () => ['fox', 'chipmunk']);                              // small lake rock: fox or chipmunk

  // ── fireflies: night only, a different colour each season ──
  // A few soft blinking lights drifting low over both banks and the foreground grass. One canvas in
  // the top effects plate (ungraded, so night doesn't dim them), drawn at ~30 fps and only while
  // the night gate is open (window.__moonEligible); by day it's hidden and its buffer released.
  // Each light is a pre-drawn glow sprite blitted with drawImage (no shadowBlur, cheap in Safari).
  // Real fireflies are a spring/summer thing; fall gets a few late amber ones and winter a handful
  // of icy "snow sparks" so every season has a little magic at night.
  (function fireflies() {
    const host = $('rainCanvas') ? $('rainCanvas').parentNode : $('plateFx');
    if (!host || reduced) return;
    const frame = document.createElement('div'); frame.className = 'wl-frame';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    frame.appendChild(cv); host.appendChild(frame);
    const LOOK = {
      spring: { n: 26, rgb: [190, 255, 110] }, summer: { n: 42, rgb: [255, 214, 90] },
      fall: { n: 14, rgb: [255, 160, 60] }, winter: { n: 11, rgb: [170, 225, 255] },
    };
    // [x0, y0, x1, y1, share, size, brightness]. Distance: the banks are far away, so their flies
    // are smaller and dimmer (and slower, see below); the foreground ones are full size. A thin
    // extra layer hangs over the far shore under the treeline, tiny and faint.
    const ZONES = [[40, 1600, 1600, 1840, 3, 0.42, 0.55], [2800, 1600, 4500, 1830, 3, 0.42, 0.55],
      [1500, 1560, 2800, 1610, 1.5, 0.28, 0.4],
      [2700, 2350, 4900, 2900, 3, 1, 1], [0, 2250, 1300, 2750, 1.5, 1, 1]];
    const sprites = {};
    function sprite(rgb) {
      const k = rgb.join(); if (sprites[k]) return sprites[k];
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.18, `rgba(${rgb},0.95)`);
      g.addColorStop(0.45, `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(0, 0, 32, 32); return (sprites[k] = c);
    }
    const pickZone = () => { const tot = ZONES.reduce((n, z) => n + z[4], 0); let r = Math.random() * tot; for (const z of ZONES) { r -= z[4]; if (r <= 0) return z; } return ZONES[0]; };
    let flies = [], forSeason = '';
    function spawn(n) {
      flies = Array.from({ length: n }, () => { const z = pickZone(); return {
        z, x: rand(z[0], z[2]), y: rand(z[1], z[3]), vx: rand(-14, 14), vy: rand(-6, 6),
        ph: rand(0, 20), per: rand(2.2, 4.5), on: rand(0.35, 0.6), size: rand(0.8, 1.25) }; });
    }
    let last = 0, raf = 0;
    function draw(now) {
      raf = requestAnimationFrame(draw);
      const gate = window.__moonEligible || 0;
      if (gate < 0.02 || document.hidden) { if (cv.width > 1) { cv.width = cv.height = 1; } return; }
      if (now - last < 33) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const sn = season();
      if (sn !== forSeason) { forSeason = sn; spawn(LOOK[sn].n); }
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const W = Math.round(frame.clientWidth * dpr), H = Math.round(frame.clientHeight * dpr);
      if (!W || !H) return;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H);
      const k = W / VW, t = now / 1000, img = sprite(LOOK[sn].rgb), px = Math.max(10, 38 * k * 4);
      for (const f of flies) {
        // Lazy wander: steer gently, stay inside the zone.
        f.vx += rand(-10, 10) * dt; f.vy += rand(-6, 6) * dt;
        f.vx = Math.max(-18, Math.min(18, f.vx)); f.vy = Math.max(-9, Math.min(9, f.vy));
        const sp = f.z[5];                                  // far ones drift slower on screen
        f.x += f.vx * dt * sp; f.y += f.vy * dt * sp;
        const z = f.z;
        if (f.x < z[0] || f.x > z[2]) f.vx *= -1;
        if (f.y < z[1] || f.y > z[3]) f.vy *= -1;
        // Blink: a slow glow up, a hold, a fade, then dark for the rest of the period.
        const u = ((t + f.ph) % f.per) / f.per;
        const a = u < f.on ? Math.sin(Math.PI * u / f.on) : 0;
        if (a < 0.02) continue;
        const sz = Math.max(3, px * f.size * f.z[5]);
        ctx.globalAlpha = a * gate * 0.9 * f.z[6];
        ctx.drawImage(img, f.x * k - sz / 2, f.y * k - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(draw);
  })();

  window.__wildlife = { CAST, start, live, invite, openPanel };
})();
