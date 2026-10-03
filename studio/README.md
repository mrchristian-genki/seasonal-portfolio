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

Not in the Studio yet: episode audio (render it, then hand it to a Claude Code session to master and
attach), animated clips and the prints-on-a-table layout.

## How it's built

| Path | What it is |
|---|---|
| `index.php` | Login and the page |
| `api.php` | JSON API for the page: config, list, entry, photo, blob, save, draft. Login and CSRF on every call |
| `lib/bootstrap.php` | Private config, session (secure cookie, idle timeout), login throttle (5 tries per 15 min), headers |
| `lib/github.php` | Reads and commits to the repo through the GitHub API |
| `lib/drafter.php` | The Claude call (official Anthropic PHP SDK, structured output, server-side fallback) |
| `assets/studio.js`, `assets/studio.css` | The page. `assets/track.js` is copied from `field/track.js` at deploy |
| `tools/setup.php` | One-time setup over SSH; writes the private config |
| `composer.json` / `.lock` | The SDK (installed by the deploy workflow; `vendor/` isn't in git) |

Nothing is stored on the web server. The private settings live in `~/studio-private/config.php` on
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

## For Claude Code sessions

Entries saved in the Studio land on `main`, so start from the latest `main`. Field Notes still works the
old way too (`ingest.mjs`, `photos.py`, `publish.mjs`); both write the same files.
