# Pando

A mobile-first web app for comparing the current time across up to six cities.

Drag the 24-hour dial to ask "what time is it there when it's 3pm here"; every city derives
from the one marked **home**. A month selector recomputes real daylight saving for any date,
so you can check what a call looks like after the clocks change.

**[Open it →](https://halleybennett.github.io/pando/)** · add it to your home screen and it
works offline.

---

## How it works

- **No API, no server, no accounts.** Times come from the browser's own IANA timezone
  database via `Intl.DateTimeFormat`, which applies daylight saving for any date for free.
- **11,486 cities ship with the app** — a trimmed GeoNames extract (name, country, IANA
  zone), 247KB raw / 89KB gzipped. Search works with no network.
- **State lives in `localStorage`.** Cities, home order and 12/24h always come back; the dial
  position and chosen month only if you were last there within the hour.
- **A service worker** precaches the shell and the city data, so it runs with the network off.
- **Light and dark**, following `prefers-color-scheme`. Every UI colour is sampled from the
  colours the time-picker wheel itself paints.

Plain HTML, CSS and JavaScript. No build step, no dependencies, no framework.

## Running it locally

```
cd app && ./start.sh          # serves on :8020 and opens Chrome
```

```
./start-docs.sh               # the design documents, on :8021
```

## What's in here

| | |
|---|---|
| `app/` | the app |
| `design-kit.html` | the design system — colour, type, spacing, components, the mark |
| `PLAN.md` | every decision and why, including the ones that were rejected |
| `tools/a11y-audit.py` | audits both colour schemes against the real tokens |
| `tools/make-icons.py` | renders the app icons from the mark |
| `*.html` at the root | the prototypes each decision was made on |

## Credits

City data from [GeoNames](https://www.geonames.org/), CC BY 4.0.

Named after [Pando](https://en.wikipedia.org/wiki/Pando_(tree)), a colony of some 47,000
quaking aspen in Utah that share a single root system and are, genetically, one organism.
The mark is three of its trees and the root that joins them.
