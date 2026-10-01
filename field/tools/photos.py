#!/usr/bin/env python3
"""Add photos to an event: resize, strip location and camera data, and list them in the event.

    python3 field/tools/photos.py <event-id> IMG_0001.HEIC IMG_0002.jpg ... [--cover IMG_0002.jpg]

Each photo is saved as field/data/photos/<event-id>/NN.jpg (1600 px long edge, quality 82) with
no EXIF at all (so no GPS), rotated upright first. The time it was taken is kept in the event
JSON (time of day only matters for ordering), and new photos get an empty caption to fill in.
HEIC needs pillow-heif (pip install pillow-heif); otherwise export JPEGs from Photos first.
"""
import json, os, sys
from PIL import Image, ImageOps

try:
    import pillow_heif  # optional
    pillow_heif.register_heif_opener()
except Exception:
    pass

FIELD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
if len(args) < 2:
    sys.exit(__doc__)
cover = None
if '--cover' in args:
    i = args.index('--cover'); cover = os.path.basename(args[i + 1]); del args[i:i + 2]
eid, files = args[0], args[1:]
evf = os.path.join(FIELD, 'data', 'events', eid + '.json')
ev = json.load(open(evf))
out_dir = os.path.join(FIELD, 'data', 'photos', eid)
os.makedirs(out_dir, exist_ok=True)
photos = ev.setdefault('photos', [])
n = len(photos)
for f in files:
    im = Image.open(f)
    taken = None
    try:
        ex = im.getexif()
        taken = (ex.get_ifd(0x8769).get(36867) or ex.get(306))  # DateTimeOriginal, else DateTime
    except Exception:
        pass
    im = ImageOps.exif_transpose(im).convert('RGB')
    im.thumbnail((1600, 1600))
    n += 1
    name = '%02d.jpg' % n
    im.save(os.path.join(out_dir, name), 'JPEG', quality=82, optimize=True, progressive=True)  # no exif= : nothing carried over
    photos.append({'src': 'data/photos/%s/%s' % (eid, name), 'caption': '', 'takenAt': taken,
                   'w': im.width, 'h': im.height, 'use': 'post', 'cover': os.path.basename(f) == cover, 'from': os.path.basename(f)})
    print('  %s <- %s (%dx%d)' % (name, os.path.basename(f), im.width, im.height))
photos.sort(key=lambda p: p.get('takenAt') or '')
json.dump(ev, open(evf, 'w'), indent=1)
open(evf, 'a').write('\n')
print('%s: %d photos.' % (eid, len(photos)))
os.system('node "%s" --reindex' % os.path.join(FIELD, 'tools', 'ingest.mjs'))
