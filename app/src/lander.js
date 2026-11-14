// My lander: a customisable lander with a Central Asian hat that drops onto the Moon.
// kid: the slots main.js hands every kids feature (see main.js, "kids features").
//   * the card in #kidbar (type, colour, name, hat, live 3D preview), kept in localStorage under "myLander"
//   * the drop: a click on a day cell (dayPick) or on the Moon (dropped) flies the lander from the click onto the site,
//     and the verdict that decides how it ends is verdict.js#judgeAt, the same rule the grid cell was painted with
//   * the first person view: the lander stands on the terrain next to the viewer, lit by the real Sun
import * as THREE from '../vendor/three.module.js';
import { loadSky } from './data.js';
import { judgeAt } from './verdict.js';
import { sample } from './science.js';
import { Craft, TYPES, HATS, COLORS, makeHat, glowTexture, dustTexture } from './lander-models.js';

const I = globalThis.I18n, L = (k, v) => I.t(k, v), DAY = 86400, DEG = Math.PI / 180;
const SIZE = 1.35; // metres per model unit in the first person view
const KEY = 'myLander', DEFAULT = { type: 'lander', color: '#e5484d', name: 'Naryn-1', hat: 'kyrgyz' };
const HAT_KEY = { kyrgyz: 'kLHatKyrgyz', kazakh: 'kLHatKazakh', uzbek: 'kLHatUzbek', tajik: 'kLHatTajik', none: 'kLHatNone' };
const TYPE_KEY = { lander: 'kLTypeLander', rover: 'kLTypeRover', hopper: 'kLTypeHopper' };
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

// A name typed by a kid or read from storage: letters, digits and plain punctuation only, at most 20 characters.
// It is only ever written with textContent or drawn on a canvas, never into HTML.
export const cleanName = (s) => String(s ?? '').replace(/[^\p{L}\p{N} .,()'’+-]/gu, '').replace(/'/g, '’').replace(/\s+/g, ' ').trim().slice(0, 20);
export function normalize(o) {
  o = o && typeof o === 'object' ? o : {};
  return {
    type: TYPES.includes(o.type) ? o.type : DEFAULT.type,
    color: typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color.toLowerCase() : DEFAULT.color,
    name: cleanName(o.name) || DEFAULT.name,
    hat: HATS.includes(o.hat) ? o.hat : DEFAULT.hat,
  };
}
function loadCfg() { try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return { ...DEFAULT }; } }
function saveCfg(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* storage blocked */ } }

export function init(kid) {
  const { S, renderer, surface, overview } = kid;
  const Mi = globalThis.Mission;
  const gridDays = S.missionDays; // the day grid was judged for this stay (main.js#buildSiteList), so a click on a cell is judged for it too
  let cfg = loadCfg();
  const api = window.__lander = { hold: { pauseAt: null }, speed: 1 };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ------------------------------------------------------------------ the verdict
  // The same call as the grid (allsites.js#dayVerdicts): the point the app stands on, the landing day, the stay, the slope.
  async function judgeSite(id, t, days = gridDays) {
    const e = kid.siteEntry(id), v = e.variants[e.variants.best ? 'best' : 'databook'];
    const sky = await loadSky(v.dir), day = Math.floor(t / DAY) * DAY;
    const x = judgeAt(sky, Math.round((day - sky.t0) / 3600), Math.round(days * 24), v.slope_deg, S.extra[v.dir] ?? v.slope_deg);
    const bad = x.rows.find((r) => r.pri === 'must' && r.ok === false); // the first failed check in the grid's order: night, radio, light, slope
    return { siteId: id, t: day, date: new Date(day * 1000).toISOString().slice(0, 10), days, ok: x.ok, failed: bad ? bad.id : null, rows: x.rows, line: lineFor(x, bad, days) };
  }
  function lineFor(x, bad, days) {
    const row = (id) => x.rows.find((r) => r.id === id), d = (h) => +(h / 24).toFixed(1);
    if (!bad) return L('kLOk', { p: Math.round(row('sunPct').v), n: days });
    if (bad.id === 'night') return L('kLNight', { d: d(bad.v), n: d(Mi.limits.nightH) });
    if (bad.id === 'radio') return L('kLRadio', { d: d(bad.v), n: d(Mi.limits.silenceH) });
    if (bad.id === 'light') return bad.v === Infinity ? L('kLLightNever') : L('kLLight', { h: Math.round(bad.v), n: Mi.FIRST_SUN_H });
    return L('kLSlope', { a: bad.v.toFixed(1), n: Mi.SLOPE_LIMIT });
  }

  // ------------------------------------------------------------------ the card
  const card = el('div', 'kl-card'), narrow = () => window.innerWidth <= 760 || document.documentElement.classList.contains('min');
  let open = !narrow();
  const head = el('div', 'kl-head'), toggle = el('button', 'kidbtn kl-toggle'), x = el('button', 'kl-x', '×');
  toggle.type = x.type = 'button'; toggle.setAttribute('aria-expanded', String(open));
  head.append(toggle, x);
  const body = el('div', 'kl-body');
  const prevWrap = el('div', 'kl-prev'), prevCanvas = el('canvas'), cap = el('div', 'kl-cap'); prevWrap.append(prevCanvas, cap);
  const rowOf = (label) => { const r = el('div', 'kl-row'), l = el('span', 'kl-lbl'); r.append(l); return { r, l }; };
  const rType = rowOf(), seg = el('div', 'kl-seg'), typeBtns = TYPES.map((k) => { const b = el('button', 'kl-pill'); b.type = 'button'; b.dataset.type = k; b.onclick = () => set({ type: k }); seg.append(b); return b; });
  rType.r.append(seg);
  const rCol = rowOf(), sw = el('div', 'kl-sw'), colBtns = COLORS.map((c, i) => { const b = el('button', 'kl-swatch'); b.type = 'button'; b.dataset.color = c; b.dataset.i = i; b.style.background = c; b.onclick = () => set({ color: c }); sw.append(b); return b; });
  rCol.r.append(sw);
  const rName = rowOf(), input = el('input', 'kl-input'); input.type = 'text'; input.maxLength = 20; input.autocomplete = 'off'; input.spellcheck = false;
  rName.r.append(input);
  const rHat = rowOf(), hatRow = el('div', 'kl-hats'), hatName = cap; rHat.r.classList.add('kl-hrow');
  const hatBtns = HATS.map((k) => { const b = el('button', 'kl-hat'); b.type = 'button'; b.dataset.hat = k; b.onclick = () => set({ hat: k }); hatRow.append(b); return b; });
  rHat.r.append(hatRow);
  const hint = el('p', 'kl-hint');
  body.append(prevWrap, rType.r, rCol.r, rName.r, rHat.r, hint);
  card.append(head, body);
  document.getElementById('kidbar')?.append(card);

  function setOpen(v) { open = v; card.classList.toggle('closed', !open); toggle.setAttribute('aria-expanded', String(open)); prev.dirty = true; }
  toggle.onclick = () => setOpen(!open); x.onclick = () => setOpen(false);
  input.addEventListener('input', () => set({ name: input.value }, true));
  input.addEventListener('blur', () => { input.value = cfg.name; });
  input.addEventListener('keydown', (e) => e.stopPropagation()); // typing a space must not play the clock

  function texts() {
    toggle.textContent = L('kLTitle'); toggle.title = L('kLTip'); x.title = x.ariaLabel = L('kLClose');
    rType.l.textContent = L('kLType'); rCol.l.textContent = L('kLColor'); rName.l.textContent = L('kLName'); rHat.l.textContent = L('kLHat');
    typeBtns.forEach((b) => { b.textContent = L(TYPE_KEY[b.dataset.type]); });
    colBtns.forEach((b) => { b.title = b.ariaLabel = L('kLCol' + b.dataset.i); });
    hatBtns.forEach((b) => { b.title = b.ariaLabel = L(HAT_KEY[b.dataset.hat]); });
    input.placeholder = L('kLNamePh'); hint.textContent = L('kLHint');
    hatName.textContent = L(HAT_KEY[cfg.hat]);
    drawTag();
  }
  function sync() {
    typeBtns.forEach((b) => { const on = b.dataset.type === cfg.type; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    colBtns.forEach((b) => { const on = b.dataset.color === cfg.color; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    hatBtns.forEach((b) => { const on = b.dataset.hat === cfg.hat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    if (document.activeElement !== input) input.value = cfg.name;
    hatName.textContent = L(HAT_KEY[cfg.hat]);
  }

  // ------------------------------------------------------------------ changing the lander
  const modelKey = (c) => c.type + c.color + c.hat;
  function set(patch, typing = false) {
    const before = modelKey(cfg), next = normalize({ ...cfg, ...patch });
    cfg = next; saveCfg(cfg); sync();
    if (modelKey(cfg) !== before) { prev.craft.rebuild(cfg); fitPreview(); prev.dirty = true; if (fx?.craft) { fx.craft.rebuild(cfg); } if (surf.craft) { surf.craft.rebuild(cfg); surf.size(); } }
    drawTag();
    if (!typing) input.value = cfg.name;
  }
  api.set = (p) => set(p); Object.defineProperty(api, 'cfg', { get: () => ({ ...cfg }) });

  // ------------------------------------------------------------------ the live preview in the card
  const prev = { dirty: true, last: 0, w: 0, h: 0 };
  {
    const r = prev.renderer = new THREE.WebGLRenderer({ canvas: prevCanvas, alpha: true, antialias: true });
    r.setClearColor(0, 0); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    prev.scene = new THREE.Scene();
    prev.cam = new THREE.PerspectiveCamera(30, 1.8, 0.1, 50); prev.cam.position.set(0, 2.3, 6.6); prev.cam.lookAt(0, 1.0, 0);
    const key = new THREE.DirectionalLight(0xfff1dc, 3.4); key.position.set(3, 4.5, 3.5); prev.scene.add(key, new THREE.HemisphereLight(0xb7c4ff, 0x6b6258, 1.0));
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2.1, 56), new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, map: moonDisc() }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; prev.scene.add(ground);
    prev.craft = new Craft(cfg); prev.scene.add(prev.craft.group); fitPreview();
  }
  function fitPreview() { prev.craft.group.scale.setScalar(clamp(2.1 / prev.craft.height, 0.8, 1.5)); } // each machine fills the picture alike, so a small hat on a rover is still seen
  function moonDisc() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const r = g.createRadialGradient(128, 128, 20, 128, 128, 128); r.addColorStop(0, '#8d8a84'); r.addColorStop(0.7, '#6e6b66'); r.addColorStop(1, '#4a4844'); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    let s = 3; const rn = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) { const px = 40 + rn() * 176, py = 40 + rn() * 176, pr = 5 + rn() * 14; g.strokeStyle = 'rgba(40,38,35,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, pr, 0, 7); g.stroke(); g.fillStyle = 'rgba(30,28,26,.25)'; g.fill(); g.strokeStyle = 'rgba(190,186,178,.35)'; g.beginPath(); g.arc(px - 1, py - 1, pr + 2, 3.6, 5.4); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function drawPreview(now, dt) {
    if (!open || kid.S.mode !== 'overview') return;
    if (now - prev.last < 33) return; // 30 pictures a second are plenty for a card
    if (card.offsetParent === null) return;
    const w = prevCanvas.clientWidth, h = prevCanvas.clientHeight;
    if (w && (w !== prev.w || h !== prev.h)) { prev.w = w; prev.h = h; prev.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); prev.renderer.setSize(w, h, false); prev.cam.aspect = w / h; prev.cam.updateProjectionMatrix(); }
    prev.last = now;
    prev.craft.inner.rotation.y = now / 1000 * 0.55;
    prev.craft.update(now / 1000, dt);
    prev.renderer.render(prev.scene, prev.cam);
  }
  // each hat as a small picture for its button (one throw-away renderer, drawn once)
  function hatPictures() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 112;
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(112, 112, false); r.setClearColor(0, 0); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    const sc = new THREE.Scene(), key = new THREE.DirectionalLight(0xfff1dc, 3.2); key.position.set(2, 3, 4); sc.add(key, new THREE.HemisphereLight(0xb7c4ff, 0x6b6258, 1.1));
    for (const b of hatBtns) {
      b.textContent = '';
      const img = el('img'); img.alt = ''; img.width = img.height = 44; b.append(img);
      if (b.dataset.hat === 'none') { const c = document.createElement('canvas'); c.width = c.height = 112; const g = c.getContext('2d'); g.strokeStyle = 'rgba(200,210,225,.8)'; g.lineWidth = 8; g.beginPath(); g.arc(56, 56, 34, 0, 7); g.moveTo(32, 80); g.lineTo(80, 32); g.stroke(); img.src = c.toDataURL(); continue; }
      const h = makeHat(b.dataset.hat), flat = b.dataset.hat === 'uzbek' || b.dataset.hat === 'tajik'; if (b.dataset.hat === 'uzbek') h.rotation.y = 0.55; sc.add(h);
      const box = new THREE.Box3().setFromObject(h), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      const half = Math.max(size.y, size.x * 0.9) * 0.62, cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 20);
      cam.position.set(ctr.x, ctr.y + half * (flat ? 0.3 : 0.55), 5); cam.lookAt(ctr.x, ctr.y - half * 0.05, 0);
      r.render(sc, cam); img.src = cv.toDataURL('image/png'); sc.remove(h);
    }
    r.dispose(); r.forceContextLoss();
  }

  // ------------------------------------------------------------------ the drop onto the Moon
  let fx = null, show = null;
  function ensureFx() {
    if (fx) return fx;
    const canvas = el('canvas'); canvas.id = 'landerfx'; document.body.append(canvas);
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    r.setClearColor(0, 0); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    const key = new THREE.DirectionalLight(0xfff1dc, 3.4); key.position.set(-3, 4, 5); scene.add(key, new THREE.HemisphereLight(0xb7c4ff, 0x6b6258, 1.0));
    const stage = new THREE.Group(); stage.rotation.x = 0.42; scene.add(stage);
    const craft = new Craft(cfg); stage.add(craft.group);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ map: dustTexture(), color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.scale.set(1.5, 1.5, 1.5); stage.add(shadow);
    const bubble = el('div', 'kl-bubble'), bt = el('div', 'kl-bt'), bn = el('b'), bl = el('span'), bs = el('em', 'kl-skip');
    bt.append(bn, bl, bs); bubble.append(bt); document.body.append(bubble);
    fx = { renderer: r, scene, cam, stage, craft, shadow, canvas, bubble, bn, bl, bs, dust: [] };
    return fx;
  }
  const targetOf = (siteId, w, h) => {
    const s = overview.sites.find((q) => q.id === siteId), p = s && S.mode === 'overview' ? overview.project(s.pos, w, h, 0) : null;
    return p ? { x: clamp(p.x, 50, w - 50), y: clamp(p.y, 110, h - 70) } : { x: w / 2, y: h * 0.4 };
  };

  /** Plays the show for a verdict res. from: where it leaves (screen px). Resolves when it is over. */
  function runShow(res, from, speed = api.speed) {
    if (show) show.end();
    const f = ensureFx(), w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    f.renderer.setPixelRatio(dpr); f.renderer.setSize(w, h, false);
    f.cam.left = -w / 2; f.cam.right = w / 2; f.cam.top = h / 2; f.cam.bottom = -h / 2; f.cam.updateProjectionMatrix();
    if (f.craft.cfg && modelKey(f.craft.cfg) !== modelKey(cfg)) f.craft.rebuild(cfg);
    f.craft.ok = f.craft.lost = 0; f.craft.setState('idle'); f.craft.setFlame(0); f.craft.inner.scale.set(1, 1, 1);
    for (const d of f.dust) { f.stage.remove(d.s); d.s.material.dispose(); } f.dust = [];
    f.shadow.material.opacity = 0;
    f.canvas.style.display = 'block'; f.bn.textContent = cfg.name; f.bl.textContent = res.line; f.bs.textContent = L('kLSkip');
    f.bubble.className = 'kl-bubble ' + (res.ok ? 'ok' : 'lost');
    const px1 = clamp(Math.min(w, h) * 0.07, 30, 54), px0 = clamp(Math.min(w, h) * 0.09, 44, 80), arc = (from.x < w / 2 ? 1 : -1) * Math.min(w, h) * 0.06;
    const T_FALL = 1.5, T_STATE = 1.75, T_BUBBLE = 1.95, T_END = 4.0;
    return new Promise((resolve) => {
      let el0 = 0, last = performance.now(), touched = false, raf = 0, done = false, safety = 0, tx = from, hold = false;
      const info = show = { res, el: 0, x: from.x, y: from.y, px: px0, phase: 'fall', end };
      api.show = info;
      function end(ev) {
        if (done) return; done = true;
        if (ev && ev.type === 'pointerdown') { // a click that skips the show does nothing else
          ev.stopPropagation(); const swallow = (c) => { c.stopPropagation(); c.preventDefault(); }; window.addEventListener('click', swallow, { capture: true, once: true }); setTimeout(() => window.removeEventListener('click', swallow, true), 600);
        } cancelAnimationFrame(raf); clearTimeout(safety); show = null; api.show = null;
        window.removeEventListener('pointerdown', end, true); window.removeEventListener('keydown', end, true);
        f.canvas.style.display = 'none'; f.bubble.classList.remove('on'); f.craft.setFlame(0);
        resolve(res);
      }
      setTimeout(() => { if (!done) { window.addEventListener('pointerdown', end, true); window.addEventListener('keydown', end, true); } }, 120); // the click that started the show must not end it
      safety = setTimeout(end, (T_END / speed + 5) * 1000);
      const step = (now) => {
        if (done) return;
        const dt = Math.min((now - last) / 1000, 0.1) * speed; last = now;
        const pa = api.hold.pauseAt;
        if (pa != null && el0 >= pa) { hold = true; } else { hold = false; el0 += dt; }
        const e0 = el0, u = clamp(e0 / T_FALL, 0, 1), ease = 1 - Math.pow(1 - u, 2.4);
        const W = window.innerWidth, H = window.innerHeight;
        tx = targetOf(res.siteId, W, H);
        const px = (px0 + (px1 - px0) * ease) * (0.35 + 0.65 * smooth(0, 0.14, e0)) / (e0 < T_FALL ? 1 : 1);
        const ground = { x: from.x + (tx.x - from.x) * ease + Math.sin(Math.PI * u) * arc, y: from.y + (tx.y - from.y) * ease };
        const cur = u >= 1 ? tx : ground;
        f.stage.position.set(cur.x - W / 2, H / 2 - cur.y, 0); f.stage.scale.setScalar(px / 1.1);
        f.stage.rotation.z = Math.sin(e0 * 9) * 0.2 * (1 - u) * (1 - u);
        f.craft.inner.rotation.y = -0.55 + (1 - ease) * Math.PI * 2.5;
        // thrusters slow the fall, then the legs take the landing
        const brake = smooth(0.2, 0.75, u) * (e0 < T_FALL ? 1 : Math.max(0, 1 - (e0 - T_FALL) * 5));
        f.craft.setFlame(brake);
        if (e0 >= T_FALL && !touched) { touched = true; puff(f, px); info.phase = 'landed'; }
        const dtl = Math.max(0, e0 - T_FALL), sq = touched ? Math.exp(-dtl * 7) * Math.cos(dtl * 24) : 0;
        f.craft.inner.scale.set(1 + 0.05 * sq, 1 - 0.11 * sq, 1 + 0.05 * sq);
        f.shadow.material.opacity = 0.55 * smooth(0.55, 1, u);
        if (e0 >= T_STATE && f.craft.state === 'idle') { f.craft.setState(res.ok ? 'ok' : 'lost'); info.phase = res.ok ? 'ok' : 'lost'; }
        f.craft.update(e0 + 2, Math.min((now - last) / 1000 + 0.016, 0.1) * speed);
        updateDust(f, dt);
        // the line, above the lander (below it when there is no room above)
        if (e0 >= T_BUBBLE) {
          f.bubble.classList.add('on');
          const bw = f.bubble.offsetWidth, bh = f.bubble.offsetHeight, top = cur.y - px * (f.craft.height + 0.45) - bh - 10, below = top < 64;
          f.bubble.style.left = clamp(cur.x, bw / 2 + 8, W - bw / 2 - 8) + 'px';
          f.bubble.style.top = (below ? cur.y + 18 : top) + 'px';
          f.bubble.classList.toggle('below', below);
        }
        info.el = e0; info.x = cur.x; info.y = cur.y; info.px = px;
        f.canvas.style.opacity = e0 > T_END - 0.3 ? String(clamp((T_END - e0) / 0.3, 0, 1)) : '1';
        f.bubble.style.opacity = e0 > T_END - 0.3 ? String(clamp((T_END - e0) / 0.3, 0, 1)) : '';
        f.renderer.render(f.scene, f.cam);
        if (e0 >= T_END) { f.canvas.style.opacity = '1'; return end(); }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
  }
  function puff(f, px) { // dust at the feet: grey puffs that spread over the ground and fade
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.9 + Math.random() * 1.6;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTexture(), color: 0xd9d3c8, transparent: true, opacity: 0.7, depthWrite: false }));
      s.position.set(Math.cos(a) * 0.35, 0.05, Math.sin(a) * 0.35); s.scale.setScalar(0.45); f.stage.add(s);
      f.dust.push({ s, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 0.2 + Math.random() * 0.5, age: 0, life: 0.7 + Math.random() * 0.6 });
    }
  }
  function updateDust(f, dt) {
    f.dust = f.dust.filter((d) => {
      d.age += dt; const u = d.age / d.life;
      if (u >= 1) { f.stage.remove(d.s); d.s.material.dispose(); return false; }
      d.s.position.x += d.vx * dt; d.s.position.z += d.vz * dt; d.s.position.y += d.vy * dt; d.vx *= 0.96; d.vz *= 0.96;
      d.s.scale.setScalar(0.45 + 1.0 * u); d.s.material.opacity = 0.7 * (1 - u) * (1 - u);
      return true;
    });
  }

  /** One drop: judge, play, resolve with the verdict. event: the click that started it (its position is where the lander leaves from). */
  async function drop(id, t, o = {}) {
    const res = await judgeSite(id, t, o.days ?? gridDays);
    api.last = { siteId: res.siteId, date: res.date, ok: res.ok, failed: res.failed, line: res.line };
    const ev = o.event, w = window.innerWidth, from = o.from || (ev && Number.isFinite(ev.clientX) ? { x: ev.clientX, y: ev.clientY } : { x: w / 2, y: window.innerHeight - 40 });
    try { await runShow(res, from, o.speed ?? api.speed); } catch (e) { console.error(e); }
    return res;
  }
  api.drop = drop; api.judge = judgeSite; api.line = lineFor; Object.defineProperty(api, 'busy', { get: () => !!show });
  // a failed drop must never stop the site from opening: the error is reported and the app goes on
  kid.dayPick.push((id, t, ev) => drop(id, t, { event: ev }).catch((e) => console.error(e)));
  kid.dropped.push((entry, ev) => { drop(entry.id, S.missionStart, { event: ev, from: { x: ev.clientX, y: -60 } }).catch((e) => console.error(e)); });

  // ------------------------------------------------------------------ the first person view
  // The lander stands on the near terrain, to the side of the first view, lit by the scene's real Sun (surface.uniforms.sunDir),
  // and shows the verdict for the chosen landing day: green lights and a waving hat, or frost and dark lights.
  const surf = { group: new THREE.Group(), craft: new Craft(cfg), site: null, key: '', state: 'idle', res: null, ok: undefined };
  surf.group.visible = false;
  surf.craft.group.scale.setScalar(SIZE); surf.group.add(surf.craft.group);
  surf.size = () => { surf.tagSprite && (surf.tagSprite.position.y = (surf.craft.height + 0.7) * SIZE); };
  surf.sun = new THREE.DirectionalLight(0xfff1dc, 0); surf.fill = new THREE.DirectionalLight(0xdbe6ff, 0); surf.fill.position.set(0, 0, 0); surf.fill.target = surf.group; surf.hemi = new THREE.HemisphereLight(0xb7c4ff, 0x7a6f62, 0);
  surf.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: dustTexture(), color: 0x000000, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  surf.shadow.rotation.x = -Math.PI / 2; surf.shadow.position.y = 0.05; surf.group.add(surf.shadow);
  surf.tagCanvas = document.createElement('canvas'); surf.tagCanvas.width = 512; surf.tagCanvas.height = 128;
  surf.tagTex = new THREE.CanvasTexture(surf.tagCanvas); surf.tagTex.colorSpace = THREE.SRGBColorSpace;
  surf.tagSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: surf.tagTex, transparent: true, depthWrite: false, toneMapped: false }));
  surf.tagSprite.scale.set(3.6, 0.9, 1); surf.group.add(surf.tagSprite); surf.size();
  surface.scene.add(surf.group, surf.sun, surf.fill, surf.hemi);

  function drawTag() { // the name on a small label above the hat, drawn on a canvas (never HTML)
    const c = surf.tagCanvas, g = c.getContext('2d'), st = surf.state, col = st === 'ok' ? '#3ddc84' : st === 'lost' ? '#8fd3ff' : '#e3e9f3';
    g.clearRect(0, 0, 512, 128); g.fillStyle = 'rgba(8,11,16,.78)'; g.beginPath(); g.roundRect(8, 10, 496, 108, 26); g.fill();
    g.strokeStyle = col; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#fff'; g.font = '700 50px "IBM Plex Sans Condensed", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cfg.name, 256, 50, 460);
    if (st !== 'idle') { g.fillStyle = col; g.font = '600 32px "IBM Plex Sans Condensed", system-ui, sans-serif'; g.fillText(L(st === 'ok' ? 'kLAlive' : 'kLFrozen'), 256, 94); }
    surf.tagTex.needsUpdate = true;
  }

  // the rendered near terrain, sampled with the same triangles the mesh is built from (surface.js#_gridGeometry)
  function placeSurface(site) {
    const T = site.meta.terrain.near, n = T.n, half = T.half_m, sp = (2 * half) / (n - 1), q = T.quantum_m, nodata = site.meta.terrain.nodata;
    const g = (r, c) => { const v = site.near[r * n + c]; return v === nodata ? 0 : v * q; };
    const hAt = (E, N) => {
      const fc = (E + half) / sp, fr = (N + half) / sp, c = clamp(Math.floor(fc), 0, n - 2), r = clamp(Math.floor(fr), 0, n - 2), fx = fc - c, fy = fr - r;
      const a = g(r, c), b = g(r, c + 1), d = g(r + 1, c), e = g(r + 1, c + 1);
      return fx + fy <= 1 ? a + fx * (b - a) + fy * (d - a) : e + (1 - fx) * (d - e) + (1 - fy) * (b - e);
    };
    const asp = window.innerWidth / window.innerHeight, hfov = 2 * Math.atan(Math.tan(surface.fov * DEG / 2) * asp) / DEG;
    const sunAz = sample(site, S.t).sunAz, off = clamp(hfov * 0.14, 4, 14), dist = 13;
    // Near the wanted spot (to the side of the first view, 13 m away) pick one where the feet are in view above the dock: on a steep
    // slope the ground falls away, so look along the slope for a level patch.
    let best = null;
    for (let o = -30; o <= 30; o += 5) for (const d of [13, 10, 7.5, 5.5]) {
      const a = (sunAz + off + o) * DEG, hh = hAt(Math.sin(a) * d, Math.cos(a) * d), ang = Math.atan2(hh, d) / DEG;
      const score = (ang >= -12 ? 0 : ang - 12) - Math.abs(o) * 0.05 - Math.abs(d - dist) * 0.04;
      if (!best || score > best.score) best = { score, a, d };
    }
    const az = best.a, E = Math.sin(az) * best.d, N = Math.cos(az) * best.d, r = 1.6;
    const dE = (hAt(E + r, N) - hAt(E - r, N)) / (2 * r), dN = (hAt(E, N + r) - hAt(E, N - r)) / (2 * r);
    const up = new THREE.Vector3(-dE, 1, dN).normalize(); // scene axes: x east, y up, z south
    surf.group.position.set(E, hAt(E, N), -N);
    surf.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    surf.craft.inner.rotation.y = Math.atan2(N, -E) + 0.9; // the front (+x) turns toward the viewer, a little to the side
    surf.site = site; surf.at = { E, N, tilt: Math.acos(up.y) / DEG };
  }
  function surfVerdict() {
    const e = kid.siteEntry(S.siteId), v = e.variants[S.variant], days = S.missionDays, t = Math.floor(S.missionStart / DAY) * DAY;
    const key = [S.siteId, S.variant, t, days, Mi.limits.nightH, Mi.limits.silenceH].join('|');
    if (key === surf.key) return;
    surf.key = key;
    const x = judgeAt(S.site, Math.round((t - S.site.t0) / 3600), Math.round(days * 24), v.slope_deg, S.extra[v.dir] ?? v.slope_deg);
    surf.ok = x.ok; surf.state = x.ok ? 'ok' : 'lost'; surf.craft.setState(surf.state); drawTag();
  }
  function surfFrame(now, dt) {
    const on = S.mode === 'surface' && S.site && surf.site === S.site;
    surf.group.visible = on; surf.sun.visible = surf.fill.visible = surf.hemi.visible = on;
    if (!on) return;
    surfVerdict();
    const st = surface.state, frac = st ? st.sunFrac * smooth(-0.6, 0.4, st.sunEl + 0.7 * st.sunR) : 0;
    surf.sun.position.copy(surface.uniforms.sunDir.value).multiplyScalar(200);
    surf.sun.intensity = 5.2 * frac; surf.fill.intensity = 1.5 * frac; surf.hemi.intensity = 0.14 + 0.7 * frac; // the fill stands for light thrown up by the bright ground
    surf.craft.update(now / 1000, dt);
    // the shadow lies along the real Sun, long when the Sun is low
    const ls = surface.uniforms.sunDir.value.clone().applyQuaternion(surf.group.quaternion.clone().invert()), hl = Math.hypot(ls.x, ls.z);
    if (ls.y > 0.01 && hl > 1e-4) {
      const len = clamp((surf.craft.height * SIZE * 0.6) / Math.max(ls.y / hl, 0.12), 2.4, 9);
      surf.shadow.visible = true; surf.shadow.rotation.set(-Math.PI / 2, 0, 0);
      surf.shadow.scale.set(len / 2 + 1.2, 2.2, 1); surf.shadow.rotation.z = Math.atan2(-ls.z, -ls.x) * -1 + 0; // the long axis lies away from the Sun
      surf.shadow.position.set(-ls.x / hl * (len / 2 - 1.0), 0.05, -ls.z / hl * (len / 2 - 1.0)); surf.shadow.material.opacity = 0.5 * frac;
    } else surf.shadow.visible = false;
  }
  kid.mode.push((m) => {
    if (m === 'surface' && S.site) { try { placeSurface(S.site); surf.key = ''; surfVerdict(); } catch (e) { console.error(e); } }
    else surf.group.visible = false;
  });
  api.surf = () => ({ visible: surf.group.visible, state: surf.state, ok: surf.ok, name: cfg.name, hat: cfg.hat, type: cfg.type, key: surf.key, at: surf.at, model: modelKey(surf.craft.cfg), tag: surf.tagSprite.visible, ok01: [surf.craft.ok, surf.craft.lost], sun: surf.sun.intensity });

  // ------------------------------------------------------------------ hooks
  kid.lang.push(() => { texts(); if (show) { fx.bs.textContent = L('kLSkip'); } });
  kid.frame.push((now, dt) => { drawPreview(now, dt); surfFrame(now, dt); });
  texts(); sync(); setOpen(open);
  setTimeout(() => { try { hatPictures(); } catch (e) { console.error(e); } }, 0);
}
