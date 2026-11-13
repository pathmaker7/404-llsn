// Opens app/index.html in headless Chrome, fails on any page error, saves screenshots.
// Run: node tools/smoke.cjs [outDir]
const path = require('path');
const { chromium } = require('playwright-core');

(async () => {
  const out = process.argv[2] || path.join(__dirname, '..', 'docs', 'screenshots');
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1250 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const t0 = Date.now();
  await page.goto('file://' + path.join(__dirname, '..', 'app', 'index.html'));
  await page.waitForFunction(() => window.__app && window.__app.sites.length > 0, null, { timeout: 30000 });
  console.log('loaded in', Date.now() - t0, 'ms');
  const summary = await page.evaluate(() => ({
    sites: __app.sites.map((s) => s.name),
    samples: __app.times.length,
    table: [...document.querySelectorAll('#table tr')].map((r) => r.innerText.replace(/\s+/g, ' ')),
    now: document.getElementById('nowState').innerText,
  }));
  console.log(JSON.stringify(summary, null, 1));
  await page.screenshot({ path: path.join(out, 'app-full.png'), fullPage: true });
  await page.click('#best');
  await page.locator('#scrub').fill('500');
  await page.screenshot({ path: path.join(out, 'app-best-date.png'), fullPage: true });
  // Neighbourhood map: the centre cell must equal the site's own numbers over the whole span (same pipeline).
  const t1 = Date.now();
  await page.click('#hoodBtn');
  await page.waitForFunction(() => window.__hood, null, { timeout: 120000 });
  const hood = await page.evaluate(() => {
    const s = __app.sites.find((x) => x.name === __hood.name), n = __app.times.length;
    return { ...__hood, siteSun: (100 * s.track.cumSun[n]) / n, text: document.getElementById('hoodText').textContent };
  });
  console.log(`neighbourhood in ${Date.now() - t1} ms:`, hood.text);
  if (Math.abs(hood.centre.sun - hood.siteSun) > 0.01) errors.push(`neighbourhood centre ${hood.centre.sun} != site ${hood.siteSun}`);
  await page.locator('#hood').screenshot({ path: path.join(out, 'app-neighbourhood.png') });
  // Live shadows: time one full computation and keep a picture for the deck.
  const t2 = Date.now();
  await page.check('#shadowToggle');
  console.log('shadow map in', Date.now() - t2, 'ms');
  await page.locator('#map').screenshot({ path: path.join(out, 'app-shadows.png') });
  await page.uncheck('#shadowToggle');
  await page.check('#slopeToggle');
  await page.locator('#map').screenshot({ path: path.join(out, 'app-slope.png') });
  // Add a custom site by clicking the map centre (the pole).
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width * 0.47, box.y + box.height * 0.5);
  console.log('after map click:', await page.evaluate(() => __app.sites.map((s) => s.name).join(', ')));

  // Shared link: restores sites and inputs, and a hostile site name never becomes markup.
  const evil = '<img src=x onerror="window.__pwned=1">';
  const hash = new URLSearchParams({ start: '2027-01-01', span: '90', stay: '5', mast: '10', margin: '1', landing: '40',
    sites: [`${evil}|-89.78|-156.25`, 'Apollo 11|0.674081|23.472969', "Chang'e 4 (far side)|-45.5|177.6"].join(';') });
  await page.goto('file://' + path.join(__dirname, '..', 'app', 'index.html') + '#' + hash);
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.sites.length === 3, null, { timeout: 30000 });
  const shared = await page.evaluate(() => ({
    names: __app.sites.map((s) => s.name), landing: __app.landing, start: document.getElementById('start').value,
    mast: document.getElementById('mast').value, imgs: document.querySelectorAll('#sites img, #table img, #windows img').length,
    pwned: !!window.__pwned, rows: [...document.querySelectorAll('#table tr')].map((r) => r.innerText.replace(/\s+/g, ' ')),
  }));
  console.log('shared link:', JSON.stringify(shared, null, 1));
  if (shared.imgs || shared.pwned) errors.push('site name from the URL was rendered as markup');
  if (shared.start !== '2027-01-01' || shared.mast !== '10' || shared.landing !== 40) errors.push('shared link did not restore inputs');
  // A broken link must fall back to defaults, not crash.
  await page.goto('file://' + path.join(__dirname, '..', 'app', 'index.html') + '#span=9999&start=xyz&stay=-4&sites=Apollo%2011|0.67|23.47');
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.sites.length === 1, null, { timeout: 30000 });
  console.log('broken link ->', await page.evaluate(() => [document.getElementById('span').value, document.getElementById('start').value, document.getElementById('stay').value].join(' ')));
  await page.click('#viewGlobe');
  await page.locator('#globeMap').screenshot({ path: path.join(out, 'app-globe.png') });
  // Russian and Kyrgyz: the switch re-renders static and dynamic text; screenshots go to the reviewer.
  for (const [code, word] of [['ru', 'Место'], ['ky', 'Орун']]) {
    await page.goto('file://' + path.join(__dirname, '..', 'app', 'index.html') + '#lang=' + code);
    await page.reload();
    await page.waitForFunction(() => window.__app && window.__app.sites.length > 0, null, { timeout: 30000 });
    const ui = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('h1').textContent,
      th: document.querySelector('#table th').textContent, draft: !document.getElementById('draftNote').hidden }));
    console.log(`lang ${code}:`, JSON.stringify(ui));
    if (ui.lang !== code || ui.th !== word || !ui.draft) errors.push(`language ${code} not applied: ${JSON.stringify(ui)}`);
    await page.screenshot({ path: path.join(out, `app-${code}.png`), fullPage: true });
  }
  await page.evaluate(() => { try { localStorage.removeItem('lang'); } catch (e) {} });

  // Phone and projector: the page never scrolls sideways (wide tables scroll inside their card).
  for (const [w, h] of [[390, 844], [1920, 1080]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'app', 'index.html'));
    await p.waitForFunction(() => window.__app && window.__app.sites.length > 0, null, { timeout: 30000 });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    console.log(`layout ${w}x${h}: page width ${sw}`);
    if (sw > w) errors.push(`page scrolls sideways at ${w}px (${sw}px wide)`);
    await p.screenshot({ path: path.join(out, `app-${w}.png`) });
    if (w === 390) { // the app links to the explainer, and the explainer (assets from tools/explainer-assets.cjs) renders whole
      const link = await p.evaluate(() => document.querySelector('a.explain')?.href);
      if (link !== 'https://lunar-navigator-explained.web.app/') errors.push(`explainer link missing in the app header: ${link}`);
    }
    await p.goto('file://' + path.join(__dirname, '..', 'explainer', 'index.html'));
    await p.waitForLoadState('load');
    await p.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); })));
    const ex = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth,
      broken: [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute('src')),
      app: [...document.querySelectorAll('a')].some((a) => a.href === 'https://lunar-navigator-404.web.app/') }));
    console.log(`explainer ${w}x${h}: page width ${ex.sw}, broken images ${ex.broken.length}`);
    if (ex.sw > w || ex.broken.length || !ex.app) errors.push(`explainer at ${w}px: ${JSON.stringify(ex)}`);
    await p.screenshot({ path: path.join(out, `explainer-${w}.png`), fullPage: w === 390 ? false : true });
    await p.close();
  }
  await browser.close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('no page errors');
})();
