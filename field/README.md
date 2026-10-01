# Field Notes manager

`field/` is the working tool for adventures: one page per ride, hike or foraging walk, with the
route, the photos, the post draft, the episode script, and the audio prompt ready to copy.
Open `field/` on the site (it isn't linked from anywhere and asks search engines to stay away).
It's unlisted, not private: put a password on the folder in the DreamHost panel
(Websites → Manage → Protect a directory, or an `.htaccess` password) before drafts go up.

## How an adventure comes in

1. Christian drops the Cyclemeter export (GPX, plus the CSV if handy), photos, and a voice-note
   transcript in the Drive "Field notes inbox", then tells Claude "new field notes".
2. Claude runs:
   - `node field/tools/ingest.mjs ride.gpx --id 2026-10-04-prison-hill --title "…" --kind ride`
     to trim the track and create the event,
   - `python3 field/tools/photos.py <id> IMG_*.jpg --cover IMG_0412.jpg` to resize the photos and
     strip their location data,
   - then writes the post and the episode script into the event file, following `SHOW-GUIDE.md`.
3. Christian reviews it in the manager, copies the audio prompt, renders the voice, and drops the
   audio in the Drive folder. Claude checks it against the script (speech-to-text), masters it with
   `python3 field/tools/master.py in.wav field/data/audio/<id>.mp3` (needs `pip install numpy scipy
   soundfile pyloudnorm lameenc`): -16 LUFS, under -1 dBTP, 96 kbps mono MP3, and attaches it. Status moves Notes in → Draft → Script ready → Audio done → Published.

## Publishing

When Christian approves an adventure, its status becomes Published and Claude runs
`node field/tools/publish.mjs`. That rebuilds `notes/` at the site root (the public pages: an index,
one page per adventure, the route data, photos, audio, and `feed.xml`) from Published adventures
only, with public fields only. Unpublishing removes it on the next run. `data/show.json` → `listed`
controls whether search engines may index Notes (false = live but unlisted). The map and profile
code is shared with the manager in `js/route-view.js`. Upload `notes/` and `js/route-view.js`.

## Privacy

- **Tracks** are trimmed by `track.js`:
  - the drive home (or to the start) is detected by car speed and cut;
  - ends near a known trailhead (`data/trailheads.json`) are cut to start and end there;
  - ends inside a private zone are cut;
  - any other end loses its first and last 300 m.
- **Times** in the published track are seconds from the start, not clock times.
- **Private zones** are never in the published files. The manager keeps them in the browser's own
  storage (Check a ride → Private zones). `ingest.mjs` reads `field/private-zones.json`, which git
  ignores: `{"zones":[{"name":"Home","lat":0,"lon":0,"radius":500}]}`.
  The lasting copy is "Field Notes - private zones (do not share).json" in the root of Christian's
  My Drive (owner-only). A new session copies it to `field/private-zones.json` before ingesting.
- **Rides from home** (starting or ending at home) aren't used at all, even trimmed.
- **Photos** are re-saved with no EXIF at all, so no GPS, camera serial, or original timestamps.
  Only the time taken is kept, for ordering.

## Files

| Path | What it is |
|---|---|
| `index.html`, `field.js`, `field.css` | The manager page |
| `track.js` | GPX parsing, trimming, stats, elevation profile (browser and Node) |
| `data/events.json` | The card list (rebuilt by `ingest.mjs --reindex`) |
| `data/events/<id>.json` | One adventure: track, photos, field notes, post, episode |
| `data/photos/<id>/` | Processed photos |
| `data/trailheads.json` | Known trailheads (add from AllTrails or the land agency) |
| `data/show.json` | Show name, the audio prompt template, the status steps |
| `SHOW-GUIDE.md` | The rules for writing posts and episodes |
| `samples/sample-ride.gpx` | A made-up ride (with a drive home left on) for trying the checker |
