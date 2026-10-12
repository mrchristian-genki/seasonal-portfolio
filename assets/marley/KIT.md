# Robot Marley's kit: the prompts that make her parts

Robot Marley is the third character (Christian, Oct 12, 2026): a robot companion dog built after the real Marley, a
mixed-breed hound. She gets her own section for the local dog scene: news, dogs looking for homes, new gear and toys
tried out, and maybe a podcast with other dogs as guests. She's built the way GlazyArray and A.L.T.A. are: separate
layers the site moves on its own, so she can blink, tilt her head, prick her ears, wag and talk without a video
generator redrawing her face each time. Her parts will sit in `assets/marley/parts/`.

Her look comes from Christian's renders and his model sheet (Oct 12): the backyard, the lake shore, the flat-green
seated render, the anatomy study, and Marley meeting A.L.T.A. at her tank.

## Who she is (Christian's words, for every motion prompt)

- **Curious and thoughtful:** measured, deliberate movements. Meeting something new she pauses, lowers her stance a
  little and tilts her head, with a soft mechanical hum as her amber lenses focus.
- **Affectionate and tactile:** her tail wags in smooth, fluid arcs, never rapid thumps. She leans against legs when
  resting and rests her chin on knees or tables with a quiet whirr of servos letting go.
- **Alert:** her ears move on their own, on ball joints, to track faint sounds. At a sudden sound she stands square on
  her paws, neck arched, with a low, warm electronic chime, never a sharp bark.
- **Playful in bursts:** a play-bow and a bounce on her front legs, a few galloping strides, then straight back to calm,
  lying in a sunny patch with her paws tucked under her chest.
- **Usually very happy:** her eyes glow a warm, bright gold. When she isn't happy they go dark amber, then red.

## What we're making

| Part | What it is | How it moves on the site |
|---|---|---|
| **Body template** | Her sitting, facing the camera, on flat green | Every part is edited from this one image, so they line up |
| **Body base** | The template with her head, ears and tail removed (green where they were) | Stays still; a slow breathing loop at most |
| **Head** | Her head and collar, cut from the template | Tilts (her signature), nods, settles; code turns it on her neck |
| **Ears** | Each ear, cut on its own | Turn on their own pivots: perk, flick, droop, one up when she's curious |
| **Eyes** | Her lenses in their sockets | Glance and focus; code makes them glow gold (happy), dark amber, red |
| **Lids** | Her eyes closed | A slow blink |
| **Muzzle** | Her lower jaw, closed and in four open shapes | Swapped while she talks, following the voice, like A.L.T.A.'s mouth |
| **Tail** | Her tail, cut on its own | Wags in slow arcs from its base, faster when she's excited |
| **Collar and charm** | Two colour areas: the collar band and the charm | Take each Note's two colours, like GlazyArray's caps |
| **Charms** | A set of trinkets that hang from her collar | Picked per Note or category, like GlazyArray's looks |
| **Motions** | Short clips from the body template | Play-bow, settling down, alert stand, chin rest, lean |

**Why sitting, facing front:** her head, ears and tail all move on their own in a seated pose without the body
having to move, and the tail sticks out to one side clear of her body, so it cuts out cleanly. The motions that
need her whole body (the play-bow, lying down) are video clips that start and end in this exact pose.

## Rules for every prompt

- **Paste her description first** (below), then the part's own prompt.
- **References:** the backyard render and the flat-green seated render. **Never the model sheet:** its labels end up
  in the picture.
- **No text anywhere, not even on her tag.** The site's rule is no letters in AI renders, and the tools garble them
  (the green render's tag already reads "MARLAT"). Her name tag becomes a **charm**: a small trinket with no writing,
  coloured per Note (part 6).
- **Parts are edits, not new renders.** Parts 2 to 6 each edit the body template: the same image, only the named part
  changes. A new render shifts her by a few pixels and the layers stop lining up.
- **The green:** flat chroma green (#00B140), no shadow or gradient, so Claude can key it cleanly.
- **Size:** 1376 × 768 (16:9).
- **Motion:** slow, eased and deliberate, never frantic. Locked camera. The last frame matches the first.

**Her description (paste this first):**

> Robot Marley, a friendly robot companion dog built after a real mixed-breed hound. Warm-toned matte panels with
> visible seams, small rivets and mechanical joins that follow a real dog's markings: rich golden-brown and caramel
> panels on her back, sides, ears and the top of her head; matte white panels on her muzzle, chest, belly and paws.
> Floppy ears of articulated golden-brown panels; a smooth, segmented golden-brown tail. Bronze gaskets and dark
> metal connectors at her shoulders, elbows and knees. Large, warm amber lenses for eyes, gently glowing, curious and
> kind. A white muzzle with a dark matte nose with a tiny hint of pink. A dark, rugged collar with a small round
> bronze ring at the front, and nothing hanging from it. White paws with dark textured grip pads. Photoreal 3D
> render, soft natural light.

---

## 1. The body template

- **Make:** `marley-template.png`.

> [Her description.] She sits upright, facing straight at the camera, front paws together, centred in the frame, the
> whole of her with room around her ears. Her head is level and straight, looking into the lens, ears relaxed and
> hanging naturally, mouth closed. Her tail rests on the ground beside her, curving out to her left (the right of the
> picture), clear of her body. A flat chroma green background (#00B140), no shadow, no gradient, no floor line.
> Even, soft front light.

**Check:** both ears clear of her head's outline, the tail clear of her body, the collar ring visible at the front.

## 2. Her eyes

**2a. Empty lenses** (`marley-sockets.png`). Edit the template:

> Same image, exactly as it is. Change only her eyes: each lens becomes an empty, dark smoked-glass socket with a
> faint warm glow deep inside, the same size and shape. The panels around them stay exactly the same.

**2b. Eyes closed** (`marley-lids.png`). Edit the template again (not 2a):

> Same image, exactly as it is. Change only her eyes: she closes them gently, a soft golden-brown lid panel with a
> fine seam lowered over each lens, relaxed. Nothing else changes.

The glow is code (Christian, Oct 12): her lenses' own amber is her normal look; a soft gold tint fades in when she's
happy, and red when she's upset. Each fades over .9 s.

## 3. Her muzzle: five shapes

Run this five times on the template, one shape each:

> Same image, exactly as it is. Change only her mouth: [SHAPE]. Her white muzzle panels keep their seams and matte
> finish. Nothing else moves.

| File | [SHAPE] |
|---|---|
| `muzzle-closed.png` | closed, relaxed (the template's own; may need no edit) |
| `muzzle-small.png` | her lower jaw open a little, as if starting a word |
| `muzzle-open.png` | open wide as for "ah", a soft warm glow inside |
| `muzzle-round.png` | open and rounded as for "oh" |
| `muzzle-happy.png` | a happy open-mouthed pant, a soft pink tongue panel just showing |

## 4. Her ears and tail, on their own

So they can move, each needs to be seen whole and also removed:

**4a. No ears, no tail** (`marley-bare.png`). Edit the template:

> Same image, exactly as it is. Remove only her two ears and her tail, leaving smooth golden-brown panels with a
> small bronze pivot socket where each ear and the tail attach. The green background shows where they were.

**4b. Ears up** (`ears-perked.png`), for alert. Edit the template:

> Same image, exactly as it is. Change only her ears: both lift and turn forward on their joints, alert, as if
> she's heard something. Nothing else changes.

Claude cuts the ears and tail from the template, and the perked ears from 4b, and turns them on their pivots in code:
a flick, one ear up, a slow droop, a smooth wag.

## 5. Her colour areas

Like A.L.T.A.'s Round 3. Edit the template twice:

> **5a.** Same image, exactly as it is. Paint only her collar band a flat, saturated magenta (#FF00FF), keeping its
> shading and shine. Everything else stays exactly the same.

> **5b.** Same image, exactly as it is. Paint only the bronze ring at the front of her collar a flat, saturated cyan
> (#00FFFF), keeping its shading and shine. Everything else stays exactly the same.

The magenta and cyan become her two masks: each Note's first colour on the collar band, the second on the charm.

## 6. Her charms (the trinkets on her collar)

Each is an edit of the template that hangs one small trinket from her collar ring. The base colour is white or pale
brass so the Note's colour can dye it, like GlazyArray's caps. No letters or numbers on any of them.

> Same image, exactly as it is. Add only a small [CHARM] hanging from the ring at the front of her collar, about the
> size of a coin, in [MATERIAL], catching the light. Nothing else changes.

| File | [CHARM] | [MATERIAL] |
|---|---|---|
| `charm-bone.png` | bone-shaped tag | pale polished brass |
| `charm-paw.png` | paw print | white enamel with a brass rim |
| `charm-heart.png` | heart | white enamel with a brass rim |
| `charm-star.png` | five-pointed star | pale polished brass |
| `charm-pinecone.png` | tiny pinecone | pale brass |
| `charm-ball.png` | little ball | white enamel |
| `charm-bike.png` | tiny bicycle wheel | pale polished brass |
| `charm-leaf.png` | aspen leaf | white enamel with a brass rim |

A Note or category picks its charm the way GlazyArray's caps are picked (a ride the bike wheel, an adoption story the
heart), and its two colours dye the collar and the charm.

## 7. Her moves (image to video)

**Settings:** 6 to 8 s, first frame (and last frame, if the tool has one) the body template. Paste first:

> A short, smooth clip from this exact image, starting and ending in this exact pose. Locked camera, no zoom or pan.
> Slow, deliberate, eased motion, never frantic; a robot dog's servos move smoothly. The flat green background
> (#00B140) stays flat and empty. No text, letters or logos.

| File | The move |
|---|---|
| `move-tilt.mp4` | She tilts her head slowly to one side, curious, holds it a moment as her eyes focus, and straightens. |
| `move-alert.mp4` | Her ears lift and turn forward, she rises to stand square on all four paws with her neck arched, holds, then sits back down. |
| `move-playbow.mp4` | She drops into a play-bow, chest low and tail high, bounces lightly twice on her front legs, then sits back up, calm. |
| `move-settle.mp4` | She lies down slowly, paws tucked under her chest, rests a moment, and rises back to sitting. |
| `move-chin.mp4` | She lowers her chin as if resting it on a knee just out of frame, eyes half closed, content, then lifts it. |
| `move-wag.mp4` | Only her tail moves: slow, smooth, happy arcs, then still. |

## 8. Her scenes

Backdrops behind her, like GlazyArray's: soft and out of focus, no people, no text. A backyard with a wooden fence, a
dog park, a trailhead, a Lake Tahoe beach at dusk, a cosy studio with two microphones on a low table for the podcast.

## 9. Magic around Tahoe (stills, then image to video)

Robot Marley out in the world, doing what a real dog can't. Each is a still first; any of them can then become a slow
6 to 8 s clip (first frame the still, "slow, eased, dreamlike motion, locked or very slow camera"). For every one:
paste her description first, use the lake-shore and backyard renders as references (never the model sheet), and add
the line below at the end. Public places only, never the home.

> Photoreal, cinematic, 16:9 (1376 x 768). The whole of her in frame, about a third of its height, her golden-brown and
> white panels and amber lenses clearly hers. No people, no text, no letters, no logos, no signs.

| File | The prompt |
|---|---|
| `scene-tallac-summit.png` | She stands on the highest granite boulder of a summit above Lake Tahoe at sunrise, chest out, ears lifted by the wind, a sea of pink clouds below and the deep blue lake beyond. A trail of tiny glowing golden paw prints leads up the rock behind her. Her lenses glow warm gold. |
| `scene-emerald-bay-walk.png` | At dawn she trots across the glassy, mirror-still water of Emerald Bay toward the small rocky island, walking on the surface. Each paw step leaves a soft ring of golden light rippling outward. Mist on the water, pines on the shore. |
| `scene-sand-harbor-leap.png` | At night she leaps in a long, graceful arc between two huge rounded granite boulders over clear turquoise shallows, the Milky Way overhead. Her lenses leave faint gold light trails through the air; the water below glows softly. |
| `scene-starlit-nap.png` | High over the lake at night she floats in the air, curled as if napping in a sunny patch, paws tucked under her chest, held up by a soft gold glow from the seams of her panels. The lake below mirrors the stars and a crescent moon. |
| `scene-aspen-swirl.png` | In a grove of golden autumn aspens above the lake, she drops into a play-bow while the yellow leaves lift off the ground and spiral around her in a slow ring, as if she called them. Warm late-afternoon light. |
| `scene-powder-ridge.png` | On a snowy ridge high above the lake, she bounds through deep fresh powder in a mid-air gallop, a bright spray of snow behind her, the falling snowflakes lit gold by her lenses. Blue winter sky, the lake far below. |
| `scene-waterfall-rainbow.png` | She stands calmly at the very top of a rainbow arching over a granite waterfall in the pines near Emerald Bay, looking down at the mist with her head tilted, curious. |
| `scene-underwater-alta.png` | Underwater in clear Tahoe shallows over smooth granite boulders, she swims beside A.L.T.A. (the copper-and-bronze mermaid), legs paddling, ears floating, a stream of tiny bubbles from her collar ring, a few trout nearby. Sunbeams through the surface. |
| `scene-moon-perch.png` | She sits on the curve of a huge glowing crescent moon low over the lake at night, tail hanging over the edge and swinging, looking down at the moon's reflection on the water. |

**For a clip:** "Same scene. Slow, eased, dreamlike motion: [her tail sways in slow arcs / the golden ripples spread /
the leaves keep circling / the snow drifts down]. Very slow camera push or locked camera. No text or logos."

## Built so far (Oct 12)

From Christian's first 18 renders, `assets/marley/parts/` (her stage is 560 x 728, cut from the 1376 x 768 template at
440, 40; `layout.json` has every part's box and pivot), and a preview with every move on a button
(`assets/marley/preview.html`):

- **Body** (`body.webp`): the bare render (no ears or tail), keyed, the chest under the charm filled in. A slow breath.
- **Head** (`head.webp`): down under the collar, so a tilt never shows a gap. It tilts on her neck (her curious look).
- **Ears** (`earL`, `earR`, and `-up` from the alert render): each flicks on its own pivot; alert lifts both.
- **Tail** (`tail.webp`): behind her body, wagging in slow arcs (faster when she's excited).
- **Eyes:** a glow on her irises (`iris-mask.webp`): warm gold when she's happy, dark amber, red; each fades over .9 s.
  Her lids (`lids.webp`) are from the eyes-closed render, lined up on hers.
- **Mouth:** closed, small (lined up from its render), open and the happy pant.
- **Collar and charms:** the collar (`collar.webp`) and its band (`collar-mask.webp`, from the magenta render) take a
  Note's first colour; eight charms (bone, heart, pinecone, star, paw, leaf, bike wheel, ball) each take its second, with a
  gentle swing when one changes.
- **Dyeable charms (Oct 12):** from Christian's cyan renders, each charm has `charm-<name>-dye.webp` (the charm, its cyan
  face turned to grey shading) and `charm-<name>-mask.webp` (exactly where the cyan was). A Note's colour multiplies
  through the mask, so only the charm's face takes it; its brass ring and rim stay brass. Her own charm cross-fades to
  the dyed one over .9 s. Her own white ball is the clean cyan cut dyed white. Seven are in; the **leaf** still needs its
  cyan render (until then her own leaf image dyes as before).

**Two sets came in:** twelve renders match the bone-tag template exactly (tail to the right); six (tail to the left,
plain ring) are a slightly different render. From those, only the closed eyes and the small mouth line up well enough
to use; the wide "ah" shows a second nose, so it's left out.

**Her moves (Oct 12, Christian's four clips):** a happy wag (`moves/wag.mp4`), lying down and back up (`down.mp4`),
standing to look around with her ears up (`stand.mp4`), and a tilt with a wink (`tilt.mp4`). Each is lined up with her
parts (scale and offset; the tilt and the end of lying down warped a few pixels to match), keyed off the green with
her shadow kept as a soft grey, and packed colour over mask (600 x 1476) so the site draws it with its own alpha. The
tilt clip came from the plain-ring render, so her charm vanishes in it and her tail starts on the other side; it
cross-fades, but a new tilt from the bone-tag template (`461`) would be seamless. Still to make from part 7: the
play-bow and the chin rest.

**Her player (Oct 12):** `js/marley.js` and `css/marley.css` build her on any `.marley` element: her parts in layers,
idle blinks, ear flicks and a curious tilt, and a move every 22 to 40 s while she's on screen (never the same twice),
her parts cross-fading to the clip and back. `data-controls` adds her buttons, `data-charm` and `data-palette` dress
her. She's live in her feature Note (a `marley` block) and in the Parts Catalog (two cards).

**Still to make:** the leaf charm painted cyan (6, same prompt as the others); a wide "ah" edited from the bone-tag template (`461`), not the plain-ring one; empty
lenses (2a) if her eyes should glance; her moves (7) and scenes (8).

---

## Next steps

1. **Christian:** the body template (1). Once it's right, everything else is edited from it.
2. **Claude:** cuts her into layers (body, head, ears, tail, eyes, muzzle) and builds a preview page with the tilt,
   blink, ear flicks, wag, eye glow and talking, like A.L.T.A.'s.
3. **Christian:** the edits (2 to 6), then the moves (7) and scenes (8).
4. **Claude:** her player, her colours and charms in the Studio, her cards in the Parts Catalog, and her as a narrator
   choice beside GlazyArray and A.L.T.A.
5. **Together:** her section: what it holds (news, dogs looking for homes, gear and toys tried out, the podcast), and
   where it lives on the site.

**For her section:** the facts come only from Christian's Notes and words, like everything on the site. Dogs and
their people stay anonymous unless they've agreed to be named, and a dog looking for a home appears only as
Christian shares it.
