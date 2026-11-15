// Site score and rank test. Run: node tools/test-score.cjs
//   BASE_URL=https://...   test a deployed site instead of the local app folder
//   VIEWPORT=390x844       window size (default 1440x900)
//   SHOTS=/some/dir        where screenshots go (default: score-shots in the system temp folder)
// One line per check; exit code 1 on any failed check or page error.
// The expected numbers are worked out here from window.__all alone (good and total per row), with the rule written in the task:
//   score = round(100 * good / total), rank = 1 + number of rows with a higher score, equal scores share a rank.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { serve, launch } = require('./smoke.cjs');

const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'score-shots');
const TAG = `${VW}x${VH}`;
const fails = [];
const check = (ok, name, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); if (!ok) fails.push(name); };

// What the screen must show for a snapshot of window.__all.
const expectFor = (all) => {
  const sc = all.rows.map((r) => Math.round(100 * r.good / r.total));
  return all.rows.map((r, i) => ({ id: r.id, score: sc[i], rank: 1 + sc.filter((v) => v > sc[i]).length, of: all.rows.length }));
};
// The period words the panel line must hold, from the ISO dates of window.__all (English: "Nov 15 to Dec 15, 2026").
const periodEn = (all) => {
  const a = new Date(all.from + 'T00:00:00Z'), b = new Date(all.to + 'T00:00:00Z'), f = (d, o) => d.toLocaleString('en', { ...o, timeZone: 'UTC' });
  const day = { day: 'numeric', month: 'short' }, full = { ...day, year: 'numeric' };
  return `${f(a, a.getUTCFullYear() === b.getUTCFullYear() ? day : full)} to ${f(b, full)}`;
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = process.env.BASE_URL ? null : await serve(path.join(__dirname, '..', 'app'));
  const url = process.env.BASE_URL || `http://127.0.0.1:${srv.address().port}/`;
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the first visit help has its own test (test-tour.cjs)
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push('page error: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console error: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(url.replace(/\/$/, ''))) errs.push(`${r.status()} ${r.url()}`); });
  const shot = (name) => p.screenshot({ path: path.join(SHOTS, `score-${TAG}-${name}.png`) });

  // What the page holds right now: window.__all, and what every row shows.
  const dom = () => p.evaluate(() => ({
    all: { ready: window.__all.ready, from: window.__all.from, to: window.__all.to, rows: window.__all.rows.map((r) => ({ id: r.id, good: r.good, total: r.total })) },
    rows: [...document.querySelectorAll('#sites li')].map((li) => { const m = li.querySelector('.cnt .sc');
      return { id: li.dataset.id, marks: li.querySelectorAll('.cnt .sc').length, rank: m && m.querySelector('.sc-r').textContent, score: m && m.querySelector('.sc-s').textContent, title: m ? m.title : '' }; }),
  }));
  const shows = (d, name) => {
    const want = expectFor(d.all), byId = new Map(d.rows.map((r) => [r.id, r]));
    const missing = want.filter((w) => !byId.get(w.id) || byId.get(w.id).marks !== 1 || !/^#\d+$/.test(byId.get(w.id).rank || '') || !/^\d{1,3}$/.test(byId.get(w.id).score || ''));
    check(d.rows.length === want.length && missing.length === 0, `${name}: every row shows one rank and one score`, `${d.rows.length} rows${missing.length ? ', without a mark: ' + missing.map((m) => m.id).join() : ''}`);
    const wrongScore = want.filter((w) => byId.get(w.id) && +byId.get(w.id).score !== w.score);
    check(wrongScore.length === 0, `${name}: score = round(100 * good / total) on every row`, wrongScore.map((w) => `${w.id} shows ${byId.get(w.id).score}, want ${w.score}`).join('; ') || want.map((w) => w.score).join(' '));
    const wrongRank = want.filter((w) => byId.get(w.id) && byId.get(w.id).rank !== '#' + w.rank);
    check(wrongRank.length === 0, `${name}: ranks follow the scores, highest first`, wrongRank.map((w) => `${w.id} shows ${byId.get(w.id).rank}, want #${w.rank}`).join('; ') || want.map((w) => w.rank).join(' '));
    const ties = want.filter((w, i) => want.some((o, j) => j !== i && o.score === w.score)), tieOk = ties.every((w) => byId.get(w.id).rank === '#' + w.rank && want.filter((o) => o.score === w.score).every((o) => byId.get(o.id).rank === byId.get(w.id).rank));
    check(tieOk, `${name}: equal scores share a rank`, `${ties.length} rows are in a tie`);
    // The order of the rows is the app's: best surviving days first. Ranks therefore never go down the list.
    const goods = d.rows.map((r) => d.all.rows.find((q) => q.id === r.id).good), ranks = d.rows.map((r) => +r.rank.slice(1));
    check(goods.every((g, i) => i === 0 || g <= goods[i - 1]) && ranks.every((r, i) => i === 0 || r >= ranks[i - 1]), `${name}: the row order is untouched (days survived go down, ranks go up)`, ranks.join(' '));
    return want;
  };

  await p.goto(url);
  await p.waitForFunction(() => window.__all && window.__all.ready && window.__score && window.__score.ready, null, { timeout: 120000 });
  await p.waitForTimeout(4200); // the opening move ends

  // 1. the first screen, as opened
  const d0 = await dom();
  console.log(`     period ${d0.all.from} to ${d0.all.to}, ${d0.all.rows.length} sites, ${d0.all.rows[0].total} landing days`);
  const want0 = shows(d0, 'first screen');
  const exposed = await p.evaluate(() => ({ ready: window.__score.ready, n: window.__score.rows.length, same: window.__score.rows.map((r) => r.id + ':' + r.score + ':' + r.rank).join() }));
  check(exposed.ready && exposed.n === d0.all.rows.length && exposed.same === want0.map((w) => w.id + ':' + w.score + ':' + w.rank).join(), 'globalThis.__score holds the same ranks and scores the rows show');

  // the rule itself, by the function, including a rounding tie and a row that is not judged yet
  const synth = await p.evaluate(() => window.__score.scoreRows([{ id: 'a', good: 5, total: 10 }, { id: 'b', good: 5, total: 10 }, { id: 'c', good: 3, total: 10 }, { id: 'd', good: -1, total: 10 }, { id: 'e', good: 10, total: 10 }, { id: 'f', good: 1, total: 200 }, { id: 'g', good: 2, total: 200 }]).map((r) => `${r.id}:${r.score}:${r.rank}`).join(' '));
  check(synth === 'a:50:2 b:50:2 c:30:4 d:null:null e:100:1 f:1:5 g:1:5', 'rule: 1, 2, 2, 4; a rounding tie shares a rank; a row not judged has none', synth);

  // 2. the legend entry: one visible word and the whole rule in a tooltip made like the app's others
  const head = await p.evaluate(() => { const h = document.querySelector('.sc-head'), r = h && h.getBoundingClientRect(), L = document.getElementById('sitelist').getBoundingClientRect();
    return h && { text: h.textContent, cls: h.className, tab: h.getAttribute('tabindex'), tip: h.dataset.tip, vis: r.width > 4 && r.height > 4 && r.left >= L.left && r.right <= L.right + 0.5 && r.top >= L.top && r.bottom <= L.bottom, n: document.querySelectorAll('.sc-head').length }; });
  check(head && head.n === 1 && head.text === 'Score' && /\btip\b/.test(head.cls) && head.tab === '0' && head.vis, 'legend: one visible word "Score" with class tip and tabindex 0', JSON.stringify(head && { text: head.text, cls: head.cls, tab: head.tab, vis: head.vis }));
  check(head && /0 to 100/.test(head.tip) && /green/.test(head.tip) && /divided by all landing days/.test(head.tip) && /Rank #1/.test(head.tip) && /share a rank/.test(head.tip) && /dates/.test(head.tip) && !/["<]/.test(head.tip), 'legend tooltip says the whole rule in plain words', head && head.tip);
  await p.hover('.sc-head');
  const tipBox = await p.evaluate(() => { const h = document.querySelector('.sc-head'), a = getComputedStyle(h, '::after'), r = h.getBoundingClientRect(), L = document.getElementById('sitelist').getBoundingClientRect(), w = parseFloat(a.width);
    return { content: a.content, want: '"' + h.dataset.tip + '"', w, left: r.right - w, panelLeft: L.left, panelRight: L.right, right: r.right }; });
  check(tipBox.content === tipBox.want && tipBox.left >= tipBox.panelLeft - 1 && tipBox.right <= tipBox.panelRight + 1, 'hovering the legend shows its tooltip, inside the panel', `${Math.round(tipBox.w)} px wide, from ${Math.round(tipBox.left)} to ${Math.round(tipBox.right)} (panel ${Math.round(tipBox.panelLeft)} to ${Math.round(tipBox.panelRight)})`);
  await shot('1-first-screen-tip');
  await p.mouse.move(5, 5);

  // 3. nothing overflows the rows (read at the size this run uses, 390x844 in the phone run)
  const lay = () => p.evaluate(() => { const list = document.getElementById('sitelist'), bad = [];
    for (const li of document.querySelectorAll('#sites li')) {
      const r = li.getBoundingClientRect(), m = li.querySelector('.cnt .sc'), cv = li.querySelector('canvas'), btn = li.querySelector('button'), cnt = li.querySelector('.cnt');
      if (!m) { bad.push(li.dataset.id + ': no mark'); continue; }
      const mr = m.getBoundingClientRect(), cr = cv.getBoundingClientRect(), br = btn.getBoundingClientRect();
      if (mr.width < 10 || mr.height < 6) bad.push(li.dataset.id + ': the mark has no size');
      if (mr.left < r.left - 0.5 || mr.right > r.right + 0.5) bad.push(li.dataset.id + ': the mark leaves the row');
      if (mr.left < cr.right - 0.5) bad.push(li.dataset.id + ': the mark overlaps the day bars');
      if (li.scrollWidth > li.clientWidth + 1 || cnt.scrollWidth > cnt.clientWidth + 1) bad.push(li.dataset.id + ': the row scrolls sideways');
      if (br.width < 60) bad.push(li.dataset.id + ': the name is squeezed to ' + Math.round(br.width) + ' px');
      if (cr.width < 100) bad.push(li.dataset.id + ': the day bars are squeezed to ' + Math.round(cr.width) + ' px');
    }
    const h = document.querySelector('.sc-head').getBoundingClientRect(), cv0 = document.querySelector('.a-axis canvas').getBoundingClientRect();
    if (h.width < 4 || h.left < cv0.right - 0.5) bad.push('the column title is hidden or on the axis');
    if (list.scrollWidth > list.clientWidth + 1) bad.push('the list panel scrolls sideways');
    if (document.documentElement.scrollWidth > window.innerWidth) bad.push('the page scrolls sideways');
    return { bad, rows: document.querySelectorAll('#sites li').length, bars: Math.round(document.querySelector('#sites canvas').getBoundingClientRect().width), name: Math.round(document.querySelector('#sites li button').getBoundingClientRect().width) }; });
  const l0 = await lay();
  check(l0.bad.length === 0, `nothing overflows a row at ${TAG}`, l0.bad.slice(0, 4).join('; ') || `${l0.rows} rows, name ${l0.name} px, day bars ${l0.bars} px`);
  await shot('2-first-screen');

  // 4. another period: every score is worked out again from the new window.__all
  const periods = [];
  for (const k of ['2w', '1', '0.25']) {
    const before = await dom();
    await p.click(`.a-range button[data-y="${k}"]`);
    await p.waitForFunction((to) => window.__all.ready && window.__all.to !== to, before.all.to, { timeout: 30000 });
    const d = await dom(); periods.push(d);
    shows(d, `period ${k} (${d.all.from} to ${d.all.to})`);
    check(d.all.rows[0].total !== before.all.rows[0].total && JSON.stringify(d.rows.map((r) => r.score)) !== JSON.stringify(before.rows.map((r) => r.score)), `period ${k}: the days and the scores changed with the period`, `${before.all.rows[0].total} days -> ${d.all.rows[0].total} days; ${before.rows.slice(0, 5).map((r) => r.score)} -> ${d.rows.slice(0, 5).map((r) => r.score)}`);
  }
  const l1 = await lay();
  check(l1.bad.length === 0, `nothing overflows a row at ${TAG} on a longer period`, l1.bad.slice(0, 4).join('; '));

  // 5. the mission limits: judged again, so the scores move
  await p.click('.a-range button[data-y="1m"]');
  await p.waitForFunction(() => window.__all.ready, null, { timeout: 30000 });
  const dA = await dom();
  await p.evaluate(() => { const el = document.querySelector('#a-night'); el.value = '0'; el.dispatchEvent(new Event('change')); });
  const dB = await dom();
  shows(dB, 'battery limit 0 days');
  check(dB.rows.some((r, i) => r.score !== dA.rows.find((q) => q.id === r.id).score), 'changing the battery limit changes the scores', `${dA.rows.slice(0, 6).map((r) => r.score)} -> ${dB.rows.slice(0, 6).map((r) => r.score)}`);
  await p.evaluate(() => { const el = document.querySelector('#a-reset'); if (!el.hidden) el.click(); });
  const dC = await dom();
  shows(dC, 'limits reset');
  check(JSON.stringify(dC.rows.map((r) => r.id + r.score + r.rank)) === JSON.stringify(dA.rows.map((r) => r.id + r.score + r.rank)), 'resetting the limits gives the first scores back');

  // 6. the three languages, on the first screen
  const words = { ru: { head: 'Оценка', row: /^Позиция \d+ из \d+, оценка \d+ из 100$/, tip: /Оценка от 0 до 100/ }, ky: { head: 'Упай', row: /^\d+ жердин ичинен \d+-орун, упай \d+ \/ 100$/, tip: /Упай 0 менен 100 аралыгында/ }, en: { head: 'Score', row: /^Rank \d+ of \d+, score \d+ of 100$/, tip: /Score from 0 to 100/ } };
  for (const l of ['ru', 'ky', 'en']) {
    await p.click(`#lang button[data-l="${l}"]`);
    const t = await p.evaluate(() => ({ head: document.querySelector('.sc-head').textContent, tip: document.querySelector('.sc-head').dataset.tip, row: document.querySelector('#sites li .sc').title, n: document.querySelectorAll('.sc-head').length, mine: document.querySelector('#sites li .sc-r').textContent }));
    check(t.n === 1 && t.head === words[l].head && words[l].tip.test(t.tip) && words[l].row.test(t.row) && /^#\d+$/.test(t.mine), `${l}: the column title, its tooltip and the row label are in ${l}`, `${t.head}; ${t.row}`);
    check((await dom()).rows.every((r) => r.marks === 1), `${l}: still one mark per row after the language switch`);
    if (l === 'ky') await shot('3-first-screen-ky');
    if (l === 'ru') { check((await lay()).bad.length === 0, `nothing overflows a row at ${TAG} in Russian`, (await lay()).bad.slice(0, 3).join('; ')); }
  }

  // 7. a site panel: the line holds that site's rank and score for the period of the first screen
  const dNow = await dom(), wantNow = expectFor(dNow.all);
  const ids = [dNow.all.rows[0].id, dNow.all.rows[Math.floor(dNow.all.rows.length / 2)].id, dNow.all.rows[dNow.all.rows.length - 1].id];
  let sawBest = false;
  for (const id of ids) {
    await p.click(`#sites li[data-id="${id}"] button`);
    await p.waitForFunction(() => document.body.className === 'mode-surface' && document.querySelector('#v-extra .sc-line'), null, { timeout: 60000 });
    const v = await p.evaluate(() => ({ text: document.querySelector('#v-extra .sc-line').textContent, bold: [...document.querySelectorAll('#v-extra .sc-line b')].map((b) => b.textContent), lines: document.querySelectorAll('#v-extra .sc-line').length, tip: document.querySelector('#v-extra .sc-line .tip').dataset.tip,
      dir: window.__app.S.site.dir, open: window.__app.S.siteId, line: window.__score.line, inPanel: !!document.querySelector('#verdict #v-extra .sc-line') }));
    const w = wantNow.find((x) => x.id === id), ex = `Rank ${w.rank} of ${w.of}, score ${w.score} of 100 (${periodEn(dNow.all)})`;
    sawBest = sawBest || v.dir !== v.open;
    check(v.lines === 1 && v.inPanel && v.text.replace(/^ⓘ\s*/, '') === ex, `site panel of ${id}: the line says its rank and score for the period shown`, v.text);
    check(v.bold.join() === [w.rank, w.of, w.score].join() && v.line && v.line.id === id && v.line.rank === w.rank && v.line.score === w.score && /share a rank/.test(v.tip), `site panel of ${id}: the numbers are set in bold, __score.line names the site, the tooltip holds the rule`, `data folder ${v.dir}`);
    if (id === ids[0]) { await p.waitForTimeout(600); await shot('4-site-panel'); }
    if (id === ids[0]) { // the language switch redraws the panel
      await p.click('#lang button[data-l="ru"]');
      const ru = await p.evaluate(() => document.querySelector('#v-extra .sc-line').textContent);
      check(new RegExp(`^ⓘ\\s*Позиция ${w.rank} из ${w.of}, оценка ${w.score} из 100 \\(с .+ по .+\\)$`).test(ru), 'site panel: the line is in Russian after the language button', ru);
      await p.click('#lang button[data-l="en"]');
    }
    await p.evaluate(() => window.__app.kid.backToMap());
    await p.waitForFunction(() => document.body.className === 'mode-overview', null, { timeout: 30000 });
    await p.waitForTimeout(300);
  }
  check(sawBest, 'at least one panel was opened on a "best nearby" data folder and still found its site', '');
  // not sure which site is open: no line, no guess
  const unsure = await p.evaluate(() => [window.__score.openId({ site: { dir: 'no-such-folder' } }), window.__score.openId({}), window.__score.openId(null), window.__score.openId({ site: { dir: window.__app.S.index.sites[0].variants.databook.dir } })]);
  check(unsure[0] === null && unsure[1] === null && unsure[2] === null && unsure[3] === (await p.evaluate(() => window.__app.S.index.sites[0].id)), 'a site that cannot be identified from ctx gets no line (unknown folder, empty ctx); a known one is found', JSON.stringify(unsure));
  check((await lay()).bad.length === 0, `nothing overflows a row at ${TAG} after coming back from a site`);

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close(); if (srv) srv.close();
  if (fails.length) { console.error(`FAIL ${fails.length} check(s): ${fails.join('; ')}`); process.exit(1); }
  console.log(`site score and rank work at ${TAG}`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
