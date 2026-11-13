// UI: map, date planner, comparison table, sky panorama, timeline.
(function () {
  const $ = (id) => document.getElementById(id);
  const L = I18n.t; // translated interface string
  const globe = Globe(GLOBAL, PATCHES);
  const terrain = Terrain(DEM, globe.heightAtVec); // past 80 S the polar horizon march continues on global terrain
  // Terrain for a point: a 474 m patch if one covers it, else the 480 m polar map, else the 7.6 km global map.
  const ground = (lat, lon) => (globe.resolutionAt(lat, lon) === '474 m' || isNaN(terrain.heightAt(lat, lon)) ? globe : terrain);
  const resolution = (lat, lon) => (ground(lat, lon) === terrain ? '480 m' : globe.resolutionAt(lat, lon));
  const COLORS = ['#ff7ab6', '#a78bfa', '#34d399', '#fb923c', '#22d3ee', '#c4f04d', '#f87171', '#e879f9'];
  const DEFAULT_SITES = ['Shackleton rim', 'de Gerlache rim', 'Malapert rim', 'Shackleton floor (shadowed)'];

  const state = { sites: [], focus: null, times: [], bodies: [], stepH: 1, landing: 0, scrub: 0, nextId: 1, customN: 1 };

  // ---------- inputs ----------
  const num = (id) => parseFloat($(id).value);
  const stayHours = () => Math.max(1, num('stay') * 24);
  const staySamples = () => Math.min(state.times.length, Math.round(stayHours() / state.stepH) + 1);
  const fmt = (d) => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const fmtDays = (h) => (h >= 48 ? (h / 24).toFixed(1) + ' ' + L('dUnit') : h.toFixed(0) + ' ' + L('hUnit'));
  // "sets in 3.2 d" while up, "rises in 5 h" while down; the flags are the hourly lit/comm track.
  function until(flags, k, setKey, riseKey) { // keys: sunset/sunrise, earthset/earthrise
    const j = Analysis.nextChange(flags, k), w = flags[k] ? setKey : riseKey;
    return j < 0 ? L('no' + w) : L(w.toLowerCase() + 'In', { t: fmtDays((j - k) * state.stepH) });
  }

  // ---------- compute ----------
  function computeTimes() {
    const days = num('span');
    state.stepH = days > 120 ? 2 : 1; // ponytail: fixed step per span; 2 h keeps a year under half a second
    state.times = Analysis.makeTimes(new Date($('start').value + 'T00:00:00Z'), days, state.stepH);
    state.bodies = state.times.map(Sky.bodiesMoonFixed);
    state.landing = Math.min(state.landing, Math.max(0, state.times.length - staySamples()));
  }
  function computeSite(s, horizonToo) {
    if (horizonToo || !s.horizon) s.horizon = ground(s.lat, s.lon).horizon(s.lat, s.lon, num('mast'));
    s.track = Analysis.track(s, state.bodies, terrain.horizonAt, num('margin'));
    s.curve = Analysis.plannerCurve(s.track, staySamples());
  }
  function computeAll(horizonToo) { state.sites.forEach((s) => computeSite(s, horizonToo)); }

  function addSite(p) {
    const gr = ground(p.lat, p.lon);
    // Names can come from a shared link, and they are written into innerHTML and the CSV: drop markup and
    // quote characters and a leading spreadsheet formula sign here, once, for every caller.
    const name = String(p.name).replace(/[<>&"]/g, '').replace(/^[=+\-@]+/, '').slice(0, 60) || 'Site';
    const s = { id: state.nextId++, name, lat: p.lat, lon: p.lon, heightM: Math.round(gr.heightAt(p.lat, p.lon)), slope: gr.slopeAt(p.lat, p.lon), evaSlope: gr.maxSlopeWithin(p.lat, p.lon, 2000), res: resolution(p.lat, p.lon), from: p.from || p.source || 'picked on the map' };
    s.color = COLORS[(s.id - 1) % COLORS.length];
    state.sites.push(s);
    computeSite(s, true);
    state.focus = s.id;
    setView(isNaN(terrain.heightAt(s.lat, s.lon))); // show the map the new site is on
    renderSiteList(); render();
  }

  // ---------- whole-Moon map (equirectangular, near side in the middle) ----------
  const globeBase = document.createElement('canvas');
  const GX = (lon) => ((((lon + 180) % 360) + 360) % 360) * 4, GY = (lat) => (90 - lat) * 4;
  function buildGlobeMap() {
    const G = globe.global, w = G.w, h = G.h, z = G.z, img = new ImageData(w, h), px = 7580.84;
    for (let j = 1; j < h - 1; j++) {
      const c = Math.max(0.05, Math.cos((90 - (j + 0.5) / 4) * Math.PI / 180));
      for (let i = 0; i < w; i++) {
        const p = j * w + i, dx = (z[j * w + (i + 1) % w] - z[j * w + (i - 1 + w) % w]) / (2 * px * c), dy = (z[p + w] - z[p - w]) / (2 * px);
        const shade = Math.max(0, (dx * 0.6 + dy * 0.6 + 1) / Math.sqrt(1.72 * (dx * dx + dy * dy + 1)));
        const t = Math.max(0, Math.min(1, (z[p] + 8000) / 18000)), v = 0.15 + 0.85 * shade;
        const q = (j * w + ((i + 720) % w)) * 4; // shift so 0 degrees longitude is in the middle
        img.data[q] = v * (120 + 120 * t); img.data[q + 1] = v * (130 + 90 * t); img.data[q + 2] = v * (165 + 30 * t); img.data[q + 3] = 255;
      }
    }
    globeBase.width = w; globeBase.height = h;
    globeBase.getContext('2d').putImageData(img, 0, 0);
  }
  function renderGlobeMap() {
    const g = $('globeMap').getContext('2d');
    g.drawImage(globeBase, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,.15)'; g.fillStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.font = '16px system-ui';
    for (let lon = -180; lon < 180; lon += 30) { g.beginPath(); g.moveTo(GX(lon), 0); g.lineTo(GX(lon), 720); g.stroke(); g.fillText(lon + '°', GX(lon) + 3, 714); }
    for (let lat = -60; lat <= 60; lat += 30) { g.beginPath(); g.moveTo(0, GY(lat)); g.lineTo(1440, GY(lat)); g.stroke(); g.fillText(lat + '°', 3, GY(lat) - 3); }
    g.font = '18px system-ui'; g.textAlign = 'center'; g.fillText(L('nearSide'), GX(0), 24); g.textAlign = 'left'; g.fillText(L('farSide'), 8, 24); g.textAlign = 'right'; g.fillText(L('farSide'), 1432, 24); g.textAlign = 'left'; // 180 degrees is both edges
    g.strokeStyle = 'rgba(255,107,107,.7)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(0, GY(-80)); g.lineTo(1440, GY(-80)); g.stroke(); g.setLineDash([]);
    g.fillText(L('polarBelow'), 8, GY(-80) - 6);
    for (const s of state.sites) {
      const x = GX(s.lon), y = GY(s.lat), f = s.id === state.focus;
      g.beginPath(); g.arc(x, y, f ? 8 : 6, 0, 2 * Math.PI); g.fillStyle = s.color; g.fill(); g.lineWidth = f ? 3 : 1.5; g.strokeStyle = '#fff'; g.stroke();
    }
    drawLabels($('globeMap'), g, state.sites.map((s) => ({ x: GX(s.lon), y: GY(s.lat), text: s.name, bold: s.id === state.focus })));
  }
  function globeLatLon(e) {
    const c = $('globeMap'), r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) * c.width) / r.width, y = ((e.clientY - r.top) * c.height) / r.height;
    return { lat: 90 - y / 4, lon: x / 4 - 180 };
  }
  $('globeMap').addEventListener('mousemove', (e) => {
    const ll = globeLatLon(e);
    $('mapInfo').textContent = `${ll.lat.toFixed(2)}°, ${ll.lon.toFixed(2)}°E · ${Math.round(globe.heightAt(ll.lat, ll.lon))} m · ${L('terrain')} ${resolution(ll.lat, ll.lon)} · ${L('clickAdd')}`;
  });
  $('globeMap').addEventListener('click', (e) => {
    const ll = globeLatLon(e);
    addSite({ name: L('custom') + ' ' + state.customN++, lat: +ll.lat.toFixed(4), lon: +ll.lon.toFixed(4) });
  });
  function setView(globeView) {
    $('map').hidden = globeView; $('globeMap').hidden = !globeView;
    $('viewPole').classList.toggle('on', !globeView); $('viewGlobe').classList.toggle('on', globeView);
    $('slopeToggle').parentElement.hidden = globeView;
    $('shadowToggle').parentElement.hidden = globeView;
    $('mapInfo').textContent = L(globeView ? 'infoGlobe' : 'infoPole');
  }
  $('viewPole').addEventListener('click', () => setView(false));
  $('viewGlobe').addEventListener('click', () => setView(true));
  $('coordForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const lat = num('latIn'), lon = num('lonIn');
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 360)) return;
    addSite({ name: L('custom') + ' ' + state.customN++, lat, lon: lon > 180 ? lon - 360 : lon });
  });

  // ---------- map ----------
  const base = document.createElement('canvas'), slopeLayer = document.createElement('canvas');
  const SLOPE_LIMIT = 10; // degrees; lander slope limit used by the README and the deck
  function buildBaseMap() {
    const n = terrain.n, h = terrain.heights, img = new ImageData(n, n), px = terrain.scale;
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const p = j * n + i;
      const dx = (h[p + 1] - h[p - 1]) / (2 * px), dy = (h[p + n] - h[p - n]) / (2 * px);
      const shade = Math.max(0, (dx * 0.6 + dy * 0.6 + 1) / Math.sqrt(1.72 * (dx * dx + dy * dy + 1))); // light from top-left
      const t = Math.max(0, Math.min(1, (h[p] + 5000) / 11000));
      const v = 0.15 + 0.85 * shade, q = p * 4;
      img.data[q] = v * (120 + 120 * t); img.data[q + 1] = v * (130 + 90 * t); img.data[q + 2] = v * (165 + 30 * t); img.data[q + 3] = 255;
    }
    base.width = base.height = n;
    base.getContext('2d').putImageData(img, 0, 0);
    const red = new ImageData(n, n);
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++)
      if (terrain.slopeAtGrid(i, j) > SLOPE_LIMIT) { const q = (j * n + i) * 4; red.data[q] = 255; red.data[q + 1] = 40; red.data[q + 2] = 40; red.data[q + 3] = 150; }
    slopeLayer.width = slopeLayer.height = n;
    slopeLayer.getContext('2d').putImageData(red, 0, 0);
  }
  function gridOf(lat, lon) { const v = terrain.latLonToVec(lat, lon); return terrain.vecToGrid(v[0], v[1], v[2]); }
  // Site labels at a readable on-screen size whatever the canvas scale, nudged down until they stop overlapping.
  function drawLabels(c, g, items) {
    const k = c.width / Math.max(1, c.clientWidth), size = 13 * k, placed = [];
    for (const it of items) {
      g.font = (it.bold ? 'bold ' : '') + size + 'px system-ui';
      const w = g.measureText(it.text).width, right = it.x + 12 * k + w > c.width;
      let x = right ? it.x - 12 * k - w : it.x + 12 * k, y = it.y + size / 3;
      for (let n = 0; n < 6 && placed.some((p) => x < p.x + p.w && x + w > p.x && Math.abs(y - p.y) < size * 1.1); n++) y += size * 1.1;
      placed.push({ x, y, w });
      if (y !== it.y + size / 3) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = k; g.beginPath(); g.moveTo(it.x, it.y); g.lineTo(right ? x + w : x, y - size / 3); g.stroke(); } // leader line when pushed off the dot
      g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText(it.text, x, y); g.shadowBlur = 0;
    }
  }
  // Cast shadows at time index k: one ray toward the Sun per 3 x 3 pixel cell (1.44 km), cached per k.
  const SHADOW_STRIDE = 3, shadowCanvas = document.createElement('canvas');
  let shadowK = -1;
  function shadowLayer(k) {
    if (k === shadowK) return shadowCanvas;
    const m = Math.ceil(terrain.n / SHADOW_STRIDE), img = new ImageData(m, m), b = state.bodies[k].sun, nb = Math.hypot(b[0], b[1], b[2]);
    const sun = [b[0] / nb, b[1] / nb, b[2] / nb];
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
      const i = x * SHADOW_STRIDE + 1, j = y * SHADOW_STRIDE + 1;
      if (isNaN(terrain.heightAtGrid(i, j)) || terrain.sunVisibleAtGrid(i, j, sun, SHADOW_STRIDE, 300000)) continue;
      img.data[(y * m + x) * 4 + 3] = 170; // black, mostly opaque = in shadow
    }
    shadowCanvas.width = shadowCanvas.height = m;
    shadowCanvas.getContext('2d').putImageData(img, 0, 0);
    shadowK = k;
    return shadowCanvas;
  }
  function renderMap() {
    const c = $('map'), g = c.getContext('2d'), n = terrain.n, mid = n / 2 - 0.5;
    g.drawImage(base, 0, 0);
    if ($('slopeToggle').checked) g.drawImage(slopeLayer, 0, 0);
    if ($('shadowToggle').checked) g.drawImage(shadowLayer(nowIndex()), 0, 0, terrain.n, terrain.n);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.fillStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.font = '22px system-ui';
    for (const lat of [-82, -84, -86, -88]) {
      const r = (2 * DEM.radius * Math.tan(((90 + lat) * Math.PI) / 360)) / terrain.scale;
      g.beginPath(); g.arc(mid, mid, r, 0, 2 * Math.PI); g.stroke();
      g.fillText(lat + '°', mid + 4, mid - r - 4);
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const [i, j] = gridOf(-80, lon);
      g.beginPath(); g.moveTo(mid, mid); g.lineTo(i, j); g.stroke();
    }
    for (const [lon, txt] of [[0, '0°'], [90, '90°E'], [180, '180°'], [-90, '90°W']]) {
      const [i, j] = gridOf(-80.4, lon);
      g.fillText(txt, i - 24, j + 8);
    }
    for (const s of state.sites) {
      const [i, j] = gridOf(s.lat, s.lon), f = s.id === state.focus;
      g.beginPath(); g.arc(i, j, f ? 14 : 10, 0, 2 * Math.PI);
      g.fillStyle = s.color; g.fill(); g.lineWidth = f ? 4 : 2; g.strokeStyle = '#fff'; g.stroke();
    }
    drawLabels(c, g, state.sites.map((s) => { const [i, j] = gridOf(s.lat, s.lon); return { x: i, y: j, text: s.name, bold: s.id === state.focus }; }));
  }
  function mapGrid(e) {
    const c = $('map'), r = c.getBoundingClientRect();
    return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height];
  }
  $('map').addEventListener('mousemove', (e) => {
    const [i, j] = mapGrid(e), ll = terrain.gridToLatLon(i, j), h = terrain.heightAtGrid(i, j);
    $('mapInfo').textContent = isNaN(h) ? L('outsideDem') : `${ll.lat.toFixed(3)}°, ${ll.lon.toFixed(2)}°E · ${Math.round(h)} m · ${L('clickAdd')}`;
  });
  $('map').addEventListener('click', (e) => {
    const [i, j] = mapGrid(e), ll = terrain.gridToLatLon(i, j);
    if (isNaN(terrain.heightAtGrid(i, j))) return;
    addSite({ name: L('custom') + ' ' + state.customN++, lat: +ll.lat.toFixed(4), lon: +ll.lon.toFixed(4) });
  });

  // ---------- canvas helper ----------
  function fit(c) {
    // CSS height is pinned first so the backing-store size never feeds back into the layout height.
    if (!c.dataset.h) c.dataset.h = c.getAttribute('height');
    if (!c.style.height) c.style.height = c.dataset.h + 'px';
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = parseFloat(c.style.height);
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
  }
  function monthTicks(g, x0, x1, y, k0, k1) {
    g.fillStyle = '#8a93a6'; g.font = '11px system-ui';
    const t0 = state.times[k0], t1 = state.times[k1];
    if (!t0 || !t1) return;
    const spanDays = (t1 - t0) / 864e5;
    const d = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth(), t0.getUTCDate()));
    const stepDays = spanDays > 120 ? 0 : spanDays > 40 ? 14 : 7;
    for (;;) {
      if (stepDays) d.setUTCDate(d.getUTCDate() + stepDays); else d.setUTCMonth(d.getUTCMonth() + 1, 1);
      if (d > t1) break;
      const x = x0 + ((d - t0) / (t1 - t0)) * (x1 - x0);
      g.fillRect(x, y - 4, 1, 4);
      g.fillText(stepDays ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : d.toLocaleString(I18n.lang, { month: 'short', timeZone: 'UTC' }), x + 2, y + 10);
    }
  }

  // ---------- date planner ----------
  const PL = { left: 34, right: 10, top: 8, bottom: 22 };
  function renderPlanner() {
    const { g, w, h } = fit($('planner'));
    const n = state.sites[0] ? state.sites[0].curve.length : 0;
    g.fillStyle = '#0e121b'; g.fillRect(0, 0, w, h);
    const X = (k) => PL.left + (k / Math.max(1, n - 1)) * (w - PL.left - PL.right), Y = (v) => PL.top + (1 - v / 100) * (h - PL.top - PL.bottom);
    g.strokeStyle = '#232b3b'; g.fillStyle = '#8a93a6'; g.font = '11px system-ui';
    for (const v of [0, 25, 50, 75, 100]) { g.beginPath(); g.moveTo(PL.left, Y(v)); g.lineTo(w - PL.right, Y(v)); g.stroke(); g.fillText(v, 6, Y(v) + 4); }
    if (!n) return;
    const kStay = state.landing;
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(X(kStay), PL.top, 2, h - PL.top - PL.bottom);
    for (const s of state.sites) {
      g.beginPath(); g.strokeStyle = s.color; g.lineWidth = s.id === state.focus ? 2.4 : 1.2;
      const stride = Math.max(1, Math.floor(n / (w * 2)));
      for (let k = 0; k < n; k += stride) k ? g.lineTo(X(k), Y(s.curve[k])) : g.moveTo(X(k), Y(s.curve[k]));
      g.stroke();
    }
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(kStay), PL.top); g.lineTo(X(kStay), h - PL.bottom); g.stroke();
    monthTicks(g, PL.left, w - PL.right, h - PL.bottom + 6, 0, n - 1);
  }
  $('planner').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect(), n = state.sites[0]?.curve.length || 0;
    const f = (e.clientX - r.left - PL.left) / (r.width - PL.left - PL.right);
    state.landing = Math.max(0, Math.min(n - 1, Math.round(f * (n - 1))));
    render();
  });
  $('best').addEventListener('click', () => {
    const s = focusSite(); if (!s) return;
    let b = 0; for (let k = 1; k < s.curve.length; k++) if (s.curve[k] > s.curve[b]) b = k;
    state.landing = b; render();
  });

  // ---------- table ----------
  // Hours of sunlight left at touchdown (0 = landing in the dark); runs past the stay up to the span end.
  function sunUpAfterLanding(s, k0) {
    if (!s.track.lit[k0]) return 0;
    const j = Analysis.nextChange(s.track.lit, k0);
    return ((j < 0 ? s.track.lit.length : j) - k0) * state.stepH;
  }
  function stayRange() { const k0 = state.landing; return [k0, Math.min(state.times.length - 1, k0 + staySamples() - 1)]; }
  function renderTable() {
    const [k0, k1] = stayRange(), hours = (k1 - k0 + 1) * state.stepH;
    const rows = state.sites.map((s) => { const m = Analysis.metrics(s.track, k0, k1, state.stepH); return { s, m, score: Analysis.score(m, hours) }; })
      .sort((a, b) => b.score - a.score);
    for (const r of rows) r.artemis = Analysis.artemisChecks({ lat: r.s.lat, slope: r.s.slope, evaSlope: r.s.evaSlope, earthPct: r.m.earthPct, sunUpAtLanding: sunUpAfterLanding(r.s, k0) > 0 });
    const artemisCell = (r) => {
      const fails = r.artemis.filter((c) => !c.ok).map((c) => L('art' + c.id[0].toUpperCase() + c.id.slice(1)));
      return `<span title="${fails.length ? L('artemisFails', { list: fails.join('; ') }) : L('artemisAll')}">${5 - fails.length}/5</span>`;
    };
    const cols = [
      [L('colScore'), (r) => r.score, 'max', (v) => v],
      [L('colArtemis'), (r) => r.artemis.filter((c) => c.ok).length, 'max', (v, r) => artemisCell(r)],
      [L('colSunlit'), (r) => r.m.sunPct, 'max', (v) => v.toFixed(0) + '%'],
      [L('colEarth'), (r) => r.m.earthPct, 'max', (v) => v.toFixed(0) + '%'],
      [L('colBoth'), (r) => r.m.bothPct, 'max', (v) => v.toFixed(0) + '%'],
      ['slope', (r) => r.s.slope, 'min', (v) => v.toFixed(1) + '°' + (v > SLOPE_LIMIT ? ' ⚠' : '')],
      [L('colMaxSunEl'), (r) => r.m.sunElMax, 'max', (v) => v.toFixed(1) + '°'],
      [L('colSunUp'), (r) => sunUpAfterLanding(r.s, k0), 'max', (v) => (v ? fmtDays(v) : L('dark'))],
      [L('colNight'), (r) => r.m.longestDarkH, 'min', fmtDays],
      [L('colBlackout'), (r) => r.m.longestBlackoutH, 'min', fmtDays],
      [L('colWindows'), (r) => r.m.commWindows.length, 'none', (v) => v],
    ];
    const best = cols.map(([, get, dir]) => (dir === 'none' || !rows.length ? null : rows.map(get).reduce((a, b) => (dir === 'max' ? Math.max(a, b) : Math.min(a, b)))));
    $('table').innerHTML = `<tr><th>${L('colSite')}</th>` + cols.map((c) => `<th>${c[0] === 'slope' ? L('colSlope') : c[0]}</th>`).join('') + '</tr>' +
      rows.map((r, i) => `<tr class="${i === 0 ? 'rank1' : ''}"><td><span style="color:${r.s.color}">●</span> ${r.s.name}</td>` +
        cols.map(([name, get, , f], c) => `<td class="${name === 'slope' && get(r) > SLOPE_LIMIT ? 'warn' : best[c] !== null && get(r) === best[c] && rows.length > 1 ? 'best' : ''}">${f(get(r), r)}</td>`).join('') + '</tr>').join('') ;
  }

  // ---------- sky panorama ----------
  function focusSite() { return state.sites.find((s) => s.id === state.focus) || state.sites[0]; }
  function nowIndex() { const [k0, k1] = stayRange(); return Math.round(k0 + (state.scrub / 1000) * (k1 - k0)); }
  function renderPanorama() {
    const { g, w, h } = fit($('panorama')), s = focusSite();
    g.fillStyle = '#05070c'; g.fillRect(0, 0, w, h);
    if (!s) return;
    const [k0, k1] = stayRange(), t = s.track, kNow = nowIndex();
    let lo = -2, hi = 6;
    for (let a = 0; a < 360; a++) { lo = Math.min(lo, s.horizon[a] - 1); hi = Math.max(hi, s.horizon[a] + 1.5); }
    for (let k = k0; k <= k1; k++) {
      hi = Math.max(hi, t.earthEl[k] + 1.5, t.sunEl[k] + 1.5);
      lo = Math.min(lo, t.earthEl[k] - 1.5, t.sunEl[k] - 1.5); // keep a set Sun or Earth on the chart
    }
    hi = Math.min(hi, 90); lo = Math.max(lo, -10); // away from the pole the Sun climbs high
    const left = 34, bottom = 18, X = (az) => left + (az / 360) * (w - left), Y = (el) => (1 - (el - lo) / (hi - lo)) * (h - bottom);
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0b1020'); sky.addColorStop(1, '#141c33');
    g.fillStyle = sky; g.fillRect(left, 0, w - left, h - bottom);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.fillStyle = '#8a93a6'; g.font = '11px system-ui';
    for (let el = Math.ceil(lo); el <= hi; el += hi - lo > 12 ? 4 : 2) { g.beginPath(); g.moveTo(left, Y(el)); g.lineTo(w, Y(el)); g.stroke(); g.fillText(el + '°', 4, Y(el) + 4); }
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(left, Y(0)); g.lineTo(w, Y(0)); g.stroke();
    g.beginPath(); g.moveTo(X(0), h - bottom);
    for (let a = 0; a <= 360; a++) g.lineTo(X(a), Y(s.horizon[a % 360]));
    g.lineTo(X(360), h - bottom); g.closePath(); g.fillStyle = '#3a3f4b'; g.fill(); g.strokeStyle = '#9aa3b5'; g.stroke();
    for (const [az, txt] of [[0, L('N')], [90, L('E')], [180, L('Sd')], [270, L('W')], [360, L('N')]]) g.fillText(txt, X(az) - (az === 360 ? 10 : 0), h - 4);
    const stride = Math.max(1, Math.floor((k1 - k0) / 600));
    for (let k = k0; k <= k1; k += stride) {
      g.fillStyle = t.lit[k] ? 'rgba(255,200,61,.75)' : 'rgba(255,200,61,.18)'; g.fillRect(X(t.sunAz[k]) - 1, Y(t.sunEl[k]) - 1, 2.5, 2.5);
      g.fillStyle = t.comm[k] ? 'rgba(74,163,255,.8)' : 'rgba(74,163,255,.2)'; g.fillRect(X(t.earthAz[k]) - 1, Y(t.earthEl[k]) - 1, 2.5, 2.5);
    }
    const pxPerDeg = (h - bottom) / (hi - lo);
    const body = (az, el, rDeg, color, label) => {
      g.beginPath(); g.arc(X(az), Y(el), Math.max(5, rDeg * pxPerDeg), 0, 2 * Math.PI); g.fillStyle = color; g.fill();
      g.fillStyle = '#fff'; g.font = '12px system-ui'; g.fillText(label, X(az) + 9, Y(el) - 8);
    };
    body(t.sunAz[kNow], t.sunEl[kNow], 0.27, '#ffc83d', L('sun'));
    body(t.earthAz[kNow], t.earthEl[kNow], 0.95, '#4aa3ff', L('earth'));
    $('focusName').textContent = s.name;
    $('now').textContent = fmt(state.times[kNow]);
    const pct = Math.round(t.sunFrac[kNow] * 100);
    $('nowState').innerHTML =
      `<span class="stat" style="color:var(--sun)">☀ <b>${t.sunEl[kNow].toFixed(2)}°</b> ${L('sunElev')} · ${L('diskUp', { p: pct })} · ${until(t.lit, kNow, 'Sunset', 'Sunrise')}</span>` +
      `<span class="stat" style="color:${t.comm[kNow] ? 'var(--earth)' : 'var(--bad)'}">🌍 <b>${t.earthEl[kNow].toFixed(2)}°</b> ${L('earthElev')} · ${L(t.comm[kNow] ? 'linkUp' : 'noLink')} · ${until(t.comm, kNow, 'Earthset', 'Earthrise')}</span>`;
  }

  // ---------- timeline ----------
  const TL = { left: 150, right: 10, row: 13, gap: 9, top: 6 };
  function renderTimeline() {
    const c = $('timeline'), rowsH = state.sites.length * (2 * TL.row + TL.gap) + TL.top + 22;
    c.style.height = rowsH + 'px';
    const { g, w, h } = fit(c), n = state.times.length;
    g.fillStyle = '#0e121b'; g.fillRect(0, 0, w, h);
    const W = w - TL.left - TL.right, X = (k) => TL.left + (k / Math.max(1, n - 1)) * W;
    state.sites.forEach((s, r) => {
      const y = TL.top + r * (2 * TL.row + TL.gap);
      g.fillStyle = s.color; g.font = (s.id === state.focus ? 'bold ' : '') + '12px system-ui';
      g.fillText(s.name.length > 22 ? s.name.slice(0, 21) + '…' : s.name, 6, y + TL.row + 4);
      for (let x = 0; x < W; x++) {
        const a = Math.floor((x / W) * n), b = Math.max(a + 1, Math.floor(((x + 1) / W) * n));
        let sun = 0, comm = 0;
        for (let k = a; k < b; k++) { sun += s.track.sunFrac[k]; comm += s.track.comm[k]; }
        g.fillStyle = `rgba(255,200,61,${(0.08 + 0.92 * sun / (b - a)).toFixed(3)})`; g.fillRect(TL.left + x, y, 1, TL.row - 1);
        g.fillStyle = `rgba(74,163,255,${(0.08 + 0.92 * comm / (b - a)).toFixed(3)})`; g.fillRect(TL.left + x, y + TL.row, 1, TL.row - 1);
      }
    });
    const [k0, k1] = stayRange();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(X(k0), 2, Math.max(2, X(k1) - X(k0)), h - 24);
    g.fillStyle = '#8a93a6'; g.font = '11px system-ui'; g.fillText(L('tlLegend'), 6, h - 6);
    monthTicks(g, TL.left, w - TL.right, h - 16, 0, n - 1);
  }
  $('timeline').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect(), f = (e.clientX - r.left - TL.left) / (r.width - TL.left - TL.right);
    if (f < 0) return;
    state.landing = Math.max(0, Math.min(state.times.length - staySamples(), Math.round(f * (state.times.length - 1))));
    render();
  });

  // ---------- comm windows ----------
  function windowsFor(s) {
    const [k0, k1] = stayRange(), m = Analysis.metrics(s.track, k0, k1, state.stepH);
    return m.commWindows.map(([a, b]) => {
      let lit = 0; for (let k = a; k <= b; k++) lit += s.track.lit[k];
      return { start: state.times[a], end: state.times[b], hours: (b - a + 1) * state.stepH, sunPct: (100 * lit) / (b - a + 1) };
    });
  }
  function renderWindows() {
    const s = focusSite(); if (!s) return;
    const ws = windowsFor(s);
    $('windows').innerHTML = `<b>${s.name}</b>: ${L('windows', { n: ws.length })}<br>` +
      (ws.length ? `<table><tr><th>${L('winStart')}</th><th>${L('winEnd')}</th><th>${L('winDur')}</th><th>${L('winSun')}</th></tr>` +
        ws.map((x) => `<tr><td class="mono">${fmt(x.start)}</td><td class="mono">${fmt(x.end)}</td><td>${fmtDays(x.hours)}</td><td>${x.sunPct.toFixed(0)}%</td></tr>`).join('') + '</table>'
        : `<span style="color:var(--bad)">${L('noEarth')}</span>`);
  }
  $('csv').addEventListener('click', () => {
    const lines = ['site,lat,lon,window_start_utc,window_end_utc,hours,sunlit_pct'];
    for (const s of state.sites) for (const x of windowsFor(s))
      lines.push([`"${s.name}"`, s.lat, s.lon, x.start.toISOString(), x.end.toISOString(), x.hours, x.sunPct.toFixed(1)].join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'comm-windows.csv'; a.click();
  });

  // ---------- site list ----------
  function renderSiteList() {
    $('sites').innerHTML = '';
    for (const s of state.sites) {
      const el = document.createElement('div');
      el.className = 'site' + (s.id === state.focus ? ' focus' : '');
      el.title = s.from;
      el.innerHTML = `<span class="dot" style="background:${s.color}"></span><span class="nm">${s.name}<br><span class="ll">${s.lat.toFixed(3)}°, ${s.lon.toFixed(2)}°E · ${s.heightM} m · ${L('slope')} ${s.slope.toFixed(1)}°${s.slope > SLOPE_LIMIT ? ' ⚠ ' + L('tooSteep') : ''} · ${L('terrain')} ${s.res}</span></span><button title="${L('remove')}">×</button>`;
      el.onclick = () => { state.focus = s.id; renderSiteList(); render(); };
      el.querySelector('button').onclick = (e) => {
        e.stopPropagation();
        state.sites = state.sites.filter((x) => x !== s);
        if (state.focus === s.id) state.focus = state.sites[0]?.id ?? null;
        renderSiteList(); render();
      };
      $('sites').appendChild(el);
    }
  }
  const ALL_PRESETS = [...PRESET_SITES.map((p) => ({ ...p, group: 'South pole (best-lit points)' })), ...CATALOG_SITES];
  for (const grp of [...new Set(ALL_PRESETS.map((p) => p.group))]) {
    const og = document.createElement('optgroup'); og.dataset.grp = grp; og.label = grp;
    for (const p of ALL_PRESETS.filter((x) => x.group === grp)) og.appendChild(new Option(p.name, p.name));
    $('addPreset').appendChild(og);
  }
  $('addPreset').addEventListener('change', (e) => {
    const p = ALL_PRESETS.find((x) => x.name === e.target.value);
    if (p) addSite(p);
    e.target.value = '';
  });

  // ---------- neighbourhood: same pipeline as a site row, for an 11 x 11 grid one terrain pixel apart ----------
  const HOOD = 5; // cells each side of the centre
  function neighbourhood(s) {
    const spacing = resolution(s.lat, s.lon).startsWith('7.6') ? 7580 : 480, R = DEM.radius, c = Math.max(1e-3, Math.cos((s.lat * Math.PI) / 180));
    const cells = [], n = state.times.length - 1;
    for (let a = HOOD; a >= -HOOD; a--) for (let b = -HOOD; b <= HOOD; b++) {
      const lat = s.lat + ((a * spacing) / R) * (180 / Math.PI), lon = s.lon + ((b * spacing) / R / c) * (180 / Math.PI), gr = ground(lat, lon);
      const p = { lat, lon, heightM: gr.heightAt(lat, lon), horizon: gr.horizon(lat, lon, num('mast')) };
      const m = Analysis.metrics(Analysis.track(p, state.bodies, terrain.horizonAt, num('margin')), 0, n, state.stepH);
      cells.push({ sun: m.sunPct, earth: m.earthPct, slope: gr.slopeAt(lat, lon) });
    }
    return { cells, spacing };
  }
  function drawHood(id, cells, key, rgb) {
    const c = $(id), g = c.getContext('2d'), n = 2 * HOOD + 1, px = c.width / n;
    cells.forEach((v, k) => {
      const t = v[key] / 100;
      g.fillStyle = `rgb(${Math.round(15 + t * (rgb[0] - 15))},${Math.round(18 + t * (rgb[1] - 18))},${Math.round(27 + t * (rgb[2] - 27))})`;
      g.fillRect((k % n) * px, Math.floor(k / n) * px, px, px);
      if (v.slope > SLOPE_LIMIT) { g.fillStyle = 'rgba(255,107,107,.85)'; g.fillRect((k % n) * px + px - 7, Math.floor(k / n) * px + 3, 4, 4); } // red dot = slope over 10°
    });
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(HOOD * px, HOOD * px, px, px); // the site itself
  }
  $('hoodBtn').addEventListener('click', () => {
    const s = focusSite(); if (!s) return;
    $('hoodBtn').textContent = L('computing'); $('hoodBtn').disabled = true;
    setTimeout(() => { // let the button repaint before the heavy loop
      const { cells, spacing } = neighbourhood(s), r = (key) => [Math.min(...cells.map((v) => v[key])), Math.max(...cells.map((v) => v[key]))];
      drawHood('hoodSun', cells, 'sun', [255, 200, 61]); drawHood('hoodEarth', cells, 'earth', [74, 163, 255]);
      const [s0, s1] = r('sun'), [e0, e1] = r('earth'), km = ((HOOD * spacing) / 1000).toFixed(1);
      $('hoodText').textContent = L('hoodText', { site: s.name, km, m: spacing, s0: s0.toFixed(0), s1: s1.toFixed(0), e0: e0.toFixed(0), e1: e1.toFixed(0) });
      $('hood').hidden = false; $('hoodBtn').textContent = L('hoodBtn'); $('hoodBtn').disabled = false;
      window.__hood = { name: s.name, centre: cells[(cells.length - 1) / 2], sunRange: [s0, s1] };
    }, 30);
  });

  // ---------- wiring ----------
  // ---------- shareable link: everything needed to reproduce the view lives in the URL hash ----------
  const INPUTS = ['start', 'span', 'stay', 'mast', 'margin'];
  function writeHash() {
    const q = new URLSearchParams();
    for (const id of INPUTS) q.set(id, $(id).value);
    q.set('landing', state.landing);
    q.set('lang', I18n.lang);
    q.set('sites', state.sites.map((s) => [s.name, s.lat, s.lon].join('|')).join(';'));
    history.replaceState(null, '', '#' + q);
  }
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (!q.has('sites')) return null;
    for (const id of INPUTS) {
      if (!q.has(id)) continue;
      const el = $(id), prev = el.value;
      el.value = q.get(id);
      if (!el.value || !el.checkValidity()) el.value = prev; // a broken link value falls back to the default
    }
    const sites = q.get('sites').split(';').map((t) => t.split('|')).filter((p) => p.length === 3)
      .map(([name, lat, lon]) => ({ name, lat: +lat, lon: +lon })).filter((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 360);
    return { sites, landing: Math.max(0, parseInt(q.get('landing'), 10) || 0) };
  }

  $('share').addEventListener('click', () => {
    writeHash();
    const done = () => { $('share').textContent = L('copied'); setTimeout(() => ($('share').textContent = L('copy')), 1500); };
    navigator.clipboard?.writeText(location.href).then(done, () => prompt('Copy this link', location.href)) ?? prompt('Copy this link', location.href);
  });

  function render() {
    if (!state.times.length) return;
    writeHash();
    $('landing').textContent = fmt(state.times[state.landing]);
    renderMap(); renderGlobeMap(); renderPlanner(); renderTable(); renderPanorama(); renderTimeline(); renderWindows();
  }
  $('scrub').addEventListener('input', (e) => { state.scrub = +e.target.value; renderPanorama(); if ($('shadowToggle').checked) renderMap(); });
  let playing = null;
  $('play').addEventListener('click', () => {
    if (playing) { cancelAnimationFrame(playing); playing = null; $('play').textContent = '▶'; return; }
    $('play').textContent = '❚❚';
    const tick = () => {
      state.scrub = (state.scrub + 4) % 1001; $('scrub').value = state.scrub; renderPanorama();
      if ($('shadowToggle').checked) renderMap(); // cached per time step, so only new hours cost a recompute
      playing = requestAnimationFrame(tick);
    };
    tick();
  });
  const rerun = (horizonToo) => () => { computeTimes(); computeAll(horizonToo); render(); };
  $('start').addEventListener('change', rerun(false));
  $('span').addEventListener('change', rerun(false));
  $('stay').addEventListener('change', rerun(false));
  $('margin').addEventListener('change', rerun(false));
  $('mast').addEventListener('change', rerun(true));
  window.addEventListener('resize', render);
  $('slopeToggle').addEventListener('change', renderMap);
  $('shadowToggle').addEventListener('change', renderMap);

  // ---------- language: static markup by data-i18n attributes, dynamic text re-rendered ----------
  function applyLang(l) {
    I18n.set(l);
    document.documentElement.lang = I18n.lang;
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = L(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = L(el.dataset.i18nHtml); // fixed strings from i18n.js only
    for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = L(el.dataset.i18nTitle);
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = L(el.dataset.i18nPlaceholder);
    for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', L(el.dataset.i18nAria));
    const GRP = { 'South pole (best-lit points)': 'grpPole', Apollo: 'grpApollo', 'Commercial (CLPS)': 'grpClps', 'Other countries': 'grpOther' };
    for (const og of document.querySelectorAll('optgroup[data-grp]')) og.label = L(GRP[og.dataset.grp] || og.dataset.grp);
    $('draftNote').hidden = I18n.REVIEWED[I18n.lang];
    $('draftNote').textContent = I18n.NAMES[I18n.lang] + ': ' + L('draft');
    $('lang').value = I18n.lang;
    $('hood').hidden = true; // its sentence was written in the old language; one click recomputes it
    setView(!$('globeMap').hidden);
    try { localStorage.setItem('lang', I18n.lang); } catch (e) { /* storage blocked: the link still carries lang */ }
  }
  for (const [code, name] of Object.entries(I18n.NAMES))
    $('lang').add(new Option(name + (I18n.REVIEWED[code] ? '' : ' (draft)'), code));
  $('lang').addEventListener('change', (e) => { applyLang(e.target.value); renderSiteList(); render(); });
  let savedLang = null;
  try { savedLang = localStorage.getItem('lang'); } catch (e) { /* private mode */ }
  applyLang(new URLSearchParams(location.hash.slice(1)).get('lang') || savedLang || 'en');

  buildBaseMap(); buildGlobeMap();
  const shared = readHash();
  computeTimes();
  if (shared && shared.sites.length) {
    for (const p of shared.sites) addSite(p);
    state.landing = Math.min(shared.landing, Math.max(0, state.times.length - staySamples()));
  } else for (const name of DEFAULT_SITES) { const p = PRESET_SITES.find((x) => x.name === name); if (p) addSite(p); }
  state.focus = state.sites[0]?.id;
  renderSiteList(); render();
  window.__app = state; // handy for the console during the demo
})();
