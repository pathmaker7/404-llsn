# Evening brief: explain the project to the team

You are a new session in `/Users/agentsinc/Desktop/NASA Naryn`. The owner (Manuchehr) and his four teammates (team "404 agents": Aruzhan, Kairat, Arsen, Amirbek) are sitting together on the evening of 14 November 2026. They did not write most of this code. Your job in this turn: explain, in plain words, what this project is, what it does, what the challenge and the judges require, and what is left to do, with every link they need. No code changes unless he asks after reading.

## How to answer

- One reply, readable aloud in about five minutes. Short sentences, tables, no jargon without a one line definition. Use the owner's words: "site", "landing day", "survives / lost", "replay".
- Order: (1) what it is in two sentences, (2) what you can do in it, feature by feature, (3) what NASA asked for and where we cover each item, (4) how judges score and where we stand, (5) how we know it is right, and the two weak points to admit, (6) what the team must do by the deadline, (7) every link, grouped.
- Before giving a link, check that it opens (curl or the browser). Mark any you could not open.
- Read before you claim: `README.md`, `app/ATTRIBUTION.md`, `docs/SI-usage.md`, `app/mission.js`, `git log --oneline -15`. Run `npm test` and say what it printed. Do not run `npm run smoke` unless asked (about three minutes).
- No em dash, en dash or double hyphen as punctuation.

## The project in two sentences

Lunar Landing Site Navigator answers one question: if a solar robot lands at this site on the Moon's south pole on this day, does it survive a 14 day stay, and on which days would it. It shows the answer on a real 3D Moon built from NASA terrain, for fifteen prepared sites, any point you add, and any day from 2021 to 2031.

## Features, as of commit 0ed672d (live)

1. First screen: the whole Moon in 3D, gliding to the south pole. Under it one row per site and one block per landing day: tall green survives, short dark red is lost. Best site listed first. Play button moves the sunlight.
2. Click a day: you fly down and stand on the site, 2 m above real terrain, with the Sun and Earth where they really are.
3. One panel: THE ROBOT SURVIVED or THE ROBOT WAS LOST, one sentence why, the next 120 landing days, eleven checks with a tick or cross.
4. Your own mission: change battery days and radio silence days; add any latitude and longitude.
5. Replay a real landing (new today): Chandrayaan-3, IM-1, Chang'e 6, IM-2. A box shows what really happened next to what the model says.
6. Download the table as CSV (new today).
7. English, Russian, Kyrgyz.
8. "How do we know?" panel: checks against JPL Horizons, against NASA's illumination maps (new today), against four real landings (new today).
9. A 45 minute school lesson in three languages (new today).

## Requirements and where they come from

| Whose requirement | What it says | Link | State |
|---|---|---|---|
| NASA challenge "Lunar Landing Site Navigator" | visualize Sun and Earth positions against the local horizon, to judge power and communication windows; compare sites and dates; for planners, educators and the public | https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/ | The address answers 200 but the text is drawn by script and was NOT read on 14 Nov. Open it in the browser, read the full text, and check each objective against the features above. |
| Judging | five criteria, each 1 to 5: Impact, Creativity, Validity, Relevance, Presentation | https://www.spaceappschallenge.org/resources/judging-awards-guide | read 14 Nov |
| Submission | project page in English; demo is a video of 30 seconds or less, or 7 slides at most; all sources credited | https://www.spaceappschallenge.org/resources/project-submission-guide/ | address opens; the two limits above are quoted from the judging guide. Read this page fully and list every required field. |
| FAQ | includes "Teams are not allowed to begin working on the challenges prior to the hackathon" | https://www.spaceappschallenge.org/resources/participant-faqs/ | address opens; see the risk below |
| Naryn local event | submit between 09:00 14 Nov and 23:59 15 Nov local time; team of at most 6, all registered for the Naryn event; offline teams need no presentation, the jury scores the submitted project | PDF in `~/Downloads/NASA_Space_Apps_2026_*Naryn*.pdf` | read 14 Nov. An older memory note says "local pitch 16:30 Nov 15": the PDF says offline teams do not present. Ask the owner which is true. |

## Where we stand (harsh, 1 to 10, my marks on 14 Nov)

| Criterion | Mark | What holds it down |
|---|---|---|
| Relevance | 9 | the challenge page itself was not re-read today |
| Validity | 8 | our Sun share on ridge tops is 11 points above NASA's map on average, cause not found |
| Creativity | 8 | 3D Moon viewers are common; the real landing replay is the fresh part |
| Impact | 6.5 | no real person outside the team has used it |
| Presentation | 7.5 | nobody has rehearsed; Kyrgyz and Russian not read by a native speaker |

## How we know it is right

| Check | Result | Run it |
|---|---|---|
| Sun and Earth positions against NASA JPL Horizons | app: worst 0.0047° (`npm run validate`, 14 Nov); offline pipeline: worst 0.47 arcseconds | `npm run validate` |
| Against an independent JPL DE440 series | under 0.01 degrees | `npm test` |
| Real landings: Chandrayaan-3 site, model sunset 4 Sep 2023 19:00 UTC; ISRO put the lander to sleep 4 Sep about 02:30 UTC. Chang'e 6 site: Earth never rises; the real mission used a relay satellite | passes | `npm test`, `npm run smoke` |
| Against NASA Goddard illumination maps at 20 points | Earth: mean difference 3.3 points, r 0.97. Sun: r 0.92, ours higher by 11.4 | `node tools/validate-pgda.cjs sun.img earth.img` |

Two weak points to admit if asked:
- IM-2: the model says SURVIVED, the real lander fell on its side. The model judges the place and the day, not the touchdown.
- Sun on ridges: ours is higher than NASA's. Say "read our ridge numbers as an upper estimate".

## Hard questions to rehearse

1. "Why do Shackleton rim and Nobile rim 1 show zero days?" The Data Book point is a region centre on a steep wall; raise the battery live to show it change.
2. "Are the limits NASA's?" Slope and pole distance are NASA Artemis III rules. Battery (2 days) and radio (3 days) are ours and the user can change them. For scale, NASA says VIPER cannot endure more than 50 hours of darkness.
3. "How do you know it is right?" Open "How do we know?", then replay Chandrayaan-3.
4. "Why are your Sun numbers above NASA's?" See above.

## What only the team can do, by score gain

1. Get five real people to use it (the venue is School No. 1: one teacher, the lesson sheet, one photo, one quote).
2. A native speaker reads the Kyrgyz and Russian in the app and the lesson.
3. Fill the project page in English and attach the 29 second film (`docs/demo-30s.mp4`).
4. Decide what to say about two risks: code dated before 14 Nov (the FAQ line above; the owner chose on 12 Nov to build early, do not re-argue, point to the dates in the repo and `docs/SI-usage.md`), and the teammate's 3D repo having no licence.

## Not verified on 14 Nov

Safari and Firefox; the film in a real player; the replay box on a phone; the cause of the Sun difference; Chang'e 6 coordinates and IM-1 dates (from search summaries of Wikipedia, not primary pages).

## Links

Ours
- App: https://lunar-navigator-404.web.app
- How it works: https://lunar-navigator-explained.web.app
- School lesson: https://lunar-navigator-explained.web.app/lesson.html
- Code: https://github.com/pathmaker7/404-llsn
- Teammate's 3D repo: https://github.com/steppekid/lunar_3d_nasa_hackathon
- Deck: claude.ai artifact UqeaRDcEkJbBcS7ZBembww (find the full link with the Artifact tool, action list)
- Redeploy: `npm run deploy`, then give only the plain app link

NASA Space Apps
- Challenge: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- All challenges: https://www.spaceappschallenge.org/2026/challenges/
- Judging and awards: https://www.spaceappschallenge.org/resources/judging-awards-guide
- Submission guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- FAQ: https://www.spaceappschallenge.org/resources/participant-faqs/

NASA data and sources we use
- LOLA terrain and site list: see `app/ATTRIBUTION.md` (Lunar Surface Data Book: https://ntrs.nasa.gov/citations/20250002845)
- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- NASA illumination maps (PGDA): https://pgda.gsfc.nasa.gov/products/69
- VIPER, 50 hours of darkness: https://science.nasa.gov/mission/viper/lunar-operations/
- IM-2 located by LROC: https://lroc.im-ldi.com/images/1408
- Chandrayaan-3 site by LROC: https://lroc.im-ldi.com/images/1314
- Chandrayaan-3 sleep, ISRO as reported: https://spacepolicyonline.com/news/india-says-good-night-to-chandrayaan-3/

Rival teams on the same challenge (read for comparison)
- https://github.com/rodneymora94965/lunar-site-navigator (has NASA map validation and CSV; no replay)
- https://github.com/RicardoArg23/MoonSet

## When you finish

End with the three things the team should do first tonight, and ask the owner whether there is a pitch on 15 Nov or not.
