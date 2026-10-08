# RIVETING TONE: GlazyArray's photoshoot, a prompt catalog

The pictures for her cover story (a Profile Note). Each shot has its size, the file name to save it as, where it goes
in the feature, and a prompt ready to copy. Render, then drop the files into the Note in the Studio (or send them to
Claude) under the names below.

## Before every shot

- **Give your image tool a reference of her.** Use one of these:
  - all of her, with her new eyes: `assets/narrator/kit/her-reference.jpg` (the best one)
  - her head on green: `assets/narrator/kit/her-template.png`
  - her contact sheet: `assets/narrator/kit/her-contact-sheet.jpg`

  Ask it to keep her exactly on-model.
- **Paste the description below** at the start of every prompt (it's in each one already).
- **Never:** text, letters, logos, magazine names, real people or brands in the picture. The masthead and cover lines
  are added on the page, not in the render.
- **Light:** warm and polished, like an editorial portrait: soft key light, gentle rim light, rich colour, shallow
  depth of field.

**Her description (in every prompt):**

> GlazyArray, a small rose-gold brass robot woman with a sculpted brass face and riveted seams, finger-wave brass
> curls that roll into side curls, lashes on her brass eyelids, calm Lake Tahoe blue eyes with warm creamy whites
> and small dark pupils, a soft closed smile, a little antenna topped with a glowing flower-bud bulb, glowing cyan
> glass tubes in her chest, and articulated brass hands. Keep her exactly like the reference image.

---

## 1. The cover

- **Size:** 4:5, at least 1600 × 2000
- **File:** `rt-cover.jpg`
- **Goes:** the cover, top of the Note, and the share card

> [Her description.] Editorial magazine cover portrait: head and shoulders, centred a little low in the frame,
> against a deep teal seamless studio backdrop. Warm key light from the left, a soft golden rim light on her curls,
> her flower-bud bulb glowing softly. A gentle, knowing half-smile, eyes straight to the camera. Clean empty space
> across the top third of the frame for a masthead. Shallow depth of field, rich colour, no text.

## 2. The opener: at her desk, mid-story

- **Size:** 16:9, at least 1920 × 1080
- **File:** `rt-desk.jpg`
- **Goes:** the opening spread, under the headline

> [Her description.] She sits at a small wooden desk in a cosy workshop at night, one brass hand raised mid-gesture
> as if making a point, the other hand flat on the desk. A warm brass desk lamp beside her, shelves of tools and
> glass jars softly blurred behind, warm bokeh. Candid editorial photo, as if a reporter caught her mid-sentence.
> Her chest tubes glow cyan. No text.

## 3. The hat issue

- **Size:** 4:5, at least 1600 × 2000
- **File:** `rt-helmet.jpg`
- **Goes:** "The wardrobe"

> [Her description.] Three-quarter studio portrait wearing her glossy hard-shell bike helmet in teal with a coral
> band and a small round brass headlamp that is switched on and glowing. Chin slightly up, a playful, confident
> look just off camera. Soft warm-grey studio backdrop, fashion-editorial lighting. No text.

## 4. The library: a good idea

- **Size:** 16:9, at least 1920 × 1080
- **File:** `rt-library.jpg`
- **Goes:** the Q&A ("What's the glowing ball?")

> [Her description.] Wearing a navy mortarboard with a gold tassel, she sits among tall wooden library shelves
> lit by brass reading lamps, holding a small glowing orb of soft cyan light in both brass hands and looking at it
> fondly. Warm, quiet, golden light; the orb lights her face from below. Editorial photo. No text.

## 5. Behind the scenes: between takes

- **Size:** 16:9, at least 1920 × 1080
- **File:** `rt-bts.jpg`
- **Goes:** "The voice came first"

> [Her description.] Her small wooden desk on a bright green-screen backdrop in a small film studio, a camera on a
> tripod softly out of focus in the foreground, softbox lights to either side. She rests her hands flat on the desk
> in her rest pose and looks toward the lens with a patient smile, as if between takes. Behind-the-scenes
> editorial photo. No text.

## 6. The awkward phase (the eyes)

- **Size:** 1:1, at least 1600 × 1600
- **File:** `rt-eyes.jpg`
- **Goes:** "Then came the awkward phase"

> [Her description.] A close-up beauty shot of her face from the eyes up, her calm blue eyes and brass lashes in
> sharp focus, a soft lid curving gently under each eye. Warm, flattering light, a shallow-focus magazine
> close-up. No text.

## 7. The hands

- **Size:** 16:9, at least 1920 × 1080
- **File:** `rt-hands.jpg`
- **Goes:** "She talks with her hands"

> [Her description.] Close-up of her two articulated brass hands on the edge of the wooden desk, mid-gesture,
> fingers open as if counting something off, her glowing chest tubes softly out of focus behind. Warm lamp light,
> macro editorial detail shot. No text.

## 8. The look book

- **Size:** 21:9, at least 2520 × 1080
- **File:** `rt-lookbook.jpg`
- **Goes:** the wardrobe spread. Or skip this one, and Claude builds the strip from her real looks.

> [Her description, as five identical brass display heads.] A row of five of her brass heads on polished brass
> display stands, lit like a jewellery shop window, each wearing a different hat: a cable-knit beanie with a
> pom-pom, a wide-brimmed witch hat with a buckle, a trucker cap, a tiara of chunky stars, and a Santa hat. Dark
> velvet backdrop, warm spotlights. No text.

## 9. The sign-off

- **Size:** 4:5, at least 1600 × 2000
- **File:** `rt-signoff.jpg`
- **Goes:** the last section ("Same time next episode?")

> [Her description.] She rests her hands flat on her wooden desk and gives a small wave with one hand, smiling
> warmly at the camera, the workshop lamp dimming behind her and her flower-bud bulb glowing. Gentle end-of-day
> light. Editorial portrait. No text.

## Extras (optional)

- **`rt-publicist.jpg`** (4:5): her publicist and HR are never shown as people, so keep them as objects. A brass
  clipboard and a mug on a side table beside her desk, softly lit, with nothing written on either.
- **`rt-story.jpg`** (9:16): done. `story.jpg` in the Note's photos is the cover, set tall with the masthead.
  To make it move, see `ANIMATE.md`.

---

## After the shoot

Send the files (or drop them into the Note in the Studio). Claude then:
- builds the Profile Note's magazine layout: masthead, cover lines, pull quotes, two-column type, the Q&A sidebar
  and the "Spotted" box
- sets the share card from `rt-cover.jpg`
- writes the captions
