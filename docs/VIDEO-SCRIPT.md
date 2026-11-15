# Demo film script (29.5 seconds, with voice)

The film is made by a script that uses the real app as a person would (`npm run video`): Playwright opens the live
app, tries the hats in the My lander card, plays the sunlight over the pole, clicks a green day (the lander drops onto
the Moon and the site opens), plays the battery game, then goes back and scrolls out to the whole Moon. It tells one
story in five scenes: the problem, the tool, the NASA data, the game, and why we built it. The film before it (15 Nov
2026, morning) showed seven features in 26 seconds and gave "who it is for" its last 2 seconds; a viewer with no context
could not say what the project is for. Ice hunter, the quiz and the Chandrayaan-3 replay are in the app and in the
project description, not in the film. A synthetic voice (ElevenLabs text to speech, voice "Sarah") then reads each caption
word for word at the moment it appears (`tools/narrate.cjs`); the captions are the English subtitles of the voice.
Order follows the Space Apps submission guide: who we are, the challenge and title, how it works with NASA data, what
it does for people. No real person appears or speaks (no one under 18 may appear). The watermark "Made with AI (SI)
tools: Claude. Synthetic voice." stays on screen the whole time, and the file metadata names the voice, as the rules
require for generated video and audio.

Pick the voice together: https://lunar-navigator-explained.web.app/voices.html (the whole film in six voices, and
short samples of fourteen). Then rebuild with the chosen name, about one minute, no re-recording:
`npm run narrate -- "Samantha (English (US))"`. The default is Daniel (English (UK)).

A team member's own voice: one recording at https://lunar-navigator-explained.web.app/record.html (press Record,
read all seven lines slowly, slips and restarts allowed, press Stop; my-voice.webm downloads, nothing is uploaded).
`node tools/align-take.cjs ~/Downloads/my-voice.webm` finds every line by ElevenLabs speech to text (the last good
attempt of a line wins), shortens pauses, cleans and levels the voice; then re-record the film with the voice notice
and lay the take under it:
`VOICE_NOTE="Voice: Manuchehr, team member" npm run video` and
`VOICE_NOTE="Voice: Manuchehr, team member" MAX_TEMPO=1.5 npm run narrate -- ~/Downloads/my-voice.aligned.wav "Manuchehr"`.

A recorded voice works too, for example the ElevenLabs voice "The Professional Presenter": paste
docs/VOICE-TAKE.txt (the seven lines, numbers written as spoken, a blank line between lines) as ONE take, download
the mp3, then `npm run narrate -- ~/Downloads/take.mp3 "ElevenLabs, The Professional Presenter"`. The take is cut at
its six longest pauses, one clip per caption, unless CUTS gives the times. An earlier film used the take kept in
docs/voice-take-presenter.mp3 (eight older lines of an earlier film). The submitted film uses docs/voice-take-sarah.mp3: each of the seven
lines spoken by the ElevenLabs stock voice Sarah (model eleven_multilingual_v2, speed 1.1), joined with 1.5 second gaps,
checked word for word by speech to text (`node tools/align-take.cjs docs/voice-take-sarah.mp3`, every line 100%), then
`MAX_TEMPO=1.25 npm run narrate -- docs/voice-take-sarah.aligned.wav "ElevenLabs text to speech, voice Sarah"`. No line
needed speeding up (the narrator printed x1.00 for all seven); it stops and names a line that does not fit. The metadata then names that voice instead of Apple text to speech.

| Time | On screen (what the script clicks) | Voice and caption | Part of the official video order |
|---|---|---|---|
| 0:00.0 to 0:03.4 | The first screen: the Moon's south pole, the day table, the team's names; the hats in the My lander card are tried one after another, ending on the Kyrgyz ak kalpak | Hi, we're team 404 agents from Naryn, Kyrgyzstan. | [0:00] Introduce yourself |
| 0:03.4 to 0:07.6 | The map's play button: sunlight sweeps over the pole, the orange line crosses the green and red days | At the Moon's south pole, one long shadow can kill a solar robot. | [0:02] Lead us in: the challenge |
| 0:07.6 to 0:12.0 | A click on a green day of the best site: the lander with its ak kalpak flies from the cell down to the Moon, lands, lights up green and says "I made it!" | Lunar Landing Site Navigator: pick a day, and your lander drops in. | [0:05] Name your project |
| 0:12.0 to 0:16.2 | The app flies down to the site: MISSION SURVIVED, and the lander stands on the terrain under the real Sun | Green means it survives, on real terrain from NASA's open data. | [0:10] Describe your idea: how it works, NASA open data |
| 0:16.2 to 0:20.3 | "Play: Keep me alive", a landing day with a 41 hour shadow (26 January 2028), four times speed: the battery drains with the Sun hidden | Kids learn by playing: keep the battery alive in the dark. | [0:10] Describe your idea: a user's experience |
| 0:20.3 to 0:24.6 | Back to all sites, sunlight playing; the view scrolls out to the whole Moon | We built it so every student can learn how a real Moon mission is planned. | [0:20-0:30] Look into the future: why we built it |
| 0:24.6 to 0:29.5 | Over the whole Moon: the project's name, lunar-navigator-404.web.app, "Free · Any browser · English, Russian, Kyrgyz" | No telescope, no lab: just a browser. Free, starting with schools here in Central Asia. | [0:20-0:30] Look into the future: what it does for people |

The order is the one the submission guide gives for a video (https://www.spaceappschallenge.org/resources/project-submission-guide/):
"[0:00] Introduce yourself", "[0:02] Lead us in", "[0:05] Name your project", "[0:10] Describe your idea", "[0:20-0:30] Look into
the future: ... What can your proposed solution do for people, the world, and beyond?". The last line says what a student
needs (a browser), not what schools lack: we have no count of school equipment in Central Asia, so the film does not claim one.

The voice says "four oh four" where the caption shows the digits. The film is 29.52 seconds
(official rule: "The video pitch must be 30 seconds or less."). Each spoken line ends 0.4 to 1.6 seconds before the next
caption (measured by speech to text on the finished film). The recorder stops if a caption is faster than 3.7 words
a second (the fastest is 3.5), if the dropped lander does not survive on the green day, if the site opens too late for
its line, or if no surviving day with a long shadow exists for the battery game.

The file is written so that any device plays it (`tools/narrate.cjs`): H.264 picture, 1920x1080, 25 frames a second, the
ordinary pixel format (yuv420p); AAC sound, 48 kHz, stereo, the voice on both sides; the index at the front of the file,
so it starts in a browser before it has all arrived.

## What the two cycles are (so whoever speaks can explain them)

Measured in the app on 14 Nov 2026 (best site, Peak near Shackleton, 2021 to 2031):

| Cycle | What you see | Why | Proof |
|---|---|---|---|
| Earth, about 27 days | One short green window a month | Seen from the pole, Earth is near the horizon and the Moon nods up and down (libration), so Earth is up for about two weeks and hidden for about two weeks (measured: 13 to 17 days up at most sites); a 14 day stay that tolerates 3 days of silence fits only when it lands in the first days Earth is up, about a week of landing days | in Nov to Jan and Aug to Oct the failing check is "radio" on 22 to 24 days a month |
| Sun, about a year | Months with almost no green (Feb to Jul 2027) | The Moon's axis tilts 1.5 degrees, so for part of the year the Sun stays so low that hills hide it for days | in Feb to Jul 2027 the failing check is "night" on 14 to 21 days a month |
| Both together, 354 days | The green clusters return about 11 days earlier each calendar year | 12 lunar months = 354 days, shorter than our 365 day year (the same reason Orozo comes about 11 days earlier every year) | strongest repeat in the survival series at 354 days for 9 of the 10 sites with any green day (the tenth, Mons Mouton, peaks at 679, about two of these cycles) |

The share of surviving days barely changes from year to year (16 to 22% at the best site), so there is no long trend:
the pattern is the cycles.
