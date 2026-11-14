// Drop your own lander: a click on the Moon must land on the spot under the cursor.
// 1) Every prepared site is projected to the screen and picked back; the picked point must be within 2 km of the site.
// 2) A real click on the Moon away from any pin adds a site row with landing days. Run: node tools/test-drop.cjs
const path = require('path');
const { chromium } = require('playwright-core');
const { serve, launch } = require('./smoke.cjs');

(async () => {
  const srv = await serve(path.join(__dirname, '..', 'app'));
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } }), errs = [];
  await p.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the first visit help has its own test (test-tour.cjs)
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/`);
  await p.waitForFunction(() => window.__all && window.__all.ready, null, { timeout: 120000 });
  await p.waitForTimeout(4000); // the opening move ends
  const res = await p.evaluate(() => {
    const ov = window.__ov, cv = document.getElementById('gl'), r = cv.getBoundingClientRect(), out = [];
    ov.render(performance.now());
    for (const s of ov.sites) {
      const v = s.pos.clone().project(ov.camera); if (v.z > 1) continue;
      const at = ov.pick((v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height, r.width, r.height);
      if (!at) { out.push({ name: s.name, km: null }); continue; }
      const D = Math.PI / 180, c = Math.sin(s.lat * D) * Math.sin(at.lat * D) + Math.cos(s.lat * D) * Math.cos(at.lat * D) * Math.cos((s.lon - at.lon) * D);
      out.push({ name: s.name, km: Math.acos(Math.min(1, c)) * 1737.4 });
    }
    return out;
  });
  let bad = 0;
  for (const o of res) { const ok = o.km != null && o.km < 2; bad += !ok; console.log(`${ok ? 'ok ' : 'BAD'} ${o.name}: ${o.km == null ? 'missed' : o.km.toFixed(2) + ' km'}`); }
  const before = await p.evaluate(() => window.__all.rows?.length ?? document.querySelectorAll('[data-site]').length);
  const box = await p.locator('#gl').boundingBox();
  // A spot on bare Moon: the canvas itself is the top element there (no pin, no panel) and the pick hits the Moon.
  const spot = await p.evaluate(() => { const cv = document.getElementById('gl'), r = cv.getBoundingClientRect();
    for (let y = 0.25; y < 0.7; y += 0.03) for (let x = 0.35; x < 0.75; x += 0.03) { const px = r.width * x, py = r.height * y;
      if (document.elementFromPoint(r.left + px, r.top + py) === cv && window.__ov.pick(px, py, r.width, r.height)) return { x: r.left + px, y: r.top + py }; } });
  if (!spot) { console.error('FAIL no bare Moon to click'); process.exit(1); }
  await p.mouse.click(spot.x, spot.y);
  await p.waitForTimeout(3000);
  const after = await p.evaluate(() => window.__all.rows?.length ?? document.querySelectorAll('[data-site]').length);
  console.log(`rows ${before} -> ${after}`);
  await p.screenshot({ path: process.argv[2] || path.join(require('os').tmpdir(), 'drop.png') });
  await b.close(); srv.close();
  if (bad || after !== before + 1 || errs.length) { console.error('FAIL', { bad, before, after, errs }); process.exit(1); }
  console.log('drop works');
})();
