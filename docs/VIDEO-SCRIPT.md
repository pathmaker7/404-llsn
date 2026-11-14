# Demo film script (29.5 seconds, with voice)

The film is made by a script that uses the real app as a person would (`npm run video`): Playwright opens the live
app, tries the hats in the My lander card, clicks a green day (the lander drops onto the Moon and the site opens),
plays the battery game, hunts ice in Shackleton crater, answers a live quiz question, and replays Chandrayaan-3. A synthetic voice (ElevenLabs text to speech, voice "Sarah") then reads each caption
word for word at the moment it appears (`tools/narrate.cjs`); the captions are the English subtitles of the voice.
Order follows the Space Apps submission guide: who we are, the challenge and title, how it works with NASA data, what
it does for people. No real person appears or speaks (no one under 18 may appear). The watermark "Made with AI (SI)
tools: Claude. Synthetic voice." stays on screen the whole time, and the file metadata names the voice, as the rules
require for generated video and audio.

Pick the voice together: https://lunar-navigator-explained.web.app/voices.html (the whole film in six voices, and
short samples of fourteen). Then rebuild with the chosen name, about one minute, no re-recording:
`npm run narrate -- "Samantha (English (US))"`. The default is Daniel (English (UK)).

A team member's own voice: one recording at https://lunar-navigator-explained.web.app/record.html (press Record,
read all nine lines slowly, slips and restarts allowed, press Stop; my-voice.webm downloads, nothing is uploaded).
`node tools/align-take.cjs ~/Downloads/my-voice.webm` finds every line by ElevenLabs speech to text (the last good
attempt of a line wins), shortens pauses, cleans and levels the voice; then re-record the film with the voice notice
and lay the take under it:
`VOICE_NOTE="Voice: Manuchehr, team member" npm run video` and
`VOICE_NOTE="Voice: Manuchehr, team member" MAX_TEMPO=1.5 npm run narrate -- ~/Downloads/my-voice.aligned.wav "Manuchehr"`.

A recorded voice works too, for example the ElevenLabs voice "The Professional Presenter": paste
docs/VOICE-TAKE.txt (the nine lines, numbers written as spoken, a blank line between lines) as ONE take, download
the mp3, then `npm run narrate -- ~/Downloads/take.mp3 "ElevenLabs, The Professional Presenter"`. The take is cut at
its eight longest pauses, one clip per caption, unless CUTS gives the times. An earlier film used the take kept in
docs/voice-take-presenter.mp3 (eight older lines). The submitted film uses docs/voice-take-sarah.mp3: each of the nine
lines spoken by the ElevenLabs stock voice Sarah (model eleven_multilingual_v2, speed 1.1), joined with 1.5 second gaps,
checked word for word by speech to text (`node tools/align-take.cjs docs/voice-take-sarah.mp3`, every line 100%), then
`MAX_TEMPO=1.25 npm run narrate -- docs/voice-take-sarah.aligned.wav "ElevenLabs text to speech, voice Sarah"`. No line
needed speeding up (the narrator printed x1.00 for all nine); it stops and names a line that does not fit. The metadata then names that voice instead of Apple text to speech.

| Time | On screen (what the script clicks) | Voice and caption | Which judging criterion it serves |
|---|---|---|---|
| 0:00.0 to 0:03.1 | The whole Moon with the My lander card; the team's names under the caption | Hi, we're team 404 agents from Naryn, Kyrgyzstan. | Presentation: who we are |
| 0:03.1 to 0:05.3 | The hats in the My lander card are tried one after another: Kazakh kalpak, Uzbek doppi, Tajik toqi, Kyrgyz ak kalpak | When can a Moon landing survive? | Relevance: the challenge in one question |
| 0:05.3 to 0:09.6 | A click on a green day of the best site: the lander with its ak kalpak flies from the cell down to the Moon, brakes, lands, lights up green and says "I made it!" | Lunar Landing Site Navigator: pick a day, and your lander drops in. | Creativity: a child lands their own lander, with Central Asian identity |
| 0:09.6 to 0:13.6 | The app flies down to the site: MISSION SURVIVED, and the lander stands on the terrain under the real Sun | Green means it survives, on real NASA terrain. | Relevance: NASA LOLA terrain is the ground you stand on; Validity: one survival rule |
| 0:13.6 to 0:17.6 | "Play: Keep me alive", a landing day with a 41 hour shadow (26 January 2028), four times speed: the battery drains with the Sun hidden and fills again | Play Keep me alive: the battery drains in real shadow. | Creativity and Impact: the survival rule as a game on real Sun and Earth data |
| 0:17.6 to 0:21.0 | Back to all sites, Ice hunter on, a tap on the floor of Shackleton crater: "The Sun never reaches here!", a sparkle, the NASA LCROSS line | Hunt dark craters where water ice could hide. | Impact: why shadowed craters matter, said with "could" |
| 0:21.0 to 0:23.6 | Quiz: a live question (a real site and day, answer computed by the app), answered right: "Correct!" | Then test yourself in the quiz. | Impact: a lesson teachers can run |
| 0:23.6 to 0:27.5 | Replay a real landing: Chandrayaan-3, with the "what really happened" box | For Chandrayaan-3, our sunset is the day India put it to sleep. | Validity: checked against a real mission |
| 0:27.5 to 0:29.5 | The replay box and the lander on the site | Free for schools across Central Asia. | Impact: who it is for |

The voice says "four oh four" and "Chandrayaan three" where the captions show the digits. The film is 29.52 seconds
(official rule: "The video pitch must be 30 seconds or less."). The recorder stops if a caption is faster than 3.7 words
a second (the fastest is 3.1), if the dropped lander does not survive on the green day, if the ice hunter spot is not
dark in the model, or if no surviving day with a long shadow exists for the battery game.

## What the two cycles are (so whoever speaks can explain them)

Measured in the app on 14 Nov 2026 (best site, Peak near Shackleton, 2021 to 2031):

| Cycle | What you see | Why | Proof |
|---|---|---|---|
| Earth, about 27 days | One short green window a month | Seen from the pole, Earth is near the horizon and the Moon nods up and down (libration), so Earth is up for about two weeks and hidden for about two weeks (measured: 13 to 17 days up at most sites); a 14 day stay that tolerates 3 days of silence fits only when it lands in the first days Earth is up, about a week of landing days | in Nov to Jan and Aug to Oct the failing check is "radio" on 22 to 24 days a month |
| Sun, about a year | Months with almost no green (Feb to Jul 2027) | The Moon's axis tilts 1.5 degrees, so for part of the year the Sun stays so low that hills hide it for days | in Feb to Jul 2027 the failing check is "night" on 14 to 21 days a month |
| Both together, 354 days | The green clusters return about 11 days earlier each calendar year | 12 lunar months = 354 days, shorter than our 365 day year (the same reason Orozo comes about 11 days earlier every year) | strongest repeat in the survival series at 354 days for 9 of the 10 sites with any green day (the tenth, Mons Mouton, peaks at 679, about two of these cycles) |

The share of surviving days barely changes from year to year (16 to 22% at the best site), so there is no long trend:
the pattern is the cycles.
