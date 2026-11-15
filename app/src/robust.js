// Solid or borderline verdict: one line under the checks of the answer panel that says how much to trust the answer.
// Four more judgments with the team's own rules (app/mission.js, through ctx.judgeAt), each differing from the shown one in one thing:
//   landing one day earlier and one day later (ctx.at), and the horizon of the terrain 0.2 degrees higher and 0.2 degrees lower
//   for the whole stay. The 0.2 degrees is the team's own test value, not a NASA figure.
// The terrain tests are real: data.js#computeChannels keeps, for every hour, the azimuth, elevation and radius of the Sun, the
// azimuth and elevation of Earth, and the site keeps its horizon mask (meta.mask). So "Sun at least half above the horizon" and
// "Earth above the horizon" are recomputed for each hour of the stay only (a few hundred hours) with the same functions
// (science.js#sunFraction, #maskLookup) on a mask moved by the shift. Nothing is guessed from margins.
// A verdict is borderline when any of the four gives the other answer; the line names the ones that do.
import { sunFraction, maskLookup } from './science.js';

const DAY = 86400, DEG = 0.2;
const T = (k, v) => globalThis.I18n.t(k, v);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

/** The verdict of the stay when the horizon mask is moved up by `shift` degrees (negative: down), or null when the site
 *  holds no horizon or no hourly directions. Only the hours of the stay are recomputed. */
export function judgeWithHorizon(ctx, shift) {
  const { site, t, W } = ctx, { ch, meta } = site, m = meta && meta.mask;
  if (!m || !ch.sunAz || !ch.sunR || !ch.earthAz || !ch.earthEl) return null;
  const i0 = Math.round((t - site.t0) / 3600), n = Math.min(W, site.n - i0);
  if (!(i0 >= 0) || !(n >= 1)) return null;
  const mask = Array.from(m.el_deg, (v) => v + shift), step = m.az_step_deg, sunFrac = new Float32Array(n), earthVis = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const i = i0 + k;
    sunFrac[k] = sunFraction(ch.sunAz[i], ch.sunEl[i], ch.sunR[i], mask, step);
    earthVis[k] = ch.earthEl[i] > maskLookup(mask, step, ch.earthAz[i]) ? 1 : 0;
  }
  // The stay as a small site of its own: hour 0 is the landing, so judgeAt reads exactly these hours.
  return ctx.judgeAt({ n, ch: { sunFrac, earthVis, sunEl: ch.sunEl.subarray(i0, i0 + n) }, meta }, 0, n, ctx.slope, ctx.evaSlope);
}

/** The four tests for the chosen day. e: the shown verdict { rows, ok }. */
export function assess(ctx, e) {
  const t0 = performance.now(), last = ctx.p1 - ctx.W * 3600;
  const day = (ts) => { if (ts < ctx.p0 || ts > last) return null; const x = ctx.at(ts); return { ok: x.ok, flips: x.ok !== e.ok }; };
  const terrain = (shift) => { const x = judgeWithHorizon(ctx, shift); return x && { ok: x.ok, flips: x.ok !== e.ok }; };
  const tests = { earlier: day(ctx.t - DAY), later: day(ctx.t + DAY), high: terrain(DEG), low: terrain(-DEG) };
  const bad = Object.keys(tests).filter((k) => tests[k] && tests[k].flips);
  const row = (id) => e.rows.find((r) => r.id === id), M = globalThis.Mission.limits;
  return { tests, bad, borderline: bad.length > 0, terrainOk: !!(tests.high && tests.low), ms: performance.now() - t0,
    margins: { nightH: row('night').v, nightLimitH: M.nightH, radioH: row('radio').v, radioLimitH: M.silenceH } };
}

/** The words of the line for an assessment: { word, text, tip }. */
export function words(a, e) {
  const { tests, bad } = a, has = (k) => bad.includes(k), tested = (k) => !!tests[k];
  // The conditions, merged in pairs: "one day earlier or later", "with the terrain 0.2° higher or lower".
  const pair = (x, y, both, one, other, set) => (set.includes(x) && set.includes(y) ? T(both) : set.includes(x) ? T(one) : set.includes(y) ? T(other) : '');
  let text;
  if (a.borderline) {
    const c = [pair('earlier', 'later', 'xRcDays', 'xRcEarlier', 'xRcLater', bad), pair('high', 'low', 'xRcTerrain', 'xRcHigh', 'xRcLow', bad)].filter(Boolean);
    text = T('xRBorder', { c: c.join(T('xRSep')), r: T(e.ok ? 'xRLost' : 'xRLives') });
  } else {
    const ok = ['earlier', 'later', 'high', 'low'].filter(tested), d = pair('earlier', 'later', 'xRcDays', 'xRcEarlier', 'xRcLater', ok);
    text = d ? T('xRSolid', { d }) : T('xRSolidT');
  }
  const m = a.margins, edge = !tested('earlier') || !tested('later');
  const tip = [T('xRTip'), T('xRMarginTip', { a: m.nightH, b: m.nightLimitH, c: m.radioH, d: m.radioLimitH }), edge ? T('xREdgeTip') : ''].filter(Boolean).join(' ');
  return { word: T(a.borderline ? 'xRBorderW' : 'xRSolidW'), text, tip };
}

(globalThis.VerdictExtras ||= []).push((box, ctx, e) => {
  const a = assess(ctx, e);
  if (!a.terrainOk) { globalThis.__robust = { date: iso(ctx.t), ok: e.ok, unavailable: true }; return; } // no horizon data: say nothing rather than guess
  const w = words(a, e), state = a.borderline ? 'borderline' : 'solid';
  const line = document.createElement('div');
  line.className = 'rb ' + state; line.id = 'rb-line'; line.setAttribute('role', 'note');
  // A solid mark against a hollow mark, the same size, plus the word: the state never rests on colour or size.
  line.innerHTML = `<span class="tip rb-word" tabindex="0" data-tip="${esc(w.tip)}"><i class="rb-mark" aria-hidden="true"></i><b>${esc(w.word)}</b></span><span class="rb-colon">:</span> <span class="rb-text">${esc(w.text)}</span>`;
  box.appendChild(line);
  // Go, not sure, do not go: the same four re-checks as one of three answers, shown right under the verdict sentence.
  // GO: it survives and every re-check agrees. DON'T GO: it is lost and every re-check agrees. NOT SURE: some re-check
  // gives the other answer; its rate is the share of re-checks that disagree (25, 50, 75 or 100% with four re-checks),
  // drawn from yellow (low) to deep orange (high). The word and the percent carry the state, the colour only repeats it.
  const done = Object.values(a.tests).filter(Boolean).length, n = a.bad.length, rate = Math.round(100 * n / done);
  const kind = n ? 'unsure' : e.ok ? 'go' : 'nogo', top = box.parentElement, g = document.createElement('div');
  g.id = 'gng'; g.className = 'gng ' + kind; g.setAttribute('role', 'note'); if (n) g.style.setProperty('--f', String((rate - 25) / 75));
  g.innerHTML = `<span class="tip gng-word" tabindex="0" data-tip="${esc(T('xGTip'))}"><b>${esc(T(n ? 'xGUnsure' : e.ok ? 'xGGo' : 'xGNo'))}${n ? ' ' + rate + '%' : ''}</b></span><span class="gng-why">${esc(n ? T('xGSome', { n, m: done }) : T('xGAll', { m: done }))}</span>`;
  const old = top.querySelector('#gng'); if (old) old.remove();
  top.insertBefore(g, top.querySelector('.v-date') || box);
  // The same re-checks for every day of the calendar strip: a day whose answer some re-check overturns is drawn yellow
  // (one of four) to deep orange (all four) instead of green or red. Done in small batches so a click never waits.
  const run = (globalThis.__gngRun = (globalThis.__gngRun || 0) + 1), btns = [...top.querySelectorAll('.days .day')], lastT = ctx.p1 - ctx.W * 3600;
  const key = top.querySelector('.v-key'); if (key && !key.querySelector('.uns')) key.insertAdjacentHTML('beforeend', ` <i class="uns"></i>${esc(T('xGUnsure'))}`);
  const paint = (i) => { if (run !== globalThis.__gngRun) return;
    for (const end = Math.min(btns.length, i + 12); i < end; i++) { const b = btns[i], ts = +b.dataset.t, ok = b.classList.contains('ok');
      const r = [ts - DAY, ts + DAY].map((x) => (x < ctx.p0 || x > lastT ? null : ctx.at(x).ok)).concat([DEG, -DEG].map((s) => { const x = judgeWithHorizon({ ...ctx, t: ts }, s); return x ? x.ok : null; })).filter((x) => x !== null);
      const f = r.filter((x) => x !== ok).length; if (!f) continue; const pc = Math.round(100 * f / r.length);
      b.classList.add('unsure'); b.style.setProperty('--f', String((pc - 25) / 75)); b.title += ` · ${T('xGUnsure')} ${pc}%`; b.setAttribute('aria-label', b.title); }
    if (i < btns.length) setTimeout(() => paint(i), 0); else if (globalThis.__robust) globalThis.__robust.strip = btns.filter((b) => b.classList.contains('unsure')).length; };
  setTimeout(() => paint(0), 0);
  const flips = {}; for (const k in a.tests) flips[k] = a.tests[k] ? a.tests[k].flips : null; // null: not tested
  globalThis.__robust = { date: iso(ctx.t), ok: e.ok, state, borderline: a.borderline, answer: kind, rate, flips, oks: Object.fromEntries(Object.entries(a.tests).map(([k, v]) => [k, v ? v.ok : null])),
    bad: a.bad, terrainDeg: DEG, margins: a.margins, ms: a.ms, word: w.word, text: w.text, tip: w.tip };
});
