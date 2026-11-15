# Project page text, ready to paste

Every field of the Space Apps project form, in the order the submission guide lists them
(https://www.spaceappschallenge.org/resources/project-submission-guide/). All text is in English, as the guide requires.
Before pressing "Submit for Judging": open every link below in a private window (no login), then tick "Terms and
Conditions" and "Confirm All Work is Original". Deadline: Sunday 15 November 2026, 23:59 Naryn time.

Do not attach any photo, video or voice of a person under 18 (the guide forbids it). A photo of the teacher, the lesson
sheet or the screen is fine.

## We take part online: the presentation

The team is registered for the Naryn Local Event **online**. The Naryn info session PDF says online teams prepare a
presentation of their work (offline teams do not). The PDF gives no format, length or time for it; watch the Naryn
Telegram channel (link in its profile header) and ask the Local Lead. Every team member must be registered for the
Naryn event, or the project is not eligible for awards; the participation type can be changed until 15 November.

| What | Link |
|---|---|
| Slides to share on screen (N shows speaker notes, arrows move) | https://lunar-navigator-explained.web.app/deck.html |
| The same seven slides as a PDF file: this is the link for the "Link to Project Demo" field | https://lunar-navigator-explained.web.app/deck.pdf |
| Live demo during the talk | https://lunar-navigator-404.web.app |
| What to say, minute by minute, and the hard questions | `docs/PRESENTATION-SCRIPT.md` |

The project demo is the seven slides, not a film (team decision, 15 November). The guide allows one or the other:
"Video (30 seconds or less) or slide deck (up to seven slides including title and intro slides)", and "Projects that
exceed these limits will not be eligible for Global Judging". Never add an eighth slide.

The slides are in English, as the guide requires for linked materials; you may speak Kyrgyz or Russian. After any change
to the deck, run `npm run deck` to rebuild the PDF.

## Project Name

Lunar Landing Site Navigator

## High-Level Project Summary

We built a free web app that answers one question for the Moon's south pole: if a solar robot lands here on this day, does it survive 14 days? At the pole the Sun and Earth stay low on the horizon, so a single hill can cut power or radio for days, and every delay to a launch changes which landing days work. The app shows every site and every landing day on one screen (green survives, red is lost). You can click anywhere on the Moon to drop your own lander and see its safe days, type how many days a launch slipped and get the sites that still work, and stand on the site in 3D on real NASA LOLA terrain with the Sun and Earth where they really are. Replays of real landings (Chandrayaan-3, IM-1, Chang'e 6, IM-2) put the model next to what really happened. Four games for students run on the same model: build your own lander, with a Kyrgyz, Kazakh, Uzbek or Tajik hat, and watch it drop onto the Moon and survive or freeze; play "Keep me alive" and watch a battery fill and drain hour by hour; tap dark spots where water ice could hide; take a five question quiz. We built it to teach students in Kyrgyzstan and Central Asia, in Kyrgyz, Russian and English: zoom out to one year and to five, and the cycles that decide landing days appear (Earth up about two weeks and hidden about two weeks each month, which leaves about one week of good landing days, the Sun's dark season, the pattern repeating every 354 days), the same cycles mission planners pick dates from.

## Link to Project Demo

https://lunar-navigator-explained.web.app/deck.pdf

(Seven slides as one PDF, in English; it opens in the browser with no login. Paste only ONE link into the field, not this note. The PDF shows the last frame of each slide; the same seven slides with their animations playing are at https://lunar-navigator-explained.web.app/deck.html , and slide 1 links to them.)

## Link to Final Project

https://lunar-navigator-404.web.app

## Detailed Project Description

**What it does.**
1. The first screen shows the whole Moon in 3D, gliding to the south pole. Under it, one row per site and one block per landing day: a green block means a solar robot landing that day survives 14 days, a red block means it is lost. The best site is listed first. Play moves the sunlight over the Moon.
2. Fifteen sites: six from NASA's Lunar Surface Data Book and nine the team picked on NASA LOLA terrain. Click anywhere on the Moon to drop your own lander there: it gets its own row of landing days at once. Coordinates can also be typed, and known landings picked (Apollo 11 and 17, Chandrayaan-3, IM-1, Chang'e 6, IM-2).
3. Any day from 2021 to 2031, from a two week view up to the whole period. Zoomed out, the cycles show: one short window a month while Earth is above the horizon, months with almost no good day while the Sun is in its low season (Feb to Jul 2027 at the best site), and the whole pattern returning about every 354 days, 12 lunar months, measured in the app's own verdicts for 9 of the 10 sites that have any good day.
4. Click a day and you stand 2 m above the real terrain at that site. The Sun and Earth sit at their true positions; the Sun's height, "sunset in" and "Earthset in" are shown.
5. One answer panel: MISSION SURVIVED or MISSION LOST, one sentence why, the next 120 landing days, and eleven checks with a tick or a cross (longest night, longest radio silence, first sunlight, slope, and NASA Artemis III site rules for slope within 2 km and distance from the pole).
6. Launch slipped? Type how many days late the launch is, and one line says which sites still survive a landing that day, or the next good day and how many days later.
7. Your own mission: change how many days the battery lasts without Sun and how many days of radio silence are allowed; every site and day is judged again. The table downloads as CSV, and the page address keeps your sites and limits so a comparison can be shared as a link.
8. Replay a real landing: the app stands you on the site at the moment of touchdown and shows what really happened next to the model.
9. English, Russian and Kyrgyz, and a ready 45 minute school lesson in the same three languages: https://lunar-navigator-explained.web.app/lesson.html

**Four games for students.** Each one is a different way to touch the same answer. Every green, red, "survived" or "lost" in them comes from the same survival rule and the same NASA based Sun and Earth data as the main grid; none has a rule of its own. A first visit explains itself: a tour of five steps lights the landing calendar, the lander card and the three game buttons in turn, the first press on Ice hunter, Quiz or Keep me alive shows a "How to play" card (the goal in one sentence, then what to press, in numbered steps), and a "How to play" button starts the tour again.
10. **My lander.** A student builds a lander: a lander on legs, a rover or a hopper, in one of six colours, with a name, and wearing a Kyrgyz ak kalpak, a Kazakh kalpak, an Uzbek doppi, a Tajik toqi or no hat. Click a landing day in the table, or click the Moon, and the lander drops from where you clicked onto the Moon: a thruster flame slows it, dust puffs up as it lands, and then it lights up green and waves its hat if that landing survives, or frosts over and goes dark if it is lost. A speech bubble gives one sentence in the student's language saying why (for example, the Sun was gone longer than the battery lasts). In the 3D view of a site, the lander stands on the ground near the viewer under the real Sun, with its name and "alive" or "frozen" for the chosen landing day. The lander and the hats are drawn in code, and the choice is kept in the student's own browser.
11. **Keep me alive.** The button is on the first screen (it opens the best site of the period shown, on its next surviving day) and on every site. The student picks a landing day, or presses "Try a green day" or "Try a red day", and watches the 14 days play in about 40 seconds (speeds 1x, 2x and 4x). The battery fills while the Sun is up and drains in shadow; radio bars show while Earth is above the horizon; the day counter and a strip of Sun and Earth hours fill in. The lander in the game is the one the student built in My lander. It ends with "14 days survived!" or the reason the lander was lost, and says that the answer is the same as the map and the verdict panel.
12. **Ice hunter.** On the map, the student presses "Ice hunter" and taps a spot near the south pole. The app checks the Sun at that spot hour by hour for the whole period, 2021 to 2031. If no part of the Sun is above the horizon in any hour, the spot sparkles and says: "This spot did not see the Sun once from 2021 to 2031 in our model. Water ice could hide in places like this." with one line of NASA context (in 2009 the LCROSS mission hit the shadowed crater Cabeus and uncovered water). If the Sun does reach the spot, it says for how much of the time. A counter keeps the dark spots found in this hunt (at least 5 km apart); pressing "Ice hunter" again stops the hunt and clears the points and the count, so the map is clean for the next one.
13. **Quiz.** The "Quiz" button opens the "Moon quiz": five questions drawn at random from a pool of 25, four answers each, in English, Russian or Kyrgyz. After each answer: "Correct!" or "Not quite", with the reason the right answer is right and the reason the chosen one is wrong, in plain words for students. Fifteen questions are facts about the app and the challenge (what a green block means, why Earth is up only part of the month, the 354 day repeat, what Chandrayaan-3 and IM-2 showed, what LCROSS found). Ten are marked "Real data from the app": each takes a real prepared site and a real day and gets its right answer from the same survival rule as the grid, so it is always true to the app. The round ends with a score out of five and "play again".

**How it works.** An offline Python pipeline traces the horizon at each site on NASA LOLA `LDEM_80S_80M` terrain (80 m per pixel) every 0.25 degrees of direction, out to 300 km, with the Moon's curvature. In the browser, Sun and Earth positions for any moment come from astronomy-engine with the IAU lunar rotation model. The app compares them with the horizon hour by hour for 14 days and applies the rules. The four games for students use that same hourly Sun and Earth data and the same rules, and each has its own test (`tools/test-lander.cjs`, `tools/test-game.cjs`, `tools/test-ice.cjs`, `tools/test-quiz.cjs`) that opens the app in a browser and compares what the student sees with the model.

**How we know it is right.** The Sun and Earth positions the app shows agree with NASA JPL Horizons to 0.0047 degrees at worst (about a hundredth of the Sun's width), and with an independent JPL DE440 series to under 0.01 degrees; the offline terrain pipeline agrees with Horizons to 0.47 arcseconds. At Chandrayaan-3's site our sunset is 4 September 2023, the day ISRO put the lander to sleep; at Chang'e 6's site Earth never rises, and the real mission used a relay satellite. Against NASA Goddard's polar illumination maps at twenty points, our Earth in view share differs by 3.3 points on average (r 0.97).

**Limits we state.** On sharp ridges our share of time in sunlight is higher than NASA's maps (11 points on average): read ridge numbers as an upper estimate. A lander you drop yourself is judged on coarser terrain (320 m per pixel instead of 80 m), so narrow peaks lose detail and it usually finds fewer safe days than the prepared sites. The model judges a place and a day, not a touchdown: it passes IM-2's site and day, and the real lander fell on its side. The battery and radio limits (2 and 3 days) are our teaching values, not NASA requirements; for scale, NASA says its VIPER rover cannot endure more than 50 hours of continuous darkness.

**Limits of the four games, stated plainly.**
- A spot the student picks (a lander dropped by clicking the Moon, or an Ice hunter tap) is judged on NASA LOLA terrain averaged to 320 m, coarser than the 80 m of the fifteen prepared sites, and only within about 235 km of the south pole. Small shadows and small sunlit peaks are missed, so a spot the model calls dark could have a lit peak, and a spot it calls lit could be shaded. Farther from the pole, Ice hunter says "Too far from the pole" and gives no verdict.
- Ice hunter does not detect ice. It says water ice "could" hide where our model never sees the Sun, nothing more; only a spacecraft that goes there can tell. The Sun counts as reaching a spot when any part of its disc is above the horizon in an hour. A spot the Sun does reach is called "too warm for ice to stay": that is a simple rule, not a temperature model.
- Keep me alive uses the team's teaching rule, not a real power system: a full battery lasts the battery limit (2 days) in the dark, one hour of Sun refills it at once, and the lander arrives with 23 hours of charge (with the default limits). The battery limit (2 days), the radio limit (3 days) and the 24 hour first Sun limit are our example values, not NASA requirements; the student can change the first two on the map. The game counts the Sun as up when at least half of its disc is above the horizon, the same test as the verdict.
- In the Quiz, the ten "Real data from the app" questions are asked about the prepared sites and days between 2022 and 2030, and answered by the survival rule, so they are as right as the grid is. The other fifteen are fixed texts written from the app's documents and NASA and mission pages that the code names; they are not computed, so they are only as right as those pages and our reading of them.
- Like the whole app, the games judge a place and a day, not a touchdown: the drop animation and the game show the verdict, they do not simulate landing a spacecraft.
- The lander models, the hats and every drawing in the games are made by the team in code (three.js shapes and canvas patterns, written with AI help). They are simplified, recognisable drawings, not photos, and they show no real person. The Russian and Kyrgyz texts of the games were drafted with AI, and the check by the team's native speakers is still to be done.

**Benefits.** Students in Kyrgyzstan and Central Asia can learn, in their own language, how real Moon missions are planned and why only some days work; a teacher gets a ready lesson that turns Moon geometry into a yes or no answer. When a launch slips, a planner sees in one click which other days and sites still work.

**Tools.** JavaScript, three.js, astronomy-engine, Python (NumPy, Skyfield), Firebase Hosting, Playwright for end to end checks. Claude (Anthropic) wrote the code, the tests, the slides and the texts with us (see the SI field). Code: https://github.com/pathmaker7/404-llsn (Apache-2.0). The 3D view and terrain pipeline are by our teammate: https://github.com/steppekid/lunar_3d_nasa_hackathon

## Use of Super Intelligence (SI)

Yes. We used Claude (Anthropic) as a coding assistant: for the 3D view and terrain pipeline (directed by our teammate), for the answer panel, the survival rules, the date range 2021 to 2031 and the tests (directed by the team), for the four games for students (the lander with its hats, the battery game, the ice hunter and the quiz, with their tests), and for the README, the explainer page and the Russian and Kyrgyz texts. The quiz questions and answers and the games' Russian and Kyrgyz texts were drafted with AI, and the check by the team's native speakers is still to be done. The idea, the choice of rules and the checks were the team's. Every result of the main app was checked by tests against NASA JPL Horizons and by the team playing the app; the four games have their own tests, described above. The seven slide project demo and the 45 minute lesson plan were written with Claude. Slides 2 to 7 are animated scenes drawn in code (SVG) with Claude, using the app's own lander drawings; the screenshots inside them are of the real app and of our lesson page; every slide carries the line "Made with AI (SI) tools: Claude". A 29.5 second film on our "How it works" page (it is not the project demo) is recorded from the real app and carries a visible "Made with AI (SI) tools: Claude. Synthetic voice." watermark; its voice is synthetic (ElevenLabs text to speech, voice "Sarah", reading our captions), and the file metadata says so. No image or sound in the app was generated as a picture or audio by AI (the landers and hats are drawn by code that Claude helped write, not generated as pictures), and no NASA logo, flag or mission identifier is used. Details: https://github.com/pathmaker7/404-llsn/blob/main/docs/SI-usage.md

## NASA Data

- NASA LRO LOLA `LDEM_80S_80M` south polar terrain, PDS Geosciences Node: the terrain, horizons and map.
- NASA M2M-30044 Moon to Mars Lunar Surface Data Book (2025), https://ntrs.nasa.gov/citations/20250002845 : the six candidate site coordinates.
- NASA JPL DE440 ephemeris and lunar orientation kernels (NAIF): Sun, Earth and Moon positions.
- NASA JPL Horizons, https://ssd.jpl.nasa.gov/horizons/ : independent check of every Sun and Earth position.
- NASA Goddard PGDA Lunar Polar Illumination maps, https://pgda.gsfc.nasa.gov/products/69 : check of our sunlight and Earth view shares.
- NASA, Artemis Human Landing System Overview, https://ntrs.nasa.gov/citations/20250009323 : the Artemis III landing site rules we use (within 6 degrees of the pole, landing slope under 10 degrees, slope within 2 km under 20 degrees).
- NASA Scientific Visualization Studio CGI Moon Kit (LROC colour map) and Blue Marble: the pictures of the Moon and Earth.
- LROC team images locating IM-2 and Chandrayaan-3: https://lroc.im-ldi.com/images/1408 and https://lroc.im-ldi.com/images/1314
- NASA VIPER lunar operations page, for the 50 hours of darkness figure.
- NASA Science, LCROSS mission page, https://science.nasa.gov/mission/lcross/ : the one line of context in Ice hunter (LCROSS hit the shadowed crater Cabeus in 2009 and uncovered water near the Moon's south pole).

## Space Agency Partner Data and Other References

- ISRO (a 2026 Space Agency Partner): Chandrayaan-3 mission events (landing on 23 August 2023 at 12:33 UTC, lander put to sleep on 4 September 2023), taken from the report https://spacepolicyonline.com/news/india-says-good-night-to-chandrayaan-3/ ; no ISRO data file is used.
- Facts about the other landings shown (Apollo 11 and 17, IM-1, IM-2, Chang'e 6): NASA NSSDC, the IAU Gazetteer of Planetary Nomenclature, Wikipedia and SpacePolicyOnline, each linked in the full list below.
- Also used: jplephem, requests and pytest (Python), ffmpeg, Firebase Hosting, and the AI tools Claude (Anthropic) and ElevenLabs text to speech (see the SI field).
- Software: three.js (MIT), astronomy-engine (MIT), Skyfield (MIT), NumPy (BSD-3-Clause), Playwright (Apache-2.0).
- Fonts: IBM Plex Sans Condensed and IBM Plex Mono (SIL Open Font License 1.1).
- Mazarico et al. 2011, Icarus 211(2), for site names and the illumination maps.
- Full list with every link: https://github.com/pathmaker7/404-llsn/blob/main/app/ATTRIBUTION.md
