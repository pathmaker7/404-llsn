// Builds app/data/global.js: the whole-Moon terrain the app uses outside the south polar map.
//  1. GLOBAL: NASA LRO LOLA LDEM_4 (4 px/deg, 7.58 km/px), the far field and the whole-Moon map.
//  2. PATCHES: a 474 m box (LDEM_64, 64 px/deg) around every curated site north of PATCH_MAX_LAT,
//     cut out of the 530 MB file with HTTP range requests, one request per row.
//  3. CATALOG: curated landing sites with the source of each coordinate.
// Grid convention (from the PDS labels): 0-based line L, sample S at P px/deg:
//   lat = 90 - (L + 0.5) / P, lon (0..360 E) = (S + 0.5) / P. Heights: DN * 0.5 m above 1737.4 km.
// Run: node tools/build-global.cjs <path/to/ldem_4.img>
const fs = require('fs');
const path = require('path');

const LDEM64_URL = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_64.img';
const P64 = 64, W64 = 23040, H64 = 11520;
const PATCH_KM = 75; // near-field radius around each site
const PATCH_MAX_LAT = -83; // south of this the 480 m polar map already covers the site
const R_KM = 1737.4;

// Sources: Wikipedia "List of landings on extraterrestrial bodies" (wikitext fetched 2026-11-13), which cites
// LROC and NSSDCA; IM-2 from the Wikipedia "IM-2" article (LROC image 1408) because the list page has it wrong.
const LIST = 'Wikipedia, List of landings on extraterrestrial bodies';
const dms = (d, m, s) => d + m / 60 + s / 3600;
const CATALOG = [
  ['Apollo 11', 'Apollo', dms(0, 40, 26.69), dms(23, 28, 22.69), LIST],
  ['Apollo 12', 'Apollo', -3.012389, -23.421569, LIST],
  ['Apollo 14', 'Apollo', -dms(3, 38, 43.08), -dms(17, 28, 16.90), LIST],
  ['Apollo 15', 'Apollo', dms(26, 7, 55.99), dms(3, 38, 1.90), LIST],
  ['Apollo 16', 'Apollo', -dms(8, 58, 22.84), dms(15, 30, 0.68), LIST],
  ['Apollo 17', 'Apollo', dms(20, 11, 26.88), dms(30, 46, 18.05), LIST],
  ['IM-1 Odysseus', 'Commercial (CLPS)', -80.13, 1.44, LIST + ' (LROC post 1360)'],
  ['IM-2 Athena', 'Commercial (CLPS)', -84.7906, 29.1957, 'Wikipedia, IM-2 (LROC image 1408)'],
  ['Blue Ghost M1', 'Commercial (CLPS)', 18.56, 61.81, LIST + ' (NSSDCA)'],
  ['SLIM', 'Other countries', -13.316, 25.251, LIST + ' (JAXA press kit)'],
  ['Chandrayaan-3', 'Other countries', -69.373, 32.319, LIST],
  ["Chang'e 3", 'Other countries', 44.12, -19.51, LIST],
  ["Chang'e 4 (far side)", 'Other countries', -45.5, 177.6, LIST],
  ["Chang'e 5", 'Other countries', 43.0576, -51.9161, LIST + ' (NSSDCA)'],
  ["Chang'e 6 (far side)", 'Other countries', -41.6385, -153.9852, LIST + ' (LROC image 1374)'],
  ['Luna 9', 'Other countries', 7.13, -64.37, LIST],
  ['Luna 17 / Lunokhod 1', 'Other countries', dms(38, 17, 0), -35.0, LIST],
  ['Luna 24', 'Other countries', dms(12, 45, 0), dms(62, 12, 0), LIST],
].map(([name, group, lat, lon, source]) => ({ name, group, lat: +lat.toFixed(6), lon: +lon.toFixed(6), source }));

async function fetchRow(line, s0, s1) {
  const a = (line * W64 + s0) * 2, b = (line * W64 + s1) * 2 + 1;
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(LDEM64_URL, { headers: { Range: `bytes=${a}-${b}` } });
      if (r.status !== 206) throw new Error(`HTTP ${r.status} for line ${line}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length !== b - a + 1) throw new Error(`short read line ${line}`);
      return buf;
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
}

async function patchFor(site) {
  const dLat = (PATCH_KM / R_KM) * (180 / Math.PI), dLon = dLat / Math.cos((site.lat * Math.PI) / 180);
  const lon360 = (site.lon + 360) % 360;
  const L0 = Math.floor((90 - site.lat - dLat) * P64), L1 = Math.ceil((90 - site.lat + dLat) * P64);
  const S0 = Math.floor((lon360 - dLon) * P64), S1 = Math.ceil((lon360 + dLon) * P64);
  if (L0 < 0 || L1 >= H64) throw new Error(`${site.name}: patch crosses a pole, not handled`);
  const w = S1 - S0 + 1, h = L1 - L0 + 1, out = new Int16Array(w * h);
  // A box crossing 0 degrees longitude (S0 < 0) is two byte ranges per row: the end of the row, then its start.
  const segs = S0 < 0 ? [[W64 + S0, W64 - 1], [0, S1]] : S1 >= W64 ? [[S0, W64 - 1], [0, S1 - W64]] : [[S0, S1]];
  const lines = Array.from({ length: h }, (_, k) => L0 + k);
  for (let k = 0; k < lines.length; k += 8) // 8 requests in flight
    await Promise.all(lines.slice(k, k + 8).map(async (L) => {
      const row = Buffer.concat(await Promise.all(segs.map(([a, b]) => fetchRow(L, a, b))));
      for (let i = 0; i < w; i++) out[(L - L0) * w + i] = Math.round(row.readInt16LE(i * 2) * 0.5);
    }));
  return { name: site.name, ppd: P64, line0: L0, sample0: S0, w, h, data: Buffer.from(out.buffer).toString('base64') };
}

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node tools/build-global.cjs <ldem_4.img>');
  const buf = fs.readFileSync(file);
  const W4 = 1440, H4 = 720;
  if (buf.length !== W4 * H4 * 2) throw new Error(`expected ${W4 * H4 * 2} bytes, got ${buf.length}`);
  const g = new Int16Array(W4 * H4);
  for (let p = 0; p < g.length; p++) g[p] = Math.round(buf.readInt16LE(p * 2) * 0.5);

  const patches = [];
  for (const s of CATALOG.filter((x) => x.lat > PATCH_MAX_LAT)) {
    const t0 = Date.now(), p = await patchFor(s);
    patches.push(p);
    console.log(`${s.name.padEnd(24)} patch ${p.w}x${p.h} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }

  const js = `// Generated by tools/build-global.cjs (do not edit).
// GLOBAL: NASA LRO LOLA LDEM_4 (7.58 km/px). PATCHES: LOLA LDEM_64 (474 m/px) boxes, ${PATCH_KM} km around curated sites.
// Grid: lat = 90 - (line + 0.5) / ppd, lon (0..360 E) = (sample + 0.5) / ppd; whole metres above 1737.4 km.
var GLOBAL = { ppd: 4, w: ${W4}, h: ${H4}, source: "NASA LRO LOLA LDEM_4", data: "${Buffer.from(g.buffer).toString('base64')}" };
var PATCHES = ${JSON.stringify(patches)};
var CATALOG_SITES = ${JSON.stringify(CATALOG, null, 1)};
if (typeof module !== 'undefined') module.exports = { GLOBAL, PATCHES, CATALOG_SITES };
`;
  const dest = path.join(__dirname, '..', 'app', 'data', 'global.js');
  fs.writeFileSync(dest, js);
  console.log(`wrote ${dest}: ${(js.length / 1e6).toFixed(2)} MB, ${patches.length} patches`);
})();
