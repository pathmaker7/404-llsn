// A site the user adds: any latitude and longitude on the Moon, or a known landing site. Sun and Earth positions are
// exact (sky.js). Terrain is honest about its limits:
//   'coarse': within about 235 km of the south pole the horizon and the ground come from NASA LOLA LDEM_80S_80M
//             averaged to 320 m (data/polar320.bin, loaded when first needed; the fifteen prepared sites use the full
//             80 m data). Measured against those sites: the horizon differs by under 1 degree on slopes and crater
//             floors and by 1 to 2 degrees on narrow peaks, where 320 m cannot hold the summit;
//   'smooth': anywhere else there is no terrain in the app, so the horizon is the Moon's own curve and the ground is flat.
import { latlonToMap } from './science.js';

const R = 1737400, D = Math.PI / 180, OBS = 2;

// Coordinates as published: Apollo by NASA NSSDC (DE421 frame); Chandrayaan-3 as listed for Statio Shiv Shakti;
// IM-1, Chang'e 6 and IM-2 as located by the LROC team (IM-2: where Athena lies, LROC image 1408).
// landed: the real touchdown (UTC) when it falls in the app's period; the verdict panel then shows what really happened
// next to what the model says for that moment (verdict.js#historyBox, texts i18n h<Key>). Landing times: ISRO, Intuitive
// Machines, CNSA as reported; IM-2 to the nearest half hour.
export const FAMOUS = [
  { name: 'Apollo 11 (1969)', lat: 0.67416, lon: 23.47314 },
  { name: 'Apollo 17 (1972)', lat: 20.191, lon: 30.772 },
  { name: 'Chandrayaan-3 (2023)', lat: -69.373, lon: 32.319, landed: '2023-08-23T12:33:00Z', key: 'Ch3' },
  { name: 'IM-1 Odysseus (2024)', lat: -80.13, lon: 1.44, landed: '2024-02-22T23:24:00Z', key: 'Im1' },
  { name: "Chang'e 6 (2024)", lat: -41.6385, lon: -153.9852, landed: '2024-06-01T22:23:00Z', key: 'Ce6' },
  { name: 'IM-2 Athena (2025)', lat: -84.7906, lon: 29.1957, landed: '2025-03-06T17:30:00Z', key: 'Im2' },
];
/** The real mission that landed at these coordinates, if the app knows one with a landing time. */
export const historyOf = (lat, lon) => FAMOUS.find((f) => f.landed && Math.abs(f.lat - lat) < 1e-4 && Math.abs(f.lon - lon) < 1e-4) || null;

const REACH = 235000; // metres from the pole on the map: inside the polar terrain, clear of its edge
/** Which terrain an added point gets. */
export function kindOf(lat, lon) { const p = latlonToMap(lat, lon); return lat < 0 && Math.hypot(p.X, p.Y) < REACH ? 'coarse' : 'smooth'; }

/** ov: a height grid of the pole ({ n, pixel_m, h }), unused for a smooth site. Returns { kind, meta, near, far, slope }. */
export function makeSite(lat, lon, ov) {
  const n0 = ov.n, pix = ov.pixel_m, c0 = (n0 - 1) / 2, kind = kindOf(lat, lon);
  // Height (m) at a unit vector from the Moon's centre; 0 where the app has no terrain.
  const hAt = (v) => {
    if (kind === 'smooth' || v[2] > -0.9) return 0;
    const k = (2 * R) / (1 - v[2]), c = (k * v[1]) / pix + c0, r = c0 - (k * v[0]) / pix; // same projection as latlonToMap
    if (c < 0 || r < 0 || c > n0 - 1.001 || r > n0 - 1.001) return 0;
    const ci = Math.floor(c), ri = Math.floor(r), fc = c - ci, fr = r - ri, h = ov.h, i = ri * n0 + ci;
    return (h[i] * (1 - fc) + h[i + 1] * fc) * (1 - fr) + (h[i + n0] * (1 - fc) + h[i + n0 + 1] * fc) * fr;
  };
  const cl = Math.cos(lat * D), sl = Math.sin(lat * D), co = Math.cos(lon * D), so = Math.sin(lon * D);
  const up = [cl * co, cl * so, sl], east = [-so, co, 0], north = [-sl * co, -sl * so, cl];
  const h0 = hAt(up), r0 = R + h0 + OBS;

  // Horizon: for each direction walk the ground along the great circle and keep the highest elevation angle.
  const STEP = 0.5, el = new Array(360 / STEP);
  const dip = -Math.acos(R / (R + OBS)) / D; // a bare sphere seen from 2 m
  for (let a = 0; a < el.length; a++) {
    if (kind === 'smooth') { el[a] = +dip.toFixed(4); continue; }
    const az = a * STEP * D, t = [0, 1, 2].map((i) => east[i] * Math.sin(az) + north[i] * Math.cos(az));
    let best = -90;
    for (let d = 150; d < 300000; d = d * 1.03 + 60) {
      const th = d / R, c = Math.cos(th), s = Math.sin(th), v = [up[0] * c + t[0] * s, up[1] * c + t[1] * s, up[2] * c + t[2] * s];
      const r1 = R + hAt(v), e = Math.atan2(r1 * c - r0, r1 * s) / D;
      if (e > best) best = e;
    }
    el[a] = +Math.max(best, dip).toFixed(4);
  }

  // Ground grids in the layout the surface view reads: row 0 is the south edge, column 0 the west edge, the value is
  // metres above the observer's horizontal plane divided by the quantum.
  const grid = (half, n, q) => {
    const out = new Int16Array(n * n), step = (2 * half) / (n - 1);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const e = -half + c * step, nn = -half + r * step, d2 = e * e + nn * nn;
      let z = Math.sqrt(R * R - d2), h = 0;
      for (let it = 0; it < 2; it++) { // the vertical line through (e, n) meets the ground at radius R + h
        const p = [0, 1, 2].map((i) => up[i] * z + east[i] * e + north[i] * nn), len = Math.hypot(p[0], p[1], p[2]);
        h = hAt([p[0] / len, p[1] / len, p[2] / len]);
        z = Math.sqrt(Math.max((R + h) * (R + h) - d2, 0));
      }
      out[r * n + c] = Math.max(-32767, Math.min(32767, Math.round((z - r0) / q)));
    }
    return out;
  };
  const NEAR = { file: 'near', half_m: 12000, n: 201, quantum_m: 0.25 }, FAR = { file: 'far', half_m: 153600, n: 257, quantum_m: 1, dem_block: 16 };
  const near = grid(NEAR.half_m, NEAR.n, NEAR.quantum_m), far = grid(FAR.half_m, FAR.n, FAR.quantum_m);

  // Slope over two grid cells (640 m; coarse terrain cannot show less); a smooth Moon has none.
  let slope = 0;
  if (kind === 'coarse') {
    const g = (de, dn) => { const p = [0, 1, 2].map((i) => up[i] * R + east[i] * de + north[i] * dn), len = Math.hypot(p[0], p[1], p[2]); return hAt([p[0] / len, p[1] / len, p[2] / len]); };
    slope = +(Math.atan(Math.hypot(g(pix, 0) - g(-pix, 0), g(0, pix) - g(0, -pix)) / (2 * pix)) / D).toFixed(1);
  }
  const meta = { lat, lon, ground_height_m: Math.round(h0), observer_height_m: OBS, slope_deg: slope, offset_m: 0,
    mask: { el_deg: el, az_step_deg: STEP, rendered_minus_mask_deg: { mean: 0, min: 0, max: 0 } },
    terrain: { near: NEAR, far: FAR, nodata: -32768 }, validation: { status: 'not run for added sites' } };
  return { kind, meta, near, far, slope };
}
