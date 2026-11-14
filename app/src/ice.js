// Ice hunter: tap a spot near the south pole and learn whether the Sun ever reached it in our model.
// The spot is judged with the same code as a dropped lander (custom.js#makeSite on the 320 m polar terrain, then
// data.js#registerSite + loadSky for the hourly Sun series 2021 to 2031), but no row is added to the grid.
// Context line on the card: NASA Science, "LCROSS", https://science.nasa.gov/mission/lcross/ (fetched 2026-11-15). The page says:
//   "The Centaur then crashed onto the surface of the Moon at 11:31 UT in the Cabeus crater at the lunar south pole."
//   "On Nov. 13, 2009, NASA formally announced that data from LCROSS “indicates that the mission successfully uncovered water
//   … near the Moon’s south pole.”"
// kid: the slots main.js hands every kids feature (see main.js, "kids features").
import * as THREE from '../vendor/three.module.js';
import { loadPolar, registerSite, loadSky } from './data.js';
import { makeSite, kindOf } from './custom.js';
import { latlonToMap } from './science.js';
import { EXAG } from './overview.js';

const R = 1737400, D = Math.PI / 180, APART_KM = 5, MAXMARKS = 40;
const LCROSS = 'https://science.nasa.gov/mission/lcross/';
const DIR = 'ice'; // one registered point, replaced by every new tap, so the hourly series of old taps are freed
const T = (k, v) => globalThis.I18n.t(k, v);
const $ = (id) => document.getElementById(id);

const SVG = {
  flake: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.6l3 2.6 3-2.6M9 20.4l3-2.6 3 2.6"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="currentColor"/></svg>',
  sun: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  far: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

/** Great circle distance in km between two Moon points given in degrees. */
const km = (a, b) => Math.acos(Math.min(1, Math.max(-1, Math.sin(a[0] * D) * Math.sin(b[0] * D) + Math.cos(a[0] * D) * Math.cos(b[0] * D) * Math.cos((a[1] - b[1]) * D)))) * R / 1000;

// The judge
let chain = Promise.resolve(), cache = new Map();

/** What our model says about a spot. kind 'far': outside the polar terrain, no verdict. Otherwise { kind: 'coarse', lit, n, share, dark, ... }:
 *  lit is the number of hours (of n, 2021 to 2031) with any part of the Sun's disc above the horizon (sunFrac > 0). */
export function judge(lat, lon) {
  if (kindOf(lat, lon) !== 'coarse') return Promise.resolve({ kind: 'far', lat, lon });
  const key = lat.toFixed(4) + ',' + lon.toFixed(4);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const job = chain.then(async () => {
    const grid = await loadPolar(), made = makeSite(lat, lon, grid);
    registerSite(DIR, made);
    const sky = await loadSky(DIR), f = sky.ch.sunFrac;
    let lit = 0;
    for (let i = 0; i < sky.n; i++) if (f[i] > 0) lit++;
    const res = { kind: 'coarse', lat, lon, lit, n: sky.n, t0: sky.t0, share: lit / sky.n, dark: lit === 0, heightM: made.meta.ground_height_m, slope: made.slope };
    cache.set(key, res);
    return res;
  });
  chain = job.catch(() => {});
  return job;
}

/** The share of lit hours as the card says it: never 0% for a lit spot, never 100% for a spot with a dark hour. */
export function shareWords(res) {
  const p = res.share * 100;
  if (res.lit === 0) return { key: 'kIDark' };
  if (p < 1) return { key: 'kILitLess' };
  if (res.lit < res.n && p >= 99.5) return { key: 'kILitMost' };
  return { key: 'kILit', vars: { p: Math.round(p) + '%' } };
}

// The feature
export function init(kid) {
  const { S, overview } = kid;
  let on = false, busy = false, waiting = null, served = 0, hunt_no = 0; // hunt_no: goes up each time the hunt starts or stops
  const st = { phase: 'hint', res: null, tag: null };
  const marks = [];
  // The dark spots of this hunt only. Every press on Ice hunter (start or stop) clears them and the points on the Moon,
  // so the map is clean for whatever comes next; nothing is kept in the browser.
  let found = [];
  const years = () => [new Date(kid.periodStart() * 1000).getUTCFullYear(), new Date(kid.periodEnd() * 1000).getUTCFullYear()];

  // The button and the card
  const btn = document.createElement('button');
  btn.className = 'kidbtn ice-btn'; btn.id = 'ice-btn'; btn.type = 'button'; btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = `${SVG.flake}<span class="ice-lbl"></span><b class="ice-badge"></b>`;
  btn.onclick = () => setMode(!on);
  $('kidbar').appendChild(btn);
  const card = document.createElement('aside');
  card.id = 'ice-card'; card.hidden = true; card.setAttribute('aria-live', 'polite');
  document.body.appendChild(card);
  const layer = document.createElement('div');
  layer.id = 'ice-marks'; document.body.appendChild(layer);

  // Markers left on the Moon
  function capPos(lat, lon) { // the same point overview.build gives a site on the polar cap
    const { X, Y } = latlonToMap(lat, lon), h = overview.heightAt(X, Y) * EXAG, x = X, z = -Y, r = Math.hypot(x, z), a = r / R, s = r < 1 ? 1 : ((R + h) * Math.sin(a)) / r;
    return new THREE.Vector3(x * s, (R + h) * Math.cos(a) - R, z * s);
  }
  function addMark(lat, lon, cls) {
    const el = document.createElement('div');
    el.className = 'ice-mark ' + cls; el.innerHTML = '<span class="ice-ring"></span><i>' + (cls === 'lit' ? '' : SVG.spark) + '</i>';
    layer.appendChild(el);
    const m = { lat, lon, el, pos: capPos(lat, lon), cls };
    marks.push(m);
    while (marks.length > MAXMARKS) marks.shift().el.remove();
    return m;
  }
  const setMark = (m, cls) => { m.cls = cls; m.el.className = 'ice-mark ' + cls; m.el.lastChild.innerHTML = cls === 'lit' ? '' : SVG.spark; };
  const centre = new THREE.Vector3(0, -R, 0), tmp = new THREE.Vector3();
  kid.frame.push(() => {
    const show = S.mode === 'overview', w = window.innerWidth, h = window.innerHeight;
    layer.style.display = show ? '' : 'none';
    if (!show) return;
    for (const m of marks) {
      const p = overview.project(m.pos, w, h, 0);
      // facing: the spot is on the near side of the Moon when its up direction points toward the camera
      const near = p && tmp.copy(m.pos).sub(centre).dot(tmp.copy(overview.camera.position).sub(m.pos)) > 0;
      m.el.style.display = near ? '' : 'none';
      if (near) { m.el.style.left = p.x + 'px'; m.el.style.top = p.y + 'px'; }
    }
  });

  // The card
  function render() {
    btn.querySelector('.ice-lbl').textContent = T('kIBtn');
    btn.title = T('kIBtnTip');
    const badge = btn.querySelector('.ice-badge');
    badge.textContent = found.length ? found.length : ''; badge.hidden = !found.length;
    card.hidden = !(on && S.mode === 'overview');
    if (card.hidden) return;
    const [a, b] = years(), r = st.res;
    let body = '';
    if (st.phase === 'hint') {
      body = `<p class="ice-big">${T('kIHint')}</p><p class="ice-sub">${T('kIHint2')}</p>`;
    } else if (st.phase === 'looking') {
      body = `<div class="ice-look"><span class="ice-spin" aria-hidden="true"></span><p class="ice-big">${T('kILooking', { a, b })}</p></div>`;
    } else if (r.kind === 'far') {
      body = `<div class="ice-res far"><h3>${SVG.far}<span>${T('kIFarHead')}</span></h3><p class="ice-main">${T('kIFar')}</p></div>`;
    } else {
      const w = shareWords(r), fmt = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      const where = `${Math.abs(r.lat).toFixed(2)}°${r.lat < 0 ? 'S' : 'N'} ${Math.abs(r.lon).toFixed(2)}°${r.lon < 0 ? 'W' : 'E'}`;
      const stat = `<p class="ice-stat" data-lit="${r.lit}" data-n="${r.n}">${T('kIHours', { h: fmt(r.lit), n: fmt(r.n) })} · ${where}</p>`;
      const note = `<details class="ice-note"><summary>${T('kINoteSum')}</summary><p>${T('kINote')}</p></details>`;
      const tag = st.tag === 'new' ? `<span class="ice-tag">${T('kINew')}</span>` : st.tag === 'seen' ? `<span class="ice-tag seen">${T('kISeen')}</span>` : '';
      if (r.dark) {
        body = `<div class="ice-res dark"><div class="ice-sparks" aria-hidden="true">${SVG.spark}${SVG.spark}${SVG.spark}</div><h3>${T('kIDarkHead')}</h3>${tag}<p class="ice-main">${T('kIDark', { a, b })}</p>` +
          `<p class="ice-ctx">${T('kILcross')} <a href="${LCROSS}" target="_blank" rel="noopener">${T('kISource')}</a></p>${stat}${note}</div>`;
      } else {
        body = `<div class="ice-res lit"><h3>${SVG.sun}<span>${T('kILitHead')}</span></h3><p class="ice-main">${T(w.key, w.vars)}</p>${stat}${note}</div>`;
      }
    }
    card.innerHTML = `<div class="ice-head">${SVG.flake}<b>${T('kIBtn')}</b><button type="button" class="ice-x" aria-label="${T('kIClose')}" title="${T('kIClose')}">×</button></div>` +
      `<div class="ice-body">${body}</div><div class="ice-foot" title="${T('kICountTip')}">${T('kICount', { n: found.length })}</div>`;
    card.querySelector('.ice-x').onclick = () => setMode(false);
  }

  function setMode(v) {
    if (!!v !== on) { hunt_no++; waiting = null; for (const m of marks) m.el.remove(); marks.length = 0; found = []; st.phase = 'hint'; st.res = null; st.tag = null; }
    on = !!v;
    btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on));
    document.documentElement.classList.toggle('ice-on', on);
    if (on && !busy) { st.phase = 'hint'; st.res = null; st.tag = null; }
    render();
  }
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && on) setMode(false); });

  // A tap
  async function hunt(lat, lon) {
    if (busy) { waiting = { lat, lon }; return null; }
    busy = true;
    let res = null, mark = null;
    const mine = hunt_no;
    try {
      const coarse = kindOf(lat, lon) === 'coarse';
      if (coarse) mark = addMark(lat, lon, 'looking');
      if (coarse) { // a tap never feels dead: show "looking" and let it paint before the heavy pass
        st.phase = 'looking'; st.res = null; st.tag = null; render();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      res = await judge(lat, lon);
      if (mine !== hunt_no) return res; // the hunt was stopped or started again while this answer was worked out: it leaves no point
      let tag = null;
      if (res.kind === 'coarse' && res.dark) {
        if (found.some((f) => km(f, [res.lat, res.lon]) < APART_KM)) tag = 'seen';
        else { found.push([+res.lat.toFixed(4), +res.lon.toFixed(4)]); tag = 'new'; }
      }
      if (mark) setMark(mark, res.dark ? 'dark' : 'lit');
      st.phase = 'result'; st.res = res; st.tag = tag; served++;
      render();
    } catch (e) {
      if (mark) { marks.splice(marks.indexOf(mark), 1); mark.el.remove(); }
      st.phase = 'hint'; render();
      setTimeout(() => { throw e; });
    } finally {
      busy = false;
      if (waiting) { const w = waiting; waiting = null; hunt(w.lat, w.lon); }
    }
    return res;
  }

  kid.moonTap.push((at) => {
    if (!on) return false;
    hunt(at.lat, at.lon);
    return true;
  });
  kid.mode.push((m) => { if (m === 'surface') setMode(false); else render(); });
  kid.lang.push(render);

  window.__ice = {
    judge, hunt, setMode, shareWords,
    get on() { return on; }, get busy() { return busy; }, get phase() { return st.phase; }, get last() { return st.res; },
    get count() { return found.length; }, get found() { return found.map((f) => f.slice()); }, get results() { return served; },
    get marks() { return marks.map((m) => ({ lat: m.lat, lon: m.lon, cls: m.cls })); },
    /** Where the i-th marker should stand on the screen right now (for tests): the same projection the frame hook uses. */
    markXY(i) { return overview.project(marks[i].pos, window.innerWidth, window.innerHeight, 0); },
  };
  render();
}
