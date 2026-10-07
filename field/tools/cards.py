#!/usr/bin/env python3
"""Share cards for the Field Notes: each published entry gets its own 1200x630 card (what Messages, Slack and
social sites show for a link to it). One with an episode gets GlazyArray's card (gacard.py: her at her desk with
the glass player, in the Note's look and colours); the rest, its cover photo with a brass nameplate on it, the title cut in Cinzel as on
the Studio's STUDIO plate, and under it the kind of entry, the day and the place.

Runs before publish.mjs (which uses a card when there is one): python3 field/tools/cards.py
Writes field/data/cards/<id>.jpg (a build product, not kept in git). Needs Pillow and numpy."""
import glob, json, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
import gacard

FIELD = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(FIELD, 'data', 'cards')
FONTS = os.path.join(os.path.dirname(__file__), 'fonts')
W, H, S = 1200, 630, 2                      # the card, drawn at twice the size and scaled down for smooth edges
KIND = {'ride': 'Ride', 'hike': 'Hike', 'forage': 'Foraging walk', 'make': 'Mini-Cast'}
MONTHS = 'January February March April May June July August September October November December'.split()


def font(weight, size): return ImageFont.truetype(os.path.join(FONTS, f'Cinzel-{weight}.ttf'), size * S)


def cover_of(e):
    """the entry's cover picture, as publish.mjs picks it: the cover, else the first photo; a loop's poster frame"""
    photos = [p for p in e.get('photos') or [] if p.get('use') != 'skip']
    c = next((p for p in photos if p.get('cover')), None) or next((p for p in photos if not p.get('video')), None)
    if not c: return None
    path = os.path.join(FIELD, (c['poster'] if c.get('video') else c['src']).replace('../', ''))
    return path if os.path.exists(path) else None


def tracked(d, xy, text, f, fill, track):
    """text with letter-spacing (track, in ems)"""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += f.getlength(ch) + track * f.size


def tracked_len(text, f, track): return sum(f.getlength(ch) for ch in text) + track * f.size * (len(text) - 1)


def wrap(text, f, track, width):
    """the title on one line, or two balanced ones"""
    if tracked_len(text, f, track) <= width: return [text]
    words = text.split()
    best = None
    for i in range(1, len(words)):
        a, b = ' '.join(words[:i]), ' '.join(words[i:])
        m = max(tracked_len(a, f, track), tracked_len(b, f, track))
        if best is None or m < best[0]: best = (m, [a, b])
    return best[1] if best and best[0] <= width else None


def vgrad(w, h, stops):
    """a vertical gradient through (position, (r, g, b)) stops"""
    g = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
            if p0 <= t <= p1:
                k = (t - p0) / max(1e-6, p1 - p0)
                g.putpixel((0, y), tuple(round(c0[i] + (c1[i] - c0[i]) * k) for i in range(3)))
                break
    return g.resize((w, h))


def plate(title, line):
    """the brass nameplate: a bevelled rim, a brushed face, an engraved border, a rivet each end, the title cut in"""
    track = .1
    for size in range(54, 29, -2):
        tf = font('Bold', size)
        lines = wrap(title, tf, track, 760 * S)
        if lines: break
    sf = font('Medium', 16)
    tw = max(tracked_len(l, tf, track) for l in lines)
    sw = tracked_len(line, sf, .16)
    lh = tf.size * 1.12
    pw = int(max(tw, sw) + 130 * S)
    ph = int(len(lines) * lh + sf.size + 60 * S)
    p = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    r = 16 * S
    rim = vgrad(pw, ph, [(0, (243, 220, 156)), (.4, (125, 90, 36)), (.7, (227, 196, 127)), (1, (107, 74, 28))])
    m = Image.new('L', (pw, ph), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, pw - 1, ph - 1), r, fill=255)
    p.paste(rim, (0, 0), m)
    b = 5 * S
    face = vgrad(pw - 2 * b, ph - 2 * b, [(0, (226, 196, 131)), (.45, (184, 148, 79)), (.7, (154, 122, 60)), (1, (202, 168, 101))])
    brush = Image.new('RGBA', face.size, (0, 0, 0, 0)); bd = ImageDraw.Draw(brush)
    for x in range(0, face.size[0], 2 * S): bd.line((x, 0, x, face.size[1]), fill=(255, 255, 255, 16), width=S)
    face = Image.alpha_composite(face.convert('RGBA'), brush)
    fm = Image.new('L', face.size, 0); ImageDraw.Draw(fm).rounded_rectangle((0, 0, face.size[0] - 1, face.size[1] - 1), r - b, fill=255)
    p.paste(face, (b, b), fm)
    d = ImageDraw.Draw(p)
    i = 12 * S                                              # the engraved border inside the face
    d.rounded_rectangle((i, i, pw - i, ph - i), 8 * S, outline=(60, 38, 10, 150), width=2 * S)
    d.rounded_rectangle((i + 2 * S, i + 2 * S, pw - i - 2 * S, ph - i - 2 * S), 7 * S, outline=(255, 240, 200, 90), width=S)
    for cx in (34 * S, pw - 34 * S):                        # rivets
        cy = ph // 2
        d.ellipse((cx - 9 * S, cy - 9 * S, cx + 9 * S, cy + 9 * S), fill=(61, 42, 16))
        d.ellipse((cx - 7 * S, cy - 7 * S, cx + 7 * S, cy + 7 * S), fill=(122, 90, 38))
        d.ellipse((cx - 5 * S, cy - 6 * S, cx + 3 * S, cy + 2 * S), fill=(255, 241, 200))
    y = 22 * S
    for l in lines:                                          # cut in: a light edge below, the dark letter on it
        x = (pw - tracked_len(l, tf, track)) / 2
        tracked(d, (x, y + 1.5 * S), l, tf, (255, 236, 190, 170), track)
        tracked(d, (x, y), l, tf, (43, 24, 6, 255), track)
        y += lh
    x = (pw - sw) / 2
    tracked(d, (x, y + 8 * S + S), line, sf, (255, 236, 190, 130), .16)
    tracked(d, (x, y + 8 * S), line, sf, (74, 50, 20, 255), .16)
    return p


def card(e, src):
    bg = ImageOps.fit(Image.open(src).convert('RGB'), (W * S, H * S), Image.LANCZOS, centering=(.5, .42))
    shade = Image.new('L', (1, H * S))                       # the lower half darkens so the plate stands out
    for y in range(H * S): shade.putpixel((0, y), int(max(0, (y / (H * S) - .4) / .6) ** 1.4 * 170))
    bg.paste(Image.new('RGB', bg.size, (10, 6, 2)), (0, 0), shade.resize(bg.size))
    d = e['date'].split('-')
    when = f"{MONTHS[int(d[1]) - 1]} {int(d[2])}, {d[0]}"
    place = (e.get('place') or '').split(',')[0].strip()              # the place's short name
    line = ' · '.join(x for x in (KIND.get(e.get('kind'), e.get('kind') or 'Field Note'), when, place) if x).upper()
    title = (e.get('post') or {}).get('title') or e['title']
    p = plate(title, line)
    x, y = (W * S - p.width) // 2, H * S - p.height - 34 * S
    sh = Image.new('RGBA', bg.size, (0, 0, 0, 0))            # its shadow on the picture
    sh.paste((0, 0, 0, 150), (x + 8 * S, y + 12 * S), p.split()[3])
    out = Image.alpha_composite(bg.convert('RGBA'), sh.filter(ImageFilter.GaussianBlur(10 * S)))
    out.alpha_composite(p, (x, y))
    return out.convert('RGB').resize((W, H), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    made = 0
    for f in sorted(glob.glob(os.path.join(FIELD, 'data', 'events', '*.json'))):
        e = json.load(open(f))
        if e.get('status') != 'published' or e.get('sample'): continue
        # a Note with an episode: GlazyArray's card (gacard.py), in its look and colours; the rest: the cover card
        if (e.get('episode') or {}).get('audio'):
            gacard.card(e).save(os.path.join(OUT, e['id'] + '.jpg'), quality=86, optimize=True, progressive=True)
            made += 1; continue
        src = cover_of(e)
        if not src: continue
        card(e, src).save(os.path.join(OUT, e['id'] + '.jpg'), quality=86, optimize=True, progressive=True)
        made += 1
    print(f'cards: {made}')


if __name__ == '__main__':
    main()
