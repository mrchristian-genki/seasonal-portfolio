# Field Notes: show guide

The working rules for turning Christian's outings into posts and podcast episodes. Any Claude
session working on Field Notes reads this first, so every episode sounds like the same show.

## What the show is

A third-person account of Christian Gehrke's real, offline life outdoors in the high desert
and the Sierra: mountain bike rides, hikes, foraging for carnelians and pinyon
resin, and the things he makes from them (LED lamps and gifts), plus the prototypes he builds
with AI. The narrator is the "& Co.": a friend who came along and tells it afterwards.

Tone: warm, curious, a little dry. Positive, never fake. Semi-professional: facts are right,
numbers come from the track, and anything taught (gear, technique, rules) is accurate.

## Hard rules

1. **Only what happened.** Every fact comes from Christian's field notes, the GPX/CSV, or the
   photos. No invented people, wildlife, weather, dialogue or feelings. If a detail would help
   but isn't in the notes, ask; don't guess.
2. **Numbers from the track.** Distance, climbing, time and speeds come from the event's
   `track.stats`. Round them the way people say them ("about nine miles", "a thousand feet").
3. **No location trail home.** Never mention home, the street, the neighbourhood, or when the
   house is empty. Places are named at the trailhead or public-land level, never closer to home.
   Photos are stripped of GPS before they're added; tracks are trimmed (field/track.js).
4. **Other people stay anonymous** unless Christian says they're happy to be named. "Two other
   riders", "a man with a husky".
5. **Collecting is done right, and said so.** Rockhounding and resin: small amounts, personal use
   and gifts, from places it's allowed. Mention the rule when it comes up naturally; never imply
   selling what was collected.
6. **The positive filter** chooses which true things to tell. It doesn't change what's true. A hard
   climb is still hard; the story is how it went.
7. **The day job stays out.** Christian's employer is never named or described in the show.

## Rides from home

Rides that start or end at home aren't used as adventures at all, even trimmed: too close to home.
A ride that only finishes near home (like Clear Creek ending at James Lee Park) is fine; its map
stops at the edge of the home zone. The home zone itself lives only in Christian's private Drive
file and `field/private-zones.json` (gitignored), never in the site.

## Episode shape (2 to 5 minutes, about 300 to 750 words)

- **Cold open:** one line that puts us there (time, place, weather).
- **The outing:** two to four short beats from the notes, in order.
- **The find or the turn:** the resin, the stone, the view, the thing that went sideways.
- **What it becomes:** the project, the gift, the lesson, if there is one.
- **Out:** a light closing line. A running gag is fine (the tracker he forgets to stop).

Write for the ear: short sentences, no lists, no parentheses, numbers spoken in words.
`***` marks a longer pause. Use "Christian" and "he"; never "our hero" or "we".

## Post shape (the written version)

First person, Christian's voice, 150 to 600 words. Plain and specific. End with
**What I learned** when there's something real to say. Photos go in order with their captions.
Gear and how-to details (LED parts, wiring, resin prep) belong here, not in the episode.

## The audio

The audio prompt template is in `data/show.json` (`audioPrompt`), with voice, pace and
pronunciations. Christian renders the voice with his AI voice tool, masters it to
-16 LUFS integrated / -1 dBTP, and sends the file back to attach as `episode.audio`.

## Recurring cast and running threads

- **Marley:** Christian's dog (also in the lake scene). Only when Marley actually came along.
- **The tracker:** Cyclemeter, which he forgets to stop before driving home.
- **The lamp project:** resin and carnelian pieces lit with LEDs, made as gifts.
- **His wife:** drives the shuttle for point-to-point rides. OK to appear in photos; not named.
- **His brother and nephew:** from Buffalo, New York. First visit and first ride in years on Clear Creek (Sep 12, 2026). OK to appear in photos; not named.

Who's OK appearing (photos) or being named is recorded in each event's `consent` field. Ask before
anyone new appears.

Add to this list as threads build up, and keep a one-line log of each published episode below
so callbacks stay accurate.

## Episode log

| Date | Event id | Title | Threads |
|---|---|---|---|
| (sample) | sample-marlette | The resin at the top of the hill | tracker, lamp project |
| 2026-09-12 | 2026-09-12-evening-ride | Clear Creek after dark (draft) | brother and nephew's first ride; racing the light out of the alpine section; lights for the last stretch |
