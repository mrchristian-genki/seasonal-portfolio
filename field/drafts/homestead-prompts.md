# The homestead: prompts for the art

The pictures for the Lake Home's homestead (the plan: field/drafts/homestead.md). Christian makes them; Claude cuts
them out and places them on the hillside below the lake. The map can be built first with plain stand-ins, and each
picture replaces its stand-in as it arrives, so nothing waits on the art.

## How it fits together

- **Each place is its own picture,** standing alone on a flat background, so it can be cut out, placed, lit and moved
  on its own. The hillside, paths, stream and grass under them are drawn in code, matching the lake's grass above.
- **Two versions of each, identical but for the light:** **A, unlit** (day) and **B, lit** (dusk and night: windows
  and lamps glowing). The site fades B over A, window by window, at dusk (CLAUDE.md: lights ease on, never jump).
  Make A first, then make B as an **edit of A** (see "Getting B to match").
- **Winter (C), only where it shows:** snow on the roofs and ledges, an edit of A. The rest of the year comes from the
  lake's own colour grading, which tints them by season the way it tints the trees.
- **Moving parts are separate, small pictures** that the site turns or swings in code: the water wheel, the
  anemometer cups, the Kinetic Garden's rotors, the lighthouse lamp. The lighthouse beam, the Studio's liquid, the
  butterfly, the firefly, Starlee and A.L.T.A. in her tubes are animated on top.
- **Background: flat magenta (#FF00FF), not green.** Grass, the green liquid and A.L.T.A.'s sea glass are all green
  and would vanish with a green key. Magenta appears nowhere in the homestead.
- **No ground and no shadow under them.** Each place ends at a clean, flat base line; Claude adds the ground, the
  soft contact shadow and the glow on the grass in code, so they sit on the hill in any season and at any hour.
- **Size and camera:** square, 2048 × 2048 (wide places like the dock and the bike park: 3072 × 1536). The same
  camera for all: seen from a little above and slightly to the side, about 20 degrees, the front facing us; light
  from the upper left. The place fills about 80% of the frame, nothing cut off at the edges.
- **Never** text, letters, numbers, logos or people in a render. Signs, labels, the mile markers and the newsstand's
  covers stay blank; names and numbers go on the page in code.
- **Send them back** named after their place and version (`workshop-a.png`, `workshop-b.png`, `workshop-c.png`). They
  go in `assets/homestead/`.

## The look (paste at the start of every prompt)

> A single building from a small storybook homestead in the Sierra Nevada, made with care: a hand-built workshop
> world where warm wood, river stone and weathered shingles meet polished brass, copper pipework, riveted steel and
> glowing glass, retro-futuristic and handmade, like a craftsman's place that quietly runs on clockwork and light.
> Clean illustrated style with soft painterly shading and gentle texture, crisp silhouettes, rich but calm colour,
> the glass glowing in the site's turquoise (pale aqua #7ff5e8 to deep teal #0f6f6a). Small, loving details to find:
> worn tools, tiny plants in pots, a bird on the ridge, hand-made repairs. Seen from slightly above and to the side,
> soft light from the upper left. Isolated on a flat, solid magenta background (#FF00FF), the building ending at a
> clean flat base line with no ground, grass, shadow or reflection under it.

**Guard line (end of every prompt):**
> No text, letters, numbers, words, logos, signs with writing, or people anywhere in the image.

## Getting B (lit) and C (winter) to match

Make A, then use the generator's edit (inpaint, image-to-image) on that same picture:

- **B, lit:** *"Same image exactly. It is dusk: every window glows from inside with warm lamplight, the lamps and
  glass details glow softly in turquoise, a little light spills from the open doors. The sky stays the flat magenta
  background. Change nothing else: same shapes, same position, same details."*
- **C, winter:** *"Same image exactly. Fresh snow lies on the roofs, ledges, railings and window sills, a few icicles
  hang from the eaves. Change nothing else, and keep the flat magenta background."*

Check by flicking between them: nothing should move but the light (or the snow).

---

## Ring 1: the first map

### 1. The Workshop

> [The look.] A big timber workshop shed with tall double barn doors standing open, inside a glimpse of a long
> workbench, hanging tools, a lathe and shelves of glass jars glowing faintly. A copper chimney pipe with a small
> brass weathervane shaped like a gear. On the bench, in plain view, one untouched block of pale wood (the uncarved
> block), and a worn knife hanging alone on the wall. Light jars hang from the eaves. [Guard line.]

Versions: A, B, C. Tiny details to keep: the wood block, the knife, a cat-sized robot broom leaning by the door.

### 2. The Newsstand

> [The look.] A small round newsstand kiosk with a domed copper roof and a turquoise glass lantern on top. A wooden
> rack on the front holds four magazines, two by two, their covers blank and softly coloured, plus a rolled awning and
> a little brass bell. A stool and a coffee cup inside. [Guard line.]

Versions: A, B, C. The four covers stay blank: the real magazine covers are placed on them in code, so ask for them
flat and facing us.

### 3. The Library

> [The look.] A tall, narrow stone library with high arched windows, through which we see shelves of books all the
> way up and a rolling ladder, a round reading window at the top, and a small brass telescope on the windowsill. Ivy
> climbs one corner. On the doorstep, a tiny mouse reading an acorn-sized book. [Guard line.]

Versions: A, B, C.

### 4. The Screening Barn

> [The look.] A red-brown timber barn with a big round window in the gable, through which a projector's cone of light
> shines across the dark loft onto a hanging screen (the screen blank and pale). Film reels stacked by the door, a
> string of round bulbs along the eaves, a hayloft door ajar. [Guard line.]

Versions: A, B (the projector beam and the bulbs lit), C.

### 5. The House

> [The look.] A small, cosy farmhouse with a deep porch, two rocking chairs, a lamp glowing in the front window,
> shingles, a river-stone chimney with a curl of smoke, and a mailbox on a post by the steps. A dog bed on the porch
> with a well-chewed ball. [Guard line.]

Versions: A, B, C. The mailbox's flag is its own little piece if it can be: it can lift in code.

### 6. The Studio (the VIP door)

> [The look.] A small studio pavilion with tall glass walls in a brass frame. Inside, clear glass pipes loop around
> the room and through a large glass heart on a stand, all of them empty and clear (no liquid). A heavy round brass
> door with a single small lamp beside it, slightly ajar. A worktable with a lamp and papers. [Guard line.]

Versions: A, B, C. The pipes and the heart stay empty and clear: the coloured liquid (blue mornings, green days,
orange nights) flows through them in code, the same colours as the Studio. The door's lamp lights in code when you're
signed in.

### 7. The Observatory (the time machine)

> [The look.] A small round observatory with a brass dome, its shutter slit open to the sky, a long brass telescope
> pointing out of it. Through a round window at the base we glimpse concentric brass rings and glowing uranium-green
> and jewel-coloured glass: a time machine. A note pinned beside the door (blank paper). [Guard line.]

Versions: A, B (the rings and gems glowing), C.

### 8. The Parts Depot

> [The look.] A tidy brass-and-glass shop like an old seed store, its whole front wall made of small wooden drawers
> with brass handles and blank label frames, one drawer open and empty. Glowing glass jars of gears, springs and lenses
> on the shelves, a rolling ladder, a workbench with a magnifying lamp. Everything kept with care. [Guard line.]

Versions: A, B, C. Keep the one empty open drawer: it's the use of emptiness.

### 9. The Automaton Labs on the dock (wide)

> [The look, but "a row of small buildings" for "a single building".] A wooden dock on stilts reaching out to the
> right, with two small glass-and-brass lab sheds on it. The first: an assembly bay with a half-built friendly
> automaton on a stand under a work lamp, its chest open showing a glass heart. The second: a glass hot shop with a
> small round kiln glowing turquoise and finished glass jars cooling on a rack. At the end of the dock, a slim brass
> lighthouse with a glass lamp room. A small arched footbridge joins the dock to the land on the left. The stilts end
> at a clean flat line where the water will be; no water drawn. 3072 × 1536. [Guard line.]

Versions: A, B (the lab windows, the kiln and the lighthouse lamp lit), C.

**Separately, for code to turn:** the water wheel on its own, *"[The look.] A wooden and brass water wheel with
paddles, seen exactly side-on and flat, perfectly round, centred, with nothing else"*. And the lighthouse's lamp,
*"a small round glass lamp lens, glowing turquoise, seen front-on, on magenta"*.

### 10. A.L.T.A.'s tubes (Christian, Oct 19)

Big glass tubes rising out of the grass below the lake, so A.L.T.A. can be seen coming and going between the lake and
the homestead, without the lake scene being touched.

> [The look, but "a group of tall glass tubes" for "a single building".] Three tall, wide glass tubes of different
> heights rising straight up side by side, each banded with brass rings and rivets every so often, filled with clear
> blue-green lake water with a few bubbles and a strand of lake grass inside. At the top, each tube curves over in a
> gentle arch toward the left (toward the lake) and ends in a brass collar, as if it carries on out of sight. At the
> bottom, each tube sits in a heavy brass base with portholes and a small turquoise lamp. The tubes are empty of
> anything but water. The bases end at a clean flat line. Tall, 1536 × 3072. [Guard line.]

Versions: A, B (the base lamps and a soft glow up through the water), C (snow on the brass rings and bases).

A.L.T.A. herself comes from her own clips (assets/alta/parts: she already has rising, diving and gliding clips cut out
on their own), shrunk and set inside a tube in code: now and then she rises up a tube, pauses at a porthole to wave,
and is gone over the top toward the lake, or comes back down. If those clips don't read at that small size, one new
clip: *"A.L.T.A. swimming straight up inside a tall glass tube full of water, seen side-on, her tail fanning slowly,
on magenta, 6 seconds, seamless"*, using her look from assets/alta/KIT.md.

### 11. The bike park (wide)

> [The look, but "a small outdoor bike park" for "a single building".] A wooden pump track of rolling humps and banked
> turns, a couple of small wooden kicker ramps and a log ride, a bike rack with a tool stand and a brass air pump, a
> water bottle on a post. Friendly and mellow, nothing extreme. Clean flat base line, no ground drawn. 3072 × 1536.
> [Guard line.]

Versions: A, C. (No B needed: a string of lamps along the rack can be drawn in code.)

### 12. The trailhead

> [The look.] A trailhead: a wooden signpost with three arrow signs pointing different ways (all blank), a small
> timber shelter with a map board (the board blank), a bench, a trail register box, a pair of walking sticks leaning on
> the post. The first of a row of small stone mile markers (blank). [Guard line.]

Versions: A, C. The arrows and the board stay blank: the trail names and the miles go on the page.

### 13. The climbing wall

> [The look.] A timber climbing wall about two storeys tall, gently overhanging, covered in colourful holds, a crash
> pad at its foot, a rope hanging from a brass pulley at the top, a chalk bag on a hook. [Guard line.]

Versions: A, C.

---

## The painted ground (Christian's idea, Oct 19): one scene, then the buildings taken away

The places stay separate pictures (sharp, lit and moving on their own). Under them goes **one painted ground** per
layout, so the hill reads as a single painting: grass, the path, the stream from the lake, the labs' pond, flowers,
fences and stones, with the plots where the places stand.

**The guides** (field/drafts/homestead-guides): the layout with every place in its exact spot, over the code's plain
ground. `desktop-day.jpg` (2520 × 2365) was the first; the wide painting is done (`ground-*.jpg`, every season by day
and night). For phones: `phone-section-1.jpg` to `-4.jpg`, top to bottom, each exactly 1080 × 1920 (9:16), each
break falling in open grass between rows.

1. **Paint the whole scene from a guide** (image to image, keeping the composition):

   > [The look, but "a whole small homestead on a gentle hillside" for "a single building".] Repaint this picture as one
   > finished storybook illustration, keeping every building exactly where and how it is: a gentle grassy hillside in
   > the Sierra Nevada below a lake, a winding sandy footpath, a stream running down from the top left into a small pond
   > under the wooden dock, soft hummocks of grass, wildflowers, small stones, a few low fences and shrubs between the
   > places, soft contact shadows, light from the upper left. Keep the picture's edges and the buildings' positions
   > exactly. [Guard line.]

2. **Take the buildings away** (an edit of the scene from step 1):

   > Same image exactly, with every building, structure, dock, tube, sign, bench and tree removed, and the ground
   > painted in where they stood: plain grass and earth plots, the path, the stream and the pond carrying on underneath.
   > Change nothing else. [Guard line.]

   Step 2's picture is the ground; step 1's shows how the whole should look. Send both.

3. **Its versions:** night, day snow and night snow as edits of the step 2 ground, the same way as the places.

### The phone sections (Oct 19)

Four tall pictures, top to bottom, the same steps as the wide one (paint the scene from the guide, then take the
buildings away, then the versions). Paste for each section:

> [The look, but "one tall section of a small homestead on a gentle hillside" for "a single building".] Repaint this
> picture as one finished storybook illustration, keeping every building exactly where and how it is: a gentle grassy
> hillside in the Sierra Nevada, a winding sandy footpath, soft hummocks of grass, wildflowers, small stones, a few
> shrubs and low fences between the places, soft contact shadows, light from the upper left, in the same painted style
> as the wide homestead painting. The footpath enters at the middle of the top edge and leaves at the middle of the
> bottom edge, so this section joins the ones above and below; keep the top and bottom edges plain grass and path.
> Keep the edges and the buildings' positions exactly. [Guard line.]

- **Section 1 (the top)** also has the stream: *"A stream enters at the top left edge, tumbles down a small waterfall
  and fills a pond under the wooden dock."* Its top edge meets the lake's bank: grass only, no lake, no horizon.
- **Section 4 (the bottom)** ends the hill: *"The path runs off the bottom edge."*
- **Tip:** paint them in order, giving each the one above it as a second reference, so the grass, light and path match
  across the joins.

Then, as before: the buildings taken away (step 2), and the versions (night, each season by day and night, snow).


## The frame: the village in a window (Christian's idea, Oct 19)

The homestead tucked into an ornate steampunk window (his first sketch: field/drafts/homestead-guides/frame-idea-v1.jpg).
The frame is its own picture; the live village (its places, lights and seasons) shows through the opening.

> [The look, but "an ornate frame" for "a single building".] An ornate retro-futuristic window frame seen straight on:
> carved dark wood with brass filigree and rivets, glowing jewel crystals in turquoise and teal at the corners, an
> orrery of small brass planets and gears at the top centre, glass tubes of glowing turquoise liquid down both sides,
> and along the bottom a control panel with two brass sliders, three round lamps and a large crystal at the centre,
> above a small blank brass plaque. The opening in the middle is empty flat magenta (#FF00FF), exactly 16:9 and
> perfectly rectangular with softly rounded corners, the frame's inner edge clean and sharp. The whole frame on flat
> magenta. Perfectly symmetrical. [Guard line.]

- **The opening is everything:** exactly 16:9, straight edges, flat magenta inside, nothing of the frame reaching into
  it. Claude puts the village there.
- **The plaque stays blank.** The name goes on it in code (no text in renders).
- **Lit and unlit:** a second version with the crystals, lamps and tubes glowing, made as an edit of the first ("Same
  image exactly; the crystals, lamps and tube liquid glow brightly; change nothing else"). They fade on at night or on
  hover, and the bottom lamps can become real buttons: day and night, the seasons.
- **For phones:** the same frame in three pieces, so it can stretch down the tall phone hill: the top (orrery and
  corners), the bottom (control panel and plaque), and a short piece of the two sides that repeats seamlessly.

### The slim frame (Oct 19): more village, less frame

Version 2 (frame-v2.jpg) is lovely but thick: its opening is only 63% of the frame's width, which would shrink the
village by about 40%. Give it to the generator as the reference image, with:

> Redraw this exact frame, same style, same materials and same details, but much slimmer, so the window takes up most
> of the picture. The opening in the middle is exactly 16:9, about 1600 × 900 in a 2000 × 1116 picture: it fills 80% of
> the width and 80% of the height. The wooden border is thin and even, about a tenth of the opening's width at the
> sides. Keep the four corner crystals, but smaller, sitting on the corners rather than out beside them. Keep the
> orrery at the top centre, smaller, rising above the top edge instead of pushing the opening down. Keep the glass tubes
> of turquoise liquid, slimmer, set into the sides. Keep the control panel at the bottom centre, shorter, with its
> sliders, two lamps and the crystal, and the small blank brass plaque below it, overlapping the bottom edge. The
> opening is flat magenta (#FF00FF), straight-edged with softly rounded corners, nothing of the frame reaching into it.
> Flat magenta all around the outside. Perfectly symmetrical. No text, letters, numbers, words or logos anywhere; the
> plaque stays blank.

**For phones**, the same frame standing tall:

> Redraw this exact frame as a tall portrait frame, same style and details: a 1116 × 2000 picture with an opening of
> exactly 9:16, about 950 × 1690 (85% of the width and height). Thin even sides; a corner crystal at each corner; the
> orrery small at the top centre, above the top edge; one slim tube of turquoise liquid down each side; a small control
> panel and blank plaque at the bottom centre, overlapping the bottom edge. Flat magenta (#FF00FF) inside the opening
> and all around. Perfectly symmetrical. No text, letters, numbers, words or logos anywhere.

Then the lit version of each, as an edit: *"Same image exactly; the crystals, lamps and tube liquid glow brightly;
change nothing else."*

## Ring 2 and 3 (later)

The same look and rules. One line each, to grow into prompts when the time comes:

- **Starlee's charging dock:** a small shed with a heavy plug, a glowing round gauge and a bed of soft blankets. A, B, C.
- **A.L.T.A.'s station:** a booth by the water with an antenna and a periscope. A, B, C.
- **GlazyArray's broadcast tower:** a slim lattice radio mast with round lamps (lit in code), a small booth at its foot with a microphone. A, C.
- **The janitor's closet:** a tall narrow shed with a mop, buckets and a key board with one empty hook. A, C.
- **Marley's doghouse:** small, with a round door and a nameplate (blank). A, C.
- **The Drone pad:** a round launch pad with landing lights (lit in code) and a small hangar. A, C.
- **The Kinetic Garden:** four wind sculptures, each in two pieces (the stand, and the rotor alone, seen flat-on, for code to spin): a copper flower, a brass whirligig, a glass bird mobile, a spiral. A, B for the glass.
- **The greenhouse:** a glass greenhouse with seedlings, a foraging basket of pinecones and stones. A, B, C.
- **The weather station:** a white louvred box on legs, a vane, and the anemometer's cups on their own, flat-on, to spin.
- **The water tower:** a riveted tank on legs with a round glass window showing its level (the teal liquid fills it in code). A, B, C.
- **The clock tower:** slim, with a round blank face (the hands drawn in code). A, B, C.
- **The useless tree:** a huge, old, gnarled tree with a wide canopy and a bench under it. A, C.
- **The Fish Bridge:** a small arched stone footbridge over a stream (no water drawn). A, C.
- **The butterfly:** one butterfly, wings open, seen flat from above, on magenta; and wings closed, side-on.
