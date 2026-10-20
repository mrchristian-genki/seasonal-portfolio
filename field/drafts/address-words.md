# What the address carries, page to page

Mapped Oct 20, 2026, when Christian found the look he'd set on Home gone after a trip to Books and back.
The rule since then: **no data holes**. Whatever a visitor sets travels with them to every page and back.

## The two kinds of words

The address after `?` is words joined by `+`, in any order.

**The look** is what a visitor sets on the lake. It travels to every page (`js/carry.js`):

| Words | Means | Set by |
|---|---|---|
| `spring` `summer` `fall` (`autumn`) `winter` | the season, when one was picked | the season wheel (`js/scene.js`) |
| `night` (`dark`, `nightmode`, `darkmode`), `day` | night mode | the Night mode button (`js/scene.js`) |
| `ylake` `nlake` | the lake shown or closed | the lake's bar (`js/lake.js`) |
| `drizzle` `shower` `tempest`, `flurries` `snow` `blizzard` (and older aliases) | the weather | a link that asks for it (`js/scene.js` STORM_LEVELS) |

**The place** is where the visitor is. It belongs to one page and doesn't travel:

| Page | Words | Owner |
|---|---|---|
| the lake page `/` | `home` `web` `workshop` `lab` | `js/scene.js` (VIEW_WORD) |
| | Play's sections `notes` `dose` `above` `daydreams` `newsstand`, a Note or series id, `grid` `list` `oldest` `p2`, tags | `js/play-inline.js` |
| | a Workshop project's slug | `js/ws-cards.js` |
| | `about`, `beach` | `js/about.js`, `js/getaway.js` |
| | `bench` `fps` `wildlife` `diag`, animal names | test tools, `js/wildlife.js` |

## How the look travels

- On the lake page, each script writes its own words into the address and leaves the others alone. `js/scene.js`
  rebuilds the address on a tab, season or night change, keeping the lake's, Play's and the Workshop's words.
- `js/carry.js` (on every page, in the head) adds the look to any link to another of the site's pages as it's
  followed. A word the link already names stays the link's. It also keeps the look in the tab's session, so a page
  reached by `location.href` (the village's doors) or typed in still gets it.
- A page with no lake (Books, Play's pages, the Tumble, About, Privacy) shows the season and night where its styles
  follow `html[data-season]` and `html.night-page`, and writes the look into its own address, so Back, a reload and
  a copied link keep it.
- A link to the lake page with no section gets `home` (a season alone there opens the section it used to mean:
  `?fall` is Web, `?winter` is Workshop, old links).
- Home names itself: `?home+fall+night`, like `?web+fall+night`.

## Pages

| Page | Lake | Look shown | Look carried |
|---|---|---|---|
| `/` Home, Web, Workshop, Play tabs | yes | all of it | yes |
| `coloring-books/` Books | no | logo, shelf | yes |
| `play/…` Play's pages (built by `field/tools/publish.mjs`) | the lake strip | logo, lake strip | yes |
| `web/` the Tumble | no (its own era look) | no | yes |
| `about/`, `privacy/` | no | logo | yes |
| `books/` catalog, `studio/`, `field/` | not ours to carry into | | no |

## Still open

- Books and Play's pages don't go dark at night beyond the logo (and the lake strip on Play's pages). Christian
  wants Books to have the same shell as the other sections: the main and sub nav, the lake, the weather, night and day.
- Weather started by hand (not from the address) isn't written into the address, so it doesn't travel.
