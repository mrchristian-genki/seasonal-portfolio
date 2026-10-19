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
