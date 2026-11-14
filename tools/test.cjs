// Offline self-check of the logic behind the answer panel. Run: node tools/test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'app');
const Mi = require('../app/mission.js');
const I18n = require('../app/i18n.js');
const Sky = require('../app/sky.js');

(async () => {
  // 1. The survival rules pass exactly at each limit and fail just past it.
  const base = { m: { longestDarkH: 48, longestBlackoutH: 72, commWindows: [] }, waitH: 23, slope: 9.9, evaSlope: 19.9, lat: -84 };
  const fails = (x) => Mi.judge(x).filter((c) => c.ok === false).map((c) => c.id).join();
  assert.strictEqual(fails(base), '', 'passes at every limit');
  assert.strictEqual(fails({ ...base, m: { ...base.m, longestDarkH: 49 } }), 'night');
  assert.strictEqual(fails({ ...base, m: { ...base.m, longestBlackoutH: 73 } }), 'radio');
  assert.strictEqual(fails({ ...base, waitH: 24 }), 'light');
  assert.strictEqual(fails({ ...base, slope: 10 }), 'slope');
  assert.strictEqual(fails({ ...base, evaSlope: 20 }), 'eva');
  assert.strictEqual(fails({ ...base, lat: -83.9 }), 'pole');
  assert.strictEqual(Mi.judge(base).length, 11, 'eleven checks');

  // 2. The panel's own counting (verdict.js) on a synthetic site: lit except hours 24 to 95, Earth always up.
  globalThis.I18n = I18n; globalThis.Mission = Mi;
  // verdict.js is a browser ES module; this package is CommonJS, so load its text as a module.
  const { judgeAt } = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync(path.join(APP, 'src', 'verdict.js'), 'utf8')));
  const n = 24 * 30, ch = { sunFrac: new Float32Array(n).fill(1), earthVis: new Float32Array(n).fill(1), sunEl: new Float32Array(n).fill(1.5) };
  for (let k = 24; k < 96; k++) ch.sunFrac[k] = 0;
  const site = { ch, n, t0: 0, meta: { lat: -89 } }, row = (e, id) => e.rows.find((r) => r.id === id);
  const a = judgeAt(site, 0, 14 * 24, 2, 5);
  assert.strictEqual(a.ok, false, 'a 72 h night fails'); assert.strictEqual(row(a, 'night').v, 72);
  assert.strictEqual(judgeAt(site, 100, 14 * 24, 2, 5).ok, true, 'landing after the night passes');
  assert.strictEqual(row(judgeAt(site, 30, 14 * 24, 2, 5), 'light').v, 66, 'landing in the dark: the Sun rises 66 h later');
  assert.strictEqual(judgeAt(site, 100, 14 * 24, 12, 5).ok, false, 'a steep spot fails even with Sun and Earth');
  assert.strictEqual(judgeAt(site, 100, 14 * 24, 2, 30).ok, true, 'a "should" row does not decide survival');
  assert.strictEqual(row(a, 'windows').v, 1); assert.strictEqual(Math.round(row(a, 'earthPct').v), 100);

  // 3. Texts: three languages, same keys, same placeholders, nothing that breaks an HTML attribute.
  const keys = Object.keys(I18n.S.en), ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const l of ['ru', 'ky']) {
    assert.deepStrictEqual(Object.keys(I18n.S[l]).sort(), [...keys].sort(), `${l}: same keys as English`);
    for (const k of keys) assert.strictEqual(ph(I18n.S[l][k]), ph(I18n.S.en[k]), `${l}.${k}: same placeholders`);
  }
  for (const l of ['en', 'ru', 'ky']) for (const k of keys) if (/Tip$|Note$/.test(k)) assert.ok(!/["<]/.test(I18n.S[l][k]), `${l}.${k}: no quote or tag inside a tooltip`);
  const used = [...fs.readFileSync(path.join(APP, 'src', 'verdict.js'), 'utf8').matchAll(/L\('([A-Za-z0-9]{2,})'/g)].map((m) => m[1]);
  for (const k of used) assert.ok(k in I18n.S.en, `text missing: ${k}`);
  for (const r of Mi.judge(base)) { const c = r.id[0].toUpperCase() + r.id.slice(1); assert.ok(I18n.S.en['r' + c] && I18n.S.en['r' + c + 'Tip'], `no text for check ${r.id}`); if (r.pri !== 'info') assert.ok(I18n.S.en['l' + c], `no limit text for ${r.id}`); }

  // 4. Data: every listed point has its terrain files and its extra slope value.
  const index = JSON.parse(fs.readFileSync(path.join(APP, 'data', 'index.json'), 'utf8')), extra = JSON.parse(fs.readFileSync(path.join(APP, 'data', 'extra.json'), 'utf8'));
  let points = 0;
  for (const s of index.sites) for (const v of Object.values(s.variants)) {
    const dir = path.join(APP, 'data', 'sites', v.dir), meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    for (const f of [meta.terrain.near.file, meta.terrain.far.file]) assert.ok(fs.existsSync(path.join(dir, f)), `${v.dir}: ${f} missing`);
    assert.ok(meta.mask.el_deg.length > 100 && typeof extra[v.dir] === 'number', `${v.dir}: horizon mask or slope value missing`);
    points++;
  }
  assert.strictEqual(index.sites.length, 15); assert.strictEqual(points, 20);

  // 5. The app computes Sun and Earth positions for 2021 to 2031 with sky.js. They must match the pipeline's independent
  //    JPL DE440 series (2027 to 2028) at the same points, or the extended dates could not be trusted.
  for (const dir of ['cr-best', 'lbp', 'nr1', 'sr']) {
    const b = path.join(APP, 'data', 'sites', dir), meta = JSON.parse(fs.readFileSync(path.join(b, 'meta.json'), 'utf8')), buf = fs.readFileSync(path.join(b, meta.ephem.file));
    const all = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4), m = meta.ephem.n, c = (name) => all.subarray(meta.ephem.channels.indexOf(name) * m, (meta.ephem.channels.indexOf(name) + 1) * m);
    const f = Sky.siteFrame(meta.lat, meta.lon, meta.ground_height_m + meta.observer_height_m), sunEl = c('sunEl'), earthEl = c('earthEl'), sunAz = c('sunAz');
    let worst = 0;
    for (let i = 0; i < m; i += 41) {
      const bd = Sky.bodiesMoonFixed(new Date((meta.ephem.t0_unix + i * 3600) * 1000)), su = Sky.azEl(bd.sun, f), ea = Sky.azEl(bd.earth, f), da = Math.abs(su.az - sunAz[i]);
      worst = Math.max(worst, Math.abs(su.el - sunEl[i]), Math.abs(ea.el - earthEl[i]), Math.min(da, 360 - da) * Math.cos(su.el * Math.PI / 180));
    }
    assert.ok(worst < 0.01, `${dir}: our positions differ from the DE440 series by ${worst} degrees`);
  }
  // 6. Real landings (the app's "What really happened here" box and the table under "How do we know?"). On a smooth Moon,
  //    as the app treats these sites: Chandrayaan-3 landed two days after sunrise and the Sun set on 4 September 2023, the
  //    day ISRO put the lander to sleep; at IM-1 the Sun set on 3 March 2024; at Chang'e 6, on the far side, Earth never rises.
  const { modelAt } = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync(path.join(APP, 'src', 'verdict.js'), 'utf8')));
  const custom = fs.readFileSync(path.join(APP, 'src', 'custom.js'), 'utf8'), famous = (key) => { const m = custom.match(new RegExp(`lat: (-?[\\d.]+), lon: (-?[\\d.]+), landed: '([^']+)', key: '${key}'`)); assert.ok(m, 'no mission ' + key); return { lat: +m[1], lon: +m[2], t: Date.parse(m[3]) / 1000 }; };
  const smooth = (f) => { // the hourly series the app builds for a point with no terrain: 30 days each side of the landing
    const t0s = Math.floor(f.t / 3600) * 3600 - 30 * 86400, nn = 60 * 24, fr = Sky.siteFrame(f.lat, f.lon, 2), dip = -Math.acos(1737400 / 1737402) * 180 / Math.PI;
    const c = { sunFrac: new Float32Array(nn), earthVis: new Float32Array(nn), sunEl: new Float32Array(nn) };
    for (let i = 0; i < nn; i++) { const b = Sky.bodiesMoonFixed(new Date((t0s + i * 3600) * 1000)), su = Sky.azEl(b.sun, fr), ea = Sky.azEl(b.earth, fr);
      c.sunEl[i] = su.el; c.sunFrac[i] = su.el + Math.asin(695700 / su.dist) * 180 / Math.PI > dip ? 1 : 0; c.earthVis[i] = ea.el > dip ? 1 : 0; }
    return modelAt({ ch: c, n: nn, t0: t0s }, f.t);
  };
  const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const ch3 = smooth(famous('Ch3')), im1 = smooth(famous('Im1')), ce6 = smooth(famous('Ce6'));
  assert.ok(ch3.lit && ch3.earth, 'Chandrayaan-3 landed in sunlight with Earth in view');
  assert.strictEqual(day(ch3.rise), '2023-08-21', 'sunrise two days before Chandrayaan-3 landed'); assert.strictEqual(day(ch3.set), '2023-09-04', 'sunset on the day the lander was put to sleep');
  assert.strictEqual(day(im1.set), '2024-03-03', 'IM-1: sunset on a smooth Moon');
  assert.ok(ce6.lit && !ce6.earth && !ce6.earthEver, "Chang'e 6: Earth never rises on the far side");

  // 7. NASA's own illumination maps (tools/validate-pgda.cjs wrote app/data/pgda.json): the numbers the app states.
  const pg = JSON.parse(fs.readFileSync(path.join(APP, 'data', 'pgda.json'), 'utf8'));
  assert.strictEqual(pg.rows.length, points, 'every point compared with NASA');
  assert.ok(pg.earth.meanAbs < 5 && pg.earth.r > 0.95, 'Earth share agrees with NASA within 5 points on average');
  assert.ok(pg.sun.r > 0.9, 'Sun share ranks the points as NASA does');
  console.log('all checks pass');
})().catch((e) => { console.error(e); process.exit(1); });
