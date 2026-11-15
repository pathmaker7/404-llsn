# Online presentation script (Naryn local jury)

The Naryn info session PDF says online teams prepare a presentation, but gives no length, format or time. This script
runs **4 minutes 20 seconds** with the live app (about **3 minutes 40 seconds** if you skip the clicks on slide 6), and has a
**1 minute** cut if they ask for less. Ask the Local Lead for the real limit and cut from the bottom of each slide's
lines.

Before you start: open https://lunar-navigator-explained.web.app/deck.html in one tab (press N for notes) and
https://lunar-navigator-404.web.app in a second tab, already loaded (the Moon takes a few seconds). Share the whole
screen, not one tab, so you can switch. Speak in English, Kyrgyz or Russian; the slides are in English, as the rules
require. The app has a Kyrgyz and Russian button (top right) if the jury prefers.

## 4 minutes 20 seconds

The slides are the same seven the judges get as the project demo (`explainer/deck.pdf`). Slide numbers below are the new
order: 1 title, 2 problem and why, 3 calendar and cycles, 4 stand on the site, 5 NASA data and proof, 6 the lander and
three games, 7 who it is for.

| Time | Slide or screen | Say | Do |
|---|---|---|---|
| 0:00 | 1 | "We are team 404 agents from Naryn: Aruzhan, Manuchehr, Kairat, Arsen and Amirbek. Our challenge is Lunar Landing Site Navigator. We built a tool that answers one question: which landing days can a Moon mission survive?" | |
| 0:15 | 2 | "At the Moon's south pole the Sun and Earth stay near the horizon. One hill can hide the Sun, and the robot has no power. One ridge can hide Earth, and it has no radio. We built it so every student can learn how a real Moon mission is planned. No telescope, no lab: just a browser." | |
| 0:40 | 3, then the app | "Each row is a landing site, each block a landing day. Green: a solar mission survives 14 days. Red: it is lost. Every row ends with its rank and a score, the share of green days in the period shown. Look at one year: the rows glide to their new rank, and the light comes from the side, as it does at the pole. One short window a month, because Earth is up about two weeks and hidden about two weeks. And months with almost nothing: the Sun's dark season. Five years: it repeats about every 354 days, twelve lunar months, so good days come about 11 days earlier each year, like Orozo, Ramadan." | In the app point at the rank and score at the end of the first row, press **Next year**, point at a green window, then at the empty months. Press **Next 5 years** |
| 1:36 | 4, then the app | "Click a green day and you stand on the site, on real NASA terrain, with the Sun and Earth where they really are. The answer: mission survived, eleven checks, and why. Right under the answer is one of three words: go, not sure with a percent, or don't go. Not sure is the share of four re-checks that disagree, from yellow to deep orange. Under the checks it says Solid or Borderline: we judge the landing again a day earlier, a day later, and with the terrain 0.2 degrees higher and lower. The compass shows 8 spots 1 km around: green survives, hollow red is lost. One line says which of NASA's three dish sites can see the Moon: geometry only. Click anywhere near the pole and your own lander gets its own row of days." | Press **Next month**, click a green block, point at the "Solid" line under the checks, the compass and the dish line, press **Look at Sun**, then play for 3 seconds |
| 2:30 | 5, then the app | "Is it right? Everything is NASA data: LOLA terrain, the Data Book sites, and our Sun and Earth positions match JPL Horizons to 0.0047 degrees. We replay real landings: at Chandrayaan-3's site our sunset is the exact day India put the lander to sleep. And honestly: at IM-2 our model says the day was fine; the lander fell on its side. We judge the place and the day, not the touchdown. On sharp ridges our sunlight is higher than NASA's map, so we call those numbers an upper estimate." | **All sites**, then **Replay a real landing**, **Chandrayaan-3**. Point at the box on the left |
| 3:10 | 6, then the app (skip the clicks for 3 minutes 40 seconds) | "For students: build your own lander and play three games, all judged by the same rule as the calendar. We even packed in the soul of Central Asia: a hat for every lander. Eleven checks, none about hats. The Moon does not care. We do. Build your lander, click a day and it drops onto the Moon: green if it survives, frozen if it is lost. In Keep me alive you watch the battery fill in sunlight and drain in shadow. In Ice hunter you tap a dark crater: if our model never sees the Sun there, water ice could hide there. We say could, we do not detect ice. And a five question quiz." | Open the **My lander** card, pick a hat, click a red block and watch the drop. On a site press **Play: Keep me alive**, **Try a red day**, speed 4x. Back on the map press **Ice hunter** and tap a dark crater near the pole. Press **Quiz** and answer one question |
| 3:55 | 7 | "It is free, in Kyrgyz, Russian and English, it works on a phone with no login, and it comes with a 45 minute lesson plan. Next: the first lessons in Naryn schools. Thank you." | Leave the app link on screen |

## 1 minute cut

Slide 1 line, slide 2 "Where and when is it safe to land?" question, then the app: **Next year** (one sentence on the two cycles),
click a green day ("mission survived, eleven checks"), drop a lander with a hat (the joke), Chandrayaan-3 replay
("our sunset is the day India put it to sleep"), slide 7 line.

## Hard questions

| Question | Answer |
|---|---|
| Are the limits NASA's? | Slope and distance from the pole are NASA Artemis III rules. The battery (2 days) and radio (3 days) are ours, and the user can change them; NASA says VIPER cannot endure more than 50 hours of darkness. |
| Why do some sites show zero days? | Shackleton rim and Nobile rim 1 are Data Book region centres on steep walls. Raise the battery limit live and watch them change. |
| How do you know it is right? | Open "How do we know?", then replay Chandrayaan-3. |
| Why is your sunlight above NASA's map? | Three possible causes we have not separated: we stand 2 m above ground, our terrain is 80 m against their 60 m, and best spots were picked on our own terrain. Read ridge numbers as an upper estimate. |
| Did you test it in a school? | Not yet. The lesson plan is ready in three languages; lessons in Naryn schools are the next step. |
| Did you use AI? | Yes, Claude as a coding assistant; every number is checked against NASA JPL Horizons and NASA maps, and the film carries an AI watermark. Details in docs/SI-usage.md. |
| Does Ice hunter find ice? | No. It says water ice "could" hide where our model never sees the Sun from 2021 to 2031. Only a spacecraft that goes there can tell; NASA's LCROSS found water in the shadowed crater Cabeus in 2009. A spot the Sun does reach is called too warm for ice by a simple rule, not a temperature model. |
| Is Keep me alive a real power model? | No, it is a teaching rule: a full battery lasts 2 days in the dark, one hour of Sun refills it. The 2 days and the 3 days of radio silence are our example values, not NASA's. What is real is the hourly Sun and Earth data, and the end of the game is the same verdict as the grid. |
| A student drops a lander on the Moon: how good is that answer? | It is judged on NASA terrain averaged to 320 metres, not the 80 metres of our fifteen sites, so small shadows and small sunlit peaks are missed. The app says so on that site's panel. |
| Are the quiz answers true? Who checked the Russian and Kyrgyz? | The ten questions marked "Real data from the app" (of 25) name a real site and date and are answered by the same rule as the grid, so they are true to the app. The other fifteen are fixed facts from NASA and mission pages. The Russian and Kyrgyz texts were drafted with AI; say honestly whether your native speakers have checked them yet, and if not, call them a draft. |
| Are the hats right? | They are simplified drawings made in code: Kyrgyz ak kalpak, Kazakh kalpak, Uzbek doppi, Tajik toqi. No photos, no real person. We welcome corrections from people who wear them. |
| Why 0.2 degrees? | It is our own test value, not a NASA figure. Solid means only that the verdict held one day earlier or later and with the terrain 0.2 degrees higher and lower. In the 400 landing days our test scans, 11 change on terrain alone, so the test does separate solid from borderline. |
| Why 1 km and not 100 m? | The 8 spots are judged on NASA terrain averaged to 320 metres, coarser than the 80 metres of our prepared sites. A 100 m step is smaller than one pixel of that terrain, so the answer there would hardly differ from the target's; 1 km is about three pixels. The tooltip says it: this tests a 1 km miss, not 100 m. It works only within about 235 km of the south pole. |
| Is the dish line a real booking? | No. It is geometry: for every hour Earth is in view from the site, is the Moon at least 10 degrees above the horizon at Goldstone, Madrid or Canberra (positions from NASA DSN Now). The 10 degrees is our planning value, not a NASA rule. We do not know whether a dish is free, and the line never changes the verdict. NASA says the three sites are approximately 120 degrees apart in longitude, so the Moon is usually up over one of them. |
| Your terrain is 80 m and some other teams use finer terrain: is that why your sunlight on ridges is high? | It may be one of three causes we have not separated, so we do not claim it is the cause. We say plainly that ridge sunlight is an upper estimate. And an answer that does not hold when the terrain is 0.2 degrees higher or lower is not called Solid; it says Borderline. |
| How can a site say Solid while only 2 of 8 spots around it survive? | Two different questions. Solid is about the day and the height of the terrain: the answer holds one day earlier or later, and with the terrain 0.2 degrees higher or lower. The compass is about where we touch down: a site with 2 of 8 needs a precise landing. |

## If something breaks

The app needs the internet and a few seconds to load the Moon. If it hangs, stay on the slides: every slide has a
real screenshot of the same screen.
