// Help for a first visit. Three things, so that a child who has never seen the page knows what to press:
//   1. a tour of the first screen: five steps, each lights the thing it talks about; it starts by itself on the first
//      visit and the "How to play" button starts it again;
//   2. a "How to play" card with three numbered steps the first time a toy is opened (Ice hunter, Quiz, Keep me alive);
//   3. Keep me alive on the first screen: the game lives on a site, so this button opens the best site of the period on
//      its next surviving day and starts the game there.
// What was seen is kept in localStorage "kidSeen"; "kidHelp" = "off" turns the automatic help off (the tests of the
// other features set it, tools/test-tour.cjs does not).
const I = globalThis.I18n, L = (k, v) => I.t(k, v);
const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const seen = () => { try { return JSON.parse(read('kidSeen') || '{}') || {}; } catch (e) { return {}; } };
const mark = (k) => { try { localStorage.setItem('kidSeen', JSON.stringify({ ...seen(), [k]: 1 })); } catch (e) { /* storage blocked: the help shows again next time */ } };
const quiet = () => read('kidHelp') === 'off';

// The tour: what to light, in order. A step whose target is missing (a feature that failed to start) is skipped.
const STEPS = [['#sitelist', 'kT1'], ['.kl-card', 'kT2'], ['#kt-game', 'kT3'], ['#ice-btn', 'kT4'], ['.kq-btn', 'kT5']];
// The toys with a "How to play" card, and the buttons that open them.
const HOW = { game: '#g-open, #kt-game', ice: '#ice-btn', quiz: '.kq-btn' };

export function init(kid) {
  const bar = document.getElementById('kidbar'); if (!bar) return;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (cls, id) => { const b = el('button', cls); b.type = 'button'; if (id) b.id = id; return b; };
  const gameBtn = btn('kidbtn', 'kt-game'), helpBtn = btn('kidbtn kt-helpbtn', 'kt-help');
  bar.append(gameBtn, helpBtn);
  // block: the layer that takes every press beside the lit thing; it has a hole over the lit thing, so that one can be pressed.
  const root = el('div'), block = el('div', 'kt-block'), ring = el('div', 'kt-ring'), card = el('div', 'kt-card');
  root.id = 'kt'; root.hidden = true; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
  root.append(block, ring, card); document.body.append(root);
  let view = null; // { kind: 'tour', i } or { kind: 'how', key, go }

  // Names of buttons inside the help texts come from the buttons' own texts, so the two can never differ.
  const vars = () => ({ a: new Date(kid.periodStart() * 1000).getUTCFullYear(), b: new Date(kid.periodEnd() * 1000).getUTCFullYear(),
    ice: L('kIBtn'), quiz: L('kQBtn'), game: L('kTGame'), green: L('kGGreen'), red: L('kGRed'), start: L('kGStart'), next: L('kQNext'), go: L('kTStart'),
    dark: L('kIDarkHead'), lit: L('kILitHead'), floor: I.place('Shackleton floor') });
  const steps = () => STEPS.filter(([sel]) => document.querySelector(sel));

  function draw() {
    if (!view) return;
    card.textContent = '';
    const x = btn('kt-x'); x.textContent = '×'; x.title = x.ariaLabel = L('kTClose'); x.onclick = close;
    const foot = el('div', 'kt-foot');
    if (view.kind === 'tour') {
      const all = steps(), key = all[view.i][1], last = view.i === all.length - 1;
      card.append(x, el('div', 'kt-step', L('kTStep', { n: view.i + 1, m: all.length })), el('h3', '', L(key + 't', vars())), el('p', '', L(key, vars())));
      const skip = btn('kt-ghost'), back = btn('kt-ghost'), next = btn('kt-go');
      skip.textContent = L('kTSkip'); skip.onclick = close;
      back.textContent = L('kTBack'); back.onclick = () => { view.i--; draw(); }; back.hidden = view.i === 0;
      next.textContent = L(last ? 'kTDone' : 'kTNext'); next.onclick = () => { if (last) close(); else { view.i++; draw(); } };
      if (!last) foot.append(skip); foot.append(back, next);
      card.append(foot); place(); next.focus();
    } else {
      const k = { game: 'kTGame', ice: 'kTIce', quiz: 'kTQuiz' }[view.key], ol = el('ol', 'kt-steps');
      // key + 0 is the goal in one sentence; key + 1, 2, 3... are the presses, in order, as many as the texts hold
      for (let n = 1; I.S.en[k + n] != null; n++) ol.append(el('li', '', L(k + n, vars())));
      const go = btn('kt-go'); go.textContent = L('kTStart');
      go.onclick = () => { const f = view.go; mark(view.key); close(); f(); };
      foot.append(go); card.append(x, el('h3', '', L(k + 'T', vars())), el('p', 'kt-goal', L(k + 0, vars())), ol, foot); place(); go.focus();
    }
  }

  // The ring goes around the thing the step talks about; the card sits beside it, else above it, else below it.
  function place() {
    const W = window.innerWidth, H = window.innerHeight, t = view.kind === 'tour' ? document.querySelector(steps()[view.i][0]) : null, r = t && t.getBoundingClientRect();
    root.classList.toggle('dim', !r);
    block.style.clipPath = r ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${r.left}px ${r.top}px, ${r.right}px ${r.top}px, ${r.right}px ${r.bottom}px, ${r.left}px ${r.bottom}px, ${r.left}px ${r.top}px)` : 'none';
    if (!r) { ring.style.display = 'none'; Object.assign(card.style, { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }); return; }
    ring.style.display = ''; Object.assign(ring.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
    card.style.transform = 'none';
    const cw = card.offsetWidth, ch = card.offsetHeight, G = 18; let cx, cy;
    if (r.right + G + cw <= W - 8 && r.height < H * 0.6) { cx = r.right + G; cy = r.top; }
    else if (r.top - G - ch >= 8) { cx = r.left + r.width / 2 - cw / 2; cy = r.top - G - ch; }
    else { cx = r.left + r.width / 2 - cw / 2; cy = r.bottom + G; }
    card.style.left = Math.min(Math.max(cx, 8), W - cw - 8) + 'px'; card.style.top = Math.min(Math.max(cy, 8), H - ch - 8) + 'px';
  }

  function show(v) { view = v; root.hidden = false; draw(); }
  function close() { if (!view) return; if (view.kind === 'tour') mark('tour'); view = null; root.hidden = true; }
  const startTour = () => { if (kid.S.mode === 'overview' && steps().length) show({ kind: 'tour', i: 0 }); };
  const showHow = (key, go) => show({ kind: 'how', key, go });

  // The first press on a toy's button shows how to play; "Start" then presses that button for real.
  let pass = false;
  // In the tour only the lit thing takes a press (the hole in the block layer). A lit toy button ends the tour; a press
  // inside the calendar or the lander card may change its size, so the ring is fitted again.
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    if (view && view.kind === 'tour' && !root.contains(e.target)) { if (e.target.closest(Object.values(HOW).join(', '))) close(); else setTimeout(() => { if (view) place(); }, 300); }
    if (pass || quiet()) return;
    for (const [key, sel] of Object.entries(HOW)) {
      const b = e.target.closest(sel); if (!b || seen()[key]) continue;
      e.stopImmediatePropagation(); e.preventDefault();
      showHow(key, () => { pass = true; try { b.click(); } finally { pass = false; } });
      return;
    }
  }, true);

  // Keep me alive from the first screen: the best site of the period shown (the first row), on its next landing day
  // that survives as the grid judges it (today when it has none in 60 days), then the game's own button.
  async function playFromMap() {
    const li = document.querySelector('#sites li.a-row'); if (!li) return;
    const id = li.dataset.id, s = kid.siteEntry(id), DAY = 86400, today = Math.floor(Date.now() / 1000 / DAY) * DAY;
    let t = today;
    for (let k = 0; k < 60; k++) { let ok = false; try { ok = globalThis.__all.at(id, new Date((today + k * DAY) * 1000).toISOString().slice(0, 10)); } catch (e) { break; } if (ok) { t = today + k * DAY; break; } }
    kid.S.missionStart = t; kid.S.t = t;
    await kid.enterSite(id, s.variants.best ? 'best' : 'databook');
    pass = true; try { document.getElementById('g-open')?.click(); } finally { pass = false; }
  }
  gameBtn.onclick = playFromMap;
  // "How to play" shows everything again: the tour now, and each toy's card on its next press.
  helpBtn.onclick = () => { try { localStorage.setItem('kidSeen', JSON.stringify({ tour: seen().tour })); } catch (e) { /* storage blocked: the cards were never marked as seen */ } startTour(); };
  // A day picked in the lit calendar: the tour steps aside before the lander's drop is played.
  kid.dayPick.unshift(() => { if (view && view.kind === 'tour') close(); });

  function texts() { gameBtn.textContent = L('kTGame'); gameBtn.title = L('kTGameTip'); helpBtn.textContent = L('kTHelp'); helpBtn.title = L('kTHelpTip'); draw(); }
  texts();
  kid.lang.push(texts);
  window.addEventListener('resize', () => { if (view) place(); });
  window.addEventListener('keydown', (e) => { if (view && e.key === 'Escape') { e.stopPropagation(); close(); } }, true);
  // The tour belongs to the first screen: it closes when a site opens, and a first visit that began on a site (a shared
  // link) gets it on coming back to the map.
  const auto = () => { if (!quiet() && !seen().tour && !view && kid.S.mode === 'overview' && !document.documentElement.classList.contains('embed')) startTour(); };
  kid.mode.push((m) => { if (m === 'surface') { if (view && view.kind === 'tour') close(); } else setTimeout(auto, 900); });
  setTimeout(auto, 1800); // after the opening move of the Moon has begun

  window.__tour = { start: startTour, how: showHow, close, play: playFromMap, get view() { return view && { kind: view.kind, i: view.i, key: view.key, steps: steps().length }; } };
}
