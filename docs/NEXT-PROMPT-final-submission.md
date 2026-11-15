# Prompt: bring the slides, the PDF and the project form up to the app's final state

You are working in `/Users/agentsinc/Desktop/NASA Naryn` (git repo `pathmaker7/404-llsn`, branch `main`; a personal
repo, so committing and pushing to `main` is allowed). It is the NASA Space Apps 2026 project "Lunar Landing Site
Navigator" by team "404 agents" from Naryn, Kyrgyzstan. The owner submits the project form by **23:30 Naryn time on
Sunday 15 November 2026**; the hard limit is 23:59. Finish your part by 23:10 and hand him the form text. Do not edit
anything under `app/` or `tools/test-*.cjs`: the app is final, tested and deployed.

Read first: `docs/SUBMISSION.md` (the form text, field by field), `docs/PRESENTATION-SCRIPT.md`, `explainer/deck.html`
(the seven slides), `README.md`, and this file to the end.

## What changed in the app tonight (all live at https://lunar-navigator-404.web.app)

Five additions, each a plug-in with its own test (`npm run test:planner`). The English strings below are what the page
shows; Russian and Kyrgyz exist for every one.

1. **Site score and rank.** Every row of the first screen ends with its rank and a score, for example `11 / 30  #1  37`.
   Score = green landing days divided by all landing days in the period shown, times 100, rounded. Equal scores share a
   rank. The answer panel says "Rank 1 of 15, score 37 of 100 (Nov 15 to Dec 15, 2026)". It follows the period buttons
   and the battery and radio limits. Code: `app/src/score.js`.
2. **Solid or borderline.** Under the checks of every verdict: "Solid: the answer holds one day earlier or later, and
   with the terrain 0.2° higher or lower." or "Borderline: this landing is lost one day later." The landing is judged
   four more times (a day earlier, a day later, the terrain horizon 0.2° higher, 0.2° lower, recomputed hour by hour
   from the site's own horizon). In 400 landing days scanned by its test, 11 flip on terrain alone. The 0.2° is the
   team's own test value, not a NASA figure. Code: `app/src/robust.js`.
3. **What if we land 1 km off.** A small compass in the answer panel: the target in the middle, 8 spots 1 km around,
   solid green survives, hollow red is lost, and one sentence: "2 of 8 spots 1 km around also survive." or, when the
   target is lost, "1 km to the north east this landing survives." Same survival rule and same limits as the target.
   Limit, stated in its tooltip: the neighbours are judged on NASA LOLA terrain averaged to 320 m, coarser than the
   80 m of the prepared sites, and it tests a 1 km miss, not 100 m. Only within about 235 km of the south pole.
   Code: `app/src/nearby.js`.
4. **Dish on Earth.** "Dish on Earth: a dish can see the Moon for over 99% of the hours Earth is in view. At landing:
   Goldstone." For every hour Earth is in view from the site, the Moon must be 10° or more above the horizon at one of
   NASA's three Deep Space Network sites (Goldstone, Madrid, Canberra). Geometry only; the 10° is the team's planning
   value, not a NASA rule; it never changes the verdict. Positions from NASA DSN Now,
   https://eyes.nasa.gov/dsn/config.xml ; "approximately 120 degrees apart in longitude" is from
   https://www.nasa.gov/directorates/somd/space-communications-navigation-program/what-is-the-deep-space-network/ .
   Code: `app/src/dsn.js`, and a line in `app/ATTRIBUTION.md`.
5. **Motion that is ours.** Light arrives from the side and shadow slides over, as at the Moon's south pole, where the
   Sun never climbs. When the list is first ready, one line of light passes over it from the left and the rows come in
   behind it. A verdict that changes gets one sweep: a warm line of light when it says survived, a soft shadow when it
   says lost. Rows glide to their new rank when the period changes. Nothing bounces, spins or loops, and nothing in
   motion blocks a click. All of it is off when the visitor asks for reduced motion. Code: `app/src/motion.js`,
   `app/css/motion.css`. (Read the last section of this file first: if it says the motion part was dropped before the
   deploy, leave it out of every text.)

## Why these five: what 512 rival projects showed

On 15 November we read every project submitted to our challenge (412 at 20:45, 475 at 21:50 and 512 at 22:13 Naryn
time, of 1766 teams) and rated each on one rubric. Full table: https://claude.ai/artifact/RfzqaSKjm4fcRuho14neWA (private to the
owner). The numbers below are from each team's own submission text, not from running their apps.

- 118 of 512 are rated 8 or more of 10, 52 are rated 9 or more. Our accuracy is normal in that group, not a lead: 88%
  of them show a check with numbers against NASA, and several quote the same class of Horizons error as our 0.0047
  degrees.
- What only we have: a game or quiz is in 7% of projects, more than one language in 6%, replay of real landings in 9%.
  A word search of all 512 teams' own texts finds no Kyrgyz, no national hat, no "build your own lander", no ice hunt.
  Russian appears in 4. The closest to our student side is "Lunar Timewalker" by Letmein (Sakarya, Turkey; rated 7):
  seven languages with Russian, class lessons and a quiz, but its site comparison is one module of a history app.
- Do not write "no other project has games" or "the only one in Russian": both are false. "No other project in Kyrgyz"
  and "no other game where a student builds a lander" hold for the 512 texts read (one project, CLPS Lunar Mission Lite,
  simulates the battery of "your own lander", which is a planner setting, not a game).
- What the best had and we lacked until tonight, counted in the first 99 top rated: a score and ranking (40 of the 99), a search for a better spot or
  date (28), Deep Space Network stations (22), a landing error test (17), uncertainty on each answer (8).
- What we still lack, and must keep saying plainly: terrain finer than 80 m (rivals use 5 to 120 m), a battery or power
  model (ours is a teaching rule), and our sunlight runs 11 points high on ridges against NASA's maps.
- Naryn has 15 teams, 8 submitted at 21:30. The strongest there: CHRONOS-102 by ProximaZZZ (SPHEREx, another
  challenge) and, on our own challenge, "Ninjago: Masters of Claudejitzu" (GO, RISKY or NO-GO with a suggested fix;
  no 3D, no ground view, six of twelve sites on a flat horizon, dates end in 2028).

## Your tasks, in this order

1. **`docs/SUBMISSION.md`.** Keep every field and its order.
   - High-Level Project Summary: keep the survival question as the first sentence, then say within the first three
     sentences what only we have (four games on the real model, English, Russian and Kyrgyz, a ready lesson, real
     landings replayed), then the planner side in one sentence: sites ranked by a score, every answer marked solid or
     borderline, a check of 8 spots 1 km around, and dishes on Earth.
   - Detailed Project Description, "What it does": add the four planner additions as numbered points after point 8,
     with the exact rules above. Replace "The best site is listed first" with the ranking rule.
   - "How we know it is right": add that each verdict is re-judged four ways, and that the neighbour check agrees with
     the app's own "add a point by coordinates" path on 80 of 80 verdicts.
   - "Limits we state": add the four limits above (score is a share of days, not a science score; 0.2° is our value;
     neighbours on 320 m terrain and a 1 km miss; dishes are geometry only with our 10° value). Keep the existing limits
     paragraph: 92% of the top rated rivals state theirs.
   - NASA Data: add NASA DSN Now (the config address above) and the Deep Space Network page.
   - Use of Super Intelligence: add that these five additions and their tests were written with Claude, directed by the
     team.
   - Tools: mention `npm run test:planner`.
2. **`README.md`:** the same additions, short.
3. **The seven slides (`explainer/deck.html`).** Never an eighth slide: the guide says "slide deck (up to seven slides
   including title and intro slides)" and "Projects that exceed these limits will not be eligible for Global Judging"
   (https://www.spaceappschallenge.org/resources/project-submission-guide/). `node tools/test.cjs` fails on an eighth.
   - On the slide that shows the planner, take a new screenshot of the live app and show the row ending `#1 37` and the
     answer panel with "Solid", the compass and the dish line. Crop tight: one idea per scene.
   - Slide 1 must say why before what: the students of Central Asia, in their languages.
   - Then `npm run deck`, `node tools/deck-preview.cjs`, `node tools/deck-live.cjs`, and read the frames yourself.
4. **`docs/PRESENTATION-SCRIPT.md`:** one sentence for each addition where the live app is shown, and under "Hard
   questions" add: why 0.2 degrees, why 1 km and not 100 m, is the dish line a real booking (no: geometry), why our
   ridge sunlight is high (80 m terrain; we say so and mark such answers borderline), and why a site can say "Solid"
   while only 2 of 8 spots around it survive (Solid is about the day and the height of the terrain; the compass is
   about where we touch down: that site needs a precise landing).
5. `node tools/test.cjs`, then `npm run deploy` (it ships both sites; the app site was already deployed alone with
   `--only hosting:lunar-navigator-404`, and the explainer site with the slides, the PDF and texts.html is yours), then open https://lunar-navigator-explained.web.app/deck.pdf and
   https://lunar-navigator-explained.web.app/deck.html from the live address and check both. Commit only the files you
   changed, with a message that says what changed, and push.
6. **Hand the owner one message:** the form text field by field, ready to paste, and these three steps that are his:
   - press Submit on the Project tab of https://www.spaceappschallenge.org/2026/find-a-team/404-agents/ ;
   - check that every teammate shows on the Members tab and is registered for Naryn;
   - have a Kyrgyz speaker read https://lunar-navigator-explained.web.app/texts.html (every app text in three
     languages, the new ones at the end): the Kyrgyz and Russian are AI drafts.

## Rules of this repo

- No em dash, en dash or double hyphen as punctuation anywhere. Say "students", never "kids".
- A rule the owner must meet is quoted as the official sentence plus its link, fetched that turn.
- Another session may have uncommitted files here (favicons in `app/` and `explainer/`): do not commit or delete what
  you did not make.
- Deploy yourself and give the plain link, never a `?v=` address.

## State of the app at hand-over

Written at 22:35 Naryn time on 15 November 2026 by the session that built the additions.

- **All five additions shipped, motion included.** Commit `3f8d7a5` on `main`, pushed. The app site alone was deployed
  (`--only hosting:lunar-navigator-404`). The explainer site was not deployed by that session: it is yours.
- **One part of motion was cut:** the focus ring does not fade in (it needed a transparent outline on every control,
  which shows as a box in forced colours). Do not mention a focus ring anywhere.
- **Tests on the combined app:** every suite passes in Chrome at 1440x900 and at 390x844 (`node tools/test.cjs`,
  `npm run test:planner`, `npm run test:kids`, `node tools/smoke.cjs`), and the five new tests plus the first visit
  (`tools/test-tour.cjs`) pass with `ENGINE=webkit VIEWPORT=390x844`.
- **Tests against the live address** (`BASE_URL=https://lunar-navigator-404.web.app/`): the five new tests, the 1 km
  check and the first visit on WebKit at 390x844, and the smoke test all pass.
- **What the live page shows for the first site, next month:** the row ends `11 / 30  #1  37`; the answer panel says
  "Rank 1 of 15, score 37 of 100 (Nov 15 to Dec 15, 2026)", "Solid: the answer holds one day earlier or later, and with
  the terrain 0.2° higher or lower.", "Dish on Earth: a dish can see the Moon for over 99% of the hours Earth is in
  view. At landing: Goldstone." and "2 of 8 spots 1 km around also survive."
- **Known limits to say plainly:** the 1 km box needs a 4.5 MB terrain file on its first use; on a slow connection it
  says "Checking the 8 spots 1 km around…" for up to half a minute (measured 1, 2 and 24 seconds from Naryn) while the
  rest of the answer is already there. The dish line names the dishes that have the Moon up at the landing hour even
  when Earth is not in view from the site at that hour: it is geometry, as its tooltip says.
- **The motion test is sensitive to load:** `tools/test-motion.cjs` waits a fixed 450 ms for the side panel. It failed
  once while two browser suites ran side by side and passes alone. Run it alone.
- **Not submitted yet:** at 22:13 our team page still showed no project. Rivals at that minute: 512 submitted of 1766
  teams; in Naryn on our challenge only "Ninjago: Masters of Claudejitzu" has submitted.
