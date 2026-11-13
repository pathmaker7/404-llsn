// Offline self-check of the core logic. Run: node tools/test.cjs
const assert = require('assert');
const A = require('../app/analysis.js');
const Terrain = require('../app/terrain.js');
const T = Terrain(require('../app/data/dem.js'));
const SITES = require('../app/data/sites.js');

// Every browser script must at least parse (app.js only runs in the browser, so nothing else here loads it).
for (const f of ['app.js', 'sky.js', 'terrain.js', 'globe.js', 'analysis.js', 'i18n.js'].filter((f) => require('fs').existsSync(`${__dirname}/../app/${f}`)))
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

console.log('all checks pass');
