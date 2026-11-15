// Motion test. Run: node tools/test-motion.cjs
//   BASE_URL=https://...   test a deployed site instead of the local app folder
//   VIEWPORT=390x844       window size for the motion checks (default 1440x900); the pixel check always runs at both sizes
//   BREAK=leftover         prove the test can fail: serves a motion.js that leaves a transform behind (expect red, exit 1)
// One line per check; exit code 1 on any failed check or page error.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { serve, launch } = require('./smoke.cjs');

const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'motion-shots');
const TAG = `${VW}x${VH}`;
const fails = [];
const check = (ok, name, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); if (!ok) fails.push(name); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MOTION_ONLY = ['transform', 'opacity', 'backgroundPosition', 'backgroundPositionX', 'backgroundPositionY', 'clipPath'];
// Installed in every page: every running animation and transition, what it is, what it moves.
const SNAP = () => { window.__tmSnap = () => document.getAnimations().map((a) => {
  const e = a.effect, t = e && e.target, props = new Set();
  try { for (const k of e.getKeyframes()) for (const n of Object.keys(k)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(n)) props.add(n); } catch (x) { /* none */ }
  return { name: a.animationName || (a.transitionProperty ? 'transition:' + a.transitionProperty : 'script'), target: t ? (t.id || t.tagName.toLowerCase() + '.' + String(t.className).split(' ')[0]) : '', pseudo: (e && e.pseudoElement) || '', props: [...props], t: a.currentTime, pr: e && e.getComputedTiming().progress };
}); }; // what motion may animate

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = process.env.BASE_URL ? null : await serve(path.join(__dirname, '..', 'app'));
  const url = process.env.BASE_URL || `http://127.0.0.1:${srv.address().port}/`;
  const b = await launch();
  const errs = [];

  // A fresh visitor: first visit help off, the page errors collected. blocked: motion.css and motion.js answer with nothing.
  async function open({ w = VW, h = VH, reduced = false, blocked = false } = {}) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(() => { try { localStorage.setItem('kidHelp', 'off'); } catch (e) { /* no storage */ } }); // the first visit help has its own test (test-tour.cjs)
    await ctx.addInitScript(SNAP);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push('page error: ' + e.message));
    p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(url.replace(/\/$/, ''))) errs.push(`${r.status()} ${r.url()}`); });
    if (blocked) {
      await p.route('**/css/motion.css', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await p.route('**/src/motion.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    } else if (process.env.BREAK === 'leftover') {
      // a deliberate bug for the proof that this test can fail: every glide ends 3 px off its place and stays there
      await p.route('**/src/motion.js', async (r) => {
        const res = await r.fetch(), src = await res.text();
        await r.fulfill({ response: res, body: src.replace("transform: 'translateY(0)', opacity: 1 }],\n      { duration: FLIP_MS", "transform: 'translateY(3px)', opacity: 1 }],\n      { duration: FLIP_MS").replace("easing: OUT, fill: 'backwards' });\n    playing(li, a); stats.flips++;", "easing: OUT, fill: 'both' });\n    playing(li, a); stats.flips++;") });
      });
    }
    await p.goto(url);
    return p;
  }
  const ready = (p) => p.waitForFunction(() => window.__app && window.__app.ready && window.__all && window.__all.ready, null, { timeout: 120000 });
  const snap = (p) => p.evaluate(() => window.__tmSnap());
  const hasNav = (p) => p.evaluate(() => getComputedStyle(document.querySelector('#topbar nav button[data-panel="validation"]')).display !== 'none');
  const seen = []; // everything snapped in the motion run, for the property audit
  const look = async (p) => { const s = await snap(p); seen.push(...s); return s; };
  const order = (p) => p.evaluate(() => [...document.querySelectorAll('#sites li.a-row')].map((l) => l.dataset.id));
  const rowsState = (p) => p.evaluate(() => [...document.querySelectorAll('#sites li.a-row')].map((l) => { const cs = getComputedStyle(l); return { id: l.dataset.id, tf: cs.transform, op: cs.opacity }; }));
  // Where the layout puts a row against where it is drawn: equal when nothing is left over.
  const offPlace = (p) => p.evaluate(() => { const ol = document.getElementById('sites'), o = ol.getBoundingClientRect(); let worst = 0;
    for (const l of ol.querySelectorAll('li.a-row')) { const r = l.getBoundingClientRect(); worst = Math.max(worst, Math.abs(r.top - (o.top + l.offsetTop)), Math.abs(r.left - (o.left + l.offsetLeft))); } return worst; });
  const press = (p, y) => p.click(`.a-range button[data-y="${y}"]`);
  const PERIODS = ['5', '1', '0.25', '2w', '1m', '0'];
  // Press period buttons until the list re-sorts; returns the order before and after, or null.
  async function reorder(p) {
    for (const y of PERIODS) { const before = await order(p); await press(p, y); const after = await order(p); if (before.join() !== after.join()) return { before, after, y }; await wait(500); }
    return null;
  }
  const verdictDay = (p) => p.evaluate(() => window.__verdict && window.__verdict.date);

  // 1. reduced motion: nothing moves, the final state shows at once
  {
    const p = await open({ reduced: true });
    await ready(p);
    const arrival = await snap(p), st0 = await rowsState(p);
    check(arrival.length === 0 && st0.every((r) => r.tf === 'none' && r.op === '1') && await p.evaluate(() => !document.getElementById('sites').classList.contains('m-arrive')),
      'reduced motion: the list is ready with no animation, no leftover transform, full opacity', JSON.stringify(arrival.slice(0, 3)));
    const re = await reorder(p);
    const st1 = await rowsState(p), an1 = await snap(p);
    check(!!re && an1.length === 0 && st1.every((r) => r.tf === 'none' && r.op === '1') && (await offPlace(p)) < 0.01 && await p.evaluate(() => window.__motion.flips === 0),
      'reduced motion: a re-sort lands at once (no glide, rows already in place)', re ? `${re.y}: ${an1.length} animations` : 'no period changed the order');
    if (await hasNav(p)) {
      await p.click('#topbar nav button[data-panel="validation"]');
      const pn = await p.evaluate(() => { const e = document.getElementById('panel'), cs = getComputedStyle(e); return { open: e.classList.contains('open'), tf: cs.transform, op: cs.opacity, tr: cs.transitionDuration }; });
      check(pn.open && pn.tf === 'none' && pn.op === '1' && (await snap(p)).filter((a) => a.target === 'panel').length === 0, 'reduced motion: the side panel is open at once, no slide', JSON.stringify(pn));
      await p.click('#panel-close');
    } else check(true, 'reduced motion: side panel check skipped, its buttons are hidden at this width (app.css, max-width 760px)');
    await p.click('#sites li.a-row button');
    await p.waitForFunction(() => document.body.classList.contains('mode-surface') && document.querySelector('#verdict .v-head') && !document.getElementById('fade').classList.contains('on'), null, { timeout: 30000 });
    await wait(700);
    const d0 = await verdictDay(p);
    await p.click('#verdict .v-date button:nth-of-type(1)');
    const an2 = await snap(p), cls = await p.evaluate(() => document.getElementById('verdict').className);
    check(d0 !== await verdictDay(p) && an2.length === 0 && !/m-lit|m-shade/.test(cls) && await p.evaluate(() => window.__motion.sweeps === 0), 'reduced motion: a new verdict shows with no sweep and no animation', cls + ' ' + JSON.stringify(an2.slice(0, 3)));
    await p.context().close();
  }

  // 2. motion on
  {
    const p = await open();
    await ready(p);
    // 2a. first arrival: lit once, laid out and fully visible when it ends
    const a0 = await look(p);
    const pass = a0.filter((a) => a.name === 'm-pass'), rowsA = a0.filter((a) => a.target.startsWith('li.') || a.name === 'script');
    check(pass.length === 1 && rowsA.length >= 10 && await p.evaluate(() => window.__motion.arrivals === 1), 'first arrival: one line of light and the rows come in once, when the list is ready', `${pass.length} sweep, ${rowsA.length} rows`);
    await wait(1300);
    const a1 = await snap(p), st = await rowsState(p);
    check(a1.length === 0 && st.every((r) => r.tf === 'none' && r.op === '1') && (await offPlace(p)) < 0.01 && await p.evaluate(() => !document.getElementById('sites').classList.contains('m-arrive')),
      'first arrival ends fully laid out: no animation, no transform, opacity 1, light line removed', `worst offset ${(await offPlace(p)).toFixed(3)} px`);

    // 2b. rank changes: moved rows glide with a transform, then sit exactly where the layout puts them.
    // A real click takes about a second to come back from this page (the Moon renders on every frame), longer than a glide: so the press
    // is made inside the page and read in the same moment, and a glide is frozen halfway to click it with a real mouse.
    // (the glide is frozen halfway in the same moment as the press, so the check below does not race the 350 ms)
    const pressNow = (p, y) => p.evaluate((y) => { const ids = () => [...document.querySelectorAll('#sites li.a-row')].map((l) => l.dataset.id), before = ids();
      document.querySelector(`.a-range button[data-y="${y}"]`).click();
      const after = ids(), rows = [...document.querySelectorAll('#sites li.a-row')].map((l) => ({ id: l.dataset.id, tf: getComputedStyle(l).transform })), anims = window.__tmSnap();
      if (before.join() !== after.join()) for (const a of document.getAnimations()) { a.pause(); a.currentTime = 175 + (a.effect.getTiming().delay || 0); }
      return { before, after, rows, anims }; }, y);
    let re = null;
    for (const y of PERIODS) { const r = await pressNow(p, y); seen.push(...r.anims); if (r.before.join() !== r.after.join()) { re = { ...r, y }; break; } await wait(600); }
    if (!re) check(false, 'a period button changes the order of the rows');
    else {
      const moved = re.after.filter((id, i) => re.before[i] !== id);
      const movedTf = re.rows.filter((r) => moved.includes(r.id)), stillTf = re.rows.filter((r) => !moved.includes(r.id));
      check(moved.length > 0 && movedTf.every((r) => r.tf !== 'none') && stillTf.every((r) => r.tf === 'none'), 'a row that changed rank has a transform right after the press; a row that kept its place has none', `${moved.length} of ${re.rows.length} rows moved (period ${re.y})`);
      check(re.anims.filter((a) => a.target.startsWith('li.')).length === moved.length, 'one glide per row that moved, none for the others', `${re.anims.filter((a) => a.target.startsWith('li.')).length} glides`);
      // freeze the glide halfway and click a moved row with a real mouse: it is hit where it is drawn, and the click lands
      const pt = await p.evaluate(({ moved }) => {
        const box = document.getElementById('sitelist').getBoundingClientRect();
        for (const id of moved) { const li = document.querySelector(`#sites li.a-row[data-id="${id}"]`), r = li.querySelector('button').getBoundingClientRect(), x = r.left + Math.min(r.width / 2, 40), y = r.top + r.height / 2;
          if (y < box.top + 4 || y > box.bottom - 4) continue;
          const e = document.elementFromPoint(x, y); if (e && li.contains(e)) return { id, x, y, moving: getComputedStyle(li).transform !== 'none', drift: Math.abs(r.top - (document.getElementById('sites').getBoundingClientRect().top + li.offsetTop)) }; }
        return null; }, { moved });
      if (pt) await p.mouse.click(pt.x, pt.y);
      await p.waitForFunction(() => document.body.classList.contains('mode-surface') && !document.getElementById('fade').classList.contains('on'), null, { timeout: 30000 }).catch(() => {});
      const landed = await p.evaluate(() => { for (const a of document.getAnimations()) a.play(); return { surface: document.body.classList.contains('mode-surface'), id: window.__app.S.siteId }; }); // let the frozen glide finish
      check(!!pt && pt.moving && pt.drift > 1 && landed.surface && landed.id === pt.id, 'a mouse click in the middle of a glide lands on the row drawn under the pointer', JSON.stringify({ ...pt, ...landed }));
      await p.evaluate(() => document.getElementById('back').click());
      await p.waitForFunction(() => document.body.classList.contains('mode-overview'), null, { timeout: 30000 });
      await wait(1300);
      const end = await rowsState(p), an = await snap(p), off = await offPlace(p);
      check(end.every((r) => r.tf === 'none' && r.op === '1') && off < 0.01 && an.length === 0, 'after the glide every row ends exactly where the layout puts it (no leftover transform after 1 s)', `worst offset ${off.toFixed(3)} px, ${an.length} animations left`);
    }
    // a press that changes nothing glides nothing
    const same = await order(p), n0 = await p.evaluate(() => window.__motion.flips);
    const nothing = await p.evaluate(() => { document.querySelector('.a-range button.on').click(); return window.__tmSnap().filter((a) => a.target.startsWith('li.')).length; });
    check((await order(p)).join() === same.join() && (await p.evaluate(() => window.__motion.flips)) === n0 && nothing === 0, 'a repaint that changes no rank moves nothing');
    // two presses in a row: the second lands while the first glide is playing, and the rows still end in place
    const twice = await p.evaluate(async () => { const y = (v) => document.querySelector(`.a-range button[data-y="${v}"]`), ids = () => [...document.querySelectorAll('#sites li.a-row')].map((l) => l.dataset.id).join();
      // press periods until one re-sorts the list; 120 ms into its glide press until another does
      const flip = (skip) => { for (const v of ['0', '1', '0.25', '2w', '1m', '5']) { if (v === skip) continue; const o = ids(); y(v).click(); if (ids() !== o) return v; } return null; };
      const first = flip(null); await new Promise((r) => setTimeout(r, 120)); const g1 = window.__tmSnap().filter((a) => a.target.startsWith('li.')).length;
      const second = flip(first); return { first, second, g1, glides: window.__tmSnap().filter((a) => a.target.startsWith('li.')).length }; });
    await wait(1200);
    const leftA = await snap(p);
    check(!!twice.first && !!twice.second && twice.g1 > 0 && twice.glides > 0 && (await offPlace(p)) < 0.01 && (await rowsState(p)).every((r) => r.tf === 'none') && leftA.length === 0, 'a press during a glide lands, and the rows end in place', `${twice.first} then ${twice.second}, glides ${twice.g1} then ${twice.glides}, worst offset ${(await offPlace(p)).toFixed(3)} px, left ${JSON.stringify(leftA.slice(0, 2))}`);
    check(await p.evaluate(() => window.__motion.arrivals === 1), 'the first arrival ran once per page load, not again on a re-sort');

    // 2c. the verdict
    await p.click('#sites li.a-row button');
    await p.waitForFunction(() => document.body.classList.contains('mode-surface') && document.querySelector('#verdict .v-head') && !document.getElementById('fade').classList.contains('on'), null, { timeout: 30000 });
    await wait(1500);
    check((await snap(p)).filter((a) => /^m-/.test(a.name)).length === 0 && await p.evaluate(() => !/m-lit|m-shade/.test(document.getElementById('verdict').className)), 'the verdict sweep is over after its time and leaves nothing on the panel');
    const sweeps = () => p.evaluate(() => window.__motion.sweeps);
    const s0 = await sweeps();
    // a new day, then the host paints the same verdict again 150 ms later (mid sweep), then again after the sweep
    const day = await p.evaluate(async () => { const day = () => window.__verdict.date, d0 = day();
      document.querySelector('#verdict .v-date button:nth-of-type(2)').click();
      const d1 = day(), ok = window.__verdict.ok, a1 = window.__tmSnap();
      await new Promise((r) => setTimeout(r, 150));
      document.getElementById('m-days').dispatchEvent(new Event('change'));
      const mid = window.__tmSnap().find((a) => /^m-(light|shade)$/.test(a.name)); // progress: a restarted sweep would read 0
      const n1 = window.__motion.sweeps;
      await new Promise((r) => setTimeout(r, 900));
      document.getElementById('m-days').dispatchEvent(new Event('change'));
      return { d0, d1, ok, a1, mid: mid && mid.pr, n1, n2: window.__motion.sweeps, left: window.__tmSnap().filter((a) => /^m-/.test(a.name)).length }; });
    seen.push(...day.a1);
    const want = day.ok ? 'm-light' : 'm-shade';
    check(day.d0 !== day.d1 && day.n1 === s0 + 1 && day.a1.some((a) => a.name === want && a.pseudo === '::after'), 'a new day runs the sweep once: ' + (day.ok ? 'a line of light (survives)' : 'a shadow (lost)'), day.a1.map((a) => a.name).join());
    check(day.mid !== undefined && day.mid > 0.25 && day.n2 === s0 + 1, 'the same verdict painted again mid sweep carries on, it does not restart or run twice', day.mid !== undefined ? `${Math.round(day.mid * 100)}% through its time` : 'sweep gone');
    check(day.left === 0, 'the same verdict painted again after the sweep shows nothing');
    // a click in the middle of the sweep (frozen halfway): a second day lands, with a real mouse
    await p.click('#verdict .v-date button:nth-of-type(2)');
    await p.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 200; } });
    const dA = await verdictDay(p);
    await p.click('#verdict .v-date button:nth-of-type(2)');
    check(dA !== await verdictDay(p), 'a day button clicked in the middle of the sweep lands', `${dA} -> ${await verdictDay(p)}`);
    // the other verdict: walk until the verdict flips and check it gets the other sweep
    let flipped = null;
    for (const sel of ['nth-of-type(4)', 'nth-of-type(3)', 'nth-of-type(5)', 'nth-of-type(6)', 'nth-of-type(4)', 'nth-of-type(4)']) {
      await wait(700);
      const r = await p.evaluate((sel) => { const was = window.__verdict.ok; document.querySelector('#verdict .v-date button:' + sel).click(); return { was, now: window.__verdict.ok, snap: window.__tmSnap() }; }, sel);
      if (r.was !== r.now) { flipped = r; break; }
    }
    seen.push(...(flipped ? flipped.snap : []));
    check(!!flipped && flipped.snap.some((a) => a.name === (flipped.now ? 'm-light' : 'm-shade')), 'the verdict flipping runs the matching sweep', flipped ? `${flipped.was ? 'survived' : 'lost'} -> ${flipped.now ? 'survived' : 'lost'}: ${flipped.snap.map((a) => a.name).join()}` : 'no click flipped the verdict');
    await wait(900);

    // 2d. small things: the side panel slides and fades in; a button is clickable at every moment
    // (on the map: on the site screen the Details button sits over the panel's close button, as it always did)
    await p.evaluate(() => document.getElementById('back').click());
    await p.waitForFunction(() => document.body.classList.contains('mode-overview'), null, { timeout: 30000 });
    await wait(1200);
    if (await hasNav(p)) {
      await p.click('#topbar nav button[data-panel="validation"]');
      const o0 = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('panel')); return { op: +cs.opacity, tf: cs.transform }; });
      const pan = await look(p);
      await p.click('#panel-close'); // clicked while it is still opening
      await wait(500);
      const closed = await p.evaluate(() => ({ open: document.getElementById('panel').classList.contains('open'), x: document.getElementById('panel').getBoundingClientRect().left, w: innerWidth }));
      check(pan.some((a) => a.target === 'panel') && o0.op < 1 && !closed.open && closed.x >= closed.w - 1, 'the side panel fades and slides in, and the close button works while it is opening', JSON.stringify({ ...o0, ...closed }));
      await p.click('#topbar nav button[data-panel="about"]'); await wait(450);
      check(await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('panel')); return cs.opacity === '1' && cs.transform === 'none'; }) && (await snap(p)).filter((a) => a.target === 'panel').length === 0, 'the side panel rests fully open: opacity 1, no transform, no animation');
      await p.click('#panel-close'); await wait(400);
    } else check(true, 'side panel checks skipped, its buttons are hidden at this width (app.css, max-width 760px)');
    // The focus ring is left to app.css: motion adds no outline to a control at rest (a transparent one shows as a box in forced colours).
    const ring = await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('.a-range button[data-y="1m"]')); return { style: cs.outlineStyle, tr: cs.transitionProperty }; });
    check(ring.style === 'none' && !/outline/.test(ring.tr), 'motion puts no outline on a button at rest and fades none', JSON.stringify(ring));
    // 2e. every animation seen belongs to the motion language: transform, opacity, background position, clip path
    const mine = seen.filter((a) => /^m-/.test(a.name) || a.name === 'script' || a.target === 'panel' || /outline/.test(a.name));
    const bad = mine.filter((a) => a.props.some((k) => !MOTION_ONLY.includes(k)));
    const names = [...new Set(mine.map((a) => a.name))];
    check(mine.length > 0 && bad.length === 0 && mine.every((a) => !/linear/.test(a.name)), 'every animation of ours moves only transform, opacity or background position', bad.length ? JSON.stringify(bad[0]) : names.join(', '));
    await p.context().close();
  }

  // 3. at rest, the screen is the same with and without motion
  const rest = async (w, h, blocked) => {
    const p = await open({ w, h, blocked });
    await ready(p);
    await wait(4400); // the opening move of the camera ends, the first arrival ends
    await p.addStyleTag({ content: '.kl-prev canvas, #landerfx { visibility: hidden !important }' }); // the 3D lander in its card turns by itself
    // the Moon turns and the map clock runs on real time: freeze both at the same moment for both pages
    await p.evaluate(() => { window.__app.S.held = true; window.__ov.theta = 0; window.__app.S.mapT = Math.floor(Date.now() / 86400000) * 86400 + 43200; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
    await wait(300);
    const png = await p.screenshot({ path: path.join(SHOTS, `rest-${w}x${h}-${blocked ? 'blocked' : 'motion'}.png`) });
    // the boxes of every element of the UI, to a hundredth of a pixel, and its colours: pixels alone could hide a 1 px shift on a dark panel
    const boxes = await p.evaluate(() => [...document.querySelectorAll('#topbar *, #sitelist *, #kidbar *, #hud *, #dock *')].map((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return [e.tagName, e.id, Math.round(r.left * 100), Math.round(r.top * 100), Math.round(r.width * 100), Math.round(r.height * 100), cs.color, cs.backgroundColor, cs.opacity, cs.transform].join('|'); }));
    await p.context().close();
    return { png: png.toString('base64'), boxes };
  };
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const [ra, rc] = [await rest(w, h, false), await rest(w, h, true)], [a, c] = [ra.png, rc.png];
    const boxDiff = ra.boxes.length !== rc.boxes.length ? -1 : ra.boxes.filter((x, i) => x !== rc.boxes[i]).length;
    check(boxDiff === 0 && ra.boxes.length > 100, `at rest every box, colour, opacity and transform on the first screen is the same with and without motion at ${w}x${h}`, `${ra.boxes.length} elements, ${boxDiff} differ${boxDiff > 0 ? ': ' + ra.boxes.find((x, i) => x !== rc.boxes[i]) + ' vs ' + rc.boxes[ra.boxes.findIndex((x, i) => x !== rc.boxes[i])] : ''}`);
    const pg = await (await b.newContext()).newPage();
    const diff = await pg.evaluate(async ([a, c]) => {
      const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
      const [x, y] = [await load(a), await load(c)], cv = document.createElement('canvas'); cv.width = x.width; cv.height = x.height;
      const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(x, 0, 0); const A = g.getImageData(0, 0, cv.width, cv.height).data; g.clearRect(0, 0, cv.width, cv.height); g.drawImage(y, 0, 0); const B = g.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0, worst = 0; for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > 8) n++; if (d > worst) worst = d; }
      return { w: cv.width, h: cv.height, n, worst, share: n / (cv.width * cv.height), same: x.width === y.width && x.height === y.height };
    }, [a, c]);
    await pg.context().close();
    check(diff.same && diff.share < 0.0012, `at rest the first screen is the same with and without motion at ${w}x${h}`, `${diff.n} of ${diff.w * diff.h} pixels differ by more than 8 (${(diff.share * 100).toFixed(4)}%), worst channel step ${diff.worst}`);
  }

  await b.close(); if (srv) srv.close();
  for (const e of [...new Set(errs)]) check(false, 'page error', e);
  console.log(fails.length ? `\n${fails.length} failed: ${fails.join('; ')}` : `\nall motion checks passed (${TAG})`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
