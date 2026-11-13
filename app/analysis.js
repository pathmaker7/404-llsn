// Turns Sun/Earth sky tracks plus a terrain horizon into planning numbers for each site.
(function (root) {
  const Sky = root.Sky || require('./sky.js');
  const DEG = 180 / Math.PI;
  const SUN_RADIUS_KM = 695700;

  // Fraction of a disk of angular radius r whose centre sits `above` degrees over the horizon line.
  function diskFraction(above, r) {
    const d = Math.max(-1, Math.min(1, above / r));
    return 1 - (Math.acos(d) - d * Math.sqrt(1 - d * d)) / Math.PI;
  }

  function makeTimes(start, days, stepHours) {
    const n = Math.floor((days * 24) / stepHours) + 1, t0 = start.getTime(), out = new Array(n);
    for (let k = 0; k < n; k++) out[k] = new Date(t0 + k * stepHours * 3600e3);
    return out;
  }

  // Runs of consecutive true samples in flags[k0..k1] as [start, end] (inclusive, absolute indices).
  function runs(flags, k0 = 0, k1 = flags.length - 1) {
    const out = [];
    let s = -1;
    for (let k = k0; k <= k1 + 1; k++) {
      const on = k <= k1 && flags[k];
      if (on && s < 0) s = k;
      if (!on && s >= 0) { out.push([s, k - 1]); s = -1; }
    }
    return out;
  }

  // First index after k where flags changes value (sunset, Earthset, or the next rise), -1 if none in the span.
  function nextChange(flags, k) {
    for (let j = k + 1; j < flags.length; j++) if (flags[j] !== flags[k]) return j;
    return -1;
  }

  // Sky tracks of one site over all times. bodies = Sky.bodiesMoonFixed per time, shared by all sites.
  function track(site, bodies, horizonAt, earthMarginDeg = 0) {
    const n = bodies.length, f = Sky.siteFrame(site.lat, site.lon, site.heightM || 0);
    const t = {
      sunAz: new Float32Array(n), sunEl: new Float32Array(n), earthAz: new Float32Array(n), earthEl: new Float32Array(n),
      sunFrac: new Float32Array(n), lit: new Uint8Array(n), comm: new Uint8Array(n),
    };
    for (let k = 0; k < n; k++) {
      const s = Sky.azEl(bodies[k].sun, f), e = Sky.azEl(bodies[k].earth, f);
      t.sunAz[k] = s.az; t.sunEl[k] = s.el; t.earthAz[k] = e.az; t.earthEl[k] = e.el;
      t.sunFrac[k] = diskFraction(s.el - horizonAt(site.horizon, s.az), Math.asin(SUN_RADIUS_KM / s.dist) * DEG);
      t.lit[k] = t.sunFrac[k] >= 0.5 ? 1 : 0;
      t.comm[k] = e.el - horizonAt(site.horizon, e.az) > earthMarginDeg ? 1 : 0;
    }
    // Prefix sums make any window's averages O(1), which the date planner needs for every start date.
    t.cumSun = new Float64Array(n + 1); t.cumComm = new Float64Array(n + 1); t.cumBoth = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) {
      t.cumSun[k + 1] = t.cumSun[k] + t.sunFrac[k];
      t.cumComm[k + 1] = t.cumComm[k] + t.comm[k];
      t.cumBoth[k + 1] = t.cumBoth[k] + (t.lit[k] & t.comm[k]);
    }
    return t;
  }

  // Planning numbers for samples k0..k1 (inclusive).
  function metrics(t, k0, k1, stepHours) {
    const n = k1 - k0 + 1;
    const hours = (r) => (r[1] - r[0] + 1) * stepHours;
    const longest = (rs) => rs.reduce((m, r) => Math.max(m, hours(r)), 0);
    const notLit = Uint8Array.from(t.lit, (v) => 1 - v), notComm = Uint8Array.from(t.comm, (v) => 1 - v);
    const commWindows = runs(t.comm, k0, k1);
    let elSum = 0, elMax = -90;
    for (let k = k0; k <= k1; k++) { elSum += t.sunEl[k]; elMax = Math.max(elMax, t.sunEl[k]); }
    return {
      sunElMean: elSum / n,
      sunElMax: elMax,
      sunPct: (100 * (t.cumSun[k1 + 1] - t.cumSun[k0])) / n,
      earthPct: (100 * (t.cumComm[k1 + 1] - t.cumComm[k0])) / n,
      bothPct: (100 * (t.cumBoth[k1 + 1] - t.cumBoth[k0])) / n,
      longestDarkH: longest(runs(notLit, k0, k1)),
      longestBlackoutH: longest(runs(notComm, k0, k1)),
      commWindows,
    };
  }

  // 0..100: average sunlight and Earth visibility, minus a penalty for the longest night.
  function score(m, windowHours) {
    const night = Math.min(1, m.longestDarkH / windowHours);
    return Math.round(0.4 * m.sunPct + 0.4 * m.earthPct + 20 * (1 - night));
  }

  // For every landing sample k, mean (sun% + earth%) / 2 over the following w samples.
  function plannerCurve(t, w) {
    const n = t.sunFrac.length - w + 1, out = new Float32Array(Math.max(0, n));
    for (let k = 0; k < n; k++)
      out[k] = (50 * (t.cumSun[k + w] - t.cumSun[k] + t.cumComm[k + w] - t.cumComm[k])) / w;
    return out;
  }

  // NASA "Key Artemis III Landing Requirements" (Artemis overview for Space Apps, NTRS 20250009323), the five
  // that terrain and geometry decide. Requirement 6 (land within 100 m of a target) is navigation, not site choice.
  function artemisChecks(x) {
    return [
      { id: 'pole', label: 'within 6° of the south pole', ok: x.lat <= -84 },
      { id: 'slope', label: 'landing slope under 10°', ok: x.slope < 10 },
      { id: 'eva', label: 'EVA slope within 2 km under 20°', ok: x.evaSlope < 20 },
      { id: 'dwe', label: 'direct-to-Earth link during the stay', ok: x.earthPct > 0 },
      { id: 'light', label: 'Sun up at landing', ok: x.sunUpAtLanding },
    ];
  }

  const Analysis = { artemisChecks, track, metrics, score, plannerCurve, makeTimes, diskFraction, runs, nextChange };
  if (typeof module !== 'undefined' && module.exports) module.exports = Analysis;
  else root.Analysis = Analysis;
})(typeof globalThis !== 'undefined' ? globalThis : this);
