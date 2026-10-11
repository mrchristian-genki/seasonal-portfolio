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

**Still needed:** her eyes closed (prompt 2b) for blinks. The "hand to her chin" and "hand by her face" clips bring a
hand up where her head layer sits, so they don't layer; ask for those again with the hands kept low (part 5).

## Quick fixes

- **Her face shifts between head parts:** say "same image, exactly as it is" again, and edit the template, never a
  later edit.
- **The crown is cut off:** in prompt 1, ask for "more green above the crown, the head a little smaller in frame".
- **Extra fingers or melting hands:** shorten the clip, and ask for the hand to stay closer to the ledge.
- **The tail jerks:** add "slow-motion, neutral buoyancy, the fluke sweeps in one long smooth arc".
- **Words or symbols appear on her etchings:** add "the etchings are plain geometric lines: no letters, no symbols".
