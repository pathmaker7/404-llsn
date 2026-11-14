# Demo film script (29 seconds, with voice)

The film is made by a script that uses the real app as a person would (`npm run video`): Playwright opens the live
app, turns the Moon, presses Next year and Next 5 years, clicks a green day, opens the Sun and Earth paths in the
Details panel, plays time, and replays Chandrayaan-3. A synthetic voice (Apple text to speech) then reads each caption
word for word at the moment it appears (`tools/narrate.cjs`); the captions are the English subtitles of the voice.
Order follows the Space Apps submission guide: who we are, the challenge and title, how it works with NASA data, what
it does for people. No real person appears or speaks (no one under 18 may appear). The watermark "Made with AI (SI)
tools: Claude. Synthetic voice." stays on screen the whole time, and the file metadata names the voice, as the rules
require for generated video and audio.

Pick the voice together: https://lunar-navigator-explained.web.app/voices.html (the whole film in six voices, and
short samples of fourteen). Then rebuild with the chosen name, about one minute, no re-recording:
`npm run narrate -- "Samantha (English (US))"`. The default is Daniel (English (UK)).

A recorded voice works too, for example the ElevenLabs voice "The Professional Presenter": paste
docs/VOICE-TAKE.txt (the eight lines, numbers written as spoken, a blank line between lines) as ONE take, download
the mp3, then `npm run narrate -- ~/Downloads/take.mp3 "ElevenLabs, The Professional Presenter"`. The take is cut at
its seven longest pauses, one clip per caption; a clip may be sped up by at most 12 percent, otherwise the narrator
stops and names the line that is too long. The metadata then names that voice instead of Apple text to speech.

| Time | On screen (what the script clicks) | Voice and caption | Which judging criterion it serves |
|---|---|---|---|
| 0:00 to 0:03.6 | The whole Moon; the team's names under the caption | Team 404 agents, Naryn, Kyrgyzstan. | Presentation: who we are |
| 0:03.6 to 0:06.3 | The Moon is dragged and turns; the title is in the top bar | Which days can a Moon mission survive? | Relevance: the challenge in one question |
| 0:06.3 to 0:10.2 | "Next year": short green windows each month, then empty months | Earth is up one week a month. The Sun has a dark season. | Impact: what a student learns |
| 0:10.2 to 0:14 | "Next 5 years": the green clusters return | Over five years, it repeats every 354 days. | Creativity: the pattern nobody else shows |
| 0:14 to 0:17.4 | "Next month", click the best site's first green day, fly down, look at the Sun | Click a green day. Stand on NASA terrain. | Relevance: NASA LOLA data is the ground you stand on |
| 0:17.4 to 0:22.2 | MISSION SURVIVED; Details panel: Sun and Earth paths on; time plays | Mission survived. Show paths, move time, set your limits. | Validity: a usable tool with real controls |
| 0:22.2 to 0:26.4 | Back to all sites; Replay a real landing: Chandrayaan-3, with the "what really happened" box | Chandrayaan-3: our sunset is the day India put it to sleep. | Validity: checked against a real mission |
| 0:26.4 to 0:29 | The replay box and the 3D view | Free for schools across Central Asia. | Impact: who it is for |

The voice says "four oh four" and "three fifty-four" where the captions show the digits. Every line was measured: at
185 to 215 words a minute each fits its moment for all six voices tested; the narrator stops with an error if a line
does not fit, and the recorder stops if a caption is faster than 3.7 words a second.

## What the two cycles are (so whoever speaks can explain them)

Measured in the app on 14 Nov 2026 (best site, Peak near Shackleton, 2021 to 2031):

| Cycle | What you see | Why | Proof |
|---|---|---|---|
| Earth, about 27 days | One short green window a month | Seen from the pole, Earth is near the horizon and the Moon nods up and down (libration), so Earth rises for about a week and sets again | in Nov to Jan and Aug to Oct the failing check is "radio" on 22 to 24 days a month |
| Sun, about a year | Months with almost no green (Feb to Jul 2027) | The Moon's axis tilts 1.5 degrees, so for part of the year the Sun stays so low that hills hide it for days | in Feb to Jul 2027 the failing check is "night" on 14 to 21 days a month |
| Both together, 354 days | The green clusters return about 11 days earlier each calendar year | 12 lunar months = 354 days, shorter than our 365 day year (the same reason Orozo comes about 11 days earlier every year) | strongest repeat in the survival series at 354 days for 9 of the 10 sites with any green day (the tenth, Mons Mouton, peaks at 679, about two of these cycles) |

The share of surviving days barely changes from year to year (16 to 22% at the best site), so there is no long trend:
the pattern is the cycles.
