# Team checklist: 14 and 15 Nov

For the five teammates of team 404 agents. It lists what each person can do on 14 and 15 Nov, in order. Times are Naryn time (UTC+6). Names are not written here on purpose: this repository is public, and the rules do not allow the photo, voice or likeness of anyone under 18 in the demo or the submission. Write the names next to the roles on paper or in the team chat.

Each row is marked:

- **REQUIRED**: the Space Apps rules say so (source in the last column). If we skip it, the project may not be eligible.
- **OURS**: our own choice. Nothing in the rules asks for it, but it makes the project better.
- **EVENT**: set by the Naryn local event, not by the submission rules.

Fixed times:

| When | What |
|---|---|
| Sat 14 Nov, 11:00 | hacking starts (check-in is at 09:00, briefing at 10:00, per the Naryn event page) |
| Sun 15 Nov, 16:30 | local pitch to the jury |
| Sun 15 Nov, 20:00 | our target to submit |
| Sun 15 Nov, 23:59 | final deadline: "before Sunday, November 15 at 11:59 p.m. local time" (Judging and Awards Guide) |

Suggested roles (the owner confirms): lead, pitch, video, data and Q&A, translation and testing. One person can hold two.

## Saturday 14 Nov

| # | When | What | Role (suggested) | Kind | Done when, and source |
|---|---|---|---|---|---|
| 1 | before 11:00 | Check that all five of us are on the team page on spaceappschallenge.org (Members tab) and registered at the Naryn event. A team has at most six members and works on one challenge. | lead | REQUIRED | The Members tab shows five names. Source: Participant FAQ ("no more than six (6) members", "only permitted to work on one challenge") |
| 2 | 11:00 | Everyone opens the app from the files (`app/index.html`, no internet) and plays the guided mission to the end: press "Start the mission", try all four spots (Crater wall, Ridge, Second rim, Plateau) on the first day, press "Next: news from the launch pad", replan, read the last screen, then open "Full planner (for experts)" once. | everyone | OURS | Each person has seen the robot survive and be lost, on both days |
| 3 | 11:00 to 13:00 | Give the app to someone who has never seen it (not on the team), say nothing, and watch: can they finish the mission and tell you why the robot survived or was lost? Write down where they get stuck: what they read, what they clicked first, where they stopped. Give the list to the lead. | translation and testing | OURS | A list of at least three real stuck points, or "none", and a yes or no: could they say why the robot survived or was lost? |
| 4 | 11:00 to 14:00 | A native speaker reviews the Russian and Kyrgyz strings in `docs/translations-review.md`. Ask the lead to regenerate the file first (`npm run i18n:review`) so the Mission mode strings are in it. Fix wording in `app/i18n.js` and keep every `{placeholder}` as it is. | translation and testing | OURS | Reviewed flags set to true by the lead. Until then the app labels the languages "draft". The rules only require English. |
| 5 | 14:00 to 16:00 | Choose the demo video. Option A: use `docs/demo-30s.mp4` as it is (29 s, English captions, no voice, visible SI watermark; it shows the guided mission). Option B: record a voiced version from `docs/video-script.md`, with an adult's voice, and put English subtitles on it if the voice is not English. | video | REQUIRED | 30 seconds or less, or the slide deck at 7 slides or fewer. No face, voice or name of anyone under 18. English subtitles if the speech is not English. Source: Project Submission Guide, Participant FAQ |
| 6 | 14:00 to 16:00 | Keep the visible watermark that says the video was made with AI (SI) tools, and write the same sentence in the description of the hosted video. | video | REQUIRED | Source: Project Submission Guide ("Images and videos: Must include a visible watermark to indicate SI generation", "Audio: Must acknowledge SI generation in descriptive text and metadata") |
| 7 | 14:00 to 16:00 | Do not use music or images we do not own. | video | REQUIRED | Second checkbox on the form |
| 8 | 16:00 to 17:00 | Upload the video to YouTube or Google Drive and set the link to public. Open the link in a private window and play it to the end. Send the link to the lead. | video | REQUIRED | The link plays with no login. Source: Project Submission Guide ("Hosting ... ensure the link is publicly accessible") |
| 9 | 14:00 to 17:00 | If the slide deck is used as the demo instead of the video, cut it to 7 slides including the title and intro slides (it has 11 now). If the video is the demo, leave the deck at 11 slides for the local pitch. | pitch | REQUIRED only if the deck is the demo | A deck of 7 slides or fewer. Source: Project Submission Guide |
| 10 | 17:00 to 19:00 | Read `docs/submission-draft.md` once, out loud, and mark anything that is not true for our project. Send corrections to the lead. | data and Q&A | OURS | A list of corrections, or "all true" |

## Sunday 15 Nov

| # | When | What | Role (suggested) | Kind | Done when, and source |
|---|---|---|---|---|---|
| 11 | 09:00 to 12:00 | Ask the Local Lead for the pitch length and format, the language, and the Wi-Fi and power at the venue. These were still open questions in `docs/hackathon-session-prompt.md`. | lead | OURS | Answers written in the team chat |
| 12 | 09:00 to 14:00 | Rehearse the pitch out loud, twice, with the numbers in `docs/qa-prep.md` ("Numbers to know by heart"). Each person answers the questions of their area, including "Why is there no 3D?", "Why only one mission with fixed numbers?" and "Are the 2 day and 3 day limits NASA rules?". Time it. | pitch, data and Q&A | OURS | Two full run-throughs inside the time the Local Lead gave |
| 13 | before 14:00 | Prepare the laptop for the pitch: charged, the app open offline from the files, the video file on the laptop, the deck saved as a PDF. | pitch | OURS | All four are ready |
| 14 | 14:00 to 16:00 | Fill the project page from `docs/submission-draft.md`, field by field: name, summary, "What benefits does it have?", "What do you hope to achieve?", "What tools, coding languages, hardware, or software did you use to develop your project?", the SI question, the demo link, and the References field. English only. Check that every resource we used is in References. | lead | REQUIRED | Every field filled. Source: Project Submission Guide (form questions, English language rule) |
| 15 | 16:30 | Local pitch to the jury. | pitch, everyone | EVENT | Source: Naryn event page |
| 16 | by 20:00 | Tick both checkboxes (the Submission Guide and Terms, and the original work and References statement). Then press "Submit for Judging". | lead | REQUIRED | The page shows the project as submitted. Deadline Sun 15 Nov 23:59; we aim for 20:00 so there are almost four hours left if the form complains. Source: Project Submission Guide, Judging and Awards Guide |
| 17 | after submitting | Open the project page and the video link in a private window and check that both work. Save a screenshot of the submitted page. | data and Q&A | OURS | Both open without a login |

## What not to do

- Submitting `docs/demo.mp4` (120 s) as the demo. It is over the 30 second limit, and "Projects that exceed these limits will not be eligible for Global Judging".
- Any face, voice or name of a person under 18 in the video or on the team page.
- A demo link that needs a login.
- Waiting for 23:59.

## After the deadline

Global Nominees are announced on 3 December 2026, Global Finalists and Honorable Mentions on 17 December 2026, and Global Winners on 26 January 2027.
