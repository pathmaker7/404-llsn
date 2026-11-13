# Project submission draft

Paste into the team's project page on spaceappschallenge.org (Project tab). The answers follow the form questions shown in the Project Submission Guide (https://www.spaceappschallenge.org/resources/project-submission-guide/, read 13 Nov 2026). Match the order and any extra fields against the live form before pasting. Window: 14 Nov 09:00 to 15 Nov 23:59 Naryn time; the deadline in the Judging and Awards Guide reads "before Sunday, November 15 at 11:59 p.m. local time"; our target is 20:00 on 15 Nov.

Every number below comes from a command in README "Verification" (`npm run results`, `npm run validate`, `npm run crosscheck`), except the guided mission's own numbers, which are the ones the mission screens show; `npm run smoke` plays the mission and fails if who survives on each day stops being true.

## Rules this page must meet (from the Project Submission Guide)

- **Demo format**: "Video (30 seconds or less) or slide deck (up to seven slides including title and intro slides)." Projects that exceed these limits are not eligible for Global Judging. Our demo is the 29 second video of the guided mission, docs/demo-30s.mp4 (English captions, no voice; made by `node tools/record-demo30.cjs`; beats and a voiced version in docs/video-script.md). The 120 s docs/demo.mp4 is an older long walkthrough and must not be submitted as the demo. The pitch deck has 11 slides, so it is not the demo either.
- **Hosting**: an external site such as YouTube or Google Drive, with a publicly accessible link. Test the link in a private window before pasting it.
- **Language**: English on the submission page and in any linked materials. A video may be spoken in another language only if it has English subtitles.
- **SI marks**: images and videos need a visible watermark that shows SI generation; audio, code and data must acknowledge SI generation in descriptive text and metadata. docs/demo-30s.mp4 has a visible watermark ("Made with AI (SI) tools: code, footage and captions by Claude, checked by team 404 agents") and the same words in its metadata comment, and it has no voice. Write the same sentence in the description of the hosted video.
- **Two checkboxes** (tick both, wording below).

## Project name
Lunar Landing Site Navigator

## High-level summary
A lunar mission that anyone can play in two minutes: you choose where a robot lands, real NASA data decides if it survives, then the launch slips and you must replan. For experts, the full planner is one click away.

At the Moon's south pole the Sun and Earth only rise a few degrees, so one ridge can cut power or radio for days, and a few hundred metres can decide everything. Our tool takes NASA's LRO LOLA terrain, computes the real 360° skyline from any site, and checks the true Sun and Earth positions against it hour by hour. It has two levels on one checked engine. **Mission mode** is the first screen: one guided mission with fixed numbers and one decision per step, with a short explanation box at each step. The question is "Can your robot survive 14 days on the Moon?" The robot runs on sunlight (its battery lasts 2 days in the dark) and talks straight to Earth (it is lost if a ridge hides Earth for more than 3 days). You choose one of four landing spots (Crater wall, Ridge, Second rim, Plateau) for a fixed landing on 22 July 2027, and read the verdict, "THE ROBOT SURVIVED" or "THE ROBOT WAS LOST", with the real numbers, one sentence of why and a 360° sky view. Then the rocket is late: the launch slips 21 days, the landing moves to 12 August 2027, and the same spot is judged again, so you replan. The last screen says what you learned: the place matters, the date matters, the Moon is not Earth (the Sun over Naryn on the same date climbs to 69° and is up about 15 hours, while at the four spots it never rises more than 1° above a level horizon), and this is a real job. The **full planner** is one button away ("Full planner (for experts)"): mission planners, teachers and the public can compare sites and landing dates in seconds (sunlit %, Earth visibility %, longest night, longest Earth blackout, time to sunset and Earthset, slope, and a pass/fail against NASA's Artemis III landing requirements). It covers the whole Moon (Apollo, Luna, Chang'e, Chandrayaan-3, SLIM and commercial landers) with extra detail at the south pole, for any site and any date. Sun and Earth positions match NASA JPL Horizons to 0.005°, and our sunlight and Earth visibility match NASA's published LOLA illumination maps to a median 0.3 percentage points. It runs offline in any browser, in English, Russian and Kyrgyz.

## What benefits does it have?
- Students and the public learn why the Moon's south pole is hard by making one decision at a time (where the robot lands) and seeing real NASA data say whether it survives. It is built so a first-time visitor can follow it without reading anything else, and it runs by opening one file, with no internet and no install, so any school can use it.
- Mission planners get one screen that answers "which site, which date", which otherwise takes Quickmap, Moon Trek and JPL Horizons together.
- When a launch slips, a planner reruns dates in seconds and shares a link. Mission mode practises exactly this in step 3: the rocket is late, the landing moves 21 days, and you replan.
- Every number is checked against NASA references, and each check was broken on purpose once to prove it can fail.

## What do you hope to achieve?
We hope that a student in Naryn, or anywhere, learns by playing why the Moon's south pole is hard: the Sun barely rises, Earth wobbles out of view, and a few hundred metres decide power and radio. We want a planner and a teacher to trust the numbers, because they match JPL Horizons and NASA's illumination maps, and to see the limits, because we state them. Our first extensions are relay satellite visibility, NASA's 5 m terrain around the Artemis III candidate regions, and a class mode on top of Mission mode.

## What tools, coding languages, hardware, or software did you use to develop your project?
- Languages and runtime: JavaScript, HTML and CSS (canvas drawing), Node.js for build scripts and checks. The app is static: classic script tags, no framework, no server, no build step.
- Libraries: astronomy-engine 2.1.19 (MIT) for Sun, Earth and Moon positions; playwright-core 1.64.1 for browser tests and screen recording.
- Software and services: Google Chrome (headless, for tests), ffmpeg (video), Firebase Hosting (the live app and explainer page), Git and GitHub, Claude in Claude Code (see the SI question).
- Hardware: laptops and a browser; nothing special.
- Data: NASA LRO LOLA terrain, NASA JPL Horizons, NASA LOLA illumination maps, NASA Artemis III landing requirements (see Use of NASA data).
- Mission mode rules are in `app/mission.js`. The 2 day battery, the 3 day radio limit and the 21 day delay are teaching values chosen by the team, not NASA requirements. The landing day, 22 July 2027, was chosen by the team from the data.

## Did you utilize any Super Intelligence (SI) tools and software in preparing your solution? If yes, how did you use them?
Yes. Claude (Anthropic), in Claude Code, wrote most of the code, the checks, the explainer page and drafts of the texts. It read the Space Apps rules and the NASA references, proposed the Mission mode direction with the team's owner (13 Nov, evening), and wrote Mission mode. After the owner tested the app and said a first-time visitor could not understand it, Claude simplified Mission mode to one guided mission and searched the year of computed data for a landing day where both the place and the date change the outcome. A council of five AI advisors reviewed the idea of a 3D landing simulator and advised against it. Every number was then checked by a command against a NASA reference, and each check was broken on purpose to prove it can fail. Claude's own mistakes caught that way are listed in docs/SI-usage.md; for example, its first method of comparing with NASA's maps was misleading at ridges and was replaced. Landing site coordinates come from cited sources, not from the model's memory. The Russian and Kyrgyz interface strings are machine drafts until a native speaker reviews them. The 29 second demo video carries a visible watermark that says it was made with AI (SI) tools, and its description and metadata say so. The team reviewed, ran and tested all generated code. Full list: docs/SI-usage.md.

## Links
- Demo video (29 s, public link): **[PUBLIC LINK, to fill after upload and a test in a private window]**
- Repository: https://github.com/pathmaker7/404-llsn
- Live app: https://lunar-navigator-404.web.app
- How it works, for non-specialists: https://lunar-navigator-explained.web.app
- Long walkthrough (2 min, older, not the submitted demo): docs/demo.mp4 in the repository. The 29 s demo is also embedded at https://lunar-navigator-explained.web.app#video

## Project details
- What it does: Mission mode, one guided mission (question, choose one of four spots, verdict with real numbers and a 360° sky view, the 21 day launch delay and a replan, what you learned), and the full planner for experts: compare landing sites and dates by power (sunlight on the solar arrays) and direct-to-Earth communication, with the terrain's real horizon, for any site on the Moon and any date. Planner views: south pole map with slope and live shadow overlays, whole-Moon map, date planner with "jump to best date", comparison table with Artemis III checks, 360° sky panorama with countdowns, neighbourhood map, power and comms timeline, CSV export of comm windows, shareable link.
- The mission: landing on 22 July 2027 (00:00 UTC) for 14 days, at the Crater wall (Shackleton rim, the Data Book point on its inner wall), Ridge (Connecting ridge), Second rim (de Gerlache rim) or Plateau (Leibnitz beta plateau). Each verdict comes with a mission report of eleven checks, each with a limit, a priority and a hover explanation. Four must pass: the longest night at most 2 days, the longest time without direct Earth contact at most 3 days, the Sun up within 24 hours of landing, and ground slope under 10° (a NASA Artemis III requirement). Two more are NASA Artemis III site rules (slope under 20° within 2 km, within 6° of the pole) and five are for information. The night, radio and first day limits and the 21 day delay are teaching values chosen by the team, not NASA requirements. After the mission, an any-day step answers "can we land on this day, and why" for any date from 1950 to 2100, past or future, with one click per day.
- What the mission's data says: On 22 July 2027 the Ridge and the Second rim survive (never dark, Earth hidden at most 2.5 days), the Plateau is lost to a 4.4 day night, and the Crater wall is dark and too steep (32°). After the 21 day delay, on 12 August 2027, the Ridge and the Second rim are lost because Earth is hidden for 4.2 and 3.6 days, and the Plateau survives. Under each verdict a first-person 3D view (LOLA 80 m terrain, JPL DE440) lets you stand on the spot and watch the 14 days; it and our engine agree on all eight verdicts. On 22 July 2027 the Sun over Naryn climbs to 69° and is up about 15 hours, while at the four spots it never rises more than 1° above a level horizon.
- How it works: LOLA LDEM_75S_240M at 480 m for the south pole, LDEM_4 for the whole Moon plus 474 m LDEM_64 boxes around landing sites; a great-circle horizon march with the Moon's curvature; astronomy-engine ephemeris with the IAU lunar rotation model (so Earth's libration is included); fraction of the solar disc above the skyline for power, Earth above the skyline plus a margin for comms.
- Findings (one year from 14 Nov 2026, 2 m mast):
  - No site wins on everything. Shackleton rim: 86.9% sunlit but up to 14.4 days without Earth, and a 33.7° crater wall within 2 km (Artemis III: 4 of 5).
  - Haworth rim, Malapert massif side: 69.0% of the time with both Sun and Earth up, the best balance of the presets.
  - Within 2.4 km of the Shackleton rim point, sunlight ranges from 0% to 87%.
  - Chang'e 4 on the far side: Earth 0% of the year, which is why it needed the Queqiao relay. Apollo 11: Earth 100%, but a 14.8-day night.
- Deliberately not built: a 3D scene or landing descent (terrain is 480 m per pixel, a descent's altitude and speed would be invented numbers, and the Sun and Earth barely move in a ten minute descent while the challenge is about change over days); a water or ice amount (no such data in the tool); a vehicle recommendation (no vehicle specifications in the data).

## Use of NASA data
- LRO LOLA gridded elevation: LDEM_75S_240M (south pole), LDEM_64 and LDEM_4 (global), PDS Geosciences Node
- LRO LOLA polar illumination maps (Sun and Earth), PGDA product 69, Mazarico et al. 2011: used to validate our results
- NASA JPL Horizons: used to validate Sun and Earth positions
- NASA Artemis overview for Space Apps (NTRS 20250009323): Artemis III landing requirements, used for the five Artemis III checks in the full planner

## Space agency partner data
None.

## References
List all of the data, resources, and tools used in your project. Paste the list from README "References" (every data source, program and image is cited there, including open source). It currently holds:
- NASA LRO LOLA LDEM_75S_240M, LDEM_4 and LDEM_64, PDS Geosciences Node: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/
- NASA LOLA polar illumination maps, PGDA product 69: https://pgda.gsfc.nasa.gov/products/69 ; Mazarico, E., et al. (2011), Icarus 211, 1066 to 1081
- NASA JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- NASA Artemis Overview for the International Space Apps Challenge, NTRS 20250009323: https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf
- NASA Space Apps 2026 challenge statement, Participant FAQ, Project Submission Guide and Judging and Awards Guide: https://www.spaceappschallenge.org/
- IAU WGCCRE 2009 report (lunar rotation model): https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2009reprint.pdf
- USGS Gazetteer of Planetary Nomenclature (crater centres): https://planetarynames.wr.usgs.gov/
- Landing site coordinates: Wikipedia "List of landings on extraterrestrial bodies" (citing LROC and NSSDCA), and "IM-2" with LROC image 1408
- astronomy-engine 2.1.19, MIT licence: https://github.com/cosinekitty/astronomy
- Tools: playwright-core, ffmpeg, Firebase Hosting, Claude (Anthropic) in Claude Code
- No music and no stock images or photos: every picture is a screenshot of our own app or drawn in code.

## SI usage
See "Did you utilize any Super Intelligence (SI) tools" above and docs/SI-usage.md (required by the rules).

## The two checkboxes (tick both)
1. "I have read and understand the project submission requirements as contained in the NASA Space Apps Project Submission Guide, and I agree to the Participant Terms and Conditions and Privacy Policy."
2. "I confirm that the submitted project represents my team's original work and that all external resources including code, text and images (even if they are open source or freely available) used in the project are listed in the References field of the project submission form. In creating our solution, my team has not used any copyrighted materials (i.e., music, images, text, etc.) that we don't have permission to use."

Then press "Submit for Judging".
