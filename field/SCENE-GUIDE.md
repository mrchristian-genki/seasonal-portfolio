# Scene guide: how the living headers are built

The working recipe behind the site's animated scenes, written down on Oct 2, 2026 after building
three of them in a day. Any Claude session making a new scene, logo or header reads this first, so
each one is built the same way and feels like the same site.

## What we built (Oct 1–2, 2026)

| Scene | Where | Look | Lives in |
|---|---|---|---|
| The canyon logo: Marley holding Christian by the hood at a cliff edge | Homepage header, About | Low-poly illustration, sandstone ring, changes with the seasons and night | `seasonal-portfolio`: `assets/logo/`, `css/logo.css` |
| The deep sea: Marley curled in a jellyfish, Christian the diver offering a glowing cube of parts | Parts Catalog header | Photo-real, midnight water, jellyfish cyan and cube violet | `parts-catalog`: `assets/hero/`, `css/catalog.css` |
| The diver logo: Christian in the brass helmet | Parts Catalog, beside the title | Photo-real, cyan-to-violet ring | `parts-catalog`: `assets/logo/diver*`, `css/logo.css` (`.logo-diver`) |
| The workshop at night: Christian in goggles shaping a hologram, minis on glowing discs, Marley asleep | Workshop header | Photo-real, warm lamp and sunbeams, one cool hologram | `parts-catalog`: `assets/ws/`, `css/workshop.css` |

Each page has its own world; what ties them together is the ring logo shape, Christian and Marley in
every scene, and the same build method below.

## The method

### 1. One composed image first
Generate the whole scene once (OpenArt), with everyone in place. It is the target: it fixes the
style, the light, the camera angle and where each piece sits. Everything else is cut to match it.

### 2. Clean pieces, as files
Each moving thing becomes its own layer:
- **Best:** ask for each piece as a transparent PNG in the same lighting and angle (one object per
  image, the whole object visible).
- **Or:** edit the composed image with "Same image, same size and framing, keep only X, replace
  everything else with flat solid #00FF00 green". Same framing means the layers stack exactly.
- Always ask for the empty background too ("remove X, Y and Z and fill in behind them").
- Send pieces as attached files or a Drive link. Images pasted into the chat can be seen but not
  opened as files.

Cut-outs Claude makes itself (colour keys, GrabCut, rembg) are a fallback; the artist's clean PNGs
always win, and replace the rough cuts as soon as they arrive.

### 3. Layers, back to front
Water or wall → far creatures and props → the subjects → glows and particles → a few things in
front (out of focus) for depth. Big blends: light-on-black art (jellyfish, holograms) uses
`mix-blend-mode: screen`; glows are radial gradients on screen blend.

### 4. Light is cheap and does the most
Most of the magic needs no new images: pulsing glows (lamps, cube, lure, disc rims, goggles),
light shafts and sunbeams, drifting dust, marine snow, bubbles, a flickering hologram, sleeping
z's. Glow from inside an object: copy its brightest areas into a second layer and let that breathe.

### 5. Motion: small, slow, out of step
Every piece moves on its own rhythm (prime-ish durations, staggered delays), so nothing pulses in
unison. Subjects move a few percent at most: a float, a bob, a breath. Fast or large motion reads
as cheap. Respect `prefers-reduced-motion`: everything holds still, glows sit at a middle value.

### 6. Built to the header height
Position everything in "scene units" tied to the header height (`--u: calc(var(--h) / N)`), so
the relationships hold from a wide monitor to a phone. Right-align the main group; let back walls
and open water spread out on wide screens; on phones put the scene on top and the text below.
Show fewer extras on narrow screens rather than crowding.

### 7. Real things from the site
Where possible use what the site already has: the Workshop's minis are the live cast from
`creatures.js` (antlers, coats, idle motion), its hologram cycles through `origami-art.js` meshes.
Draw every rigged part, and prefer standing/idle poses (bending opens the neck seam).

### 8. Proportion and placement
Keep animals in real proportion to each other (elk bull > bear ≈ mule deer buck > doe). Keep
subjects off the text; the tallest piece may just reach it. Animals face the person. Never crop a
subject at an edge mid-body: stop it flush against the frame instead.

### 9. Finish: share card and icons
Each page gets its own 1200×630 share card rendered from its own scene (title on the open side),
its own favicon set from its logo, a description, alt text, and a theme colour. Add `?v=` to every
changed asset so caches let go.

## Prompts that worked

**Style line for an illustrated piece**
> Flat vector illustration, cel-shaded with hard-edged posterized colour blocks, clean outlines of
> even weight, 3 to 4 tones per surface, no gradients, no texture. Matches the reference image
> exactly in line weight, shading and colour.

**Splitting a composed image into layers**
> Same image, same size and framing. Keep only [PIECE] exactly as it is. Replace everything else
> with flat solid #00FF00 green.

**A single prop that matches the scene**
> A single [OBJECT], sitting on a wooden workbench, seen straight on from the front at bench height.
> Photo-realistic, warm golden lamp light from above, soft sunlight from the left, the same
> lighting, colour and style as the reference image. About [SIZE] compared with a small blue bench
> vise. Isolated on a transparent background, the whole object visible, no table, no other objects.

**A face-shot logo from a scene**
> Close-up head-and-shoulders portrait of the same [CHARACTER] from the reference image, matching
> his face exactly … centred, with a little empty space around the edges so it can be cropped to a
> circle. Same colour palette and rendering style as the reference.
Use the selfie as a strong face reference; describe the person rather than naming a lookalike.

**Christian, for prompts** (agreed Oct 2, 2026)
> Christian: a tall, broad-shouldered man in his mid-30s with a rugged, quietly confident presence
> and the solid build of someone who works with his hands. Thick sandy strawberry-blond hair, short
> at the sides and longer on top, naturally messy and spiky. A strong, squarish face with a firm
> jaw, fair skin with a light warm flush and faint freckles, a few days of stubble, blue-grey eyes.
Not ginger: his hair is sandy strawberry blond.

**Marley, for prompts**
> Marley: a medium-sized tan-and-white mixed-breed dog, short glossy coat, a white blaze down her
> face, white chest and paws, long soft floppy ears, dark leather collar.

## Lessons from the day
- The pose carries the story: the dog *rescuing* him read wrong until she was standing and pulling.
- Eyes do the acting: wide when slipping, relaxed (not sleepy) when safe.
- "Subtle" means a few percent and several seconds.
- Firefox can't divide lengths in `calc()`: size layers in percentages.
- Phones: size dialogs with `dvh`, or the close button hides under Safari's toolbar.
- A sleeping animal needs a sign it's asleep (breath, z's).
- Don't overwrite a node's whole inline style after a library sets CSS variables on it.

## Small template: old prints on a table
For animated historic photos inside a post: mounted prints on warm wood, each a few degrees off
square, drifting 2-3 px over 11-17 s, out of step. Same rules as the big scenes: subtle, slow, real
things only. How-to in `field/README.md`.

## Next scenes
Ideas on the list: the Books page (a reading nook), Play (trail at golden hour), each with its own
ring logo. Same recipe.
