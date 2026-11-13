// Finishes the 2-minute video: title card + recorded footage + end card + voice-over, as docs/demo.mp4 (1920x1080).
// The voice text and start times are read from the "2-minute cut" table in docs/video-script.md, so the two cannot drift.
// Voice is a synthetic placeholder (macOS `say`, voice Samantha) until an adult team member records it; to use a real
// recording instead, run: node tools/make-video.cjs path/to/voice.m4a
// Needs docs/video/demo-footage.mp4 from `node tools/record-demo.cjs` and ffmpeg at /opt/homebrew/bin.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const FFMPEG = '/opt/homebrew/bin/ffmpeg', FFPROBE = '/opt/homebrew/bin/ffprobe';
const ROOT = path.join(__dirname, '..');
const APP_URL = 'https://lunar-navigator-404.web.app', EXPLAINER_URL = 'https://lunar-navigator-explained.web.app';
const TITLE_S = 12, FOOT_END = 110, END_S = 10; // title covers 0:00 to 0:12, footage 0:12 to 1:50, end card 1:50 to 2:00

const sec = (t) => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
const dur = (f) => Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

function rows() {
  const md = fs.readFileSync(path.join(ROOT, 'docs', 'video-script.md'), 'utf8');
  const part = md.split('## 2-minute cut')[1].split('\n## ')[0];
  return part.split('\n').filter((l) => /^\| \d:\d\d to /.test(l)).map((l) => {
    const c = l.split('|').map((x) => x.trim());
    const [a, b] = c[1].split(' to ');
    return { start: sec(a), end: sec(b), text: c[3].replace(/^"|"$/g, '') };
  });
}

const card = (title, lines) => `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;width:1920px;height:1080px;display:flex;flex-direction:column;justify-content:center;padding:0 160px;box-sizing:border-box;
  background:radial-gradient(circle at 78% 30%,#26324a 0,#0b0f17 55%);color:#e9edf5;font-family:-apple-system,Helvetica,Arial,sans-serif}
  h1{font-size:104px;margin:0 0 36px;letter-spacing:-2px}p{font-size:42px;margin:10px 0;color:#b7c2d6}b{color:#ffcf5c;font-weight:600}
</style><h1>${title}</h1>${lines.map((l) => `<p>${l}</p>`).join('')}`;

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lunar-video-'));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [name, html] of [
    ['title', card('Lunar Landing Site Navigator', ['Will the Sun power us? Can we talk to Earth?', 'Team 404 agents, NASA Space Apps Challenge 2026, Naryn'])],
    ['end', card('Pick a site, pick a date, see the sky.', [`App: <b>${APP_URL.replace('https://', '')}</b>`, `How it works: <b>${EXPLAINER_URL.replace('https://', '')}</b>`, 'Open source, offline, English, Russian and Kyrgyz'])],
  ]) { await page.setContent(html); await page.screenshot({ path: path.join(tmp, `${name}.png`) }); }
  await browser.close();

  let voice = process.argv[2];
  if (!voice) { // synthetic placeholder: one clip per row, placed at the row's start, sped up if it would overrun the row
    const list = rows(), parts = [];
    for (const [i, r] of list.entries()) {
      const f = path.join(tmp, `v${i}.aiff`);
      let rate = 175;
      for (;;) {
        execFileSync('say', ['-v', 'Samantha', '-r', String(rate), '-o', f, r.text]);
        if (dur(f) <= r.end - r.start - 0.3 || rate >= 260) break;
        rate += 10;
      }
      const d = dur(f);
      if (d > r.end - r.start) throw new Error(`voice row ${r.start}s is ${d.toFixed(1)} s, longer than its ${r.end - r.start} s slot`);
      console.log(`${String(r.start).padStart(3)} s  ${d.toFixed(1)} s of ${r.end - r.start} s at ${rate} wpm`);
      parts.push({ f, start: r.start });
    }
    voice = path.join(tmp, 'voice.m4a');
    const inputs = parts.flatMap((p) => ['-i', p.f]);
    const delays = parts.map((p, i) => `[${i}:a]adelay=${p.start * 1000}|${p.start * 1000}[a${i}]`).join(';');
    const mix = parts.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${parts.length}:normalize=0,apad=whole_dur=${FOOT_END + END_S}[v]`;
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${delays};${mix}`, '-map', '[v]', '-c:a', 'aac', voice]);
  }

  const out = path.join(ROOT, 'docs', 'demo.mp4');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error',
    '-loop', '1', '-framerate', '25', '-t', String(TITLE_S), '-i', path.join(tmp, 'title.png'),
    '-i', path.join(ROOT, 'docs', 'video', 'demo-footage.mp4'),
    '-loop', '1', '-framerate', '25', '-t', String(END_S), '-i', path.join(tmp, 'end.png'),
    '-i', voice,
    '-filter_complex', `[0:v]scale=1920:1080,setsar=1,fps=25[a];[1:v]trim=${TITLE_S}:${FOOT_END},setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,fps=25[b];[2:v]scale=1920:1080,setsar=1,fps=25[c];[a][b][c]concat=n=3:v=1:a=0[v]`,
    '-map', '[v]', '-map', '3:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-t', String(FOOT_END + END_S), out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  const total = dur(out);
  console.log(`wrote ${out}: ${total.toFixed(2)} s`);
  if (Math.abs(total - (FOOT_END + END_S)) > 0.5) { console.error(`expected ${FOOT_END + END_S} s`); process.exit(1); }
})();
