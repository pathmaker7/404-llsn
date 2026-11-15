// The tab icon of both sites, from one drawing: app/favicon.svg.
//   node tools/icon.cjs      writes favicon.png (64 px) and apple-touch-icon.png (180 px, on the app's dark background)
//                            into app/ and explainer/, and copies favicon.svg to explainer/
// With a third argument it also writes a check sheet (the icon at 16, 32 and 64 px on a dark and a light tab strip).
const fs = require('fs'), path = require('path');
const { launch } = require('./smoke.cjs');
const ROOT = path.join(__dirname, '..');

(async () => {
  const svg = fs.readFileSync(path.join(ROOT, 'app', 'favicon.svg'), 'utf8'), uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const browser = await launch(), page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const shot = async (size, pad, bg) => {
    await page.setContent(`<body style="margin:0;background:transparent"><div id="i" style="width:${size}px;height:${size}px;background:${bg};display:grid;place-items:center"><img src="${uri}" width="${size - 2 * pad}" height="${size - 2 * pad}"></div>`);
    return page.locator('#i').screenshot({ omitBackground: true });
  };
  const small = await shot(64, 0, 'transparent'), touch = await shot(180, 22, '#0a0c10');
  for (const site of ['app', 'explainer']) {
    if (site !== 'app') fs.writeFileSync(path.join(ROOT, site, 'favicon.svg'), svg);
    fs.writeFileSync(path.join(ROOT, site, 'favicon.png'), small);
    fs.writeFileSync(path.join(ROOT, site, 'apple-touch-icon.png'), touch);
  }
  if (process.argv[2]) {
    const row = (bg) => `<div style="background:${bg};padding:14px;display:flex;gap:22px;align-items:center">${[16, 32, 64].map((s) => `<img src="${uri}" width="${s}" height="${s}">`).join('')}</div>`;
    await page.setContent(`<body style="margin:0">${row('#202124')}${row('#dee1e6')}${row('#ffffff')}`);
    await page.screenshot({ path: process.argv[2], fullPage: true });
  }
  await browser.close();
  console.log('wrote favicon.png and apple-touch-icon.png in app/ and explainer/');
})();
