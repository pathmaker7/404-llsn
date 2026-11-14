// Quiz mode for students: 5 questions per round from a pool of exactly 25, four options each, one right.
// Fifteen questions are static (the facts come from the app and its docs, each named below). Ten are LIVE: when asked they
// take a real prepared site and a real day from the app and get their answer from verdict.js#judgeAt, the same rule the
// grid uses, so the right option is always what the grid shows.
// kid: the slots main.js hands every kids feature (see main.js, "kids features").
import { loadSky } from './data.js';
import { judgeAt } from './verdict.js';

const I = globalThis.I18n, Mi = globalThis.Mission, L = (k, v) => I.t(k, v);
const STAY_H = 14 * 24, ROUND = 5, DAY = 86400;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rnd = (n) => Math.floor(Math.random() * n), pick = (a) => a[rnd(a.length)];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ------------------------------------------------------------------ the pool
// Static questions: texts are kQNNq / kQNNa1..a4 / kQNNe1..e4 in i18n-quiz.js (a1 is right). Where each fact comes from:
const STATIC = [
  ['kQ01', 'README.md "The eleven checks"; i18n.js aTip and mOkShort: green means the four must-pass checks hold for 14 days, hollow is lost'],
  ['kQ02', 'NASA Moon fact sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html): obliquity to orbit 6.68 degrees; docs/VIDEO-SCRIPT.md (libration); model: Earth in view 54% of 2027 at Peak near Shackleton, windows of about 15 days (checked in tools/test-quiz.cjs)'],
  ['kQ03', 'docs/VIDEO-SCRIPT.md "What the two cycles are"; model: night check fails 14 to 21 days a month Feb to Jul 2027 at Peak near Shackleton, no green day in Jun and Jul 2027 (checked in tools/test-quiz.cjs)'],
  ['kQ04', 'NASA Moon fact sheet: synodic period 29.53 days, 12 x 29.53 = 354; docs/VIDEO-SCRIPT.md and explainer/deck.html: strongest repeat at 354 days for 9 of 10 sites (autocorrelation re-checked in tools/test-quiz.cjs); Orozo comes about 11 days earlier each year'],
  ['kQ05', 'app/i18n.js rPoleTip (Artemis III, within 6 degrees of the pole, water ice); model: Sun up about 85% of 2027 at Peak near Shackleton and longest night about 14.7 days at the Apollo 11 site on a smooth Moon (both checked in tools/test-quiz.cjs)'],
  ['kQ06', 'app/src/main.js renderAbout (Sun never more than about two degrees above a flat horizon); model: highest Sun 1.8 to 2.9 degrees at the six sites nearest the pole in 2027 (checked); main.js renderValidation: Sun disc radius 0.27 degrees, horizon ray every 0.25 degrees'],
  ['kQ07', 'app/mission.js NIGHT_LIMIT_H and README.md (team teaching value); app/i18n.js aLimitsTip and docs/SUBMISSION.md: NASA VIPER cannot endure more than 50 hours of continuous darkness (science.nasa.gov/mission/viper/lunar-operations, fetched 15 Nov 2026)'],
  ['kQ08', 'app/mission.js SILENCE_LIMIT_H; app/i18n.js rRadioTip; Earth-Moon distance 384,400 km (NASA Moon fact sheet) over the speed of light is 1.3 s'],
  ['kQ09', 'app/i18n.js hCh3 and docs/SUBMISSION.md: ISRO as reported by spacepolicyonline.com/news/india-says-good-night-to-chandrayaan-3/ (fetched 15 Nov 2026); model sunset 4 Sep 2023 is asserted in tools/test.cjs'],
  ['kQ10', 'app/i18n.js hIm2; spacepolicyonline.com/news/im-2-mission-ends-one-day-after-lunar-landing/ (fetched 15 Nov 2026: on its side in a crater 250 m from its intended spot); lroc.im-ldi.com/images/1408'],
  ['kQ11', 'science.nasa.gov/mission/lcross (fetched 15 Nov 2026: LCROSS was to confirm water ice in a permanently shadowed crater, Cabeus); model: no Sun hour at Shackleton floor or Faustini floor in 2021 to 2031 (checked)'],
  ['kQ12', 'README.md "How we know it is right" and app/ATTRIBUTION.md; science.nasa.gov/mission/lro (LOLA, the Lunar Orbiter Laser Altimeter, measures the Moon elevation profile, fetched 15 Nov 2026); Horizons 0.0047 degrees from docs/SUBMISSION.md'],
  ['kQ13', 'README.md "Your own mission" and docs/SUBMISSION.md "Limits we state"; app/src/custom.js (coarse terrain within about 235 km of the pole, 320 m)'],
  ['kQ14', 'docs/SUBMISSION.md item 6 and app/src/allsites.js slip(): the line answers which sites survive a landing N days from today, or the next good day'],
  ['kQ15', 'app/i18n.js hCe6; README.md (Chang\'e 6: Earth never rises, relay satellite); spacepolicyonline.com/news/china-lands-sample-return-probe-on-the-far-side-of-the-moon/'],
];
const LIVE_IDS = ['kQ16', 'kQ17', 'kQ18', 'kQ19', 'kQ20', 'kQ21', 'kQ22', 'kQ23', 'kQ24', 'kQ25'];
const POOL = [...STATIC.map(([id, src]) => ({ id, live: false, src })), ...LIVE_IDS.map((id) => ({ id, live: true }))];

// ----------------------------------------------------- text variables, resolved when drawn (so a language change re-draws)
// A variable is a plain value, { iso } a date, { place } a site name, { num, d } a decimal, or { k, v } another text.
const dec = (x, d = 1) => { const s = (+x).toFixed(d).replace(/\.0+$/, ''); return I.lang === 'en' ? s : s.replace('.', ','); }; // 2 not 2.0
const longDate = (iso) => I.date(new Date(iso + 'T00:00:00Z'), { day: 'numeric', month: 'long', year: 'numeric' });
function R(v) {
  if (v && typeof v === 'object') {
    if (v.iso) return longDate(v.iso);
    if (v.place != null) return I.place(v.place);
    if (v.num != null) return dec(v.num, v.d ?? 1);
    if (v.k) return L(v.k, rv(v.v));
  }
  return v;
}
const rv = (vars) => (vars ? Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, R(v)])) : undefined);

// --------------------------------------------------------------- live questions
let K = null; // kid
const prepared = () => K.S.index.sites.filter((s) => !s.custom).map((s) => {
  const v = s.variants.best || s.variants.databook; // the same point the grid judges (main.js buildSiteList)
  return { id: s.id, name: s.name, dir: v.dir, slope: v.slope_deg, evaSlope: K.S.extra[v.dir] ?? v.slope_deg };
});
const P0 = Date.parse('2022-01-01T00:00:00Z') / 1000 / DAY, P1 = Date.parse('2030-11-30T00:00:00Z') / 1000 / DAY; // in days since 1970
const isoOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const randDate = () => isoOf((P0 + rnd(P1 - P0)) * DAY);
const addDays = (iso, n) => isoOf(Date.parse(iso + 'T00:00:00Z') / 1000 + n * DAY);
/** The verdict rows for landing at the site on a day (what the grid cell and the site panel are made from). */
async function verdictAt(sp, iso) {
  const sky = await loadSky(sp.dir);
  return judgeAt(sky, Math.round((Date.parse(iso + 'T00:00:00Z') / 1000 - sky.t0) / 3600), STAY_H, sp.slope, sp.evaSlope);
}
const row = (x, id) => x.rows.find((r) => r.id === id);
const failed = (x) => x.rows.filter((r) => r.pri === 'must' && r.ok === false).map((r) => r.id);
const res = (ok) => ({ k: ok ? 'kQpass' : 'kQfail' });
const sunVar = (h) => (h === 0 ? { k: 'vUp' } : h < Infinity ? { k: 'vAfter', v: { t: h.toFixed(0) } } : { k: 'vNone' });
const nd = (h) => ({ num: h / 24, d: 1 });
// The shared lines that quote the verdict rows (the numbers a child can find in the answer panel).
const f = {
  all: (x) => ({ eKey: 'kQfAll', eVars: { verdict: { k: x.ok ? 'mOkShort' : 'mLostShort' }, night: nd(row(x, 'night').v), nl: nd(Mi.limits.nightH), radio: nd(row(x, 'radio').v), rl: nd(Mi.limits.silenceH), sun: sunVar(row(x, 'light').v) } }),
  night: (x) => ({ eKey: 'kQfNight', eVars: { night: nd(row(x, 'night').v), nl: nd(Mi.limits.nightH), res: res(row(x, 'night').ok) } }),
  radio: (x) => ({ eKey: 'kQfRadio', eVars: { radio: nd(row(x, 'radio').v), rl: nd(Mi.limits.silenceH), res: res(row(x, 'radio').ok) } }),
  light: (x) => ({ eKey: 'kQfSun', eVars: { sun: sunVar(row(x, 'light').v), res: res(row(x, 'light').ok) } }),
  slope: (x) => ({ eKey: 'kQfSlope', eVars: { slope: { num: row(x, 'slope').v, d: 1 }, res: res(row(x, 'slope').ok) } }),
};
const lineOf = { night: f.night, radio: f.radio, light: f.light, slope: f.slope };
/** A site's line: green with its numbers, or lost with the first failed check. */
const siteLine = (sp, x) => {
  const first = failed(x)[0];
  if (!first) return { eKey: 'kQfWin', eVars: { site: { place: sp.name }, ...f.all(x).eVars } };
  const w = lineOf[first](x);
  return { eKey: 'kQfLose', eVars: { site: { place: sp.name }, why: { k: w.eKey, v: w.eVars } } };
};

/** Four options at random places. opts: [{ val, aKey|name|n, aVars, eKey, eVars, correct }] */
function build(id, kind, qVars, opts, meta) {
  return { id, live: true, kind, qKey: id + 'q', qVars, options: shuffle(opts), meta };
}
const gap3 = (c, taken) => (v) => Math.abs(v - c) >= 3 && taken.every((t) => Math.abs(v - t) >= 3);
/** Three wrong numbers from lo..hi, each at least 3 away from the right one and from each other. */
function decoys(c, lo, hi) {
  const out = [];
  for (const v of shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i))) if (gap3(c, out)(v)) { out.push(v); if (out.length === 3) return out; }
  return null;
}

const LIVE = {
  // 16: survive 14 days? yes, battery, radio or no sunrise (exactly one failed check, or none)
  async kQ16() {
    const sp = prepared(), want = pick(['yes', 'night', 'radio', 'light']);
    let any = null;
    for (let i = 0; i < 500; i++) {
      const s = pick(sp), date = randDate(), x = await verdictAt(s, date), fl = failed(x);
      const val = fl.length === 0 ? 'yes' : fl.length === 1 && fl[0] !== 'slope' ? fl[0] : null;
      if (!val) continue;
      if (val === want) { any = { s, date, x, val }; break; }
      any ??= { s, date, x, val };
    }
    if (!any) return null;
    const { s, date, x, val } = any, ls = [f.all(x), f.night(x), f.radio(x), f.light(x)];
    return build('kQ16', 'survive', { site: { place: s.name }, date: { iso: date } },
      ['yes', 'night', 'radio', 'light'].map((v, i) => ({ val: v, aKey: 'kQ16a' + (i + 1), ...ls[i], correct: v === val })), { siteId: s.id, date, val });
  },
  // 17: a lost day with exactly one failed check: which one?
  async kQ17() {
    const sp = prepared(), want = pick(['night', 'radio', 'light']);
    let any = null;
    for (let i = 0; i < 600; i++) {
      const s = pick(sp), date = randDate(), x = await verdictAt(s, date), fl = failed(x);
      if (fl.length !== 1) continue;
      if (fl[0] === want) { any = { s, date, x, val: fl[0] }; break; }
      any ??= { s, date, x, val: fl[0] };
    }
    if (!any) return null;
    const { s, date, x, val } = any;
    return build('kQ17', 'whichCheck', { site: { place: s.name }, date: { iso: date } },
      ['night', 'radio', 'light', 'slope'].map((v, i) => ({ val: v, aKey: 'kQ17a' + (i + 1), ...lineOf[v](x), correct: v === val })), { siteId: s.id, date, val });
  },
  // 18: four sites on one day, exactly one survives
  async kQ18() {
    const sp = prepared();
    for (let i = 0; i < 300; i++) {
      const date = randDate(), xs = [];
      for (const s of sp) xs.push({ s, x: await verdictAt(s, date) });
      const ok = xs.filter((q) => q.x.ok), bad = xs.filter((q) => !q.x.ok);
      if (ok.length < 1 || bad.length < 3) continue;
      const four = shuffle([pick(ok), ...shuffle(bad).slice(0, 3)]);
      return build('kQ18', 'whichSite', { date: { iso: date } },
        four.map((q) => ({ val: q.s.id, name: q.s.name, ...siteLine(q.s, q.x), correct: q.x.ok })), { date, ids: four.map((q) => q.s.id), val: four.find((q) => q.x.ok).s.id });
    }
    return null;
  },
  // 19: how many of the next 30 landing days are green? (the same count the grid row gives for a 30 day view)
  async kQ19() {
    const sp = prepared();
    let any = null;
    for (let i = 0; i < 300; i++) {
      const s = pick(sp), date = randDate();
      let c = 0;
      for (let d = 0; d < 30; d++) c += (await verdictAt(s, addDays(date, d))).ok;
      const d3 = decoys(c, 0, 30);
      if (!d3) continue;
      if (c >= 1 && c <= 29) { any = { s, date, c, d3 }; break; }
      any ??= { s, date, c, d3 };
    }
    if (!any) return null;
    const { s, date, c, d3 } = any;
    return build('kQ19', 'count30', { site: { place: s.name }, date: { iso: date } },
      [c, ...d3].map((n) => ({ val: n, aKey: 'kQnDays', aVars: { n }, ...(n === c ? { eKey: 'kQfCountR', eVars: { site: { place: s.name }, date: { iso: date }, n } } : { eKey: 'kQfCountW', eVars: { n, good: c } }), correct: n === c })), { siteId: s.id, date, val: c });
  },
  // 20 and 21: the longest dark stretch (or radio silence) against the limit
  kQ20: () => limitQuestion('kQ20', 'night', 'nightH', 'nh', 'nl'),
  kQ21: () => limitQuestion('kQ21', 'radio', 'silenceH', 'rh', 'rl'),
  // 22: when does the Sun first rise? (the four cases of the first sunlight check)
  async kQ22() {
    const sp = prepared(), cat = (h) => (h === 0 ? 1 : h < 24 ? 2 : h < Infinity ? 3 : 4), want = 1 + rnd(4);
    let any = null;
    for (let i = 0; i < 800; i++) {
      const s = pick(sp), date = randDate(), x = await verdictAt(s, date), c = cat(row(x, 'light').v);
      if (c === want) { any = { s, date, x, c }; break; }
      any ??= { s, date, x, c };
    }
    const { s, date, x, c } = any;
    return build('kQ22', 'firstSun', { site: { place: s.name }, date: { iso: date } },
      [1, 2, 3, 4].map((n) => ({ val: n, aKey: 'kQ22a' + n, ...f.light(x), correct: n === c })), { siteId: s.id, date, val: c });
  },
  // 23 and 24: which of four sites has the largest share of Sun (or of Earth in view)
  kQ23: () => shareQuestion('kQ23', 'sunPct', 'kQfSunPct', 'moreSun'),
  kQ24: () => shareQuestion('kQ24', 'earthPct', 'kQfEarthPct', 'moreEarth'),
  // 25: a lost day: how many days until the next green one?
  async kQ25() {
    const sp = prepared();
    for (let i = 0; i < 800; i++) {
      const s = pick(sp), date = randDate();
      if ((await verdictAt(s, date)).ok) continue;
      let k = 0;
      for (let d = 1; d <= 60 && !k; d++) if ((await verdictAt(s, addDays(date, d))).ok) k = d;
      if (k < 2 || k > 45) continue;
      const d3 = decoys(k, 1, 60);
      if (!d3) continue;
      return build('kQ25', 'nextSafe', { site: { place: s.name }, date: { iso: date } },
        [k, ...d3].map((n) => ({ val: n, aKey: 'kQnDays', aVars: { n }, ...(n === k ? { eKey: 'kQfNextR', eVars: { site: { place: s.name }, date: { iso: date }, date2: { iso: addDays(date, k) }, k } } : { eKey: 'kQfNextW', eVars: { n, k, date2: { iso: addDays(date, k) } } }), correct: n === k })), { siteId: s.id, date, val: k });
    }
    return null;
  },
};

/** 20 and 21: a number from the verdict rows against the limit the app uses now. The two middle options are always wrong. */
async function limitQuestion(id, rowId, limitKey, lh, ld) {
  const sp = prepared(), lim = Mi.limits[limitKey], wantPass = rnd(2) === 0;
  let any = null;
  for (let i = 0; i < 800; i++) {
    const s = pick(sp), date = randDate(), x = await verdictAt(s, date), h = row(x, rowId).v, pass = h <= lim;
    if (h < lim * 0.4 || h > lim * 2.2) continue; // near the limit, where the answer is worth thinking about
    if (pass === wantPass) { any = { s, date, x, h, pass }; break; }
    any ??= { s, date, x, h, pass };
  }
  if (!any) return null;
  const { s, date, x, h, pass } = any, line = f[rowId](x);
  return build(id, rowId === 'night' ? 'battery' : 'radio', { site: { place: s.name }, date: { iso: date }, h, [ld]: lim / 24, [lh]: lim, },
    [{ val: 'pass', aKey: id + 'a1', aVars: { h, [lh]: lim }, ...line, correct: pass }, { val: 'fail', aKey: id + 'a2', aVars: { h, [lh]: lim }, ...line, correct: !pass },
      { val: 'x3', aKey: id + 'a3', eKey: id + 'e3', correct: false }, { val: 'x4', aKey: id + 'a4', eKey: id + 'e4', correct: false }], { siteId: s.id, date, hours: h, val: pass ? 'pass' : 'fail' });
}

/** 23 and 24: four random sites on one day; the winner leads the second by at least 5 points. */
async function shareQuestion(id, rowId, lineKey, kind) {
  const sp = prepared();
  for (let i = 0; i < 500; i++) {
    const date = randDate(), four = shuffle(sp).slice(0, 4), xs = [];
    for (const s of four) xs.push({ s, p: row(await verdictAt(s, date), rowId).v });
    const top = [...xs].sort((a, b) => b.p - a.p);
    if (top[0].p - top[1].p < 5) continue;
    return build(id, kind, { date: { iso: date } },
      xs.map((q) => ({ val: q.s.id, name: q.s.name, eKey: lineKey, eVars: { site: { place: q.s.name }, p: Math.round(q.p) }, correct: q === top[0] })), { date, ids: four.map((s) => s.id), val: top[0].s.id });
  }
  return null;
}

/** A question as the quiz draws it. Static: from the texts; live: from the app's data at this moment. */
async function make(id) {
  const entry = POOL.find((p) => p.id === id);
  if (!entry.live) {
    return { id, live: false, kind: 'static', qKey: id + 'q', options: shuffle([1, 2, 3, 4].map((n) => ({ val: n, aKey: id + 'a' + n, eKey: id + 'e' + n, correct: n === 1 }))), src: entry.src };
  }
  return LIVE[id]();
}

// ------------------------------------------------------------------------ the screen
const optText = (o) => (o.aKey ? L(o.aKey, rv(o.aVars)) : I.place(o.name));
/** The question as text in the current language (the tests and the screen use the same function). */
function text(q) {
  return { id: q.id, live: q.live, q: L(q.qKey, rv(q.qVars)), options: q.options.map((o) => ({ val: o.val, correct: o.correct, text: optText(o), why: L(o.eKey, rv(o.eVars)) })) };
}

export function init(kid) {
  K = kid;
  const st = { open: false, ids: [], idx: 0, q: null, picked: null, results: [], busy: false, ended: false };
  const root = document.createElement('div');
  root.id = 'quiz'; root.className = 'kq'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'kq-title');
  root.innerHTML = '<div class="kq-card"><div class="kq-top"><i class="kq-moon" aria-hidden="true"></i><b id="kq-title"></b><span class="kq-prog"></span><button type="button" class="kq-x"></button></div><div class="kq-bar" aria-hidden="true"></div><div class="kq-main"></div><div class="kq-foot"></div></div>';
  document.body.appendChild(root);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'kidbtn kq-btn'; btn.setAttribute('aria-haspopup', 'dialog');
  document.getElementById('kidbar').appendChild(btn);
  const main = root.querySelector('.kq-main'), foot = root.querySelector('.kq-foot'), bar = root.querySelector('.kq-bar');
  const letters = ['A', 'B', 'C', 'D'];

  function render() {
    btn.textContent = L('kQBtn');
    root.querySelector('#kq-title').textContent = L('kQTitle');
    root.querySelector('.kq-x').textContent = '×'; root.querySelector('.kq-x').setAttribute('aria-label', L('kQClose')); root.querySelector('.kq-x').title = L('kQClose');
    bar.innerHTML = Array.from({ length: ROUND }, (_, i) => `<i class="${i < st.results.length ? (st.results[i] ? 'ok' : 'bad') : i === st.idx && !st.ended ? 'now' : ''}"></i>`).join('');
    if (!st.open) return;
    const prog = root.querySelector('.kq-prog');
    if (st.ended) return renderEnd(prog);
    prog.textContent = L('kQOf', { n: st.idx + 1, m: ROUND });
    if (!st.q) { main.innerHTML = `<p class="kq-loading">${esc(L('kQLoading'))}</p>`; foot.innerHTML = ''; return; }
    const t = text(st.q), done = st.picked != null;
    main.innerHTML = `${t.live ? `<span class="kq-live">${esc(L('kQLive'))}</span>` : ''}<h2 class="kq-q">${esc(t.q)}</h2><div class="kq-opts">` +
      t.options.map((o, i) => {
        const cls = !done ? '' : o.correct ? ' right' : i === st.picked ? ' wrong' : ' dim', show = done && (o.correct || i === st.picked);
        return `<button type="button" class="kq-opt${cls}" data-i="${i}"${done ? ' aria-disabled="true"' : ''}><span class="kq-key">${done && o.correct ? '✔' : done && i === st.picked ? '✘' : letters[i]}</span><span class="kq-txt">${esc(o.text)}` +
          (show ? `<span class="kq-why"><b>${esc(L(o.correct ? 'kQWhyRight' : 'kQWhyNot'))}</b> ${esc(o.why)}</span>` : '') + '</span></button>';
      }).join('') + '</div>';
    if (done) {
      const ok = t.options[st.picked].correct, last = st.idx === ROUND - 1;
      foot.innerHTML = `<span class="kq-verdict ${ok ? 'ok' : 'bad'}">${esc(L(ok ? 'kQRight' : 'kQWrong'))}</span><button type="button" class="kq-next">${esc(L(last ? 'kQFinish' : 'kQNext'))}</button>`;
    } else foot.innerHTML = '';
  }

  function renderEnd(prog) {
    const n = st.results.filter(Boolean).length;
    prog.textContent = '';
    main.innerHTML = `<div class="kq-end"><div class="kq-stars" aria-hidden="true">${st.results.map((r) => `<i class="${r ? 'ok' : 'bad'}">${r ? '★' : '☆'}</i>`).join('')}</div>` +
      `<h2 class="kq-score">${esc(L('kQScore', { n, m: ROUND }))}</h2><p class="kq-msg">${esc(L(n >= 5 ? 'kQm4' : n === 4 ? 'kQm3' : n >= 2 ? 'kQm2' : 'kQm1'))}</p></div>`;
    foot.innerHTML = `<button type="button" class="kq-next kq-again">${esc(L('kQAgain'))}</button><button type="button" class="kq-ghost kq-close">${esc(L('kQClose'))}</button>`;
  }

  async function ask() {
    st.q = null; st.picked = null; render();
    const id = st.ids[st.idx];
    let q = null;
    try { q = await make(id); } catch (e) { setTimeout(() => { throw e; }); }
    // A live question that cannot be drawn (no sites loaded yet) is replaced by a static one, so a round never stops.
    if (!q) q = await make(shuffle(STATIC.map((s) => s[0]).filter((s) => !st.ids.includes(s)))[0] || 'kQ01');
    st.q = q; render();
    main.scrollTop = 0;
  }

  function newRound() {
    st.ids = shuffle(POOL.map((p) => p.id)).slice(0, ROUND); st.idx = 0; st.results = []; st.ended = false;
    return ask();
  }

  function answer(i) {
    if (st.picked != null || !st.q || i < 0 || i >= st.q.options.length) return;
    st.picked = i; st.results.push(!!st.q.options[i].correct);
    render();
    const nx = foot.querySelector('.kq-next'); if (nx) { nx.focus({ preventScroll: true }); nx.scrollIntoView({ block: 'nearest' }); }
    const shown = main.querySelector('.kq-opt.right'); if (shown) shown.scrollIntoView({ block: 'nearest' });
  }
  function next() {
    if (st.picked == null) return;
    if (st.idx >= ROUND - 1) { st.ended = true; st.q = null; render(); main.scrollTop = 0; return; }
    st.idx++; ask();
  }

  function open() {
    if (st.open) return;
    st.open = true; root.hidden = false; btn.classList.add('on'); btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKey, true);
    if (!st.ids.length || st.ended) newRound(); else render();
    root.querySelector('.kq-x').focus({ preventScroll: true });
  }
  function close() {
    if (!st.open) return;
    st.open = false; root.hidden = true; btn.classList.remove('on'); btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey, true);
    btn.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); // the map's play shortcut must not fire under the quiz
    if (/^[1-4]$/.test(e.key) && !e.ctrlKey && !e.metaKey) answer(+e.key - 1);
  }

  btn.addEventListener('click', () => (st.open ? close() : open()));
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.classList.contains('kq-opt')) answer(+t.dataset.i);
    else if (t.classList.contains('kq-again')) newRound().then(() => root.querySelector('.kq-x').focus({ preventScroll: true }));
    else if (t.classList.contains('kq-next')) next();
    else if (t.classList.contains('kq-x') || t.classList.contains('kq-close')) close();
  });
  kid.lang.push(render); // the open question is drawn again in the new language
  render();

  // For the tests (tools/test-quiz.cjs): the pool, the round on screen, any question on demand, and its text in the current language.
  const start = (ids) => { if (!st.open) open(); st.ids = ids; st.idx = 0; st.results = []; st.ended = false; return ask(); }; // a round of chosen questions
  window.__quiz = { POOL, STATIC_IDS: STATIC.map((s) => s[0]), LIVE_IDS, state: st, make, text, open, close, start, ROUND };
}
