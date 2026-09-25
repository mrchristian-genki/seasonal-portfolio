# V2 Scene — Punch List

Status key: ✅ Fixed & verified | 🔎 Root cause found, fix not yet applied | ❓ Needs investigation | 💭 Design decision needed (not a bug)

Architecture note (Sept 20): the scene no longer fetches one big `landscape.svg`
at runtime. It's now assembled from individual assets (mountains via
`mountain-shapes.js`/`MOUNTAIN_PALETTE`, boulders, plants, and the
`left-shore.svg`/`right-shore.svg` banks) — see `seasons-portfolio-session-log`
in memory for the full history of that rework. A few older entries below
referenced the old single-image lake/`hero_peak_snow.svg` setup and are
marked **OBSOLETE** rather than left dangling.

## STILL OPEN

- ✅ **Leaf-fall sprites 404 on the live site** (Sept 23): `assets/leaves/` uploaded;
  all 5 PNGs load and leaves fall in autumn. Sept 23 cleanup verified live (all
  files match, no console errors).
- 💭 **Filter colour space** (found Sept 23): since the Sept 21 WebKit fix, season
  grades run as SVG filters, which default to linearRGB. The grades were tuned
  earlier as CSS filters (sRGB), so fall/winter now look noticeably more muted than
  when they were tuned (fall foliage olive instead of amber). Adding
  `color-interpolation-filters="sRGB"` to the season filters restores the tuned look.
  Not changed: it's a visible colour change, Christian's call.
- 💭 **Shore banks on mobile**: the tablet/phone nudge for the banks targeted
  `#leftShoreFO/#rightShoreFO`, which no longer exist (shores are native nested
  svgs now). That CSS was dead since Sept 20 and was removed; pines still get their
  nudge. Re-add for shores if phones look cramped (JS positioning, not CSS transform
  on a nested svg).
- 🔎 **Catalog components.js is a Sept 20 fork** of the live one (async fetch, no
  shared filter helpers). Re-syncing it needs `__fetchSyncText`, `__injectFetchedSvg`
  and `__applySeasonFilter(Tweened)` pulled out of scene.js into a shared file.

- ✅ **Foreground band + right bank rendering almost entirely off-screen**
  (Sept 22) — Christian, from live-site screenshots across Safari/Chrome/
  Firefox: "Some banks on the right missing and the foreground area."
  Root cause: `buildCroppedSvgAsset`'s `flip` option (components.js, used
  only by `lagoonForegroundBand2`, the grass band spanning nearly the
  whole scene width) mirrored the element with a plain CSS
  `wrap.style.transform = 'scaleX(-1)'` and no `transform-box`. `wrap` is
  a nested `<svg>` with `overflow: visible` (needed elsewhere so seasonal
  filters/painterly overlays aren't clipped), and this asset's own
  `preserveAspectRatio="xMidYMax slice"` crop paints content outside its
  declared box on purpose -- so the CSS transform's default mirror axis,
  computed from the element's actual painted geometry rather than its
  declared x/y/width/height box, landed thousands of world units off
  center. Confirmed directly: the band's rendered rect had its right edge
  at world x≈100 instead of spanning the full scene width — i.e. the
  entire band (which also carries the visible "bank" shape on the right
  side of the lagoon) was rendered almost entirely off-screen to the left,
  leaving only a ~100px sliver visible in the top-left corner. This is a
  real bug in the current code, not a stale live deployment (the report
  reproduced identically against the local build in Chromium, WebKit, and
  Firefox before any fix). Tried `transform-box: border-box` first — it
  narrowed the offset but didn't fully correct it once nested inside the
  outer scaled/viewBox'd scene svg, so replaced the CSS transform
  entirely with a plain SVG-space mirror: wraps the already-injected
  content in a `<g transform="translate(w,0) scale(-1,1)">`, where `w` is
  the element's own viewBox width — the exact coordinate box the content
  is drawn in, with no CSS transform-box ambiguity possible. Verified in
  Chromium, WebKit, and Firefox: `lagoonForegroundBand2`'s rendered rect
  now matches `plateForeground`'s bounds exactly (both screenshot and DOM
  measurement), the grass band sweeps the full width of the scene again
  with the curve dipping on the right as originally intended, and there
  are zero console errors in any of the three engines.
- ✅ **WebKit silently ignores seasonal/time-of-day CSS `filter` on nested
  SVG content** (Sept 21, round 9) — root-caused and fixed, see the new
  dated section below. This turned out to affect far more than the
  originally-flagged `waterPlane`/foothills: essentially every per-object
  seasonal filter in the scene (banks, hero tree, boulders, plants,
  foreground band, treeline, generated trees, pines) was silently a no-op
  in real Safari, confirmed directly by Christian: "the banks, hero tree
  and the foreground grass do not change color on the winter season."
- ✅ **Dead code** (Sept 23): `buildBirdFlockCanvas`, `makeDeciduous`, `makePine`,
  `makeGrass`, `makeSnowfall`, `makeRainfall` moved to the catalog's
  `reference-parts.js`; `rgbToHex`/`mixHex` deleted.
- ❓ **Winter lake color vs. water-shimmer snow contrast** — winter's richer
  teal-blue lake color may make the shimmer's white snow circles harder to
  see against it. Flagged, not tested since the lake-color work landed.
- ✅ **Painterly shading pass on boulders/banks/plants** (Sept 21) — resolved
  the way this entry flagged as the likely route: a hand-placed highlight/
  shadow overlay per asset, see the new dated section below for the
  technique and why the mountain's gradient-fill approach didn't transfer
  directly.
- 💭 **Catalog still has a few genuinely-not-live entries**: `aspen-cutout`
  and `bare-tree-shell` (both `status: 'progress'`) don't correspond to
  anything in the live scene — worth a real decision (build them out, or
  drop them from the catalog) rather than another status fix.
- 💭 **No catalog card for the new leaf-fall system** — it's a canvas
  particle system (like rain/snow), not a single positioned SVG object, so
  it doesn't fit the catalog's existing per-object card pattern without a
  new `kind` branch in `catalog-app.js`. Left undone this round; the
  `leaf-single` catalog entry's note now at least points to where the real
  sprites live.
- 🔎 **Responsive layout is a first pass, not a full redesign** — see the
  "Mobile/tablet responsiveness" section below for what's done vs. still
  worth doing (boulders/plants/hero-tree don't yet get the same small-screen
  treatment pines/banks/flowers just got).
- ✅ **Boulder/plant/treeline/foothills season change snap → smooth
  crossfade restored** (Sept 22) — Christian: "crossfade snap would be
  good. We want all transitions to be as smooth and as natural as
  possible." Round 9's SVG-attribute filter fix (below) made these four
  discrete `setSeason()` jumps snap instantly instead of the old 0.7s CSS
  fade, since a CSS transition can't animate an SVG attribute set from JS.
  Fixed with a new `applySeasonFilterTweened(el, cssString, tweenMs)` in
  scene.js (exposed as `window.__applySeasonFilterTweened`), used only at
  these 5 call sites in components.js (boulder rock, boulder grass,
  treeline canopy, foreground plant, foothills range) — the 13 continuous
  per-frame callers in scene.js are untouched, since `s`/`tod` already
  interpolate smoothly there and a second smoothing layer would just add
  lag. On every call it rebuilds the filter's primitive chain in the
  target string's own token order (so the fully-settled look is pixel-
  identical to the old snap, never a reordered/re-composed color), looks
  up each slot's starting value by name from wherever the previous chain
  currently sits — mid-tween or settled — falling back to that function's
  identity value (`hue-rotate:0, saturate:1, brightness:1, sepia:0`) when
  the previous season didn't use that token at all, and cleanly retargets
  an in-flight tween on interruption (a fast tab click) instead of
  snapping back first. 700ms was chosen to match the old CSS transition
  duration exactly (confirmed against `travel()`'s own
  `PHASE_A_END`/`PHASE_B_END` window: `(0.35-0.25) * 7000ms = 700ms`).
  Verified directly in Chromium by sampling `el.__filterRec.current` every
  300ms through a real tab-click season change: boulder grass's hue-rotate
  eases 0 → -50 and its saturate/brightness ease 1 → 0.9/0.95 smoothly
  over the transition rather than jumping; same smooth easing confirmed on
  foreground plants (hue-rotate 0 → -45). Boulder rock's fall filter is
  identical to summer's (`saturate(1) brightness(1)`) so it shows no
  change either way — correct, not a bug. No console errors in Chromium,
  WebKit, or Firefox.
  - Side note found while verifying: the treeline-canopy and foothills-range
    `setSeason` functions converted here were, on inspection, not actually
    reachable on a live season change at all — `window.__distantTreeline`
    (treeline canopy) has no dispatcher call at all (still true, see the
    dead-code entry below), and `window.__foothillsWrap.setSeason` only
    ever fired once at initial page load. Foothills' fix follows directly
    below.
- ✅ **Foothills dead `setSeason` removed** (Sept 22, follow-up to the entry
  above) — Christian: "Foothills should be fixed if you can just so we do
  not forget about it." Root cause: `buildFoothillsRange` (components.js)
  set `wrap._svg = wrap` (the wrap IS its own inner svg reference), and
  that same element already gets a continuous, per-frame
  `applySeasonFilter(foothillsSvg, layerFilter('mtn'))` call from
  scene.js's render loop (`foothillsSvg = foothillsWrap._svg` → the same
  node). That continuous call overwrote whatever the discrete
  `FOOTHILLS_SEASON_FILTER`/`wrap.setSeason` jump had just set within
  about one animation frame, every time — so the discrete table never
  painted anything visible, at boot or on a season click, and the two
  calls fought over the same `el.__filterRec` cache since both key off the
  element itself (confirmed by inspecting `__filterRec.sig` directly: it
  kept flipping between the two calls' incompatible shapes). Fix: removed
  `wrap.setSeason`/the boot-time `wrap.setSeason(season)` call and the now-
  unused `FOOTHILLS_SEASON_FILTER` table entirely from
  `buildFoothillsRange` — foothills' season color was always meant to come
  from the continuous `GRADE.mtn` filter per the existing comment in
  scene.js ("Foothills still use the full GRADE.mtn filter"), so nothing
  is lost; if anything the result is smoother than the 700ms tween used
  for boulders/plants, since it's graded continuously across the whole
  multi-second `travel()` transition rather than a fixed window. Verified
  directly in Chromium, WebKit, and Firefox: sampled
  `window.__foothillsWrap.__filterRec` every 600ms through a real
  tab-click season change and confirmed a single, stable, continuously-
  interpolating filter (brightness/hue-rotate/saturate/sepia all easing
  smoothly toward the fall `GRADE.mtn` values, no fighting, no dead
  intermediate jump) with zero console errors in all three engines.
- ❓ **GitHub sync blocked** — this session's git access doesn't include
  `mrchristian-genki/seasonal-portfolio` (proxy: "not in this session's
  authorized repository set"). Deprioritized per Christian ("github is a
  good to have but not need to have, I will fix that later") — commits are
  sitting locally, ready to push once repo access is sorted on his end; in
  the meantime, the actual source files are written directly back to the
  `WEB - V2` and `WEB - CATALOG V2` folders on Drive, so nothing is only
  living in this session.

- ✅ **Page-load "layers slide up from the bottom" reveal** — Christian
  shared adventurecoastpunks.com's hero-load animation as a reference and,
  after a read on feasibility, asked for it. Every plate starts translated
  down + transparent and rises into place in three staggered waves on
  first load only, never re-triggered by scroll: (1) foreground/fx/
  midground/birds -- the near layers -- arrive first; (2) background/
  clouds/aurora/celestial/sky follow ~260ms later, already essentially
  settled by the time they're visible, matching the reference; (3) the
  hero text (plate-ui) arrives last, ~620ms in, once the illustration
  underneath has already landed. Foreground travels the furthest (10%),
  backmost plates barely move and mostly just fade (1-2%), like a real
  multiplane camera. Implemented as plain CSS transitions (no JS
  animation loop) with per-plate transition-delay for the stagger;
  scene.js just adds one `.scene-loaded` class to `#sceneCore`, timed to
  fire right after every plate-building IIFE has actually finished (not
  mid-construction) via a double-`requestAnimationFrame`. Respects
  `prefers-reduced-motion` (scene still appears, just instantly). Tuning
  note: an early pass gave each of the 10 plates its own small delay
  increment (0-460ms) and it read as everything arriving at once --
  ease-out curves front-load most of the visible motion into roughly the
  first third of their own duration, so small stagger gaps get swallowed
  by the easing. Grouping into 3 clearly-separated waves (0/260/620ms)
  fixed that. Verified in both Chromium and WebKit, desktop and mobile
  widths, plus that switching season tabs and scrolling don't re-trigger
  or otherwise disturb it.
- ✅ **Fish jump micro-animations, spring/summer only** — new. A small fish
  silhouette (teardrop body, forked tail, belly highlight) arcs up out of
  the lake and back down along a parabola in the open water stretch between
  the two shore banks, oriented along its own direction of travel, with an
  expanding/fading ripple ring at both the takeoff and landing splash
  points. Gated the same seasons as the shooting stars (spring/summer) but
  *not* restricted to night -- fish jump in daylight too, unlike the
  stars/aurora. Random interval (3-9s). Built the motion with
  `requestAnimationFrame` directly rather than CSS `@keyframes` from the
  start, having just hit a real CSS-custom-property/animation-timing race
  on the shooting stars (see below) -- no reason to risk the same bug
  twice. Verified in both Chromium and WebKit.

## New this pass (Sept 23 — housekeeping + performance)

Scope: cleanup and speed, no intended look changes except the bug fixes marked 🐞.

- 🐞 **boulder7, plant5, plant6 were off-screen** (thousands of units left): the
  flip used CSS `scaleX(-1)` on a nested svg, same bug as the Sept 22 band fix.
  New `mirrorNested()` mirrors inside the element's own viewBox. They now show.
- 🐞 **Lost media-query wrappers in scene.css**: the reduced-motion and <=760px
  blocks from the original site were pasted without their `@media` lines, so they
  applied everywhere: no spring motion on tabs/views, small tabs, and the "works"
  list stuck in one column on desktop. Wrappers restored (header is ~14px taller
  on desktop, works list is 3 columns again).
- **Season filters, fewer and cheaper**: identity filters (all no-op values) are
  now removed instead of applied; the whole foreground (band, boulders, plants,
  hero tree) shares ONE filter on `#fgGraded`, both shores share one on
  `#shoresGraded`. Filtered elements at spring daytime: 40 -> 10. In headless
  software rendering this was the dominant frame cost (all filters off = ~4x fps).
- **Clouds**: families that have faded out (<1% opacity) are `display:none` and
  skip their drift writes; opacity is only written when it visibly changes.
- **Per-frame grade strings memoised** in render() (was re-parsing the same grade
  ~20 times a frame).
- **Load**: `<link rel=preload as=fetch>` for the 11 sync-XHR assets. With 120ms
  simulated latency, scene-ready went 1.95s -> 0.82s in Chromium with no duplicate
  downloads (server's 30-day cache headers matter here). Chrome logs a harmless
  "preload not used because the request is synchronous" warning per asset.
  Safari may fetch some twice on first visit if a preload is still in flight.
- **Cache-bust**: mountain-shapes.js now has `?v=` too (it had none, with a
  30-day cache). All four bumped to v=1790150000.
- **Comments condensed** in scene.js/components.js (history lives here now);
  verified code-identical with esbuild. JS gzip: scene 50.8 -> 30.8 KB,
  components 50.4 -> 33.2 KB. scene.css 11.0 -> 6.4 KB gzip (dead rules removed:
  grade/wash overlays, deciduous fills, pine-tier/leaf-flutter/grass-bend,
  foliage-sway, #*ShoreFO, stale TEMP DEBUG note, mojibake).
- **Assets optimised** (svgo, 2-decimal precision, metadata/comments only; ids,
  classes, styles and structure untouched; pixel-compared): boulders ~30 -> ~15 KB
  gzip each, shores/plants 5-40% smaller. grassy-hills-1-nosky.svg had an invalid
  XML comment; removed.
- Removed the stale console.log banner.
- First-load payload (gzip: html, css, js, 12 svgs; excludes leaves PNGs): 319 KB -> 238 KB.

Upload set: index.html, css/scene.css, js/scene.js, js/components.js, and the 12
assets in assets/ (plus the missing assets/leaves/ folder from Drive).

## New this pass (Sept 21, round 9 — WebKit season-filter fix)

- ✅ **Root-caused and fixed the WebKit "colors don't change with season"
  bug** — Christian, testing live on desktop Safari right after the round 8
  painterly-overlay sync: "the banks, hero tree and the foreground grass do
  not change color on the winter season."
  - Built a minimal repro outside the scene entirely: a plain HTML page
    with CSS `style.filter` set on (a) a root `<svg>`, (b) a `<g>` one level
    inside a root svg, (c) an `<svg>` nested inside another `<svg>`, and
    (d) a leaf `<image>` one level inside a root svg. Screenshotted all
    four in both WebKit and Chromium: Chromium applies the filter in every
    case; WebKit only applies it to (a), the true outermost `<svg>` --
    (b), (c), and (d) all silently no-op, confirmed by pixel comparison
    (the shape just never changes color).
  - This is a MUCH bigger bug than the punch list's old "confirmed on
    waterPlane and the foothills range" entry suggested. Every one of this
    scene's per-object seasonal filters targets a nested `<svg>` (banks,
    boulders, plants, the foreground band -- all built via `placeSvg`), a
    `<g>` (generated trees, treeline, pine/deciduous canopies, boulder
    rock/grass groups), or a leaf `<image>` (the hero tree) -- i.e. every
    single case (b)/(c)/(d) covers. So essentially none of them were ever
    actually re-coloring in real Safari; it just wasn't obvious from a
    screenshot showing a still-visible, still-plausible-looking scene (the
    art already carries its own baseline color, so "the filter silently
    failed" looks identical to "there's nothing wrong" until you compare
    seasons side by side).
  - Extended the repro one step further to find the fix: applying an
    actual native SVG `<filter>` (feColorMatrix / feComponentTransfer
    primitives) via the `filter="url(#id)"` XML ATTRIBUTE, instead of the
    CSS `filter` shorthand via `.style.filter`, painted correctly in
    WebKit on a `<g>` AND on a nested `<svg>` in the same repro. That's the
    fix: `hue-rotate`/`saturate` map directly to `feColorMatrix
    type="hueRotate"/"saturate"` (the CSS spec defines them as literally
    the same operation); `brightness` maps to `feComponentTransfer` with a
    linear slope on each color channel; `sepia` maps to `feColorMatrix
    type="matrix"` using the exact identity-to-sepia-matrix linear blend
    the CSS spec defines `sepia(amount)` in terms of.
  - New `applySeasonFilter(el, cssString)` in scene.js (exposed as
    `window.__applySeasonFilter` for components.js) parses a CSS filter
    string into tokens, builds/caches a real `<filter>` + primitives on
    the target element (or its parent, for a leaf like `<image>` that
    can't hold its own `<defs>`), and updates the primitives' attributes
    in place on every call -- an early-out on an unchanged filter string
    skips all DOM work, since `render()` calls this every animation frame
    via the main rAF loop, not just on season change.
  - Replaced all 18 `.style.filter = …` call sites across scene.js
    (mountains, foothills, clouds, water, banks, hero tree, foliage,
    plants, boulders, generated trees, foreground band, treeline, water
    reflection) and components.js (boulder rock/grass, treeline canopy,
    foreground plant, foothills range) with `applySeasonFilter(...)` /
    `window.__applySeasonFilter(...)`.
  - Verified in Chromium, WebKit, and Firefox: clicked through all four
    season tabs with the real 7s `travel()` transition allowed to finish,
    confirmed by both DOM inspection (the built `<filter>` primitives'
    values match the season's `GRADE` table) and screenshot -- winter now
    genuinely frosts the hero tree/banks/boulders/grass/flowers pale, fall
    genuinely turns them amber/gold, matching what the pines already did.
    No console errors in any of the three engines.
  - Trade-off accepted, not fixed this round (see the new STILL OPEN entry
    above): boulders/plants/treeline/foothills lose their old 0.7s CSS
    crossfade on season change and now snap instantly, since a CSS
    transition can't animate an SVG attribute changed from JS.
- ❓ **Firefox report, investigated but not reproduced on current code** —
  Christian also reported "Foreground in Firefox is now missing" while
  testing the live site (was mid-upload of the round 8 sync at the time).
  Downloaded a real Firefox build for this environment (wasn't installed)
  and tested the current codebase directly: the foreground band, boulders,
  and plants all render correctly, no missing content. Firefox's console
  does print a harmless `XML Parsing Error: not well-formed` warning for
  `grassy-hills-1-nosky.svg` (the file with the illegal double-hyphen
  comment fixed for WebKit's DOMParser in round 7) -- this appears to be
  Firefox doing its own background XML validation on the synchronous XHR
  response regardless of the fact that only `.responseText` is ever read,
  since the actual injected content renders fine either way. Likely
  explanation: Christian was looking at the pre-round-8 live deployment,
  not the current code. Worth a re-check once the current sync is live,
  but not treated as an open bug against this codebase for now. If it
  recurs, the console warning is cosmetic noise -- the real thing to check
  is whether `buildCroppedSvgAsset`'s try/catch is actually falling into
  the `attachImgFallback` path for that element (that fallback re-fetches
  the same file as a raw `<img>`, which WOULD break on Firefox's stricter
  native XML parsing for that comment, unlike our own comment-stripped
  DOMParser path).

## New this pass (Sept 21, round 8 — painterly overlay)

- ✅ **Painterly shading pass extended to boulders, shore banks
  (`leftShore`/`rightShore` + the foreground grass band), and foreground
  plants** — Christian, after seeing the mountain/flower gradient work:
  "I love the artwork and textures added to the flowers. If you want to try
  and paint some other items to get them inline with the art look and feel,
  that is fine with me."
  - Mountains' technique (`makeMountainIsolated`/`makeGradientFill`: sort
    the source file's two flat classes by luminance into body/cap, replace
    each with a shared `<linearGradient>`) doesn't transfer to these three
    families — they're real fetched multi-path traced art with dozens of
    already-distinct fills (`boulder-grass-0_0.svg` alone has 67 individual
    `<path>`s), not two flat classes to reclassify, so there's no reliable
    luminance split to sort by and rewriting per-path fills would risk
    breaking existing baked-in shading.
  - Instead, new `addPainterlyOverlay(wrap, opts)` in `components.js` lays a
    warm highlight glow (upper right) and a cool shadow glow (lower left) ON
    TOP of the finished artwork, matching the light-from-upper-right
    convention already used by the pines/flowers/mountains. Two flat
    `<radialGradient>`-filled `<rect>`s, opacity carried in the gradient
    stops — deliberately NOT a runtime SVG `<filter>` and NOT
    `mix-blend-mode` (a blend mode inside a nested `<svg>` is exactly the
    kind of thing that's burned this scene on WebKit three separate times
    already this project; not worth a fourth), so this stays a plain static
    paint layer, no different in kind from the flower's own flat highlight
    ellipses.
  - **Bug caught before shipping**: the first version sized the overlay to
    the asset's full viewBox/crop window. Several of these assets have real
    transparent space inside that box — a small plant sprite inside a much
    bigger square viewBox, a boulder file with a visible gap between its two
    rock chunks, a diagonal bank crop with empty triangular corners — and
    the glow rect painted right over that empty space too: confirmed by
    screenshot, a pale rectangle floating on open water/sky next to the
    actual shape. Fixed by clipping the glow to a `<clipPath>` built from
    clones of the asset's own top-level shapes (clip-path only uses their
    geometry, so it doesn't matter that the clones' fills reference ids that
    live in the original, not the clone) and sizing the gradient rects to
    the bbox of those same shapes via a plain `getBBox()` pass, not the
    crop window.
  - Wired into `buildBoulderGrass`, `buildForegroundPlant`, and
    `buildCroppedSvgAsset` (the shared helper behind `leftShore`/
    `rightShore` and the foreground grass band) right after each fetches
    and injects its content. `buildCroppedSvgAsset` uses stronger
    opacity + a wider gradient radius than the default — these bank crops
    are large, mostly one flat traced green, so the boulders' subtler
    default (tuned against their already-busy multi-facet shading) barely
    read at all on a flat surface; confirmed by screenshot and increased
    until visible.
  - Verified in both Chromium and WebKit: overlay renders correctly (13
    glow groups across boulders/plants/banks, one per asset), no console
    errors, and season/day-night cycling still works normally (the overlay
    sits independent of each asset's own `setSeason` CSS-filter pass).

## New this pass (Sept 21, round 7)

- ✅ **Foreground grass band (`lagoonForegroundBand2`) was still invisible
  in Safari after the round 6 foreignObject fix** — Christian confirmed
  round 6 fixed the shore banks/boulders/plants ("Banks are showing up,
  yay!") but the immediate-foreground green hill crossing the bottom of the
  lake was still missing on the live site, both desktop and mobile Safari.
  Different root cause from round 6, isolated by checking this element's
  `getBoundingClientRect()` directly: it came back `0x0` even though 2 child
  nodes had been "injected." Cause: `grassy-hills-1-nosky.svg`'s own header
  comment contains a bare " -- " (an em-dash-style double hyphen), which is
  illegal inside an XML comment — only the closing `-->` may contain a
  hyphen sequence. `injectFetchedSvg()`'s `DOMParser(..., 'image/svg+xml')`
  call is strict XML, so WebKit rejected the whole document over that one
  comment and silently handed back a `<parsererror>` document instead of
  the real SVG. The `root.nodeName === 'parsererror'` guard already in
  place never caught it because WebKit's error document root is `<html>`,
  with `<parsererror>` nested inside `<body>`, not at the document root.
  Chrome parses the same malformed comment leniently, which is exactly why
  this only ever showed up in Safari and was hiding behind the (correctly
  fixed) round 6 bug until that one was out of the way.
  Fixed at the source, in the shared `injectFetchedSvg()` helper: strip
  every XML comment out of the fetched text before parsing (comments have
  no rendering effect, so this is always safe) and check for a
  `<parsererror>` anywhere in the parsed tree (`querySelector`), not just
  at the root. This is a general hardening, not a one-off patch — it
  protects every asset that goes through `injectFetchedSvg()`
  (boulders, plants, shores, foothills, this foreground band) against the
  same class of bug in any future hand-written or AI-generated SVG comment,
  not just this one file. Verified in WebKit (desktop + mobile viewport)
  and Chromium, no new console errors; `grassy-hills-1-nosky.svg` was the
  only asset file with this specific comment pattern (checked all of
  `assets/*.svg`).

## New this pass (Sept 20, round 6)

- ✅ **The big one: banks/boulders/plants/foothills/water-shimmer never
  rendered in Safari or mobile Safari at all** — Christian: "In safari the
  water can be seen on the far far right side barely. Is this why the banks
  never load on safari or mobile?" His screenshot showed the hero basically
  empty below the treeline: no shores, no rocks, no plants, no shimmer lines,
  just a flat pale-blue background (the water plane's un-filtered base
  color, barely visible on the right where it peeks past the hero tree).
  Root-caused directly against real WebKit (Playwright's `webkit` engine
  reproduces Christian's exact screenshot) — this took a lot of dead ends to
  isolate because every earlier theory checked out partially, then broke:
  - Not the seasonal CSS `filter` calls — content was already invisible with
    every filter forced to `none`.
  - Not async timing on its own — even a synchronous XHR fetch, injected
    synchronously in the same script pass, was still invisible.
  - Not `innerHTML` vs `createElementNS`/`importNode` — rebuilding the exact
    same nodes by hand via `document.createElementNS` and appending them was
    still invisible, as long as they went through a `<foreignObject>`.
  - The actual trigger, confirmed by elimination: **`<foreignObject>`
    itself**. WebKit silently refuses to paint *fetched* content placed
    inside a `<foreignObject>` — geometry, computed styles, and the injected
    markup all check out identically to Chrome, but nothing paints, no
    console error. A plain native nested `<svg>` (positioned with x/y/width/
    height/viewBox, no foreignObject, no HTML div in between) renders the
    exact same fetched content fine. This is the same family of bug
    `placeImage()` already hit for `<img>`/`<image>` a round earlier — this
    is the same fix applied to everything still going through
    `placeHtml()`'s foreignObject.
  - Second half of the fix: the fetch also has to be synchronous. WebKit
    separately refuses to paint *anything* appended to the scene's outer
    plate `<svg>` from a callback that runs after the page's initial
    synchronous script finishes (confirmed with a trivial `<circle>`: fails
    from a `load` handler, `setTimeout`, a microtask, or post-load
    automation, works when appended synchronously during the main script).
    Local assets are tiny, so switching `fetch().then()` to a synchronous
    XHR (`fetchSyncText()`) costs nothing noticeable.
  - Fix: added `placeSvg()` in `scene.js` (native nested `<svg>`, no
    foreignObject) alongside the existing `placeHtml()`, and moved every
    asset that fetches its content at runtime — `leftShore`/`rightShore`,
    all four boulders, all foreground plants, `foothillsWrap`, and
    `lagoonForegroundBand2` — onto it. `buildBoulderGrass`,
    `buildForegroundPlant`, `buildCroppedSvgAsset`, and `buildFoothillsRange`
    in `components.js` now take that native `<svg>` directly (no more inner
    `wrap.querySelector('svg')` lookup — the wrap *is* the svg) and inject
    fetched content via a shared `injectFetchedSvg()` helper
    (`DOMParser` + `importNode`) instead of `innerHTML`, fed by
    `fetchSyncText()` (synchronous XHR) instead of `fetch().then()`.
  - One knock-on fix: `render()`'s shore-filter block used to specifically
    target `document.querySelector('#leftShore svg')` (the old inner-svg
    workaround from an earlier round). Since `#leftShore` IS the svg now,
    that's back to plain `$('leftShore')`.
  - Verified in both real WebKit and Chromium (Playwright), desktop and a
    mobile Safari viewport — shores, boulders, plants, foothills, and the
    water shimmer lines all render correctly in every case now, with no new
    console errors. One smaller, purely cosmetic gap remains and is *not*
    part of this fix: WebKit still silently no-ops the seasonal/time-of-day
    CSS `filter` on some native SVG elements (confirmed on `waterPlane` and
    the foothills range) — content stays fully visible, it just doesn't
    re-tint with season/time-of-day the way Chrome does. Flagged below as a
    follow-up, not blocking.

## New this pass (Sept 20, round 5)

- ✅ **Clouds never tinted for night mode** — Christian caught this from a
  side-by-side day/night screenshot. Root cause: `buildClouds()` in
  `scene.js` builds each cloud family (cumulus/cirrus/altocumulus/
  cumulonimbus) via `SceneComponents.buildCloudFamily` and only ever eases
  each family's *opacity* per season in `updateClouds()` — nothing anywhere
  ever set a time-of-day filter on `window.__cloudSvg`, unlike every other
  layer (mountains, lake, banks) which already darken via the shared `lbri`
  (land-brightness) signal computed in `render()`. Checked the reference
  `cloud_families_catalog.html` catalog doc too — it has the exact same gap
  (season opacity gates only, no day/night handling at all), so this isn't
  a regression or something that got "lost," it's a feature that was never
  built for clouds in the first place. Fixed by applying
  `brightness(lbri) saturate(...) hue-rotate(...)` to `#cloudSvg` in
  `render()` right next to the mountain-range filter line, using the same
  `lbri`/`dim` signal — plus a small extra desaturate + cool hue-rotate
  scaled by `dim` alone, since a bare brightness cut barely reads as "night"
  on clouds' already-pale purple-lavender palette. Verified in Playwright:
  day filter `brightness(1) saturate(1) hue-rotate(0deg)` vs. night
  `brightness(0.3) saturate(0.8) hue-rotate(10deg)`, and visually confirmed
  via screenshots — clouds now read as dark, cool-toned and moonlit at
  night instead of unchanged day-color blobs.
- 📋 **Catalog survey — deer/bear/owl/fisherman/rainbow/moonbeam** (per
  Christian's ask, "did these get lost forever?" / "can we see what we have
  to both add to our scene and also add back to the catalog?"). Read all
  four project docs in full. Findings — **none of these are lost**, they
  simply exist only as standalone catalog prototypes and were never ported
  into the live scene's plate/world-space system:
  - **Deer** (`deer_card_3.html` + a matching card in
    `scene_parts_catalog_4.html`): full idle/look head-bob via
    `requestAnimationFrame` rotating a `<g id="deerHead">` around pivot
    `(40,48)` in a 128×128 viewBox, plus a 12s fade-in/hold/fade-out cycle
    (`translateX` + opacity) simulating emerging from/receding into the
    treeline fog. Confirmed **absent** from live `scene.js`/`components.js`
    via grep — not built yet.
  - **Bear** (`scene_parts_catalog_4.html`): fade-in/out only, no head-bob —
    single-path silhouette. Also absent from the live scene.
  - **Owl** (`scene_parts_catalog_4.html`, filed under a `plant` catalog
    card but titled "Owl") — genuinely new find, Christian didn't mention
    it. Night-only silhouette perched on a branch, glowing yellow eyes
    (two circles + pupils), subtle sway, gated to fall by default in the
    prototype. Never built into the live scene.
  - **Fisherman** (`scene_parts_catalog_4.html`, `data-obj="fish"`) — this
    is what Christian remembered as "SUP or fisherman in a boat slowly
    cruising by." Prototype note: "Rocks gently on the water. Slides across
    the scene window slowly." Animation is a combined rotate (rock) +
    small vertical bob + slow horizontal slide via `Math.sin()`, no
    `requestAnimationFrame` timing issues since it's driven the same way
    the fish-jump/shooting-star code already does it live. Not in the live
    scene yet.
  - **Rainbow, moonbeam-style shadows**: searched all four project docs
    (including the full remainder of `scene_parts_catalog_4.html` past
    where the last session's context cut off, plus `pine_tree_card_4.html`
    and `cloud_families_catalog.html` in full) for "rainbow" and "moonbeam"
    — **zero matches, in either doc or the live codebase.** These aren't
    lost catalog assets; they'd be new builds from scratch if wanted.
  - Also present in the catalog but not asked about directly: a **Lake
    Tahoe water** card (shimmer/ripple/per-season `<linearGradient>`s,
    already the reference the live water shimmer was built from) and a
    **Sun & Moon celestial** card (arc path, beams, glow) — both already
    represented live in some form, just noting they exist in the catalog
    too.
  - Next step is Christian's call: which of deer / bear / owl / fisherman
    (and any new rainbow/moonbeam idea) to actually port into the live
    scene's world-space plate system, and in what priority — no code
    written for any of these yet, this was research-only per his explicit
    "let's see what we have" ask.

## New this pass (Sept 20, round 4)

- ✅ **Night-mode darkening on season change** — `LIGHT.dim` was wired into
  `render()` correctly but too weak to notice (sky-gradient coefficient
  0.28, land-brightness coefficient 0.2, `dim` itself peaking at 0.6).
  Bumped to 0.45 / 0.4, and `dim` now peaks at a full 1.0 in `travel()`'s
  moon-dip calc. Verified with before/mid-transition/after screenshots —
  a clear, then-settling darkening as the season swaps at night.
- ✅ **Stars missing in spring/summer night skies** — the star field was a
  child of `auroraSvg` with no opacity of its own, so it inherited the
  whole container's winter/fall-only aurora gate. Split the gating:
  `auroraSvg` (and everything not otherwise gated, including the stars)
  now follows night-mode alone; only `auroraBands` (the actual ribbons)
  keeps the extra winter/fall-only gate. Verified: full star field visible
  in a summer night sky with no aurora ribbons.
- ✅ **Shooting stars, spring/summer night only** — new micro-animation,
  gated the opposite of the aurora (`kf(s,[0,1,1,0])`, spring/summer only).
  Took three real bugs to get fully working, all now fixed and verified
  in both Chromium and WebKit:
  1. A `linearGradient` painting the streak used a horizontal axis on a
     vertical `<line>` — collapsed to one fully-transparent sample point.
  2. Even fixed to a vertical axis, `objectBoundingBox` gradients are
     undefined on a perfectly vertical line (zero-width bounding box) —
     switched to `gradientUnits="userSpaceOnUse"` with a per-star gradient
     sized to that star's own length.
  3. The CSS `@keyframes` animation read `var(--travel)`/`var(--dur)`
     custom properties that raced with the `classList.add()` triggering
     it — intermittently froze the whole streak at its invisible 0%
     keyframe. Replaced with a small `requestAnimationFrame` loop driving
     `opacity`/`transform` directly in JS; no more custom-property race.
  Random interval (4–11s), only spawns when both the season and
  night-mode gates are on, self-cleans its DOM and per-star gradient on
  completion.

## New this pass (Sept 20, round 3)

- ✅ **Mobile: no banks or foreground at all on iPhone (Chrome and Safari)**
  — root-caused for real this time, and it was a bug I introduced earlier
  this week, not a stale-deploy issue. The tablet/mobile "nudge" CSS for
  the pine clusters and both shore banks used `translateX(110px)` /
  `translateX(260px)`, on the theory that a CSS transform on an SVG
  element resolves in the ambient SVG's own world-unit coordinate system
  (so "260px" would actually mean a small on-screen nudge once scaled
  down with everything else). Checked directly with computed-style
  matrices in both a real WebKit build and Chromium: that's wrong in
  BOTH engines — a CSS `transform`'s px values are always real screen
  pixels, never attenuated by an ancestor SVG's viewBox scale. So this
  was shoving both banks and both pine clusters 110-260 *real screen
  pixels* sideways — more than their own on-screen width at phone size —
  mostly or entirely off-frame. It happened to still look fine in
  Chromium's particular layout math but pushed everything out of frame
  in WebKit (Safari and Chrome-on-iOS are both WebKit, which is why it
  failed in "both"). Fixed by switching to percentage `translateX`
  values (resolve against the element's own box in every engine, no
  ambiguity) and re-tuning the shift to something small and sane.
  Verified in real headless WebKit + Chromium at 375/390/800px — full
  scene (pines, mountain, hero tree, flowers, boulders, both banks) now
  renders identically in both.
- ✅ **No stars in spring/summer night skies** — stars were a child
  element of the aurora's own `<svg>` with no opacity of their own, so
  they inherited the aurora's winter/fall-only season gate. Split into
  two independent gates: the whole aurora/star container now follows
  night-mode alone (on on every season at night), while just the
  aurora ribbon bands keep the extra winter/fall-only gate on top of
  that. Verified: stars now visible in a summer night sky.
- ✅ **Catalog shore cards were visibly stretched** — root cause:
  `catalog-app.js`'s `kind: 'shore'` case force-stretched the cropped
  art with `preserveAspectRatio: 'none'` into the card's fixed box,
  regardless of the real crop aspect ratio (the live scene never does
  this — `placeShore()` computes its box from the crop's own ratio).
  Switched to `'xMidYMid meet'`, which preserves the real proportions.
  Christian's "build a fake scene with hill/water/sky behind it" idea
  is a further improvement (matches how the composite/hero-tree catalog
  entries already work) but is a bigger lift — not done this round.

## New this pass (Sept 20, round 2)

- ✅ **Leaf-fall animation for autumn** — built as a canvas particle system
  alongside the existing rain/snow (same `rainCanvas`, same per-frame
  clear+redraw, gated on `SEASON` the same way). Uses real leaf artwork:
  `aspen-leaf.svg` (a 4-color sprite sheet — green/chartreuse/gold/orange)
  and `single-leaf-01.svg` (a detailed red maple), rasterized once via
  Playwright/Chromium into 5 small transparent PNGs under
  `assets/leaves/`, then drawn with `drawImage()` per leaf (rotating,
  swaying side to side, tumbling) — no runtime SVG filters, same
  performance class as the existing rain/snow drawing. 46 leaves, fall-only
  (`kf(s, [0,0,0,0.85])`), verified at 1440/375px with no console errors.
- ✅ **Foreground flower redesign** — `makeFlower()` rebuilt with two-tone
  painterly petals (a darker base ellipse + a smaller lighter highlight,
  both flat shapes) and 3 bloom variants (round/daisy/cup) cycled across
  the 5 live flowers so they read as different plants instead of one shape
  recolored 5 times; added small paired base leaves for grounding. Also
  fixed a real bug found in the process: `makeFlower` (and the scene.js
  call site) defaulted to `tier: 'd'`, meaning **all 5 live flowers were
  invisible below 1024px** — same bug class as the pines earlier this
  week. Now defaults to `tier: 'mobile'`; confirmed all 5 render on a
  375px viewport.
- ✅ **Painterly shading pass — mountains** — `makeMountainIsolated()`'s
  flat body/cap fills replaced with 3-stop vertical `<linearGradient>`s
  (shadowed base → given palette tone → sunlit top), re-stopped in place
  (not swapped) on every season change so the shaded look survives
  crossfades. Static gradients, not a runtime filter — same "no SVG
  filters in steady state" rule the water shimmer already follows.
  Verified across all 4 seasons + night mode. Boulders/banks/plants were
  checked and are real traced artwork already (already have their own
  baked-in shading), not flat procedural shapes — see STILL OPEN above.
- ✅ **Catalog micro-animation audit** — cross-checked every catalog entry
  against what's actually called in the live `scene.js`. Most of what was
  still marked `status: 'progress'` turned out to already be live and just
  never got its status flipped: all 8 isolated mountains, all 4 cloud
  families, snowfall, the 3 boulder-grass variants, water shimmer, all 5
  foreground plants, the long foothills range, and the hero alder tree.
  Updated all of those to `'live'`, plus corrected the mountain-iso note
  text (was describing an old white-mix recolor scheme, not the current
  `MOUNTAIN_PALETTE` + gradient system) and the `leaf-single` note (used
  to say "not yet wired in" — now describes the leaf-fall system above).
  `aspen-cutout` and `bare-tree-shell` are the two genuine exceptions,
  still not live — see STILL OPEN.

## Mobile/tablet responsiveness (new pass, Sept 20)

- ✅ **Pine trees were completely invisible on tablet and mobile** — not a
  scaling issue, an actual bug: `makeDetailedPine()` defaults to
  `tier: 'd'` (desktop-only) when the caller doesn't pass one, and
  `scene.js`'s pine placement never did. The site's own
  `[data-tier="d"]{display:none!important}` rule (≤1024px) was hiding every
  single pine tree below tablet width — confirmed live via DOM inspection,
  not guessed from screenshots. Fixed by passing `tier: 'mobile'` (the
  always-visible tier) explicitly.
- ✅ **Pine clusters and both shore banks nudged/scaled at small widths** —
  added tablet (≤1024px) and mobile (≤640px) rules that shift the two pine
  clusters and `leftShoreFO`/`rightShoreFO` inward and scale them up
  slightly, since the scene's fixed aspect ratio otherwise just shrinks
  everything linearly and fine detail gets lost at phone width. Verified
  with Playwright screenshots at 1440/800/375px — trees and banks now read
  clearly at all three.
- ✅ **"Play the whole year" button was dead** — no JS was ever wired to
  `#playYear`. Now cycles winter→spring→summer→fall→… on a loop (one
  `travel()` crossfade + a dwell pause per season), works correctly with
  night mode on or off, and a manual tab click during playback stops the
  loop cleanly instead of fighting it.
- ✅ **`#clockLabel` was static markup** — always read "Spring" regardless of
  the active season. Now updates on every season change, whether from a tab
  click or the year-loop.
- ✅ **Flowers were invisible on tablet/mobile** — same `tier: 'd'` bug as
  the pines, found while redesigning them this round (see "New this pass"
  above). Fixed; confirmed visible at 375px.
- 💭 **Not yet done**: boulders, foreground plants, and the hero tree don't
  have the same small-screen nudge/scale treatment the pines, banks, and
  flowers just got. They were already visible at every width (no
  `data-tier` bug), just small — worth a pass if they still read too small
  on an actual phone.

## Catalog (WEB - CATALOG V2) — updated Sept 20

- ✅ **Left shore / right shore had no catalog entry at all** — added both
  (`left-shore`, `right-shore`) using the real assets and the same
  `buildCroppedSvgAsset` call the live scene uses, plus a new generic
  `kind: 'shore'` case in `catalog-app.js` so they render like any other
  card. Verified rendering correctly in a headless browser.
- ✅ **Catalog's `components.js`/`mountain-shapes.js` were out of date** —
  didn't have `MOUNTAIN_PALETTE`, `buildCroppedSvgAsset`, or the current
  `buildDistantTreeline`/`buildCloudFamily`/`buildWaterShimmer` fixes from
  the live site. Synced both files from the live `WEB - V2` copy.
- ✅ **`mountain-range-assembled` and `distant-treeline` catalog entries were
  stale** — both said `status: 'progress'` / "not yet placed at actual scene
  scale," but both are confirmed live in the V2 scene now. Updated status to
  `'live'` and the notes to reflect it.

---

## Archive — resolved in earlier sessions

Full diagnostic detail kept for reference; these were all confirmed fixed
and verified live before this pass.

<details>
<summary>Foreground / hero elements</summary>

- ✅ Hero tree was sitting in the water — repositioned to shore level.
- **OBSOLETE**: hero peak's baked-in decorative tree looking clipped at the
  horizon — this was `hero_peak_snow.svg`-specific art, and that asset was
  replaced entirely by the `MOUNTAIN_PALETTE`/`makeMountainIsolated`
  multi-mountain system. No longer applicable.

</details>

<details>
<summary>Lake / water</summary>

- ✅ Lake seasonal color redone from real Lake Tahoe reference photos
  (pixel-sampled per season), after two earlier attempts were too weak or
  shifted the wrong direction.
- ✅ Water shimmer visibility, ripple-on-impact, rain/snow fall-range,
  double-opacity bug, box-height confinement, drop fade-in/out, and
  water-only x-range masking — long chain of related bugs, all root-caused
  and fixed (see prior session log for the full blow-by-blow if needed).
- **OBSOLETE**: "the two lake inlets don't change per season" / "one static
  `landscape-hills-scenic-green-no-trees.svg` image" — the lake is no longer
  one shared image; `lakeAsset`'s inlets and the current water plane are
  part of the newer per-asset layout.

</details>

<details>
<summary>Mountains / background</summary>

- ✅ Foothills layer invisible — race condition on `preserveAspectRatio`
  override running before the fetched SVG existed. Fixed with a poll.
- ✅ Replaced the single static hero peak image with `makeMountainIsolated`
  + a real per-season `MOUNTAIN_PALETTE` (body/cap hex pairs, not a CSS
  filter over gray) — this was listed as a "consider doing" item and is now
  done and live.

</details>

<details>
<summary>Night mode / darkening bugs</summary>

- ✅ Boulders not darkening — filter loop targeted stale element IDs
  (`rock_L1` etc.) left over from before boulders were renamed.
- ✅ Pines not darkening for night — no time-of-day filter existed for them
  at all; added.
- ✅ Six foreground plants and the flower row never had a night/season
  filter wired up; added (flower bug was a mismatched element ID,
  `foliageSvg` vs. the real `flowerSvg`).

</details>

<details>
<summary>Birds</summary>

- ✅ Birds re-layered into their own `plate-birds` DOM layer, between
  mountains and midground (previously rendered on top of everything).
- ✅ Bird depth-of-field physics were backwards (biggest bird had the
  slowest drift); reassigned so speed scales with size.

</details>

<details>
<summary>Lagoon / bank rework (the big Sept 17-18 arc)</summary>

- ✅ Multi-round redesign replacing one shared lake/lagoon image with:
  real `MOUNTAIN_PALETTE`-colored mountains, a dark `distantTreeline` as
  the sole middle-distance layer, and two independent near-camera banks
  (`left-shore.svg` / `right-shore.svg`) — full arc, false starts, and
  final numbers are in `seasons-portfolio-session-log` (memory), not
  repeated here.
- Standing rule that came out of it: only one light-green hill layer
  belongs in the composition (the foreground band); the middle-distance
  layer stays dark (treeline/foothills), never a second light hill.

</details>

## Sept 23 (later) — colour + performance pass (?v=1790160000)
- Land grading: CSS filters on HTML "grade layer" wrappers (sRGB, GPU-friendly); lake colour computed in JS (9 gradient stops), no filter on the water. Season grade order now always follows the destination season (was path-dependent). Stars/aurora hidden by day; spring flowers set at boot.
- Pines: each pine is its own small svg in an HTML div; the sway is a CSS rotation of the div (compositor). Chrome had been splitting the pines into ~140 huge layers (184 -> 74 layers total).
- Clouds: each cloud is its own small HTML layer moved with translate3d (was repainting the whole cloud plate most frames). buildCloudFamilyLayers in components.js; old buildCloudFamily kept for reference.
- Water shimmer: SMIL baseFrequency animation replaced with a ~12fps JS step, paused off-screen.
- Boot: painterly-overlay bbox reads batched (one layout), world-svg core width cached, fall leaf PNGs load on first fall, mountain-shapes.js trimmed to shapes 2/4/6 (catalog keeps all 8), hero tree preloaded.
- Add ?fps to the URL for a frame-rate readout (e.g. /cg/new/?fps).
- Open: hero tree + grass/flower sway still repaint inside SVG in Safari (move to HTML layers if ?fps shows Safari struggling). Optional JS minification (~30 KB gz) would need a build step. Unused assets on server: boulder-grass-0_2.svg, grassy-hills-1.svg, landscape-hills-scenic-green-no-trees.svg.

## Sept 23 (evening) — Safari pass (?v=1790170000)
- Real-device test: Chrome on the 120 Hz Mac median 88 fps; Safari median 31 fps, worst in fall/winter and at night.
- Night sky: stars are HTML divs (opacity twinkle), each aurora band is pre-blurred in its own GPU layer (drift moves the layer). Shooting stars in their own small svg.
- Water: shimmer streaks (turbulence filter) alone in #mgFx; ripples, drops and fish moved to #mgFxAnim so rain/snow no longer re-run the filter.
- Graded layers (#bgFoothills, #bgMountains, #mgTreeline, #mgWater, #mgShores, #mgFx, #mgTrees, #plateClouds, #plateBirds, #plateForeground) get will-change:transform so each is painted/filtered once.
- Chrome drawing work: about half in day, about a third at night. Safari numbers pending the next ?fps test.
- Foreground (?v=1790180000): boulders, plants, hero tree and flowers each on their own layer (#fgItems, .fg-layer); the hero tree is now a div (#isoTree) rotated by CSS. Static hill band stays in the foreground svg.

## Sept 23 (late) — ?bench results and Safari fixes (?v=1790210000)
- ?bench (js/bench.js, loaded only with ?bench) runs spring day / fall day / winter night / season change and switches parts off one at a time. First real-device results (Chrome MBP, Safari MBP, Safari iMac, iPhone 15 Pro Max): Chrome fine everywhere; in Safari the two clear costs were CSS sway/twinkle animations and the big-plate layer hints (removing the hints helped iPhone/iMac by 10-15 fps).
- Big-plate will-change hints removed; kept only on #mgFx (shimmer) and #plateBirds.
- Boulder grass, plant and flower sway: each swaying group is lifted at boot into its own layer div (scene.js liftSways) and the DIV rotates (.sway-grass / .sway-grass-mirror for flipped items / .sway-flower). Pivots verified identical to the old SVG sway.
- Lake rain/snow drops and ripples are now canvas particles (components.js buildWaterShimmer: attachCanvas) with the old keyframe curves; stars are drawn on a canvas at ~15 fps.
- Bug found and fixed during testing: the particle draw loop multiplied on every drop landing (would have slowed rain/snow steadily over time).
- Pines at narrow widths (?v=1790220000): below 1024px the cluster nudge/scale lifted some trunks off the sloping banks. seatPines() (scene.js) checks each trunk base against the solid shore shapes after load/resize and lowers only floating pines (CSS translate, independent of the sway).
- Second bench round (MBP/iMac Safari): removing the remaining will-change hints gave the biggest gains (MBP winter night 12 -> 56 fps, spring 37 -> 54); iPhone reloaded the page at the end of the run (layer memory). All will-change hints removed (?v=1790230000). Rule: don't add will-change in this scene; animated transforms get layers from the browser anyway.
- Sept 24: iPhone Safari reloads the page during ?bench (furthest: Season change / no colour grading). No JS or DOM growth over a full run (checked), so it's graphics memory. ?v=1790240000: hero tree layer cropped to the world (+300 margin; was ~3x world width), .grade-layer overflow:hidden so each colour filter works on the visible plate only, rain canvas no longer reallocated every frame (fractional size compare). Pivots/pixels verified identical.

## Sept 24 — frame work + wildlife (?v=1790250000)
- render() only runs when its inputs change; colour grading (big-plate filters, sky, lake) is written at most ~20x/s while animating. Settled grade strings verified identical to before.
- Note: Chrome warns the <link rel=preload> hints aren't used by the sync-XHR asset loads (the HTTP cache still serves them on the live server). Worth revisiting if load time comes back up.
- Wildlife (js/wildlife.js + js/creatures.js + js/creature-shapes.js, lazy-loaded 1.5s after page load):
  - Timed visitor every 30-60s (one at a time), season/night aware; fisherman every ~2-3 min in spring/summer/fall daytime, drifting across the top of the lake from behind the left bank to behind the right bank.
  - Cast: deer, doe, elk (fall/winter), bear (walks out from behind the hero tree), wolf howling (fall/winter nights), hare and wolf running along the left bank, white snowshoe hare dashing across the snowy foreground (winter), eagle soaring, hawk/owl/squirrel on the hero tree's left branch (owl at night; snowy owl in winter, day or night), fox and chipmunk rising from behind the big rocks.
  - Natural coat colours per species (winter coats for deer/elk/fox); rig palettes for the white hare and snowy owl.
  - Hidden tap spots (plateUi): rocks, right-bank pines, hero tree, left bank, snowy foreground (winter), sun/moon (eagle by day; wolf or owl at night), lake (fish jumps where tapped; ripple in winter). Tapping again sends the visitor away.
  - Hero text now lets taps through to the scene; only its links/buttons take clicks.
  - Positions tuned in world units against zoomed grids; checked in Chrome and WebKit, desktop and phone.
- Ideas for later: "Marley and Me" human element (cabin or tent); winter ermine; lantern on the fisherman at dusk.
- Sept 24 later (?v=1790260000):
  - Floating pines, real cause: since the Sept 23 pine-layer rewrite, each pine's vertical position inside its cluster box was lost (a missing y0 made `top` invalid), so every pine but the tallest sat too high. Fixed; all six trunk bases now land exactly on their world y. Positions retuned so trunks sit in the light grass; the narrow-width cluster nudge/scale is removed (pines keep world positions at every width).
  - Fall hero tree: extra GRADE.heroTree step on #isoTree (sepia/hue-rotate to burnt orange-brown), other seasons identity.
  - Big animals (deer, doe drinking, elk, bear, wolves) moved to the far shore under the mountains: small, feet on the waterline, drawn after the water. Doe can still graze on the right bank.
  - Birds read as distant silhouettes: eagle small and slow; hawk/owl perch on the right-bank pine tips; the scene's own bird flock halved in size and slowed.
- Sept 24 (?v=1790270000): far-shore deer/doe/elk walk forward out of the treeline (from slightly further back and smaller) fading in, and walk on back into the trees fading out (ease-in fade so they melt away). Right-bank deer (bankDeer) steps out from behind a pine trunk, grazes/looks, turns and walks back behind the same tree. Trigger rocks glow (warm bloom + rising sparkles) and each always wakes one area: big left rock = far shore, its neighbour = right bank, small rock by the bush = left bank (hare), big lake rock = fisherman, small lake rock = fox/chipmunk. On phones the hero button covers two of the left rocks.

## Bucket list
- Marley and Me: a cabin or tent as the human element. Christian is making the art; placement, scale and lighting to follow once it's in (ideas: left bank near the pines, a warm window/lantern glow at night, smoke from a chimney in winter).
- DONE Sept 24: reflections of the far-shore animals and the boat (mirrored copy of the rig, faded, slight blur).
- DONE Sept 24: fisherman now out day and night; lantern with a flickering glow and a streak on the water at night.
- More winter animals (ermine): needs silhouette art like the other catalog animals.
- DONE Sept 24: catalog uses the shared creatures.js (natural coats via Creatures.naturalPaint, white winter hare, snowy owl). Bear coat lightened to cinnamon (was invisible against the far treeline).
- Sept 24 (?v=1790290000): wildlife test panel. Press and hold any trigger rock (~1s) or add ?wildlife: lists every visit, plays on demand ('any season' override on by default), clears busy areas first, 'send everyone away'. Trigger guide page published with a numbered map of the rocks.
- Sept 24 (?v=1790300000): footer 'Trigger guide' link opens a modal (<dialog>) with the numbered rock map (assets/trigger-guide.jpg, loaded on first open), what each rock does, the test panel, other hidden spots and testing addresses. Esc, the x or a backdrop click closes it.
- Sept 24 (?v=1790310000): right bank lowered 185 world units so its waterline (~1830) matches the left bank's. Moved with it: right pines (+185), bank deer (RIGHT_Y), pine-top perches, right-bank tap area, trigger rocks 4 and 5 (the lake rocks are part of right-shore.svg). Fisherman now drifts from behind the left bank to behind the right bank's pines and on behind the hero tree. Reflections: blur removed (cheaper). Safari showed one 'webpage was reloaded' on the MBP after the reflections update: watch for repeats.
- Sept 24 (?v=1790340000): visitors kept right of the hero text (x > ~2000) and travelling left to right; fox and chipmunk now rise from behind the right lake rocks; hare runs along the right bank; fisherman bigger (h 200). Removed the <link rel=preload> hints for the sync-XHR assets (never reused for sync requests: double downloads + Safari console warnings). Safari MBP still showed 'webpage was reloaded' once: investigate memory next.
