# Use of AI (SI) tools

Space Apps asks teams to say where they used AI. We did, and here is where.

| What | Tool | How the team checked it |
|---|---|---|
| The 3D view, the terrain pipeline, the horizon masks | Claude (Anthropic), directed by teammate steppekid | his pipeline tests, and a comparison with NASA JPL Horizons |
| The answer panel, the survival rules, positions for 2021 to 2031, the tests | Claude (Anthropic) in Claude Code, directed by the team | `npm test`, `npm run smoke`, and the team playing the app |
| README, the "How it works" page, the Russian and Kyrgyz texts | Claude (Anthropic) | read by the team; Russian and Kyrgyz need a native read before the pitch |
| The 29 second demo film (`docs/demo-30s.mp4`) | recorded from the real app by a script; captions written with Claude | carries a visible "Made with AI (SI) tools" watermark, as the rules require |

No NASA logo, flag or mission identifier is used. No image, sound or text in the app was generated as a picture or audio by AI; the Moon surface is drawn from NASA LOLA elevation data.
