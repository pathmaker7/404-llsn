// Loads the static files produced by pipeline/build.py.
import { sunFraction, maskLookup } from './science.js';
const cache = new Map();

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
async function getBin(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.arrayBuffer();
}

export const loadIndex = () => getJSON('data/index.json');

export async function loadOverview(index) {
  const buf = await getBin(`data/${index.overview.file}`);
  return { ...index.overview, h: new Int16Array(buf) };
}

/** Load one evaluated point (variant directory) of a site. */
export function loadSite(dir) {
  if (!cache.has(dir)) cache.set(dir, _load(dir));
  return cache.get(dir);
}

// Period offered by the app: about five years back and five years ahead. The pipeline's ephem.bin covers 2027 to 2028
// only, so the hourly Sun and Earth positions are computed here with the team's sky.js (astronomy-engine, IAU lunar
// rotation model). tools/test.cjs checks that they match the pipeline's DE440 series to better than 0.01 degrees.
export const PERIOD = { start: '2021-01-01T00:00:00Z', end: '2031-12-31T23:00:00Z', step_h: 1 };
const P0 = Date.parse(PERIOD.start) / 1000, PN = Math.round((Date.parse(PERIOD.end) / 1000 - P0) / 3600) + 1;
let bodies = null; // Sun xyz, Earth xyz in the Moon-fixed frame, km, one row per hour
function getBodies() {
  if (bodies) return bodies;
  const Sky = globalThis.Sky; bodies = new Float64Array(PN * 6);
  for (let i = 0; i < PN; i++) { const b = Sky.bodiesMoonFixed(new Date((P0 + i * 3600) * 1000)); bodies.set(b.sun, i * 6); bodies.set(b.earth, i * 6 + 3); }
  return bodies;
}
const DEG = 180 / Math.PI;
function computeChannels(meta) {
  const Sky = globalThis.Sky, b = getBodies(), f = Sky.siteFrame(meta.lat, meta.lon, meta.ground_height_m + meta.observer_height_m);
  const mask = meta.mask.el_deg, step = meta.mask.az_step_deg, ch = {};
  for (const k of ['sunAz', 'sunEl', 'sunR', 'earthAz', 'earthEl', 'earthR', 'sunFrac', 'earthVis']) ch[k] = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    const s = Sky.azEl([b[i * 6], b[i * 6 + 1], b[i * 6 + 2]], f), e = Sky.azEl([b[i * 6 + 3], b[i * 6 + 4], b[i * 6 + 5]], f);
    ch.sunAz[i] = s.az; ch.sunEl[i] = s.el; ch.sunR[i] = Math.asin(695700 / s.dist) * DEG;
    ch.earthAz[i] = e.az; ch.earthEl[i] = e.el; ch.earthR[i] = Math.asin(6371 / e.dist) * DEG;
    ch.sunFrac[i] = sunFraction(s.az, s.el, ch.sunR[i], mask, step);
    ch.earthVis[i] = e.el > maskLookup(mask, step, e.az) ? 1 : 0;
  }
  return ch;
}

/** Sun and Earth over the whole period at one point, without its terrain meshes (the map's timeline needs only this). */
const sky = new Map();
export function loadSky(dir) {
  if (!sky.has(dir)) sky.set(dir, getJSON(`data/sites/${dir}/meta.json`).then(async (meta) => {
    await new Promise((r) => setTimeout(r, 30)); // let the page paint before the one-off ephemeris pass
    return { dir, meta, ch: computeChannels(meta), n: PN, t0: P0 };
  }));
  return sky.get(dir);
}

async function _load(dir) {
  const base = `data/sites/${dir}/`, s = await loadSky(dir);
  const [near, far] = await Promise.all([getBin(base + s.meta.terrain.near.file), getBin(base + s.meta.terrain.far.file)]);
  return { ...s, near: new Int16Array(near), far: new Int16Array(far) };
}
