// What if we land 1 km off. No lander touches down exactly on its target, so the answer panel judges 8 spots 1 km around
// it (north, north east ... north west) with the SAME rule and limits as the target (app/mission.js, verdict.js#judgeAt)
// and draws them as a small compass: solid green mark = survives, hollow red mark = lost.
//
// How a neighbour is judged (custom.js and data.js are the model; nothing in them is changed):
//   * its latitude and longitude come from a great circle step of 1000 m on a 1737.4 km sphere, rounded to 5 decimals
//     as addCustom does, so a user who adds that point by coordinates gets exactly the same point;
//   * terrain: NASA LOLA averaged to 320 m (data/polar320.bin), as for any point a user adds near the south pole; the
//     horizon is traced with the same walk as custom.js#makeSite (copied here, because makeSite also builds two ground
//     meshes the panel does not need and that would cost about as much again); its slope is makeSite's own slope over
//     640 m, used for both slope checks, exactly as a point the user adds;
//   * Sun and Earth: the same formulas as data.js#computeChannels, but only for the hours of the stay, not for all ten
//     years, and only once per hour and spot (cached);
//   * the verdict: the panel's own judgeAt, with those hours.
// Never on the render path: the box is drawn at once with "checking…", the work runs in pieces of about 6 ms
// (setTimeout) and a new date drops the old work. tools/test-nearby.cjs compares every neighbour with a point added the
// ordinary way and checks the 1000 m.
import { loadPolar } from './data.js';
import { kindOf } from './custom.js';
import { sunFraction, maskLookup } from './science.js';

const R = 1737400, D = Math.PI / 180, DEG = 180 / Math.PI, OBS = 2, STEP = 0.5, RANGE = 1000, BUDGET = 6, KEEP = 3;
const L = (k, v) => globalThis.I18n.t(k, v);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const DIRS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
const POS = { N: [30, 10], NE: [50, 10], E: [50, 30], SE: [50, 50], S: [30, 50], SW: [10, 50], W: [10, 30], NW: [10, 10], C: [30, 30] };

/** The spot `d` metres from (lat, lon) along a great circle that leaves on azimuth `az` (degrees clockwise from north). */
export function offset(lat, lon, az, d = RANGE) {
  const cl = Math.cos(lat * D), sl = Math.sin(lat * D), co = Math.cos(lon * D), so = Math.sin(lon * D);
  const up = [cl * co, cl * so, sl], east = [-so, co, 0], north = [-sl * co, -sl * so, cl];
  const th = d / R, c = Math.cos(th), s = Math.sin(th), a = az * D, sa = Math.sin(a), ca = Math.cos(a);
  const v = [0, 1, 2].map((i) => up[i] * c + (east[i] * sa + north[i] * ca) * s);
  // atan2 on the horizontal part keeps full precision a metre from the pole, where asin(v[2]) would lose it.
  const la = Math.atan2(v[2], Math.hypot(v[0], v[1])) * DEG, lo = Math.atan2(v[1], v[0]) * DEG;
  return { lat: +la.toFixed(5), lon: +(((lo + 540) % 360) - 180).toFixed(5) }; // the rounding of main.js#addCustom
}

// Height (m) at a unit vector from the Moon's centre on the 320 m polar grid: custom.js#makeSite's hAt for a coarse point.
function heightFn(ov) {
  const n0 = ov.n, pix = ov.pixel_m, c0 = (n0 - 1) / 2, h = ov.h;
  return (v) => {
    if (v[2] > -0.9) return 0;
    const k = (2 * R) / (1 - v[2]), c = (k * v[1]) / pix + c0, r = c0 - (k * v[0]) / pix;
    if (c < 0 || r < 0 || c > n0 - 1.001 || r > n0 - 1.001) return 0;
    const ci = Math.floor(c), ri = Math.floor(r), fc = c - ci, fr = r - ri, i = ri * n0 + ci;
    return (h[i] * (1 - fc) + h[i + 1] * fc) * (1 - fr) + (h[i + n0] * (1 - fc) + h[i + n0 + 1] * fc) * fr;
  };
}

// One state per site point (the last KEEP are kept): the 8 spots, each with its horizon, slope and the hours judged so far.
const stores = new Map();
function stateFor(site) {
  const { lat, lon } = site.meta, key = lat + ',' + lon;
  let st = stores.get(key);
  if (st) { stores.delete(key); stores.set(key, st); return st; }
  st = { key, lat, lon, nb: DIRS.map(([id, az]) => ({ id, az, ...offset(lat, lon, az) })) };
  st.avail = [st, ...st.nb].every((p) => kindOf(p.lat, p.lon) === 'coarse');
  stores.set(key, st);
  if (stores.size > KEEP) stores.delete(stores.keys().next().value);
  return st;
}

// The terrain part of a spot: height, slope (makeSite's, over 2 grid cells) and the frame the hourly Sun and Earth are read in.
function init(nb, grid, n) {
  const { lat, lon } = nb, hAt = heightFn(grid), pix = grid.pixel_m;
  const cl = Math.cos(lat * D), sl = Math.sin(lat * D), co = Math.cos(lon * D), so = Math.sin(lon * D);
  nb.up = [cl * co, cl * so, sl]; nb.east = [-so, co, 0]; nb.north = [-sl * co, -sl * so, cl]; nb.hAt = hAt;
  const { up, east, north } = nb, h0 = hAt(up);
  nb.r0 = R + h0 + OBS;
  const g = (de, dn) => { const p = [0, 1, 2].map((i) => up[i] * R + east[i] * de + north[i] * dn), len = Math.hypot(p[0], p[1], p[2]); return hAt([p[0] / len, p[1] / len, p[2] / len]); };
  nb.slope = +(Math.atan(Math.hypot(g(pix, 0) - g(-pix, 0), g(0, pix) - g(0, -pix)) / (2 * pix)) / D).toFixed(1);
  nb.frame = globalThis.Sky.siteFrame(lat, lon, Math.round(h0) + OBS);
  nb.mask = new Array(360 / STEP); nb.a = 0; // azimuths of the horizon traced so far
  nb.ch = { sunFrac: new Float32Array(n), sunEl: new Float32Array(n), earthVis: new Float32Array(n) }; nb.have = new Uint8Array(n);
}

// The horizon of one spot: custom.js#makeSite's walk along every azimuth. A generator, so the caller can stop between azimuths.
function* trace(nb) {
  const { up, east, north, hAt, r0, mask } = nb, dip = -Math.acos(R / (R + OBS)) / D;
  for (; nb.a < mask.length; nb.a++) {
    const az = nb.a * STEP * D, t = [0, 1, 2].map((i) => east[i] * Math.sin(az) + north[i] * Math.cos(az));
    let best = -90;
    for (let d = 150; d < 300000; d = d * 1.03 + 60) {
      const th = d / R, c = Math.cos(th), s = Math.sin(th), v = [up[0] * c + t[0] * s, up[1] * c + t[1] * s, up[2] * c + t[2] * s];
      const r1 = R + hAt(v), e = Math.atan2(r1 * c - r0, r1 * s) / D;
      if (e > best) best = e;
    }
    mask[nb.a] = +Math.max(best, dip).toFixed(4);
    if (nb.a % 30 === 29) yield;
  }
}

// Sun and Earth in the Moon fixed frame, one hour: shared by the 8 spots and by every site (they do not depend on the place).
const bodies = new Map();
function bodiesAt(t0, i) {
  let b = bodies.get(i);
  if (!b) { if (bodies.size > 6000) bodies.clear(); b = globalThis.Sky.bodiesMoonFixed(new Date((t0 + i * 3600) * 1000)); bodies.set(i, b); }
  return b;
}
// data.js#computeChannels for one hour at one spot. sunR goes through a Float32 like the app's, and so does every value kept.
function hour(nb, b, i) {
  const Sky = globalThis.Sky, s = Sky.azEl(b.sun, nb.frame), e = Sky.azEl(b.earth, nb.frame), sr = Math.fround(Math.asin(695700 / s.dist) * DEG);
  nb.ch.sunEl[i] = s.el; nb.ch.sunFrac[i] = sunFraction(s.az, s.el, sr, nb.mask, STEP); nb.ch.earthVis[i] = e.el > maskLookup(nb.mask, STEP, e.az) ? 1 : 0; nb.have[i] = 1;
}

const traced = (nb) => nb.mask && nb.a === nb.mask.length;
const complete = (st, i0, i1) => st.nb.every((nb) => { if (!traced(nb)) return false; for (let i = i0; i < i1; i++) if (!nb.have[i]) return false; return true; });

/** Judge the 8 spots for a landing at hour index i0 (the panel's own judgeAt, the spot's own slope for both slope checks). */
function judgeAll(ctx, st, i0) {
  return st.nb.map((nb) => { const x = ctx.judgeAt({ ch: nb.ch, n: ctx.site.n, meta: { lat: nb.lat } }, i0, ctx.W, nb.slope, nb.slope); return { id: nb.id, az: nb.az, lat: nb.lat, lon: nb.lon, slope: nb.slope, ok: x.ok, rows: x.rows }; });
}

// The sentence under the compass.
function words(res, ok) {
  const n = res.filter((r) => r.ok).length, first = res.find((r) => r.ok), d = first && L('xNd' + first.id);
  if (n === 0) return { key: ok ? 'xNNone' : 'xNAllLost', n };
  if (ok) return { key: n === 8 ? 'xNAllOk' : n === 1 ? 'xNSome1' : 'xNSome', vars: { n }, n };
  return { key: n === 1 ? 'xNOne' : 'xNMany', vars: { n, d }, n };
}

function compass(res, ok, label) {
  const mark = (id, cls, title) => `<circle class="nb-m ${cls}${id === 'C' ? ' nb-c' : ''}" data-dir="${id}" cx="${POS[id][0]}" cy="${POS[id][1]}" r="5"><title>${title}</title></circle>`;
  const st = (v) => L(v ? 'mOkShort' : 'mLostShort');
  const parts = DIRS.map(([id]) => { const r = res && res.find((x) => x.id === id); return mark(id, r ? (r.ok ? 'ok' : 'bad') : 'wait', r ? L('xNMark', { d: L('xNd' + id), s: st(r.ok) }) : L('xNWait')); });
  parts.push(`<circle class="nb-ring" cx="30" cy="30" r="10"/>` + mark('C', ok === null ? 'wait' : ok ? 'ok' : 'bad', ok === null ? L('xNWait') : L('xNMid', { s: st(ok) })));
  return `<svg class="nb-map" viewBox="0 0 60 60" width="60" height="60" role="img" aria-label="${label}">${parts.join('')}</svg>`;
}

function paint(root, mode, res, ok) {
  const info = { state: mode };
  let text, cls = '';
  if (mode === 'far') { root.className = 'nb nb-far'; root.innerHTML = `<p>${L('xNFar')}</p>`; return info; }
  if (mode === 'failed') { root.className = 'nb nb-far'; root.innerHTML = `<p>${L('xNFail')}</p>`; return info; }
  if (mode === 'done') { const w = words(res, ok); text = cap(L(w.key, w.vars)); info.key = w.key; info.count = w.n; } else { text = L('xNWait'); cls = ' nb-wait'; }
  root.className = 'nb' + cls; root.dataset.state = mode;
  root.innerHTML = `<span class="tip nb-title" tabindex="0" data-tip="${L('xNTip')}">${L('xNTitle')}</span>` +
    `<div class="nb-body">${compass(mode === 'done' ? res : null, mode === 'done' ? ok : null, text)}<p class="nb-say">${text}</p></div>`;
  return info;
}

// ------------------------------------------------------------------ the work, in small pieces
let job = null, started = 0, dropped = 0;
const T = globalThis.__nearby = { state: 'idle', offset, words, DIRS, results: [], jobs: 0, dropped: 0, ms: null, log: [], sync: 0, maxSync: 0 };
const stop = (j) => { j.dead = true; clearTimeout(j.timer); };

function* work(j) {
  const { st, site } = j, grid = yield loadPolar();
  for (const nb of st.nb) { if (!nb.up) init(nb, grid, site.n); if (!traced(nb)) yield* trace(nb); }
  for (let i = j.i0; i < j.i1; i++) {
    if (st.nb.some((nb) => !nb.have[i])) { const b = bodiesAt(site.t0, i); for (const nb of st.nb) if (!nb.have[i]) hour(nb, b, i); }
    if ((i - j.i0) % 12 === 11) yield;
  }
}

// Runs the generator for about BUDGET ms, then hands the thread back; a job that was dropped stops at its next piece.
function run(j) {
  const tick = (val) => {
    if (j.dead) return;
    const t0 = performance.now(), lap = () => { const d = performance.now() - t0; j.busy += d; j.max = Math.max(j.max, d); };
    try {
      for (;;) {
        const r = j.gen.next(val); val = undefined;
        if (r.done) { lap(); return finish(j); }
        if (r.value && typeof r.value.then === 'function') { lap(); r.value.then(tick, (e) => fail(j, e)); return; }
        if (performance.now() - t0 > BUDGET) { lap(); j.timer = setTimeout(tick, 0); return; }
      }
    } catch (e) { fail(j, e); }
  };
  j.timer = setTimeout(tick, 0); // the render that asked for this has ended before the first piece runs
}

function finish(j) {
  if (j.dead) return;
  const { ctx, st } = j, res = judgeAll(ctx, st, j.i0), ok = j.e.ok;
  T.ms = { wall: +(performance.now() - j.t0).toFixed(1), busy: +j.busy.toFixed(1), maxPiece: +j.max.toFixed(1), cold: j.cold }; T.log.push({ ...T.ms, i0: j.i0 });
  Object.assign(T, { results: res, centre: { lat: st.lat, lon: st.lon, ok }, date: j.date, state: 'done' });
  if (job === j) job = null;
  if (j.root.isConnected) Object.assign(T, paint(j.root, 'done', res, ok)); // the box of the latest render, if it is still in the page
}
function fail(j, err) {
  console.error('nearby spots', err);
  if (job === j) job = null;
  T.state = 'failed';
  if (!j.dead && j.root.isConnected) paint(j.root, 'failed');
}

function start(root, ctx, e, st, t0) {
  const { site } = ctx, i0 = Math.round((ctx.t - site.t0) / 3600), i1 = Math.min(site.n, i0 + ctx.W);
  const key = st.key + '|' + i0 + '|' + ctx.W, date = new Date(ctx.t * 1000).toISOString().slice(0, 10);
  if (complete(st, i0, i1)) { // everything this day needs is cached: answer in the same render
    if (job) { stop(job); job = null; }
    const res = judgeAll(ctx, st, i0);
    Object.assign(T, paint(root, 'done', res, e.ok), { state: 'done', results: res, centre: { lat: st.lat, lon: st.lon, ok: e.ok }, date, ms: { wall: 0, busy: 0, maxPiece: 0, cold: false } });
    return;
  }
  paint(root, 'checking'); Object.assign(T, { state: 'checking', results: [], date });
  if (job && job.key === key) { Object.assign(job, { root, ctx, e }); return; } // the same work, a new box (a language or limits change)
  if (job) { stop(job); T.dropped = ++dropped; } // a new day: the old work is of no use
  job = { key, st, site, ctx, e, root, i0, i1, date, t0, busy: 0, max: 0, cold: !st.nb.every(traced), dead: false };
  job.gen = work(job); T.jobs = ++started;
  run(job);
}

// Plug-in of the answer panel (verdict.js, VerdictExtras): box is the empty div inside the panel, replaced by every render.
(globalThis.VerdictExtras ||= []).push((box, ctx, e) => {
  const t0 = performance.now(), st = stateFor(ctx.site), root = document.createElement('div');
  box.appendChild(root);
  if (!st.avail) { paint(root, 'far'); Object.assign(T, { state: 'far', results: [] }); return; }
  try { start(root, ctx, e, st, t0); } finally { T.sync = +(performance.now() - t0).toFixed(1); T.maxSync = Math.max(T.maxSync, T.sync); } // what the render itself waits for
});
