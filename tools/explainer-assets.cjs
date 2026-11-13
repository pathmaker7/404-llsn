// Copies the current screenshots and demo video into explainer/ so the deployed page never shows stale pictures.
// Run by `npm run deploy` before Firebase uploads app/ and explainer/.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), IMG = path.join(ROOT, 'explainer', 'img');
fs.mkdirSync(IMG, { recursive: true });
for (const f of ['app-1920.png', 'app-shadows.png', 'app-slope.png', 'app-neighbourhood.png', 'app-globe.png', 'app-mission.png', 'app-mission-choose.png', 'app-mission-verdict.png', 'app-mission-learned.png', 'app-mission-3d.png'])
  fs.copyFileSync(path.join(ROOT, 'docs', 'screenshots', f), path.join(IMG, f));
fs.copyFileSync(path.join(ROOT, 'docs', 'demo-30s.mp4'), path.join(ROOT, 'explainer', 'demo.mp4'));
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-loglevel', 'error', '-ss', '5', '-i', path.join(ROOT, 'docs', 'demo-30s.mp4'), '-frames:v', '1', '-q:v', '3', path.join(IMG, 'poster.jpg')]);
// Every local file the page references must exist, or the deploy stops here.
const html = fs.readFileSync(path.join(ROOT, 'explainer', 'index.html'), 'utf8');
const missing = [...html.matchAll(/(?:src|poster|href)="(?!https?:|#)([^"]+)"/g)].map((m) => m[1]).filter((f) => !fs.existsSync(path.join(ROOT, 'explainer', f)));
if (missing.length) { console.error('explainer references missing files:', missing.join(', ')); process.exit(1); }
console.log('explainer assets ready');
