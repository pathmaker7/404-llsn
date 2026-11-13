// The map screen's answer: one row per site, one column per landing day over a period the user sets.
// Green: a solar robot landing that day survives its stay. Red: it is lost. Same rules as the site panel (verdict.js#judgeAt).
import { loadSky } from './data.js';
import { judgeAt } from './verdict.js';

const I = globalThis.I18n, L = (k, v) => I.t(k, v), DAY = 86400;
const MUST = ['night', 'radio', 'light', 'slope'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
// Not by colour alone: lost is darker than survives, and where days are separate blocks a lost day is a shorter block.
const OK = [95, 211, 141], BAD = [150, 50, 58], LOW = 0.4;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

/** One byte per landing day of the whole period: 0 survives, otherwise 1 + index in MUST of the first failed check.
 *  out.val[d]: the hours behind that failed check (longest night or longest radio silence), for the hover line. */
export function dayVerdicts(sky, slope, evaSlope, days) {
  const W = days * 24, nd = Math.floor((sky.n - W) / 24) + 1, out = new Uint8Array(nd);
  out.val = new Uint16Array(nd);
  for (let d = 0; d < nd; d++) {
    const x = judgeAt(sky, d * 24, W, slope, evaSlope);
    if (!x.ok) { const r = x.rows.find((r) => r.pri === 'must' && r.ok === false); out[d] = 1 + MUST.indexOf(r.id); out.val[d] = Math.min(r.v, 65535) || 0; }
  }
  return out;
}

/** root: the panel element. sites: [{ id, name, ref, dir, slope, evaSlope }]. p0, p1: period (unix s). onPick(id, t or null). */
export function allSites(root, { sites, days, p0, p1, onPick, onHover = () => {}, onTime = () => {}, onPlay = () => {}, onLimits = () => {}, onAdd = () => {}, famous = [] }) {
  const Mi = globalThis.Mission;
  const nd = Math.floor(((p1 - p0) / 3600 + 1 - days * 24) / 24) + 1;
  const today = Math.floor(Date.now() / 1000 / DAY) * DAY, td = Math.round((today - p0) / DAY);
  const clampDay = (d) => Math.min(Math.max(d, 0), nd);
  // The day index n years after today (0.25 = three months).
  const y = (n) => { const d = new Date(today * 1000); d.setUTCMonth(d.getUTCMonth() + Math.round(n * 12)); return clampDay(Math.round((d.getTime() / 1000 - p0) / DAY)); };
  const st = { a: td, b: y(1 / 12), ready: false, rows: sites }; // opens on the next month; the buttons narrow or widen it
  const dayOf = (v) => Math.round((Date.parse(v + 'T00:00:00Z') / 1000 - p0) / DAY);

  root.innerHTML = `<div class="a-head"><h2></h2><div class="a-play"><button id="a-play">▶</button><span id="a-clock"></span></div><div class="a-range">
      <label><span></span> <input type="date" id="a-from" min="${iso(p0)}" max="${iso(p0 + (nd - 1) * DAY)}"></label>
      <label><span></span> <input type="date" id="a-to" min="${iso(p0 + DAY)}" max="${iso(p0 + nd * DAY)}"></label>
      <button data-y="2w"></button><button data-y="1m"></button><button data-y="0.25"></button><button data-y="1"></button><button data-y="5"></button><button data-y="0"></button></div></div>
    <details class="a-more"><summary></summary><div class="a-mission"><span class="tip" tabindex="0">ⓘ</span> <label><span></span> <input id="a-night" type="number" min="0" max="30" step="0.5"></label><label><span></span> <input id="a-radio" type="number" min="0" max="30" step="0.5"></label><button id="a-reset"></button><span class="a-add"><select id="a-famous"></select><input id="a-lat" type="number" min="-90" max="90" step="any"><input id="a-lon" type="number" min="-180" max="360" step="any"><button id="a-addbtn"></button></span></div></details>
    <div class="a-row a-axis"><span></span><canvas></canvas><span></span></div>
    <ol id="sites"><div id="a-headline"></div></ol>
    <p class="v-key"><i class="ok"></i><span></span> <i class="bad"></i><span></span> <i class="cur"></i><span></span> <span class="tip" tabindex="0">ⓘ</span> <span class="a-hint"></span></p>
    <div id="a-tip"></div>`;
  root.querySelector('.a-more').open = window.innerWidth > 700;
  const ol = root.querySelector('#sites'), tip = root.querySelector('#a-tip'), axis = root.querySelector('.a-axis canvas');
  const from = root.querySelector('#a-from'), to = root.querySelector('#a-to');

  function addRow(s) {
    const li = document.createElement('li');
    li.className = 'a-row'; li.dataset.id = s.id;
    li.onmouseenter = () => onHover(s.id); li.onmouseleave = () => onHover(null);
    li.innerHTML = `<button title="${s.ref}">${s.name}<small>${s.ref}</small></button><canvas></canvas><span class="cnt"></span>`;
    li.querySelector('button').onclick = () => onPick(s.id, null);
    const cv = li.querySelector('canvas');
    const dayAt = (e) => st.a + Math.min(Math.floor((e.offsetX / cv.clientWidth) * (st.b - st.a)), st.b - st.a - 1);
    cv.onpointermove = (e) => {
      if (!s.v) return;
      const d = dayAt(e), why = s.v[d];
      onTime(p0 + d * DAY + DAY / 2); // the Moon above shows the sunlight at noon of the day under the pointer
      const date = new Date((p0 + d * DAY) * 1000).toLocaleDateString(I.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      const num = why === 1 || why === 2 ? ' ' + L('vDays', { t: (s.v.val[d] / 24).toFixed(1) }) + ', ' + L(why === 1 ? 'lNight' : 'lRadio', { n: +((why === 1 ? Mi.limits.nightH : Mi.limits.silenceH) / 24).toFixed(1) }) : '';
      tip.textContent = `${s.name} · ${date}: ${why ? L('mLostShort') + ' (' + L('r' + cap(MUST[why - 1])) + num + ')' : L('mOkShort')}`;
      tip.style.display = 'block';
      tip.style.left = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8) + 'px';
      tip.style.top = e.clientY - 34 + 'px';
    };
    cv.onpointerleave = () => { tip.style.display = 'none'; };
    cv.onclick = (e) => onPick(s.id, p0 + dayAt(e) * DAY);
    s.li = li; s.cv = cv;
    ol.appendChild(li);
  }
  for (const s of sites) addRow(s);

  const fit = (cv, hCss) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(Math.round(cv.clientWidth * dpr), 1), h = Math.round(hCss * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { g: cv.getContext('2d'), w, h, dpr };
  };
  const xOf = (d, w) => ((d - st.a) / (st.b - st.a)) * w;

  function paintRow(s) {
    const { g, w, h, dpr } = fit(s.cv, 12), span = st.b - st.a;
    if (!s.v) { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, w, h); return 0; }
    let good = 0;
    for (let d = st.a; d < st.b; d++) good += s.v[d] === 0;
    if (w / span >= 6) { // room for it: every landing day is its own block, today has a white frame
      const gap = w / span >= 16 ? 3 : 1;
      g.clearRect(0, 0, w, h);
      for (let d = st.a; d < st.b; d++) {
        const x0 = Math.round(xOf(d, w)), x1 = Math.round(xOf(d + 1, w)) - gap;
        const y0 = s.v[d] === 0 ? 0 : Math.round(h * LOW);
        g.fillStyle = `rgb(${(s.v[d] === 0 ? OK : BAD).join(',')})`; g.fillRect(x0, y0, x1 - x0, h - y0);
        if (d === td) { g.strokeStyle = '#fff'; const t = 1.5 * dpr; g.lineWidth = t; g.strokeRect(x0 + t / 2, y0 + t / 2, x1 - x0 - t, h - y0 - t); }
      }
      return good;
    }
    for (let x = 0; x < w; x++) {
      const d0 = st.a + Math.floor((x * span) / w), d1 = Math.max(d0 + 1, st.a + Math.floor(((x + 1) * span) / w));
      let ok = 0;
      for (let d = d0; d < d1; d++) ok += s.v[d] === 0;
      const f = ok / (d1 - d0); // several days share one pixel on long periods: the colour is their mix
      g.fillStyle = `rgb(${BAD.map((c, i) => Math.round(c + (OK[i] - c) * f)).join(',')})`;
      g.fillRect(x, 0, 1, h);
    }
    if (td >= st.a && td < st.b) { g.fillStyle = '#fff'; g.fillRect(Math.round(xOf(td, w)), 0, Math.max(2, Math.round(w / span / 4)), h); }
    return good;
  }

  function paintAxis() {
    const { g, w, h, dpr } = fit(axis, 22), span = st.b - st.a, months = span <= 800;
    g.clearRect(0, 0, w, h);
    g.font = `${11 * dpr}px "IBM Plex Mono", monospace`; g.textBaseline = 'top';
    const d = new Date((p0 + st.a * DAY) * 1000); d.setUTCDate(1); if (!months) d.setUTCMonth(0);
    let last = -1e9;
    if (span <= 45) { // short period: one tick per day, the day of the month under it, the month named on its first day
      for (let k = st.a; k < st.b; k++) {
        const x = xOf(k, w), dt = new Date((p0 + k * DAY) * 1000), first = dt.getUTCDate() === 1 || k === st.a;
        g.fillStyle = 'rgba(150,170,200,.35)'; g.fillRect(Math.round(x), h - 5 * dpr, 1, 5 * dpr);
        if (x - last < (first ? 0 : 26) * dpr) continue;
        g.fillStyle = first ? '#dfe6f2' : 'rgba(200,210,230,.6)';
        g.fillText(first ? dt.toLocaleDateString(I.lang, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : String(dt.getUTCDate()), x + 3 * dpr, 0);
        last = first ? x + 30 * dpr : x;
      }
      return;
    }
    for (; ; months ? d.setUTCMonth(d.getUTCMonth() + 1) : d.setUTCFullYear(d.getUTCFullYear() + 1)) {
      const x = xOf((d.getTime() / 1000 - p0) / DAY, w);
      if (x > w) break;
      if (x < 0) continue;
      const jan = d.getUTCMonth() === 0;
      g.fillStyle = jan ? 'rgba(220,228,240,.7)' : 'rgba(150,170,200,.35)';
      g.fillRect(Math.round(x), h - (jan ? 9 : 5) * dpr, 1, (jan ? 9 : 5) * dpr);
      if (x - last < 58 * dpr || x > w - 30 * dpr) continue;
      g.fillStyle = jan ? '#dfe6f2' : 'rgba(200,210,230,.6)';
      g.fillText(jan || !months ? String(d.getUTCFullYear()) : d.toLocaleDateString(I.lang, { month: 'short', timeZone: 'UTC' }), x + 3 * dpr, 0);
      last = x;
    }
  }

  function redraw() {
    root.querySelector('h2').textContent = L('aTitle');
    const [lf, lt] = root.querySelectorAll('.a-range label span'); lf.textContent = L('aFrom'); lt.textContent = L('aTo');
    from.value = iso(p0 + st.a * DAY); to.value = iso(p0 + st.b * DAY);
    for (const b of root.querySelectorAll('.a-range button')) {
      const k = b.dataset.y, n = +k, r = k === '2w' ? [td, clampDay(td + 14)] : k === '1m' ? [td, y(1 / 12)] : n ? [td, y(n)] : [0, nd];
      b.textContent = L(k === '2w' ? 'a2w' : k === '1m' ? 'a1m' : n === 0.25 ? 'a3m' : n === 1 ? 'a1y' : n === 5 ? 'a5y' : 'aAll');
      b.classList.toggle('on', r[0] === st.a && r[1] === st.b);
      b.onclick = () => { [st.a, st.b] = r; redraw(); };
    }
    const key = root.querySelectorAll('.v-key > span');
    key[0].textContent = L('mOkShort'); key[1].textContent = L('mLostShort'); key[2].textContent = L('aToday');
    key[3].dataset.tip = L('aTip'); key[4].textContent = L('aHint');
    const [ln, lr] = root.querySelectorAll('.a-mission label span'); ln.textContent = L('aBattery'); lr.textContent = L('aRadio');
    root.querySelector('.a-mission .tip').dataset.tip = L('aLimitsTip'); root.querySelector('#a-reset').textContent = L('aReset');
    for (const [id, k] of [['#a-night', 'nightH'], ['#a-radio', 'silenceH']]) { const el = root.querySelector(id); if (document.activeElement !== el) el.value = +(Mi.limits[k] / 24).toFixed(1); }
    root.querySelector('#a-reset').hidden = Mi.limits.nightH === Mi.NIGHT_LIMIT_H && Mi.limits.silenceH === Mi.SILENCE_LIMIT_H;
    const fam = root.querySelector('#a-famous');
    fam.innerHTML = `<option value="">${L('aAddSite')}</option>` + famous.map((f, i) => `<option value="${i}">${f.name}</option>`).join('');
    root.querySelector('#a-lat').placeholder = L('aLat'); root.querySelector('#a-lon').placeholder = L('aLon');
    const ab = root.querySelector('#a-addbtn'); ab.textContent = L('aAddBtn'); ab.title = L('aAddTip');
    root.querySelector('.a-more > summary').textContent = L('aMore');
    paintAxis();
    for (const s of sites) {
      s.good = paintRow(s);
      s.li.querySelector('.cnt').innerHTML = s.v ? `<b>${s.good}</b> / ${st.b - st.a}` : '…';
    }
    // Best site for the chosen period first. Only once every row is known, so rows do not jump while loading.
    if (st.ready) for (const s of [...sites].sort((p, q) => q.good - p.good)) ol.appendChild(s.li);
    globalThis.__all = { ready: st.ready, a: st.a, b: st.b, from: from.value, to: to.value, rows: sites.map((s) => ({ id: s.id, good: s.good, total: st.b - st.a })),
      at: (id, date) => sites.find((s) => s.id === id).v[dayOf(date)] === 0 /* does a landing that day survive: what the cell's colour says */ };
  }
  const setRange = () => {
    const a = clampDay(dayOf(from.value)), b = clampDay(dayOf(to.value));
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) { st.a = a; st.b = b; }
    redraw();
  };
  from.onchange = setRange; to.onchange = setRange;

  redraw();
  (async () => {
    for (const s of sites) {
      s.sky = await loadSky(s.dir);
      s.v = dayVerdicts(s.sky, s.slope, s.evaSlope, days);
      redraw();
      await new Promise((r) => setTimeout(r)); // let the row paint before the next site is computed
    }
    st.ready = true; redraw();
  })();
  root.querySelector('#a-play').onclick = () => onPlay();
  root.querySelector('#a-famous').onchange = (e) => { const f = famous[+e.target.value]; if (e.target.value !== '' && f) onAdd(f.lat, f.lon, f.name); e.target.value = ''; };
  root.querySelector('#a-addbtn').onclick = () => {
    const la = root.querySelector('#a-lat'), lo = root.querySelector('#a-lon'), lat = parseFloat(la.value), lon = parseFloat(lo.value);
    const bad = !(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 360);
    la.classList.toggle('bad', !(lat >= -90 && lat <= 90)); lo.classList.toggle('bad', !(lon >= -180 && lon <= 360));
    if (!bad) { onAdd(lat, lon, null); la.value = lo.value = ''; }
  };
  /** A site added by the user gets its own row, judged like the others. */
  async function add(s) {
    sites.push(s); addRow(s); redraw();
    s.sky = await loadSky(s.dir); s.v = dayVerdicts(s.sky, s.slope, s.evaSlope, days); redraw();
  }
  // The mission's own limits: every site and day is judged again with them, here and on the site screen.
  function setLimits(nightDays, radioDays) {
    const ok = (v) => Number.isFinite(v) && v >= 0 && v <= 30;
    if (ok(nightDays)) Mi.limits.nightH = nightDays * 24;
    if (ok(radioDays)) Mi.limits.silenceH = radioDays * 24;
    for (const s of sites) if (s.sky) s.v = dayVerdicts(s.sky, s.slope, s.evaSlope, days);
    redraw(); onLimits();
  }
  root.querySelector('#a-night').onchange = (e) => setLimits(+e.target.value, NaN);
  root.querySelector('#a-radio').onchange = (e) => setLimits(NaN, +e.target.value);
  root.querySelector('#a-reset').onclick = () => setLimits(Mi.NIGHT_LIMIT_H / 24, Mi.SILENCE_LIMIT_H / 24);
  /** Moves the time line over the rows and writes the clock. t: unix s. */
  const head = root.querySelector('#a-headline'), clock = root.querySelector('#a-clock'), play = root.querySelector('#a-play');
  function setHead(t, playing) {
    const d = (t - p0) / DAY, cv = sites[0].cv, on = d >= st.a && d <= st.b;
    head.style.display = on ? 'block' : 'none';
    if (on) head.style.left = cv.offsetLeft + ((d - st.a) / (st.b - st.a)) * cv.clientWidth + 'px';
    const txt = new Date(t * 1000).toLocaleString(I.lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }) + ' UTC';
    if (clock.textContent !== txt) clock.textContent = txt;
    play.textContent = playing ? '❚❚' : '▶'; play.title = L('aPlay');
  }
  return { redraw, setHead, setLimits, add, add, range: () => [p0 + st.a * DAY, p0 + st.b * DAY] };
}
