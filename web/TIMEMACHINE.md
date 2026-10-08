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

## 1. The machine (the background still)

> [The look.] The machine seen front-on and a little from below: a great vertical ring of brass, about two metres
> across, with a turning inner ring of uranium glass glowing green and a white-hot core at its centre. Nine glass
> jewels are set evenly around the outer ring, each glowing its own colour (orange, red, sky blue, teal, green, deep
> blue, violet, amber, coral). Rows of small round indicator lamps and toggle switches on brass panels at the
> base. Haze, light beams from above, sparks crawling over the ring. The machine fills the right two-thirds of the
> frame; the left third falls away into dark, hazy shadow.

*Goes:* behind the title, blurred 4 to 6 px and darkened on the left.

## 2. The machine on a phone (9:16)

> [The look.] The same brass ring machine seen from below, filling the lower half of a tall frame, its glow rising
> into haze. The top half is dark, hazy air with faint beams of light and a few drifting sparks.

*Goes:* behind the title on phones.

## 3. It comes alive (a clip, made from 1)

Use picture 1 as the start frame.

> The lamps blink on and off at their own pace; the inner glass ring turns slowly; the core pulses brighter and
> dimmer; sparks crawl along the brass; the haze drifts. The camera holds still. Seamless loop, no cuts.

## 4. The browsers as glass (nine sprites on green)

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

## 5. Indicator lamps (a sprite sheet on green): done (Oct 8)

Christian's sheet is keyed into `web/media/lamps.webp` (lit on the top row, dark below), and twelve of its lamps
blink at the machine's base. More sheets in other shapes and colours are welcome.

> A flat, front-on sheet of vintage indicator lamps and push buttons on pure #00FF00: round and square lenses in
> amber, red, cobalt blue, violet and uranium green, in knurled chrome and brass bezels, three rows of three. Left
> half: every lamp glowing ON. Right half: the same lamps in the same order, dark (OFF). Even lighting, no shadows on
> the green.

*Goes:* the lamp panel at the machine's base, blinking.

## 6. The flash at 88 (a clip)

> [The look.] The machine at full power: the core flares white, a ring of blue-white light bursts outward through
> the haze, sparks spray off the brass, then it settles back to its glow. 3 seconds, black before and after.

*Goes:* the flash when you fall fast enough.

## 7. Glass close-ups (textures)

> Macro photograph of uranium glass glowing vivid green under ultraviolet light, pressed into an art deco sunburst
> pattern, against black. Shallow depth of field.

> Macro photograph of pressed Czech glass jewels in ruby, sapphire and topaz, set in an engraved brass panel, lit
> from behind, against black.

*Goes:* the panels behind the readouts and the chart.

## 8. The arrival (a clip for a Story or a reel, 9:16)

> [The look.] The camera pushes slowly through dark haze towards the machine as it powers up: first one lamp, then
> rows of lamps, then the rings begin to turn and the gems light one by one, and the core blooms white. 8 seconds.

*Goes:* social, and the share image for the Tumble.

---

## Your ideas

Add yours below, and Claude will place them.

-
