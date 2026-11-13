# Demo video script

The Project Submission Guide (published 13 Nov 2026) sets the rules: "Format: Video (30 seconds or less) or slide deck (up to seven slides including title and intro slides)." "Projects that exceed these limits will not be eligible for Global Judging." So **the submitted demo is a 30-second cut**. An automatic version already exists: `docs/demo-30s.mp4` (29 s, English captions, no voice, a visible SI watermark; it shows the guided mission), made by `node tools/record-demo30.cjs` (what it shows is listed under "The automatic cut" below). The table in "30-second cut" is the script for a voiced version with the guide's beats. The 2-minute script further down is a long walkthrough, not for submission.

Rules that apply to the video:

- 30 seconds or less, hosted on an external site (YouTube, Google Drive and so on) at a link that is publicly accessible. Test the link in a private window.
- English on the submission page and in linked materials. The voice may be another language only if the video has English subtitles ("it MUST include English language subtitles"). The voice-over column below doubles as the subtitle text.
- SI marks: "Images and videos: Must include a visible watermark to indicate SI generation." "Audio: Must acknowledge SI generation in descriptive text and metadata." If the video keeps a synthetic voice (macOS `say`) or generated footage, it must carry a visible "made with AI tools" style watermark and say so in its description and metadata. `docs/demo-30s.mp4` already draws a watermark ("Made with AI (SI) tools: code, footage and captions by Claude, checked by team 404 agents") and carries the same words in its metadata comment; a voiced version should keep both. Write the same sentence in the video description on YouTube or Drive.
- No faces, voices or names of anyone under 18; only music and images we have the rights to (we use none); NASA gets a licence to the video.
- Every number comes from `npm run results`, `npm run validate` or `npm run crosscheck`, or is read off the app screen on the day of recording. Do not type a number into the video that the app did not show.

## 30-second cut (the submitted demo)

Built around the guided mission, following the guide's suggested beats: team name, the challenge, project name and tagline, how it works with the app on screen, the future. The story: the question "Can your robot survive 14 days on the Moon?", press "Start the mission", pick the Ridge and the robot survives, then "the rocket slips 21 days", the same spot is lost, and you replan to the Plateau, which survives. The full planner for experts is one click away.

| Time | Guide beat | On screen (with the on-screen text) | Voice-over |
|---|---|---|---|
| 0:00 to 0:03 | team name, the challenge, project name | Dark card. Text: "Team 404 agents, Naryn, Kyrgyzstan" and "NASA Space Apps 2026: Lunar Landing Site Navigator" | "Team 404 agents, Naryn. Lunar Landing Site Navigator." |
| 0:03 to 0:07 | the problem | The app's first screen with the question "Can your robot survive 14 days on the Moon?". Text: "At the Moon's south pole, one hill can hide the Sun or the Earth for days." | "On the Moon, one hill can hide the Sun for days." |
| 0:07 to 0:15 | how it works | Press "Start the mission", click the Ridge. The verdict THE ROBOT SURVIVED appears; hold on the two lines with numbers and the sky view, press ▶ in the 3D view. Text: "Choose where the robot lands. Real NASA data decides." | "Start the mission. Choose the ridge. It survives." |
| 0:15 to 0:19 | how it works | Press "Next: news from the launch pad". The landing moves to 12 August 2027 and the same spot shows THE ROBOT WAS LOST. Text: "The rocket slips 21 days. The same spot is lost." | "The rocket slips twelve days. Same spot: lost." |
| 0:19 to 0:23 | how it works | Click the Plateau. THE ROBOT SURVIVED. Text: "Replan: the Plateau survives. The place matters, and so does the date." | "Replan: the plateau survives." |
| 0:23 to 0:26 | how it works | Go to the last screen, press "Open the full planner". Text: "For experts: the full planner, any site on the Moon, any date." | "Experts get the full planner: any place, any date." |
| 0:26 to 0:29 | the future | End card. Text: "Lunar Landing Site Navigator: a lunar mission anyone can play in two minutes", "Works offline. English, Russian, Kyrgyz. Next: relay satellites, finer terrain, class mode." and "lunar-navigator-404.web.app" | "Offline, in three languages." |

About 54 spoken words in 29 seconds, so the pace is brisk but calm. The voice is an adult's voice, or the macOS placeholder voice (then the watermark is mandatory).

Watermark: a small box in the bottom right corner for the whole video, readable on a phone, text "Made with AI tools" (add "synthetic voice" if the placeholder voice is used). Repeat it in the video description and in the file metadata.

Before recording, play the mission once: on 22 July 2027 the Ridge must survive, after the delay it must be lost, and the Plateau must survive. The browser test (`npm run smoke`) fails if that story stops being true, but the pass or fail words and numbers on screen come from the app; this script does not promise a number. (In the 14 Nov build the Ridge's longest radio silence is 2.5 days on 22 July 2027 and 4.2 days after the delay; read them off the app again on the day.)

## The automatic cut (docs/demo-30s.mp4)

What `tools/record-demo30.cjs` shows, as coded on 13 Nov (if that file changes, the file wins). Seconds are from the start; the text is drawn as a caption, there is no voice.

| Seconds | Screen | Caption |
|---|---|---|
| 0 to 3 | the app's first screen | "Team 404 agents, Naryn. NASA Space Apps 2026: Lunar Landing Site Navigator" |
| 3 to 6.5 | the same | "At the Moon's south pole, one hill can hide the Sun or the Earth for days." |
| 6.5 to 10 | click "Start the mission" | "You choose where a robot lands. Real NASA terrain decides if it survives." |
| 10 to 15.5 | click the Ridge, then ▶ in the 3D view | "Ridge, landing 22 July 2027: the robot survives." |
| 15.5 to 19.5 | click "Next: news from the launch pad" | "Then the rocket slips 21 days, as real launches do. The same spot is lost." |
| 19.5 to 23 | click the Plateau | "Replan: the plateau survives. The place matters, and so does the date." |
| 23 to 24 | the last screen, "What you just learned" | (the previous caption stays) |
| 24 to 26.5 | click "Open the full planner" | "For experts: the full planner, any site on the Moon, any date, checked against NASA JPL Horizons." |
| 26.5 to 29 | the full planner | "Runs offline in English, Russian and Kyrgyz: for planners, teachers and every classroom." |

Watermark, bottom right for the whole video: "Made with AI (SI) tools: code, footage and captions by Claude, checked by team 404 agents".

## Three video ideas

Each is a different 30-second concept. All three still need the guide's beats in the first 10 seconds (team name, the challenge, project name and tagline), the watermark note above, and English subtitles.

**1. The delay story (the main cut above, tighter).**
- Open on the Ridge landing on 22 July 2027 and show THE ROBOT SURVIVED.
- Then the line "The rocket slips 21 days" and the same spot on 12 August 2027: THE ROBOT WAS LOST.
- Split screen: the verdict before the delay and after it, with the real numbers from the app (the longest radio silence, 2.5 days then 4.2 days, against the 3 day limit).
- End on the replan to the Plateau, which survives.
- Voice: "One mission. Twelve days of delay. Will it still survive?" The answer on screen is what the app really says.

**2. One day, two fates.**
- Start on the south pole map with the four spots marked. Text: "Same Moon. Same day. Four places."
- Click the Crater wall: THE ROBOT WAS LOST (dark and too steep). Press "Try another spot" and click the Ridge: THE ROBOT SURVIVED. Show the sky view of each, with the Sun in yellow, Earth in blue and the hills in grey.
- Voice: "Same day. On the ridge the robot survives. On the crater wall the Sun never comes and the ground is too steep. The place decides."
- End on "Choose where you land."

**3. Naryn versus the Moon sky.**
- Go to the last screen of the mission, to the line "The Moon is not Earth". It compares the Sun over Naryn on 22 July 2027 with the four spots. Show it full screen.
- Voice: "This is the Sun over Naryn. This is the Sun at the Moon's south pole. It barely clears the horizon."
- Text at the end, from the app: "There is no air, so no twilight: shadows are black."
- Do not type the numbers into the script from memory: read them off the app on the day and put them on screen. In the 13 Nov build the app shows 69° and about 15 hours in Naryn, and never more than 1° above a level horizon at the four spots.

## 2-minute cut

Long walkthrough of the expert planner, not for submission (it is over the 30 second limit). `npm run video` builds docs/demo.mp4 from this table.

| Time | Screen | Voice-over |
|---|---|---|
| 0:00 to 0:12 | Title card | "At the Moon's south pole the Sun never climbs more than a few degrees. A ridge one degree high can mean weeks of night, and Earth disappears for days." |
| 0:12 to 0:25 | Whole Moon map, then the pole | "NASA's tools for this, Quickmap, Moon Trek and JPL Horizons, are built for specialists. We made one screen that answers: which site, which date." |
| 0:25 to 0:45 | Live shadows on, press play | "We take NASA's LOLA laser terrain, march the real horizon in every direction, and put the true Sun and Earth into that sky every hour." |
| 0:45 to 1:05 | Table and panorama on Shackleton rim | "Shackleton's rim gets sunlight 87% of the year, but loses Earth for up to 14 days, and the crater wall within 2 kilometres is 34 degrees steep, so it passes 4 of NASA's 5 Artemis III checks." |
| 1:05 to 1:20 | Neighbourhood map | "And a few hundred metres matter: within 2.4 kilometres of that point, sunlight ranges from zero to 87%." |
| 1:20 to 1:35 | Add Chang'e 4 and Apollo 11 | "Anywhere on the Moon: Apollo 11 always sees Earth but faces a 15-day night. Chang'e 4 on the far side never sees Earth, which is why China sent a relay satellite." |
| 1:35 to 1:50 | README verification table | "We checked it against NASA: Sun and Earth positions match JPL Horizons to 0.005 degrees, and our sunlight matches NASA's published illumination maps to a median of 0.3 percentage points." |
| 1:50 to 2:00 | End card: repo link, "NASA Space Apps 2026, Naryn" | "Open source, offline, in English, Russian and Kyrgyz. Pick a site, pick a date, see the sky." |

## How to record

1. 30-second cut, automatic: `node tools/record-demo30.cjs` writes docs/demo-30s.mp4 (29 s, 1920x1080, captions and watermark drawn on the page, no audio). It is ready to upload as it is. Voiced version: record the screen by hand (macOS Shift+Command+5, 1920x1080), rehearse the clicks twice so each step lands in its time slot, then trim and add the title and end cards in any editor, plus the watermark and the English subtitles (the voice-over column). `node tools/record-demo.cjs` records only the long walkthrough.
2. Voiced version only: an adult team member reads the voice-over column in one take (QuickTime, New Audio Recording). No music.
3. Upload to YouTube or Google Drive, set the link to public, write "Made with AI tools" in the description, and open the link in a private window.
4. Long walkthrough: `node tools/record-demo.cjs` writes docs/video/demo-footage.mp4 (1920x1080) following the 2-minute cut's screen column. Title and end cards are rendered by `npm run video`, which joins title card, footage, end card and voice into docs/demo.mp4 (120 s, 1080p). Without an argument it voices the 2-minute table with macOS `say` (Samantha) as a placeholder; with a real recording: `node tools/make-video.cjs voice.m4a`.
5. The owner approves before anything is uploaded.
