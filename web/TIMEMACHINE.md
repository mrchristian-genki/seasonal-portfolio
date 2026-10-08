# The Tumble's time machine: prompts

The top of the Tumble (web/index.html, `.tb-now`) is "now": the browser as a time machine. Right now it's drawn
in code: brass and glass rings turning, nine glowing gems for the browsers, a uranium-glass heart, blinking lamps,
three readouts (destination, present, last time departed), and a chart of everything the browser can do. These are
the pictures that would take it further. A render goes behind the code, blurred just enough to keep the text easy
to read, and the code keeps the lights blinking on top.

## How it works

- **Size:**
  - The background still is 16:9, at least 2560 × 1440.
  - The phone version is 9:16, 1440 × 2560.
  - Clips are 6 to 8 seconds, silent, and loop.
- **Leave room for the words.** The title and text sit on the left third (on phones, the top half). Keep that part
  darker and calmer, and put the machine's brightest parts on the right.
- **Never:** text, letters, numbers, logos or people in a render. The browsers appear as glass objects that *suggest*
  them (a fox, a compass, a lion), never their real logos. The real logos stay in the toolbox, credited.
- **Sprites on green:** the gems and lamps come back on pure chroma green (#00FF00), flat and front-on, like the lamp
  sheet you sent (glowing on one side, dark on the other). Claude keys out the green and makes them blink.
- **Bring them back:** send them to Claude. They go in `web/media/`.

**The look (paste at the start of every prompt):**

> A cinematic still of a fantastical time machine built from a web browser: an art deco machine of polished brass,
> black enamel and glowing glass. Pressed Czech glass in jewel colours, uranium glass glowing vivid green, manganese
> glass with a soft violet-green glow, as if under ultraviolet light. Concentric rings and dials, fine engraved
> brass, rivets, little round indicator lamps. A dark room full of haze, light beams, sparks of static, a sense of
> awe: the moment you first see the machine. Rich colour, soft depth of field. No text, no letters, no numbers, no
> logos, no people.

---

## The control room look (sharp, clean, super retro)

This is the look from Christian's references: the inside of a retro-futuristic sub or ship, all copper and brass
consoles, rows of round analog gauges glowing teal, amber buttons, small blue screens and round portholes full of
warm light. These prompts make the machine sharp and clean rather than hazy. (His second reference is a watermarked
stock photo, so it's mood only; nothing of it goes on the site.)

**The control room look (paste at the start of every prompt in this part):**

> A tack-sharp, clean, cinematic photograph of a retro-futuristic control room from 1960s and 1970s analog science
> fiction: brushed copper and brass consoles with crisp rounded edges, rows of round analog gauges with glowing teal
> faces and slim amber needles, amber backlit push buttons and toggle switches, small curved screens glowing soft
> blue with fine line diagrams, round porthole windows full of warm light. Warm amber and deep teal palette, clean
> studio lighting with soft rim light, a little atmospheric haze, high detail, crisp focus everywhere, symmetrical
> composition, no grime, no clutter, no motion blur. No text, no letters, no numbers on the dials, no logos, no people.

The screens come back **blank but glowing** (no diagrams if you can), so the page can put real things on them: the
year you've fallen to, the three readouts, and the chart of what the browser can do. The gauge needles can come
back separately, so the code can swing them with the scroll.

### A. The time machine console (the new background)

> [The control room look.] Seen straight on from the pilot's seat: a wide, curved console in copper and brass. At
> its centre, a large round chronometer dial with a glowing teal face and a ring of nine glowing glass jewel lamps
> around its bezel, each a different colour (orange, red, sky blue, teal, green, deep blue, violet, amber, coral).
> Above the console, three small blank screens glowing soft blue. On the right, two round portholes full of
> swirling golden light, like a tunnel of time rushing past. The left third of the frame falls away into a darker,
> plain copper wall panel with a single row of small gauges, quiet enough to set a title over.

*Size:* 16:9, 2560 × 1440. *Goes:* behind the title, blurred only a touch.

### B. The same console on a phone

> [The control room look.] The same console from a little higher, framed tall: the chronometer dial and its ring
> of jewel lamps in the lower half, the glowing portholes above it at the sides, and the top third a calm, dark
> copper ceiling with soft lights.

*Size:* 9:16, 1440 × 2560. *Goes:* behind the title on phones.

### C. It comes alive (a clip, made from A)

Use A as the start frame.

> The gauge needles tremble and settle, the jewel lamps pulse one after another around the dial, amber buttons
> blink in short rows, the light in the portholes swirls slowly forward, a soft flicker runs across the screens.
> The camera holds perfectly still. Seamless loop, no cuts.

*Size:* 6 to 8 s, 1920 × 1080 or larger. *Goes:* the background, playing.

### D. Blank screens (sprites)

> [The control room look.] A single curved monitor set into a copper console, front-on, its screen glowing an even
> soft blue with a faint scan-line texture and nothing on it, a thin brass bezel with rounded corners. Isolated on
> pure chroma green (#00FF00).

Make three: wide, square and tall. *Goes:* the readouts and the chart sit inside them.

### E. Gauges and needles (sprites)

> [The control room look.] A sheet of six round analog gauges, front-on, on pure chroma green (#00FF00): knurled
> brass and copper bezels, glass fronts, glowing teal faces with fine tick marks and no numbers, and no needles.
> Then, on the same green, the six matching slim amber needles laid out flat, each with its little brass hub.

*Goes:* gauges along the console whose needles swing with the year as you fall.

### F. Switches and push buttons (sprites, on and off)

> [The control room look.] A flat, front-on sheet on pure chroma green (#00FF00): chrome toggle switches, square
> amber push buttons, round teal and red push buttons, and a rotary dial, in three rows. Left half: each one on and
> lit. Right half: the same ones in the same order, off and dark. Even lighting, no shadows on the green.

*Goes:* blinking and flipping along the console, like the lamp sheet.

### G. The porthole of time (a clip)

> [The control room look.] Close on a single round porthole in a riveted copper wall: through the thick glass, a
> tunnel of golden and teal light streams towards the viewer, then flares white for a moment and settles back.
> Seamless loop, 6 s.

*Goes:* the flash when you fall fast enough (88).

### H. The submarine's porthole room (for the squid in the Parts Catalog)

> [The control room look, but underwater:] the inside of a small deep-sea submarine, a curved copper wall with one
> big round porthole in the middle and gauges and amber buttons around it. Through the glass, only dark, deep-blue
> water with a few drifting specks, empty and waiting. Front-on and centred.

*Size:* 16:9, 2560 × 1440. *Goes:* behind the squid card's story mode, with the squid swimming in the glass.

### I. Close-ups (textures)

> [The control room look.] Macro photograph of one round analog gauge, its teal face glowing, a slim amber needle,
> knurled brass bezel, shallow depth of field, against dark copper.

> [The control room look.] Macro photograph of a row of square amber backlit push buttons in a brushed copper panel,
> clean and sharp, shallow depth of field.

*Goes:* the panels behind the readouts and the chart.

**Words that keep it sharp and clean:** "tack-sharp", "crisp focus everywhere", "clean studio lighting", "no grime",
"no clutter", "no motion blur", "symmetrical", "high detail". **Words that keep it retro:** "1960s and 1970s analog
science fiction", "brushed copper and brass", "round analog gauges", "amber backlit buttons", "small curved screens".

## J. The browser jewel buttons (clean, readable small)

The nine jewels round the big dial are about 40 px across on screen. The porthole renders look great up close, but
at that size the fine detail (fur, mosaic tiles, rivets, reflections) turns to mush. These prompts make proper
buttons instead: one bold, simple shape per browser that still reads at the size of a fingernail.

**What makes them work small:**
- **One shape, big and centred**, filling about 70% of the jewel. No scenery, no background objects inside.
- **Two or three colours at most**, flat and saturated, with one clean highlight.
- **A thick, plain brass bezel**, the same on all nine, so they read as one set on the dial.
- **Straight on, perfectly round**, no perspective, no tilt, no shadow on the green.
- **Two states:** lit (glowing from inside) and unlit (the same jewel, dark and dull), so the page can switch them
  as you fall through the years.

**Size:** square, 1024 × 1024, each jewel about 800 px across, centred. One jewel per image, or all nine on one
sheet in a 3 × 3 grid with plenty of green between them.

**The button look (paste at the start of every prompt in this part):**

> A single round jewel push button, seen perfectly straight on, centred, isolated on a flat pure chroma green
> background (#00FF00). A smooth domed cabochon of coloured glass set in a thick, plain, polished brass bezel ring
> with a clean bevel and no rivets or engraving. Inside the glass, one bold, simple, iconic shape with clean edges,
> large and centred, made of glowing glass, lit softly from within, with a single crisp white highlight at the top
> left of the dome. Flat, even studio light, sharp focus, simple and graphic like a game icon, readable at a tiny
> size. No text, no letters, no numbers, no logos, no scenery, no extra details, no shadow on the green.

Then add the shape and colours:

1. **Mosaic (1993):** a globe of large square tiles, only blue and gold, with a few big tiles for the land.
2. **Netscape (1994):** a ship's wheel with eight thick spokes, solid teal glass on deep navy.
3. **Internet Explorer (1995):** a blue glass ball with one thick gold ring crossing it at an angle.
4. **Opera (1996):** one thick, glossy red glass ring (a torus), with dark red in its centre.
5. **Safari (2003):** a bold compass star with a red and white needle, on sky-blue glass.
6. **Firefox (2004):** an orange fox curled in a ring around a purple glass ball, as one simple silhouette.
7. **Chrome (2008):** a flower of three big petals in red, yellow and green round a bright blue centre.
8. **Edge (2015):** one bold curling wave, sea-green and teal, curling into a circle.
9. **Brave (2016):** a simple lion's head, front-on, in coral-orange glass with a few big flat facets.

**The unlit version of each** (same prompt, add this at the end):

> The same button switched off: the glass dark and dull, its colour deep and muted, no inner glow, only the white
> highlight on the dome.

**Bring them back** as they are (on green). Claude keys out the green, makes each a 128 px sprite with its lit and
unlit state, and swaps them into the dial.

---

## The first look (art deco and glowing glass)

### 1. The machine (the background still)

> [The look.] The machine seen front-on and a little from below: a great vertical ring of brass, about two metres
> across, with a turning inner ring of uranium glass glowing green and a white-hot core at its centre. Nine glass
> jewels are set evenly around the outer ring, each glowing its own colour (orange, red, sky blue, teal, green, deep
> blue, violet, amber, coral). Rows of small round indicator lamps and toggle switches on brass panels at the
> base. Haze, light beams from above, sparks crawling over the ring. The machine fills the right two-thirds of the
> frame; the left third falls away into dark, hazy shadow.

*Goes:* behind the title, blurred 4 to 6 px and darkened on the left.

### 2. The machine on a phone (9:16)

> [The look.] The same brass ring machine seen from below, filling the lower half of a tall frame, its glow rising
> into haze. The top half is dark, hazy air with faint beams of light and a few drifting sparks.

*Goes:* behind the title on phones.

### 3. It comes alive (a clip, made from 1)

Use picture 1 as the start frame.

> The lamps blink on and off at their own pace; the inner glass ring turns slowly; the core pulses brighter and
> dimmer; sparks crawl along the brass; the haze drifts. The camera holds still. Seamless loop, no cuts.

### 4. The browsers as glass (nine sprites on green)

Make each one alone, front-on, on pure #00FF00, about 1024 × 1024, as a jewel set in a round brass bezel:

1. **A fox curled around a globe**, in amber and orange pressed glass around a deep violet glass sphere.
2. **A compass rose under a domed blue glass lens**, with a fine red and white needle.
3. **A round glass aperture of four colours**: red, yellow and green petals around a sky-blue centre.
4. **A breaking wave curling into a circle**, in teal and sea-green glass.
5. **A blue glass sphere with a thin gold ring orbiting it at an angle.**
6. **A red glass ring**, thick and glossy like a polished torus.
7. **A lion's head in coral-orange faceted glass.**
8. **A ship's wheel of teal glass** over a dark glass horizon, with a tiny glass comet streaking across it.
9. **A globe made of small tiles of coloured glass**, like a mosaic.

*Goes:* the nine gems on the outer ring, one for every browser in the toolbox, the gone ones included.

### 5. Indicator lamps (a sprite sheet on green): done (Oct 8)

Christian's sheet is keyed into `web/media/lamps.webp` (lit on the top row, dark below), and twelve of its lamps
blink at the machine's base. More sheets in other shapes and colours are welcome.

> A flat, front-on sheet of vintage indicator lamps and push buttons on pure #00FF00: round and square lenses in
> amber, red, cobalt blue, violet and uranium green, in knurled chrome and brass bezels, three rows of three. Left
> half: every lamp glowing ON. Right half: the same lamps in the same order, dark (OFF). Even lighting, no shadows on
> the green.

*Goes:* the lamp panel at the machine's base, blinking.

### 6. The flash at 88 (a clip)

> [The look.] The machine at full power: the core flares white, a ring of blue-white light bursts outward through
> the haze, sparks spray off the brass, then it settles back to its glow. 3 seconds, black before and after.

*Goes:* the flash when you fall fast enough.

### 7. Glass close-ups (textures)

> Macro photograph of uranium glass glowing vivid green under ultraviolet light, pressed into an art deco sunburst
> pattern, against black. Shallow depth of field.

> Macro photograph of pressed Czech glass jewels in ruby, sapphire and topaz, set in an engraved brass panel, lit
> from behind, against black.

*Goes:* the panels behind the readouts and the chart.

### 8. The arrival (a clip for a Story or a reel, 9:16)

> [The look.] The camera pushes slowly through dark haze towards the machine as it powers up: first one lamp, then
> rows of lamps, then the rings begin to turn and the gems light one by one, and the core blooms white. 8 seconds.

*Goes:* social, and the share image for the Tumble.

---

## Your ideas

Add yours below, and Claude will place them.

-
