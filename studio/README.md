# Studio

The private admin for Field Notes, at https://www.christiangehrke.com/studio/ (first version: Oct 3, 2026).

Log in, then:
- **New entry**: title, date, kind, place.
- **Track**: drop the Cyclemeter GPX or CSV. It's trimmed in the browser with `field/track.js`
  (driving, trailheads, private zones, the 300 m fallback), so the raw track never leaves the device.
  A track that starts or ends at home is flagged (rides from home are told views-only).
- **Photos**: drop them in. Each is drawn upright into a canvas at 1600 px and re-saved as JPEG, so
  location data, camera serials and every other EXIF field are gone before upload. Only the time taken
  is kept (read in the browser) for ordering.
- **Your notes**: what happened, in your words.
- **Draft with Claude**: sends the notes, the track's figures, photo times and small copies of the photos
  to Claude (`claude-opus-5-5`) with `field/SHOW-GUIDE.md` as the rules. Fills in the summary, post,
  episode script, captions and the open questions. An optional instruction ("shorter", "add the hammock")
  revises the current draft.
- **Save**: one commit to `main` in the seasonal-portfolio repo (`field/data/events/<id>.json` and
  `field/data/photos/<id>/`). Set Status to **Published** and save to put it live: the deploy workflow
  rebuilds Play and uploads it in about a minute.

- **Bring in from Drive** (top of the list): copies new files from the Google Drive folder `Rides` (at
  the top of My Drive) to the server with rclone, in the background. One way only, never deletes anything on either side, and
  skips files it already has, so pressing it again only fetches what's new. Files land in
  `~/incoming/Rides/` on DreamHost, outside the web folder, so none of it is public. Phone or Drive app
  uploads of any size work, since nothing passes through the browser.
- **The inbox list** (under the Drive button): one row per folder in `Rides`, with its date, what's in it
  (photos, videos, track, notes) and where it stands: **New**, the note's status (Draft, Published…), and
  **N new since** when files arrived after the note was made. Loose files outside a folder are left off
  until they belong to a note. A folder is matched to a note it was processed into, or to a note on the
  same date.
- **Process** (on a New folder): opens a new entry filled from the folder: title and date from the folder
  name (e.g. `2026-10-03 1630 Peavine loop`; else the photos' date), photos through the same resize and
  location-stripping step, the GPX/CSV track trimmed in the browser, and any `.txt`/`.md` as your notes;
  then Claude drafts it. Read it through and Save; the folder then shows as that note. Videos are listed
  as waiting for the video step and stay on the server.
- **Add N new** (on an updated folder): opens the note and brings in just the files that came later.

- **The loader**: while the Studio works, the reactor panel fills with the real progress: the empty
  reactor is the backdrop, and a short loop of the full, bubbling tube (`assets/loader/reactor-loop.mp4`,
  WebM fallback, 90 KB) plays over it, cut to the glass up to the fuel level, its glow coming up with it.
  The scale, status tag and plaque are drawn over it in CSS.

- **The header** is the river table: a looping video of the glowing river, blue (`table/a/river-blue-day|night`),
  green (`river-day|night`) or orange (`river-orange-day|night`), with Marley's visits on top. Two small controls
  on the STUDIO panel work it (`table/toggle.js`, drawn in CSS): DAY/NIGHT, a bat-handle toggle between an amber
  and a blue pilot lamp, plays the dusk or dawn clip; CHANGE LIQUID, a toggle by three lamps, moves the liquid on
  one way round (blue, green, orange, blue), playing the change clip (`river-day|night-to-green` for blue to green;
  green to orange and orange to blue have no header footage yet and blend). While the river changes, the lamp it's
  going to breathes and a hairline slot fills; both wait until it's done. The bank's glass tube is off by day and
  lit at night in the liquid's colour, and the gauge's face matches (painted into the clips). The liquid is kept on
  the device and in the address (`#notes/night-orange`). The footer is a glowing pipe in the crack between two
  planks (`table/foot.js`, clips `foot-*`), the same liquid flowing right to left, following every change with its
  own clips (the video only loads once the footer comes near the screen).

Not in the Studio yet: episode audio (render it, then hand it to a Claude Code session to master and
attach), animated clips and the prints-on-a-table layout.

## How it's built

| Path | What it is |
|---|---|
| `index.php` | Login and the page |
| `api.php` | JSON API for the page: config, list, entry, photo, blob, save, draft. Login and CSRF on every call |
| `lib/bootstrap.php` | Private config, session (secure cookie, idle timeout), login throttle (5 tries per 15 min), headers |
| `lib/github.php` | Reads and commits to the repo through the GitHub API |
| `lib/drive.php` | Bring in from Drive: starts `rclone copy` in the background and reads back its log |
| `lib/video.php` | Video loops: ffmpeg makes a small preview of a Drive video, then cuts the chosen part into a silent loop |
| `lib/drafter.php` | The Claude call (official Anthropic PHP SDK, structured output, server-side fallback) |
| `assets/studio.js`, `assets/studio.css` | The page. `assets/track.js` is copied from `field/track.js` at deploy |
| `tools/setup.php` | One-time setup over SSH; writes the private config |
| `composer.json` / `.lock` | The SDK (installed by the deploy workflow; `vendor/` isn't in git) |

Nothing is stored on the web server except what "Bring in from Drive" copies to `~/incoming`. The private settings live in `~/studio-private/config.php` on
DreamHost (outside the web folder, mode 600): the password hash, the Anthropic API key, the GitHub token
(fine-grained, this repo only, Contents read/write) and the private zones.

## Setup (once)

1. Create a GitHub fine-grained token: github.com → Settings → Developer settings → Fine-grained tokens →
   Generate. Repository access: only `mrchristian-genki/seasonal-portfolio`. Permissions: Contents → Read and
   write. Expiry: up to a year (set a reminder).
2. Have to hand: the Anthropic API key, the token, and the contents of "Field Notes - private zones (do not
   share).json" from Drive.
3. Run, and answer the questions (nothing you type is shown):
   ```
   ssh -t adapt123@pdx1-shared-a1-09.dreamhost.com "php christiangehrke.com/studio/tools/setup.php"
   ```
   Run it again any time to change one value; Return keeps the others.

## Google Drive (once)

1. Install rclone on DreamHost:
   ```
   ssh adapt123@pdx1-shared-a1-09.dreamhost.com
   mkdir -p ~/bin && cd ~/bin
   curl -LO https://downloads.rclone.org/rclone-current-linux-amd64.zip
   unzip -j rclone-current-linux-amd64.zip '*/rclone' && rm rclone-current-linux-amd64.zip
   ~/bin/rclone version
   ```
2. `~/bin/rclone config`: `n` (new remote), name `gdrive`, storage `drive`, client id and secret blank,
   scope `2` (read-only), service account blank, advanced `n`, auto config `n`. It prints a line starting
   `rclone authorize "drive"`: run that on the Mac (`brew install rclone` first if needed), sign in to
   Google in the browser that opens, and paste the code back. Shared drive `n`, then `y` to keep it.
3. The watched folder is `Rides` at the top of My Drive (starred, so it shows first in the Drive app).
4. Test from SSH: `~/bin/rclone lsd gdrive:Rides`.

To watch more folders later (the AI content, phase 2), add them to the private config, e.g.
`'drive_folders' => ['Rides', 'Studio'],`. Optional settings: `'rclone'` (path) and `'drive_remote'`.
The copy's log is `~/studio-private/drive-sync.log`.

## Video loops (once)

The videos that come in from Drive stay on the server. In a note, **Video loops** makes a small preview of
one to scrub through, and cuts the part you choose (30 seconds at most) into a silent loop: 960 px on the
long edge, H.264, with a poster frame; iPhone HDR is toned to ordinary colour. The loop is committed with
the next Save and plays in place in the post, like the other clips. It needs ffmpeg on DreamHost:
```
ssh adapt123@pdx1-shared-a1-09.dreamhost.com
mkdir -p ~/bin && cd ~/bin
curl -LO https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar xJf ffmpeg-release-amd64-static.tar.xz --wildcards --strip-components=1 '*/ffmpeg' && rm ffmpeg-release-amd64-static.tar.xz
~/bin/ffmpeg -version | head -1
```
Optional setting: `'ffmpeg'` (path). Its work sits in `~/studio-private/video` and is cleared after two weeks.

## HDR from a drone's bracket

When photos come in (from Drive or dropped), shots taken within 3 seconds of each other are checked as a
possible exposure bracket (the DJI's dark, normal and bright shots). If they're one view at different
exposures, `assets/hdr.js` lines them up and merges them into one photo by exposure fusion, in the browser;
only the merge is kept (marked "HDR of 3"). Anything else stays separate, and a picture already merged
elsewhere (its name says HDR) is left as it is.

## People and review

Everyone logs in with a username and password. The owner's username is `christian` (or `owner`; setup.php
can set another, `'owner_user'`) with the password in the private config (`'owner_name'` sets the name
shown). Under **People** on the notes list the owner adds **editors**: each gets a username made from
their name and their own password, shown once, to send them privately. Editors can make and change notes, bring in from Drive, draft with Claude and make loops,
but they can't publish, take a post down or change what's live: their saves go to a branch of the repo,
`review/<id>`, which the deploy never builds. The owner sees them under **Ready for review** and on the
note: **Approve** merges the branch in (a live post updates a minute later), **Send back** shows the
editor a note, **Discard** deletes the branch. The owner saving a note that waits for review takes the
review in too. Editors and their password hashes are in `~/studio-private/users.json`; the review states
in `~/studio-private/reviews.json`. Removing an editor logs them out at once.

## For Claude Code sessions

Entries saved in the Studio land on `main`, so start from the latest `main`. Field Notes still works the
old way too (`ingest.mjs`, `photos.py`, `publish.mjs`); both write the same files.
