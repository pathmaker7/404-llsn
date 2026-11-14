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
| The same seven slides as a PDF file, if they ask for a file | https://lunar-navigator-explained.web.app/deck.pdf |
| Live demo during the talk | https://lunar-navigator-404.web.app |
| What to say, minute by minute, and the hard questions | `docs/PRESENTATION-SCRIPT.md` |
| The 29 second film, if they ask for a video | https://lunar-navigator-explained.web.app/demo-30s.mp4 |

The slides are in English, as the guide requires for linked materials; you may speak Kyrgyz or Russian. After any change
to the deck, run `npm run deck` to rebuild the PDF.

## Project Name

Lunar Landing Site Navigator

## High-Level Project Summary

We built a free web app that answers one question for the Moon's south pole: if a solar robot lands at this site on this day, does it survive a 14 day stay, and on which days would it? At the pole the Sun and Earth stay within a few degrees of the horizon, so one hill can cut power or radio for days, and when a launch slips every site and date must be checked again. Our app shows every site and every landing day on one screen (green survives, hollow is lost), lets you stand on the site in 3D with the Sun and Earth at their true positions over real NASA LOLA terrain, and replays real landings (Chandrayaan-3, IM-1, Chang'e 6, IM-2) to show the model agrees with what happened. It is built as a teaching tool for students in Kyrgyzstan and Central Asia, in Kyrgyz, Russian and English: zoom out to one year and to five, and the two cycles that decide landing days appear (Earth up about one week a month, the Sun's dark season, repeating every 354 days), the same Sun and Earth cycles mission planners choose dates from. It also gives planners a quick answer when a launch slips.

## Link to Project Demo

https://lunar-navigator-explained.web.app/demo-30s.mp4

(29 seconds, a synthetic English voice with matching English captions; it plays in the browser. Do not use the GitHub file link: GitHub sends it as a download. Put the film in this field. The seven slides are for the Naryn online presentation, see below.)

## Link to Final Project

https://lunar-navigator-404.web.app

## Detailed Project Description

**What it does.**
1. The first screen shows the whole Moon in 3D, gliding to the south pole. Under it, one row per site and one block per landing day: a green block means a solar robot landing that day survives 14 days, a hollow block means it is lost. The best site is listed first. Play moves the sunlight over the Moon.
2. Fifteen sites: six from NASA's Lunar Surface Data Book and nine the team picked on NASA LOLA terrain. Any latitude and longitude can be added, and known landings can be picked (Apollo 11 and 17, Chandrayaan-3, IM-1, Chang'e 6, IM-2).
3. Any day from 2021 to 2031, from a two week view up to the whole period. Zoomed out, the cycles show: one short window a month while Earth is above the horizon, months with almost no good day while the Sun is in its low season (Feb to Jul 2027 at the best site), and the whole pattern returning about every 354 days, 12 lunar months, measured in the app's own verdicts for 9 of the 10 sites that have any good day.
4. Click a day and you stand 2 m above the real terrain at that site. The Sun and Earth sit at their true positions; the Sun's height, "sunset in" and "Earthset in" are shown.
5. One answer panel: MISSION SURVIVED or MISSION LOST, one sentence why, the next 120 landing days, and eleven checks with a tick or a cross (longest night, longest radio silence, first sunlight, slope, and NASA Artemis III site rules for slope within 2 km and distance from the pole).
6. Your own mission: change how many days the battery lasts without Sun and how many days of radio silence are allowed; every site and day is judged again. The table downloads as CSV, and the page address keeps your sites and limits so a comparison can be shared as a link.
7. Replay a real landing: the app stands you on the site at the moment of touchdown and shows what really happened next to the model.
8. English, Russian and Kyrgyz, and a ready 45 minute school lesson in the same three languages: https://lunar-navigator-explained.web.app/lesson.html

**How it works.** An offline Python pipeline traces the horizon at each site on NASA LOLA `LDEM_80S_80M` terrain (80 m per pixel) every 0.25 degrees of direction, out to 300 km, with the Moon's curvature. In the browser, Sun and Earth positions for any moment come from astronomy-engine with the IAU lunar rotation model. The app compares them with the horizon hour by hour for 14 days and applies the rules.

**How we know it is right.** The Sun and Earth positions the app shows agree with NASA JPL Horizons to 0.0047 degrees at worst (about a hundredth of the Sun's width), and with an independent JPL DE440 series to under 0.01 degrees; the offline terrain pipeline agrees with Horizons to 0.47 arcseconds. At Chandrayaan-3's site our sunset is 4 September 2023, the day ISRO put the lander to sleep; at Chang'e 6's site Earth never rises, and the real mission used a relay satellite. Against NASA Goddard's polar illumination maps at twenty points, our Earth in view share differs by 3.3 points on average (r 0.97).

**Limits we state.** On sharp ridges our share of time in sunlight is higher than NASA's maps (11 points on average): read ridge numbers as an upper estimate. The model judges a place and a day, not a touchdown: it passes IM-2's site and day, and the real lander fell on its side. The battery and radio limits (2 and 3 days) are our teaching values, not NASA requirements; for scale, NASA says its VIPER rover cannot endure more than 50 hours of continuous darkness.

**Benefits.** Students in Kyrgyzstan and Central Asia learn, in their own language, how real Moon missions are planned and why only some days work; a teacher gets a ready lesson that turns Moon geometry into a yes or no answer. When a launch slips, a planner sees in one click which other days and sites still work.

**Tools.** JavaScript, three.js, astronomy-engine, Python (NumPy, Skyfield), Firebase Hosting, Playwright for end to end checks. Code: https://github.com/pathmaker7/404-llsn (Apache-2.0). The 3D view and terrain pipeline are by our teammate: https://github.com/steppekid/lunar_3d_nasa_hackathon

## Use of Super Intelligence (SI)

Yes. We used Claude (Anthropic) as a coding assistant: for the 3D view and terrain pipeline (directed by our teammate), for the answer panel, the survival rules, the date range 2021 to 2031 and the tests (directed by the team), and for the README, the explainer page and the Russian and Kyrgyz texts. The idea, the choice of rules and the checks were the team's. Every result was checked by tests against NASA JPL Horizons and by the team playing the app. The demo film is recorded from the real app and carries a visible "Made with AI (SI) tools: Claude. Synthetic voice." watermark; the voice is synthetic (ElevenLabs text to speech, voice "The Professional Presenter", reading our captions), and the file metadata says so. No image, sound or text in the app was generated as a picture or audio by AI, and no NASA logo, flag or mission identifier is used. Details: https://github.com/pathmaker7/404-llsn/blob/main/docs/SI-usage.md

## NASA Data

- NASA LRO LOLA `LDEM_80S_80M` south polar terrain, PDS Geosciences Node: the terrain, horizons and map.
- NASA M2M-30044 Moon to Mars Lunar Surface Data Book (2025), https://ntrs.nasa.gov/citations/20250002845 : the six candidate site coordinates.
- NASA JPL DE440 ephemeris and lunar orientation kernels (NAIF): Sun, Earth and Moon positions.
- NASA JPL Horizons, https://ssd.jpl.nasa.gov/horizons/ : independent check of every Sun and Earth position.
- NASA Goddard PGDA Lunar Polar Illumination maps, https://pgda.gsfc.nasa.gov/products/69 : check of our sunlight and Earth view shares.
- NASA Artemis III landing site requirements: slope and distance from the pole rules.
- NASA Scientific Visualization Studio CGI Moon Kit (LROC colour map) and Blue Marble: the pictures of the Moon and Earth.
- LROC team images locating IM-2 and Chandrayaan-3: https://lroc.im-ldi.com/images/1408 and https://lroc.im-ldi.com/images/1314
- NASA VIPER lunar operations page, for the 50 hours of darkness figure.

## Space Agency Partner Data and Other References

- ISRO: Chandrayaan-3 landing time and the date the lander was put to sleep, as reported in https://spacepolicyonline.com/news/india-says-good-night-to-chandrayaan-3/
- Software: three.js (MIT), astronomy-engine (MIT), Skyfield (MIT), NumPy (BSD-3-Clause), Playwright (Apache-2.0).
- Fonts: IBM Plex Sans Condensed and IBM Plex Mono (SIL Open Font License 1.1).
- Mazarico et al. 2011, Icarus 211(2), for site names and the illumination maps.
- Full list with every link: https://github.com/pathmaker7/404-llsn/blob/main/app/ATTRIBUTION.md
