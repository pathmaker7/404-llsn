// Offline self-check of the core logic. Run: node tools/test.cjs
const assert = require('assert');
const A = require('../app/analysis.js');
const Terrain = require('../app/terrain.js');
const T = Terrain(require('../app/data/dem.js'));
const SITES = require('../app/data/sites.js');

// Every browser script must at least parse (app.js only runs in the browser, so nothing else here loads it).
for (const f of ['app.js', 'sky.js', 'terrain.js', 'globe.js', 'analysis.js', 'i18n.js', 'mission.js'].filter((f) => require('fs').existsSync(`${__dirname}/../app/${f}`)))
  new (require('vm').Script)(require('fs').readFileSync(`${__dirname}/../app/${f}`, 'utf8'), { filename: f });

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// Solar disk fraction above a horizon line.
near(A.diskFraction(0, 0.27), 0.5, 1e-9, 'centre on horizon');
near(A.diskFraction(0.27, 0.27), 1, 1e-9, 'fully up');
near(A.diskFraction(-0.27, 0.27), 0, 1e-9, 'fully down');

// Runs of true samples.
assert.deepStrictEqual(A.runs([0, 1, 1, 0, 1]), [[1, 2], [4, 4]]);
assert.deepStrictEqual(A.runs([1, 1, 0, 1], 1, 3), [[1, 1], [3, 3]]);

// Time to the next sunset/Earthset (or rise): first index where the flag changes.
assert.strictEqual(A.nextChange([1, 1, 1, 0, 0, 1], 0), 3, 'sunset index');
assert.strictEqual(A.nextChange([1, 1, 1, 0, 0, 1], 3), 5, 'next rise index');
assert.strictEqual(A.nextChange([1, 1, 1], 1), -1, 'no change in span');
assert.strictEqual(A.nextChange([1, 0, 0], 0), 1, 'sets on the very next sample');

// Projection orientation: every crater centre must be lower than its mirror image (a flipped map fails this).
for (const [lat, lon] of [[-89.67, 129.78], [-87.3, 77.0], [-84.9, -35.5], [-88.1, 44.9]])
  assert.ok(T.heightAt(lat, lon) < T.heightAt(lat, -lon), `crater at ${lat},${lon} not lower than its mirror`);

// Slope: Shackleton's floor is flat, its inner wall about 30 degrees, 5 to 8 km from the centre.
{
  const v = T.latLonToVec(-89.67, 129.78), [ci, cj] = T.vecToGrid(v[0], v[1], v[2]);
  assert.ok(T.slopeAtGrid(ci, cj) < 5, `Shackleton floor slope ${T.slopeAtGrid(ci, cj)}`);
  for (const d of [12, 14, 16]) assert.ok(T.slopeAtGrid(ci + d, cj) > 20, `Shackleton wall slope at ${d} px: ${T.slopeAtGrid(ci + d, cj)}`);
}

// Artemis III checks: boundaries of each NASA requirement.
{
  const pass = { lat: -89, slope: 5, evaSlope: 15, earthPct: 40, sunUpAtLanding: true };
  assert.ok(A.artemisChecks(pass).every((c) => c.ok), 'all pass');
  const fail = (k, v) => A.artemisChecks({ ...pass, [k]: v }).filter((c) => !c.ok).map((c) => c.id).join();
  assert.strictEqual(fail('lat', -83.9), 'pole');
  assert.strictEqual(fail('slope', 10), 'slope');
  assert.strictEqual(fail('evaSlope', 20), 'eva');
  assert.strictEqual(fail('earthPct', 0), 'dwe');
  assert.strictEqual(fail('sunUpAtLanding', false), 'light');
  // Shackleton rim: gentle enough to land, but the crater wall within 2 km is far over the EVA limit.
  const rim = SITES.find((s) => s.name === 'Shackleton rim');
  assert.ok(T.maxSlopeWithin(rim.lat, rim.lon, 2000) > 20, `Shackleton rim EVA slope ${T.maxSlopeWithin(rim.lat, rim.lon, 2000)}`);
}

// Shadow map: a ray toward the Sun from a pixel must agree with the horizon-profile method (two independent paths).
{
  const Sky = require('../app/sky.js');
  const bodies = A.makeTimes(new Date('2026-11-14T00:00:00Z'), 365, 365 * 24 / 30).map(Sky.bodiesMoonFixed);
  let agree = 0, total = 0;
  for (const s of SITES) {
    const hz = T.horizon(s.lat, s.lon, 0), tr = A.track({ lat: s.lat, lon: s.lon, heightM: T.heightAt(s.lat, s.lon), horizon: hz }, bodies, T.horizonAt, 0);
    const v = T.latLonToVec(s.lat, s.lon), [i, j] = T.vecToGrid(v[0], v[1], v[2]);
    bodies.forEach((b, k) => {
      const n = Math.hypot(b.sun[0], b.sun[1], b.sun[2]);
      total++; if (T.sunVisibleAtGrid(i, j, b.sun.map((x) => x / n), 1, 300000) === (tr.sunFrac[k] >= 0.5)) agree++;
    });
  }
  assert.ok(agree / total > 0.97, `shadow ray vs horizon agreement ${agree}/${total}`);
}

// Horizon from the Shackleton floor matches crater geometry: atan(~4.5 km depth / ~10.5 km radius) = ~23 deg.
const floor = SITES.find((s) => s.name.startsWith('Shackleton floor'));
const hz = T.horizon(floor.lat, floor.lon, 2);
const mean = hz.reduce((a, b) => a + b, 0) / 360;
near(mean, 22, 3, 'Shackleton floor mean horizon');

// Interface strings: every key the page uses exists in English; Russian and Kyrgyz have exactly the English keys
// with the same {placeholders}.
{
  const fs = require('fs'), I = require('../app/i18n.js');
  const html = fs.readFileSync(`${__dirname}/../app/index.html`, 'utf8'), js = fs.readFileSync(`${__dirname}/../app/app.js`, 'utf8');
  const used = new Set([...html.matchAll(/data-i18n(?:-html|-title|-placeholder|-aria)?="(\w+)"/g)].map((m) => m[1]));
  for (const m of js.matchAll(/\bL\('(\w+)'[),]/g)) used.add(m[1]); // literal keys; L('no' + w) builds noSunset etc.
  for (const k of used) assert.ok(k in I.S.en, `key used but missing in en: ${k}`);
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  for (const l of ['ru', 'ky']) {
    for (const k of Object.keys(I.S.en)) {
      assert.ok(k in I.S[l], `${l} missing ${k}`);
      assert.strictEqual(ph(I.S[l][k]), ph(I.S.en[k]), `${l}.${k} placeholders`);
    }
    for (const k of Object.keys(I.S[l])) assert.ok(k in I.S.en, `${l} has extra key ${k}`);
  }
}

// Whole-Moon terrain (app/globe.js on app/data/global.js).
{
  const { GLOBAL, PATCHES, CATALOG_SITES } = require('../app/data/global.js');
  const G = require('../app/globe.js')(GLOBAL, PATCHES);
  const corr = (a, b) => {
    const m = (v) => v.reduce((s, x) => s + x, 0) / v.length, ma = m(a), mb = m(b);
    let sab = 0, saa = 0, sbb = 0;
    for (let k = 0; k < a.length; k++) { sab += (a[k] - ma) * (b[k] - mb); saa += (a[k] - ma) ** 2; sbb += (b[k] - mb) ** 2; }
    return sab / Math.sqrt(saa * sbb);
  };
  // Global map orientation: coarse global heights follow the polar map; a mirrored longitude does not.
  const pts = [];
  for (let lat = -80.5; lat > -89; lat -= 0.5) for (let lon = -180; lon < 180; lon += 10) pts.push([lat, lon]);
  const polar = pts.map(([a, o]) => T.heightAt(a, o));
  const cGlobal = corr(polar, pts.map(([a, o]) => G.heightAt(a, o)));
  const cMirror = corr(polar, pts.map(([a, o]) => G.heightAt(a, -o)));
  assert.ok(cGlobal > 0.9 && cMirror < cGlobal - 0.3, `global vs polar correlation ${cGlobal}, mirrored ${cMirror}`);

  // Patch registration: the IM-1 patch (474 m) overlaps the polar map (480 m) between 80 and 82.6 S.
  // Two LOLA grids of the same ground agree within tens of metres; shifted by 0.1 degree they do not.
  const im1 = CATALOG_SITES.find((s) => s.name.startsWith('IM-1'));
  const over = [];
  for (let lat = -80.3; lat > -82.4; lat -= 0.1) for (let d = -8; d <= 8; d += 1) over.push([lat, im1.lon + d]);
  const med = (v) => v.sort((a, b) => a - b)[v.length >> 1];
  const dOk = med(over.map(([a, o]) => Math.abs(G.heightAt(a, o) - T.heightAt(a, o))));
  const dShift = med(over.map(([a, o]) => Math.abs(G.heightAt(a + 0.1, o) - T.heightAt(a, o))));
  assert.ok(G.resolutionAt(-81, im1.lon) === '474 m', 'IM-1 patch covers 81 S');
  assert.ok(dOk < 40 && dShift > 2 * dOk, `patch vs polar median |dh| ${dOk} m, shifted ${dShift} m`);

  // Apollo 11, flat mare: no horizon above 3 degrees.
  const a11 = CATALOG_SITES.find((s) => s.name === 'Apollo 11');
  const hz11 = G.horizon(a11.lat, a11.lon, 2);
  assert.ok(Math.max(...hz11) < 3, `Apollo 11 max horizon ${Math.max(...hz11)}`);
}

// Mission mode rules: each limit passes at its value and fails just past it.
{
  const Mi = require('../app/mission.js');
  const base = { m: { longestDarkH: 48, longestBlackoutH: 72, commWindows: [] }, waitH: 23, slope: 9.9, evaSlope: 19.9, lat: -84 };
  const fails = (x) => Mi.judge(x).filter((c) => c.ok === false).map((c) => c.id).join();
  assert.strictEqual(fails(base), '', 'passes at every limit');
  assert.strictEqual(fails({ ...base, m: { ...base.m, longestDarkH: 49 } }), 'night', 'a 49 h night drains the battery');
  assert.strictEqual(fails({ ...base, m: { ...base.m, longestBlackoutH: 73 } }), 'radio', '73 h without Earth loses the mission');
  assert.strictEqual(fails({ ...base, waitH: 24 }), 'light', 'no Sun in the first day');
  assert.strictEqual(fails({ ...base, slope: 10 }), 'slope');
  assert.strictEqual(fails({ ...base, evaSlope: 20 }), 'eva');
  assert.strictEqual(fails({ ...base, lat: -83.9 }), 'pole');
  // Synthetic track: dark for 3 days from sample 24. Landing at 0 for 5 days fails on power; landing after it passes.
  const n = 24 * 20, t = { lit: new Uint8Array(n).fill(1), comm: new Uint8Array(n).fill(1), sunFrac: new Float32Array(n).fill(1), sunEl: new Float32Array(n).fill(1) };
  for (let k = 24; k < 96; k++) { t.lit[k] = 0; t.sunFrac[k] = 0; }
  t.cumSun = new Float64Array(n + 1); t.cumComm = new Float64Array(n + 1); t.cumBoth = new Float64Array(n + 1);
  for (let k = 0; k < n; k++) { t.cumSun[k + 1] = t.cumSun[k] + t.sunFrac[k]; t.cumComm[k + 1] = t.cumComm[k] + t.comm[k]; t.cumBoth[k + 1] = t.cumBoth[k] + (t.lit[k] & t.comm[k]); }
  const site = { track: t, slope: 2, evaSlope: 5, lat: -89 }, eA = Mi.evaluate(site, 0, 120, 1);
  assert.strictEqual(eA.ok, false, 'a 72 h night fails');
  assert.strictEqual(eA.checks[0].v, 72);
  assert.strictEqual(Mi.evaluate(site, 100, 120, 1).ok, true, 'landing after the night passes');
  const eDark = Mi.evaluate(site, 30, 120, 1);
  assert.strictEqual(eDark.rows.find((r) => r.id === 'light').v, 66, 'landing in the dark, Sun rises 66 h later');
  assert.strictEqual(Mi.evaluate({ ...site, slope: 12 }, 100, 120, 1).ok, false, 'a steep spot fails even with Sun and Earth');
  assert.strictEqual(Mi.evaluate({ ...site, evaSlope: 30, lat: -70 }, 100, 120, 1).ok, true, '"should" rows do not decide survival');
  // The story is what the data says, and two independent engines say it: ours (LOLA 480 m, astronomy-engine) and the
  // 3D view's precomputed hourly series (LOLA 80 m, JPL DE440; app/surface/data, built by pipeline-3d).
  const Sky = require('../app/sky.js'), fs = require('fs'), Globe = require('../app/globe.js'), G = require('../app/data/global.js');
  const polar = Terrain(require('../app/data/dem.js'), Globe(G.GLOBAL, G.PATCHES).heightAtVec);
  const W = Mi.STAY_DAYS * 24, t0 = new Date(Mi.START + 'T00:00:00Z'), bodies = A.makeTimes(t0, Mi.DELAY_DAYS + Mi.STAY_DAYS + 2, 1).map(Sky.bodiesMoonFixed);
  const run = (f, i0, i1) => { let b = 0, c = 0; for (let i = i0; i < i1; i++) { if (f(i)) { c++; if (c > b) b = c; } else c = 0; } return b; };
  const verdicts = { ours: [[], []], view: [[], []] };
  for (const sp of Mi.SPOTS) {
    const site = { lat: sp.lat, lon: sp.lon, heightM: Math.round(polar.heightAt(sp.lat, sp.lon)), horizon: polar.horizon(sp.lat, sp.lon, 2), slope: polar.slopeAt(sp.lat, sp.lon), evaSlope: polar.maxSlopeWithin(sp.lat, sp.lon, 2000) };
    site.track = A.track(site, bodies, polar.horizonAt, 0.5);
    const dir = `${__dirname}/../app/surface/data/sites/${sp.view[1] === 'best' ? sp.view[0] + '-best' : sp.view[0]}/`, meta = JSON.parse(fs.readFileSync(dir + 'meta.json', 'utf8'));
    const buf = fs.readFileSync(dir + meta.ephem.file), all = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4), n = meta.ephem.n, ch = (name) => all.subarray(meta.ephem.channels.indexOf(name) * n, (meta.ephem.channels.indexOf(name) + 1) * n);
    const lit = ch('sunFrac'), earth = ch('earthVis'), slope = JSON.parse(fs.readFileSync(dir + '../../index.json', 'utf8')).sites.find((x) => x.id === sp.view[0]).variants[sp.view[1]].slope_deg;
    near(meta.lat, sp.lat, 1e-6, `${sp.key} is the 3D view's point`);
    [0, Mi.DELAY_DAYS].forEach((d, q) => {
      if (Mi.evaluate(site, d * 24, W + 1, 1).ok) verdicts.ours[q].push(sp.key);
      const i = (t0 / 1000 - meta.ephem.t0_unix) / 3600 + d * 24, dark = (k) => !(lit[k] >= 0.5);
      let wait = 0; while (wait < W && dark(i + wait)) wait++;
      if (Mi.judge({ m: { longestDarkH: run(dark, i, i + W), longestBlackoutH: run((k) => !(earth[k] > 0.5), i, i + W), commWindows: [] }, waitH: wait, slope, evaSlope: 0, lat: sp.lat }).every((r) => r.pri !== 'must' || r.ok)) verdicts.view[q].push(sp.key);
    });
  }
  assert.deepStrictEqual(verdicts.ours, [['ridge', 'rim2'], ['plateau']], 'the mission story (our engine)');
  assert.deepStrictEqual(verdicts.view, verdicts.ours, 'the 3D view data tells the same story');
  // The Earth yardstick is sane: Naryn midsummer Sun is high, midwinter low.
  const june = Sky.sunDayOnEarth(new Date('2026-06-21T00:00:00Z'), 41.43, 76), dec = Sky.sunDayOnEarth(new Date('2026-12-21T00:00:00Z'), 41.43, 76);
  near(june.maxEl, 90 - 41.43 + 23.44, 0.3, 'Naryn solstice noon Sun');
  near(dec.maxEl, 90 - 41.43 - 23.44, 0.3, 'Naryn winter noon Sun');
  assert.ok(june.upHours > 14.5 && dec.upHours < 9.5, `Naryn day length ${june.upHours} / ${dec.upHours}`);
}

console.log('all checks pass');
