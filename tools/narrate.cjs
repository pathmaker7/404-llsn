// Lays a synthetic voice under the silent demo film: each caption in docs/demo-captions.json is spoken, word for word,
// starting the moment it appears, sped up only as much as needed to finish before the next caption.
// Voice: any `say -v '?'` name. Output: docs/demo-30s.mp4 and explainer/demo-30s.mp4 (29 s, same length as the film).
// Run: npm run narrate -- "Daniel (English (UK))"
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FFMPEG = '/opt/homebrew/bin/ffmpeg', FFPROBE = '/opt/homebrew/bin/ffprobe';
const ROOT = path.join(__dirname, '..'), TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'narrate-'));
const VOICE = process.argv[2] || 'Daniel (English (UK))', BASE_WPM = 185, MAX_WPM = 215, GAP = 0.2;

const caps = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'demo-captions.json'), 'utf8'));
const dur = (f) => +execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString();
const film = dur(path.join(ROOT, 'docs', 'demo-silent.mp4'));
const lines = caps.map((c, i) => {
  const f = path.join(TMP, `l${i}.wav`), slot = c.end - c.t - GAP;
  let wpm = BASE_WPM;
  // The caption keeps the digits; the voice says the team name and the number the way a person would.
  const words = c.text.replace('404', 'four oh four').replace('354', 'three fifty-four');
  // `say` pads its file with silence; trim both ends so only the spoken words count against the moment.
  const speak = (r) => { execFileSync('say', ['-v', VOICE, '-r', String(r), '-o', f + '.aiff', words]);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', f + '.aiff', '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', f]); return dur(f); };
  let d = speak(wpm);
  while (d > slot && wpm < MAX_WPM) d = speak((wpm = Math.min(MAX_WPM, wpm + 8)));
  console.log(`${c.t.toFixed(1).padStart(5)} s  ${d.toFixed(1)} of ${slot.toFixed(1)} s  ${wpm} wpm  ${c.text}`);
  if (wpm > MAX_WPM || d > slot + 0.05) throw new Error(`too long to speak calmly in its moment: ${c.text}`);
  return { f, t: c.t };
});

// A second argument writes a preview elsewhere (the voice choice page) and leaves the submitted film alone.
const PREVIEW = process.argv[3], out = PREVIEW ? path.resolve(PREVIEW) : path.join(ROOT, 'docs', 'demo-30s.mp4');
const inputs = lines.flatMap((l) => ['-i', l.f]);
const delays = lines.map((l, i) => `[${i + 1}:a]adelay=${Math.round(l.t * 1000)}:all=1[a${i}]`).join(';');
const mix = `${delays};${lines.map((_, i) => `[a${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,apad,atrim=0:${film}[a]`;
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(ROOT, 'docs', 'demo-silent.mp4'), ...inputs, '-filter_complex', mix,
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-t', String(film),
  '-metadata', `comment=Screen footage and captions made with SI (AI) tools: Claude (Anthropic). Synthetic voice: Apple text to speech, ${VOICE}. Checked by team 404 agents.`, out]);
if (!PREVIEW) fs.copyFileSync(out, path.join(ROOT, 'explainer', 'demo-30s.mp4'));
fs.rmSync(TMP, { recursive: true, force: true });
const total = dur(out);
console.log(`voice ${VOICE}, film ${total.toFixed(1)} s, wrote ${out}`);
if (total > 30) { console.error('longer than 30 seconds: not eligible for Global Judging'); process.exit(1); }
