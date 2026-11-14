// One long recording of a person reading the film's lines (restarts and slips allowed) becomes one clean take:
// ElevenLabs speech to text gives every word with its time, each caption is found in it (the LAST good attempt wins,
// so a restarted line keeps the second try), long pauses inside a line are shortened, the voice is cleaned and levelled,
// and the lines are written with 1.5 s gaps for tools/narrate.cjs to lay under the film.
// Run: node tools/align-take.cjs ~/Downloads/my-voice.webm   (needs an ElevenLabs key in ~/.elevenlabs-key)
// Writes <recording>.words.json (the transcript, reused on a rerun) and <recording>.aligned.wav.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const ROOT = path.join(__dirname, '..'), IN = path.resolve(process.argv[2] || ''), GAP = 1.5;
if (!fs.existsSync(IN)) { console.error('usage: node tools/align-take.cjs <recording>'); process.exit(1); }
const caps = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'demo-captions.json'), 'utf8'));

// Words compared without case, punctuation or the way a number is written.
const norm = (s) => s.toLowerCase().replace(/404/g, ' four oh four ').replace(/354/g, ' three fifty four ').replace(/chandrayaan-?3/g, 'chandrayaan three')
  .replace(/-/g, ' ').replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);

async function transcribe() {
  const cache = IN + '.words.json';
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const key = fs.readFileSync(path.join(require('os').homedir(), '.elevenlabs-key'), 'utf8').trim(), fd = new FormData();
  fd.append('model_id', 'scribe_v1'); fd.append('language_code', 'en'); fd.append('timestamps_granularity', 'word');
  fd.append('file', new Blob([fs.readFileSync(IN)]), path.basename(IN));
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
  const j = await r.json(); if (!r.ok) throw new Error(`speech to text ${r.status}: ${JSON.stringify(j.detail)}`);
  fs.writeFileSync(cache, JSON.stringify(j.words)); return j.words;
}

// Each transcript word split into normalized tokens that keep the word's start and end time.
function tokens(words) {
  return words.filter((w) => w.type === 'word').flatMap((w) => norm(w.text).map((t) => ({ t, start: w.start, end: w.end })));
}
const lcs = (a, b) => { const d = Array(b.length + 1).fill(0);
  for (const x of a) { let prev = 0; for (let j = 1; j <= b.length; j++) { const tmp = d[j]; d[j] = x === b[j - 1] ? prev + 1 : Math.max(d[j], d[j - 1]); prev = tmp; } } return d[b.length]; };

(async () => {
  const toks = tokens(await transcribe()), out = [];
  let p = 0;
  for (const [i, c] of caps.entries()) {
    const want = norm(c.text), n = want.length;
    let best = null;
    // Windows start where the line's first or second word is heard; a later window with an equal or better score wins.
    for (let s = p; s < toks.length; s++) {
      if (toks[s].t !== want[0] && toks[s].t !== want[1]) continue;
      for (let L = Math.max(1, n - 3); L <= n + 3 && s + L <= toks.length; L++) {
        const w = toks.slice(s, s + L).map((x) => x.t), score = lcs(w, want) / Math.max(L, n);
        if (!best || score >= best.score) best = { s, L, score };
      }
      if (best && best.score === 1 && s > best.s + 2 * n) break; // a clean read was found and we are well past it
    }
    if (!best || best.score < 0.6) throw new Error(`line ${i + 1} was not found in the recording: ${c.text}`);
    // Keep the best attempt among those after the previous line; stop searching past the next line's first clean read.
    const a = toks[best.s].start, b = toks[best.s + best.L - 1].end, heard = toks.slice(best.s, best.s + best.L).map((x) => x.t).join(' ');
    out.push({ a: Math.max(0, a - 0.06), b: b + 0.12, score: best.score, heard });
    console.log(`line ${i + 1}  ${a.toFixed(2)} to ${b.toFixed(2)} s  match ${(best.score * 100).toFixed(0)}%  heard: ${heard}`);
    p = best.s + best.L;
  }
  // Clean and level the voice, cut each line, keep at most 0.15 s of any pause inside it, join with GAP seconds of silence.
  const dst = IN.replace(/\.[^.]+$/, '') + '.aligned.wav';
  const voice = 'highpass=f=80,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=7';
  const parts = out.map((o, i) => `[v]atrim=${o.a.toFixed(3)}:${o.b.toFixed(3)},asetpts=PTS-STARTPTS,silenceremove=stop_periods=-1:stop_duration=0.15:stop_threshold=-38dB:stop_silence=0.15[l${i}]`);
  const split = `[0:a]aformat=sample_rates=48000:channel_layouts=mono,${voice},asplit=${out.length}${out.map((_, i) => `[v${i}]`).join('')}`;
  const gaps = out.slice(1).map((_, i) => `anullsrc=r=48000:cl=mono,atrim=0:${GAP}[g${i}]`);
  const order = out.map((_, i) => `[l${i}]` + (i < out.length - 1 ? `[g${i}]` : '')).join('');
  const graph = [split, ...parts.map((s, i) => s.replace('[v]', `[v${i}]`)), ...gaps, `${order}concat=n=${out.length * 2 - 1}:v=0:a=1[a]`].join(';');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', IN, '-filter_complex', graph, '-map', '[a]', dst]);
  console.log(`wrote ${dst}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
