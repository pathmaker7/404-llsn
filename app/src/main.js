import * as THREE from '../vendor/three.module.js';
import { loadIndex, loadOverview, loadSite, registerSite, loadPolar, PERIOD } from './data.js';
import { makeSite, kindOf, FAMOUS, historyOf } from './custom.js';
import { renderVerdict } from './verdict.js';
import {
  sample, nextSunChange, nextEarthChange, fmtDuration, fmtUTC, sunFraction, SUN_STATE_LABEL,
} from './science.js';
import { SurfaceView } from './surface.js';
import { Overview } from './overview.js';
import { Timeline } from './timeline.js';
import { allSites } from './allsites.js';

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
THREE.Cache.enabled = true; // the Earth picture is used by the map and by the site view: fetch it once

// ------------------------------------------------------------------ state
const S = {
  customs: [], index: null, mode: 'overview', siteId: null, variant: 'databook', site: null,
  t: 0, playing: false, speedH: 24, missionStart: 0, missionDays: 14, extra: {},
  panel: null, lastHud: 0,
};

const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const surface = new SurfaceView(renderer);
const overview = new Overview(renderer);
const timeline = new Timeline($('timeline'), (t) => setTime(t));
const overlay = $('overlay');
const og = overlay.getContext('2d');

function resize() {
  const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setSize(w, h, false);
  surface.setSize(w, h); overview.setSize(w, h, $('sitelist').offsetHeight / 2);
  overlay.width = Math.round(w * dpr); overlay.height = Math.round(h * dpr);
  og.setTransform(dpr, 0, 0, dpr, 0, 0);
  timeline.draw(); S.all?.redraw();
}
window.addEventListener('resize', resize);

// --------------------------------------------------------------- helpers
const siteEntry = (id) => S.index.sites.find((s) => s.id === id);
const fmtLat = (v) => `${Math.abs(v).toFixed(4)}°${v < 0 ? 'S' : 'N'}`;
const fmtLon = (v) => `${Math.abs(v).toFixed(4)}°${v < 0 ? 'W' : 'E'}`;
const fmtDeg = (v, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}°`;
const isoLocal = (t) => new Date(t * 1000).toISOString().slice(0, 16);
const periodStart = () => Date.parse(S.index.period.start) / 1000;
const periodEnd = () => Date.parse(S.index.period.end) / 1000;
const missionEnd = () => Math.min(S.missionStart + S.missionDays * 86400, periodEnd());

function setHash() {
  // One short address: the site and the landing day. Expert state (stay length, clock time, centre point) is not kept in it.
  const p = new URLSearchParams(), Mi = globalThis.Mission;
  if (S.mode === 'surface') p.set('site', S.siteId);
  p.set('land', isoLocal(S.missionStart).slice(0, 10));
  if (Mi.limits.nightH !== Mi.NIGHT_LIMIT_H) p.set('battery', Mi.limits.nightH / 24); // only when the user changed a limit
  if (Mi.limits.silenceH !== Mi.SILENCE_LIMIT_H) p.set('radio', Mi.limits.silenceH / 24);
  if (S.customs.length) p.set('add', S.customs.map((c) => [c.lat, c.lon, c.name].join(',')).join(';')); // sites the user added
  history.replaceState(null, '', location.pathname + '#' + p.toString());
}

// ------------------------------------------------------------- overview UI
// One site is "hot" while the pointer is on its label or its row: both light up, so a row is easy to find on the Moon.
function hot(id) {
  S.hot = id;
  for (const li of document.querySelectorAll('#sites li')) li.classList.toggle('hot', li.dataset.id === id);
}

function buildSiteList() {
  // Every site, every landing day (allsites.js). Each site is judged at the point the app stands on: the best-lit
  // flat point near the region centre when there is one.
  const spot = (s) => (s.variants.best ? 'best' : 'databook');
  S.all = allSites($('sitelist'), {
    sites: S.index.sites.map((s) => { const v = s.variants[spot(s)]; return { id: s.id, name: s.name, ref: s.ref, dir: v.dir, slope: v.slope_deg, evaSlope: S.extra[v.dir] ?? v.slope_deg }; }),
    days: S.missionDays, p0: periodStart(), p1: periodEnd(),
    onHover: hot,
    famous: FAMOUS,
    // A real mission with a known touchdown: stand there on its landing day, where the panel shows what really happened.
    onAdd: (lat, lon, name) => addCustom(lat, lon, name).then((e) => { const h = historyOf(e.lat, e.lon); if (!h) return setHash(); S.t = Date.parse(h.landed) / 1000; S.missionStart = Math.floor(S.t / 86400) * 86400; return enterSite(e.id, 'databook'); }), // the sky opens on the touchdown itself
    onLimits: () => { setHash(); drawVerdict(); },
    onTime: (t) => { S.mapT = t; S.mapPlay = false; },
    onPlay: () => { S.mapPlay = !S.mapPlay; },
    onPick: (id, t) => { if (t != null) { S.missionStart = t; S.t = t; } enterSite(id, spot(siteEntry(id))); },
  });
  $('pins').innerHTML = '';
  for (const s of overview.sites) makePin(s);
}

function makePin(s) {
  const pins = $('pins');
  {
    const el = document.createElement('div');
    el.className = 'pin';
    el.dataset.name = s.name; el.textContent = globalThis.I18n.place(s.name);
    el.onmouseenter = () => hot(s.id); el.onmouseleave = () => hot(null);
    el.onclick = () => enterSite(s.id, s.variants.best ? 'best' : 'databook') /* land on the best-lit point near the centre when there is one */;
    pins.appendChild(el);
    s.el = el;
  }
}

// A site the user adds (custom.js): any coordinates or a known landing site. It gets a row, a verdict, and a place to stand.
async function addCustom(lat, lon, name) {
  lon = +(((lon + 540) % 360) - 180).toFixed(5); lat = +lat.toFixed(5);
  // The name can come from the page address, which anyone can craft into a link, and site names are written into HTML:
  // keep letters, digits and plain punctuation only, so it can never become markup.
  name = name ? String(name).replace(/[^\p{L}\p{N} .,()'°+-]/gu, '').replace(/'/g, '’').trim().slice(0, 40) || null : null;
  const same = S.index.sites.find((s) => s.custom && Math.abs(s.lat - lat) < 1e-6 && Math.abs(s.lon - lon) < 1e-6);
  if (same) return same;
  $('loading').classList.add('on');
  const grid = kindOf(lat, lon) === 'coarse' ? await loadPolar().finally(() => $('loading').classList.remove('on')) : overview.ov;
  $('loading').classList.remove('on');
  const made = makeSite(lat, lon, grid), id = 'u' + (S.customs.length + 1);
  const label = name || `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
  const entry = { id, name: label, ref: made.kind === 'coarse' ? 'added · coarse terrain' : 'added · smooth Moon', lat, lon, custom: made.kind,
    variants: { databook: { dir: id, slope_deg: made.slope, offset_m: 0 } } };
  registerSite(id, made);
  S.index.sites.push(entry); S.extra[id] = made.slope; S.customs.push({ lat, lon, name: label });
  makePin(overview.addSite(entry, made.kind === 'coarse'));
  S.all.add({ id, name: label, ref: entry.ref, dir: id, slope: made.slope, evaSlope: made.slope });
  resize();
  return entry;
}

function placePins() {
  const w = window.innerWidth, h = window.innerHeight;
  const show = S.mode === 'overview' && !overview.anim && overview.dist < 2.2e6; // labels only when close enough to tell the sites apart
  const items = [];
  for (const s of overview.sites) {
    const p = show && !s.off ? overview.project(s.pos, w, h) : null; // a site outside the polar terrain has a row but no label here
    const g = p ? overview.project(s.pos, w, h, 0) : null;
    s.el.style.display = p ? '' : 'none';
    const row = globalThis.__all?.rows.find((r) => r.id === s.id);
    // The dot is the day under the time line: green when a landing that day survives here, so the dots change as it plays.
    // With the line outside the period: green for at least one safe landing day in the period.
    s.st = S.all?.stateAt(s.id, S.mapT) ?? (row && row.good >= 0 ? (row.good > 0 ? 'ok' : 'bad') : '');
    if (s.el.dataset.s !== s.st) s.el.dataset.s = s.st;
    s.el.classList.toggle('hot', S.hot === s.id);
    if (p) items.push({ s, p, g, x: p.x, y: p.y, wd: s.el.offsetWidth || 120 });
  }
  // greedy vertical de-overlap, then leader lines from the ground point
  items.sort((a, b) => b.y - a.y);
  const placed = [];
  for (const it of items) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const q of placed) {
        if (Math.abs(q.x - it.x) < (q.wd + it.wd) / 2 + 4 && Math.abs(q.y - it.y) < 24) { it.y = q.y - 26; moved = true; }
      }
    }
    placed.push(it);
    it.s.el.style.left = `${it.x}px`; it.s.el.style.top = `${it.y}px`;
  }
  for (const [id, v] of [['sunmark', overview.sunMark], ['earthmark', overview.earthMark]]) { // where the Sun and Earth stand, on the rim of the cap
    const q = show && v ? overview.project(v, w, h, 0) : null, el = $(id), c = q && overview.project(overview.pole, w, h, 0);
    el.style.display = q ? '' : 'none';
    if (!q) continue;
    el.style.left = `${q.x}px`; el.style.top = `${q.y}px`;
    if (!c) continue;
    // an arrow from the label away from the pole: the body stands in that direction
    const n = Math.hypot(q.x - c.x, q.y - c.y) || 1, ux = (q.x - c.x) / n, uy = (q.y - c.y) / n, x0 = q.x + ux * 40, y0 = q.y + uy * 22, x1 = x0 + ux * 46, y1 = y0 + uy * 46;
    og.strokeStyle = og.fillStyle = id === 'sunmark' ? '#ffb547' : '#5fb4ff'; og.lineWidth = 2.5;
    og.beginPath(); og.moveTo(x0, y0); og.lineTo(x1, y1); og.stroke();
    og.beginPath(); og.moveTo(x1 + ux * 10, y1 + uy * 10); og.lineTo(x1 - uy * 6, y1 + ux * 6); og.lineTo(x1 + uy * 6, y1 - ux * 6); og.fill();
  }
  if (show) {
    for (const it of items) {
      const col = it.s.st === 'ok' ? '63,191,127' : it.s.st === 'bad' ? '226,84,90' : '160,170,190', on = S.hot === it.s.id;
      og.strokeStyle = `rgba(${col},${on ? 1 : 0.55})`; og.lineWidth = on ? 2 : 1;
      og.beginPath(); og.moveTo(it.g.x, it.g.y); og.lineTo(it.x, it.y); og.stroke();
      og.fillStyle = `rgba(${col},.25)`; og.beginPath(); og.arc(it.g.x, it.g.y, on ? 12 : 7, 0, Math.PI * 2); og.fill();
      og.fillStyle = `rgb(${col})`; og.beginPath(); og.arc(it.g.x, it.g.y, on ? 5 : 3.5, 0, Math.PI * 2); og.fill();
    }
  }
}

// --------------------------------------------------------------- surface
async function enterSite(id, variant, { fly = true, keepTime = false } = {}) {
  const entry = siteEntry(id);
  if (!entry.variants[variant]) variant = 'databook';
  const ovSite = overview.sites.find((s) => s.id === id);
  $('loading').classList.add('on');
  const load = loadSite(entry.variants[variant].dir);
  if (fly && S.mode === 'overview' && !ovSite.off) await overview.flyTo(ovSite);
  $('fade').classList.add('on');
  const site = await load;
  $('loading').classList.remove('on');
  await new Promise((r) => setTimeout(r, 350));
  S.siteId = id; S.variant = variant; S.site = site;
  selfCheck(site);
  surface.setSite(site);
  S.mode = 'surface';
  document.body.className = 'mode-surface';
  if (!keepTime) {
    const s0 = sample(site, S.t);
    surface.yaw = s0.sunAz; surface.pitch = 1;
  }
  refreshMission();
  renderHudStatic();
  $('fade').classList.remove('on');
  if (S.panel) openPanel(S.panel);
  setHash();
}

async function switchVariant(v) {
  if (!S.site || v === S.variant) return;
  const yaw = surface.yaw, pitch = surface.pitch;
  await enterSite(S.siteId, v, { fly: false, keepTime: true });
  surface.yaw = yaw; surface.pitch = pitch;
}

function backToMap() {
  S.mode = 'overview';
  S.playing = false; $('play').textContent = '▶';
  document.body.className = 'mode-overview';
  overview.reset(); S.held = false;
  resize();
  setHash();
}

/** Browser-vs-pipeline consistency: recompute the disc fraction in JS at
 *  hourly samples and compare with the pipeline's series. */
function selfCheck(site) {
  if (site.selfcheck) return;
  const m = site.meta.mask.el_deg, st = site.meta.mask.az_step_deg, c = site.ch;
  let maxd = 0;
  for (let i = 0; i < site.n; i += 7) {
    const f = sunFraction(c.sunAz[i], c.sunEl[i], c.sunR[i], m, st);
    maxd = Math.max(maxd, Math.abs(f - c.sunFrac[i]));
  }
  site.selfcheck = { maxAbsFracDiff: maxd, n: Math.ceil(site.n / 7) };
}

function renderHudStatic() {
  const e = siteEntry(S.siteId), m = S.site.meta;
  const I = globalThis.I18n, T = I.t;
  $('h-name').innerHTML = `${I.place(e.name)}<span class="ref">${I.place(e.ref)}</span>`;
  $('h-coords').textContent = `${fmtLat(m.lat)} ${fmtLon(m.lon)} · ${T('uCoords', { h: m.ground_height_m.toFixed(0), s: m.slope_deg })}`;
  for (const b of $('h-variant').querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.v === S.variant);
    b.disabled = !e.variants[b.dataset.v];
    if (b.dataset.v === 'best' && !e.variants.best) b.title = T('uNoBest');
  }
  $('h-variant-note').textContent = e.custom === 'coarse' ? T('uNoteCoarse')
    : e.custom === 'smooth' ? T('uNoteSmooth')
    : e.ref === 'Team' ? T('uNoteTeam')
    : S.variant === 'best'
    ? T('uNoteBest', { m: m.offset_m.toFixed(0) })
    : e.variants.best ? T('uNoteCentre')
      : T('uNoteCentreOnly');
}

function renderHud(s) {
  $('h-time').textContent = fmtUTC(s.t);
  $('d-time').textContent = fmtUTC(s.t);
  $('h-sun-el').textContent = fmtDeg(s.sunEl);
  $('h-sun-az').textContent = `${s.sunAz.toFixed(1)}°`;
  $('h-sun-mask').textContent = fmtDeg(s.sunMask);
  $('h-sun-frac').textContent = `${(s.sunFrac * 100).toFixed(s.sunFrac > 0 && s.sunFrac < 0.995 ? 1 : 0)}%`;
  const pw = $('h-power');
  pw.textContent = globalThis.I18n.t(['uStDark', 'uStPart', 'uStGen'][s.sunState]);
  pw.className = 'chip ' + ['dark', 'part', 'gen'][s.sunState];
  $('h-earth-el').textContent = fmtDeg(s.earthEl);
  $('h-earth-az').textContent = `${s.earthAz.toFixed(1)}°`;
  $('h-earth-margin').textContent = fmtDeg(s.earthEl - s.earthMask);
  const lk = $('h-link');
  lk.textContent = globalThis.I18n.t(s.earthVis ? 'uDteIn' : 'uDteOut');
  lk.className = 'chip ' + (s.earthVis ? 'link' : 'nolink');
  // Earth phase: illuminated fraction k = (1 + cos(phase angle)) / 2,
  // phase angle = angle Sun-Earth-observer.
  const sv = [Math.cos(s.sunEl * DEG) * Math.sin(s.sunAz * DEG), Math.sin(s.sunEl * DEG), -Math.cos(s.sunEl * DEG) * Math.cos(s.sunAz * DEG)];
  const ev = [Math.cos(s.earthEl * DEG) * Math.sin(s.earthAz * DEG), Math.sin(s.earthEl * DEG), -Math.cos(s.earthEl * DEG) * Math.cos(s.earthAz * DEG)];
  const dS = 695700 / Math.sin(s.sunR * DEG), dE = 6371 / Math.sin(s.earthR * DEG);
  const es = sv.map((v, i) => v * dS - ev[i] * dE), eo = ev.map((v) => -v);
  const nes = Math.hypot(...es);
  const cosPa = (es[0] * eo[0] + es[1] * eo[1] + es[2] * eo[2]) / nes;
  $('h-earth-phase').textContent = `${(((1 + cosPa) / 2) * 100).toFixed(0)}%`;

  const ns = nextSunChange(S.site, s.t), ne = nextEarthChange(S.site, s.t);
  const lit = s.sunFrac > 0;
  // Always in view (the challenge's core output): where the Sun and Earth stand against the real horizon at the moment shown,
  // and how long until that changes.
  const T = globalThis.I18n.t;
  const line = (cls, name, el, over, state, next) => `<div class="${cls}"><i></i><b>${name}</b><strong title="${T('uAboveTip', { d: fmtDeg(over) })}">${fmtDeg(el)}</strong><span>${T('sElev')}<br>${state}</span><em>${next}</em></div>`;
  $('sky-at').firstElementChild.textContent = T('sAt');
  if (document.activeElement !== $('sky-when')) $('sky-when').value = new Date(s.t * 1000).toISOString().slice(0, 19); // to the second; typing is not overwritten
  $('sky-lines').innerHTML = line('sun', T('sSun'), s.sunEl, s.sunEl - s.sunMask, T('sDisc', { p: (s.sunFrac * 100).toFixed(0) }), ns == null ? '' : `${T(lit ? 'sSunset' : 'sSunrise')} ${fmtDuration(ns - s.t)}`)
    + line('earth', T('sEarth'), s.earthEl, s.earthEl - s.earthMask, T(s.earthVis ? 'sIn' : 'sHid'), ne == null ? '' : `${T(s.earthVis ? 'sEset' : 'sErise')} ${fmtDuration(ne - s.t)}`);
  $('h-sun-next').innerHTML = ns == null ? `<span class="muted">${T('uNoChange')} (${S.index.period.end.slice(0, 10)})</span>`
    : `${T(lit ? 'uSunLost' : 'uSunBack')} <b>${fmtDuration(ns - s.t)}</b>`;
  $('h-earth-next').innerHTML = ne == null ? `<span class="muted">${T('uNoChange')}</span>`
    : `${T(s.earthVis ? 'uEarthLost' : 'uEarthBack')} <b>${fmtDuration(ne - s.t)}</b>`;
}

// ------------------------------------------------------------- time/mission
function setTime(t) {
  S.t = Math.min(Math.max(t, periodStart()), periodEnd());
  const u = (S.t - S.missionStart) / (missionEnd() - S.missionStart);
  $('scrub').value = Math.round(Math.min(Math.max(u, 0), 1) * 1000);
  timeline.setTime(S.t);
  S.dirty = true;
}

function refreshMission() {
  $('m-start').value = isoLocal(S.missionStart);
  $('m-days').value = String(S.missionDays);
  if (S.t < S.missionStart || S.t > missionEnd()) S.t = S.missionStart;
  if (S.site) {
    timeline.set(S.site, S.missionStart, missionEnd());
    surface.setPaths(S.site, (t) => sample(S.site, t), S.missionStart, missionEnd());
  }
  setTime(S.t);
  drawVerdict();
}

// The answer panel (verdict.js): verdict, every check, landing days and the date controls for the chosen spot.
function drawVerdict() {
  if (!S.site) return;
  const e = siteEntry(S.siteId), v = e.variants[S.variant];
  renderVerdict($('verdict'), { history: e.custom ? historyOf(e.lat, e.lon) : null, site: S.site, slope: v.slope_deg, evaSlope: S.extra[v.dir] ?? v.slope_deg, t: S.missionStart, days: S.missionDays, p0: periodStart(), p1: periodEnd(),
    setDate: (t) => { S.missionStart = t; S.t = t; S.playing = false; $('play').textContent = '▶'; refreshMission(); setHash(); } });
}

$('scrub').addEventListener('input', (e) => setTime(S.missionStart + (e.target.value / 1000) * (missionEnd() - S.missionStart)));
$('play').addEventListener('click', () => {
  S.playing = !S.playing;
  $('play').textContent = S.playing ? '❚❚' : '▶';
  if (S.playing && S.t >= missionEnd() - 1) setTime(S.missionStart);
});
$('speed').addEventListener('change', (e) => { S.speedH = +e.target.value; });
$('m-start').addEventListener('change', (e) => {
  const t = Date.parse(e.target.value + ':00Z') / 1000;
  if (!Number.isFinite(t)) return;
  S.missionStart = Math.min(Math.max(t, periodStart()), periodEnd() - 86400);
  S.t = S.missionStart;
  refreshMission(); setHash();
});
$('m-days').addEventListener('change', (e) => { S.missionDays = +e.target.value; refreshMission(); setHash(); });
$('back').addEventListener('click', backToMap);
// Any moment, to the second: the sky and the numbers move there; a moment outside the stay moves the landing to that day.
$('sky-when').addEventListener('change', (e) => {
  const t = Date.parse(e.target.value + 'Z') / 1000;
  if (!Number.isFinite(t)) return;
  const c = Math.min(Math.max(t, periodStart()), periodEnd() - S.missionDays * 86400);
  S.playing = false; $('play').textContent = '▶';
  if (c < S.missionStart || c > missionEnd()) { S.missionStart = Math.floor(c / 86400) * 86400; S.t = c; refreshMission(); setHash(); }
  setTime(c);
});
for (const b of $('h-variant').querySelectorAll('button')) b.addEventListener('click', () => switchVariant(b.dataset.v));

// view options
const bindOpt = (id, fn) => $(id).addEventListener('change', (e) => { fn(e.target.checked); surface.applyOptions(); S.dirty = true; });
bindOpt('opt-horizon', (v) => { surface.opts.horizon = v; });
bindOpt('opt-paths', (v) => { surface.opts.paths = v; });
bindOpt('opt-fill', (v) => { surface.opts.fill = v; });
bindOpt('opt-mag', (v) => { surface.opts.earthMag = v ? 4 : 1; });
bindOpt('opt-detail', (v) => { surface.opts.detail = v; });
bindOpt('opt-lowq', (v) => { surface.opts.quality = v ? 'low' : 'high'; });

function lookAt(az, el) {
  const y0 = surface.yaw, p0 = surface.pitch, t0 = performance.now();
  const dy = ((az - y0 + 540) % 360) - 180;
  S.lookAnim = (now) => {
    const u = Math.min((now - t0) / 700, 1), e = 1 - Math.pow(1 - u, 3);
    surface.yaw = y0 + dy * e; surface.pitch = p0 + (el - p0) * e;
    if (u >= 1) S.lookAnim = null;
  };
}
$('look-sun').addEventListener('click', () => { const s = sample(S.site, S.t); lookAt(s.sunAz, s.sunEl); });
$('look-earth').addEventListener('click', () => { const s = sample(S.site, S.t); lookAt(s.earthAz, s.earthEl); });

// first-person look controls
{
  const cv = $('gl');
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (S.mode !== 'surface') { // the map: drag turns it and tilts it, and stops the slow turn
      if (overview.anim) return;
      S.held = true;
      overview.theta -= (e.clientX - drag.x) * 0.3;
      overview.phi = Math.min(Math.max(overview.phi + (e.clientY - drag.y) * 0.2, 12), 85);
      drag = { x: e.clientX, y: e.clientY };
      return;
    }
    const k = surface.fov / window.innerHeight;
    surface.yaw = (surface.yaw - (e.clientX - drag.x) * k + 360) % 360;
    surface.pitch = Math.min(Math.max(surface.pitch + (e.clientY - drag.y) * k, -85), 85);
    drag = { x: e.clientX, y: e.clientY };
  });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (S.mode === 'surface') {
      surface.fov = Math.min(Math.max(surface.fov * Math.exp(e.deltaY * 0.001), 2), 100);
      $('fovlabel').textContent = `${surface.fov.toFixed(surface.fov < 10 ? 1 : 0)}°`;
    } else if (!overview.anim) {
      overview.dist = Math.min(Math.max(overview.dist * Math.exp(e.deltaY * 0.001), 60000), 9e6);
    }
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ') { e.preventDefault(); $('play').click(); }
    if (S.mode !== 'surface') return;
    if (e.key === 'ArrowLeft') surface.yaw = (surface.yaw - 5 + 360) % 360;
    if (e.key === 'ArrowRight') surface.yaw = (surface.yaw + 5) % 360;
    if (e.key === 'ArrowUp') surface.pitch = Math.min(surface.pitch + 2, 85);
    if (e.key === 'ArrowDown') surface.pitch = Math.max(surface.pitch - 2, -85);
  });
}

// ---------------------------------------------------------- overlay drawing
function drawOverlay(s) {
  const w = window.innerWidth, h = window.innerHeight;
  og.clearRect(0, 0, w, h);
  if (S.mode !== 'surface') return;
  // compass tape
  const tapeW = Math.min(560, w - 80), x0 = (w - tapeW) / 2, y0 = 60, span = 90;
  og.fillStyle = 'rgba(8,11,16,0.72)'; og.fillRect(x0, y0, tapeW, 30);
  og.strokeStyle = 'rgba(150,170,200,0.25)'; og.strokeRect(x0 + 0.5, y0 + 0.5, tapeW - 1, 29);
  og.font = '600 11px "IBM Plex Mono", monospace'; og.textAlign = 'center';
  const card = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let a = Math.ceil((surface.yaw - span / 2) / 5) * 5; a <= surface.yaw + span / 2; a += 5) {
    const x = x0 + ((a - surface.yaw) / span + 0.5) * tapeW;
    const aa = ((a % 360) + 360) % 360;
    og.fillStyle = 'rgba(200,210,230,0.5)';
    og.fillRect(x, y0 + 22, 1, aa % 15 === 0 ? 8 : 4);
    if (aa % 45 === 0) { og.fillStyle = aa === 0 ? '#46e0c8' : '#dfe6f2'; og.fillText(card[aa], x, y0 + 13); }
    else if (aa % 15 === 0) { og.fillStyle = 'rgba(200,210,230,0.6)'; og.fillText(String(aa), x, y0 + 13); }
  }
  const mark = (az, col, label) => {
    let d = ((az - surface.yaw + 540) % 360) - 180;
    const clamped = Math.max(Math.min(d, span / 2), -span / 2);
    const x = x0 + (clamped / span + 0.5) * tapeW;
    og.fillStyle = col;
    og.beginPath(); og.moveTo(x, y0 + 30); og.lineTo(x - 5, y0 + 38); og.lineTo(x + 5, y0 + 38); og.fill();
    og.fillText(Math.abs(d) > span / 2 ? (d < 0 ? `◂ ${label}` : `${label} ▸`) : label, x, y0 + 50);
  };
  mark(s.sunAz, '#ffb547', globalThis.I18n.t('uSunLabel')); mark(s.earthAz, '#5fb4ff', globalThis.I18n.t('uEarthLabel'));
  og.fillStyle = '#46e0c8'; og.fillRect(w / 2 - 1, y0 - 4, 2, 6);
  og.fillText(`${surface.yaw.toFixed(0).padStart(3, '0')}°`, w / 2, y0 - 7);

  // in-scene labels
  const lab = (az, el, r, col, text) => {
    const p = surface.project(az, el, w, h);
    if (!p || p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) return;
    const px = (r * DEG) / (surface.fov * DEG) * h; // approx. disc radius in px
    const rr = Math.max(px + 6, 12);
    og.strokeStyle = col; og.lineWidth = 1;
    og.beginPath(); og.arc(p.x, p.y, rr, 0, Math.PI * 2); og.stroke();
    og.fillStyle = col; og.textAlign = 'left'; og.font = '600 11px "IBM Plex Mono", monospace';
    og.fillText(text, p.x + rr + 6, p.y - 4);
  };
  lab(s.sunAz, s.sunEl, s.sunR, 'rgba(255,181,71,0.9)', `${globalThis.I18n.t('uSunLabel')} ${fmtDeg(s.sunEl)} · ${(s.sunFrac * 100).toFixed(0)}% ${globalThis.I18n.t('uDisc')}`);
  lab(s.earthAz, s.earthEl, s.earthR * surface.opts.earthMag, 'rgba(95,180,255,0.9)', `${globalThis.I18n.t('uEarthLabel')} ${fmtDeg(s.earthEl)}${surface.opts.earthMag > 1 ? ' (×4)' : ''}`);
  og.textAlign = 'center';
}

// ------------------------------------------------------------------ panels
function openPanel(name) {
  S.panel = name;
  for (const b of document.querySelectorAll('#topbar nav button')) b.classList.toggle('active', b.dataset.panel === name);
  $('panel').classList.add('open'); $('panel').setAttribute('aria-hidden', 'false');
  ({ validation: renderValidation, about: renderAbout })[name]?.();
}
function closePanel() {
  S.panel = null;
  for (const b of document.querySelectorAll('#topbar nav button')) b.classList.remove('active');
  $('panel').classList.remove('open'); $('panel').setAttribute('aria-hidden', 'true');
}
for (const b of document.querySelectorAll('#topbar nav button')) b.addEventListener('click', () => (S.panel === b.dataset.panel ? closePanel() : openPanel(b.dataset.panel)));
$('panel-close').addEventListener('click', closePanel);

async function renderValidation() {
  const body = $('panel-body');
  const rows = [];
  for (const s of S.index.sites) for (const [k, v] of Object.entries(s.variants)) rows.push({ s, k, v });
  const checked = rows.filter((r) => r.v.validation_max_arcsec); // sites the user added have no Horizons check of their own
  const allSun = Math.max(...checked.map((r) => r.v.validation_max_arcsec.sun));
  const allEarth = Math.max(...checked.map((r) => r.v.validation_max_arcsec.earth));
  let detail = '';
  if (S.site) {
    const val = S.site.meta.validation;
    const sc = S.site.selfcheck;
    const r = S.site.meta.mask.rendered_minus_mask_deg;
    if (val.status === 'ok') {
      const fmtRow = (b, i) => {
        const d = val[b];
        const daz = ((d.app_az[i] - d.horizons_az[i] + 540) % 360 - 180) * Math.cos(d.horizons_el[i] * DEG) * 3600;
        const del = (d.app_el[i] - d.horizons_el[i]) * 3600;
        return `<td>${d.horizons_az[i].toFixed(4)}</td><td>${d.horizons_el[i].toFixed(4)}</td><td>${daz.toFixed(2)}</td><td>${del.toFixed(2)}</td>`;
      };
      detail = `<h3>Sample check: ${siteEntry(S.siteId).name} (${S.variant === 'best' ? 'best nearby point' : 'Data Book centre'})</h3>
      <div class="tw"><table class="t"><tr><th>Time (UTC)</th><th>Sun az (Horizons)</th><th>Sun el</th><th>Δaz·cos el ″</th><th>Δel ″</th><th>Earth az</th><th>Earth el</th><th>Δaz·cos el ″</th><th>Δel ″</th></tr>
      ${val.times_utc.slice(0, 12).map((t, i) => `<tr><td>${t.slice(0, 16).replace('T', ' ')}</td>${fmtRow('sun', i)}${fmtRow('earth', i)}</tr>`).join('')}
      </table></div><p class="tiny muted">First 12 of ${val.n} times (minutes off the hourly grid, so the app's interpolation error is included). Horizons header: “${val.sun.horizons_header.frame_line.trim()}”, “${val.sun.horizons_header.ephem_line.trim()}”.</p>`;
    }
    detail += `<h3>Internal consistency at this point</h3><ul>
      <li>Rendered terrain skyline vs computed horizon mask: mean ${r.mean.toFixed(3)}°, range ${r.min.toFixed(3)}° to +${r.max.toFixed(3)}°. Where the decimated far mesh is lower, a skyline drawn from the mask fills the gap, so the visible horizon matches the mask.</li>
      <li>Browser vs pipeline solar-disc fraction (${sc.n} hourly samples): max |Δ| = ${sc.maxAbsFracDiff.toExponential(1)}.</li></ul>`;
  }
  // Two checks against the outside world, beyond positions: NASA's own illumination study and four real landings.
  const pg = await fetch('data/pgda.json').then((r) => r.json()).catch(() => null);
  const pgda = !pg ? '' : `<h3>Against NASA's own illumination maps</h3>
  <p>NASA's Goddard team (Mazarico et al. 2011) computed, on 60 m LOLA terrain, the share of time each pixel near the pole sees the Sun and sees Earth (<a href="https://pgda.gsfc.nasa.gov/products/69" target="_blank" rel="noopener">PGDA Lunar Polar Illumination</a>). We looked up our ${pg.rows.length} points in their maps (tools/validate-pgda.cjs) and compared them with our own share over ${pg.period}.</p>
  <div class="callout"><b>Earth in view:</b> mean difference <b>${pg.earth.meanAbs} points</b>, correlation ${pg.earth.r}. <b>Sun:</b> mean difference <b>${pg.sun.meanAbs} points</b>, correlation ${pg.sun.r}; ours is higher by ${pg.sun.bias} on average.</div>
  <p>What this means: Earth agrees closely. For the Sun the two agree on which points are bright and which are dark, but on sharp ridges our share is higher than NASA's. On a ridge NASA's own value changes a lot from one 60 m pixel to the next (the last column), we stand 2 m above the ground where NASA's map is at the surface, and our terrain is 80 m. Read our Sun percentages on ridge tops as an upper estimate.</p>
  <div class="tw"><table class="t"><tr><th>Point</th><th>Sun, ours %</th><th>Sun, NASA %</th><th>Earth, ours %</th><th>Earth, NASA %</th><th>NASA Sun in the 9 pixels around</th></tr>
  ${pg.rows.map((r) => `<tr><td>${r.name}</td><td>${r.sun}</td><td>${r.nasaSun}</td><td>${r.earth}</td><td>${r.nasaEarth}</td><td>${r.nasaSunLo} to ${r.nasaSunHi}</td></tr>`).join('')}</table></div>`;
  const history = `<h3>Against four real landings</h3>
  <p>Pick a mission under "Replay a real landing" on the first screen: the app stands you on its site at its touchdown and shows the real outcome next to the model's numbers. The same numbers are asserted in tools/test.cjs and tools/smoke.cjs.</p>
  <table class="t"><tr><th>Mission</th><th>What really happened</th><th>What the model says</th></tr>
  <tr><td>Chandrayaan-3, 23 Aug 2023</td><td>The lander was set into sleep mode on 4 Sep 2023 at about 02:30 UTC, ahead of the lunar night it was not built for (<a href="https://spacepolicyonline.com/news/india-says-good-night-to-chandrayaan-3/" target="_blank" rel="noopener">ISRO, as reported</a>)</td><td>Sunrise 21 Aug 2023, two days before the landing; sunset 4 Sep 2023 at 19:00 UTC, about 16 hours after the real shutdown</td></tr>
  <tr><td>IM-1 Odysseus, 22 Feb 2024</td><td>Tipped on its side at landing; not built for the night; last contact 29 Feb 2024</td><td>A 14 day stay is lost: the night that starts on 3 Mar 2024 outlasts the battery. No terrain in the app at this site, and the real lander lay tilted, so its day ended earlier</td></tr>
  <tr><td>Chang'e 6, 1 Jun 2024</td><td>Far side; all contact through the Queqiao-2 relay satellite (<a href="https://spacepolicyonline.com/news/china-lands-sample-return-probe-on-the-far-side-of-the-moon/" target="_blank" rel="noopener">report</a>)</td><td>Earth never rises at the site: lost to radio silence without a relay</td></tr>
  <tr><td>IM-2 Athena, 6 Mar 2025</td><td>Fell on its side in a 20 m crater (<a href="https://lroc.im-ldi.com/images/1408" target="_blank" rel="noopener">LROC</a>), could not charge, ended the next day (<a href="https://spacepolicyonline.com/news/im-2-mission-ends-one-day-after-lunar-landing/" target="_blank" rel="noopener">report</a>)</td><td>Sun 2.5° up, Earth in view: the site and day pass. The model judges the place and the day, not the touchdown</td></tr></table>`;
  body.innerHTML = `<h2>How do we know this is right?</h2>
  <p><b>Dates outside 2027 to 2028:</b> the positions shown are computed in your browser with astronomy-engine and the IAU lunar rotation model, for 2021 to 2031, and agree with the offline DE440 series below to better than 0.01° over 2027 to 2028 (tools/test.cjs).</p><p>Every Sun and Earth position in the validation below was computed offline with Skyfield and JPL's DE440 ephemeris, using DE440 lunar orientation in the Moon's Mean-Earth frame. That's the same frame the LOLA terrain uses. We then checked the positions against an independent source: the <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a> API, with the observer placed on the lunar surface at each site.</p>
  <div class="callout">Largest disagreement with Horizons over ${checked.length} evaluated points × 36 times each in 2027 and 2028, <b>as displayed</b> (including hourly interpolation):
    Sun <b>${allSun.toFixed(2)}″</b>, Earth <b>${allEarth.toFixed(2)}″</b> (arcseconds). The Sun's disc is about 1900″ across.</div>
  <table class="t"><tr><th>Site · point</th><th>Sun max ″</th><th>Earth max ″</th><th>Slope</th><th>Offset</th></tr>
    ${rows.map((r) => `<tr><td>${r.s.name} · ${r.k === 'best' ? 'best ≤500 m' : 'Data Book'}</td><td>${r.v.validation_max_arcsec?.sun.toFixed(2) ?? '—'}</td><td>${r.v.validation_max_arcsec?.earth.toFixed(2) ?? '—'}</td><td>${r.v.slope_deg}°</td><td>${r.v.offset_m.toFixed(0)} m</td></tr>`).join('')}
  </table>
  ${history}
  ${pgda}
  ${detail}
  <h3>Horizon method</h3>
  <p>For every 0.25° of azimuth we trace the ground along the great circle from the observer, 2 m above the LOLA surface. We sample the 80 m DEM every 40 m out to 300 km, or to the map edge (at least 185 km at every site), and keep the highest elevation angle. Curvature is exact for a 1737.4 km sphere. The horizon tests check this against synthetic terrain with known answers: a bare sphere, a ring wall, and a lone peak 120 km away.</p>
  <p>The visible fraction of the solar disc integrates the true-size disc (radius from the Sun's distance, about 0.27°) against that horizon in 64 vertical strips. Earth counts as <em>in view</em> when its centre is above the horizon.</p>
  <h3>Known limitations</h3>
  <ul>
    <li><b>80 m terrain.</b> Boulders, small craters and slopes shorter than about 160 m are not modelled. At several sites the near horizon comes from the local slope a few hundred metres away, so results depend on the exact spot. That's why we show a second, nearby evaluated point.</li>
    <li><b>Data Book coordinates are region centres</b>, not landing points. Shackleton rim's centre sits on a 31° slope at this resolution.</li>
    <li><b>Earth "in view" uses the disc centre.</b> A half-hidden Earth may still support a link, and real links also need antenna pointing, ground stations, and a margin above terrain.</li>
    <li><b>Hourly time steps.</b> Statistics, the timeline and best-date search use hourly samples; countdowns are refined to the second. Events shorter than an hour can be missed.</li>
    <li><b>Lander height 2 m.</b> A mast or a solar array a few metres higher can see noticeably more Sun.</li>
    <li><b>Terrain rendering.</b> Distant terrain is drawn from a 600 m grid (320 m block-averaged DEM), with the computed skyline behind it. Shading is a Lommel–Seeliger/Lambert blend, and terrain shadows are traced per terrain grid node (60 m near, 600 m far). Both are for display; the HUD numbers come from the horizon mask.</li>
    <li><b>Terrain shadows beyond ~150 km</b> from the site are not cast onto the rendered terrain. The HUD and timeline do include them, out to the map edge.</li>
    <li><b>Ephemeris span.</b> Data covers ${S.index.period.start.slice(0, 10)} to ${S.index.period.end.slice(0, 10)} only.</li>
  </ul>`;
}

function renderAbout() {
  $('panel-body').innerHTML = `<h2>About</h2>
  <p>At the lunar south pole the Sun never climbs more than about two degrees above a flat horizon, and distant ridges decide whether a lander has power or a line of sight to Earth. This tool puts you <b>on the terrain</b> at a candidate site. For any date from 2021 to 2031 you see where the Sun and Earth really are against the real LOLA horizon, how much of the Sun is up, and how long until you lose power or the link home.</p>
  <h3>How to read it</h3>
  <ul>
    <li><b>Disc visible</b>: share of the solar disc above the terrain. <b>Generating</b> means the whole disc is up; <b>Partial</b>, part of it.</li>
    <li><b>DTE link</b>: Earth's centre is above the local terrain horizon (a geometric check, not a link budget).</li>
    <li><b>Timeline</b>: amber is sunlight, blue is Earth in view; gaps are night or a comms blackout.</li>
    <li><b>Teal line</b>: the computed horizon, which every number is checked against.</li>
  </ul>
  <h3>Data</h3>
  <ul>
    <li>Terrain: <a href="${S.index.dem.url}" target="_blank" rel="noopener">LRO LOLA LDEM_80S_80M</a>, NASA PDS Geosciences Node. 80 m/px polar stereographic, heights relative to a 1737.4 km sphere (scaling 0.5 m/DN, read from the PDS label).</li>
    <li>Ephemeris: JPL DE440 (de440s.bsp), lunar orientation moon_pa_de440_200625.bpc, frame kernel moon_de440_250416.tf, via NAIF generic kernels, computed with Skyfield.</li>
    <li>Validation: JPL Horizons API, observer at <code>coord@301</code>.</li>
    <li>Sites: NASA M2M-30044 <em>Lunar Surface Data Book</em> (Baseline, 18 Mar 2025), Table A2.1-1. Site numbering follows Mazarico et al. (2011).</li>
    <li>Software: three.js (MIT). Full list in docs/ATTRIBUTION.md.</li>
  </ul>
  <div class="callout warn">This is an independent student project for the NASA Space Apps Challenge 2026. It is not a NASA product and is not endorsed by NASA. Don't use it for actual mission decisions.</div>`;
}

// --------------------------------------------------------------------- loop
let relabel = () => {}; // set at boot: puts every fixed label and place name into the chosen language
let lastNow = performance.now();
function frame(now) {
  const dt = Math.min((now - lastNow) / 1000, 0.5);  // real time, so slow machines keep pace
  lastNow = now;
  if (S.mode === 'surface' && S.site) {
    if (S.playing) {
      let t = S.t + dt * S.speedH * 3600;
      if (t >= missionEnd()) { t = missionEnd(); S.playing = false; $('play').textContent = '▶'; }
      setTime(t);
    }
    if (S.lookAnim) S.lookAnim(now);
    const s = sample(S.site, S.t);
    surface.update(s);
    surface.render();
    drawOverlay(s);
    if (S.dirty && now - S.lastHud > 60) { renderHud(s); S.lastHud = now; S.dirty = false; }
  } else {
    if (!S.held && !overview.anim && S.mode === 'overview') overview.theta += dt * 1.5; // slow turn until the user takes the map
    if (S.all) { // the map's own clock: play sweeps it over the chosen period, and the sunlight on the Moon follows
      const [a, b] = S.all.range();
      if (S.mapPlay) { S.mapT += dt * Math.min((b - a) / 20, 2 * 86400); if (S.mapT >= b || S.mapT < a) S.mapT = a; }
      if (S.mapT !== S.mapShown) {
        const k = globalThis.Sky.bodiesMoonFixed(new Date(S.mapT * 1000)), lon = (v) => Math.atan2(v[1], v[0]);
        const lat = (v) => Math.asin(v[2] / Math.hypot(...v));
        overview.setSky(lon(k.sun), lat(k.sun), lon(k.earth), lat(k.earth));
        S.all.setHead(S.mapT, S.mapPlay); S.mapShown = S.mapT;
      }
      if (S.mapPlay !== S.playShown) { S.all.setHead(S.mapT, S.mapPlay); S.playShown = S.mapPlay; }
    }
    overview.render(now);
    drawOverlay(null);
  }
  placePins();
  requestAnimationFrame(frame);
}

// --------------------------------------------------------------------- boot
(async function boot() {
  try {
    S.index = await loadIndex();
    S.index.period = PERIOD; // positions are computed in the browser for 2021 to 2031 (data.js)
    S.extra = await fetch('data/extra.json').then((r) => r.json()).catch(() => ({}));
    const I18n = globalThis.I18n, sel = $('lang');
    try { I18n.set(localStorage.getItem('lang') || 'en'); } catch (e) { /* storage blocked */ }
    // Three visible buttons, the current language lit: a closed dropdown did not say what it was for.
    sel.innerHTML = Object.entries(I18n.NAMES).map(([k, v]) => `<button data-l="${k}" title="${v}">${k.toUpperCase()}</button>`).join('');
    const mark = () => { for (const b of sel.children) b.classList.toggle('on', b.dataset.l === I18n.lang); };
    for (const b of sel.children) b.onclick = () => { I18n.set(b.dataset.l); try { localStorage.setItem('lang', b.dataset.l); } catch (e) { /* storage blocked */ } mark(); relabel(); drawVerdict(); S.all?.redraw(); if (S.site) renderHudStatic(); S.dirty = true; };
    mark(); I18n.apply(document);
    const ov = await loadOverview(S.index);
    overview.build(ov, S.index.sites);
    overview.intro();
    const p = new URLSearchParams(location.hash.slice(1));
    // Embedded in the guided mission (team 404 agents merge): start minimal, one button brings every number back.
    // The numbers and view options are open by default and the Details button closes them. Closed on load on a phone
    // (no room) and when embedded in the guided mission (min=1), which shows its own verdict. On <html>: the app replaces body.className.
    document.documentElement.classList.toggle('min', p.get('min') === '1' || window.innerWidth <= 760); document.documentElement.classList.toggle('embed', p.get('min') === '1');
    const moreText = () => { $('more').textContent = I18n.t(document.documentElement.classList.contains('min') ? 'uMore' : 'uLess'); };
    relabel = () => { I18n.apply(document); moreText(); for (const el of $('pins').children) if (el.dataset.name) el.textContent = I18n.place(el.dataset.name); };
    $('more').onclick = () => { document.documentElement.classList.toggle('min'); moreText(); resize(); }; moreText();
    const landing = p.get('land') ? Date.parse(p.get('land').slice(0, 10) + 'T00:00:00Z') / 1000 : Math.floor(Date.now() / 86400000) * 86400; // default: land today
    S.missionStart = Number.isFinite(landing) ? landing : periodStart();
    S.missionDays = 14; // the survival limits are set for a 14 day stay; "Details" can change it
    S.mapT = Math.floor(Date.now() / 1000);
    for (const [k, f] of [['battery', 'nightH'], ['radio', 'silenceH']]) { const v = parseFloat(p.get(k)); if (v >= 0 && v <= 30) globalThis.Mission.limits[f] = v * 24; }
    buildSiteList();
    for (const c of (p.get('add') || '').split(';')) { const [la, lo, ...nm] = c.split(','); if (c && Number.isFinite(+la) && Number.isFinite(+lo) && Math.abs(+la) <= 90) await addCustom(+la, +lo, nm.join(',') || null); }
    const t = S.missionStart;
    S.t = Number.isFinite(t) ? t : S.missionStart;
    $('speed').value = String(S.speedH);
    resize();
    requestAnimationFrame(frame);
    if (p.get('site') && siteEntry(p.get('site'))) {
      await enterSite(p.get('site'), p.get('min') === '1' ? p.get('v') || 'databook' : siteEntry(p.get('site')).variants.best ? 'best' : 'databook', { fly: false, keepTime: true });
      const s0 = sample(S.site, S.t); surface.yaw = s0.sunAz; surface.pitch = 1;
    }
    if (p.get('panel')) openPanel(p.get('panel'));
    window.__app = { S, surface, overview, ready: true };
  } catch (err) {
    console.error(err);
    $('loading').textContent = 'Failed to load data: ' + err.message;
    $('loading').classList.add('on');
  }
})();
