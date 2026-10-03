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
`node field/tools/publish.mjs`. That rebuilds `play/` at the site root (the Play tab's Field Notes) (the public pages: an index,
one page per adventure, the route data, photos, audio, and `feed.xml`) from Published adventures
only, with public fields only. Unpublishing removes it on the next run. `data/show.json` → `listed`
controls whether search engines may index Play (false = live but unlisted). The map and profile
code is shared with the manager in `js/route-view.js`. Upload `play/` and `js/route-view.js`.

## Play's galleries

`data/gallery.json` lists Play's other sections: **Daily Dose of Paradise** (the newest videos from
the YouTube channel's public feed, read at publish time), **From Above** (drone photography) and
**Daydreams** (AI series, each labeled "Made with AI"; Carnelian splits real photos from imagined).
Each series names a shared Google Photos album and the item numbers to use. `python3
field/tools/gallery.py` fetches only those (photos 1400 px with no EXIF; clips up to 15 s as silent
960 px loops, longer edits as a still) into `data/gallery/`, and `publish.mjs` builds `play/above/`,
`play/daydreams/<series>/` and the hub at `play/`. Needs `pip install imageio-ffmpeg` for clips.

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

## Old photos on a table (animated prints)

For historic or archive photos brought to life with AI (Christian makes the clips; first used on
Marlette, Oct 3, 2026). Two to four short clips sit together as mounted prints on a wooden table,
each turned a little and drifting on its own slow rhythm; phones stack them. Styles live in
`play/play.css` and, for the homepage pop-up, `css/play-inline.css`.

1. Prepare each clip as a silent, seamless 24 fps loop about 480 px tall (crossfade the last 0.6 s
   into the start; see the ffmpeg line in the Oct 3 commits) plus a poster `.jpg`, saved as
   `field/data/photos/<id>/hist-N.mp4` / `.jpg`.
2. Add each to the event's `photos` with `"video": true, "ai": true, "table": "history"`,
   `"after": <paragraph index, 0-based>`, a short `caption` (it's written on the print, so keep it
   to a few words), `w`/`h`, and on the first one a `tableCaption` that credits the photographers.
3. The figure is labeled "Animated with AI". Animate only what's in the photo (water, wind, a wave
   from someone already there); never add people, and leave out images that look AI-made.
4. Replacing a clip under the same name is fine: clip links carry a size-based `?v=` tag.

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
