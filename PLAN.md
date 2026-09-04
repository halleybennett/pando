# Pando — build plan

A mobile-first app for comparing the current time across up to 6 cities, with a
spinnable dial for "what time is it there when it's X here" and a month selector
that accounts for daylight saving.

---

## ⏭ Pick up here

**Read this block, then the *Next version* section. Everything else is reference.**

Pando is a mobile-first web app for comparing the time across up to six cities, on a draggable
24-hour dial, with a month selector that applies real daylight saving. Plain HTML/CSS/JS — no
build step, no dependencies, no server, no accounts.

| | |
|---|---|
| **Live** | https://halleybennett.github.io/pando/ |
| **Repo** | `github.com/halleybennett/pando` — public, `main`, Pages from root |
| **Run the app** | `cd app && ./start.sh` → :8020 |
| **Run the design docs** | `./start-docs.sh` → :8021 *(needed — some frame the real app)* |
| **Check colour** | `python3 tools/a11y-audit.py` — reads the real tokens, audits both schemes |
| **Ship a change** | `./tools/release.sh "message"` — stamps the build, audits, commits, pushes |

**Status: built, shipped and in daily use.** Phases 0–6 are done — cities, dial, DST, persistence,
offline PWA, light + dark, mark, icon, hosting. Nothing is half-finished and nothing is broken.

**So there is no "next task" — there is a list of things Halley wants better.** They are in
**## Next version**, each with the measurements and the reasoning, in the order she raised them.
Nothing there is scoped or scheduled; ask which one she wants before starting.

**Three things that will bite you if you do not know them:**
- **`reference/` is gitignored and must stay so.** Frames from a video of someone else's app; a
  public repo is publication.
- **The mark exists in two versions on purpose** — see *The mark and the icon* below. It looks like
  drift and is not.
- **Do not reintroduce a speed-sensing "slow drag".** Three attempts failed for the same structural
  reason; see *Slow-drag fine adjust* under Locked decisions.

**Open, not urgent:**
- Zone abbreviations fall back to country names for most cities; a small hand-map (`JST`, `WAT`,
  `HST`…) would read better.
- The Nov 1 DST edge case still needs a decision — see *Technical notes*.
- The dial has no keyboard/VoiceOver path. Accepted deliberately; see *Known accepted gaps*.
- The 16px mark has a 0.2-unit stalk/soil overlap where it should have a gap. Invisible at that
  size; the icon derives its gap from the stroke weights instead.

---

## The mark and the icon

**The mark is replaced — decided 4 Sept 2026.** The three-stalk mark is retired: it read as
candles, because three separate stalks standing next to each other are three objects, not a plant.
The new mark is **a grove joined by a root** — three aspen at uneven heights, the outer stems
turning into lateral roots reaching for the edge, the centre stem running deeper and forking
beneath them. Which is what Pando is: one organism sharing one root system, the trees being only
what you can see of it. Leaves are asymmetric with a single midrib; the earlier full vein fan was
noise below about 120px.

**Two versions, for two jobs — this is deliberate, not a loose end.**

| | where | what differs |
|---|---|---|
| **icon** | `tools/make-icons.py` | full roots on all three trees, midribs visible, centre root at **26** either side (V2b — a pronounced overhang, so the two root levels stay separable as the tile shrinks) |
| **header** | `markSVG()` in `app/app.js` | outer stems bare, only the centre forks. Midribs dropped. At 16px the two-line root system is a **0.37px** stroke and mushes; one forked line does not |

Baked path data in `app.js` rather than a generator — none of it varies at runtime. The parametric
source, with the sliders it was tuned on, is `icon-current.html`.

**The icon is V2b:** the wheel's own gradient full-bleed at 135°, a white circle punched out at
**0.43**, the grove inside at 0.69 of the cutout. The gradient samples `ramp()` midnight→noon, so
the tile and the dial are literally the same colours — an earlier version used the *page tint*
(`#eaeefb → #fbf0d2`, Sky whitened for text), which is far paler and was wrong.

**Icon pages:** `icon-current.html` is the only live one; every other icon/mark page carries a
superseded banner pointing at it, and `icon-v2-and-header.html` is a redirect.

---

## The colour system, as shipped

**THE RULE:** every UI colour — the add button, the sun, the moon, the home chip — **must be a
colour the time-picker wheel actually paints.** In dark they are not chosen at all, they are
*sampled* from the wheel with the same treatment it uses, so they cannot drift. Three candidates
died on this rule: Posie, an amber chip, and a lifted Klein — each a colour that existed nowhere
else on screen. **One exemption, deliberate:** the sun's Amber outline. Noon on a white card
measures **1.57** and the disc vanishes; no wheel stop can do that job.

| | light | dark |
|---|---|---|
| **ground** | Sky, 135° `#eaeefb → #fbf0d2` | Sky at night, `#080c26 → #241a33` |
| **card** | `#ffffff` | `#2a2456` |
| **ink / muted** | `#14161a` / `#6e6874` | `#f1f0f6` / `#a9a5c4` |
| **action + moon** | Klein `#0d21a5` | `#c0cdf7` — the wheel at 06:30 |
| **sun + home chip** | Noon `#f7c948` + Amber edge / Dawn `#8ba2f0` | `#fbe29c` — the wheel at noon |
| **hour ticks** | `#79717e` / `#aea7b3` | `#7d76b0` / `#514d88` |
| **wheel** | soft — 46% toward white | soft — 46% toward white |

**RESERVE — the bright wheel.** Exact values, in case it is wanted once live:
`--ramp-mode:lift`, `--ramp-ceil:0.88`, floor **0.68 light / 0.70 dark** (0.68 is the light
ceiling — at 0.70 the night band measures 2.92 against a 3.0 floor). The dark UI colours must be
re-sampled from the bright wheel, because they *are* wheel colours: action + moon `#a7bfff`,
sun + chip `#f9cb4a`. Light's UI colours are the raw stops and do not change between the two.

**Accessibility, audited 4 Sept — everything passes.** Run `python3 tools/a11y-audit.py`; it
reads the tokens out of `app/styles.css` so the numbers cannot drift. The tightest things in the
app are the **dial's hour numerals** and the **footer**, both **4.65** against a 4.5 floor — the
dial's own city label is 5.39. Two items sit below and are handled rather than ignored:

- **The `12H · 24H` separator** is `--muted` at 45%, an effective **1.90**. It is a dot between
  two labels and carries no meaning, so it is exempt and recorded as such.
- **The already-added search row** was `opacity:.4`, which put "added" at **1.75**. Opacity could
  not fix it — even at 85% it only reaches 3.90, because it is fading a colour that starts at
  5.39. It is now quietened by **colour hierarchy instead**: the city name drops from ink to
  muted. The row still reads as unavailable and every part of it clears 4.5.

**Dial text bumped, 4 Sept.** The home-city label inside the dial went **10px/300 → 11px/400**
and the `12H · 24H` toggle **11px → 12px**. Both passed contrast comfortably (5.39) — the problem
was that they read as watermarks, and "light" there was weight as much as size. The 3.5px gap
under the city label is unchanged, and everything still sits well inside the dial face.

**Header, 4 Sept.** Weight **300 → 400** on the brand and the date control: at 12px uppercase with
0.2em tracking, 300 reads as a whisper. Colour is untouched, so the two still match in every state.
The mark is now **baseline-aligned** to the wordmark rather than centred — an SVG's baseline is its
bottom edge, and the mark's soil line sits 0.71px above that, so the stalks stand on the same
ground as the letters. Measured: text baseline 32.00, soil line 31.29. Header height 26.0 → 26.5px,
comfortably inside the budget.

**Alignment fixes, 4 Sept.** Three measured defects in the row furniture, all fixed:
the glyph column and the add button were flush-right at different widths, so their centres sat
**5.5px** apart; the glyph centred on the whole 44px stack rather than the 28px time line, so it
hung **8px** low; and the moon's crescent sat **1.32 units** up and left of the centre of its own
box. The `+` was a text character — its position came from font metrics rather than geometry — and
is now an SVG.

---

## Paper reopened — 4 Sept 2026

Petal is under review, and dark mode came into scope with it. **They are one decision.**
The evidence, all measured rather than argued:

- **Petal is an orphan.** It is the only pink in an app whose identity is blue and gold —
  Klein is the action colour, Dawn is the chip, the ramp runs Klein → lilac → Noon, the
  moon is solid Klein.
- **Petal is also the tightest light option on the board**: muted text **4.64** against a
  4.5 floor, major ticks **exactly 3.00**. No margin. Deepening the pink fails both
  (4.20 / 2.72), so the pink direction is only available by reopening muted and the ticks.
- **What Petal does best is separate the white cards** — 1.16, vs 1.13 for the neutrals.
  Any replacement has to hold that. Alabaster manages 1.08 and the rows dissolve, so it
  is not a candidate.
- **Dark mode was never a token swap.** Muted `#6e6874` scores **3.36** on a dark ground
  and fails outright. The dial face was literally `#fff` and the ramp softened *toward*
  white, so on a dark ground the face is a headlight and the ramp glows.
- **Klein dies in the dark** — **1.50**. The action colour becomes **Dawn**, and text on
  Dawn becomes Ink, not white. That is the home-chip decision from light mode, reused
  rather than reinvented. The moon, also solid Klein, becomes Dawn too.
- **Amber is a light-mode crutch.** It exists only because Noon on white measures **1.57** and
  needed an outline. On a dark ground Noon is **11.3** unaided, so the outline goes and
  the palette drops back to six colours in dark. The first change here that makes the
  system *simpler*.
- **The ring inverts, and that is fine.** Light: midnight band 3.38 off the face, midday
  band **1.28**. Dark: midnight **1.11**, midday 3.74. Light mode already has an end of the
  ramp that all but vanishes into the face — dark moves the same weak end to the other side
  of the clock rather than introducing a new one.

**The muddy dark dial was a bug in the colour maths, not the backgrounds.** The ramp was
toned down by blending each stop toward a target colour. Toward white that just pales
everything. Toward a dark navy it does not — Noon and the ground are near opposites, so the
blend runs through grey: **Noon's chroma fell 0.150 → 0.071** and the gold came out olive.
No dark background can fix that, because the background *is* what the colour is dragged
toward. Fixed by keeping each stop's hue and chroma and remapping only its **lightness**,
in **OKLab**, into `--ramp-floor`..`--ramp-ceil`. At floor **0.56** Noon holds all 0.150 of
its chroma and Klein lands at **3.08** against the dial face — within a hair of light mode's
3.38, so the ring reads the same strength in both schemes instead of inverting.

**The chip is now its own role token.** `--chip` / `--on-chip`, separate from `--dawn`.
Two reasons: swapping which colour fills the chip should not drag the palette entry around
with it, and the chip's text must stay **dark in both schemes** — it was `var(--ink)`, which
silently broke the moment `--ink` went light in dark mode. Dawn + white measures 2.46,
Posie + white 2.73; both need dark text. **Posie on the chip works** at 6.62 with Ink,
against Dawn's 7.35.

**Dawn-tint is out (4 Sept).** Chips are per candidate: **Dawn** on Lilac and Sky, **Posie**
on both Sunrises — Posie only earns its place against the warm ground.

**"Brighter" has two meanings and only one works.** Measured, and written into design kit §01:
going **full** (`--ramp-soften: 0`) does *not* fix light mode's weak end — the day band moves
only 1.28 → 1.57, because gold and a white face are both very light and no amount of saturation
separates them. What full buys is the night end, 3.38 → **11.81**, and Noon keeping all 0.150
of its chroma instead of 0.092. The OKLab lift that fixed dark mode *does* move the day band, to
2.30 — but only by taking Noon to `#d2a509`, which is mustard. It buys legibility by spending
the one colour on the dial that carries a meaning. **Rejected for light.**

**Sky is tilted to 135&deg;** (4 Sept) — blue in the top-left corner at the deepest the floors
allow, falling away to gold at the bottom-right, so the ground crosses the dial instead of
banding with it. `#eaeefb` is the limit: one step deeper and the major tick measures 2.99. The
gold end went *deeper* than it was, which reads warmer and also lifts the white card off it,
1.10 → 1.14.

**Averaging a gradient measures a colour that is nowhere on screen.** Checking the gradient
candidates against their average hid two real failures: the white card cleared the middle of
Sky's gradient but not its warm bottom — **1.06** against a 1.10 floor — and Sunrise had the
same flaw. Nor is there a single worst stop to substitute: on the tilted Sky the **blue** corner
is worst for the ticks (3.01) and the **gold** corner is worst for the card (1.14). Every
paper-facing check now walks every stop and reports the worst, naming which one.

**Final four (4 Sept).** Lilac cut. Two grounds &times; two wheels: **Sky** (Dawn chip) and
**Sunrise** (amber band, Posie chip), each under the **bright** wheel (OKLab lift) and the
**soft** wheel (46% toward white), with the wheel treatment applied to *both* schemes. Both
grounds now run at **135&deg;**.

**The olive in Sky was in the middle of the gradient, not at either end.** Sampling the old
blue→gold path and watching the green channel overtake the blue one: it crosses at the halfway
mark and holds `+20` through the whole visible middle. Blue and gold are near-opposites, so a
straight line between them must pass through khaki — the same reason the dial's ramp needed a
pale bridge stop. Sky now holds its blue to **44%** and detours through a cool pink at **68%**.

**Correction to the last round: the bright wheel does *not* turn Noon to mustard in light.**
That was true only of the version tuned to force the day band off white (floor 0.30, ceiling
0.80). At the settings dark mode uses, Noon lands at `#f3c543`. So one treatment serves both
schemes, and in light it beats the soft wheel on every number — night band 3.38 → **4.87**,
day band 1.28 → **1.63**, chroma 0.092 → **0.150**. It is simply louder; that is the taste call.

**The bright-wheel floor is two numbers, not one — the schemes want opposite things.** Raising
the floor lightens the whole wheel. On a dark face that is straightforwardly better: at **0.78**
Sky's night band goes 3.59 → **5.65**. On a white face it is the reverse — the night band falls
to **2.26**, under the 3:1 a meaningful graphic needs, and Klein is pushed so far out of sRGB
that it clips and desaturates from 0.205 chroma to **0.131**, arriving at `#79aeff`, a pale
cornflower. It stops being Klein. Light needs dark ink on a light ground and dark needs the
reverse, so: **`--ramp-floor` is 0.56 in light and 0.78 in dark.** Already separate tokens, so
this costs nothing. The night band is now policed at 3:1 like any other graphic.

**Hour marks darkened, 4 Sept 2026 — approved by Halley.** `--tick-maj` `#8d8792` →
**`#79717e`**, `--tick-min` `#c2bcc6` → **`#aea7b3`**. The major tick measured *exactly* 3.00
against every paper tried, dead on the 3:1 floor a meaningful graphic needs, and it had quietly
blocked three rounds of ground work. It now scores **4.04** at worst across every stop of both
live grounds. It stays lighter than the numerals (`--muted`), so the hierarchy on the dial rim
survives. The minor ticks are half-hour subdivisions, redundant with both the hour ticks and the
numerals — decorative, so 3:1 does not reach them; they moved only to hold their old
relationship to the majors.

**The margin was taken as margin.** Halley's call: Sky's blue stays at `#eaeefb`, the subtle
tint, rather than being deepened to spend the new headroom. The olive fix stands on its own.

⚠️ **`design-kit.html` still records the old tick values** — needs updating, ask first.

**Settled 4 Sept, pending final sign-off on the chip value:**

| | |
|---|---|
| **Ground** | **Sky** — tilted 135&deg;, blue top-left, gold bottom-right |
| **Wheel** | **Bright** (OKLab lift), both schemes |
| **Bright floor** | **0.68 light / 0.70 dark** — see below |
| **Home chip** | **Dawn, both schemes — it never moves** |
| **Action** | **Klein, both schemes** — lifted to `#3560e3` in dark so it survives |
| **Posie** | **Retired from Pando entirely** |
| **Outlined chip** | Rejected |
| **Month control** | Stays bare and muted — the ring is removed from the app, not just the page |

**0.70 works in dark but misses in light, by 0.08.** On a dark face 0.70 puts Sky's night band at
**4.36**. On a white face the same setting gives **2.92**, just under the 3:1 a meaningful graphic
needs; the crossover is **0.68** (3.10). So light sits at 0.68 and dark at Halley's 0.70 — two
clicks apart and not a visible difference, but 0.70 in light would have been a number that
quietly fails.

**THE RULE (Halley, 4 Sept):** every UI colour — plus, sun, moon, home chip — **must be a
colour the time-picker wheel actually paints.** Not "from the palette", not "near it": on the
wheel. This rule retroactively catches all three of my bad suggestions (Posie, Amber-as-chip,
Klein-lifted-as-action) — each was a colour that existed nowhere else on screen.

**Dark UI colours are now sampled from the wheel, not chosen.** They use the same lift the wheel
uses, so moving the dark floor moves them with it. They cannot drift out of true.

| role | wheel position | at floor 0.70 |
|---|---|---|
| **plus + moon** | **06:30**, Dawn — the same stop the light chip is drawn from | `#a7bfff` |
| **sun** | **noon** plateau | `#f9cb4a` |
| **home chip** | **noon** plateau — the wheel's only yellow | `#f9cb4a` |

Values shown are the **bright** wheel. The **soft** wheel paints different colours, so its UI
samples differ too: plus/moon `#c0cdf7`, sun/chip `#fbe29c`.

**Bug found and fixed 4 Sept:** sampling used the *lift* for both candidates, so the soft
candidate carried UI colours its own wheel never paints. The rule looked enforced and was not.
Each candidate now samples the wheel it actually draws.

**Second time for the same mistake:** the `action vs chip` and `action vs sun` checks were pure
luminance, and failed a gold chip against a blue button at 1.18 — across hues that is the wrong
test, exactly as it was in the assignment search. Distinctness is now one function, hue **or**
lightness, used everywhere.

**The wheel has exactly one yellow.** Its three warm stops — cream 09:30, noon gold, warming-down
19:30 — measure **1.01, 1.06 and 1.07** apart once lifted. That is one colour with three names, so
"which yellow" is not a choice that exists. The chip is `#f9cb4a`, the noon plateau.

**So the chip and the sun are the same colour.** Opposite ends of the same row: a labelled pill on
the left, a rayed disc on the right — different objects, one colour. The precedent is already in
light mode, where the add button and the moon are both Klein. The one thing to watch: when home is
awake the row is gold chip + gold sun; asleep, gold chip + blue moon. So the chip matches the
day-state marker half the time. Light does the same in mirror image (Dawn chip beside a Klein moon)
— not new, but easier to see in gold.

Against the add button it is the widest separation the palette can produce: gold against
`#6194ff`, the full width of the ramp. The `+` glyph is **ink**, not white — on the lifted
midnight, ink reads 6.20 and white 2.92.

**The sun's outline is EXEMPT from the rule — Halley, 4 Sept.** `#a97103` is the only UI colour in
the app that is not on the wheel. It is a legibility patch, not a colour choice: Noon on white
measures **1.57** and the disc vanishes without it, and no wheel stop can do that job. Exempted
deliberately rather than quietly; the page's audit records the exemption by name so it stays
visible.

**Sunrise is out (4 Sept).** Only Sky remains, under the two wheel treatments.

**Note:** the search for a valid assignment initially returned *zero* results, because it required
luminance separation between every pair. That is the wrong test across hues — blue and gold are
obviously distinct at any luminance. With hue taken into account there were 70.

**Groundwork:** `--chip` split into `--chip-bg` / `--chip-line` / `--on-chip`, so a chip can be
filled or outlined at constant size.

## Locked decisions

| Area | Decision |
|---|---|
| **Home city** | First city added becomes **Home** and sets what the dial reads. Marked in the list; tap any other city to promote it. **The app asks on first open** — see *Seeding* below. |
| **Month sampling** | A chosen month samples the **1st of that month**, and says so on screen (e.g. "1 March"). |
| **Year** | Always the current year. |
| **Font** | Helvetica Neue Light (300). Native on Mac & iOS — no webfont. Fallback: Helvetica → Arial. |
| **Palette** | See *The colour system, as shipped* above. Daybreak, tuned — historic: Petal `#fbe9f4` · Card `#ffffff` · Ink `#14161a` · Muted `#6e6874` · Night/Klein `#0d21a5` · Dawn `#8ba2f0` · Noon `#f7c948` · Amber `#a97103` (sun outline only). Full rationale + contrast audit in `design-kit.html`. |
| **Dial** | 24-hour ring, midnight top / noon bottom. **Detents at the quarter hours** — no modes, no speed sensing. |
| **Why detents** | The whole day is ~754px of arc, so **one minute is half a pixel**: minute precision by finger is below the resolution of the input device, whatever scheme is used. Detents do not add precision, they **redistribute** it. Within **3 minutes** of a quarter hour the drag produces no change, so 11:30 is a **3.46px** landing zone while every other minute gets **0.31px** — an 11× difference. And unlike a plain grid it *holds*: overshoot by up to ±3 minutes and you are still on 11:30, rather than on 11:31. Measured: seven drags aimed at a quarter hour and missed by −3 to +3 minutes all landed on one; 18:22, 18:40 and 19:23 confirm odd minutes are still reachable. Exactly Halley's brief — easy to hit the quarter hours, any time still settable, 11:07 fiddlier than 11:30. |
| **Slow-drag fine adjust** | **Retired 4 Sept 2026.** It was a mode you could not see, entered by accident, that changed the rules under your finger — fingers *start* slow, so the velocity threshold was crossed within the first few move events of every drag. Worse, a "fix" that made it sticky within a drag meant it latched immediately and never released, so the coarse step it was meant to complement never ran at all. Three rounds of tuning did not save it; the mechanism was wrong, not the constants. The `--tick-*-fine` tokens went with it. |
| **Build** | PWA (Add to Home Screen). $0. Capacitor stays available later without a rewrite. |
| **Mode** | Light only. |
| **Max cities** | 6. |
| **City data** | GeoNames `cities15000`, trimmed to population ≥50,000 **plus every national capital**, districts stripped. 11,486 cities, 247KB (89KB gzipped), bundled — no API, works offline. **CC BY 4.0, so the attribution in the footer is a licence condition, not decoration.** |
| **Seeding** | **None. Reversed 4 Sept 2026** (was: default to the device timezone). `Intl` gives a *timezone*, not a city, and `Europe/Madrid` covers the Balearics as well as the mainland — so guessing meant taking the largest city in the zone and calling it yours. Halley opened the live build and it said her home was Madrid. Worse, Palma is *pinned*, and the wink logic deliberately excluded pinned cities sharing your timezone — so the one city that was actually hers was the one city that could never appear. First open now shows the search sheet asking which city you are in. Costs one tap, is always right, and the answer persists. The dial shows nothing until a city exists, rather than a UTC fallback that reads as a real time for a place nobody named. |
| **Drag accumulation** | The drag keeps an **unrounded** running position; the step grid is applied for display only. Rounding the running value on every pointermove discarded any movement smaller than half a step — at the 5-minute step, nothing under 2.5 minutes of arc registered at all, so a slow drag did nothing and the dial only moved in lumps. Fixed 4 Sept 2026; a 60-minute slow drag now lands exactly 60 minutes on. |
| **Home label fit** | The city name inside the dial measures itself and shrinks to fit the white face — tracking first (that is what makes a long name wide), then size, then truncation as a last resort. `PALMA DE MALLORCA` was 156 units against ~150 available and ran out over the ring; it now sits at 137 with the tracking dropped 2.4 → 1.2 and no size change. Added 4 Sept 2026. |
| **Updating an installed app** | A home-screen PWA has no address bar and so no reload button — it can sit on a cached build indefinitely with no way to say so. The app now tells you: a new service worker installing while one is already in control raises a **"A new version is ready · Reload"** toast, and the registration re-checks for updates every time the app is resumed (standalone apps are resumed, not reloaded). A **build stamp** sits under the footer credit so "am I on the new one?" is answerable without a console. |
| **Pinned cities** | **Aspen** (America/Denver) and **Palma de Mallorca** (Europe/Madrid) are hand-added. Aspen's population is ~7,400, under the GeoNames floor, so it is genuinely absent from the dataset; Palma exists but is filed as bare "Palma". **Your own city seeds home first**, with one pinned city added beneath it as a demonstration of how cities stack — the wink must not claim to be where you are. If your device zone matches one pinned city, the other is used. Both searchable, incl. "mallorca" / "majorca". **The wink survives the seeding change** — it now fires after you name your home city, dropping in one pinned city from a zone that is *not* yours, so the list arrives as a list. The two were tangled in one function; only the guessing was the problem. |
| **Dial form** | **Full centered wheel**, **outer arc** — the arc rides between the ramp band and the hour ticks. The edge-anchored version from the reference app was tried and rejected as a step backwards. |
| **Dial marker** | The gradient arc's own **rounded cap**. No notch, bar or knob. Works because the whole dial is the drag surface. |
| **Ramp timing** | Skewed to the hour, not symmetric around noon: cool roughly **21:00–06:30**. Deliberately close to the 21:00–06:59 asleep threshold so ring and rows broadly agree — but they are *not* the same number, and the ramp is a gradient with no hard edge, so do not describe them as identical. Painted as 144 conic segments. |
| **Ramp strength** | **Soft** is live. **Full** is kept in the design kit and reversible — one constant, `SOFTEN = 0.46` (set to `0` for full). Both share identical timing, so swapping changes loudness and nothing else. |
| **Ring proportions** | 38px ramp band, **26px gap** to the hour ticks, numerals further out again. The v2 spacing was too tight. |
| **Drag surface** | The **whole dial**, in every variant. Taken from the reference app, which has no handle at all — the marker is an indicator, not a target. |
| **Dawn's job** | The home chip — a solid Dawn pill with **Ink** text (7.35:1) on the row the dial speaks for. White on Dawn was considered and rejected at 2.46:1; the palette stays at six colors plus Amber. |
| **Night threshold** | Fixed clock hours: **21:00–06:59 local = asleep**. Real sunrise/sunset was considered and rejected — it needs a solar calculation and breaks at high latitudes (Reykjavík in June never gets a moon). |
| **Day-state marker** | Binary sun / moon, one on every row. Moon = solid Klein; sun = Noon disc with an Amber `#a97103` outline. Three states were tested and dropped — a lone mark has nothing to contrast against. |
| **What persists** | Cities, their order (so home), and 12h/24h — always. The dial position and the chosen month — **only if you were last here within the hour**. Same session keeps its context; the next morning opens live. A frozen time under a stale `1 MAR` reads as a bug, and always-restore would show you that most mornings. |
| **Empty list** | Re-seeds. An empty saved list is treated as no saved list, so the seed logic runs again. Distinguishing “never opened” from “emptied on purpose” needs an extra flag to buy a state nobody wants to sit in. |
| **Corrupt saved state** | Rows whose IANA zone the browser no longer knows are dropped, not trusted — one bad zone inside `Intl` would take the whole app down. If the dropped row was home, the next city becomes home. |
| **Cache strategy** | Shell (html/css/js) is **network-first with a 3s timeout**, falling back to cache. It was stale-while-revalidate, which meant every change took two launches to appear — and an installed app, having no reload button, could sit on an old build silently. Changed 4 Sept 2026 after that happened twice in one afternoon: knowing what you are running matters more than a few milliseconds at launch. Online you get the current build; offline you get the last one you had. `cities.json` stays cache-first and is never revalidated — 247KB that only changes when deliberately rebuilt. Bump `CACHE` in `sw.js` if it ever is. |

## Open

- ~~**Phase 2 + 3**~~ — **BUILT, 3 Sept 2026.** Dial, 12/24 and the month selector are in
  `app/`, wired to the city rows. Deciding them together was the right call: they compete
  for one screen, and the header slot could not be settled without knowing what lived in it.

  **Header label is always `TODAY`** when no month is chosen — it does not switch to `NOW`
  when live. A label changing under your finger mid-drag is worse than the small imprecision
  of calling a set time "today". The menu's first item is **Today**, which restores live
  ticking and resets the dial.

  **No fine-mode caption.** The `fine · 1 minute` text was removed — too small to read, and
  the ticks thickening and turning Klein already carry the message.

  **Layout — DECIDED.**
  - Dial stays at **300pt**; not negotiable.
  - Rows **always compact** at 65pt. The fold-on-drag animation was prototyped and
    rejected as distracting (that file has been binned). Country sits under the city name, baseline-locked to the
    day-shift line. Add row hides once the list is full.
  - Header is **one line**: mark + name left, month control right.
  - Sum **as built**: header 24 + dial 300 + list 391 = **715pt into 731** usable, 16pt spare.
    The prototype's 25pt header used a non-tappable label; the real date control needs a
    **44pt touch target**, which as a literal `min-height` made the header 52pt and blew the
    budget. Fixed with padding pulled back by an equal negative margin — the hit area is
    45pt and overflows the header instead of growing it, so the row stays 24pt.
  - No control row under the dial: it costs ~55pt and there are 13. The original brief's
    layout (*toggle below the clock, dropdown under it*) **does not fit**, even with rows
    squeezed to 59pt. That is arithmetic, not taste.

  **Controls — DECIDED.**
  - **12/24 lives inside the dial's white face**, directly under the readout it governs.
    Treatment is *whisper*: `12H · 24H`, live value in ink, other in muted, **no container**.
    Tight spacing: 6px between the options, ~4px under the city label. The 44pt hit area
    comes from padding, positioned so the *text* sits close under the label rather than the
    box being centred on it.
    Rejected: segmented pill (too heavy), current-mode-only (hides that a choice exists),
    Klein active value (widens Klein from action to state), hidden tap-the-readout
    (invisible, and unlike swipe-to-delete it has no borrowed mental model).
  - **Month selector lives in the header's right slot**, `NOW ⌄` → `1 MAR ⌄`. The slot must
    display *state*, not merely afford an action — a bare glyph can say "there is a date
    control here" but never *which* date.
  - **Header colour: always muted.** The control no longer turns Klein when a month is set;
    the label already changed from `NOW` to `1 MAY`, so the colour restated it and the
    mismatch was the only thing it achieved.

  **Rules that came out of building it**
  - The dial must **never move or resize mid-drag** — anything shifting under the finger
    wrecks the gesture.
  - The in-face toggle is an **HTML overlay above the SVG**, so tapping it cannot start a drag.
  - The row's height is set by the **right** column: time (28) + the always-reserved
    day-shift line (13) = 44pt regardless of the left side. Putting the country back under
    the city name therefore cost 2pt. Compaction comes from padding, not from dropping lines.
  - **am/pm is a suffix, not part of the number** — 17px in rows (matching the city name),
    20px in the dial, with a real gap. Set it as an inline in a fixed line box; flex +
    `align-items:baseline` drops the whole number and breaks alignment with the city name.

  **The mark — DECIDED: the broken soil line**, at **16px, not 12**. Three stalks of uneven
  height each carrying a leaf, rising from three soil dashes the stalks do not touch. The
  dashes fall below a device pixel at 12px, so mark and size are one decision. Full recipe,
  rationale and both reserves (no-soil-line, and no-mark) are rendered into design kit §05.

- **Zone abbreviations** are only available for a minority of zones; the rest fall back to
  the country name. Fine, but a small hand-map (JST, WAT, HST…) would read better.
- *(color is closed — palette, marker, threshold and the Dawn accent are all settled)*
- **App icon** for Add to Home Screen — must read at 60px, so not the full dial.
- **Slow-drag discoverability** — needs a visible response as the drag slows, or the
  single-minute precision is unreachable in practice.
- Nov 1 DST edge case (below) — leave honest, or pin to midday?

*Scorecard: parked at Halley's request. No cards, no project tag for now.*

---

## Next version — raised 4 Sept 2026, after using the live build

Not scoped or scheduled. Recorded here so the reasoning survives.

**1. Drag to reorder the city list.** Order currently only changes via *Set home*, which promotes a
city to the top — there is no way to arrange the rest. Note that order is not cosmetic here: index
0 *is* home and drives the dial, so a reorder gesture and the home rule have to agree. Simplest
version that keeps them consistent: dragging to position 0 promotes to home, exactly as the button
does. The rows already own `pointerdown`/`pointermove` for swipe-to-delete, so the drag will have
to share that gesture space — a long-press to pick up is the usual answer, and it must not fight
the horizontal swipe.

**2. The dial still is not good enough to set an arbitrary time.** Detents made the quarter hours
easy and reliable — Halley's verdict on the shipped version was "better but definitely not great",
and the honest reading is that quarter hours now work while everything else is still out of reach.

The root cause is unchanged and is not a tuning problem: **the full 24 hours maps 1:1 onto a
300pt dial**, so one minute is half a pixel. Detents redistribute that budget; they cannot create
more of it. Every option below works by **breaking the 1:1 mapping** — that is the only lever left.

- **Gear the drag by distance from the centre.** Near the rim, 1:1 as now; drag your finger *away*
  from the dial and the ratio falls, so the same finger travel covers fewer minutes. This is how
  precision knobs work in audio and design software. It is the strongest candidate: it solves the
  actual constraint (input resolution, not grid choice), needs no mode to enter, cannot be
  triggered by accident, and is self-teaching — wanting more control makes you move outward
  anyway. The angle maths already uses distance from centre, so the hook is there.
- **Two rings.** Outer sets the hour, inner sets minutes. Precise and obvious, but it doubles the
  dial's job and the layout has 16pt of spare vertical, so something else would have to give.
- **Momentum, settling into a detent.** Fixes the feel of stopping rather than the resolution.
  Worth having regardless, but it will not make 11:07 reachable.
- **A bigger dial.** Would genuinely help — and is not available. The layout sums to 715pt into
  731, and that is arithmetic, not taste.

What is *not* worth retrying: any scheme that senses drag speed. Three rounds of that failed
because fingers start slow, so any velocity threshold fires within the first few move events of
every drag. See *Slow-drag fine adjust* under Locked decisions.

**3. The first run lands strangely.** Halley, after using it: the sheet appears before you have
seen the app, and then choosing a city produces *two* rows — yours and Aspen — so the choice does
not feel like yours. The question is being asked with no context, and the answer arrives with an
uninvited passenger.

Worth separating two things that are currently tangled: **asking** (which replaced the timezone
guess, and was right — see *Seeding* under Locked decisions) and **when** it is asked.

Two directions Halley raised:

- **Seed Aspen, then prompt for home on a delay.** The app opens as a working app with something
  in it, you get a moment to see what it is, and only then is the question asked. The prompt has
  context by the time it arrives. Cost: a timed interruption is its own kind of rude, and the
  delay needs a value nobody can justify from first principles.
- **Seed Aspen and say nothing** — rely on row actions to let you make it yours, with a small
  motion cue so they get discovered. **The current row actions are not the interaction Halley
  means.** What exists is an *expanding panel*: swiping left (or tapping) adds `.open` to the row,
  which reveals a `Set home` / `Delete` pair in a strip that appears **below** the row and pushes
  the list down. What she is describing is the **Apple Messages pattern** — the row itself slides
  sideways under the finger, revealing two coloured action boxes **alongside** it, with the row
  tracking your finger rather than snapping to a state. That is a real build, not a discoverability
  fix: the row needs a transform that follows the drag, boxes sized to what the swipe reveals, a
  release threshold, and a spring back. Worth doing — it is the pattern everyone already knows, and
  it does not disturb the layout the way the current strip does. A one-time bounce on the first row
  to advertise it still applies.
  Cost: someone who never finds it is stuck looking at Aspen, and Aspen is not their home.

A third worth considering: **seed Aspen, and let the empty second slot do the asking** — an
"Add your city" row that reads as an invitation rather than a modal. No timer, no interruption, no
uninvited passenger, and the first tap opens the sheet you already have.

**4. A typography and spacing pass.** Three things Halley flagged after living with it, all in
the same territory and best done together.

- **The city name in the dial needs a better answer than shrinking.** It currently measures itself
  and drops tracking (2.4 → 0.6), then size (11 → 8.2), then truncates. That is a safety net, not a
  design: a genuinely long name ends up small and tightly tracked while a short one sits large and
  airy, so the label's weight changes with the city. Worth exploring: two lines; dropping to a
  shorter form (the GeoNames name without its qualifier); or accepting a fixed smaller size for
  every city so the treatment is at least consistent. The available width is **152 units** at the
  label's height, and `PALMA DE MALLORCA` needs 156 at full tracking — so this bites at around
  17 characters, which is not rare.
- **The spacing inside the ring is loose.** Measured: the face is 156 units tall, and the content
  (readout, label, toggle) occupies roughly **y=124–186**. That leaves about **52 units empty
  above and 42 below** — the group sits high and the composition is not centred on anything in
  particular. Either centre the group properly in the face, or use the room deliberately.
- **The city rows could carry more type.** The name is **17px** against a **25px** time, with the
  country at 11px. On a 390pt screen there is width to spare, and the row's height is set by the
  right-hand column (28pt time + 13pt day-shift line), so the name can grow without changing the
  row height at all — the constraint is the *right* column, not the left. Cheap to try.

**A swipe alternative to the row actions.** *Later — additive, nothing is broken.* Tap-to-reveal
works well and stays. The idea is a **second** way in: Apple's Messages pattern, where the row
slides sideways **under your finger** revealing two action boxes alongside it, tracking the drag
rather than snapping open. Note that today's reveal is an expanding strip *below* the row, which
pushes the rest of the list down — a sideways reveal would leave the layout still, which is part of
its appeal. The gesture plumbing already exists (`pointerdown`/`pointermove` on `.cities`, with a
horizontal-vs-vertical decision), so this is mostly presentation: a transform on `.face` that
follows the drag, boxes laid out behind it, a release threshold and a spring back.
**It shares gesture space with drag-to-reorder above — design the two together.**

**5. Usage analytics.** Worth knowing this is not free on GitHub Pages: it is static hosting with
no server logs, so anything at all means adding a client-side script. Candidates —
**GoatCounter** (free for personal use, no cookies, ~3KB), **Plausible** (~£7/mo, no cookies),
self-hosted **Umami**. Two caveats specific to Pando: the service worker means repeat visits can
be served entirely from cache, and the whole point of the app is that it works **offline** — so
any figure will undercount real use, and should be read as "sessions that reached the network",
not "sessions". Also: adding a third-party script to a page that currently makes **zero** network
calls after first load is a real change in what the app is. Worth deciding deliberately.

**6. The search sheet's position is wrong on desktop.** It is `position:fixed; inset:0` anchored to
the *top* of the viewport, so tapping **Add city** — which sits at the bottom of the list — throws
the field to the top of the screen. On a phone that is defensible: the sheet lands near the
keyboard and the viewport is short. On a desktop browser it is a long way from where you clicked,
and the jump reads as a glitch. Options: anchor the sheet near the button that opened it, a
centred modal, or a popover attached to the Add row. The mobile and desktop cases genuinely want
different things, so this may be one place a media query earns its keep.

---

## Cost

| Path | Up-front | Ongoing | Gets you |
|---|---|---|---|
| **PWA / Add to Home Screen** | £0 | £0 | Home Screen icon, full-screen, offline, installs in ~10 seconds |
| Static hosting (optional) | £0 | £0 | A URL, via GitHub Pages / Cloudflare Pages free tier |
| Capacitor → own device only | £0 | £0 | A real native build, but the signing expires every 7 days and must be redone |
| Capacitor → App Store | £0 | **$99/yr** | Apple Developer Program, public listing, review process |

**Recommendation: PWA.** Genuinely free, no Xcode, no review queue. Because the
code is plain HTML/CSS/JS, Capacitor can wrap this exact codebase later — the
$99 decision stays deferred, and nothing gets rebuilt when it's made.

---

## Known accepted gaps

- **The dial has no keyboard or VoiceOver path.** Drag-only means it fails WCAG 2.1.1
  (Keyboard) and is unusable via screen reader or switch control. Accepted by Halley
  on 3 Sept 2026 for current scope — recorded, not forgotten. The fix is one typed
  time input; revisit before any public release.

## Technical notes

**Timezones need no API.** Browsers ship the IANA timezone database.
`Intl.DateTimeFormat` with a zone like `America/Mexico_City` and a given date
returns the correct local time *with DST already applied*, for any date. This is
what makes the month selector nearly free.

**City data ships with the app.** A trimmed GeoNames extract — **11,486 cities**
(name, country, IANA zone), 247KB raw / 89KB gzipped. Population order ranks search
results so "Mexi" surfaces Mexico City above Mexicali. No network, works offline.

**Persistence:** `localStorage`. No accounts, no server.

**The dial:** hand-drawn SVG, pointer events, angle → minutes. No library.
Ports 1:1 into a Capacitor wrapper if we ever go native.

### One edge case to be aware of
Offsets are computed at the actual selected instant — the 1st of the month, at
whatever time the dial reads. US daylight saving ends on the *first Sunday of
November*, which in 2026 is **1 November**. So on that one date, spinning the
dial past 02:00 will correctly flip US offsets mid-spin. It's accurate, but it
looks like a glitch. Alternative: pin month-mode offsets to 12:00 on the 1st.
Flagging rather than deciding.

---

## Build phases

0. ~~Design approval~~ — **complete, 3 Sept 2026**
1. ~~**Shell & cities**~~ — **built, 3 Sept 2026.** Runs at `Pando/app/` via `./start.sh`. — search, add/remove, max 6, live local times ticking
2. ~~**The dial**~~ — **built.** Drag to set, all cities derive, 12h/24h toggle
3. ~~**Dates & DST**~~ — **built.** Now / month menu, offsets recompute via Intl
4. ~~**Polish**~~ — **built, 4 Sept 2026.** Persistence, manifest + service worker, icon
   pipeline, full colour tokenisation.
5. ~~**Colour: ground, wheel, dark scheme**~~ — **done, 4 Sept 2026.** Sky + soft wheel, light
   and dark, every UI colour sampled from the wheel. `tools/a11y-audit.py` passes.
6. ~~**App icon**~~ — **done, 4 Sept 2026.** V2b: the grove in a wheel-gradient cutout.
7. ~~**Ship**~~ — **done, 4 Sept 2026.** Public repo, Pages, live URL verified.

**All phases complete.** Further work is in *Next version*, above.

8. *Optional* — Capacitor wrap for the App Store

---

## Files

- `palette-tuner.html` — live colour tuner *(superseded by `paper-options.html`)*
- `design-kit.html` — the locked design system + contrast audit
- `dot-options.html` — the day-state marker ladder & the decision record
- `dawn-placements.html` — five candidate homes for the Dawn accent
- `layout.html` — placement & fit, with a working month picker on real IANA zones
- `chrome.html` — lighter 12/24 treatments + the reconciled header
- `mark.html` — the mark explorations & why each alternative failed
- `live.html` — **the working prototype**: drag, 12/24, month picker, real DST. Shows the
  chosen treatment (A) alongside the rejected D
- `app/` — **the actual app.** `./start.sh` to run (serves on :8020 and opens Chrome)
- `dial-prototype.html` — round one: bare knob / swept arc / stemmed knob
- `dial-prototype-v2.html` — round two: inner/outer arc, no-arc, edge wheel
- `dial-prototype-v3.html` — round three: inner vs outer × full vs soft ramp
- `reference/` — frames + takeaways from the reference app Halley shared
- `icon-options.html` — the six app-icon candidates, live, at real device sizes
- `tools/make-icons.py` — renders the icon set from a variant letter (needs Chrome)
- `paper-options.html` — five papers × light/dark, each the real app in a frame
- `start-docs.sh` / `serve.py` — serves the design docs on :8021. **`paper-options.html`
  needs this** — it runs the real app in a frame, and the app cannot fetch its city
  data over `file://`. The other docs open fine straight from Finder.
- `tools/a11y-audit.py` — audits both schemes from the real tokens; run after any colour change
- `PLAN.md` — this file
