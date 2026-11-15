// Motion: the script half of app/css/motion.css. It plugs into the two documented points and never edits another file.
//   SiteListExtras: rank changes glide (FLIP) and the list is lit once when it first becomes ready.
//   VerdictExtras: a verdict that changes (or a new day) gets one sweep of light (survives) or of shadow (lost).
// Everything here only starts motion; it never waits for it and never blocks a click. With reduced motion it does nothing.
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => RM.matches;
const OUT = 'cubic-bezier(.22, .61, .36, 1)'; // ease out: the same curve as --m-out in motion.css

// What happened, for the test (tools/test-motion.cjs) and for anyone looking in the console.
const stats = (globalThis.__motion = { flips: 0, arrivals: 0, sweeps: 0 });

// the verdict
const SWEEP_MS = 420, FADE_WAIT_MS = 280; // the sweep; and how long it waits when the black screen fade is still lifting
let lastKey = null, sweep = null, sweepTimer = 0;

/** Called by verdict.js after every render of the answer panel. box is #v-extra; its parent is #verdict. */
function onVerdict(box, ctx, e) {
  const el = box && box.parentElement;
  if (!el || el.id !== 'verdict') return;
  const m = (ctx.site && ctx.site.meta) || {}, key = [m.lat, m.lon, ctx.t, e.ok ? 1 : 0].join('|');
  const now = performance.now(), kind = e.ok ? 'm-lit' : 'm-shade';
  if (reduced()) { lastKey = key; return; }
  if (key !== lastKey) {
    lastKey = key;
    // A new site opens under the black fade (#fade.on); let the screen clear first so the sweep is seen.
    const fade = document.getElementById('fade'), delay = fade && fade.classList.contains('on') ? FADE_WAIT_MS : 0;
    sweep = { kind, start: now, delay };
    stats.sweeps++;
  } else if (!sweep || now - sweep.start > sweep.delay + SWEEP_MS) {
    return; // the same verdict painted again, long after its sweep: nothing to show
  }
  // The host rebuilds the panel (and resets its class) on every render. A sweep in progress carries on where it was.
  el.style.setProperty('--m-delay', Math.round(sweep.delay - (now - sweep.start)) + 'ms');
  el.classList.remove('m-lit', 'm-shade');
  el.classList.add(sweep.kind);
  clearTimeout(sweepTimer);
  sweepTimer = setTimeout(() => { el.classList.remove('m-lit', 'm-shade'); el.style.removeProperty('--m-delay'); }, sweep.delay + SWEEP_MS + 120 - (now - sweep.start));
}
(globalThis.VerdictExtras ||= []).push(onVerdict);

// A site shown again after the map is a new arrival of its answer: forget what was last shown.
new MutationObserver(() => { if (document.body.classList.contains('mode-overview')) lastKey = null; })
  .observe(document.body, { attributes: true, attributeFilter: ['class'] });

// the site list
const FLIP_MS = 350, STAGGER_MS = 14, STAGGER_MAX_MS = 112, ARRIVE_MS = 480;
const lastTop = new Map(); // row -> its layout top (inside the list) at the end of the last call
const live = new Map();    // row -> the animation of mine that is playing on it
let lastOrder = '', arrived = false, arriveTimer = 0;

const playing = (li, a) => { live.set(li, a); const done = () => { if (live.get(li) === a) live.delete(li); }; a.onfinish = done; a.oncancel = done; };
/** The vertical offset a row is drawn at right now (my animation's current transform), so a glide interrupted halfway carries on from where the eye sees it. */
function drawnOffset(li) {
  if (!live.has(li)) return 0;
  const t = getComputedStyle(li).transform;
  if (t === 'none') return 0;
  try { return new DOMMatrixReadOnly(t).m42 || 0; } catch (e) { return 0; }
}

function onList({ root, ready }) {
  const ol = root.querySelector('#sites');
  if (!ol) return;
  const rows = [...ol.children].filter((c) => c.matches('li.a-row'));
  // Hidden (the site screen is showing) or not laid out yet: there is nothing to measure, so forget the old positions.
  if (!rows.length || !root.getClientRects().length || rows.some((li) => !li.offsetHeight)) { lastTop.clear(); lastOrder = ''; return; }
  const order = rows.map((li) => li.dataset.id).join(), tops = new Map(rows.map((li) => [li, li.offsetTop]));
  const first = ready && !arrived;

  if (reduced()) {
    for (const a of live.values()) a.cancel();
    if (ready) arrived = true;
  } else if (first) {
    arrived = true; arrive(ol, rows);
  } else if (ready && lastOrder && order !== lastOrder) {
    flip(rows, tops);
  }
  lastTop.clear(); for (const [li, t] of tops) lastTop.set(li, t);
  lastOrder = order;
}

/** Rank changed: every row that moved glides from where it was drawn to where the layout now puts it. Transform only. */
function flip(rows, tops) {
  const moves = [];
  for (const li of rows) {
    const was = lastTop.get(li);
    if (was === undefined) continue; // a row added just now has no old place
    const d = was + drawnOffset(li) - tops.get(li);
    if (live.has(li)) live.get(li).cancel();
    if (Math.abs(d) >= 0.5 && Math.abs(d) < 2000) moves.push({ li, d });
  }
  moves.forEach(({ li, d }, k) => {
    // The row that climbed stays in the light; the row it passed dims a little while it slides down: which overtook which.
    const a = li.animate([{ transform: `translateY(${d}px)`, opacity: d > 0 ? 1 : 0.7 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: FLIP_MS, delay: Math.min(k * STAGGER_MS, STAGGER_MAX_MS), easing: OUT, fill: 'backwards' });
    playing(li, a); stats.flips++;
  });
}

/** The list is ready for the first time: one line of light passes from the left, and the rows come in from the side behind it. */
function arrive(ol, rows) {
  stats.arrivals++;
  ol.classList.add('m-arrive');
  clearTimeout(arriveTimer);
  arriveTimer = setTimeout(() => ol.classList.remove('m-arrive'), 800);
  rows.forEach((li, k) => {
    if (live.has(li)) live.get(li).cancel();
    const a = li.animate([{ transform: 'translateX(-12px)', opacity: 0.45 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: ARRIVE_MS, delay: Math.min(k * 18, 180), easing: OUT, fill: 'backwards' });
    playing(li, a);
  });
}
(globalThis.SiteListExtras ||= []).push(onList);

// lists that open
// A details element opens with a short slide and fade (motion.css), only when the user opens it, not when the page builds it.
document.addEventListener('click', (ev) => {
  const sum = ev.target instanceof Element && ev.target.closest('summary');
  const d = sum && sum.parentElement;
  if (!d || d.tagName !== 'DETAILS' || d.open || reduced()) return;
  d.dataset.mOpen = '';
  setTimeout(() => delete d.dataset.mOpen, 300);
}, true);
