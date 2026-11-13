# Project submission draft

Paste into the team's project page on spaceappschallenge.org (Project tab). Check the field list against the Project Submission Guide once it is published (not out on 13 Nov). Window: 14 Nov 09:00 to 15 Nov 23:59 Naryn time; target 20:00 on 15 Nov.

Every number below comes from a command in README "Verification" (`npm run results`, `npm run validate`, `npm run crosscheck`).

## Project name
Lunar Landing Site Navigator

## High-level summary
At the Moon's south pole the Sun and Earth only rise a few degrees, so one ridge can cut power or radio for days, and a few hundred metres can decide everything. Our tool takes NASA's LRO LOLA terrain, computes the real 360° skyline from any site, and checks the true Sun and Earth positions against it hour by hour. Mission planners, teachers and the public can compare sites and landing dates in seconds: sunlit %, Earth visibility %, longest night, longest Earth blackout, time to sunset and Earthset, slope, and a pass/fail against NASA's Artemis III landing requirements. It covers the whole Moon (Apollo, Luna, Chang'e, Chandrayaan-3, SLIM and commercial landers) with extra detail at the south pole. Sun and Earth positions match NASA JPL Horizons to 0.005°, and our sunlight and Earth visibility match NASA's published LOLA illumination maps to a median 0.3 percentage points. It runs offline in any browser, in English, Russian and Kyrgyz.

## Links
- Demo video: docs/demo.mp4 (120 s); also on https://lunar-navigator-explained.web.app#video. Upload to YouTube if the guide asks for a video link; the voice is a synthetic placeholder until an adult team member records it
- Repository: https://github.com/pathmaker7/404-llsn
- Live app: https://lunar-navigator-404.web.app
- How it works, for non-specialists: https://lunar-navigator-explained.web.app

## Project details
- What it does: compare landing sites and dates by power (sunlight on the solar arrays) and direct-to-Earth communication, with the terrain's real horizon. Views: south pole map with slope and live shadow overlays, whole-Moon map, date planner with "jump to best date", comparison table with Artemis III checks, 360° sky panorama with countdowns, neighbourhood map, power and comms timeline, CSV export of comm windows, shareable link.
- How it works: LOLA LDEM_75S_240M at 480 m for the south pole, LDEM_4 for the whole Moon plus 474 m LDEM_64 boxes around landing sites; a great-circle horizon march with the Moon's curvature; astronomy-engine ephemeris with the IAU lunar rotation model (so Earth's libration is included); fraction of the solar disc above the skyline for power, Earth above the skyline plus a margin for comms.
- Benefits: one screen answers "which site, which date" that otherwise takes Quickmap, Moon Trek and JPL Horizons together; when a launch slips, a planner reruns dates in seconds and shares a link.
- Findings (one year from 14 Nov 2026, 2 m mast):
  - No site wins on everything. Shackleton rim: 86.9% sunlit but up to 14.4 days without Earth, and a 33.7° crater wall within 2 km (Artemis III: 4 of 5).
  - Haworth rim, Malapert massif side: 69.0% of the time with both Sun and Earth up, the best balance of the presets.
  - Within 2.4 km of the Shackleton rim point, sunlight ranges from 0% to 87%.
  - Chang'e 4 on the far side: Earth 0% of the year, which is why it needed the Queqiao relay. Apollo 11: Earth 100%, but a 14.8-day night.
- Tools: JavaScript, HTML canvas, Node.js, astronomy-engine 2.1.19, playwright-core (testing).

## Use of NASA data
- LRO LOLA gridded elevation: LDEM_75S_240M (south pole), LDEM_64 and LDEM_4 (global), PDS Geosciences Node
- LRO LOLA polar illumination maps (Sun and Earth), PGDA product 69, Mazarico et al. 2011: used to validate our results
- NASA JPL Horizons: used to validate Sun and Earth positions
- NASA Artemis overview for Space Apps (NTRS 20250009323): Artemis III landing requirements

## Space agency partner data
None.

## References
See README "References". Every data source, program and image is cited there, including open source (astronomy-engine, MIT).

## SI usage
See docs/SI-usage.md (required by the rules).
