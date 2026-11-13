// Sun and Earth positions in the local sky of a point on the Moon.
// Works in the browser (global `Astronomy` from astronomy-engine) and in Node.
(function (root) {
  const A = root.Astronomy || require('astronomy-engine');
  const D = Math.PI / 180;
  const AU_KM = 149597870.7;
  const R_MOON_KM = 1737.4; // LOLA reference sphere
  const SUN_RADIUS_KM = 695700;
  const EARTH_RADIUS_KM = 6378.1;

  // EQJ (J2000 equatorial) vector -> Moon body-fixed, IAU WGCCRE rotation model:
  // v_bf = Rz(W) * Rx(90 - dec) * Rz(90 + ra) * v_eqj
  function toMoonFixed(v, axis) {
    const a = (axis.ra * 15 + 90) * D, b = (90 - axis.dec) * D, w = axis.spin * D;
    let x = Math.cos(a) * v[0] + Math.sin(a) * v[1], y = -Math.sin(a) * v[0] + Math.cos(a) * v[1], z = v[2];
    const y2 = Math.cos(b) * y + Math.sin(b) * z, z2 = -Math.sin(b) * y + Math.cos(b) * z;
    return [Math.cos(w) * x + Math.sin(w) * y2, -Math.sin(w) * x + Math.cos(w) * y2, z2];
  }

  // Sun and Earth positions (km) in the Moon body-fixed frame at a Date.
  function bodiesMoonFixed(date) {
    const t = A.MakeTime(date);
    const moon = A.GeoMoon(t), sun = A.GeoVector(A.Body.Sun, t, false);
    const axis = A.RotationAxis(A.Body.Moon, t);
    const k = AU_KM;
    return {
      sun: toMoonFixed([(sun.x - moon.x) * k, (sun.y - moon.y) * k, (sun.z - moon.z) * k], axis),
      earth: toMoonFixed([-moon.x * k, -moon.y * k, -moon.z * k], axis),
    };
  }

  // Local east/north/up basis of a site (planetocentric lat/lon, degrees east).
  function siteFrame(latDeg, lonDeg, heightM) {
    const la = latDeg * D, lo = lonDeg * D, r = R_MOON_KM + (heightM || 0) / 1000;
    const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    return {
      pos: up.map((c) => c * r),
      up,
      east: [-Math.sin(lo), Math.cos(lo), 0],
      north: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
    };
  }

  // Azimuth (deg from north, clockwise through east), elevation (deg), distance (km).
  function azEl(target, f) {
    const v = [target[0] - f.pos[0], target[1] - f.pos[1], target[2] - f.pos[2]];
    const n = Math.hypot(v[0], v[1], v[2]);
    const dot = (a) => (a[0] * v[0] + a[1] * v[1] + a[2] * v[2]) / n;
    let az = Math.atan2(dot(f.east), dot(f.north)) / D;
    if (az < 0) az += 360;
    return { az, el: Math.asin(dot(f.up)) / D, dist: n };
  }

  // Sun and Earth in the sky of one site at one moment.
  function skyAt(date, site) {
    const f = siteFrame(site.lat, site.lon, site.height);
    const b = bodiesMoonFixed(date);
    const sun = azEl(b.sun, f), earth = azEl(b.earth, f);
    sun.radius = Math.asin(SUN_RADIUS_KM / sun.dist) / D;
    earth.radius = Math.asin(EARTH_RADIUS_KM / earth.dist) / D;
    return { sun, earth };
  }

  // Yardstick for Mission mode: the Sun over a place on Earth during one UTC day.
  // Highest elevation (degrees, with refraction) and hours above the horizon, sampled every 10 minutes.
  function sunDayOnEarth(date, lat, lon) {
    const obs = new A.Observer(lat, lon, 0), t0 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    let maxEl = -90, up = 0;
    for (let m = 0; m < 1440; m += 10) {
      const t = new Date(t0 + m * 60000), eq = A.Equator(A.Body.Sun, t, obs, true, true);
      const el = A.Horizon(t, obs, eq.ra, eq.dec, 'normal').altitude;
      maxEl = Math.max(maxEl, el);
      if (el > 0) up += 10;
    }
    return { maxEl, upHours: up / 60 };
  }

  const Sky = { skyAt, bodiesMoonFixed, siteFrame, azEl, sunDayOnEarth, R_MOON_KM };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sky;
  else root.Sky = Sky;
})(typeof globalThis !== 'undefined' ? globalThis : this);
