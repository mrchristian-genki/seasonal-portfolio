# A.L.T.A.'s kit: the prompts that break her into parts

A.L.T.A. (the Ancient Lake Tahoe Automaton) gets built the way GlazyArray was: separate layers that the site moves
on its own, so she can blink, glance, talk and gesture without a video generator redrawing her face every time.
GlazyArray's parts are in `assets/narrator/` (`head-base`, `head-iris`, `head-lens`, `head-lids`, `head-jaw`,
`kit/rest-body`), and A.L.T.A.'s will sit beside them in `assets/alta/`.

Her description, the turnaround, the mouth sheet and the still at the glass come from her Note
(`field/data/events/2026-10-09-a-l-t-a.json`). Those are the facts; the prompts below only re-pose them.

## What we're making

| Part | What it is | How it moves on the site |
|---|---|---|
| **Head template** | Her head and neck, facing front, on flat green | Everything else on her head is edited from this one image, so the parts line up |
| **Head base** | The template with empty, dark glass eye sockets | Stays still; the eyes and mouth sit on top |
| **Irises** | Her eyes, cut from the template | Glance left and right inside the sockets. Code tints them amber or cyan-green and makes the rings narrow and dilate, as her notes describe |
| **Lids** | The template with her eyes closed | Fade in and out for a blink |
| **Mouth shapes** | Eight mouths, one per shape on her mouth sheet | Swapped while she talks, following the episode's sound |
| **The tank** | The glass tank, ledge and water, empty | A slow living loop: light through the water, a trout or two |
| **Her rest pose** | Her torso and arms resting on the ledge; her tail below, behind the glass | The torso stays still; the tail sculls in a loop under the ledge |
| **Gestures** | Her arms and hands, from the rest pose | Short clips: counting rules, tapping the glass, pointing, waving |

**Why the ledge matters:** the copper ledge runs across the tank right at her waist. It hides the seam between her
torso above the water (a still) and her tail below (a loop), so the two never have to be one video. Her head is a
separate layer on her neck collar, like GlazyArray's, so no clip ever has to keep her face right.

## Rules for every prompt

- **Paste her description first** (below), then the part's own prompt.
- **The copper ledge is solid** (Christian, Oct 12). Nothing passes through it. Her hands and arms rest on it or
  move in front of it; to get below it she goes up, over the top and down behind it, and the ledge always stays in
  front of her. Some clips had her cut straight through it as if it weren't there: add this line to every prompt
  with her near the ledge:

> The copper ledge is a solid metal bar fixed across the tank: nothing ever passes through it. Her arms and hands stay on top of it or in front of it; to go below it she goes up and over the top and down behind it, so the ledge always stays in front of her body.
- **References:** give the tool the clean turnaround (the one **without labels**) and the close-up of her face. Never
  the labelled turnaround: its words end up in the picture.
- **Head parts are edits, not new renders.** Prompts 2 to 4 each edit the image prompt 1 made: the same image, only
  the named part changes. A new render shifts her face by a few pixels and the layers stop lining up.
- **The green:** head parts on a flat chroma green (#00B140), like GlazyArray's template, so Claude can key them clean.
- **Size:** 1376 × 768 (16:9) for everything, the same as GlazyArray's template.
- **Never:** text, letters, numbers, logos or brands; no people. Her etchings are small geometric lines, not
  writing and not any particular culture's designs.
- **Motion** (the video prompts): slow, weightless and eased, never snappy. Locked camera. The last frame matches the
  first so it loops.

**Her description (paste this first):**

> A.L.T.A., a gentle robot mermaid guardian of Lake Tahoe. She is made of weathered copper and aged bronze with a
> turquoise-green patina and small geometric etched lines on her face and plates. Large, luminous mechanical eyes
> whose irises go from radiant amber and gold at the centre to emerald, then deep sapphire at the rim, in
> concentric rings. A kind, wise, closed smile. A crown woven from tule reeds, willow, pinecones and aged filigree;
> wild hair of coiled copper wire with Jeffrey pine needles worked through it; small pearl drops at her pointed
> ears; a collar of shells and reeds. Soft cyan-glowing vacuum tubes at her neck and along her spine. Below the
> waist an articulated mermaid tail of overlapping patinated scales and translucent sea-glass chambers with small
> gears and glowing fluid inside, ending in a translucent teal fluke. Photoreal 3D render, soft studio light.

---

## 1. The head template

- **Make:** `alta-template.png`. **References:** the clean turnaround (front view) and the face close-up.

> [Her description.] Just her head and neck, facing straight at the camera, centred, on a flat chroma green
> background (#00B140) with no shadow or gradient. The whole crown and hair fit inside the frame with a little
> green above them; the neck ends at a small round brass collar at the bottom of the frame, like a bust on a stand.
> Eyes open, looking straight ahead; mouth closed in her soft smile. Even, soft front light. Nothing in front of her
> face.

**Check before going on:** both eyes fully visible, nothing crossing them; mouth closed; crown not cut off at the top.

## 2. The eyes

**2a. The empty sockets** (`alta-base.png`). Edit the image from prompt 1:

> Same image, exactly as it is: same camera, same face, crown, hair and green background. Change only her eyes:
> replace each eyeball with an empty, smooth socket of dark smoked glass with a faint teal glow deep inside, the same
> size and shape as the eye was. The copper around the eyes, her brows and her eyelid rims stay exactly the same.

**2b. Eyes closed** (`alta-lids.png`). Edit the image from prompt 1 again (not 2a):

> Same image, exactly as it is. Change only her eyes: she closes them gently, her copper eyelids, with fine etched
> lines, lowered all the way over each eye, relaxed, not squeezed. Her brows, face, mouth, crown and the green
> background stay exactly the same.

**The irises** need no prompt: Claude cuts them from the template, makes the socket mask from 2a, and builds the
glance, the blink, the amber and cyan-green glows, and the rings narrowing and dilating in code.

## 3. The mouth: eight shapes

Her mouth sheet has the eight shapes she talks with. Each is an edit of the image from prompt 1, so every mouth sits
exactly where her mouth is. Run the prompt below eight times, once for each shape, and name the files to match:

> Same image, exactly as it is: same camera, face, eyes, crown, hair and green background. Change only her mouth,
> to [SHAPE]. Her copper lips keep their patina and soft sheen. Nothing else moves.

| File | [SHAPE] |
|---|---|
| `mouth-neutral.png` | closed, relaxed, lips together, no smile |
| `mouth-smile.png` | closed, her warm soft smile (the template's own mouth; this one may need no edit) |
| `mouth-ah.png` | open wide as for "ah", a soft cyan glow inside her mouth |
| `mouth-oo.png` | lips rounded and pushed forward as for "oo", a small round opening |
| `mouth-ee.png` | lips stretched wide and slightly parted as for "ee", teeth-like copper ridge just visible |
| `mouth-oh.png` | open and rounded as for "oh", a soft cyan glow inside |
| `mouth-mm.png` | lips pressed together firmly as for "m", "b" and "p" |
| `mouth-laugh.png` | a big open happy laugh, eyes unchanged |

**Why shapes instead of a moving jaw:** GlazyArray's jaw is a separate marionette piece that drops, because her face
has a jaw seam. A.L.T.A.'s face is smooth, so a dropping jaw would look broken. Swapping between her own mouth shapes
keeps her face whole. GlazyArray's player only moves a jaw, so it needs a small addition for mouth shapes; Claude adds
it when the shapes come in.

## 4. The tank and her rest pose

**4a. The tank, empty** (`tank.jpg`):

> A large glass aquarium tank seen straight on, filling the frame: a polished copper ledge runs across it at about
> 55% of the height, the water's surface just below the ledge. Below, through clear glass, cool blue-green lake
> water, smooth granite boulders, a sunken weathered log, a little drifting silt, and a rainbow trout. Above the
> ledge, a dim, softly lit aquarium hall out of focus. Locked straight-on camera. No people, no signs, no text.

**4b. Her at the ledge** (`alta-rest.jpg`). Give the tool 4a, the clean turnaround and the still at the glass:

> [Her description.] In this exact tank and framing: A.L.T.A. rises in the water behind the copper ledge, facing the
> camera, her forearms and both hands resting flat on the ledge, shoulders relaxed. Her torso shows above the ledge;
> at the ledge, her waist is hidden behind it. Below, behind the glass, her tail curls gently down and to one side,
> the translucent fluke resting near the granite. Head facing straight at the camera, a soft closed smile. Both
> hands fully visible, all fingers on the ledge. No microphone, nothing on the ledge.

**4c. The rest loop** (`alta-rest.mp4`, 6 to 8 s). Image to video, starting from 4b:

> A seamless, gently looping living photograph of this exact image. Locked-off camera, no zoom, no pan. Above the
> ledge almost nothing moves: her head, torso, arms and hands stay perfectly still; only the cyan tubes at her neck
> pulse softly once. Below the ledge, behind the glass, her tail sculls slowly and steadily, the fluke fanning in a
> weightless, slow-motion undulation, and the light from above ripples across the granite. A trout glides slowly
> across and out of frame. No jitter, no sudden moves. The last frame matches the first.

Claude keeps the part above the ledge from the first frame (the head is replaced by her head layers anyway) and loops
the part below.

## 5. Her arms: gestures

Each is image to video from 4b, 3 to 5 seconds, beginning and ending in the rest pose so they chain together.

**Paste this before each gesture:**

> A short, smooth clip from this exact image. Locked camera. Slow, weightless, eased motion, with no snapping or
> jitter. Her head stays still and faces forward the whole time. Her hands stay below her collar and in front of her
> chest or on the ledge, never up beside or over her head. Her articulated copper fingers bend only at the joints:
> five fingers on each hand, always. Below the ledge, her tail keeps sculling gently. She ends in exactly the pose
> she started in, both hands resting on the ledge.

| File | The gesture |
|---|---|
| `gest-count.mp4` | She lifts one hand a little off the ledge and counts three rules on her fingers, one finger at a time, then sets it back down. |
| `gest-tap.mp4` | She taps the glass in front of her twice with one fingertip, as if to say "look here", then rests. |
| `gest-point.mp4` | She points to one side, low and level at chest height, as if toward a sign beside the tank, then rests. |
| `gest-wave.mp4` | A small, warm wave at chest height with one hand, wrist and fingers only, then rests. |
| `gest-lean.mp4` | She leans forward toward the glass a little, both hands staying on the ledge, as if about to say something important, and settles back. |
| `gest-open.mp4` | Both hands open, palms up, at the ledge: "here's the thing". Then they settle flat again. |
| `gest-celebrate.mp4` | A happy little clap of both hands just above the ledge, twice, then rest. |
| `gest-beckon.mp4` | One hand, palm up, beckons gently twice: "come and see". |

**If her head comes back in a gesture clip,** that's fine: her clips are cut at the neck collar and her own head layer
sits on top. What matters is that her hands stay out of the space where her head goes.

---

## Send back

Into the Studio, or to Claude, named as above:

- `alta-template.png`, `alta-base.png`, `alta-lids.png`
- the eight `mouth-*.png`
- `tank.jpg`, `alta-rest.jpg`, `alta-rest.mp4`
- the `gest-*.mp4` clips you like

Claude then keys the green; cuts the irises, lids and mouths to the head's frame; makes the socket mask and a safe-area
picture for her gestures (like GlazyArray's `trick-safe-area.jpg`); and loops the tail. From there her player can be
built.

## Built so far (Oct 11)

From the first renders, in `assets/alta/parts/`, layered in `assets/alta/preview.html` (unlisted, noindex):

- **`rest.webp`:** the tank with her at the ledge, her painted head erased (the empty tank shows through where it was).
- **Her head** (`head-base.webp`, `head-iris.webp`, `head-lens.png`): the template with empty sockets, and her irises
  in a lens mask so they glance. A colour layer gives the steady amber and the cyan-green bloom; the rings narrow and
  dilate.
- **Mouths** (`mouth-*.webp`): smile, neutral (also used for "mm"), ah, oh, oo, ee, laugh. All share one soft-edged
  oval cut from her renders, colour-matched to the template, so any one replaces the others.
- **`tail.mp4`:** the water below the ledge from the Flow clip, which loops cleanly over its whole 8 seconds.
- **`palms.mp4`:** the open-palms gesture over her torso, her video head erased, cut where she nears rest and faded
  back to the still.
- **`layout.json`:** where each part sits on the 1376 × 768 frame.

- **`head-lids.webp`:** her eyes closed, colour-matched to the template, so she blinks every few seconds (sometimes
  twice).

**Still needed:** the "hand to her chin" and "hand by her face" clips bring a hand up where her head layer sits, so
they don't layer; ask for those again with the hands kept low (part 5).

## Round 2: the new scenes (Oct 11)

Her player plays these over her torso while she talks, with her head layer on top, so **her hands must stay in the
green** in `gesture-safe-area.jpg`: below the top of her shoulders beside her head, and never in front of or behind
her head (the red). The two that went wrong ("hand to her chin", "hand by her face") brought a hand into the red.

**Start every one from the same still:** the picture of her at the ledge (the one the tank and her rest pose came from),
as the first frame, 16:9, 6 to 8 seconds. Each ends back in that rest pose, both forearms on the ledge.

**Paste this before each scene:**

> A short, smooth clip from this exact image, starting and ending in this exact pose: both forearms resting on the
> copper ledge. Locked camera, no zoom or pan. Slow, weightless, eased motion with no snapping or jitter. Her head
> stays perfectly still, facing the camera. Her hands and arms stay low: no higher than the top of her shoulders, and
> never in front of, beside or behind her head or face. Her articulated copper fingers bend only at the joints, five
> fingers on each hand. Below the ledge her tail keeps sculling gently. The water, the fish and the hall behind her
> carry on as they are.

| File | The scene |
|---|---|
| `gest-count.mp4` | She lifts one forearm a little off the ledge and counts three rules on her fingers at chest height, one finger at a time, then lays it back down. |
| `gest-think.mp4` (replaces "hand to her chin") | She taps one fingertip on the ledge twice, slowly, as if weighing a thought, then rests her hand flat again. |
| `gest-wave.mp4` (replaces "hand by her face") | A small, warm wave from the wrist, her forearm still on the ledge, fingers rising no higher than her shoulder, then rest. |
| `gest-point.mp4` | She points to one side, low and level at the height of the ledge, as if toward a sign beside the tank, then rests. |
| `gest-tap.mp4` | She taps the glass of the ledge in front of her twice with one fingertip: "look here". Then rests. |
| `gest-beckon.mp4` | One hand, palm up, low over the ledge, beckons gently twice: "come and see". |
| `gest-lean.mp4` | She leans toward the camera a little, both hands staying flat on the ledge, as if about to share a secret, and settles back. |
| `gest-celebrate.mp4` | A happy little clap of both hands just above the ledge, twice, then rest. |

**Send back** the clips you like. Claude erases her video head, checks every frame keeps her hands in the green, and
cuts each so it fades back to her rest pose, like the open-palms one.

## Round 3: her colours, matched to each Note (Oct 11)

GlazyArray wears a look on each Note, and two of its parts take the Note's two colours (from its hero picture). A.L.T.A.
wears no hats or caps: she always wears her own crown and hair. Instead, **two groups of the things already in her hair
take the Note's colours**, the way GlazyArray's flair does:

- **Colour A: the filigree.** The ornate metal centrepiece at the front of her crown and the filigree band it sits on.
- **Colour B: the botanicals.** The leafy sprigs and ribbon-like lake plants around her ears and through her hair.

Everything else stays her own: the reeds and cattails, the pinecones, the copper-wire hair, the pearls, her face and her
eyes. The same two prompts as GlazyArray's looks (`assets/narrator/looks/PROMPTS.md`) make clean masks. Both are edits of
her head template (prompt 1 above), never new renders.

**Prompt A** (on the template):

> Same image, exactly as it is: same camera, same face, eyes, crown, hair and flat chroma green background (#00B140).
> Change only the colour of two things, keeping their exact shapes, shading, gloss and detail: the ornate filigree
> centrepiece at the front of her crown and the filigree band beneath it become a bright saturated magenta (#FF00FF),
> like enamelled metal; the leafy sprigs and ribbon-like lake plants around her ears and through her hair become a
> plain pearl white. The reeds, cattails, pinecones, copper-wire hair, pearls, her face and her eyes stay exactly as
> they are.

**Prompt B** (on the image prompt A made):

> Same image, exactly as it is. Change only the pearl-white leafy sprigs and ribbon-like lake plants to a bright
> saturated cyan (#00FFFF), keeping their shading and gloss. The magenta stays magenta; everything else stays exactly
> as it is, including the green background.

**Done (Oct 11):** `parts/head-flair-a.webp` (the filigree) and `head-flair-b.webp` (the botanicals, the braid and the
pearls), pearl versions of those parts that her player dyes with the Note's two colours (`data-palette`); without a
palette she wears her own.

**Send back** the image from prompt B as `alta-colours.png`. Claude takes the magenta and cyan as her two masks, and
makes those parts a neutral pearl so each Note's colours dye them cleanly, in her player and her Workshop window.

## Round 4: the idle dive (Oct 11)

While she waits to narrate, now and then she **sinks down behind the ledge, swims close to the front glass, and comes
back up the same way she went down**, to rest at the ledge again. Two clips make it:

1. **`dive-down.mp4`:** from her rest pose at the ledge down into the water, ending with her hovering below the ledge,
   close to the front glass, facing the camera.
2. **`dive-swim.mp4`:** a loop underwater that starts and ends on the last frame of the dive-down clip.

Her return is the dive-down clip played backwards (Claude makes the reversed copy), so she comes up exactly the way she
went down. During the dive her own video head is shown, since she isn't talking; her layered head takes over again at
the ledge. If Play is pressed mid-dive, she comes straight back up before she starts talking.

**Why the first try failed (Oct 11):** asked only to "sink", the tools kept her head above the ledge and pulled her back
up, since a clip tends to return to its first frame. The fix is to **make the end picture first**, then give the clip
both a first and a last frame, so it has to get there.

**Step 1, the end frame** (`alta-under.jpg`, an image edit of the still of her at the ledge):

> Same image, same camera, same tank, same ledge, rocks, logs, trout and hall, all exactly as they are. Move A.L.T.A.
> down into the water: the copper ledge is now empty, with nothing above it. She is fully underwater, below the
> water's surface and below the ledge, in the middle of the tank close to the front glass, facing the camera, her whole
> head, crown and hair under the water, her arms relaxed at her sides, her tail curling gently below her, a calm soft
> smile. A few small bubbles above her. The same character exactly: same face, eyes, crown, hair, body and tail.

**Check:** nothing of her shows above the ledge; her crown is at least a head's height below the water's surface.

**Done by Claude instead (Oct 11):** the image editors kept her at the ledge (they treat her position as part of "the same
image"), so `assets/alta/alta-under.jpg` was built from parts: the empty tank (its trout painted out where she hovers),
her front view cut from the clean turnaround (arms at her sides), set below the water's surface at the size she is at
the ledge, graded to the tank's water, with a few bubbles rising from her crown. Use it as the clip's last frame.

**Step 2, the clip** (`dive-down.mp4`, image to video, 8 s): **first frame** the still of her at the ledge, **last
frame** `alta-under.jpg`.

> She lets go of the copper ledge and sinks straight down behind it into the water, smoothly and slowly, as if
> exhaling: her hands lift up off the top of the ledge and back over it first (never through it), then her shoulders,
> then her head, and her crown passes below the ledge last, the solid ledge staying in front of her all the way down. By the middle of the clip her whole head, crown and hair are under the water and stay under; she does
> not come back up in this clip. She drifts down to hover close to the front glass, facing the camera. Weightless,
> eased motion, no jitter; a few small bubbles rise in the water and stop at its surface, never above the copper
> ledge. Locked camera. The tank, ledge, rocks, logs and hall stay exactly as they are.

**If your tool can't take a last frame,** use this instead, from the still alone:

> A slow, smooth clip from this exact image. Locked camera, no zoom or pan. In the first two seconds she lets go of the
> copper ledge, lifting her hands up and back over its top (never through it). From second two to second five she
> sinks straight down behind the ledge, the solid ledge staying in front of her, until her whole body, head,
> crown and hair are completely under the water, below the ledge. For the last three seconds the copper ledge is empty,
> with nothing of her above it, and she hovers underwater close to the front glass, facing the camera, her tail gently
> sculling. She does not rise again or return to the ledge in this clip. Weightless, eased motion, no jitter; a few
> small bubbles rise in the water and stop at its surface, never above the copper ledge. The tank, ledge, rocks, logs
> and hall stay exactly as they are.

**Clip 2, dive-swim** (image to video, first and last frame: `alta-under.jpg`, or the last frame of clip 1, 8 s):

> A seamless loop from this exact image. Locked camera, no zoom or pan. Underwater, she swims a slow, graceful loop
> close to the front glass: a gentle turn to one side, along the front of the tank, and back to exactly where she
> started, facing the camera, hovering. Her tail sweeps in long, smooth, weightless arcs; her crown and hair drift
> softly in the water; a trout glides past behind her. She stays near the front of the tank and never goes behind the
> rocks or out of frame. Slow, eased motion with no jitter. The last frame matches the first.

**Built (Oct 11):** `parts/dive.mp4` joins the two takes Christian made: the Gemini one's opening (she lets go of the
ledge, from her exact rest pose) blended over half a second into the Flow one, which takes her all the way under.
`rise.mp4` is it backwards; `hover.mp4` ping-pongs its last second for her pause underwater. Her player dives every
30 to 60 seconds while she isn't talking. The Flow take had bubbles rising above the ledge, in the air; Claude
painted them out (Oct 11) with a clean plate of the empty hall, so above the ledge only she moves.

**Check before sending:** clip 1's first frame matches her rest still, and clip 2's first and last frames match clip 1's
last. A tool with a last-frame setting makes this easy; if yours doesn't, send them anyway and Claude finds the closest
frames and cross-fades the seams.

## Round 5: what she does underwater (Oct 11)

Once she's down, she does one of these before she comes back up. Every routine **starts and ends on the same
picture**: her hovering underwater close to the front glass, facing the camera (`assets/alta/alta-underwater-start.jpg`,
the last frame of her dive). So any routine can follow the dive, and the rise can follow any routine. Her player picks
one at random each time she goes down.

**Settings for every clip:** image to video, 8 s (6 s is fine), **first frame and last frame both
`alta-underwater-start.jpg`**. If your tool has no last-frame setting, send it anyway: Claude finds the frame
closest to the start and cross-fades the seam.

**Add this to the end of every routine prompt:**

> Locked camera, no zoom or pan. Slow, weightless, eased motion with no jitter; her tail sweeps in long smooth arcs
> and her crown and hair drift softly in the water. She stays in the water the whole clip, below the surface, and never
> goes above the copper ledge, behind the rocks, or out of frame. The copper ledge is a solid bar in front of her:
> she never passes through it, and it always stays in front of her body. Bubbles only in the water: they rise and stop at the
> water's surface. Above the copper ledge is air: nothing there changes, no bubbles, no splashes, no spray. The tank,
> rocks, logs, ledge and hall stay exactly as they are. The same character exactly: same face, eyes, crown, hair, body
> and tail. She ends exactly where she started, hovering close to the front glass, facing the camera.

**1. `swim-glide.mp4`, the lap** (replaces the hover):

> She turns gently to her left and glides along the front glass to the left side of the tank, rolls into a slow turn,
> glides back past the middle to the right side, turns again, and settles back in the middle, facing the camera.

**2. `swim-twirl.mp4`, the twirl:**

> She stretches her arms out to her sides and does one slow, graceful twirl in place, all the way round, her hair
> fanning out and her tail curling around her, then settles facing the camera with a small pleased smile.

**3. `swim-trout.mp4`, the trout visit:**

> A trout swims slowly in from the right, close to her. Her eyes follow it; she turns her head and smiles. It circles
> her once and noses her open palm, then swims calmly away out of frame on the left. She watches it go, then looks back
> at the camera.

**4. `swim-glass.mp4`, hello at the glass:**

> She drifts forward right up to the front glass, places one open palm flat against the inside of the glass, tilts her
> head curiously at the camera and gives a small wave with her other hand, then drifts back to where she started.

**5. `swim-peek.mp4`, hide and peek:**

> She sinks slowly down behind the nearest log so only the top of her crown shows, pauses, then peeks up over the log
> with just her eyes, smiles, and rises back up to hover in the middle, facing the camera.

**6. `swim-pebble.mp4`, the pebble:**

> She dives gently down to the rocks, picks up a small smooth pebble, rises a little and turns it over in her hands,
> studying it, then sets it carefully back on the rocks and drifts back up to hover facing the camera.

**7. `swim-ring.mp4`, the bubble ring:**

> She purses her lips and blows one slow ring of bubbles that wobbles upward through the water; her eyes follow it up
> until it breaks apart into small bubbles at the water's surface, below the ledge. She looks back at the camera and
> smiles.

**8. `swim-roll.mp4`, the barrel roll:**

> She swims a short way to her right, does one slow, smooth barrel roll along the front glass, her tail trailing in a
> long arc, and glides back to the middle to hover facing the camera.

**Check before sending:** her first and last frames match the start picture (same size, same place), her crown never
reaches the surface, and nothing moves above the copper ledge. If bubbles still show in the air, Claude can paint them out
as for the dive, but a clean take is better.

**Built (Oct 11):**
- `parts/glide.mp4` is the lap from Christian's Flow take.
- `parts/glow.mp4` is her meditation:
  - the glow coming up (a Gemini take, start picture to glowing)
  - her held glow (a second take: she meditates at full glow, her tail swaying)
  - the glow coming up again, played backwards, so she fades to calm.

Both are lined up to her dive. Their first and last half-seconds blend into the dive's last frame, and above the ledge
the still hall stands in, so no bubbles show in the air. Underwater she now hovers, glides or glows, never the same
one twice in a row, then rises. Play pressed mid-routine finishes it quickly first: the glow fades down, the lap
hurries home. Still to make: the twirl, trout, glass, peek, pebble, ring and roll.

## Round 6: a friendlier resting face (Oct 11)

Her resting face is her template's own: a small closed smile and wide-open eyes. Two edits of **the head template**
(the green-background image from prompt 1, never a later edit) give her a warmer one. Claude makes them her face at
rest, keeps the current parts for talking, and fades between the two.

**6a. A warm smile** (`mouth-warm.png`):

> Same image, exactly as it is: same camera, face, eyes, crown, hair and green background. Change only her mouth: a
> warm, friendly closed-mouth smile, wider than now, the corners turned gently up, her copper cheeks lifted a little
> as a real smile lifts them. Her lips keep their patina and soft sheen. Nothing else moves.

**6b. Smiling eyes** (`head-soft.png`):

> Same image, exactly as it is: same camera, face, mouth, crown, hair and green background. Change only her eyelids:
> her upper copper eyelids lower just a little, about a quarter of the way over her irises, and her lower lids lift
> slightly, as eyes do in a warm, kind smile. Her irises stay exactly where they are, the same size and colours,
> still looking straight ahead. Relaxed, not sleepy, not squinting.

**Check:** lay each over the template; only the mouth (6a) or the eyelids (6b) should change. If her face shifts,
say "same image, exactly as it is" again.

**Done already in code (Oct 11):** her irises sit 6% larger at rest (a softer, less staring look), and bloom a little
more as she talks. Her gestures now play while she waits at the ledge too, every 20 to 40 seconds; the Round 2 clips
give her more than the open palms, and each one Claude adds joins both.

**Built (Oct 11):** Christian's smiling-eyes edit (which kept the warm smile too) is `parts/head-rest.webp`: the
changed face only (eyes, cheeks, smile), feathered, with the eye openings cut out so her irises still glance and
dilate behind her new lids. It's her face at rest; it eases away while she talks (her mouth shapes take over) and
back when she stops, and her blink closes over it.

## Round 7: gestures while she waits (Oct 11)

While nobody is listening she now does a gesture every 20 to 40 seconds. These invite people in. They are cut
exactly like Round 2's, so **the same rules, stricter:**

- **Her hands stay inside the green box** in `gesture-safe-area.jpg`: no higher than the top of her shoulders, no
  lower than the bottom of the copper ledge, and no wider than her elbows plus a hand. Outside it, a hand is cut off
  (her gesture layer is only that box), and on phones the sides of her scene are cropped as well.
- **Never near her head or neck** (the notch in the box): her head is a separate layer on top and a hand there
  vanishes behind it. No hand to her face, ear, chin, crown or mouth, no shush, no cupped ear.
- **Her head and shoulders stay perfectly still,** facing the camera. A lean or a nod moves her neck off her head layer.
- **Start and end in her exact rest pose,** both forearms on the ledge, so each fades in and out cleanly.

**Settings:** image to video, 6 s, first frame (and last frame, if your tool has one) the still of her at the ledge.

**Paste this before each one:**

> A short, smooth clip from this exact image, starting and ending in this exact pose: both forearms resting on the
> copper ledge. Locked camera, no zoom or pan. Her head, neck and shoulders stay perfectly still, facing the camera,
> with a soft closed smile. Only her forearms and hands move, slowly and gracefully, with eased motion and no jitter.
> Her hands stay low and close: never above her shoulders, never near her face, head or neck, never below the copper
> ledge, and never further out to the sides than her elbows. Five articulated copper fingers on each hand, bending
> only at the joints. The copper ledge is a solid metal bar: her hands and arms rest on it or move in front of it and
> never pass through it. Below the ledge her tail keeps sculling gently; the water, the fish and the hall carry on.

| File | The gesture |
|---|---|
| `gest-play.mp4` | "Press play": she points down and to her right (our left), low along the ledge toward its front corner, and holds it a moment with a little encouraging bounce of the finger, then rests. |
| `gest-come.mp4` | "Come and listen": both hands, palms up, lift just off the ledge and beckon gently toward herself twice, then rest. |
| `gest-heart.mp4` | "From the heart": one hand rises to rest flat on the middle of her chest, below her collar, for a moment, then returns to the ledge. |
| `gest-drum.mp4` | "Waiting for you": she drums her fingertips on the ledge, slowly and playfully, one hand then the other, then rests. |
| `gest-pat.mp4` | "Sit here": she pats the top of the ledge in front of her twice with an open palm, as if inviting someone to sit, then rests. |
| `gest-stretch.mp4` | A lazy stretch: both forearms slide out along the ledge and her fingers spread, then they slide back. No higher than the ledge. |

From Round 2, `gest-wave`, `gest-beckon`, `gest-tap` and `gest-celebrate` suit waiting too.

**Thai dance hands (Christian, Oct 12):** classical Thai dance gestures, slow and graceful. Same lead-in as above, then
add this line, then the gesture's own line:

> Classical Thai dance hands: her copper fingers held together and curved gracefully back from the palm, the thumb
> bent back, wrists turning slowly and smoothly; in the "jeep" shape her thumb and forefinger touch while the other
> three fingers fan out and curve back. Calm, elegant and unhurried, like a temple dancer.

| File | The gesture |
|---|---|
| `gest-wai.mp4` | A wai: her hands rise from the ledge and meet in front of her chest, palms together and fingers pointing up, held low below her collar, for a calm moment; then they part and return to the ledge. Her head stays still (no bow). |
| `gest-thai-bloom.mp4` | Palms together low in front of her chest, then her hands open like a lotus: the wrists turn outward and the fingers curve back, the palms open toward us, held a moment, then close together again and return to the ledge. |
| `gest-thai-dance.mp4` | Both hands lift just above the ledge in front of her. One hand makes the "jeep" shape, thumb and forefinger touching, while the other is a flat open hand with the fingers curved back; slowly the wrists turn and the hands trade shapes, twice, then rest on the ledge. |
| `gest-thai-spread.mp4` | Her forearms open outward along the ledge to just past her elbows, palms up and turned out, fingers curved back; the wrists ripple slowly in a wave, one hand then the other, then the arms come back in to rest. No wider than her elbows plus a hand. |

**Built (Oct 12):** `gest-play` ("press play") is in her idle gestures: her hand reaches over the front of the ledge
and points down below it, so it plays in a taller layer (`parts/play.mp4` and `-cut.mp4`, colour over mask) where only
her hand shows below the ledge; she does it only while she waits, never while she talks. `gest-thai-bloom` was built and then taken out (Oct 12): as
her palms come together her forearms sink down through the ledge, and as the lotus opens her wrists rise out of it, so
the bar looks like it isn't there. A remake needs the elbows to stay on top of the ledge the whole time and the hands to
stay above it, or to come over its front edge the way `gest-play` does. Checked at the same time: `palms` keeps its hands
on top of the ledge, and `play` comes over the front and shows whole below it. `gest-thai-dance` came back with her arms stretched along the whole ledge
(her hands reach from 181 to 1094 px across the 1376 frame; the box is 440 to 952, and phones show 247 to 1128): make
it again with the hands kept low and close, as written above.

Her arms opened fully out to each side would leave the safe box (her gesture layer is only that box, and phones crop
the sides further), so the spread stays at her elbows plus a hand. The references (the Thai hand-shape sheet and the
curved-back hand) are good to attach as a style reference, never as the first frame.

**Check before sending:** step through it; if a fingertip ever crosses into the red, or her head or shoulders shift,
make it again. Claude erases her video head, checks every frame against the box, trims each to fade from and back to
her rest pose, and adds it to her list.

## Round 8: scenes behind her tank (Oct 11)

Like GlazyArray's backdrops, a Note (or a whole category) can set A.L.T.A.'s tank somewhere new: the hall behind the
glass becomes the scene. Everything above the copper ledge is the scene; everything below it stays her tank, and she
stays in front (her still, her gestures and her dives are cut out of the hall frame by frame: `rest-cut.webp`,
`palms-cut.mp4`, `dive-cut.mp4`, `rise-cut.mp4`).

**Size:** 1376 x 768 (16:9), the same frame as her tank. **Only the top 38% shows** (the green band in
`assets/alta/kit/tank-backdrop-guide.jpg`, down to the red line); the rest is hidden behind the ledge and the water.
So whatever matters sits in the top third of the picture.

**The prompt** (fill in the place):

> A softly blurred photograph of [THE PLACE], seen from about table height, as if from behind a large aquarium
> standing in the room. Wide 16:9. The camera looks straight ahead, level. The far wall, the horizon or the treeline
> sits about a third of the way down the frame, and everything that matters is in the top third; the lower part is
> plain floor or ground. Shallow depth of field: the whole scene gently out of focus, like the background of a
> portrait, with soft, natural light. No people, no animals, no text, signs, logos or brands. Colours that sit well
> beside a teal-green tank and weathered copper.

Places that fit her: a sandy Lake Tahoe beach at dusk, a pool deck (her water-safety lessons), a classroom, a library,
a pine forest, a boathouse, a bike shop, a trailhead.

**Check:** lay the render under the guide: the band shows the part you want, and nothing sharp or busy sits right
behind where her head is (the middle of the band).

### Her template, the Studio and borrowing (Oct 13)

**Her template** (`assets/alta/kit/tank-template.jpg`, 1376 x 768): her tank, **empty**, exactly as the site frames
it, with the place a flat grey above the copper ledge. The easiest way to a scene that fits is to **edit the template**:
the framing stays right, and only the strip above the ledge is used.

**Never paint her into a scene** (Oct 14). Her head and shoulders above the ledge are drawn over the scene only while she
rests; when she dives, rises or glides they go, and the scene shows through. A scene with her painted in leaves a copy of
her head behind. (The first template had her in it, and 21 scenes made from it did: on Oct 14 her head was taken out of
them by mirroring the scene in from both sides, a stopgap until each is remade from the empty template.) The Studio turns
away a picture with her in it.

The edit prompt (Christian's layout: the scene on a line of its own, so it's the one part to change):

> Same image, exactly as it is: the empty tank, its copper ledge, the water and everything below the ledge stay exactly
> the same. Replace only the flat grey wall above the copper ledge with a softly blurred photograph of
>
> [ INSERT SCENE ]
>
> Shot like a cinematic film still from about table height, straight ahead and level, as if from behind a large
> aquarium standing there. Very shallow depth of field: the whole place softly out of focus, with gentle bokeh and
> nothing sharp. Warm, soft, late-afternoon light; calm, tidy and uncluttered. The far wall, the horizon or the
> treeline sits about halfway between the top of the picture and the ledge. Composition, in pixels on this 1376 x 768
> image: everything that matters sits above the ledge, from y 0 to y 290. Keep the middle, from x 560 to x 820 and
> y 40 to y 290, calm, evenly lit and slightly darker, with no bright lights or strong shapes (her head goes there).
> Nothing added in the tank, on the ledge or in front of it. Empty of people and animals. No writing, signs, logos or
> brands anywhere. Natural colours, nothing neon, that sit well beside a teal-green tank and weathered copper.

The prompt above (a new picture) works too; then the horizon goes about a quarter of the way down.

**In the Studio:** Categories, "A.L.T.A.'s tank scenes": name it, pick a category (it fills in a place), choose edit or
new, copy the prompt and the template, and drop the render back: the previews show her resting in front of it
(`assets/alta/kit/tank-overlay.webp`, her tank with the place cut out) and the scene as she dives (`rest-cut.webp`). Add the scene, and pick it for a Note in its
Episode panel or for a whole category in its column.

**Borrowing:** without a scene of her own, she borrows the Note's backdrop (the one GlazyArray and Robot Marley show)
when the Note, its categories or a holiday give it one: blurred, just its middle, in the strip above her ledge. With only
the site's default backdrop she stays in her hall.

**Starter places** (for [THE PLACE]; public places only, never the home):

| Name | The place |
|---|---|
| `tahoe-beach-dusk` | a sandy Lake Tahoe beach at dusk, smooth granite boulders and pines along the far shore |
| `emerald-bay-mist` | the shore of Emerald Bay on a still morning, mist on the water and the small rocky island beyond |
| `tahoe-winter-shore` | a snowy Lake Tahoe shoreline in winter, dark pines and white mountains across the water |
| `pool-deck` | a sunny outdoor swimming pool deck with lane ropes and a lifeguard chair (her water-safety lessons) |
| `boathouse` | the inside of an old wooden boathouse, kayaks and paddles on racks, the lake through the open doors |
| `trailhead` | a pine forest trailhead in late afternoon light, a dirt path leading into the trees |
| `library` | a quiet old library with tall wooden bookshelves and warm reading lamps |
| `classroom` | a bright classroom with a long chalkboard, a globe and tall windows |
| `donegal-cliffs` | green sea cliffs above the Atlantic under a soft grey sky with breaks of sunlight |
| `hawaii-coast` | a tropical shoreline at golden hour, palm trees and calm turquoise water |
| `bike-shop` | a small bike shop with mountain bikes hanging on the far wall |
| `tunnel` | a smooth stone tunnel mouth in the far wall of her room, lit softly from within, as if it leads out to the lake (for the day she swims out the back) |

**Send back** each scene with a one-word name (`lakeshore`, `pool-deck`). Claude adds it to her scenes (looks.json
`tankBackdrops`, the file in `assets/alta/backdrops/`); then the Studio picks it: a Note's Episode script panel
("Behind her tank", once A.L.T.A. tells it), or the Categories tab ("Her tank", and a default). Without one, she keeps
the hall.

## Quick fixes

- **Her face shifts between head parts:** say "same image, exactly as it is" again, and edit the template, never a
  later edit.
- **The crown is cut off:** in prompt 1, ask for "more green above the crown, the head a little smaller in frame".
- **Extra fingers or melting hands:** shorten the clip, and ask for the hand to stay closer to the ledge.
- **The tail jerks:** add "slow-motion, neutral buoyancy, the fluke sweeps in one long smooth arc".
- **She goes through the copper ledge:** add "The copper ledge is a solid metal bar fixed across the tank: nothing ever passes through it. Her arms and hands stay on top of it or in front of it; to go below it she goes up and over the top and down behind it, so the ledge always stays in front of her body." Claude can't fix a clip that passes through it; make it again.
- **Bubbles above the copper ledge:** add "above the copper ledge is air: no bubbles, no splashes, nothing moves there".
- **Words or symbols appear on her etchings:** add "the etchings are plain geometric lines: no letters, no symbols".
