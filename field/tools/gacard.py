"""GlazyArray's share card for a Field Note with an episode (1200x630): her backdrop out to the edges and, down the
middle, the site's nameplate with the title, the glass player and her at her desk, in the Note's look and colours, as
on its Listen bar. cards.py uses it for every published Note that has an episode; the rest keep the cover card.

Her parts come from assets/narrator: her keyed rest pose (kit/rest-body.webp), the look and its flair masks
(looks.json; the flair tinted 45% in the Note's palette, as narrator.css does), her eyes, catchlights and chin
plates, the category backdrop and the desk. Needs Pillow and numpy."""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
N = os.path.join(ROOT, 'assets', 'narrator')
FONT = os.path.join(os.path.dirname(__file__), 'fonts', 'Nunito.ttf')
W, H = 1200, 630
TEAL = (15, 77, 71)
KIND = {'ride': 'Ride', 'hike': 'Hike', 'forage': 'Foraging walk', 'make': 'Mini-Cast'}
KIND_TAG = {'ride': 'ride', 'hike': 'hike', 'forage': 'foraging', 'make': 'mini-cast'}
MONTHS = 'January February March April May June July August September October November December'.split()
LOOKS = None


def nunito(size, weight):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([weight])
    except OSError: pass
    return f


def rgba(name): return np.asarray(Image.open(os.path.join(N, name)).convert('RGBA')).astype(np.float32) / 255
def hexrgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
def rgb8(c): return tuple(int(round(float(x) * 255)) for x in c)


def lum(c): return .3 * c[..., 0] + .59 * c[..., 1] + .11 * c[..., 2]
def color_blend(base, col):
    """CSS mix-blend-mode: color (the colour's hue and saturation, the base's lightness)"""
    c = np.broadcast_to(col, base.shape).astype(np.float32); c = c + (lum(base) - lum(c))[..., None]
    l = lum(c)[..., None]; n = c.min(-1, keepdims=True); x = c.max(-1, keepdims=True)
    c = np.where(n < 0, l + (c - l) * l / np.maximum(l - n, 1e-6), c)
    return np.where(x > 1, l + (c - l) * (1 - l) / np.maximum(x - l, 1e-6), c)


def over(dst, src):
    a = src[..., 3:]; dst[..., :3] = src[..., :3] * a + dst[..., :3] * (1 - a); dst[..., 3:] = a + dst[..., 3:] * (1 - a)


def style(e):
    """her look and backdrop on this Note, as the site picks them: its own, else its categories' (tags, then kind)"""
    global LOOKS
    if LOOKS is None: LOOKS = json.load(open(os.path.join(N, 'looks.json')))
    cats = [t for t in (e.get('tags') or [])] + [KIND_TAG.get(e.get('kind'), e.get('kind') or '')]
    name = (e.get('narratorLook') or {}).get('look') or next((LOOKS.get('categories', {})[c] for c in cats if c in LOOKS.get('categories', {})), None)
    bd = (e.get('narratorBackdrop') or {}).get('backdrop') or next((LOOKS.get('categoryBackdrops', {})[c] for c in cats if c in LOOKS.get('categoryBackdrops', {})), None)
    look = next((l for l in LOOKS['looks'] if l.get('name') == name and l.get('file')), None)
    bdf = next((b['file'] for b in LOOKS.get('backdrops', []) if b.get('name') == bd), None)
    return look, bdf


def head(look, pal):
    """her head layer (623 x 437): the look (its flair tinted), her eyes in their lenses, the catchlights, the chin"""
    out = rgba('looks/' + look['file']) if look else rgba('head-base.webp')
    if look and pal:
        stem = look['file'].rsplit('.', 1)[0]
        for k, c in zip('ab', pal):
            if k not in (look.get('flair') or ''): continue
            m = rgba(f'looks/{stem}.flair-{k}.png')[..., 3:] * float(look.get('flairK', .45))   # its strength: 45% on brass, more on fabric
            out[..., :3] = out[..., :3] * (1 - m) + color_blend(out[..., :3], hexrgb(c)) * m
    eye = rgba('head-iris.webp'); eye[..., 3:] *= rgba('head-lens.png')[..., 3:]
    for lay in (eye, rgba('head-shine.webp'), rgba('head-jaw-sides.webp'), rgba('head-jaw.webp')): over(out, lay)
    return out


def figure(look, pal, s):
    """her at rest at her desk, RGBA, at scale s (her body box is 576 x 300 at 1): the body video's rest frame with
    the head over it, placed as narrator.css places it"""
    body = Image.open(os.path.join(N, 'kit', 'rest-body.webp')).convert('RGBA')
    bw, bh = round(976 * s), round(300 * s); body = body.resize((bw, bh), Image.LANCZOS)
    hd = Image.fromarray((np.clip(head(look, pal), 0, 1) * 255).astype(np.uint8), 'RGBA')
    tw = round(598.2 * s); th = round(tw * 437 / 623); hd = hd.resize((tw, th), Image.LANCZOS)
    rise = round(.5709 * 300 * s) + th                     # the head's top above the box's bottom
    c = Image.new('RGBA', (bw, max(rise, bh)), (0, 0, 0, 0))
    c.alpha_composite(body, (0, c.height - bh))
    hx, hy = round(200 * s - 11.06 * s), c.height - rise
    sh = Image.new('RGBA', hd.size, (0, 0, 0, 0)); sh.putalpha(hd.split()[3].point(lambda v: int(v * .35)))
    c.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5 * s)), (hx, hy + round(3 * s)))
    c.alpha_composite(hd, (hx, hy))
    return c


def backdrop(bdf, pal):
    """the scene behind her, softly blurred and dimmed, the bar's shade over it in the Note's colours"""
    if bdf: im = ImageOps.fit(Image.open(os.path.join(N, 'backdrops', bdf)).convert('RGB'), (W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(W / 180))
    else: im = Image.new('RGB', (W, H), TEAL)
    a = np.asarray(im).astype(np.float32) / 255 * (.7 if bdf else 1)
    g = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]; base = np.array([8, 30, 28], np.float32) / 255
    c1, c2 = (hexrgb(pal[0]), hexrgb(pal[1])) if pal else (base, base)
    shade = (c2 * .14 + base * .86) * (1 - g) + (c1 * .22 + base * .78) * g; op = .05 + .3 * g
    return Image.fromarray((np.clip(a * (1 - op) + shade * op, 0, 1) * 255).astype(np.uint8)).convert('RGBA')


def plaque(title, line, maxw):
    """the site's nameplate (narrator.css .nb-plate): a dark charcoal face, silver edges top and bottom, plain type"""
    size = 34; tf = nunito(size, 800)
    while tf.getlength(title) > maxw - 48 and size > 18: size -= 2; tf = nunito(size, 800)
    sf = nunito(13, 700)
    while sf.getlength(line) > maxw - 48 and sf.size > 9: sf = nunito(sf.size - 1, 700)
    pw = int(min(maxw, max(tf.getlength(title), sf.getlength(line) + .08 * 13 * len(line)) + 48)); ph = int(size * 1.3 + sf.size * 1.5 + 24)
    t = np.linspace(0, 1, ph, dtype=np.float32)[:, None, None]
    face = (np.array([44, 42, 40], np.float32) * (1 - t) + np.array([23, 22, 21], np.float32) * t).repeat(pw, 1)
    p = Image.fromarray(np.dstack([face, np.full((ph, pw, 1), 240, np.float32)]).astype(np.uint8), 'RGBA'); d = ImageDraw.Draw(p)
    d.rectangle((0, 0, pw, 2), fill=(201, 204, 206, 255)); d.rectangle((0, ph - 3, pw, ph), fill=(179, 182, 184, 255))
    y = 10; d.text(((pw - tf.getlength(title)) / 2, y), title, font=tf, fill=(230, 232, 234)); y += int(size * 1.3)
    x = (pw - (sf.getlength(line) + .08 * sf.size * (len(line) - 1))) / 2
    for ch in line: d.text((x, y), ch, font=sf, fill=(140, 144, 147)); x += sf.getlength(ch) + .08 * sf.size
    out = Image.new('RGBA', (pw + 32, ph + 32), (0, 0, 0, 0)); out.paste((0, 0, 0, 110), (16, 22, 16 + pw, 22 + ph))
    out = out.filter(ImageFilter.GaussianBlur(7)); out.alpha_composite(p, (16, 16))
    return out


def player(w, pal):
    """the glass player of the Listen bar: tinted frosted glass, a light rim, where to listen, a seek bar and Play"""
    h = 160; c1, c2 = (hexrgb(pal[0]), hexrgb(pal[1])) if pal else (np.array([.15, .74, .67], np.float32), np.array([.71, .47, .21], np.float32))
    t = ((np.linspace(0, 1, w, dtype=np.float32)[None, :] + np.linspace(1, 0, h, dtype=np.float32)[:, None]) / 2)[..., None]
    a = np.array([30, 34, 34], np.float32) / 255 * .74 + c1 * .26; b = np.array([239, 239, 239], np.float32) / 255 * .8 + c2 * .2
    px = np.dstack([(a * (1 - t) + b * t), (.66 * (1 - t) + .18 * t)])
    g = Image.fromarray((px * 255).astype(np.uint8), 'RGBA')
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), 18, fill=255)
    p = Image.new('RGBA', (w, h), (0, 0, 0, 0)); p.paste(g, (0, 0), m); d = ImageDraw.Draw(p)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 18, outline=rgb8(c2 * .4 + .6 * .94) + (110,), width=2)
    x, y = 24, 18
    d.text((x, y), 'CHRISTIANGEHRKE.COM/PLAY', font=nunito(14, 800), fill=(244, 170, 200)); y += 24
    d.text((x, y), 'Listen to the episode', font=nunito(26, 800), fill=(255, 255, 255)); y += 34
    d.text((x, y), 'Narrated by GlazyArray', font=nunito(17, 700), fill=rgb8(c2 * .55 + .45)); y += 42
    r = 20; cx, cy = w - x - r, y
    end = cx - r - 16; at = x + int((end - x) * .18)
    d.rounded_rectangle((x, cy - 3, end, cy + 3), 3, fill=(255, 255, 255, 60)); d.rounded_rectangle((x, cy - 3, at, cy + 3), 3, fill=rgb8(c1) + (255,))
    d.ellipse((at - 6, cy - 6, at + 6, cy + 6), fill=(255, 255, 255))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgb8(c1 * .45 + np.array([24, 26, 26], np.float32) / 255 * .55) + (235,))
    k = 8; d.polygon([(cx - k * .6, cy - k), (cx - k * .6, cy + k), (cx + k, cy)], fill=(255, 255, 255))
    return p


def desk(h):
    d = Image.open(os.path.join(N, 'desk.jpg')).convert('RGB'); d = d.resize((max(1, round(d.width * h / d.height)), h), Image.LANCZOS)
    row = Image.new('RGBA', (W, h)); x = 0
    while x < W: row.paste(d, (x, 0)); x += d.width
    return row


def line_of(e):
    d = e['date'].split('-'); when = f"{MONTHS[int(d[1]) - 1]} {int(d[2])}, {d[0]}"
    kind = 'Case study' if 'case-study' in (e.get('tags') or []) else KIND.get(e.get('kind'), 'Field Note')
    place = (e.get('place') or '').split(',')[0].strip()
    return ' · '.join(x for x in (kind, when, place) if x).upper()


def card(e):
    pal = e.get('palette') if isinstance(e.get('palette'), list) and len(e.get('palette')) == 2 else None
    look, bdf = style(e)
    bg = backdrop(bdf, pal)
    if pal:   # a soft light behind her, in the Note's first colour
        glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(glow).ellipse((W / 2 - 260, 330, W / 2 + 260, 760), fill=rgb8(hexrgb(pal[0])) + (70,))
        bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(70)))
    title = (e.get('post') or {}).get('title') or e.get('title') or 'Field Notes'
    p = plaque(title, line_of(e), 560); bg.alpha_composite(p, ((W - p.width) // 2, 6))
    pl = player(500, pal); py = 6 + p.height - 6; bg.alpha_composite(pl, ((W - pl.width) // 2, py))
    s = max(.4, min(.66, (H - (py + pl.height + 4)) / 590.9))   # she fits under the player (590.9 tall per unit)
    dk = desk(round(26 * s)); bg.alpha_composite(dk, (0, H - dk.height))
    fig = figure(look, pal, s)
    bg.alpha_composite(fig, ((W - fig.width) // 2 + round(10 * s), H - fig.height + 2))
    return bg.convert('RGB')


if __name__ == '__main__':   # python3 field/tools/gacard.py <id> [out.jpg]: one card, to look at
    import sys
    e = json.load(open(os.path.join(ROOT, 'field', 'data', 'events', sys.argv[1] + '.json')))
    card(e).save(sys.argv[2] if len(sys.argv) > 2 else sys.argv[1] + '.jpg', quality=88)
