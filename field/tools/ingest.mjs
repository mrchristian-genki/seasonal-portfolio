#!/usr/bin/env node
/* Add (or refresh) an event's track from a Cyclemeter export (GPX, or the point-by-point CSV).

     node field/tools/ingest.mjs ride.gpx --id 2026-09-27-marlette --title "Up to Marlette Lake" \
          [--kind ride|hike|forage (default: from the file)] [--place "Lake Tahoe Nevada State Park"] [--status notes]

   Trims the track (driving, trailheads, private zones; see field/track.js), then writes
   field/data/events/<id>.json and updates field/data/events.json. Re-running on an existing event
   replaces only its track and stats; the post, script, photos and status are kept.
   Private zones come from field/private-zones.json ({"zones":[{"lat":..,"lon":..,"radius":400}]}),
   which git ignores and is never uploaded.

     node field/tools/ingest.mjs --reindex      rebuild events.json from every event file
                                                (after adding photos or editing an event by hand) */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIELD = path.resolve(here, '..');
const Track = createRequire(import.meta.url)(path.join(FIELD, 'track.js'));

const args = process.argv.slice(2);
const gpx = args.find((a) => !a.startsWith('--') && /\.(gpx|csv|txt)$/i.test(a));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

// Index: the card-level fields for every event, newest first.
function reindex() {
  const dir = path.join(FIELD, 'data/events');
  const events = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJSON(path.join(dir, f), null)).filter(Boolean);
  const card = (e) => ({ id: e.id, title: e.title, date: e.date, kind: e.kind, place: e.place, status: e.status, summary: e.summary, sample: !!e.sample,
    stats: e.track ? e.track.stats : null,
    thumb: e.track ? Track.simplify(e.track.line.filter(Boolean).map((p) => ({ lat: p[0], lon: p[1] })), 25).map((p) => [p.lat, p.lon]) : [],
    photos: (e.photos || []).length, cover: ((e.photos || []).find((p) => p.cover) || (e.photos || [])[0] || {}).src || null });
  const idx = { events: events.map(card).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) };
  fs.writeFileSync(path.join(FIELD, 'data/events.json'), JSON.stringify(idx, null, 1) + '\n');
  return idx.events.length;
}
if (args.includes('--reindex')) { console.log('events.json: ' + reindex() + ' events'); process.exit(0); }
if (!gpx) { console.error('Usage: ingest.mjs <file.gpx|file.csv> --id <id> --title "<title>" [--kind ride] [--place ""]'); process.exit(1); }

const trailheads = readJSON(path.join(FIELD, 'data/trailheads.json'), { trailheads: [] }).trailheads;
const zones = readJSON(path.join(FIELD, 'private-zones.json'), { zones: [] }).zones;
const built = Track.build(fs.readFileSync(gpx, 'utf8'), { kind: opt('kind', null), trailheads, privateZones: zones });
const kind = built.kind;   // --kind, else what Cyclemeter recorded, else ride
const date = (built.stats.start || new Date().toISOString()).slice(0, 10);
const id = opt('id', date + '-' + kind);
const file = path.join(FIELD, 'data/events', id + '.json');
const prev = readJSON(file, {});
const th = trailheads.find((t) => t.id === built.trim.startTrailhead);

const ev = {
  id,
  title: opt('title', prev.title || built.name || 'Untitled ' + kind),
  date: prev.date || date,
  kind,
  place: opt('place', prev.place || (th && th.area) || ''),
  status: opt('status', prev.status || 'notes'),
  summary: prev.summary || '',
  trailhead: built.trim.startTrailhead,
  links: prev.links || (th && th.source ? [{ label: th.name, url: th.source }] : []),
  track: { stats: built.stats, line: built.line, profile: built.profile, trim: built.trim },
  photos: prev.photos || [],
  fieldNotes: prev.fieldNotes || '',
  post: prev.post || { title: '', body: '' },
  episode: prev.episode || { title: '', script: '', audio: null }
};
fs.writeFileSync(file, JSON.stringify(ev, null, 1) + '\n');

reindex();

console.log(`${id}: ${built.stats.distanceKm} km, +${built.stats.gainM} m, ${built.line.length} map points (from ${built.trim.rawPoints})`);
built.trim.notes.forEach((n) => console.log('  - ' + n));
if (!zones.length) console.log('  (no private zones set: add field/private-zones.json to cut around home)');
