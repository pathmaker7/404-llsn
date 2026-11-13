// Cross-checks our sunlight and Earth visibility against NASA's published LOLA illumination maps
// (PGDA product 69, Mazarico et al. 2011): AVGVISIB_75S_120M_201608(.IMG / _EARTH.IMG), 120 m polar stereographic.
// Published definition: share of timesteps with ANY part of the disc visible, surface level, 18.6 years.
// So ours here uses the same rule: mast 0 m, any part of the disc, 18.6 years at 6 h steps.
// Pixels are read with HTTP range requests (a 5x5 window of 120 m pixels per point), not the 116 MB files.
// The gate compares against the single NASA pixel at our point.
// Exits 1 unless the median |difference| is under LIMIT_PP percentage points for both Sun and Earth.
// Run: npm run crosscheck   (ILLUM_ROTATE_DEG=180 rotates our sampling to prove the check can fail)
const Sky = require('../app/sky.js');
const A = require('../app/analysis.js');
const Terrain = require('../app/terrain.js');
const Globe = require('../app/globe.js');
const { GLOBAL, PATCHES } = require('../app/data/global.js');
const PRESETS = require('../app/data/sites.js');

const BASE = 'https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608';
const N = 7624, SCALE = 120, R = 1737400, C = N / 2 - 0.5, DN_SCALE = 0.00004;
const LIMIT_PP = 5;
const ROT = +process.env.ILLUM_ROTATE_DEG || 0;
const globe = Globe(GLOBAL, PATCHES), T = Terrain(require('../app/data/dem.js'), globe.heightAtVec);
const D = Math.PI / 180;

async function range(url, a, b) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}`, 'User-Agent': 'Mozilla/5.0' } });
      if (r.status !== 206) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { if (attempt >= 4) throw e; await new Promise((res) => setTimeout(res, 1000 * attempt)); }
  }
}
// NASA value at our point (single 120 m pixel), the mean of the 4x4 block under our 480 m pixel, and the
// best pixel within 240 m. Ridge points change by tens of percent within one or two 120 m pixels, so all three print.
async function published(url, lat, lon) {
  const v = [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
  const k = (2 * R) / (1 - v[2]) / SCALE, ci = Math.round(C + v[1] * k), cj = Math.round(C - v[0] * k);
  const g = [];
  for (let a = -2; a <= 2; a++) {
    const buf = await range(url, ((cj + a) * N + ci - 2) * 2, ((cj + a) * N + ci + 2) * 2 + 1);
    g.push(Array.from({ length: 5 }, (_, i) => 100 * buf.readInt16LE(i * 2) * DN_SCALE));
  }
  let block = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) block += g[a][b];
  return { point: g[2][2], block: block / 16, best: Math.max(...g.flat()) };
}

(async () => {
  const pts = PRESETS.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon }));
  for (let lat = -85; lat >= -89.5; lat -= 0.5) for (let lon = -180; lon < 180; lon += 30) pts.push({ name: `grid ${lat},${lon}`, lat, lon });

  const times = A.makeTimes(new Date('2010-01-01T00:00:00Z'), 18.6 * 365.25, 6), bodies = times.map(Sky.bodiesMoonFixed);
  const rows = [];
  for (let k = 0; k < pts.length; k += 8)
    rows.push(...await Promise.all(pts.slice(k, k + 8).map(async (p) => {
      const hz = T.horizon(p.lat, p.lon + ROT, 0), f = Sky.siteFrame(p.lat, p.lon + ROT, T.heightAt(p.lat, p.lon + ROT));
      let sun = 0, earth = 0;
      for (const b of bodies) {
        const s = Sky.azEl(b.sun, f), e = Sky.azEl(b.earth, f);
        if (s.el - T.horizonAt(hz, s.az) > -Math.asin(695700 / s.dist) / D) sun++;
        if (e.el - T.horizonAt(hz, e.az) > -Math.asin(6378.1 / e.dist) / D) earth++;
      }
      const ps = await published(BASE + '.IMG', p.lat, p.lon), pe = await published(BASE + '_EARTH.IMG', p.lat, p.lon);
      return { ...p, sun: (100 * sun) / bodies.length, earth: (100 * earth) / bodies.length, pubSun: ps.point, pubEarth: pe.point, ps, pe };
    })));

  const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
  const stats = (key, pubKey) => {
    const d = rows.map((r) => r[key] - r[pubKey]);
    return { median: med(d.map(Math.abs)), bias: d.reduce((a, b) => a + b, 0) / d.length, within5: (100 * d.filter((x) => Math.abs(x) <= 5).length) / d.length };
  };
  console.log('| Site | Sun, ours | Sun, NASA point / 480 m block / best within 240 m | Earth, ours | Earth, NASA point / block / best within 240 m |');
  console.log('|---|---|---|---|---|');
  for (const r of rows.slice(0, PRESETS.length))
    console.log(`| ${r.name} | ${r.sun.toFixed(1)}% | ${r.ps.point.toFixed(1)} / ${r.ps.block.toFixed(1)} / ${r.ps.best.toFixed(1)}% | ${r.earth.toFixed(1)}% | ${r.pe.point.toFixed(1)} / ${r.pe.block.toFixed(1)} / ${r.pe.best.toFixed(1)}% |`);
  const s = stats('sun', 'pubSun'), e = stats('earth', 'pubEarth');
  console.log(`\n${rows.length} points (11 presets + ${rows.length - 11} grid points, 85 to 89.5 S)`);
  console.log(`Sun:   median |diff| ${s.median.toFixed(1)} pp, mean bias ${s.bias.toFixed(1)} pp, within 5 pp: ${s.within5.toFixed(0)}%`);
  console.log(`Earth: median |diff| ${e.median.toFixed(1)} pp, mean bias ${e.bias.toFixed(1)} pp, within 5 pp: ${e.within5.toFixed(0)}%`);
  const ok = s.median < LIMIT_PP && e.median < LIMIT_PP;
  console.log(`${ok ? 'PASS' : 'FAIL'} (limit: median |diff| under ${LIMIT_PP} pp for both)`);
  process.exit(ok ? 0 : 1);
})();
