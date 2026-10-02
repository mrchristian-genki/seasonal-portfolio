#!/usr/bin/env python3
"""Fetch Play's gallery media from the shared Google Photos albums named in field/data/gallery.json.

    python3 field/tools/gallery.py            # fetch anything missing
    python3 field/tools/gallery.py --force    # fetch everything again

For each series, only the picked items (their numbers in the album, in album order) are kept:
  photos  -> field/data/gallery/<key>/NN.jpg   1400 px long edge, quality 80, no EXIF at all
  videos  -> field/data/gallery/<key>/NN.mp4   960 px, H.264, silent loop, faststart (+ NN.jpg poster)
             Clips over 15 s (full edits with music) are kept as a still instead: they belong on
             YouTube with their sound, not as silent loops.
and field/data/gallery/manifest.json lists them for publish.mjs.
Needs Pillow and imageio-ffmpeg (pip install imageio-ffmpeg) for the video step.
"""
import io, json, os, re, ssl, subprocess, sys, urllib.request
from PIL import Image, ImageOps

FIELD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(FIELD, 'data', 'gallery')
FORCE = '--force' in sys.argv
CA = '/root/.ccr/ca-bundle.crt'
CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else ssl.create_default_context()
UA = {'User-Agent': 'Mozilla/5.0'}
ITEM = re.compile(r'\["(AF1Qip[^"]+)",\["(https://lh3\.googleusercontent\.com/pw/[^"]+)",(\d+),(\d+)')

def fetch(url, timeout=120):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout, context=CTX).read()

def album_items(code):
    """Every item in a shared album, in album order: (url, width, height, video_ms)."""
    h = fetch('https://photos.app.goo.gl/' + code).decode('utf8', 'ignore')
    ms = list(ITEM.finditer(h)); seen = set(); out = []
    for i, m in enumerate(ms):
        if m.group(1) in seen: continue
        seen.add(m.group(1))
        end = ms[i + 1].start() if i + 1 < len(ms) else m.start() + 3000
        dv = re.search(r'"76647426":\[(\d+)', h[m.start():end])   # present on videos: duration in ms
        out.append((m.group(2), int(m.group(3)), int(m.group(4)), int(dv.group(1)) if dv else 0))
    return out

def save_photo(url, path):
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(fetch(url + '=w2048-h2048')))).convert('RGB')
    im.thumbnail((1400, 1400))
    im.save(path, 'JPEG', quality=80, optimize=True, progressive=True)   # no exif= : nothing carried over
    return im.size

def save_video(url, path):
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe(); raw = path + '.src'
    open(raw, 'wb').write(fetch(url + '=dv', timeout=300))
    subprocess.run([ff, '-y', '-loglevel', 'error', '-i', raw, '-an', '-vf', "scale='if(gt(iw,ih),min(960,iw),-2)':'if(gt(iw,ih),-2,min(960,ih))'",
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                    '-map_metadata', '-1', path], check=True)
    os.remove(raw)
    # Poster: a frame from the clip itself (Google's own thumbnail has a play icon drawn on it).
    subprocess.run([ff, '-y', '-loglevel', 'error', '-ss', '0.5', '-i', path, '-frames:v', '1', '-q:v', '3', path[:-4] + '.jpg'], check=True)
    return Image.open(path[:-4] + '.jpg').size

def save_video_still(url, path):
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe(); raw = path + '.src'
    open(raw, 'wb').write(fetch(url + '=dv', timeout=300))
    subprocess.run([ff, '-y', '-loglevel', 'error', '-ss', '1', '-i', raw, '-frames:v', '1', '-vf', "scale='min(1400,iw)':-2", '-q:v', '3', path], check=True)
    os.remove(raw)
    return Image.open(path).size

def run(key, code, picks, prefix=''):
    os.makedirs(os.path.join(OUT, key), exist_ok=True)
    items = album_items(code); got = []
    for n in picks:
        if n >= len(items): print(f'  {key}: item {n} not in album ({len(items)} items)'); continue
        url, w, h, vms = items[n]; name = f'{prefix}{n:03d}'
        # Clips up to a minute play as silent loops. Longer edits stay a still, taken from a frame of
        # the clip itself: Google's own thumbnail of a video has a play icon drawn on it (Oct 2: the
        # Terrarium newts video showed a play button that did nothing).
        still_from_video = vms > 60000
        if still_from_video: vms = 0
        path = os.path.join(OUT, key, name + ('.mp4' if vms else '.jpg'))
        if FORCE or not os.path.exists(path):
            if vms: size = save_video(url, path)
            elif still_from_video: size = save_video_still(url, path)
            else: size = save_photo(url, path)
        else:
            size = Image.open(path[:-4] + '.jpg').size
        got.append({'n': n, 'file': f'{key}/{name}' + ('.mp4' if vms else '.jpg'), 'poster': f'{key}/{name}.jpg' if vms else None,
                    'w': size[0], 'h': size[1], 'video': bool(vms)})
    print(f'{key}: {len(got)} items ({sum(1 for g in got if g["video"])} video)')
    return got

G = json.load(open(os.path.join(FIELD, 'data', 'gallery.json')))
man = {'above': [], 'daydreams': {}}
for src, s in G['above']['sources'].items():
    for g in run('above', s['album'], s['picks'], prefix=src[-1] + '-'):
        g['caption'] = s['captions'].get(str(g['n']), s.get('defaultCaption', '')); man['above'].append(g)
for s in G['daydreams']:
    man['daydreams'][s['key']] = {'picks': run(s['key'], s['album'], s['picks'])}
    if s.get('real'): man['daydreams'][s['key']]['real'] = run(s['key'], s['album'], s['real'], prefix='real-')
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print('manifest written')
