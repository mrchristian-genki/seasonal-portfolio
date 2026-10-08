"""The Workshop tab's project windows read like a magazine feature (js/ws-cards.js): each one is a project's case study
from Play, set as a column. This writes assets/workshop/projects.json from the Notes (field/data/events), so the file is
output: never edit it by hand. publish.mjs runs this at the end of every build (and so does the deploy).

A Note is a project when it has a "workshop" object and is Published. Everything the feature shows comes from that Note
and is edited in the Studio (the note's Workshop feature panel):
  workshop.order     its place on the tab (1 first)
  workshop.name      the card's name, and workshop.tagline under it
  workshop.pull      the pull quote, set after the second paragraph
  workshop.numbers   "By the numbers": [["124", "video files behind one header"], ...]
  workshop.links     the buttons: [{"label", "url"}, ...] (the first is the tool, the second another link)
  workshop.cover     the file name of the photo or loop on the card and at the top (else the Note's cover)
  workshop.media     the feature's pictures in order: {"photo": "<file name in the Note>"}, with "after": N to set it right
                     after paragraph N (counting from 1; else they're spread evenly), "off": true to leave it out,
                     "caption" to say it differently here, and "note": "<id>" for a picture from another Note. A loop's
                     poster frame (its .jpg) can stand in as a still. The Note's other photos and loops join at the end.
The headline and story are the Note's post (title, and its paragraphs); the deck is its summary; the date is its date.
Photos and clips are named as publish.mjs publishes them to play/media.

  python3 field/tools/wsprojects.py
"""
import datetime, json, os


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


def by_name(e):
    """a Note's published pictures by their file name in the Note; a loop's poster frame (its .jpg) as a still too"""
    out = {}
    for ph, m in zip((x for x in e.get('photos') or [] if x.get('use') != 'skip'), published(e)):
        out[ph['src'].split('/')[-1]] = m
        if ph.get('video') and ph.get('poster'):
            out.setdefault(ph['poster'].split('/')[-1], {'type': 'image', 'src': m['poster'].split('?')[0][:-4] + '.jpg', 'caption': m['caption']})
    return out


ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
EVENTS = os.path.join(ROOT, 'field', 'data', 'events')
OUT = os.path.join(ROOT, 'assets', 'workshop', 'projects.json')


def load(i):
    try: return json.load(open(os.path.join(EVENTS, i + '.json'), encoding='utf-8'))
    except (OSError, ValueError): return None


notes = [e for e in (load(f[:-5]) for f in sorted(os.listdir(EVENTS)) if f.endswith('.json') and not f.startswith('sample'))
         if e and isinstance(e.get('workshop'), dict) and e.get('status') == 'published']
notes.sort(key=lambda e: (e['workshop'].get('order') or 999, e['id']))
projects = []
for e in notes:
    w, post, mine = e['workshop'], e.get('post') or {}, by_name(e)
    alias = {x['poster'].split('/')[-1]: x['src'].split('/')[-1] for x in e.get('photos') or [] if x.get('video') and x.get('poster')}
    media, seen = [], set()
    for x in w.get('media') or []:
        if not x.get('note'): seen.add(alias.get(x.get('photo'), x.get('photo')))
        if x.get('off'): continue
        other = load(x['note']) if x.get('note') else e
        m = (by_name(other) if other is not e else mine).get(x.get('photo')) if other and other.get('status') == 'published' else None
        if not m: print(f"  {e['id']}: no published picture {x.get('note', '') + '/' if x.get('note') else ''}{x.get('photo')}, left out"); continue
        m = dict(m)
        if x.get('caption'): m['caption'] = x['caption']
        if x.get('after'): m['after'] = int(x['after'])
        media.append(m)
    for ph in (x for x in e.get('photos') or [] if x.get('use') != 'skip'):
        n = ph['src'].split('/')[-1]
        if n not in seen: media.append(dict(mine[n]))   # a new picture on the Note joins the column
    cov = next((x for x in e.get('photos') or [] if x.get('use') != 'skip' and x.get('cover')), None)
    card = mine.get(w.get('cover') or '') or (cov and mine.get(cov['src'].split('/')[-1])) or (media[0] if media else None)
    links = [l for l in w.get('links') or [] if l.get('label') and l.get('url')]
    d = datetime.date.fromisoformat(e['date'])
    p = {'id': e['id'], 'name': w.get('name') or e.get('title') or e['id'], 'tagline': w.get('tagline') or '', 'summary': e.get('summary') or '',
         'date': f"{d:%a}, {d:%b} {d.day}, {d.year}", 'note': f"play/{e['id']}/", 'tool': links[0] if links else None,
         'card': card and {k: v for k, v in card.items() if k != 'after'}, 'media': media}
    if len(links) > 1: p['extra'] = links[1]
    if w.get('pull'): p['pull'] = w['pull']
    if w.get('numbers'): p['numbers'] = [[str(a), str(b)] for a, b in w['numbers']]
    p['title'] = post.get('title') or e.get('title') or p['name']
    p['story'] = [s.strip() for s in (post.get('body') or '').split('\n\n') if s.strip()]
    projects.append(p)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(projects, f, indent=1, ensure_ascii=False)
    f.write('\n')
print(f"assets/workshop/projects.json: {len(projects)} projects from their Notes ({', '.join(p['name'] for p in projects)})")
