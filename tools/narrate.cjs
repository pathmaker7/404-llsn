// Lays a synthetic voice under the silent demo film: each caption in docs/demo-captions.json is spoken, word for word,
// starting the moment it appears, sped up only as much as needed to finish before the next caption.
// Voice: any `say -v '?'` name, or ONE recorded take of all the lines (an mp3, m4a or wav from ElevenLabs or a person):
// the take is cut at its longest pauses into one clip per caption. Output: docs/demo-30s.mp4 and explainer/demo-30s.mp4.
// Run: npm run narrate -- "Daniel (English (UK))"
//      npm run narrate -- ~/Downloads/take.mp3 "ElevenLabs, The Professional Presenter"
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FFMPEG = '/opt/homebrew/bin/ffmpeg', FFPROBE = '/opt/homebrew/bin/ffprobe';
const ROOT = path.join(__dirname, '..'), TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'narrate-'));
const ARG = process.argv[2] || 'Daniel (English (UK))', TAKE = /\.(mp3|m4a|wav|aac|ogg)$/i.test(ARG) && fs.existsSync(ARG) ? ARG : null;
const VOICE = TAKE ? process.argv[3] || 'recorded take' : ARG, BASE_WPM = 185, MAX_WPM = 215, GAP = 0.2;

const caps = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'demo-captions.json'), 'utf8'));
const dur = (f) => +execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString();
const film = dur(path.join(ROOT, 'docs', 'demo-silent.mp4'));
const TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse';
// One take: cut it at its N-1 longest pauses (in time order), one clip per caption, and trim each clip's silence.
function cutTake() {
  const log = require('child_process').spawnSync(FFMPEG, ['-i', TAKE, '-af', 'silencedetect=n=-35dB:d=0.25', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const st = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]), en = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const gaps = st.map((s, i) => ({ s, e: en[i] ?? s, len: (en[i] ?? s) - s })).filter((g) => g.s > 0.1 && g.e < dur(TAKE) - 0.1);
  if (!process.env.CUTS && gaps.length < caps.length - 1) throw new Error(`the take has ${gaps.length + 1} spoken parts, the film needs ${caps.length}: leave a clear pause between lines`);
  // A real take pauses as long inside a line as between lines; then pass the cut times by ear: CUTS=3.5,5.93,... npm run narrate -- take.mp3
  const cuts = process.env.CUTS ? process.env.CUTS.split(',').map(Number) : gaps.sort((a, b) => b.len - a.len).slice(0, caps.length - 1).sort((a, b) => a.s - b.s).map((g) => (g.s + g.e) / 2);
  if (cuts.length !== caps.length - 1) throw new Error(`need ${caps.length - 1} cut times, got ${cuts.length}`);
  return caps.map((_, i) => { const a = i ? cuts[i - 1] : 0, b = cuts[i] ?? dur(TAKE), f = path.join(TMP, `t${i}.wav`);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(a), '-to', String(b), '-i', TAKE, '-af', TRIM.replaceAll('-45dB', '-35dB'), f]); return f; }); // an encoded take carries faint noise in its pauses
}
// A person reading slowly needs more; up to about 1.5 the voice stays natural (ffmpeg atempo keeps the pitch).
const MAX_TEMPO = +(process.env.MAX_TEMPO || 1.12);
const takeClips = TAKE ? cutTake() : null;
const lines = caps.map((c, i) => {
  if (TAKE) { // a recorded voice is never re-spoken: it is sped up only as much as its moment needs, at most MAX_TEMPO
    const slot = c.end - c.t - GAP, src = takeClips[i], d0 = dur(src), k = Math.max(1, d0 / slot), f = path.join(TMP, `l${i}.wav`);
    if (k > MAX_TEMPO) throw new Error(`line ${i + 1} is ${d0.toFixed(1)} s, its moment is ${slot.toFixed(1)} s: ${c.text}`);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', src, '-af', `atempo=${k.toFixed(3)}`, f]);
    console.log(`${c.t.toFixed(1).padStart(5)} s  ${(d0 / k).toFixed(1)} of ${slot.toFixed(1)} s  x${k.toFixed(2)}  ${c.text}`);
    return { f, t: c.t };
  }
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
const PREVIEW = process.argv[TAKE ? 4 : 3], out = PREVIEW ? path.resolve(PREVIEW) : path.join(ROOT, 'docs', 'demo-30s.mp4');
const inputs = lines.flatMap((l) => ['-i', l.f]);
const delays = lines.map((l, i) => `[${i + 1}:a]adelay=${Math.round(l.t * 1000)}:all=1[a${i}]`).join(';');
const mix = `${delays};${lines.map((_, i) => `[a${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,apad,atrim=0:${film},pan=stereo|c0=c0|c1=c0[a]`; // the one voice channel on both sides at full level (a plain upmix would make it 3 dB quieter)
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(ROOT, 'docs', 'demo-silent.mp4'), ...inputs, '-filter_complex', mix,
  // A file any judge's device plays: ordinary colour range and pixel format (the captures arrive as full range JPEG
  // colours), 48 kHz stereo sound (the voice chain hands over 96 kHz mono), and the index at the front of the file so
  // the film starts in a browser before it has all arrived.
  '-map', '0:v', '-map', '[a]', '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', '-t', String(film),
  '-metadata', `comment=Screen footage and captions made with SI (AI) tools: Claude (Anthropic). ${process.env.VOICE_NOTE || 'Synthetic voice: ' + (TAKE ? VOICE : 'Apple text to speech, ' + VOICE)}. Checked by team 404 agents.`, out]);
if (!PREVIEW) fs.copyFileSync(out, path.join(ROOT, 'explainer', 'demo-30s.mp4'));
fs.rmSync(TMP, { recursive: true, force: true });
const total = dur(out);
console.log(`voice ${VOICE}, film ${total.toFixed(1)} s, wrote ${out}`);
if (total > 30) { console.error('longer than 30 seconds: not eligible for Global Judging'); process.exit(1); }
