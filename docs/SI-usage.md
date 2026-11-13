# SI (Super Intelligence / AI) usage

Space Apps rule: "Each team's project submission must include a description of how SI tools were used during the development of their project."

| What | Tool | How |
|---|---|---|
| Reading the challenge, rules and data sources | Claude (Anthropic) in Claude Code | summarised the Space Apps FAQ, terms and NASA references; every claim was checked against the source page |
| Code for the first version | Claude (Anthropic) in Claude Code | wrote app/, tools/ and the data build scripts |
| Checking the maths | Claude, then NASA JPL Horizons | the Sun and Earth positions were compared against JPL Horizons (worst error 0.0047°); the check is in tools/validate-horizons.cjs |
| Pitch deck and video script drafts | Claude (Anthropic) | first drafts, edited by the team |
| Roadmap and requirement mapping (13 Nov) | Claude (Anthropic) in Claude Code | read the official challenge statement and the Naryn info session slides, wrote docs/roadmap.md mapping each objective to the tool |
| Slope, sunset/Earthset countdown, whole-Moon terrain, shareable link (13 Nov) | Claude (Anthropic) in Claude Code | wrote the code and the checks; each new check was deliberately broken once to prove it fails; the 474 m terrain patches were read from NASA PDS and cross-checked against the polar map (median 4.5 m) |
| Landing site coordinates (13 Nov) | Claude, then sources | coordinates taken from the cited pages, not from model memory; one wrong value on Wikipedia's list page (IM-2) caught against the IM-2 article |
| Cross-check against NASA illumination maps, Artemis III checks, neighbourhood map, live shadows, layout, RU/KY interface, demo recorder, Q&A (13 Nov) | Claude (Anthropic) in Claude Code | wrote the code, checks and drafts; found that its own first comparison method (4 x 4 block mean) was misleading at ridge points and replaced it; Russian and Kyrgyz strings are machine drafts marked "draft" in the app until a native speaker reviews them |
| Explainer website, Firebase deploy, final video with synthetic placeholder voice, live checks (13 Nov) | Claude (Anthropic) in Claude Code | wrote explainer/index.html from the README, roadmap and the official Participant FAQ (rendered and quoted, not recalled); caught and removed two Space Apps facts it had written from memory; the new phone layout check failed on its first run on a real overflow, which was fixed; the video voice is macOS text to speech, marked as a placeholder |
| Official guides, Mission mode direction and document updates (13 Nov, evening) | Claude (Anthropic) in Claude Code | read the Project Submission Guide and the Judging and Awards Guide; compared other teams' public READMEs for this challenge; proposed the Mission mode direction with the owner; wrote Mission mode (the rules in app/mission.js and the first screen) and the document updates (README, explainer, submission draft, video script, Q&A, team checklist); a council of five AI advisors reviewed the idea of a 3D landing simulator and advised against it, so it was not built; after the owner tested the app and said a first-time visitor could not understand it, Claude simplified Mission mode to one guided mission and searched the year of computed data for a landing day where both the place and the date change the outcome (22 July 2027), and updated the documents to match |

The team reviewed, ran and tested all generated code. [Add every other SI tool the team uses during the hackathon, with what it did.]
