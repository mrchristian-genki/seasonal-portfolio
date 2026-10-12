# A feature cover's title colours, from its Note's two colours (e.palette: the narrator's colours, the ones that dress
# her flair, the glass card and the backdrop), each one shaded to read on the hero picture where it sits.
#   python3 field/tools/mastcolors.py <cover still> <magazine> <colour> [<colour>]   ->   {"a": "#…", "b": "#…", "l": "#…"}
# a: the masthead, over the picture's top left; b: a masthead's second word, there too; l: the first cover line, over
# the right side. Each keeps its colour's hue where it can, at a lightness that stands off the picture (a contrast of at
# least 3, big type, and some over its busiest parts); when its own hue would melt into the picture (a blue title over blue water) or can't get there,
# a neighbouring hue or the opposite one takes its place. Called by publish.mjs for each feature Note.
import colorsys, json, sys
import numpy as np
from PIL import Image


def lum(rgb):
    c = np.asarray(rgb, float) / 255
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return c[..., 0] * 0.2126 + c[..., 1] * 0.7152 + c[..., 2] * 0.0722


def contrast(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def region(im, x0, y0, x1, y1, veil=1.0):
    # veil: how much of the picture shows through the cover's own dark gradient there (css/feature.css .mag-cover::after)
    w, h = im.size
    px = np.asarray(im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))).convert('RGB'), float).reshape(-1, 3) * veil
    L = lum(px)
    hsv = np.array([colorsys.rgb_to_hsv(*(p / 255)) for p in px[:: max(1, len(px) // 4000)]])
    chroma = hsv[:, 1] * hsv[:, 2]
    # the picture's own hue there, weighted by how colourful each pixel is (none, if it's mostly grey or dark)
    ang = hsv[:, 0] * 2 * np.pi
    vx, vy = (np.cos(ang) * chroma).sum(), (np.sin(ang) * chroma).sum()
    strength = np.hypot(vx, vy) / max(len(hsv), 1)
    return {'lo': float(np.percentile(L, 25)), 'hi': float(np.percentile(L, 75)), 'mean': float(L.mean()),
            'hue': (np.arctan2(vy, vx) / (2 * np.pi)) % 1, 'strength': float(strength)}


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def pick(col, bg):
    r, g, b = (v / 255 for v in hexrgb(col))
    h0, l0, s0 = colorsys.rgb_to_hls(r, g, b)
    s = max(s0, 0.5)
    best = None
    for dh, cost in ((0, 0), (1 / 12, 0.5), (-1 / 12, 0.5), (0.5, 0.8)):
        h = (h0 + dh) % 1
        # a title that shares the picture's strong hue melts into it
        near = min(abs(h - bg['hue']), 1 - abs(h - bg['hue']))
        melt = min(0.3, 3 * bg['strength']) if near < 1 / 12 else 0   # never enough alone to leave a hue that reads
        for l in np.arange(0.12, 0.93, 0.02):
            rgb = colorsys.hls_to_rgb(h, l, s if 0.2 < l < 0.86 else s * 0.8)
            L = lum(np.array(rgb) * 255)
            # against the picture there on average, and never lost over its darker or lighter quarter (the type's own
            # shadow helps the rest)
            c = contrast(L, bg['mean'])
            # light type on a darker picture, dark type on a light one, the way a cover is set
            if (L < bg['mean']) != (bg['mean'] > 0.3):
                continue
            if c < 3.0 or min(contrast(L, bg['lo']), contrast(L, bg['hi'])) < 1.6:
                continue
            # (a hue it shares with the picture only matters when the lightness doesn't already set it apart)
            score = cost + (melt if c < 4.5 else 0) + abs(l - l0) * 1.2 - min(c, 7) * 0.04
            if best is None or score < best[0]:
                best = (score, rgb)
    if best is None:   # nothing in its family stands off this picture: plain white or near-black, whichever reads
        return '#ffffff' if bg['mean'] < 0.35 else '#141414'
    return '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in best[1])


def main():
    im = Image.open(sys.argv[1])
    im.thumbnail((640, 640))
    theme = sys.argv[2]
    pal = [c for c in sys.argv[3:5] if len(c.lstrip('#')) == 6]
    if not pal:
        print('{}'); return
    if len(pal) == 1:
        pal.append(pal[0])
    top = region(im, 0.04, 0.03, 0.75, 0.3, 0.62)
    # where the magazine sets its cover lines (css/feature.css .mag-lines): bottom left for POPULAR PARADOX, else right
    right = region(im, 0.04, 0.6, 0.45, 0.93, 0.8) if theme == 'paradox' else region(im, 0.62, 0.25, 0.97, 0.6, 0.8)
    print(json.dumps({'a': pick(pal[0], top), 'b': pick(pal[1], top), 'l': pick(pal[1], right)}))


main()
