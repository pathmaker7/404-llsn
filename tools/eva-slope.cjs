// Writes app/data/extra.json: for every evaluated point, the steepest ground within 2 km (degrees), the value behind
// the check "Steepest ground within 2 km". Read from the point's near terrain (near.bin: 60 m grid cut from NASA LOLA
// LDEM_80S_80M by pipeline-3d), slope by central differences over 120 m. Run after the pipeline: node tools/eva-slope.cjs
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'app', 'data'), RADIUS_M = 2000;

function evaSlope(dir) {
  const base = path.join(DATA, 'sites', dir), t = JSON.parse(fs.readFileSync(path.join(base, 'meta.json'), 'utf8')).terrain;
  const { n, half_m: half, quantum_m: q, file } = t.near, buf = fs.readFileSync(path.join(base, file));
  const h = new Int16Array(buf.buffer, buf.byteOffset, n * n), step = (2 * half) / (n - 1), c0 = (n - 1) / 2, reach = Math.ceil(RADIUS_M / step);
  let max = 0;
  for (let r = c0 - reach; r <= c0 + reach; r++) for (let c = c0 - reach; c <= c0 + reach; c++) {
    if (Math.hypot(r - c0, c - c0) * step > RADIUS_M) continue;
    const v = [h[r * n + c + 1], h[r * n + c - 1], h[(r + 1) * n + c], h[(r - 1) * n + c]];
    if (v.includes(t.nodata)) continue;
    max = Math.max(max, Math.atan(Math.hypot(v[0] - v[1], v[2] - v[3]) * q / (2 * step)) * 180 / Math.PI);
  }
  return Math.round(max * 10) / 10;
}

if (require.main === module) {
  const out = {};
  for (const s of JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8')).sites) for (const v of Object.values(s.variants)) out[v.dir] = evaSlope(v.dir);
  fs.writeFileSync(path.join(DATA, 'extra.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(out);
}
module.exports = { evaSlope };
