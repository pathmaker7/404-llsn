# Demo video script

The official length and format come in the Project Submission Guide (not published on 13 Nov). Two cuts are ready; trim to the limit. Footage is recorded automatically by `node tools/record-demo.cjs` (see the end).

Rules that already apply: no faces, voices or names of anyone under 18; only music and images we have the rights to; NASA gets a licence to the video. Every number below comes from `npm run results`, `npm run validate` or `npm run crosscheck`.

## 30-second cut

| Time | Screen | Voice-over |
|---|---|---|
| 0:00 to 0:05 | Title card over the south pole map | "Artemis astronauts will land at the Moon's south pole, where the Sun and Earth barely rise." |
| 0:05 to 0:12 | Live shadows sweep across the pole | "Our tool takes NASA's laser altimeter terrain and the true Sun, hour by hour." |
| 0:12 to 0:20 | Sky panorama plays: Sun along the ridge, Earth sets | "From any site it shows the real skyline, and how long until sunset or Earthset." |
| 0:20 to 0:27 | Table: Artemis III x/5, jump to best date | "Compare sites and dates in seconds against NASA's Artemis III landing rules." |
| 0:27 to 0:30 | End card | "Pick a site, pick a date, see the sky." |

## 2-minute cut

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

1. Footage: `node tools/record-demo.cjs` writes docs/video/demo-footage.mp4 (1920x1080) following the 2-minute cut's screen column.
2. Voice: an adult team member reads the voice-over column (QuickTime, New Audio Recording), one take per row.
3. Title and end cards: rendered by `npm run video` (end card shows both live URLs).
4. `npm run video` joins title card, footage, end card and voice into docs/demo.mp4 (120 s, 1080p). Without an argument it voices the table above with macOS `say` (Samantha) as a placeholder; with a real recording: `node tools/make-video.cjs voice.m4a`. No music unless we own the rights.
5. The owner approves before anything is uploaded.
