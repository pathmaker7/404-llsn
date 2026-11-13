// After `npm run deploy`: loads both live sites in headless Chrome and fails on any page error, a broken image,
// a video that will not load, or sideways scroll on a phone. Run: npm run live
const { chromium } = require('playwright-core');
const APP = 'https://lunar-navigator-404.web.app/', EXPLAINER = 'https://lunar-navigator-explained.web.app/';

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const errors = [];
  for (const [w, h] of [[390, 844], [1920, 1080]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', (e) => errors.push(`${w}px: ${e.message}`));
    const t0 = Date.now();
    await p.goto(APP);
    await p.waitForFunction(() => window.__app && window.__app.sites.length > 0, null, { timeout: 60000 });
    const app = await p.evaluate(() => ({ sites: __app.sites.length, sw: document.documentElement.scrollWidth, link: document.querySelector('a.explain')?.href }));
    console.log(`app ${w}px: ${app.sites} sites in ${Date.now() - t0} ms, page width ${app.sw}`);
    if (app.sw > w || app.link !== EXPLAINER) errors.push(`app ${w}px: ${JSON.stringify(app)}`);

    await p.goto(EXPLAINER, { waitUntil: 'load' });
    await p.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); })));
    const ex = await p.evaluate(async () => {
      const v = document.querySelector('video');
      v.preload = 'auto'; v.load();
      await new Promise((r) => { if (v.readyState >= 1) r(); v.onloadedmetadata = r; v.onerror = r; setTimeout(r, 20000); });
      return { sw: document.documentElement.scrollWidth, broken: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')),
        video: Math.round(v.duration || 0), app: [...document.querySelectorAll('a')].some((a) => a.href === 'https://lunar-navigator-404.web.app/') };
    });
    console.log(`explainer ${w}px: page width ${ex.sw}, broken images ${ex.broken.length}, video ${ex.video} s`);
    if (ex.sw > w || ex.broken.length || ex.video !== 120 || !ex.app) errors.push(`explainer ${w}px: ${JSON.stringify(ex)}`);
    await p.close();
  }
  await browser.close();
  if (errors.length) { console.error('LIVE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('both live sites OK');
})();
