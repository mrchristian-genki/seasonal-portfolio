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
- **Reduced motion is the one exception:** with `prefers-reduced-motion: reduce`, things may appear or move at once.

## Standing rules

- Facts on the site come only from Christian's Notes or his own words.
- People stay anonymous unless they've agreed to be named. Never publish the home location. Helena, Christian's wife, is named by her
  choice (she'd rather be named than called "wife"; Christian, Oct 19, 2026).
- The narrator is "GlazyArray" unless a Note or its category chooses A.L.T.A. or Starlee (Christian, Oct 11 and
  12, 2026; the Studio sets it, assets/narrator/resolve.js decides). A.L.T.A.'s and Starlee's own Notes they tell
  themselves. Starlee is the robot Marley (she was "Robot Marley" until Christian renamed her, Oct 19, 2026; her
  code and files still say marley). Starlee and Marley are "she".
- No brands, logos or text inside AI renders; real browser logos only where credited. The key ring in "Go Live Please" may carry
  the real logos of the services it names, placed on blank badges after rendering (never drawn by the AI) and credited
  (Christian, Oct 19, 2026: "We are promoting them").
- Never commit secrets.
- Keep the behind-the-scenes. When art, animation or a feature is built from Christian's renders, save the working
  pictures that show how it was made (contact sheets, before and after, cut-outs, layouts) while they still exist,
  for future Notes and a behind-the-scenes item (Christian, Oct 19, 2026). A session's own files don't last.
