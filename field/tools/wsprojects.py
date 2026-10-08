"""The Workshop tab's project windows read like a magazine feature (js/ws-cards.js): each one is the project's case study
from Play, set as a column. This copies each case study's headline and story from its Note (field/data/events) into
assets/workshop/projects.json, so the windows stay in step when a Note changes, and adds any of the Note's photos
and clips the project doesn't have yet (named as publish.mjs publishes them to play/media), so a new picture on the
Note joins the column. What is written by hand in projects.json stays as it is: the pull quote ("pull"), the numbers
("numbers"), the clips already chosen and their order, and the links.

  python3 field/tools/wsprojects.py
"""
import json, os


def b36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'; out = ''
    while True:
        n, r = divmod(n, 36); out = d[r] + out
        if not n: return out


def published(e):
    """the Note's photos and clips as publish.mjs names them: play/media/<id>/NN.jpg, or NN.mp4 with its poster and tag"""
    out, F = [], os.path.join(ROOT, 'field')
    for i, ph in enumerate(x for x in e.get('photos') or [] if x.get('use') != 'skip'):
        base = f"play/media/{e['id']}/{i + 1:02d}"
        if ph.get('video'):
            tag = '?v=' + b36(os.path.getsize(os.path.join(F, ph['src']))) + b36(os.path.getsize(os.path.join(F, ph['poster'])))
            out.append({'type': 'video', 'src': base + '.mp4' + tag, 'poster': base + '.jpg' + tag, 'w': ph.get('w'), 'h': ph.get('h'), 'caption': ph.get('caption', '')})
        else:
            out.append({'type': 'image', 'src': base + '.jpg', 'caption': ph.get('caption', '')})
    return out

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'assets', 'workshop', 'projects.json')

projects = json.load(open(OUT, encoding='utf-8'))
for p in projects:
    e = json.load(open(os.path.join(ROOT, 'field', 'data', 'events', p['id'] + '.json'), encoding='utf-8'))
    post = e.get('post') or {}
    p['title'] = post.get('title') or e.get('title') or p['name']
    p['story'] = [s.strip() for s in (post.get('body') or '').split('\n\n') if s.strip()]
    have = {m['src'].split('?')[0] for m in p['media']}
    new = [m for m in published(e) if m['src'].split('?')[0] not in have]
    p['media'] += new
    if new: print(f"  {p['id']}: {len(new)} new from its Note")
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(projects, f, indent=1, ensure_ascii=False)
    f.write('\n')
print(f'{len(projects)} projects: stories copied from their Notes')
