// Site score and rank.
// Score: round(100 * surviving landing days / landing days in the period shown), 0 to 100.
// Rank: position by that score, highest first; equal scores share a rank (1, 1, 3). The rank is read from the rounded score on
// screen, so two rows that show the same number always show the same rank. The order of the rows is the app's (allsites.js) and is never touched here.
// Two plug-ins: SiteListExtras marks every row of the first screen, VerdictExtras adds one line to the answer panel of a site.
const I = globalThis.I18n, L = (k, v) => I.t(k, v);

/** rows: [{ id, good, total }], good < 0 for a row not judged yet. Gives each row its score, rank and `of` (rows judged). */
export function scoreRows(rows) {
  const score = rows.map((r) => (r.good >= 0 && r.total > 0 ? Math.round(100 * r.good / r.total) : null));
  const judged = score.filter((v) => v !== null);
  return rows.map((r, i) => ({ id: r.id, good: r.good, total: r.total, score: score[i], of: judged.length,
    rank: score[i] === null ? null : 1 + judged.filter((v) => v > score[i]).length }));
}

const state = (globalThis.__score = { ready: false, a: 0, b: 0, total: 0, rows: [], line: null, scoreRows, openId: null });

// ---------------------------------------------------------------- the first screen
function mark(li, r, ready) {
  const cnt = li.querySelector('.cnt');
  if (!cnt) return;
  for (const old of cnt.querySelectorAll('.sc')) old.remove(); // the host rewrites .cnt on every repaint; this keeps one mark if it did not
  if (r.score === null) return; // not judged yet: the host shows its own "…"
  const m = document.createElement('span'), rk = document.createElement('span'), sc = document.createElement('span');
  m.className = 'sc';
  rk.className = 'sc-r' + (ready && r.rank === 1 ? ' top' : ''); rk.textContent = ready ? '#' + r.rank : '…';
  sc.className = 'sc-s'; sc.textContent = String(r.score);
  if (ready) m.title = m.dataset.label = L('xSRow', { r: r.rank, n: r.of, s: r.score });
  m.append(rk, sc);
  cnt.append(m);
}

/** The column title in the empty last cell of the axis row: one visible word, and the whole rule in its tooltip. */
function head(root) {
  const cell = root.querySelector('.a-axis > :last-child');
  if (!cell) return;
  let h = cell.querySelector('.sc-head');
  if (!h) { h = document.createElement('span'); h.className = 'tip sc-head'; h.tabIndex = 0; cell.append(h); }
  h.textContent = L('xSHead'); h.dataset.tip = L('xSTip');
}

(globalThis.SiteListExtras ||= []).push(({ root, sites, a, b, ready }) => {
  const total = b - a, res = scoreRows(sites.map((s) => ({ id: s.id, good: s.v ? s.good : -1, total })));
  head(root);
  sites.forEach((s, i) => mark(s.li, res[i], ready));
  Object.assign(state, { ready, a, b, total, rows: res });
  queueMicrotask(paintLine); // after the host has set __all for this repaint: a site panel opened before every row was known gets its line now
});

// ---------------------------------------------------------------- the answer panel of a site
/** The id of the open site, from the loaded site in ctx: the site whose index entry owns that site's data folder. null if it is not exactly one. */
function openId(ctx) {
  const dir = ctx && ctx.site && ctx.site.dir, list = globalThis.__app && globalThis.__app.S && globalThis.__app.S.index && globalThis.__app.S.index.sites;
  if (!dir || !Array.isArray(list)) return null;
  const hit = list.filter((s) => Object.values(s.variants || {}).some((v) => v && v.dir === dir));
  return hit.length === 1 ? hit[0].id : null;
}
state.openId = openId;

/** The period of the first screen as words: "Nov 15 to Dec 15, 2026" (the year once when both ends share it). */
function period(all) {
  const a = new Date(all.from + 'T00:00:00Z'), b = new Date(all.to + 'T00:00:00Z');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
  const day = { day: 'numeric', month: 'short' }, full = { ...day, year: 'numeric' };
  return L('xSPeriod', { a: I.date(a, a.getUTCFullYear() === b.getUTCFullYear() ? day : full), b: I.date(b, full) });
}

let open = null; // the last answer panel box and its ctx, so the line can follow a list that finishes later or a language change

function paintLine() {
  if (!open || !open.box.isConnected) return;
  const { box, ctx } = open;
  for (const old of box.querySelectorAll('.sc-line')) old.remove();
  state.line = null;
  const all = globalThis.__all, id = openId(ctx);
  if (!id || !all || !all.ready || !all.rows) return; // not sure which site is open, or the rows are not all known: leave the line out
  const me = scoreRows(all.rows).find((r) => r.id === id);
  if (!me || me.score === null) return;
  const per = period(all), mk = (n) => '\u0001' + n + '\u0002';
  const text = L('xSLine', { r: mk(me.rank), n: mk(me.of), s: mk(me.score), period: per });
  const p = document.createElement('p'), tip = document.createElement('span');
  p.className = 'sc-line';
  tip.className = 'tip'; tip.tabIndex = 0; tip.textContent = 'ⓘ'; tip.dataset.tip = L('xSTip');
  p.append(tip, ' ');
  text.split(/[\u0001\u0002]/).forEach((part, i) => { if (!part) return; if (i % 2) { const b = document.createElement('b'); b.textContent = part; p.append(b); } else p.append(part); });
  box.append(p);
  state.line = { id, rank: me.rank, of: me.of, score: me.score, period: per, text: text.replace(/[\u0001\u0002]/g, '') };
}

(globalThis.VerdictExtras ||= []).push((box, ctx) => { open = { box, ctx }; paintLine(); });
