// Prints explainer/deck.html to explainer/deck.pdf, one slide per page, for the Naryn online presentation.
// Run after any change to the deck: npm run deck
const path = require('path');
const { chromium } = require('playwright-core');
const { serve } = require('./smoke.cjs');
const ROOT = path.join(__dirname, '..');

(async () => {
  const srv = await serve(path.join(ROOT, 'explainer'));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/deck.html`);
  await page.waitForLoadState('networkidle');
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).length);
  if (broken) { console.error(`${broken} images did not load`); process.exit(1); }
  // A slide taller than its page is cut off without a word in the PDF, so check it in the print layout first.
  await page.emulateMedia({ media: 'print' });
  const cut = await page.evaluate(() => [...document.querySelectorAll('section')].filter((s) => s.scrollHeight > s.clientHeight + 1 ||
    [...s.querySelectorAll(':scope > :not(.foot):not(.notes)')].some((e) => e.getBoundingClientRect().bottom > s.querySelector('.foot').getBoundingClientRect().top)).map((s) => s.id));
  if (cut.length) { console.error('these slides do not fit their page: ' + cut.join(', ')); process.exit(1); }
  const pages = await page.evaluate(() => document.querySelectorAll('section').length);
  if (pages !== 7) { console.error(`the deck has ${pages} slides; the Space Apps limit is seven`); process.exit(1); }
  const out = path.join(ROOT, 'explainer', 'deck.pdf');
  await page.pdf({ path: out, width: '1440px', height: '900px', printBackground: true, preferCSSPageSize: true });
  await browser.close(); srv.close();
  console.log('wrote', out);
})();
