# Prompt: four kids features, tested, deployed, and a new 30 second film

You are working in `/Users/agentsinc/Desktop/NASA Naryn` (git repo `pathmaker7/404-llsn`, branch `main`; this is a
personal repo, so committing and pushing to `main` is allowed). It is the NASA Space Apps 2026 project "Lunar Landing
Site Navigator" by team "404 agents" from Naryn, Kyrgyzstan (Manuchehr, Aruzhan, Kairat, Arsen, Amirbek). The judging
deadline is Sunday 15 November 2026, 11:59 p.m. Quality comes first, but work in parallel so it finishes fast.

The audience is **children in Kyrgyzstan and Central Asia** (and the judges watching). Every feature must feel like a
toy a 10 year old wants to touch, while every number in it comes from the app's real NASA based model. No fake effects
that contradict the data.

## Read first (10 minutes, do not skip)

- `README.md`, `docs/SUBMISSION.md`, `docs/VIDEO-SCRIPT.md`, `docs/SI-usage.md`.
- App code: `app/index.html`, `app/i18n.js` (English, Russian, Kyrgyz; every key must exist in all three, a test checks
  identical keys and placeholders), `app/mission.js` (limits: battery hours `Mission.limits.nightH`, radio silence
  `silenceH`), `app/src/main.js` (state `S`, `addCustom`, `enterSite`, canvas pointer handlers; `window.__ov` is the
  map's `Overview`), `app/src/overview.js` (`Overview.pick(px, py, w, h)` returns the Moon `{lat, lon}` under a pixel;
  `addSite`, `flyTo`, `project`), `app/src/surface.js` (the 3D first person view on the site), `app/src/verdict.js`
  (`judgeAt(sky, hour, W, slope, evaSlope)` is THE survival rule; never write a second one), `app/src/allsites.js`
  (`dayVerdicts`, the grid of sites x days, the launch slip line; `window.__all` exposes state), `app/src/custom.js`
  (`makeSite` for a spot the user adds; such spots use 320 m terrain, so they find fewer safe days than the 80 m
  prepared sites), `app/src/data.js` (`loadSky`, `loadPolar`, `registerSite`), `app/css/app.css`.
- Tools: `npm test` (unit checks, i18n parity, no dash punctuation in judged pages, syntax check of every tool),
  `npm run smoke` (Playwright end to end), `node tools/test-drop.cjs` (drop a lander), `node tools/record-demo.cjs`
  (records the silent film by driving the real app with Playwright, writes `docs/demo-silent.mp4` and
  `docs/demo-captions.json`, fails if a caption is faster than 3.7 words a second), `node tools/narrate.cjs` (lays a
  voice under it; env `MAX_TEMPO`, `CUTS`, `VOICE_NOTE`), `node tools/align-take.cjs` (finds each line in one recorded
  take by ElevenLabs speech to text), `npm run deploy` (Firebase: app at https://lunar-navigator-404.web.app, explainer
  and film at https://lunar-navigator-explained.web.app).

## House rules (each one was learned the hard way in this project)

1. Never use an em dash, an en dash or a double hyphen as punctuation anywhere (UI, code comments, commits, docs).
   Use a comma, colon, semicolon, parentheses or a new sentence. `npm test` fails on dashes in judged pages.
2. Every visible string goes through `app/i18n.js` in English, Russian and Kyrgyz. Kyrgyz must be real Kyrgyz, not
   Russian. Place names follow the existing `PLACES` map.
3. One survival rule: anything that says "survives" or "lost" must call `judgeAt` / `dayVerdicts`, and a test must
   prove the feature agrees with the grid for many days and sites.
4. No image, voice or likeness of anyone under 18 anywhere (Space Apps Terms). Characters are drawn, not photos.
5. Controls are styled, never raw browser defaults (no native checkboxes, no arrow glyph buttons). Panels of controls
   load open with a close button on desktop, closed on phones. The answer (verdict, deciding numbers) stays visible;
   only explanations and sources go behind hover or a closed line.
6. Text that comes from the page address or user input (names typed by kids) is cleaned before it reaches HTML
   (see `addCustom` in `main.js`); keep a test that a crafted name runs no script.
7. Scratch files go in the session scratchpad, never new folders on `~/Desktop`. A Bash hook misreads the space in
   "NASA Naryn" when `cp` or `mkdir` targets the repo: use `node -e "require('fs').copyFileSync(...)"` instead.
   `WebFetch` fails on spaceappschallenge.org certificates: use `curl`.
8. Strings with an apostrophe ("we're") in single quoted JS break the file; `npm test` now syntax checks every tool.
9. After deploying, check the live file hash against the local one; the film and HTML are served `no-cache`.
10. Do not say "done" from a green test alone: open the deployed site in Playwright, click like a child would, read
    the screenshots yourself, and only then report.

## The four features

Build each in its own git worktree INSIDE the repo (`git worktree add --no-track -b feat/<name>
.claude/worktrees/<name> origin/main`, after `git check-ignore -q .claude/worktrees/x` confirms it is ignored), one
parallel agent per feature. Each agent implements, writes its Playwright test under `tools/test-<name>.cjs`, runs
`npm test`, `npm run smoke` and its own test, and reads its own screenshots. Then merge the four branches into `main`
one at a time, rerunning every test after each merge. Remove the worktrees when merged.

### 1. Land it yourself, with your own lander (customisable, with Central Asian identity)

- A small "My lander" card (top left area of the map screen, styled like the app) shows the lander and lets a kid
  customise it: **type** (four-legged lander, rover, hopper drone), **colour**, **name** (default "Naryn-1", cleaned,
  max 20 characters), and **a hat**: Kyrgyz ak kalpak (white felt, tall, black brim pattern), Kazakh kalpak, Uzbek
  doppi (black, four sided, white pepper pattern), Tajik toqi, or no hat. Build the models from three.js primitives and
  canvas textures in code (no downloaded 3D assets, no copyrighted art); keep them recognisable and respectful.
  A default lander is ready so nothing is required; the choice is kept in `localStorage` (wrapped in try/catch) and can
  be changed any time.
- When the kid clicks a day in the grid (or drops a lander by clicking the Moon), the lander **drops from the
  interface onto the Moon**: it flies from the clicked cell down to the site in 3D, a thruster flame slows it, a dust
  puff on touchdown, then it **lights up green and waves its hat if that landing survives** (per `judgeAt`), or
  **frosts over and its lights go out if it is lost**, with one line saying why in the kid's language
  ("A hill hid the Sun for 3 days, my battery ran out").
- In the first person view the lander stands on the terrain next to the viewer, at the real site, under the real Sun.
- Test: the drop ends with the same verdict as the grid cell for at least 20 random site and day pairs; customisation
  survives a reload; a name like `<img src=x onerror=alert(1)>` is shown as text.

### 2. Keep me alive! (battery game)

- A clear button at the **top left** of the site screen: "Play: Keep me alive" (three languages).
- Full screen game overlay over the 3D view: a big battery, solar panel indicator, radio bars, a 14 day clock, the
  lander character. Time runs fast (14 days in about 30 to 60 seconds, with speed buttons). The battery fills while the
  Sun is above the real horizon and drains in shadow so that a full battery lasts exactly `Mission.limits.nightH`;
  radio bars show while Earth is above the horizon; radio silence longer than `silenceH` also loses. Use the same
  hourly sky data and horizon as `judgeAt` (`loadSky`), so **the game ends exactly as the verdict says**.
- Before playing, the kid picks a landing day (or the game offers "try a green day" / "try a red day"). Losing shows a
  sleepy "zzz" lander and the reason; winning shows a celebration and "14 days survived". Offer "try another day".
- Test: for 50 random site and day pairs, the game's outcome (survived or lost, and which reason) equals
  `judgeAt` for that landing. Play one full game in Playwright and screenshot the start, middle and end.

### 3. Ice hunter

- A mode button "Ice hunter" on the map screen. The kid taps any spot near the pole. The app judges that spot over
  the whole period (2021 to 2031) with the same code as a dropped lander and answers:
  - never in sunlight in the model: a sparkle and "This spot did not see the Sun once in 10 years in our model. Water
    ice could hide in places like this." plus one line of real context: NASA's LCROSS mission found water ice in the
    shadowed crater Cabeus in 2009 (cite the NASA page; fetch it with curl and link it in the code comment and
    `app/ATTRIBUTION.md`);
  - sometimes lit: "The Sun reached here X% of the time: too warm for ice to stay."
- Keep a found-ice counter for the kid ("Ice spots found: 3"). Wording must say "could", never "there is ice".
- Test: a known permanently dark crater floor (for example Shackleton floor or Faustini floor, both 0 safe days)
  reports dark; a known lit ridge (Connecting ridge) reports a non zero sunlit share that matches the model.

### 4. Quiz mode for students

- A "Quiz" button on the map screen opens a styled overlay: 5 questions per round drawn at random from a pool of
  **25**, each with **4 options**, one correct. After each answer: "Correct!" or "Not quite", and an explanation of why
  the right answer is right AND why the chosen wrong answer is wrong, written for a 10 to 14 year old, in English,
  Russian and Kyrgyz.
- Questions are about this interface and this challenge: what green and hollow blocks mean, why Earth is up only about
  a week a month, the Sun's dark season, the 354 day repeat (12 lunar months; like Orozo coming about 11 days earlier
  each year), why the pole and not the equator, why a hill matters when the Sun is low, what the battery and radio
  limits mean, what happened to Chandrayaan-3, why IM-2 fell over although the day was fine, what water ice has to do
  with dark craters, what NASA data the app uses (LOLA terrain, JPL positions). At least 8 questions are **live**: they
  take a real site and date from the app ("Peak near Shackleton, 3 March 2027: will a lander survive?" or "which
  check fails?") and compute the correct answer with `judgeAt`, so the answer is always true.
- End screen: score out of 5, a friendly message, "play again" (new random 5).
- Test: every pool question has exactly 4 distinct options and 1 correct; all 25 exist in 3 languages; live questions'
  answers equal `judgeAt`; a full round in Playwright.

## After the four are merged

1. `npm test`, `npm run smoke`, every `tools/test-*.cjs`, then `npm run deploy`, then run every Playwright test again
   **against the deployed URLs**, as a child would use it, on a 1920x1080 desktop and a 390x844 phone. Read the
   screenshots. Fix and redeploy until clean. Check live hashes equal local files.
2. **New 30 second film**, dynamic, showing the core and then the features one after another. Official rule (quote it,
   do not change it):
   ```
   Video Demo: The video pitch must be 30 seconds or less.
   Projects that exceed these limits will not be eligible for Global Judging.
   ```
   https://www.spaceappschallenge.org/resources/project-submission-guide/
   Keep the guide's order (names and team at 0:00, challenge at 0:02, title and tagline by 0:05, how it works with NASA
   data, the future at the end). Suggested beats: who we are; "When can a Moon landing survive?"; the grid and the
   kalpak lander dropping onto the Moon and lighting up green; "Keep me alive" battery draining and refilling;
   ice hunter sparkle; a quiz question answered; Chandrayaan-3 proof; "Free for schools across Central Asia".
   Edit `tools/record-demo.cjs` (it drives the real app; captions at most 3.7 words a second; it pre-judges a drop spot
   with the app's own code because safe days on 320 m terrain sit on a few pixels of peaks, see the current drop shot).
   Voice: ElevenLabs stock voice **Sarah** (`EXAVITQu4vr4xnSDxMaL`, model `eleven_multilingual_v2`, speed 1.1); the key
   is in `~/.elevenlabs-key` (read it from the file, never print it; free plan: stock voices work, Voice Library voices
   return 402). Speak numbers as words ("four oh four", "three fifty-four"). Generate each line, join with 1.5 s
   gaps, run `tools/align-take.cjs` (speech to text must match every line 100%), then
   `MAX_TEMPO=1.25 node tools/narrate.cjs <take> "ElevenLabs text to speech, voice Sarah"`. Keep the visible
   "Made with AI (SI) tools: Claude. Synthetic voice." watermark and the metadata. Film must be 30.0 s or less. Pull a
   frame every 2 seconds into one contact sheet and read it before shipping. Update `docs/VOICE-TAKE.txt`,
   `explainer/record.html`, `docs/VIDEO-SCRIPT.md`, `docs/demo-captions.json`, keep the take in `docs/`.
3. Update `docs/SUBMISSION.md` (summary and Detailed Project Description: the four features in plain words, their
   limits stated honestly), `docs/SI-usage.md`, `README.md`, `docs/PRESENTATION-SCRIPT.md`, and the deck if a slide
   names features (`npm run deck` rebuilds the PDF).
4. Commit with clear messages (no dash punctuation), push `main`, deploy, verify live hashes, copy the final film to
   `~/Downloads/LunarNavigator-final-film.mp4`.

## Report at the end

A table per feature: what a child does, what they see, the test that proves it agrees with the model (with its
output), and the deployed URL to try it. Then the film link, its duration, its caption list with times, and the
contact sheet you read. Mark anything you did not verify as not verified.
