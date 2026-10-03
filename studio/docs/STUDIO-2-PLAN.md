# Studio 2: the drop-first note builder (plan)

The full plan, with requirements, information architecture, flows and diagrams, is the living doc
"Studio 2: the drop-first note builder" (Christian's Claude docs, Oct 3, 2026). That doc is the source
of truth; this file is the short version for Claude Code sessions working in this repo.

## The idea
Flip a Note from "fill in the fields" to "drop everything, then review": drop all the files from an
outing or event (Studio drop zone or a Google Drive folder), and the AI suggests the title, story,
layout and what's missing. Christian accepts, edits or turns down every suggestion; nothing is applied
silently. The look: a top-down view of a work table (family of the deep-sea and Workshop scenes).

## Flow
Drop -> privacy prep in the browser (EXIF removed, track trimmed) -> store on DreamHost -> AI brief ->
review -> build cards -> publish (live in about a minute). Upgrades loop: the brief writes animation
prompts and the episode script; Christian makes the animation or narration outside, drops it back at
its prompt, it's linked to its source and shows a green light, and becomes a card.

## The Note
- Assets: photos, videos, track, voice memos, screenshots, notes. Each has a light: grey waiting,
  amber needs a decision, green ready or upgraded.
- AI brief: basics (title, type, date, place), privacy flags with fixes (crop, blur, leave out; before
  and after), captions, animation prompts, links from web search (approved by hand), gaps and next steps,
  post and episode script, card plan.
- Cards (first set): Hero, Story, Route, Photo set (layout by count, 2-6), Single photo, Video (sound
  on or off, loop, trim), Prints on a table, Episode, Voice memo quote, Links; Event cards later.

## Where things run
- Browser: privacy prep, resizing, crop and blur on approval; later, MP4 compiling if needed.
- DreamHost (shared): Studio PHP, private storage (keys, zones, original uploads), the public site.
  No heavy jobs.
- GitHub: repo holds Note data, code, small images (no videos). Actions do video, audio mastering,
  transcription, rebuild Play and deploy.
- Claude API: the brief. It can't watch video or hear audio directly: it gets frames and transcripts.

## Phases
1. Drop, review, build: table home, one drop zone, files on DreamHost, AI brief with privacy check,
   card builder, animation upgrades with green light, Play renders cards, older Notes open as cards.
2. Media pipeline in Actions: video trims and loops, audio checked against the script and mastered
   (green light at the script), voice-memo transcription, frames and transcripts for video review.
3. Drive inbox pickup: each new subfolder becomes a draft Note.
4. More cards and designs: event cards, timelines, layouts, exact preview.

## Decided (Oct 3, 2026)
Studio drop zone or Drive folder; animations and narration made outside and brought back at their
prompt with a green light; large files on DreamHost, not GitHub; browser video compiling only if needed.

## Open
Crowd faces at concerts/events (blur by default, leave out, or allow when no one is the subject);
first event types; web search on every draft or on request; keep originals after cleaning; Drive
inbox shape (folder per Note or one dated drop folder).
