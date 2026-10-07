# GlazyArray's look prompts: two colours, two prompts

Every look is made in two steps, so her two flair colours come out clean:

1. **Prompt 1** puts the look on her template. The parts that take **colour A** are rendered in **bright magenta**.
   The parts that take **colour B** are rendered in **plain pearl white** for now.
2. **Prompt 2** edits the image from prompt 1 (the same image, not a new render). It turns only the colour B parts
   **bright cyan**.

Bring back the image from prompt 2. From it the Studio (or Claude) makes:

- **Mask A** from the magenta and **mask B** from the cyan. No guessing at colour ranges.
- **The base:** the magenta and cyan parts turned to neutral pearl white, keeping all their shading and gloss.
  Each Note's two colours then dye that white exactly, instead of fighting a teal or a coral underneath.

## Rules for both prompts

- **Template:** start from `assets/narrator/kit/her-template.png`, 1376 × 768 (with `her-edit-mask.png` where the tool
  takes a mask).
- **Keep the green:** the flat chroma green background (#00B140) must stay as it is.
- **Magenta and cyan are working colours.** Ask for them saturated but **shaded and glossy, like a real material**,
  not flat paint. The shading is what the final look keeps.
- **Brass stays brass:** lamps, buckles, rivets, chains and her hair keep their own colour. Only the named parts change.
- **Her face doesn't matter:** her eyes, face and jaw are swapped back to her own layers afterwards.
- **What to avoid:** no text, logos, brands or people, and nothing crossing her face below the brows.

## The two prompts (fill in the brackets)

**Prompt 1:**

> Same image, same camera, same face, same eyes, same jaw, same neck and the same flat chroma green background
> (#00B140). Change only the hair and accessories: [THE LOOK]. Render [PART A] in a bright saturated magenta
> (#FF00FF) with natural shading and gloss, and [PART B] in plain pearl white with natural shading and gloss.
> Everything else in her style: polished brass and rose-gold, chunky sculpted shapes, nothing crossing her face
> below the brows.

**Prompt 2:** run this on the image prompt 1 made.

> Same image, exactly as it is. Change only [PART B] from pearl white to a bright saturated cyan (#00FFFF), keeping
> its shading, gloss and folds. Change nothing else: the magenta stays magenta, and the brass, hair, face and green
> background stay exactly the same.

---

## Category looks (seen most: do these first)

### bike-helmet: a glossy hard-shell bike helmet
- **The look:** a glossy hard-shell bike helmet with vents, a band around its lower edge and a little round brass
  headlamp at the front. It covers her flower-bud antenna (bulb false).
- **A, magenta:** the helmet shell.
- **B, cyan:** the band around the lower edge.
- **Stays brass:** the headlamp.

### trail-cap: a trucker cap
- **The look:** a trucker cap with a curved brim and a small leather patch on the front reading "GA".
- **A, magenta:** the front panel and the brim.
- **B, cyan:** the mesh back.
- **Stays as it is:** the leather GA patch.

### grad-cap: a mortarboard
- **The look:** a fabric mortarboard with a flat square board, a fitted cap band and a tassel hanging off one corner.
  It covers her antenna (bulb false).
- **A, magenta:** the board and the cap band.
- **B, cyan:** the tassel.
- **Stays brass:** the button on top.

### workshop-goggles: goggles pushed up on her forehead
- **The look:** workshop goggles with a wide leather strap, pushed up on her forehead.
- **A, magenta:** the strap.
- **B, cyan:** the padded rims round the lenses.
- **Stays as it is:** the lens glass, and the brass frames and buckle.

### beach-shades: round sunglasses up in her curls
- **The look:** round sunglasses pushed up in her curls, with a gem hair clip at one side.
- **A, magenta:** the sunglass frames.
- **B, cyan:** the hair clip's gem.
- **Stays as it is:** the lenses (warm tinted glass).

## Holiday looks

### winter-holidays: a Santa hat
- **The look:** a knitted Santa hat that flops over to one side, with a thick fluffy trim and a pom-pom.
  It covers her antenna (bulb false).
- **A, magenta:** the hat.
- **B, cyan:** the trim and the pom-pom.

### tahoe-winter: a beanie
- **The look:** a cable-knit beanie with a folded cuff and a big pom-pom.
  It covers her antenna (bulb false).
- **A, magenta:** the knit body.
- **B, cyan:** the cuff and the pom-pom.

### halloween: a witch hat
- **The look:** a wide-brimmed witch hat with a crooked tip, a fabric band and a small brass buckle.
  It covers her antenna (bulb false).
- **A, magenta:** the hat.
- **B, cyan:** the band.
- **Stays brass:** the buckle.

### fourth-of-july: a star tiara
- **The look:** a tiara of chunky sculpted stars set in a brass band.
- **A, magenta:** the stars.
- **B, cyan:** the enamel between the stars, along the band.

### valentines: heart clips
- **The look:** two little heart hair clips, with a small bow on each.
- **A, magenta:** the hearts.
- **B, cyan:** the bows.

### st-patricks: a tiny top hat
- **The look:** a tiny top hat tilted on her curls, with a hat band and a four-leaf clover pin at its side.
- **A, magenta:** the hat.
- **B, cyan:** the hat band and the clover.

### spring: bunny ears and a flower crown
- **The look:** soft bunny ears on a crown of small flowers.
- **A, magenta:** the ears (the outside fur).
- **B, cyan:** the flowers.
- **Stays as it is:** the inner ears, soft pink.

### thanksgiving: a crown of leaves
- **The look:** a crown of autumn leaves with a few acorns tucked in.
- **A, magenta:** the leaves.
- **B, cyan:** the berries or ribbon woven through them.
- **Stays brass:** the acorns.

## Hair looks (her hair stays brass; only the accessory takes colour)

### headband
- **The look:** a knitted sport headband across her curls, with a stripe at the top edge and one at the bottom.
- **A, magenta:** the top stripe.
- **B, cyan:** the bottom stripe.
- **Stays as it is:** the middle band, plain pearl white.

### ponytail
- **The look:** a high side ponytail tied with a fabric scrunchie, with a small bow on it.
- **A, magenta:** the scrunchie.
- **B, cyan:** the bow.

### perm
- **The look:** a big tight-curl perm with a thin headband through it.
- **A, magenta:** the headband.
- **B, cyan:** a small bead or gem at each end of the headband.

### crimp
- **The look:** crimped hair with two snap clips.
- **A, magenta:** the clips.
- **B, cyan:** a small gem set in each clip.

### updo
- **The look:** an updo with a big bow at the top.
- **A, magenta:** the bow.
- **B, cyan:** the knot at the bow's centre.

### bob
- **The look:** a sleek bob with long drop earrings.
- **A, magenta:** the earrings' gems.
- **B, cyan:** the small beads between them.

---

## After the render

Drop the image from prompt 2 into the Studio's look panel (or send it to Claude). The look goes into `looks.json`
with:

- `"flair": "ab"`
- `"flairDye": "ab"`: both masks are dyed, since the base is white
- `"flairK"`: the colour strength
- a new `"v"`
