# Demo film script (29 seconds)

The film is recorded from the real app by `npm run video` (`tools/record-demo.cjs`), so the captions below are the
exact on-screen text. Its story is a lesson for students in Kyrgyzstan and Central Asia: how Moon landings are planned,
and the two cycles that decide which days work. Order follows the Space Apps submission guide: who we are, the
challenge, the title, how it works with NASA data, what it does for people. No voice and no person appear in it (no one
under 18 may appear). A visible "Made with AI (SI) tools" watermark stays in the top right corner the whole time.

| Time | On screen | Caption | Words per second |
|---|---|---|---|
| 0:00 to 0:03 | The whole Moon, gliding to the south pole | Team 404 agents, Naryn: Manuchehr, Aruzhan, Kairat, Arsen, Amirbek | 3.0 |
| 0:03 to 0:06 | The Moon is dragged and turns; the app title is in the top bar | Lunar Landing Site Navigator: which days can a Moon mission survive? | 3.6 |
| 0:06 to 0:10 | "Next year" pressed: one green window per month, and a dark season with almost none | One year: green, the mission survives. Earth is up one week a month. | 3.3 |
| 0:10 to 0:13.5 | "Next 5 years" pressed: the green clusters come back every year | Five years: with the Sun's dark season, it repeats every 354 days. | 3.4 |
| 0:13.5 to 0:16.5 | Back to one month; the best site's first green day is clicked; fly down; look at the Sun | Click a green day. Stand on real NASA terrain. | 3.0 |
| 0:16.5 to 0:20 | MISSION SURVIVED, eleven checks, and play: the Sun moves along the horizon | One answer, eleven checks. The Sun slides along the horizon. | 2.9 |
| 0:20 to 0:25 | Chandrayaan-3 replayed at its real touchdown, with the "what really happened" box | Chandrayaan-3, replayed: our sunset matches the day India put it to sleep. | 2.4 |
| 0:25 to 0:29 | The replay box and the 3D view | Built for schools in Kyrgyzstan and Central Asia: Kyrgyz, Russian, English. | 2.8 |

Words per second are measured by the recorder from the real time each caption stayed on screen; it fails if any
caption is faster than 3.7, since a judge watches once. The film: https://lunar-navigator-explained.web.app/demo-30s.mp4
(plays in the browser; the GitHub file link downloads instead).

## What the two cycles are (so whoever speaks can explain them)

Measured in the app on 14 Nov 2026 (best site, Peak near Shackleton, 2021 to 2031):

| Cycle | What you see | Why | Proof |
|---|---|---|---|
| Earth, about 27 days | One short green window a month | Seen from the pole, Earth is near the horizon and the Moon nods up and down (libration), so Earth rises for about a week and sets again | in Nov to Jan and Aug to Oct the failing check is "radio" on 22 to 24 days a month |
| Sun, about a year | Months with almost no green (Feb to Jul 2027) | The Moon's axis tilts 1.5 degrees, so for part of the year the Sun stays so low that hills hide it for days | in Feb to Jul 2027 the failing check is "night" on 14 to 21 days a month |
| Both together, 354 days | The green clusters return about 11 days earlier each calendar year | 12 lunar months = 354 days, shorter than our 365 day year (the same reason Orozo comes about 11 days earlier every year) | strongest repeat in the survival series at 354 days for 9 of the 10 sites with any green day (the tenth, Mons Mouton, peaks at 679, about two of these cycles) |

The share of surviving days barely changes from year to year (16 to 22% at the best site), so there is no long trend:
the pattern is the cycles.

## If you record a spoken version instead

The guide allows speech in another language only with English subtitles; the captions above are those subtitles.
Read calmly, one line per row, about 2.5 words per second:

1. "We are team 404 agents from Naryn, Kyrgyzstan."
2. "Lunar Landing Site Navigator: which days can a Moon mission survive?"
3. "In one year at the south pole, Earth is up one week a month, and the Sun has a dark season."
4. "Over five years the pattern repeats every 354 days. Planners pick dates from cycles like this."
5. "It is built on NASA terrain. Click a green day and stand on the site."
6. "Mission survived: one answer, eleven checks. Watch the Sun slide along the horizon."
7. "We replayed Chandrayaan-3: our sunset matches the day India put it to sleep."
8. "For schools in Kyrgyzstan and Central Asia, in Kyrgyz, Russian and English."

Keep the film at 30 seconds or less: a longer film is not eligible for Global Judging.
