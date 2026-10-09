"""GlazyArray's trick ball: one clean, glossy ball rendered in any colour, to give a video generator as the reference
for every take (with her torso, assets/narrator/rest.jpg), so the ball looks the same in all of them.

    python3 ball.py "#3fd8f0" teal       ->  ball-teal.png (transparent) and ball-teal-green.png (on her green screen)
    python3 ball.py                      ->  the standard set below

The ball is shaded once in grey (soft light from the upper left, a crisp highlight, a rim of light, a little glow
inside), then tinted: the colour lives in the body, the highlight stays white, so every colour looks like the same
ball."""
import sys, numpy as np
from PIL import Image

N, GREEN = 1024, (11, 72, 64)   # size; her green-screen / bar colour behind her torso
SET = {'cyan': '#3fd8f0', 'amber': '#ffb02e', 'coral': '#ff6a5c', 'violet': '#9b7bff', 'pearl': '#e8eef2'}

def render(hexcol):
    c = np.array([int(hexcol.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)], float) / 255
    y, x = (np.mgrid[0:N, 0:N] + .5) / N * 2 - 1
    r2 = x * x + y * y; inside = r2 <= .92 ** 2
    nx, ny = x / .92, y / .92; nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    L = np.array([-.45, -.55, .70]); L /= np.linalg.norm(L)
    dif = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    H = L + np.array([0, 0, 1]); H /= np.linalg.norm(H)
    spec = np.clip(nx * H[0] + ny * H[1] + nz * H[2], 0, 1) ** 90 * 1.2
    rim = (1 - nz) ** 3 * .55                                    # light wrapping round the edge
    core = np.exp(-((nx + .12) ** 2 + (ny - .18) ** 2) / .18) * .35   # a little glow held inside
    body = (.18 + .72 * dif + rim * .6 + core)[..., None] * c       # the colour, lit
    rgb = np.clip(body + spec[..., None] + (rim * .25)[..., None], 0, 1)
    # soft anti-aliased edge
    edge = np.clip((.92 - np.sqrt(r2)) * N / 2.5, 0, 1)
    a = np.where(inside | (edge > 0), edge, 0)
    return Image.fromarray(np.dstack([rgb * 255, a * 255]).astype('uint8'), 'RGBA').resize((512, 512), Image.LANCZOS)

def save(name, hexcol):
    im = render(hexcol); im.save(f'ball-{name}.png')
    bg = Image.new('RGBA', im.size, GREEN + (255,)); bg.alpha_composite(im); bg.convert('RGB').save(f'ball-{name}-green.png')

if __name__ == '__main__':
    if len(sys.argv) > 1: save(sys.argv[2] if len(sys.argv) > 2 else sys.argv[1].lstrip('#'), sys.argv[1])
    else: [save(k, v) for k, v in SET.items()]
