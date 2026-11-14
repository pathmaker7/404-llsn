// Keep me alive: the battery game on the site screen.
// kid: the slots main.js hands every kids feature (see main.js, "kids features").
//
// The rules are the app's own (app/mission.js, app/src/verdict.js#judgeAt) replayed hour by hour on the same hourly series:
//   an hour with the Sun up (at least half the disc) fills the battery, an hour without it drains one hour of its life.
//   Lost: a dark run longer than the battery lasts, Earth hidden longer than the radio allows, no Sun in the first hours
//   after landing, or ground too steep (the lander tips over at touchdown).
// simulate() is the only code that replays them. The verdict shown at the end is settled against judgeAt, which decides.
import { judgeAt } from './verdict.js';
import { sample } from './science.js';

const DAY = 86400, HOUR = 3600, STAY_SECONDS = 40; // at 1x the whole stay takes about 40 seconds
const Mi = globalThis.Mission, I = globalThis.I18n, L = (k, v) => I.t(k, v);
const REASONS = ['night', 'radio', 'light', 'slope']; // the order of the "must" rows in mission.js#judge
const HATS = ['kyrgyz', 'kazakh', 'uzbek', 'tajik', 'none'], TYPES = ['lander', 'rover', 'hopper'];

/** The limits the rules use right now: the app's own, which the user can change on the map. */
export const limitsNow = () => ({ nightH: Mi.limits.nightH, silenceH: Mi.limits.silenceH, firstSunH: Mi.FIRST_SUN_H, slopeLimit: Mi.SLOPE_LIMIT });

/** Replays a landing at hour index i0 for W hours. Returns { ok, reason, hour, ... trace }.
 *  reason: null, or the chronologically first failure: 'slope' (hour 0), 'night', 'radio' or 'light'. hour: the hour of that
 *  failure (hour N when the stay survives). trace.* has one entry per played hour (the failing hour included). */
export function simulate(site, i0, W, slope, lim) {
  const { ch, n } = site, i1 = Math.min(n, i0 + W), N = Math.max(i1 - i0, 1);
  const up = (i) => ch.sunFrac[i] >= 0.5, see = (i) => ch.earthVis[i] > 0.5; // same tests as judgeAt
  const sun = new Uint8Array(N), earth = new Uint8Array(N), frac = new Float32Array(N), batt = new Float32Array(N), dark = new Uint16Array(N), silent = new Uint16Array(N);
  // The battery is "hours of life". A full one lasts nightH dark hours. The lander arrives with firstSunH minus one hours of
  // charge (never more than a full battery), so a landing with no Sun in the first firstSunH hours is lost exactly where
  // the "Sun on the first day" row of the verdict fails.
  const b0 = Math.max(Math.min(lim.firstSunH - 1, lim.nightH), 0);
  let d = 0, g = 0, b = b0, seen = false, reason = null, hour = N, len = N;
  for (let h = 0; h < N; h++) {
    const i = i0 + h, s = up(i), e = see(i);
    d = s ? 0 : d + 1; g = e ? 0 : g + 1; seen = seen || s; b = s ? lim.nightH : b - 1;
    sun[h] = s; earth[h] = e; frac[h] = ch.sunFrac[i]; batt[h] = Math.max(b, 0); dark[h] = d; silent[h] = g;
    const why = h === 0 && !(slope < lim.slopeLimit) ? 'slope'
      : d > lim.nightH ? 'night'
      : g > lim.silenceH ? 'radio'
      : !seen && (d >= lim.firstSunH || h === N - 1) ? 'light' : null; // the last test: a stay shorter than the first-Sun window
    if (why) { reason = why; hour = h; len = h + 1; break; }
  }
  // The number behind the failure, counted on the same series: the whole run that killed it, or the wait for the first Sun.
  let run = 0, wait = Infinity;
  if (reason === 'night') { run = d; for (let i = i0 + hour + 1; i < i1 && !up(i); i++) run++; }
  else if (reason === 'radio') { run = g; for (let i = i0 + hour + 1; i < i1 && !see(i); i++) run++; }
  else if (reason === 'light') { for (let i = i0; i < i1; i++) if (up(i)) { wait = i - i0; break; } }
  const cut = (a) => a.subarray(0, len);
  return { ok: reason === null, reason, hour, len, N, b0, run, wait, slope, lim,
    trace: { sun: cut(sun), earth: cut(earth), frac: cut(frac), batt: cut(batt), dark: cut(dark), silent: cut(silent) } };
}

/** The verdict to show: the game's own, unless it disagrees with judgeAt (then judgeAt's, and the console says so). */
export function settle(sim, J) {
  const failed = J.rows.filter((r) => r.pri === 'must' && r.ok === false).map((r) => r.id);
  const agree = sim.ok === J.ok && (sim.ok || failed.includes(sim.reason));
  if (agree) return { ok: sim.ok, reason: sim.reason, agree, failed };
  console.error('Keep me alive: the game and judgeAt disagree', { game: sim.reason || 'survives', judgeAt: failed.join() || 'survives' });
  return { ok: J.ok, reason: J.ok ? null : failed[0], agree, failed };
}

// ---------------------------------------------------------------- the kid's lander, drawn in code
const SAFE_NAME = /[^\p{L}\p{N} .,()'’+-]/gu;
/** The lander the kid made (written by another feature to localStorage "myLander"): checked, never trusted. */
export function myLander() {
  const d = { type: 'lander', color: '#e9edf4', name: 'Naryn-1', hat: 'kyrgyz' };
  try {
    const j = JSON.parse(localStorage.getItem('myLander') || 'null');
    if (j && typeof j === 'object') {
      if (TYPES.includes(j.type)) d.type = j.type;
      if (typeof j.color === 'string' && /^#[0-9a-f]{6}$/i.test(j.color)) d.color = j.color;
      if (typeof j.name === 'string') { const nm = j.name.replace(SAFE_NAME, '').trim().slice(0, 24); if (nm) d.name = nm; }
      if (HATS.includes(j.hat)) d.hat = j.hat;
    }
  } catch (e) { /* storage blocked or not JSON: the default lander */ }
  return d;
}

const HAT = {
  kyrgyz: '<path d="M72 68 C70 46 80 26 100 16 C120 26 130 46 128 68 Z" fill="#f7f4ea" stroke="#cfc8b4" stroke-width="1.5"/><path d="M100 16 C96 36 94 52 94 68 M100 16 C104 36 106 52 106 68" stroke="#cfc8b4" fill="none" stroke-width="1.5"/><path d="M68 64 Q100 76 132 64 L134 76 Q100 88 66 76 Z" fill="#1a1a1a"/><path d="M80 48 q4 -8 9 0 M111 48 q4 -8 9 0" stroke="#1a1a1a" fill="none" stroke-width="2.5" stroke-linecap="round"/>',
  kazakh: '<path d="M76 68 C74 40 126 40 124 68 Z" fill="#b3202a"/><path d="M70 62 Q100 54 130 62 L132 76 Q100 84 68 76 Z" fill="#5a3a22"/><path d="M80 54 q20 -10 40 0" stroke="#e8c15a" stroke-width="2.5" fill="none"/><path d="M100 44 q-5 -13 2 -26 q6 12 -2 26 Z" fill="#fff" stroke="#222" stroke-width="1"/>',
  uzbek: '<path d="M70 72 L78 46 Q100 38 122 46 L130 72 Z" fill="#14171d"/><path d="M73 66 H127" stroke="#fff" stroke-width="2.5"/><path d="M86 58 q4 -9 8 0 q-4 5 -8 0 Z M106 58 q4 -9 8 0 q-4 5 -8 0 Z M96 49 q4 -7 8 0 q-4 4 -8 0 Z" fill="#fff"/>',
  tajik: '<path d="M72 72 C72 38 128 38 128 72 Z" fill="#0e7a4f"/><path d="M72 66 H128" stroke="#f2c14e" stroke-width="3"/><path d="M84 54 l7 -8 l7 8 l-7 8 Z M102 54 l7 -8 l7 8 l-7 8 Z" fill="none" stroke="#f2c14e" stroke-width="2"/>',
  none: '',
};
const LEGS = {
  lander: '<g stroke="#9aa5b8" stroke-width="5" stroke-linecap="round" fill="none"><path d="M72 150 L48 186 M128 150 L152 186"/><path d="M36 188 H62 M138 188 H164" stroke-width="6"/></g>',
  rover: '<g fill="#2a3140" stroke="#9aa5b8" stroke-width="4"><circle cx="70" cy="170" r="15"/><circle cx="130" cy="170" r="15"/></g><g fill="#9aa5b8"><circle cx="70" cy="170" r="4"/><circle cx="130" cy="170" r="4"/></g>',
  hopper: '<g stroke="#9aa5b8" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="M76 152 l-10 9 l16 8 l-16 8 l10 9 M124 152 l10 9 l-16 8 l16 8 l-10 9"/></g>',
};
/** One lander as inline SVG. Only values checked by myLander() reach the markup. */
export function landerSVG(d) {
  const c = d.color;
  return `<svg class="g-svg" viewBox="0 0 200 200" aria-hidden="true">
  <g class="g-wing"><rect x="4" y="108" width="52" height="36" rx="3"/><path d="M21 108 V144 M38 108 V144 M4 126 H56"/></g>
  <g class="g-wing"><rect x="144" y="108" width="52" height="36" rx="3"/><path d="M161 108 V144 M178 108 V144 M144 126 H196"/></g>
  <path d="M56 126 H62 M138 126 H144" stroke="#9aa5b8" stroke-width="4"/>
  ${LEGS[d.type]}
  <g class="g-dish"><path d="M132 78 L142 52" stroke="#9aa5b8" stroke-width="4" stroke-linecap="round"/><ellipse cx="144" cy="44" rx="15" ry="6" transform="rotate(-35 144 44)" fill="#cfd6e3"/>
    <path class="g-wave" d="M158 30 q9 7 7 19"/><path class="g-wave w2" d="M165 24 q13 10 10 27"/></g>
  <rect x="58" y="96" width="84" height="58" rx="16" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
  <circle cx="100" cy="88" r="30" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
  <rect x="58" y="136" width="84" height="18" rx="9" fill="rgba(0,0,0,.14)"/>
  <ellipse cx="100" cy="92" rx="21" ry="13" fill="#0d1a2c"/>
  <g class="g-face">
    <g class="f-ok"><circle cx="91" cy="92" r="4.5" fill="#8fe9ff"/><circle cx="109" cy="92" r="4.5" fill="#8fe9ff"/></g>
    <g class="f-worry"><circle cx="90" cy="93" r="6" fill="#8fe9ff"/><circle cx="110" cy="93" r="6" fill="#8fe9ff"/><circle cx="90" cy="94" r="2.4" fill="#0d1a2c"/><circle cx="110" cy="94" r="2.4" fill="#0d1a2c"/><path d="M82 82 l10 -3 M118 82 l-10 -3" stroke="#8fe9ff" stroke-width="2.5" stroke-linecap="round"/></g>
    <g class="f-sleep"><path d="M85 93 q5 5 10 0 M105 93 q5 5 10 0" stroke="#8fe9ff" stroke-width="2.8" fill="none" stroke-linecap="round"/></g>
    <g class="f-happy"><path d="M85 95 q5 -8 10 0 M105 95 q5 -8 10 0" stroke="#8fe9ff" stroke-width="3" fill="none" stroke-linecap="round"/></g>
  </g>
  <g class="g-hat" transform="translate(0,-8)">${HAT[d.hat]}</g>
</svg>`;
}

// ----------------------------------------------------------------------------- the screen
const TEMPLATE = `
<section class="g-card g-setup" hidden>
  <h2 class="g-title" data-k="kGTitle"></h2>
  <p class="g-intro"></p>
  <div class="g-who"><div class="g-prev g-lwrap" data-face="ok"></div><div><div class="g-pname"></div><div class="g-psite"></div></div></div>
  <label class="g-lab" for="g-day" data-k="kGDay"></label>
  <div class="g-dayrow"><input id="g-day" type="date"><button type="button" class="g-btn" id="g-green"></button><button type="button" class="g-btn" id="g-red"></button></div>
  <p class="g-msg" id="g-msg"></p>
  <p class="g-rules"></p>
  <p class="g-lim"></p>
  <div class="g-actions"><button type="button" class="g-btn primary" id="g-start"></button><button type="button" class="g-btn quiet" id="g-close0"></button></div>
</section>
<div class="g-play" hidden>
  <div class="g-clock"><div class="g-dayno"></div><div class="g-date"></div></div>
  <div class="g-side">
    <div class="g-card g-batt" data-lvl="hi">
      <div class="g-h" data-k="kGBatt"></div>
      <div class="g-battrow">
        <div class="g-bwrap"><div class="g-nub"></div><div class="g-body"><div class="g-fill"></div><div class="g-seg"></div>
          <svg class="g-bolt" viewBox="0 0 24 40" aria-hidden="true"><path d="M14 0 L2 22 H11 L8 40 L22 16 H13 Z"/></svg></div></div>
        <div class="g-bnum"><div class="g-big"><b class="g-bh">0</b><span class="g-unit"></span></div><div class="g-bsub" data-k="kGBattLeft"></div><div class="g-bstate"></div></div>
      </div>
    </div>
    <div class="g-card g-sunc" data-on="0">
      <div class="g-h" data-k="kGSunBox"></div>
      <div class="g-srow"><svg class="g-sunicon" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="8"/><path d="M20 3 V9 M20 31 V37 M3 20 H9 M31 20 H37 M8 8 L12 12 M28 28 L32 32 M32 8 L28 12 M12 28 L8 32"/></svg>
        <div><div class="g-state"></div><div class="g-sub"></div></div></div>
    </div>
    <div class="g-card g-radioc" data-on="0">
      <div class="g-h" data-k="kGRadioBox"></div>
      <div class="g-srow"><div class="g-bars"><i></i><i></i><i></i><i></i><i></i></div>
        <div><div class="g-state"></div><div class="g-sub"></div></div></div>
      <div class="g-silbar"><i></i></div>
    </div>
  </div>
  <div class="g-lander"><div class="g-lwrap g-live" data-face="ok"></div><div class="g-name"></div><div class="g-zzz"><i>z</i><i>z</i><i>Z</i></div></div>
  <div class="g-card g-bar">
    <div class="g-ribwrap"><canvas class="g-rib"></canvas></div>
    <div class="g-ctl">
      <button type="button" class="g-btn" id="g-pause"></button>
      <div class="g-segbtn" role="group"><button type="button" data-sp="1">1x</button><button type="button" data-sp="2">2x</button><button type="button" data-sp="4">4x</button></div>
      <button type="button" class="g-btn quiet" id="g-close1"></button>
    </div>
  </div>
</div>
<section class="g-card g-end" hidden>
  <div class="g-confetti"></div>
  <div class="g-verdict"></div>
  <div class="g-endwho"><div class="g-prev g-lwrap" data-face="sleep"></div><div class="g-zzz"><i>z</i><i>z</i><i>Z</i></div></div>
  <div class="g-endname"></div>
  <p class="g-big2"></p>
  <p class="g-why"></p>
  <p class="g-landed"></p>
  <p class="g-checked"></p>
  <div class="g-actions"><button type="button" class="g-btn primary" id="g-again"></button><button type="button" class="g-btn quiet" id="g-close2"></button></div>
</section>`;

const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const days1 = (h) => +(h / 24).toFixed(1);
const lerpAngle = (a, b, f) => a + ((((b - a) % 360) + 540) % 360 - 180) * f;

export function init(kid) {
  const S = kid.S, root = document.documentElement;
  const ov = document.createElement('div');
  ov.id = 'gameov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Keep me alive'); ov.innerHTML = TEMPLATE;
  document.body.appendChild(ov);
  const $ = (q) => ov.querySelector(q), $$ = (q) => [...ov.querySelectorAll(q)];
  const el = { setup: $('.g-setup'), play: $('.g-play'), end: $('.g-end'), live: $('.g-live'), msg: $('#g-msg'), day: $('#g-day'), rib: $('.g-rib'), batt: $('.g-batt'), sunc: $('.g-sunc'), radioc: $('.g-radioc') };
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'kidbtn'; btn.id = 'g-open'; btn.innerHTML = '<span class="g-long"></span><span class="g-short"></span>';
  document.getElementById('sitekid').appendChild(btn);

  const G = { open: false, phase: 'off', day: 0, sim: null, J: null, res: null, lim: null, h: 0, endH: 0, t0: 0, speed: 1, paused: false, disp: 1, hNow: -1, userLook: false, endAt: 0, saved: null, lander: myLander() };

  // ---- what the site screen is showing right now
  const ctx = () => { const e = kid.siteEntry(S.siteId), v = e.variants[S.variant]; return { site: S.site, entry: e, slope: v.slope_deg, evaSlope: S.extra[v.dir] ?? v.slope_deg, W: S.missionDays * 24 }; };
  const i0Of = (site, t) => Math.round((t - site.t0) / HOUR);
  const firstDay = () => Math.ceil(kid.periodStart() / DAY) * DAY;
  const lastDay = () => Math.floor((kid.periodEnd() - S.missionDays * 24 * HOUR) / DAY) * DAY;
  const clampDay = (t) => Math.min(Math.max(Math.floor(t / DAY) * DAY, firstDay()), lastDay());
  const judgeDay = (t) => { const c = ctx(); return judgeAt(c.site, i0Of(c.site, t), c.W, c.slope, c.evaSlope); };
  /** The next landing day after `from` (wrapping round the period) whose verdict is wantOk, or null. Judged by judgeAt. */
  function findDay(wantOk, from) {
    const a = firstDay(), nd = Math.round((lastDay() - a) / DAY) + 1, s0 = Math.round((clampDay(from) - a) / DAY);
    for (let k = 1; k < nd; k++) { const t = a + ((s0 + k) % nd) * DAY; if (judgeDay(t).ok === wantOk) return t; }
    return null;
  }

  // ---- texts
  const set = (node, v) => { if (node._v !== v) { node._v = v; node.textContent = v; } };
  function texts() {
    for (const n of $$('[data-k]')) n.textContent = L(n.dataset.k);
    for (const n of $$('.g-unit')) n.textContent = L('kGUnitH');
    btn.firstChild.textContent = L('kGPlay'); btn.lastChild.textContent = L('kGPlayShort'); btn.title = L('kGPlay');
    $('#g-green').textContent = L('kGGreen'); $('#g-red').textContent = L('kGRed'); $('#g-start').textContent = L('kGStart');
    for (const id of ['#g-close0', '#g-close1', '#g-close2']) $(id).textContent = L('kGClose');
    $('#g-again').textContent = L('kGAgain'); $('.g-segbtn').setAttribute('aria-label', L('kGSpeed'));
    for (const n of $$('.g-state, .g-sub, .g-bstate, .g-date, .g-dayno')) n._v = undefined; // repainted by the next update
    if (G.open) { if (G.phase === 'setup') renderSetup(); else { G.hNow = -1; ui(0, true); } if (G.phase === 'end') renderEnd(); }
  }

  // ---- landers on screen
  function paintLander(host, face) { host.innerHTML = landerSVG(G.lander); host.dataset.face = face; }
  function lookAtSun() { if (!G.userLook) { const s = sample(S.site, S.t); kid.surface.yaw = s.sunAz; } }

  // ---- setup: pick the landing day
  function setDay(t) {
    G.day = clampDay(t); el.day.value = iso(G.day);
    S.t = G.day; S.dirty = true; lookAtSun(); el.msg.textContent = '';
  }
  function renderSetup() {
    const c = ctx(), lim = limitsNow(), b0 = Math.max(Math.min(lim.firstSunH - 1, lim.nightH), 0);
    G.lander = myLander(); paintLander($('.g-setup .g-prev'), 'ok');
    $('.g-intro').textContent = L('kGIntro', { n: c.W / 24 });
    $('.g-pname').textContent = G.lander.name; $('.g-psite').textContent = L('kGSite', { site: I.place(c.entry.name) });
    el.day.min = iso(firstDay()); el.day.max = iso(lastDay()); el.day.value = iso(G.day);
    $('.g-rules').textContent = L('kGRules');
    $('.g-lim').textContent = L('kGLimits', { b: days1(lim.nightH), r: days1(lim.silenceH), f: lim.firstSunH }) + ' ' + L('kGStartCharge', { h: +b0.toFixed(1) });
  }

  // ---- the game itself
  function start() {
    const c = ctx(), i0 = i0Of(c.site, G.day);
    G.lim = limitsNow();
    G.sim = simulate(c.site, i0, c.W, c.slope, G.lim);
    G.J = judgeAt(c.site, i0, c.W, c.slope, c.evaSlope);
    G.res = settle(G.sim, G.J);
    G.t0 = c.site.t0 + i0 * HOUR; G.h = 0; G.endH = G.sim.len; G.paused = false; G.hNow = -1; G.userLook = false;
    G.disp = G.lim.nightH > 0 ? G.sim.b0 / G.lim.nightH : 0;
    G.lander = myLander(); paintLander(el.live, 'ok'); $('.g-name').textContent = G.lander.name;
    el.live.classList.remove('tipped', 'cheer');
    phase('play');
    if (G.sim.reason === 'slope') { phase('ending'); G.endAt = performance.now(); } // tips over at touchdown, nothing to wait for
    ui(0, true); drawRibbon();
    syncButtons();
  }
  function phase(p) {
    G.phase = p;
    el.setup.hidden = p !== 'setup'; el.play.hidden = !(p === 'play' || p === 'ending' || p === 'end'); el.end.hidden = p !== 'end';
    el.play.classList.toggle('ended', p === 'end'); el.play.classList.toggle('tipped', (p === 'ending' || p === 'end') && !!G.sim && G.sim.reason === 'slope');
  }
  const syncButtons = () => {
    $('#g-pause').textContent = L(G.paused ? 'kGResume' : 'kGPause');
    for (const b of $$('.g-segbtn button')) b.classList.toggle('on', +b.dataset.sp === G.speed);
  };

  /** Everything the screen shows for the hour the game clock is in. */
  function ui(dt, force) {
    const sim = G.sim, tr = sim.trace, lim = G.lim, k = Math.min(Math.floor(G.h), sim.len - 1), h = Math.min(G.h, G.endH);
    S.t = G.t0 + h * HOUR; S.dirty = true;
    const sunOn = tr.sun[k] === 1, earthOn = tr.earth[k] === 1, fr = Math.round(tr.frac[k] * 100), batt = tr.batt[k], seen = tr.dark[k] < k + 1; // the Sun has been up since landing
    const frac = lim.nightH > 0 ? batt / lim.nightH : sunOn ? 1 : 0;
    G.disp += (frac - G.disp) * (force ? 1 : 1 - Math.exp(-dt * 7));
    el.batt.style.setProperty('--lvl', Math.max(G.disp, 0.005).toFixed(3));
    el.batt.dataset.lvl = G.disp > 0.5 ? 'hi' : G.disp > 0.25 ? 'mid' : 'low';
    el.batt.classList.toggle('charging', sunOn);
    set($('.g-bh'), String(Math.round(batt)));
    set($('.g-bstate'), sunOn ? L('kGCharging') : !seen ? L('kGWaitSun', { r: Math.max(lim.firstSunH - tr.dark[k], 0) }) : L('kGDraining'));
    el.batt.dataset.st = sunOn ? 'chg' : 'drain';
    el.sunc.dataset.on = sunOn ? '1' : fr > 0 ? 'p' : '0';
    set($('.g-sunc .g-state'), sunOn ? L('kGSunOn') : fr > 0 ? L('kGSunPart', { p: fr }) : L('kGSunOff'));
    set($('.g-sunc .g-sub'), L('kGSunPct', { p: fr }));
    el.radioc.dataset.on = earthOn ? '1' : '0';
    set($('.g-radioc .g-state'), L(earthOn ? 'kGEarthOn' : 'kGEarthOff'));
    set($('.g-radioc .g-sub'), L('kGSilent', { h: tr.silent[k], m: +lim.silenceH.toFixed(1) }));
    const sil = lim.silenceH > 0 ? Math.min(tr.silent[k] / lim.silenceH, 1) : tr.silent[k] > 0 ? 1 : 0;
    el.radioc.style.setProperty('--sil', sil.toFixed(3));
    el.radioc.dataset.sil = sil > 0.75 ? 'hi' : sil > 0.4 ? 'mid' : 'lo';
    const worry = (!sunOn && G.disp < 0.25) || sil > 0.7;
    const lost = G.phase === 'ending' || G.phase === 'end' ? !sim.ok : false;
    const face = G.phase !== 'play' && G.phase !== 'setup' ? (sim.ok ? 'happy' : 'sleep') : worry ? 'worry' : 'ok';
    el.live.dataset.face = face;
    el.live.classList.toggle('sun-on', sunOn); el.live.classList.toggle('earth-on', earthOn);
    el.live.classList.toggle('tipped', lost && sim.reason === 'slope'); el.live.classList.toggle('cheer', G.phase !== 'play' && sim.ok);
    $('.g-lander').classList.toggle('lost', lost);
    if (k !== G.hNow) { // once per game hour: the clock lines and the ribbon
      G.hNow = k;
      const tk = new Date((G.t0 + k * HOUR) * 1000);
      set($('.g-dayno'), L('kGDayOf', { d: Math.floor(k / 24) + 1, n: Math.ceil(sim.N / 24) }));
      set($('.g-date'), I.date(tk, { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + tk.toISOString().slice(11, 13) + ':00 UTC');
      drawRibbon();
    }
  }

  /** The 14 day story: one block per day, 24 hours in each, the Sun on the top row, Earth under it. Hours not yet played stay empty. */
  function drawRibbon() {
    const cv = el.rib, sim = G.sim; if (!sim || el.play.hidden) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const nd = Math.ceil(sim.N / 24), lab = W > 520 ? 48 : 0, gap = (W - lab) / nd >= 14 ? 3 : 1, bw = (W - lab - gap * (nd - 1)) / nd, rowH = Math.max(Math.floor((H - 14) / 2) - 1, 6);
    g.font = '600 10px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
    if (lab) { g.fillStyle = '#ffb547'; g.textAlign = 'left'; g.fillText(L('uSunLabel'), 0, rowH / 2); g.fillStyle = '#5fb4ff'; g.fillText(L('uEarthLabel'), 0, rowH * 1.5 + 1); }
    const tr = sim.trace, k = Math.min(Math.floor(G.h), sim.len - 1);
    for (let d = 0; d < nd; d++) {
      const x0 = lab + d * (bw + gap), cw = bw / 24;
      for (let q = 0; q < 24; q++) {
        const h = d * 24 + q; if (h >= sim.N) break;
        const x = x0 + q * cw, w = Math.max(cw - (cw > 2.2 ? 0.5 : 0), 0.6), played = h <= k && h < sim.len;
        g.fillStyle = !played ? 'rgba(150,170,200,.10)' : tr.sun[h] ? '#ffb547' : 'rgba(10,14,20,.9)'; g.fillRect(x, 0, w, rowH);
        g.fillStyle = !played ? 'rgba(150,170,200,.10)' : tr.earth[h] ? '#5fb4ff' : 'rgba(10,14,20,.9)'; g.fillRect(x, rowH + 1, w, rowH);
      }
      g.strokeStyle = Math.floor(k / 24) === d ? '#fff' : 'rgba(150,170,200,.35)'; g.lineWidth = 1;
      g.strokeRect(x0 + 0.5, 0.5, bw - 1, rowH * 2 + 1);
      if (bw >= 16 || d % 2 === 0) { g.fillStyle = Math.floor(k / 24) === d ? '#fff' : 'rgba(200,210,230,.6)'; g.textAlign = 'center'; g.fillText(String(d + 1), x0 + bw / 2, rowH * 2 + 9); }
    }
    if (G.phase !== 'setup' && k < sim.len) { const x = lab + Math.floor(k / 24) * (bw + gap) + ((k % 24) + 0.5) * (bw / 24); g.fillStyle = '#fff'; g.fillRect(x - 1, 0, 2, rowH * 2 + 1); }
  }

  // ---- the end
  function reasonText() {
    const sim = G.sim, res = G.res, lim = G.lim, row = (id) => G.J.rows.find((r) => r.id === id), r = res.reason, same = res.agree && sim.reason === r;
    if (r === 'night') return L('kGLostNight', { d: days1(same ? sim.run : row('night').v), n: days1(lim.nightH) });
    if (r === 'radio') return L('kGLostRadio', { d: days1(same ? sim.run : row('radio').v), n: days1(lim.silenceH) });
    if (r === 'light') { const w = same ? sim.wait : row('light').v; return Number.isFinite(w) ? L('kGLostLight', { h: w, n: lim.firstSunH }) : L('kGLostLightNever', { n: lim.firstSunH }); }
    return L('kGLostSlope', { s: sim.slope.toFixed(1), n: lim.slopeLimit });
  }
  function renderEnd() {
    const res = G.res, sim = G.sim, n = Math.ceil(sim.N / 24);
    el.end.dataset.ok = res.ok ? '1' : '0';
    $('.g-verdict').textContent = L(res.ok ? 'mPass' : 'mFail');
    paintLander($('.g-end .g-prev'), res.ok ? 'happy' : 'sleep');
    $('.g-end .g-prev').classList.toggle('tipped', !res.ok && res.reason === 'slope'); $('.g-end .g-prev').classList.toggle('cheer', res.ok);
    $('.g-endname').textContent = G.lander.name;
    $('.g-big2').textContent = res.ok ? L('kGWon', { n }) : reasonText();
    $('.g-why').textContent = res.ok ? L('kGWonWhy') : (res.reason === 'slope' ? '' : L('kGLostWhen', { d: Math.floor(sim.hour / 24) + 1, h: (sim.hour % 24) + 1 }));
    $('.g-landed').textContent = L('kGLandedOn', { date: I.date(new Date(G.day * 1000), { day: 'numeric', month: 'long', year: 'numeric' }) });
    $('.g-checked').textContent = L('kGChecked');
    const cf = $('.g-confetti'); cf.textContent = '';
    if (res.ok) for (let q = 0; q < 34; q++) { const i = document.createElement('i'); i.style.cssText = `--x:${(q * 29) % 100}%;--d:${(q % 7) * 0.18}s;--c:${['#ffb547', '#5fb4ff', '#5fd38d', '#ff6b9a', '#f7f4ea'][q % 5]};--r:${(q * 47) % 360}deg`; cf.appendChild(i); }
  }
  function showEnd() { phase('end'); renderEnd(); }

  // ---- open and close
  function open() {
    if (G.open || S.mode !== 'surface' || !S.site) return;
    G.open = true; G.saved = { t: S.t, yaw: kid.surface.yaw, pitch: kid.surface.pitch };
    S.playing = false; G.userLook = false;
    G.day = clampDay(S.missionStart);
    root.classList.add('game-on'); btn.classList.add('on');
    phase('setup'); renderSetup(); setDay(G.day); syncButtons(); texts();
  }
  function close() {
    if (!G.open) return;
    G.open = false; G.phase = 'off';
    root.classList.remove('game-on', 'g-ending'); btn.classList.remove('on');
    if (G.saved) { S.t = G.saved.t; kid.surface.yaw = G.saved.yaw; kid.surface.pitch = G.saved.pitch; S.dirty = true; }
  }
  btn.onclick = () => (G.open ? close() : open());
  for (const id of ['#g-close0', '#g-close1', '#g-close2']) $(id).onclick = close;
  $('#g-start').onclick = start;
  $('#g-again').onclick = () => { phase('setup'); renderSetup(); setDay(G.day); G.userLook = false; };
  $('#g-pause').onclick = () => { if (G.phase === 'play') { G.paused = !G.paused; syncButtons(); } };
  for (const b of $$('.g-segbtn button')) b.onclick = () => { G.speed = +b.dataset.sp; syncButtons(); };
  el.day.onchange = () => { const t = Date.parse(el.day.value + 'T00:00:00Z') / 1000; if (Number.isFinite(t)) setDay(t); else el.day.value = iso(G.day); };
  $('#g-green').onclick = () => { const t = findDay(true, G.day); if (t == null) el.msg.textContent = L('kGGreenNone'); else setDay(t); };
  $('#g-red').onclick = () => { const t = findDay(false, G.day); if (t == null) el.msg.textContent = L('kGRedNone'); else setDay(t); };
  document.getElementById('gl').addEventListener('pointerdown', () => { if (G.open) G.userLook = true; }); // the kid looks around: stop following the Sun
  window.addEventListener('keydown', (e) => { // before the app's own keys: space pauses the game, not the 3D clock
    if (!G.open || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); $('#g-pause').click(); }
  }, true);
  window.addEventListener('resize', () => drawRibbon());

  kid.mode.push((m) => { if (m !== 'surface') close(); });
  kid.lang.push(texts);
  kid.frame.push((now, dt) => {
    if (!G.open) return;
    S.playing = false; // the game owns the clock of the 3D sky
    if (G.phase === 'play' && !G.paused) {
      G.h = Math.min(G.h + dt * (G.sim.N / STAY_SECONDS) * G.speed, G.endH);
      if (G.h >= G.endH) { G.phase = 'ending'; G.endAt = now; phase('ending'); }
    }
    if (G.phase === 'play' || G.phase === 'ending') {
      if (G.phase === 'ending') G.h = G.endH;
      ui(dt, false);
      if (!G.userLook) kid.surface.yaw = lerpAngle(kid.surface.yaw, sample(S.site, S.t).sunAz, 1 - Math.exp(-dt * 3));
      if (G.phase === 'ending' && now - G.endAt > 1500) showEnd();
    }
  });

  texts();
  window.__game = { simulate, settle, limits: limitsNow, findDay, judgeDay, open, close, start, setDay, myLander, get state() { return G; } };
}
