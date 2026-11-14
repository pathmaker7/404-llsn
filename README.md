# Lunar Landing Site Navigator

NASA Space Apps Challenge 2026, challenge "Lunar Landing Site Navigator". Team **404 agents**, Naryn. An independent student project, not a NASA product.

**Live app:** https://lunar-navigator-404.web.app · **How it works:** https://lunar-navigator-explained.web.app · **7 slides (online presentation):** https://lunar-navigator-explained.web.app/deck.html (PDF: https://lunar-navigator-explained.web.app/deck.pdf) · **Project page text:** `docs/SUBMISSION.md` · **Film script:** `docs/VIDEO-SCRIPT.md`

> If we land at this site on this day, will a solar robot survive, and on which days would it?

![The south pole map with fifteen sites and the timeline of every landing day](docs/screenshots/map.png)
![Standing on a site: the answer panel and the 3D view](docs/screenshots/site.png)

## What it does

1. **The Moon in 3D**: the app opens on the whole Moon and glides down to the south pole (scroll out to see it whole again). The pole is real LOLA terrain set into NASA's colour map of the Moon. You can drag to turn it, with fifteen sites: six from NASA's Lunar Surface Data Book and nine picked by the team on LOLA terrain (crater rims and shadowed floors).
   Under it, **one row per site and one column per landing day**: green survives, red is lost. It opens on the next month, with buttons for two weeks, three months, a year, five years and the whole period; set the period yourself, from any day to any day in 2021 to 2031; the best site for that period is listed first. Click a cell to land on that site on that day. Press play and the sunlight sweeps over the Moon for that period: shadows are cast from the real Sun position, and labels on the rim show where the Sun and Earth stand.
2. **You fly down and stand on it**, 2 m above the real LOLA terrain. The Sun and Earth sit at their true positions. Press ▶ to watch 14 days pass.
3. **One panel gives the answer** for a landing on the chosen day:
   - MISSION SURVIVED or MISSION LOST, and one sentence of why;
   - a strip of the next 120 landing days, green survives, red is lost (click a day to land on it);
   - eleven checks with a tick or a cross (hover a line to read what it means).
4. **Your own mission**: set how long the battery lasts and how long radio silence is allowed, and every site and day is judged again. **Add any point on the Moon** by latitude and longitude, or pick a known landing (Apollo 11, Apollo 17, Chandrayaan-3, IM-1, Chang'e 6, IM-2): it gets its own row, verdict and surface view, and the page address keeps it, so a comparison can be shared as a link. Sun and Earth positions are exact everywhere. Within about 235 km of the south pole an added point uses LOLA terrain averaged to 320 m (horizon within about 1 degree of the 80 m sites, up to 2 on a narrow peak, measured in `tools/smoke.cjs`); elsewhere the app has no terrain, so the horizon is the Moon's curve and the slope checks do not apply. The app says which case applies.
5. **Replay a real landing**: pick Chandrayaan-3, IM-1, Chang'e 6 or IM-2 and the app stands you on its site at its touchdown. A box shows what really happened next to what the model says for that moment (sunrise, sunset, Earth in view). The table on the first screen downloads as CSV.
6. **Any day from 2021 to 2031**: past days are history, future days are a prediction from the orbit model. The terrain does not change.
7. "Details" brings back every expert number. English, Russian and Kyrgyz for the answer panel.
8. **Four toys for children** (below): build your own lander with a Central Asian hat and drop it onto the Moon, play "Keep me alive", hunt for dark spots where water ice could hide, take a quiz. All four give the same answers as the grid.

## The eleven checks

| Priority | Check | Limit | Where the limit comes from |
|---|---|---|---|
| Must pass | Longest night | at most 2 days | team teaching value |
| Must pass | Longest radio silence (Earth hidden) | at most 3 days | team teaching value |
| Must pass | Sun on the first day | up at landing or within 24 hours | team teaching value |
| Must pass | Ground slope at the spot | under 10° | NASA Artemis III requirement |
| NASA site rule | Steepest ground within 2 km | under 20° | NASA Artemis III requirement |
| NASA site rule | Distance from the south pole | within 6° | NASA Artemis III requirement |
| Good to know | Time in sunlight, time with Earth in view, both together, highest Sun, radio windows | none | shown only |

The robot survives when the four "must pass" checks pass. The battery and radio limits are the user's to change on the first screen; every site and day is then judged again. The rules are in `app/mission.js`.

## Four toys for children

Built for students in Kyrgyzstan and Central Asia. Each one is a different way to touch the same answer: "survived" and "lost" in all four come from `judgeAt` in `app/src/verdict.js` (the one survival rule) on the same hourly Sun and Earth data as the grid. None has a rule of its own.

| Toy | What a child does | What they see | Code |
|---|---|---|---|
| **My lander** | Builds a lander (lander, rover or hopper; six colours; a name up to 20 characters; a Kyrgyz ak kalpak, Kazakh kalpak, Uzbek doppi, Tajik toqi or no hat), then clicks a landing day or the Moon | The lander drops from the click onto the Moon with a thruster flame and a dust puff, then lights up green and waves its hat (survives) or frosts over and goes dark (lost), with one sentence of why. On a site it stands near the viewer under the real Sun, tagged "alive" or "frozen". The choice is kept in the browser | `app/src/lander.js`, `app/src/lander-models.js`, `app/i18n-lander.js` |
| **Keep me alive** | Presses "Keep me alive" on the first screen (the app opens the best site of the period shown on its next surviving day) or on a site, and picks a landing day, or presses "Try a green day" or "Try a red day" | The 14 days play in about 40 seconds (1x, 2x, 4x): the battery fills in Sun and drains in shadow, radio bars show while Earth is up, and it ends with "14 days survived!" or the reason it was lost | `app/src/game.js`, `app/i18n-game.js` |
| **Ice hunter** | Presses "Ice hunter" on the map and taps a spot near the south pole | If no part of the Sun was above the horizon in any hour of 2021 to 2031 at that spot: a sparkle, "Water ice could hide in places like this", and one NASA line (LCROSS, Cabeus, 2009). Otherwise the share of hours with Sun. A counter of dark spots found in this hunt (at least 5 km apart). Pressing "Ice hunter" again stops the hunt and clears every point and the count, so the next hunt starts on a clean Moon | `app/src/ice.js`, `app/i18n-ice.js` |
| **Quiz** | Presses "Quiz" and answers 5 questions drawn at random from a pool of 25, four answers each | After each answer, why the right one is right and why the chosen one is wrong. 15 questions are fixed facts (sources named in `quiz.js`); 10 are marked "Real data from the app": each takes a real prepared site and day and gets its right answer from `judgeAt`. The round ends with a score out of 5 | `app/src/quiz.js`, `app/i18n-quiz.js` |

**Help for a first visit** (`app/src/tour.js`, `app/i18n-tour.js`). On the first visit a tour of five steps starts by itself: it lights the landing calendar, the lander card, Keep me alive, Ice hunter and Quiz in turn and says in two sentences what each is. The first press on Ice hunter, Quiz or Keep me alive shows a "How to play" card before the toy starts: the goal in one sentence, then what to press, in numbered steps that name the real buttons. While Ice hunter is on, a tap on a site label hunts at that site's point instead of opening the site (the labels cover the very craters a child hunts in), so "tap the label Shackleton floor" is a sure first find. The "How to play" button on the first screen starts the tour again. What was seen is kept in the child's own browser.

Limits, stated plainly:

- A spot the child picks (a dropped lander, an Ice hunter tap) uses NASA LOLA terrain averaged to 320 m, coarser than the 80 m of the fifteen prepared sites, so small shadows and small sunlit peaks are missed. It exists only within about 235 km of the south pole; farther away Ice hunter says "Too far from the pole".
- Ice hunter does not detect ice. "Never sunlit in 2021 to 2031 in our model" means water ice could hide there, nothing more; only a spacecraft can tell. Every spot the Sun does reach is called too warm for ice: a simple rule, not a temperature model.
- Keep me alive is the team's teaching rule, not a real power system: a full battery lasts the battery limit in the dark, one hour of Sun refills it, the lander arrives with 23 hours of charge (with the default limits). The 2 day battery and 3 day radio limits are our example values, not NASA requirements.
- The 15 fixed Quiz questions are written from NASA and mission pages named in `app/src/quiz.js`; they are not computed, so they are only as right as those pages and our reading of them. The 10 live ones use the prepared sites and days from 2022 to 2030.
- The landers and hats are drawn in code by the team with AI help: simplified shapes and patterns, no photos, no real person. The Russian and Kyrgyz texts were drafted with AI, and the check by native speakers is still to be done. All 341 texts of the toys stand side by side in three languages on one page for that check: https://lunar-navigator-explained.web.app/texts.html (written by `npm run texts`; `npm test` fails when the page is older than the app's texts).

Each toy has a browser test. They open the app in Chrome (the tools look for it at the macOS default path), play the toy like a child and compare what it shows with the app's own verdicts:

```bash
node tools/test-lander.cjs
node tools/test-game.cjs
node tools/test-ice.cjs
node tools/test-quiz.cjs
```

By default they serve `app/` themselves. Environment variables: `BASE_URL=https://lunar-navigator-404.web.app` tests a deployed site instead, `VIEWPORT=390x844` sets the window (default 1440x900, 390x844 is a phone), `SHOTS=/some/folder` is where they save screenshots. One line per check, exit code 1 on any failure.

## How we know it is right

| Claim | Check | Result |
|---|---|---|
| Sun and Earth positions (`app/sky.js`, astronomy-engine with the IAU lunar rotation model) match NASA JPL Horizons | `npm run validate` (needs internet) | run 14 Nov 2026: worst 0.0047° (limit 0.1°), PASS |
| The same positions match an independent JPL DE440 series computed by the Python pipeline, at four sites over 2027 to 2028 | `npm test` | under 0.01° |
| Real landings: at Chandrayaan-3's site the model's sunrise is 21 Aug 2023 and its sunset 4 Sep 2023, the day ISRO put the lander to sleep; at Chang'e 6's site Earth never rises (the mission used a relay satellite); at IM-1's site the Sun sets on 3 Mar 2024 | `npm test`, `npm run smoke` | passes |
| Share of time with Sun and with Earth in view, against NASA Goddard's polar illumination maps (PGDA, Mazarico et al. 2011, 60 m) at all twenty points | `node tools/validate-pgda.cjs sun.img earth.img` writes `app/data/pgda.json`; `npm test` checks it | Earth: mean difference 3.3 points, r 0.97. Sun: r 0.92, ours higher by 11.4 points on average |
| Each rule passes at its limit and fails just past it; three languages have the same texts | `npm test` | passes |
| The app works end to end: fifteen sites, the timeline cells equal the site verdicts, the period can be set, the map turns, eleven checks, any date, three languages, phone width | `npm run smoke` | passes |
| Keep me alive ends the way the verdict says | `node tools/test-game.cjs` replays random landings (50 first, then a spread over every point, then 50 with random battery and radio limits) and compares the game's outcome, its reason, the first failure in time and the numbers it shows with `judgeAt`, and the grid cell colour where the grid judges that point; then plays a green day and a red day to the end in a browser | run it to see (not recorded here) |
| The Quiz is built right and its live questions are true to the app | `node tools/test-quiz.cjs` checks the pool is 25 questions (15 fixed, 10 live), each with four distinct options and exactly one right, with every text present in English, Russian and Kyrgyz and none equal to the English one; asks each live question 40 times and compares the right option with `judgeAt` and with the grid cell; checks six facts that fixed questions state against the hourly model (Earth in view share, the night check in Feb to Jul 2027, the 354 day repeat, Sun share, highest Sun, the two dark crater floors); plays a round with real clicks in three languages and checks that the card fits the screen for all 25 questions x 3 languages. It checks that the Russian and Kyrgyz texts exist and differ from English; it does not check that they are good Russian or Kyrgyz | run it to see (not recorded here) |
| Ice hunter says "dark" only when the hourly Sun data says so | `node tools/test-ice.cjs` taps permanently dark crater floors (Shackleton floor, Faustini floor) and the lit Connecting ridge, and compares the share of lit hours on the card with the share recomputed from the hourly series; checks the card wording ("could", never "there is ice"), the counter, that pressing "Ice hunter" again clears every point and the count (a late answer included), and the three languages | run it to see (not recorded here) |
| A first visit explains itself | `node tools/test-tour.cjs` opens the app as a new visitor: the tour starts by itself, each of its five steps lights the thing it names and its card stays on the screen, the lit button can be pressed, the first press on each toy shows its goal and numbered steps and "Start" then starts it, a tap on the label "Shackleton floor" in Ice hunter finds a dark spot and does not open the site, Keep me alive on the first screen opens a site and the game, in three languages; at 1440x900, 1920x1080 and 390x844 | run it to see (not recorded here) |
| The toys work in Safari too | The browser tests of the toys take `ENGINE=webkit` (for example `ENGINE=webkit VIEWPORT=390x844 node tools/test-tour.cjs`) and then play in WebKit, the engine of Safari and of every iPhone browser | run it to see (not recorded here) |

The horizon at each site is ray-marched on LOLA `LDEM_80S_80M` (80 m) by the pipeline in `pipeline-3d/`.

## Run it

```bash
npm install
cd app && python3 -m http.server 8000   # then open http://localhost:8000
```

The app is static files, but it needs a web server (it loads ES modules and data files). `npm run deploy` publishes it to Firebase Hosting.

## What is where

| Path | What |
|---|---|
| `app/index.html`, `app/src/`, `app/css/` | the app (three.js) |
| `app/src/verdict.js` | the answer panel |
| `app/src/allsites.js` | the timeline of every site on the map screen |
| `app/src/custom.js` | a site the user adds: horizon and ground built in the browser |
| `app/mission.js`, `app/sky.js`, `app/i18n.js` | the rules, the Sun and Earth positions, the texts |
| `app/src/lander.js`, `lander-models.js`, `game.js`, `ice.js`, `quiz.js`, and `app/i18n-lander.js`, `i18n-game.js`, `i18n-ice.js`, `i18n-quiz.js` | the four toys for children and their texts in three languages |
| `tools/test-lander.cjs`, `test-game.cjs`, `test-ice.cjs`, `test-quiz.cjs` | one browser test per toy (see "Four toys for children") |
| `app/data/` | terrain and horizon for the twenty points (fifteen sites, five with a best spot within 500 m) |
| `app/data/polar320.bin` | LOLA `LDEM_80S_80M` averaged to 320 m, for added polar points (`pipeline-3d/pipeline/mid.py`) |
| `pipeline-3d/` | the offline Python pipeline that built `app/data/`. `sh pipeline-3d/add-sites.sh` builds the team's nine sites, then `node tools/eva-slope.cjs` writes the 2 km slope values |
| `tools/` | `test.cjs`, `smoke.cjs`, `validate-horizons.cjs`, `record-demo.cjs`, `deck-pdf.cjs` (slides to PDF, `npm run deck`) |
| `explainer/` | the "How it works" page and `lesson.html`, a 45 minute school lesson in English, Russian and Kyrgyz |
| `tools/validate-pgda.cjs`, `app/data/pgda.json` | the comparison with NASA's polar illumination maps |

## Limits, stated plainly

- Fifteen sites, twenty points. Adding a site means running the pipeline for it.
- The nine team sites are not NASA candidate sites. Each is the best-lit point on a named crater's rim, or the lowest point of its floor, that we found on LOLA terrain. Each was checked against JPL Horizons like the six Data Book sites (worst 0.47 arcseconds).
- On sharp ridges our share of time in sunlight is higher than NASA's own maps (by 11 points on average over the twenty points, more at the "best spot" points). Three differences could cause it and we have not separated them: we stand 2 m above the ground where NASA's map is at the surface, our terrain is 80 m where theirs is 60 m, and each best spot was chosen as the brightest point on our own terrain. Read ridge-top Sun numbers as an upper estimate.
- The model judges a place and a day, not a touchdown: it passes IM-2's site and day, and the real lander fell on its side.
- Terrain is 80 m per pixel; a rock or a small crater below that size is not in the data.
- The 2 day, 3 day and 24 hour limits are our teaching values, not NASA requirements. For scale, NASA states that its VIPER rover cannot endure more than 50 hours of continuous darkness (science.nasa.gov/mission/viper/lunar-operations).
- Future dates come from the orbit model; we compared it with NASA data for 2026 to 2028, not for every year.
- The four toys for children have their own limits, listed under "Four toys for children": 320 m terrain for a spot a child picks, Ice hunter only says ice "could" hide, Keep me alive is a teaching rule and not a real power system.

## Credits and data

- 3D view, terrain pipeline and horizon masks: teammate [steppekid](https://github.com/steppekid/lunar_3d_nasa_hackathon).
- Answer panel, rules, any-date positions, checks: team 404 agents.
- NASA LRO LOLA `LDEM_80S_80M`, PDS Geosciences Node; NASA JPL DE440 and Horizons; site coordinates from NASA M2M-30044 *Lunar Surface Data Book*; NASA Artemis III landing site requirements. Full list with links: `app/ATTRIBUTION.md`.
- Software: three.js (MIT), astronomy-engine (MIT).
- Use of AI (SI) tools: `docs/SI-usage.md`.

Licence: Apache-2.0.
