// The answer panel of the surface view: does a solar robot survive a landing on this day, every check behind the
// verdict, which landing days work, and the date controls. Rules and texts are the team's (app/mission.js, app/i18n.js).
const I = globalThis.I18n, Mi = globalThis.Mission, L = (k, v) => I.t(k, v);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const DAY = 86400;

/** Mission.judge rows for a landing at hour index i0 lasting W hours. "Sun up" = at least half the disc, as in the planner. */
export function judgeAt(site, i0, W, slope, evaSlope) {
  const { ch, n } = site, i1 = Math.min(n, i0 + W), N = Math.max(i1 - i0, 1);
  let lit = 0, earth = 0, both = 0, dark = 0, gap = 0, maxDark = 0, maxGap = 0, sunMax = -90, windows = 0, wait = Infinity, prevE = false;
  for (let i = i0; i < i1; i++) {
    const s = ch.sunFrac[i] >= 0.5, e = ch.earthVis[i] > 0.5;
    lit += s; earth += e; both += s && e;
    dark = s ? 0 : dark + 1; gap = e ? 0 : gap + 1;
    if (dark > maxDark) maxDark = dark; if (gap > maxGap) maxGap = gap;
    if (ch.sunEl[i] > sunMax) sunMax = ch.sunEl[i];
    if (e && !prevE) windows++; prevE = e;
    if (s && wait === Infinity) wait = i - i0;
  }
  const m = { longestDarkH: maxDark, longestBlackoutH: maxGap, sunPct: 100 * lit / N, earthPct: 100 * earth / N, bothPct: 100 * both / N, sunElMax: sunMax, commWindows: { length: windows } };
  const rows = Mi.judge({ m, waitH: wait, slope, evaSlope, lat: site.meta.lat });
  return { rows, ok: rows.every((r) => r.pri !== 'must' || r.ok) };
}

function cells(r) {
  const pct = (v) => L('vOfStay', { p: v.toFixed(0) }), deg = (v) => v.toFixed(1) + '°', d = (h) => L('vDays', { t: (h / 24).toFixed(1) });
  const value = { night: d, radio: d, light: (h) => (!h ? L('vUp') : h < Infinity ? L('vAfter', { t: h.toFixed(0) }) : L('vNone')), slope: deg, eva: deg, pole: deg,
    sunPct: pct, earthPct: pct, bothPct: pct, sunMax: deg, windows: (v) => v }[r.id](r.v);
  const days = { night: Mi.limits.nightH / 24, radio: Mi.limits.silenceH / 24 }[r.id];
  return [value, r.pri === 'info' ? '' : L('l' + cap(r.id), { n: +(days ?? 0).toFixed(1) })];
}
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const longDate = (t) => new Date(t * 1000).toLocaleDateString(I.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** What the model says at a real mission's touchdown: is the Sun up, when it rose and when it sets, is Earth in view.
 *  site: a loaded site; landedT: unix s. Hours come from the same series the verdict uses. */
export function modelAt(site, landedT) {
  const { ch, n, t0 } = site, i = Math.min(Math.max(Math.round((landedT - t0) / 3600), 0), n - 1), lit = (k) => ch.sunFrac[k] > 0, MAX = 24 * 30;
  let a = i, b = i, earthEver = false;
  if (lit(i)) { while (a > 0 && i - a < MAX && lit(a - 1)) a--; while (b < n - 1 && b - i < MAX && lit(b)) b++; }
  for (let k = Math.max(i - MAX, 0); k < Math.min(i + MAX, n); k++) if (ch.earthVis[k] > 0.5) { earthEver = true; break; }
  return { lit: lit(i), sunEl: ch.sunEl[i], rise: lit(i) && i - a < MAX ? t0 + a * 3600 : null, set: lit(i) && b - i < MAX ? t0 + b * 3600 : null,
    earth: ch.earthVis[i] > 0.5, earthEver };
}
const hourUTC = (t) => new Date(t * 1000).toLocaleDateString(I.lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) + ', ' + new Date(t * 1000).toISOString().slice(11, 16) + ' UTC';
/** The real mission next to the model: facts with sources (i18n), then the model's numbers for the real touchdown. */
function historyBox(site, h, t) {
  const lt = Date.parse(h.landed) / 1000, m = modelAt(site, lt), day = Math.floor(lt / DAY) * DAY;
  const sun = m.lit ? L('hSunUp', { el: m.sunEl.toFixed(1) }) + (m.rise ? ' ' + L('hRise', { d: hourUTC(m.rise) }) : '') + (m.set ? ' ' + L('hSet', { d: hourUTC(m.set) }) : '') : L('hSunDown');
  globalThis.__history = { key: h.key, ...m, onDay: day === t };
  return `<div class="v-hist"><b>${L('hTitle')}</b><p>${L('h' + h.key)}</p><p class="v-model"><em>${L('hModelAt')}</em> ${sun} ${L(m.earth ? 'hEarthIn' : m.earthEver ? 'hEarthOut' : 'hEarthNever')}</p>` +
    (day === t ? '' : `<button data-t="${day}">${L('hGo', { date: longDate(day) })}</button>`) + '</div>';
}

/** ctx: { site, slope, evaSlope, t (landing, unix s), days, p0, p1 (period, unix s), setDate(t), history (custom.js#historyOf) } */
export function renderVerdict(el, ctx) {
  const { site, slope, evaSlope, days } = ctx, W = Math.round(days * 24), t = Math.floor(ctx.t / DAY) * DAY;
  const at = (ts) => judgeAt(site, Math.round((ts - site.t0) / 3600), W, slope, evaSlope);
  const e = at(t), bad = e.rows.filter((r) => r.ok === false && r.pri === 'must').map((r) => r.id);
  const why = e.ok ? 'mWhyOk' : bad.includes('night') && bad.includes('radio') ? 'mWhyBoth' : bad.includes('night') ? 'mWhyPower' : bad.includes('radio') ? 'mWhyRadio' : bad.includes('light') ? 'mWhyLight' : 'mWhySlope';
  // Landing days: the next 120 days from the chosen one, green survives, red is lost.
  const last = Math.min(119, Math.floor((ctx.p1 - days * DAY - t) / DAY)), strip = [];
  let good = 0, next = -1, until = -1;
  for (let d = 0; d <= last; d++) {
    const ts = t + d * DAY, x = at(ts), date = new Date(ts * 1000), badRow = x.rows.find((r) => r.ok === false && r.pri === 'must');
    const label = longDate(ts) + ': ' + (x.ok ? L('mOkShort') : L('mLostShort') + ' (' + L('r' + cap(badRow.id)) + ')');
    good += x.ok; if (d > 0 && x.ok && next < 0) next = d; if (!x.ok && until < 0) until = d;
    strip.push(`<button class="day ${x.ok ? 'ok' : 'bad'}${d === 0 ? ' now' : ''}" data-t="${ts}" title="${label}" aria-label="${label}">${(date.getUTCDate() === 1 && d > 15) || d === 0 ? `<i>${date.toLocaleDateString(I.lang, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</i>` : ''}</button>`);
  }
  const sum = e.ok ? (until < 0 ? L('calAllOk') : L('calUntil', { date: longDate(t + (until - 1) * DAY) })) : next < 0 ? L('calNone') : L('calNext', { date: longDate(t + next * DAY) });
  const shift = (dd, mm) => { const d = new Date(t * 1000); d.setUTCDate(d.getUTCDate() + dd); d.setUTCMonth(d.getUTCMonth() + mm); return d.getTime() / 1000; };
  const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
  el.className = 'verdict ' + (e.ok ? 'ok' : 'bad');
  el.innerHTML =
    `<div class="v-head"><b>${L(e.ok ? 'mPass' : 'mFail')}</b><span>${L('vLanding', { date: longDate(t), n: days })}</span></div>` +
    `<p class="v-why">${L(why)}</p>` +
    (ctx.history ? historyBox(site, ctx.history, t) : '') +
    `<div class="v-date"><button data-t="${shift(-1, 0)}" title="${L('m5Prev')}">◀</button><input id="v-day" type="date" min="${iso(ctx.p0)}" max="${iso(ctx.p1 - days * DAY)}" value="${iso(t)}" aria-label="${L('m5Title')}"><button data-t="${shift(1, 0)}" title="${L('m5Next')}">▶</button>` +
    `<button data-t="${shift(0, -12)}">−1 ${L('vYear')}</button><button data-t="${shift(0, -1)}">−1 ${L('vMonth')}</button><button data-t="${shift(0, 1)}">+1 ${L('vMonth')}</button><button data-t="${shift(0, 12)}">+1 ${L('vYear')}</button><button data-t="${today}">${L('m5Today')}</button></div>` +
    `<div class="v-count"><b>${good}</b><span>/ ${last + 1}</span><em>${L('calSum', { n: good, m: last + 1 })} ${sum}</em></div><div class="days">${strip.join('')}</div>` +
    `<p class="v-key"><i class="ok"></i>${L('mOkShort')} <i class="bad"></i>${L('mLostShort')} <i class="cur"></i>${L('calNow')}</p>` +
    `<table class="v-rows">${e.rows.map((r) => { const [v, lim] = cells(r);
      return `<tr class="${r.pri} ${r.ok === false ? 'fail' : ''}"><td><span class="tip" tabindex="0" data-tip="${lim ? L('colLimit') + ': ' + lim + '. ' : ''}${L('r' + cap(r.id) + 'Tip')}">${L('r' + cap(r.id))}</span></td><td>${v}</td><td>${r.ok === undefined ? '' : r.ok ? '✔' : '✘'}</td></tr>`; }).join('')}</table>` +
    `<p class="v-note"><span class="tip" tabindex="0" data-tip="${L('mNote')} ${L('m5Note')}">ⓘ</span> ${L('vHint')}</p>`;
  const clamp = (x) => Math.min(Math.max(x, ctx.p0), ctx.p1 - days * DAY);
  for (const b of el.querySelectorAll('[data-t]')) b.onclick = () => ctx.setDate(clamp(+b.dataset.t));
  el.querySelector('#v-day').onchange = (ev) => { const x = Date.parse(ev.target.value + 'T00:00:00Z') / 1000; if (Number.isFinite(x)) ctx.setDate(clamp(x)); };
  globalThis.__verdict = { date: iso(t), ok: e.ok, rows: e.rows, days: last + 1, good };
}
