# Working on christiangehrke.com (seasonal-portfolio)

Rules for anyone (person or AI agent) changing this site. The parts catalog (mrchristian-genki/parts-catalog) follows
the same rules.

## Motion: nothing is fast or instant (Oct 8, 2026)

Christian's rule, a lesson learned on the Tumble: every change on screen eases. Nothing snaps.

- **Lights ease on and off, always.** A lamp, jewel, glow or button that switches on or off fades (about 0.6 to 1 s,
  ease-in-out), never jumps. Cross-fade a lit image over an unlit one rather than swapping an image or a
  background-position. No `steps()` blinks, no `transition: none` on a state change.
- **All animation is eased and unhurried.** Use ease-in-out curves; pick the slower of two speeds when in doubt. Patterns
  and sequences step slowly enough that each fade finishes (the Tumble's jewels: about a second a step).
- **Scrolling to a spot is a slow, eased tumble, never a jump.** Use the page's own eased scroll (web/tumble.js
  `tumbleTo`: a few seconds, longer for longer distances, stopped at once by a wheel, touch or key), not
  `scrollTo` with `behavior: 'auto'`, and not the browser's quick `smooth`.
- **Hovers are subtle.** A small lift or glow, not a big zoom.
- **The Tumble's jump at 88 is fast on purpose** (Christian, Oct 8): the 88 MPH flashes, the flash and the spin hit
  hard like the film; only the return to normal eases.
- **Reduced motion is the other exception:** with `prefers-reduced-motion: reduce`, things may appear or move at once.

## Standing rules

- Facts on the site come only from Christian's Notes or his own words.
- People stay anonymous unless they've agreed to be named. Never publish the home location.
- The narrator is always "GlazyArray". Marley is "she".
- No brands, logos or text inside AI renders; real browser logos only where credited.
- Never commit secrets.
