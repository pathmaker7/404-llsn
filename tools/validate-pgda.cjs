// Compares the app's share of time with the Sun and with Earth in view against NASA's own polar illumination study:
// PGDA "Lunar Polar Illumination" (Mazarico et al. 2011, LOLA LDEM_85S_060M), average visibility maps at 60 m.
//   AVGVISIB_85S_060M_201608.IMG        share of time steps with any part of the Sun's disc visible
//   AVGVISIB_85S_060M_201608_EARTH.IMG  the same for Earth
// from http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/ (about 51 MB each, not kept in the repo).
// Run: node tools/validate-pgda.cjs <sun.img> <earth.img>      Writes app/data/pgda.json, which the app shows.
// The two are not the same calculation: NASA's is at the surface on 60 m terrain over its own time span, ours is 2 m
// above 80 m terrain over 2021 to 2031. Agreement within a few points is the expected result; exact equality is not.
const fs = require('fs'), path = require('path');
const Sky = require('../app/sky.js');
const APP = path.join(__dirname, '..', 'app');
const N = 5058, SCALE = 60, OFF = 2528.5, DN = 0.00004, R = 1737400, D = Math.PI / 180;

const [sunFile, earthFile] = process.argv.slice(2);
if (!sunFile || !earthFile) { console.error('usage: node tools/validate-pgda.cjs <sun.img> <earth.img>'); process.exit(2); }
const img = (f) => { const b = fs.readFileSync(f); if (b.length !== N * N * 2) throw new Error(f + ': unexpected size ' + b.length); return new Int16Array(b.buffer, b.byteOffset, N * N); };
const sunMap = img(sunFile), earthMap = img(earthFile);

/** NASA's value at a point (percent), with the lowest and highest of the 3 x 3 pixels around it: on a ridge the
 *  answer changes within 60 m, so one pixel alone would overstate how well two models can agree. */
function nasa(map, lat, lon) {
  const la = lat * D, lo = lon * D, k = (2 * R) / (1 - Math.sin(la));
  const x = k * Math.cos(la) * Math.sin(lo), y = k * Math.cos(la) * Math.cos(lo); // polar stereographic, lon 0 up, 90 E right
  const c = Math.floor(x / SCALE + OFF), r = Math.floor(OFF - y / SCALE);
  let lo3 = 1e9, hi3 = -1e9;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const v = map[(r + dr) * N + c + dc] * DN * 100; lo3 = Math.min(lo3, v); hi3 = Math.max(hi3, v); }
  return { v: map[r * N + c] * DN * 100, lo: lo3, hi: hi3 };
}

(async () => {
  const { maskLookup, sunFraction } = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync(path.join(APP, 'src', 'science.js'), 'utf8')));
  const index = JSON.parse(fs.readFileSync(path.join(APP, 'data', 'index.json'), 'utf8'));
  // The app's period, every 3 hours: Sun and Earth in the Moon-fixed frame, computed once for all points.
  const t0 = Date.parse('2021-01-01T00:00:00Z'), t1 = Date.parse('2031-12-31T23:00:00Z'), bodies = [];
  for (let t = t0; t <= t1; t += 3 * 3600e3) bodies.push(Sky.bodiesMoonFixed(new Date(t)));
  const rows = [];
  for (const s of index.sites) for (const [kind, v] of Object.entries(s.variants)) {
    const meta = JSON.parse(fs.readFileSync(path.join(APP, 'data', 'sites', v.dir, 'meta.json'), 'utf8'));
    const f = Sky.siteFrame(meta.lat, meta.lon, meta.ground_height_m + meta.observer_height_m), mask = meta.mask.el_deg, step = meta.mask.az_step_deg;
    let sun = 0, earth = 0;
    for (const b of bodies) {
      const su = Sky.azEl(b.sun, f), ea = Sky.azEl(b.earth, f), er = Math.asin(6371 / ea.dist) / D;
      sun += sunFraction(su.az, su.el, Math.asin(695700 / su.dist) / D, mask, step) > 0; // any part of the disc, as NASA counts it
      earth += ea.el + er > maskLookup(mask, step, ea.az); // any part of Earth's disc, as NASA counts it
    }
    const ns = nasa(sunMap, meta.lat, meta.lon), ne = nasa(earthMap, meta.lat, meta.lon), r1 = (x) => +x.toFixed(1);
    rows.push({ dir: v.dir, name: s.name + (kind === 'best' ? ' (best spot)' : ''), sun: r1(100 * sun / bodies.length), nasaSun: r1(ns.v), nasaSunLo: r1(ns.lo), nasaSunHi: r1(ns.hi),
      earth: r1(100 * earth / bodies.length), nasaEarth: r1(ne.v), nasaEarthLo: r1(ne.lo), nasaEarthHi: r1(ne.hi) });
  }
  // Distance from NASA's value, counting zero when ours falls inside the range of the neighbouring pixels.
  const gap = (v, lo, hi) => (v < lo ? lo - v : v > hi ? v - hi : 0), mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const corr = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return sab / Math.sqrt(sa * sb); };
  const stat = (k, n) => ({ meanAbs: +mean(rows.map((r) => Math.abs(r[k] - r[n]))).toFixed(1), bias: +mean(rows.map((r) => r[k] - r[n])).toFixed(1),
    worst: +Math.max(...rows.map((r) => Math.abs(r[k] - r[n]))).toFixed(1), meanGap: +mean(rows.map((r) => gap(r[k], r[n + 'Lo'], r[n + 'Hi']))).toFixed(1), r: +corr(rows.map((r) => r[k]), rows.map((r) => r[n])).toFixed(3) });
  const out = { source: 'NASA PGDA Lunar Polar Illumination, AVGVISIB_85S_060M_201608 (Sun) and _EARTH, Mazarico et al. 2011', period: '2021 to 2031, every 3 hours', sun: stat('sun', 'nasaSun'), earth: stat('earth', 'nasaEarth'), rows };
  console.table(rows.map((r) => ({ point: r.name, 'Sun ours': r.sun, 'Sun NASA': r.nasaSun, 'NASA 3x3': r.nasaSunLo + '..' + r.nasaSunHi, 'Earth ours': r.earth, 'Earth NASA': r.nasaEarth, 'NASA 3x3 ': r.nasaEarthLo + '..' + r.nasaEarthHi })));
  console.log('Sun  ', out.sun); console.log('Earth', out.earth);
  fs.writeFileSync(path.join(APP, 'data', 'pgda.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
