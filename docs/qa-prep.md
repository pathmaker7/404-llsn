# Judge Q&A preparation

Short answers, each backed by a command in README "Verification". Say the number, then the source. If a judge finds a real limit, agree and name the fix; never stretch a claim.

| # | Question | Answer |
|---|---|---|
| 1 | How do you know the Sun and Earth positions are right? | We compare against NASA JPL Horizons at 5 sites (3 polar, Apollo 11, Chang'e 4) for 30 days: worst error 0.0047°, about a hundredth of the Sun's width (`npm run validate`). Injecting a 0.2° error makes the check fail. |
| 2 | How do you know the sunlight numbers are right? | NASA's LOLA team publishes Sun and Earth visibility maps for the pole (PGDA product 69, Mazarico et al. 2011). With their definitions we agree to a median 0.3 percentage points for the Sun and 0.2 for Earth over 131 points and 18.6 years (`npm run crosscheck`). Rotate our map 180° and it fails. |
| 3 | Then why is your Shackleton rim 90% and NASA's map 61% at the same spot? | The 61% is the average of 16 NASA pixels around our point. The crest is one or two 120 m pixels wide, so most of that block is crater wall in shadow. NASA's best pixel within 240 m is 85.8%. Ours is about 4 points higher, consistent with 480 m terrain slightly lowering the skyline. That is the point of our neighbourhood map: 0% to 87% within 2.4 km. |
| 4 | Is 480 m terrain enough? | For the horizon, yes: what blocks the Sun is ridges kilometres to hundreds of kilometres away, and our 120 m cross-check agrees to 0.3 points in the median. For landing hazards, no: boulders and metre slopes need 5 m data (NASA PGDA product 78). We say that in the app; slope here is over 960 m and NASA's limit is over 100 m, so real slopes are steeper. |
| 5 | What about relay satellites? | The challenge defines communication as direct-to-Earth, and NASA's Artemis III requirements say "assume no comm relay is available". The far side shows why relays exist: Chang'e 4 sees Earth 0% of the year. Adding a relay orbit is our first extension. |
| 6 | Why is Haworth rim (Malapert massif side) your best balance? | Over one year it has the Sun and Earth up together 69.0% of the time, the highest of our presets; its longest Earth blackout is 4.8 days against 14.4 for Shackleton rim (`npm run results`). The name says "Malapert massif side" because the best-lit point of Haworth's rim ring lies there. |
| 7 | What does the score mean? | 0.4 × sunlit % + 0.4 × Earth % + 20 × (1 − longest night / stay). Power and comms weigh the same; the night term rewards short battery gaps. It is a ranking aid, not physics, so the raw numbers sit next to it. |
| 8 | What are the Artemis III checks? | Five of NASA's six "Key Artemis III Landing Requirements" from the Artemis overview NASA gave Space Apps: within 6° of the pole, landing slope under 10°, EVA slope within 2 km under 20°, direct-to-Earth link, lighting. The sixth, landing within 100 m of a target, is navigation. Shackleton rim scores 4 of 5: the crater wall within 2 km is 33.7°. |
| 9 | How is this different from Quickmap, Moon Trek and JPL Horizons? | The challenge statement names those as built for specialists. We answer one planning question on one screen: which site, which date, with countdowns, a best-date jump, Artemis checks and a shareable link, offline, in three languages. |
| 10 | Does it handle libration and the lunar seasons? | Yes: Sun and Earth are rotated into the Moon's real orientation every hour (IAU model), which includes libration; that wobble is exactly why Earth rises and sets at the pole. The year view shows the seasons in the date planner. |
| 11 | Does it work outside the south pole? | Yes: the whole Moon at 7.6 km, plus 474 m around 17 landing sites (Apollo, Luna, Chang'e, Chandrayaan-3, SLIM, IM-1, Blue Ghost). Apollo 11 sees Earth 100% of the year but has a 14.8-day night. |
| 12 | How were the landing site coordinates chosen? | Missions: published coordinates (Wikipedia's landing list citing LROC and NSSDCA; IM-2 from its own article because the list page has it wrong). Pole presets: crater centres from the USGS Gazetteer, then the best-lit point on each rim ring, computed, not typed in. |
| 13 | What would you do with another month? | Relay satellite visibility; 5 m terrain around Artemis III regions; solar array orientation for real power in watts; thermal; a crowd mode for classrooms. |
| 14 | How did you use AI (SI)? | Claude in Claude Code wrote most of the code and checks; every number was then checked by a command against NASA references, and each check was broken on purpose to prove it can fail. Details in docs/SI-usage.md, as the rules require. |
| 15 | Was this built before the hackathon? | Answer factually: the repository dates show what was done when, and docs/SI-usage.md lists it. Do not argue; show the dates. |

## Numbers to know by heart

- 0.0047°: worst error against JPL Horizons
- 0.3 points: median difference against NASA's illumination map
- 86.9% sunlit, 14.4 days without Earth: Shackleton rim
- 69.0% Sun and Earth together: Haworth rim (Malapert massif side)
- 0% to 87% within 2.4 km: why a few hundred metres matter
- 0% Earth: Chang'e 4 (far side)
