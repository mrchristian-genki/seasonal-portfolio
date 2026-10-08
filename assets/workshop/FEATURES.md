# The Workshop's project features: pictures still to make

Each project on the Workshop tab now opens as a magazine feature: its clip as the cover, its case study in a column,
and its clips placed between the paragraphs. Where a story runs long with nothing to look at, a picture or two would
help. This is the list, project by project, with prompts ready to copy.

## How it works

- **Two kinds of picture:**
  - **Render** is a new AI image or clip in the automaton world of the case studies.
  - **Capture** is a screenshot or short screen recording of the real tool.
- **Size:** 16:9, at least 1920 × 1080. Clips run 4 to 8 seconds, silent and looping.
- **Never:** text, logos, brands or real people in a render. Marley and Christian appear only as they already do in
  the headers.
- **Bring them back** in the Studio, on the project's Note (each goes in that Note's photos with its caption), or send
  them to Claude.

**The look of the renders (paste at the start of every render prompt):**

> A cinematic still from the same world as a brass automaton on an old walnut workbench: a dark, cosy workshop at
> night, warm lamp light, glowing cyan glass tubes and veins of light, polished brass with rivets, soft depth of
> field, rich colour. No text, no logos, no people.

---

## The Studio (4 pictures, 8 paragraphs): needs the most

1. **Done (Oct 8): the two toggles.** A close screen recording of the STUDIO panel: DAY/NIGHT flipped, then CHANGE LIQUID,
   with the jewel lamps lighting. *Goes:* "The controls took the longest".
2. **Done (Oct 8): the valves that were cut.**
   > [The look.] A row of ornate brass bypass valves with little lit glass windows and handwheels, lined up on the
   > workbench under a dust sheet half pulled back, as if retired. Wistful, quiet light.

   *Caption idea:* "The valves were fun to build and wrong to keep."
3. **Done (Oct 8): the letters filling.** STUDIO's letters draining and filling with a new liquid. *Goes:* "Then the
   liquid started spreading".
4. **Done (Oct 8): three skins,** as one page in three strips. The same Studio page in gold on walnut, steel on slate and verdigris on bronze, side by
   side. *Goes:* the same paragraph.

## The Workshop (3 pictures, 7 paragraphs)

1. **Done (Oct 8): the prompt builder,** with the Import & trace of a winged fox beside it. Step 1 with a kind, a style and Kit sheet picked, and the prompt written out.
   *Goes:* "It works in steps".
2. **Done (Oct 8): the kit sheet.**
   > [The look.] On the bench, a sheet of heavy paper laid out like a model kit: separate flat-coloured pieces of a
   > lakeside scene (a rock, a pine, a strip of shoreline, a reed bed) arranged neatly with space around each, a
   > brass ruler and a craft knife beside it.

   *Goes:* "The kit-sheet option came from a failure".
3. **Done (Oct 8): cut and rig, next.**
   > [The look.] A paper origami fox lying on a cutting mat, its legs and neck separated at the joints and pinned
   > with tiny brass pivots, a jeweller's loupe and tweezers beside it, one leg lifting slightly as if testing.

   *Goes:* "Step 3, cut and rig, is next". A 6 s clip of the leg lifting is even better.

## The Parts Catalog (4 pictures, 7 paragraphs)

1. **Done (Oct 8): a deer through the seasons,** the buck's card in every weather. One card, close: the doe lowering her head to graze, then looking up. *Goes:* "The
   animals are the heart of it".
2. **Done (Oct 8): one drawer open,** twice: a paper buck grazing and a winged fox stretching.
   > [The look.] Close on a single small wooden drawer pulled open from a wall of tiny drawers, a paper origami deer
   > inside standing on a bed of moss, lit from within by a soft cyan glow, the other drawers closed around it.

   *Goes:* "Forty live cards could easily melt a phone" (each one sleeps until it's opened).
3. **Done (Oct 8): the squid that replaced the whale.**
   > [The look, but deep underwater:] a giant squid folded from paper, drifting in dark blue water with shafts of
   > light from above, tiny paper fish scattering around it.

   *Goes:* "The header came last".

## The lake (4 pictures, 6 paragraphs)

1. **Capture: night with fireflies.** The lake at night, fireflies over the water and stars out. *Goes:* "Everything
   is SVG and code".
2. **Capture: a blizzard on the headline.** Snow settling on the headline in winter, blizzard level. *Goes:* the same
   paragraph, or "Most of the work nobody sees".
3. **Done (Oct 8): a visitor,** a doe walking down to graze. A buck walking out of the trees, or the fox sniffing at the headline. *Goes:* "Then the
   visitors".
4. **Done (Oct 8): the frame rate,** a winter night in a pocket watch.
   > [The look.] A brass pocket watch lying open on the bench, its glass face showing a tiny snowy lake at night
   > inside, snowflakes falling smoothly, the watch's hands ticking.

   *Goes:* "12 frames a second ... took it to 56".

## ProPre (6 pictures, 9 paragraphs)

1. **Capture: MegaData.** The listing tab writing titles, keywords and the description in one go. *Goes:* "I
   called it ProPre".
2. **Done (Oct 8): the rules learned the hard way,** a proof sheet under a loupe.
   > [The look.] A printer's proof sheet of a black-and-white colouring page pinned to the bench, with pencilled
   > crop marks, a dashed safe-zone border and the art running past the trim into the bleed, a brass loupe resting
   > on it.

   *Goes:* "Every one of those steps has a rule".

## The whole machine and GlazyArray

Both have enough already: 7 renders and 9 pictures. Nothing is needed. If you make more of her living photos
(`assets/narrator/ANIMATE.md`), they can go into her feature too.

---

## After they're in

Each picture lands in its Note's photos with its caption. Publish the Note, then run
`python3 field/tools/wsprojects.py` (or ask Claude), and the picture joins the project's feature. The feature spreads
a project's pictures through the column in their order, and a picture with `"after": N` in that
project's `media` list (`assets/workshop/projects.json`) goes right after paragraph N, so it sits by the part of the
story it shows ("Goes:" above). Claude sets it when it adds one.
