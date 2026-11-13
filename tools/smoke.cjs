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
  const APP = 'file://' + path.join(__dirname, '..', 'app', 'index.html');
  // Mission mode is the first screen: play one mission end to end before the planner checks.
  await page.goto(APP);
  await page.waitForFunction(() => window.__app && window.__app.sites.length > 0, null, { timeout: 30000 });
  console.log('loaded in', Date.now() - t0, 'ms');
  const hidden = (sel) => page.evaluate((q) => getComputedStyle(document.querySelector(q)).display === 'none', sel);
  if (!(await page.locator('#mGo').count()) || !(await hidden('.results')) || !(await hidden('.sky'))) errors.push('the guided mission is not the first screen');
  await page.screenshot({ path: path.join(out, 'app-mission.png') });
  await page.click('#mGo');
  await page.screenshot({ path: path.join(out, 'app-mission-choose.png') });
  const spot = (key) => page.evaluate((k) => { const s = __app.sites.find((x) => x.key === k); document.querySelector(`[data-spot="${s.id}"]`).click(); return { ...__mission, text: document.getElementById('missionBody').innerText.replace(/\s+/g, ' ').slice(0, 330) }; }, key);
  // The story the mission tells must be what the data says: on landing day only the mountain top survives...
  const first = {};
  for (const k of ['wall', 'plateau', 'rim2', 'ridge']) { first[k] = await spot(k); if (k !== 'ridge') await page.click('#mAgain'); }
  console.log('landing day:', JSON.stringify(first.ridge), '| wall:', first.wall.text);
  if (first.ridge.passing.join() !== 'ridge,rim2' || !first.ridge.ok || first.wall.ok || !/ROBOT WAS LOST/.test(first.wall.text)) errors.push(`landing day story broken: passing ${first.ridge.passing}`);
  // ...and the verdict is the planner's own number for the same site, date and stay.
  const same = await page.evaluate(() => { const s = __app.sites[__app.focus - 1], k0 = __app.landing; return [__mission.checks[0].v, Analysis.metrics(s.track, k0, k0 + 14 * 24 / __app.stepH, __app.stepH).longestDarkH]; });
  if (same[0] !== same[1]) errors.push(`mission night ${same[0]} != planner night ${same[1]}`);
  // The mission report: eleven rows, each with a hover explanation; the four "must" rows decide the verdict.
  const rep = await page.evaluate(() => ({ rows: document.querySelectorAll('table.report tr').length - 1, tips: [...document.querySelectorAll('.tip')].map((t) => t.dataset.tip), must: document.querySelectorAll('table.report tr.must').length }));
  if (rep.rows !== 11 || rep.must !== 4 || rep.tips.length !== 11 || rep.tips.some((t) => t.length < 30)) errors.push('mission report incomplete: ' + JSON.stringify(rep));
  // Minimal by default (owner, 2026-11-14): the report stays folded until the user opens it.
  if (await page.evaluate(() => [...document.querySelectorAll('#missionBody details.more')].some((d) => d.open))) errors.push('the mission report is shown before the user asks for it');
  await page.click('details.more summary'); await page.hover('.tip');
  if ((await page.evaluate(() => getComputedStyle(document.querySelector('.tip'), '::after').content)).length < 30) errors.push('the hover explanation does not show');
  await page.screenshot({ path: path.join(out, 'app-mission-verdict.png'), fullPage: true });
  // ...then the 12 day delay moves the landing day, the mountain top fails and the two rims pass.
  await page.click('#mNext');
  const late = await page.evaluate(() => ({ ...__mission, news: !!document.querySelector('p.news') }));
  console.log('after the delay:', JSON.stringify(late));
  if (!late.delayed || late.date !== '2027-08-12' || late.ok || !late.news || late.passing.join() !== 'plateau') errors.push(`delay story broken: ${late.date} passing ${late.passing}`);
  const replan = await spot('plateau');
  if (!replan.ok || replan.date !== '2027-08-12') errors.push('replanning to the plateau after the delay did not pass');
  await page.click('#mFinish');
  const learned = await page.evaluate(() => document.getElementById('missionBody').innerText.replace(/\s+/g, ' '));
  console.log('summary:', learned.slice(0, 420));
  if (/undefined|NaN|\{\w+\}/.test(learned) || !/Ridge, Second rim/.test(learned) || !/Plateau/.test(learned)) errors.push('the summary does not name the surviving spots');
  await page.screenshot({ path: path.join(out, 'app-mission-learned.png') });
  // Step 5, any day: the picker moves the landing day, the answer is recomputed, and no text is a raw key in any language.
  await page.click('#mAnyDay');
  const day = () => page.evaluate(() => ({ date: __mission.date, passing: __mission.passing.join(), badges: document.querySelectorAll('.badge').length, input: document.getElementById('mDay').value }));
  const d0 = await day();
  if (d0.date !== '2027-07-22' || d0.passing !== 'ridge,rim2' || d0.badges !== 4) errors.push('any-day step does not start on the mission day: ' + JSON.stringify(d0));
  await page.click('[data-day="2027-07-23"]'); // +1 day
  const d1 = await day();
  if (d1.date !== '2027-07-23' || d1.input !== '2027-07-23') errors.push('+1 day did not move the landing day: ' + JSON.stringify(d1));
  await page.fill('#mDay', '2035-03-01'); await page.dispatchEvent('#mDay', 'change');
  const d2 = await day();
  console.log('any day 2035-03-01:', JSON.stringify(d2));
  if (d2.date !== '2035-03-01') errors.push('typing a future date did not work: ' + JSON.stringify(d2));
  for (const l of ['ru', 'ky', 'en']) {
    const bad = await page.evaluate((l) => {
      I18n.set(l); document.querySelector('[data-spot]').click(); for (const d of document.querySelectorAll('details')) d.open = true;
      const keys = new Set(Object.keys(I18n.S.en)), body = document.getElementById('missionBody');
      const words = (body.innerText + ' ' + [...body.querySelectorAll('.tip')].map((t) => t.dataset.tip).join(' ')).split(/[^\w{}]+/);
      return words.filter((w) => (keys.has(w) && /^[a-z]+\d?[A-Z]/.test(w)) || /^(undefined|NaN|Infinity)$/.test(w) || /^\{\w+\}$/.test(w));
    }, l);
    if (bad.length) errors.push(`any-day step, ${l}: raw text ${bad.join()}`);
  }
  await page.screenshot({ path: path.join(out, 'app-mission-anyday.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const w390 = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w390 > 390) errors.push('any-day step scrolls sideways at 390 px: ' + w390);
  await page.locator('table.report').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'app-mission-anyday-390.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  // Served over http the verdict shows the 3D view from the spot (app/surface) in place of the 2D sky: same spot, same day.
  {
    const http = require('http'), fs = require('fs'), root = path.join(__dirname, '..', 'app');
    const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', bin: 'application/octet-stream' };
    const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': types[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
    const p3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p3.on('pageerror', (e) => errors.push('3D page: ' + e.message));
    await p3.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
    await p3.waitForFunction(() => window.__app && window.__app.sites.length > 0);
    await p3.click('#mGo');
    await p3.evaluate(() => document.querySelector(`[data-spot="${__app.sites.find((x) => x.key === 'ridge').id}"]`).click());
    const fr = p3.frameLocator('iframe.stand');
    const view = await p3.waitForFunction(() => { const w = document.querySelector('iframe.stand')?.contentWindow; return w && w.__app && w.__app.ready && w.__app.S.site && { dir: w.__app.S.site.dir, t: new Date(w.__app.S.t * 1000).toISOString().slice(0, 10), min: w.document.documentElement.classList.contains('min') }; }, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch((e) => ({ error: e.message.slice(0, 120) }));
    console.log('3D view:', JSON.stringify(view));
    if (view.dir !== 'cr-best' || view.t !== '2027-07-22' || !view.min) errors.push('the 3D view is not at the chosen spot and day: ' + JSON.stringify(view));
    if (await p3.evaluate(() => getComputedStyle(document.querySelector('.sky')).display !== 'none')) errors.push('2D sky still shown next to the 3D view');
    await p3.waitForTimeout(2500);
    await p3.screenshot({ path: path.join(out, 'app-mission-3d.png') });
    await fr.locator('#play').click(); await p3.waitForTimeout(3000);
    await p3.screenshot({ path: path.join(out, 'app-mission-3d-playing.png') });
    await p3.setViewportSize({ width: 390, height: 844 }); await p3.waitForTimeout(800);
    await p3.screenshot({ path: path.join(out, 'app-mission-3d-390.png') });
    await p3.close(); srv.close();
  }
  await page.click('#mOpenPlanner');
  if (await hidden('.results')) errors.push('the full planner did not open from the mission');

  await page.goto(APP + '#mode=planner');
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.sites.length > 0, null, { timeout: 30000 });
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
