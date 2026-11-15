// Dishes on Earth. "Earth in view" is half a radio link; the other half is a big dish on Earth that has the Moon in its sky.
// For every hour of the stay in which Earth is in view from the site, this asks whether the Moon is at least MIN_ALT degrees
// above the horizon at one or more of NASA's three Deep Space Network complexes. It is information only: it never touches
// the survived or lost verdict (it reads the answer panel's rows and changes nothing).
// Plugs into the answer panel through globalThis.VerdictExtras (src/verdict.js): fn(box, ctx, e) runs after every render.
const L = (k, v) => globalThis.I18n.t(k, v), DEG = 180 / Math.PI;

/** The Moon must be at least this many degrees above the horizon. The team's own planning value, not a NASA rule. */
export const MIN_ALT = 10;

// The three complexes, decimal degrees (east longitude positive), read on 15 Nov 2026 from NASA's DSN Now configuration,
// https://eyes.nasa.gov/dsn/config.xml : <site name="gdscc" friendlyName="Goldstone" longitude="-116.8895382" latitude="35.2443523">,
// <site name="mdscc" friendlyName="Madrid" longitude="-4.2480085" latitude="40.2413554"> and
// <site name="cdscc" friendlyName="Canberra" longitude="148.9812673" latitude="-35.2209189">. The file gives no height, so 0 m is
// used (a few hundred metres move the Moon's altitude by far less than 0.01 degrees). "About 120 degrees apart in longitude":
// https://www.nasa.gov/directorates/somd/space-communications-navigation-program/what-is-the-deep-space-network/
export const COMPLEXES = [
  { id: 'goldstone', key: 'xDGoldstone', lat: 35.2443523, lon: -116.8895382 },
  { id: 'madrid', key: 'xDMadrid', lat: 40.2413554, lon: -4.2480085 },
  { id: 'canberra', key: 'xDCanberra', lat: -35.2209189, lon: 148.9812673 },
];

let OBS = null; // Astronomy observers, built on first use
// Moon altitude (degrees, no refraction) at each complex for one unix hour. The Moon seen from Earth does not depend on the
// lunar site, so one table of hours serves every site and every landing day: stepping a day forward asks for 24 new hours only.
const altCache = new Map();
function moonAlts(hour) {
  let a = altCache.get(hour);
  if (a) return a;
  const A = globalThis.Astronomy;
  OBS ||= COMPLEXES.map((c) => new A.Observer(c.lat, c.lon, 0));
  const time = A.MakeTime(new Date(hour * 3600000)), g = A.GeoVector(A.Body.Moon, time, true); // geocentric, J2000 equator, aberration
  a = new Float32Array(OBS.map((o) => {
    const ov = A.ObserverVector(time, o, false), v = new A.Vector(g.x - ov.x, g.y - ov.y, g.z - ov.z, time); // from the dish to the Moon
    const q = A.RotateVector(A.Rotation_EQJ_HOR(time, o), v); // x north, y west, z up; includes precession and nutation
    return Math.asin(q.z / Math.hypot(q.x, q.y, q.z)) * DEG;
  }));
  altCache.set(hour, a);
  return a;
}

const SYNC_MAX = 120, CHUNK_MS = 8; // up to 120 missing hours (about 10 ms) are done in the render; more is done after it, in 8 ms slices
const memo = new WeakMap(); // site -> Map("landing|hours" -> result)
let job = 0, cost = { ms: 0, slice: 0 };

/** What the stay looks like from the dishes. Needs every hour's altitude to be cached already (see fill). */
function summarize(site, t, W) {
  const i0 = Math.round((t - site.t0) / 3600), i1 = Math.min(site.n, i0 + W), h0 = site.t0 / 3600 + i0, mask = new Array(Math.max(i1 - i0, 0));
  let radio = 0, seen = 0;
  for (let i = i0; i < i1; i++) {
    const earth = site.ch.earthVis[i] > 0.5;
    let m = 0;
    if (earth) { radio++; const a = moonAlts(h0 + i - i0); for (let k = 0; k < 3; k++) if (a[k] >= MIN_ALT) m |= 1 << k; if (m) seen++; m |= 8; }
    mask[i - i0] = m;
  }
  const landing = []; // the complexes with the Moon up at the landing moment (the first hour of the stay)
  const a0 = moonAlts(h0); for (let k = 0; k < 3; k++) if (a0[k] >= MIN_ALT) landing.push(COMPLEXES[k].id);
  return { site: site.dir, t, W, i0, i1, hour0: h0, radioHours: radio, upHours: seen, share: radio ? seen / radio : null, landing, landingAlts: Array.from(a0), mask };
}

/** The hours (unix hours) the summary will ask for and the cache does not hold yet. */
function missing(site, t, W) {
  const i0 = Math.round((t - site.t0) / 3600), i1 = Math.min(site.n, i0 + W), h0 = site.t0 / 3600 + i0, need = [];
  if (!altCache.has(h0)) need.push(h0);
  for (let i = i0 + 1; i < i1; i++) if (site.ch.earthVis[i] > 0.5 && !altCache.has(h0 + i - i0)) need.push(h0 + i - i0);
  return need;
}

const pct = (s) => (s === 1 ? '100%' : s >= 0.995 ? L('xDMost') : s > 0 && s < 0.005 ? L('xDFew') : Math.round(s * 100) + '%');

/** The label with the tooltip (the app's pattern: class tip, tabindex 0, data-tip). The tooltip opens on the side of the label that has more room in its scrolling panel. */
function makeTip() {
  const tip = document.createElement('span');
  tip.className = 'tip'; tip.setAttribute('tabindex', '0'); tip.setAttribute('data-tip', L('xDTip')); tip.textContent = L('xDLabel');
  // Open on the side with more room; on a phone the panel is short, so a focus (a tap) also scrolls it until the whole tooltip fits.
  const side = (ev) => { const r = tip.getBoundingClientRect(), hud = tip.closest('#hud'), h = (hud || document.documentElement).getBoundingClientRect(), top = Math.max(h.top, 0), bottom = Math.min(h.bottom, innerHeight);
    const above = r.top - top, below = bottom - r.bottom, up = above > below, room = up ? above : below, need = 250;
    tip.dataset.pos = up ? 'up' : 'down';
    if (ev.type === 'focus' && hud && room < need) hud.scrollTop += up ? -(need - room) : need - room; };
  tip.addEventListener('mouseenter', side); tip.addEventListener('focus', side);
  return tip;
}

function draw(p, r) {
  const where = r.landing.length ? r.landing.map((id) => L(COMPLEXES.find((c) => c.id === id).key)).join(', ') : L('xDNoneNow');
  p.textContent = '';
  p.append(makeTip(), ': ' + (r.radioHours ? L('xDSee', { p: pct(r.share) }) + ' ' + L('xDAt', { where }) : L('xDNoEarth')));
  p.removeAttribute('aria-busy');
  globalThis.__dsn = { ...r, done: true, line: p.textContent, tip: L('xDTip'), minAlt: MIN_ALT, complexes: COMPLEXES, cost: { ...cost }, alts: (hour) => Array.from(moonAlts(hour)), fn: dishLine };
}

/** The plug-in: one line under the checks. Cached per site and landing day; missing hours are computed after the render when there are many. */
function dishLine(box, ctx) {
  if (!globalThis.Astronomy) return;
  const { site, t, W } = ctx, key = t + '|' + W, p = document.createElement('p');
  p.className = 'v-dsn'; box.append(p);
  let byDay = memo.get(site); if (!byDay) memo.set(site, byDay = new Map());
  const hit = byDay.get(key);
  if (hit) { cost = { ms: 0, slice: 0 }; return draw(p, hit); }
  const need = missing(site, t, W), mine = ++job;
  const finish = () => { const r = summarize(site, t, W); byDay.set(key, r); if (p.isConnected) draw(p, r); };
  cost = { ms: 0, slice: 0 };
  if (need.length <= SYNC_MAX) { const s = performance.now(); for (const h of need) moonAlts(h); cost = { ms: performance.now() - s, slice: performance.now() - s }; return finish(); }
  // Many hours: show the label and fill the line in after the render, in short slices so the page stays smooth. A newer render stops this one.
  p.setAttribute('aria-busy', 'true');
  p.textContent = ''; p.append(makeTip(), ': ' + L('xDWait'));
  globalThis.__dsn = { pending: true, done: false, site: site.dir, t, W };
  let at = 0; const c = { ms: 0, slice: 0 };
  const step = () => {
    if (mine !== job || !p.isConnected) return; // the panel was drawn again: the newer call does the rest
    const s = performance.now();
    while (at < need.length && performance.now() - s < CHUNK_MS) moonAlts(need[at++]);
    const d = performance.now() - s; c.ms += d; c.slice = Math.max(c.slice, d);
    if (at < need.length) return void setTimeout(step, 0);
    cost = c; finish();
  };
  setTimeout(step, 0);
}

(globalThis.VerdictExtras ||= []).push(dishLine);
