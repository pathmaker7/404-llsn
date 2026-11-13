// Terrain from the LOLA DEM: height lookup, lat/lon <-> grid, and the horizon profile of a site.
(function (root) {
  const D = Math.PI / 180;

  // Terrain horizon elevation (deg) for each whole-degree azimuth (0 = north, 90 = east).
  // Marches great circles out to each distance in `dists` (m) and keeps the highest elevation angle,
  // Moon curvature included; stops at the first NaN height (left the terrain). r0 = observer radius (m).
  function march(lat, lon, r0, R, heightAtVec, dists) {
    const u = [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
    const east = [-Math.sin(lon * D), Math.cos(lon * D), 0];
    const north = [-Math.sin(lat * D) * Math.cos(lon * D), -Math.sin(lat * D) * Math.sin(lon * D), Math.cos(lat * D)];
    const out = new Float32Array(360);
    for (let az = 0; az < 360; az++) {
      const ca = Math.cos(az * D), sa = Math.sin(az * D);
      const d = [north[0] * ca + east[0] * sa, north[1] * ca + east[1] * sa, north[2] * ca + east[2] * sa];
      let best = -1;
      for (let s = 0; s < dists.length; s++) {
        const t = dists[s] / R, ct = Math.cos(t), st = Math.sin(t);
        const hq = heightAtVec(u[0] * ct + d[0] * st, u[1] * ct + d[1] * st, u[2] * ct + d[2] * st);
        if (hq !== hq) break;
        const rq = R + hq;
        const up = rq * ct - r0, along = rq * st; // terrain point relative to the observer, local up / along-track
        const sinEl = up / Math.hypot(up, along);
        if (sinEl > best) best = sinEl;
      }
      out[az] = Math.asin(best) / D;
    }
    return out;
  }

  function Terrain(dem, fallback) {
    const bytes = typeof atob !== 'undefined'
      ? Uint8Array.from(atob(dem.data), (c) => c.charCodeAt(0))
      : new Uint8Array(Buffer.from(dem.data, 'base64'));
    const h = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const n = dem.n, scale = dem.scale, R = dem.radius, c = n / 2 - 0.5; // pole sits between the middle pixels

    // Unit vector (Moon body-fixed) -> fractional grid coords (i = column, j = row). South polar stereographic:
    // X = 2R tan(a/2) sin(lon), Y = 2R tan(a/2) cos(lon), a = angle from the south pole; row grows downward.
    function vecToGrid(x, y, z) {
      const k = (2 * R) / (1 - z) / scale;
      return [c + y * k, c - x * k];
    }
    function latLonToVec(lat, lon) {
      return [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
    }
    function gridToLatLon(i, j) {
      const X = (i - c) * scale, Y = (c - j) * scale;
      const a = 2 * Math.atan(Math.hypot(X, Y) / (2 * R));
      return { lat: -90 + a / D, lon: Math.atan2(X, Y) / D };
    }
    function heightAtGrid(i, j) {
      if (i < 0 || j < 0 || i > n - 2 || j > n - 2) return NaN;
      const i0 = i | 0, j0 = j | 0, fi = i - i0, fj = j - j0, p = j0 * n + i0;
      return (h[p] * (1 - fi) + h[p + 1] * fi) * (1 - fj) + (h[p + n] * (1 - fi) + h[p + n + 1] * fi) * fj;
    }
    function heightAt(lat, lon) {
      const v = latLonToVec(lat, lon);
      const g = vecToGrid(v[0], v[1], v[2]);
      return heightAtGrid(g[0], g[1]);
    }

    // Surface slope (deg) by central differences over 2 pixels (960 m baseline at 480 m/px).
    // ponytail: ignores the stereographic scale factor (under 1% inside 80 S); lander-scale slope is steeper.
    function slopeAtGrid(i, j) {
      const dx = (heightAtGrid(i + 1, j) - heightAtGrid(i - 1, j)) / (2 * scale);
      const dy = (heightAtGrid(i, j + 1) - heightAtGrid(i, j - 1)) / (2 * scale);
      return Math.atan(Math.hypot(dx, dy)) / D;
    }
    function slopeAt(lat, lon) {
      const v = latLonToVec(lat, lon), g = vecToGrid(v[0], v[1], v[2]);
      return slopeAtGrid(g[0], g[1]);
    }
    // Steepest slope within rM metres (Artemis III EVA limit uses 2 km).
    function maxSlopeWithin(lat, lon, rM) {
      const v = latLonToVec(lat, lon), [ci, cj] = vecToGrid(v[0], v[1], v[2]), r = rM / scale;
      let m = 0;
      for (let dj = -Math.floor(r); dj <= r; dj++) for (let di = -Math.floor(r); di <= r; di++)
        if (di * di + dj * dj <= r * r) m = Math.max(m, slopeAtGrid(ci + di, cj + dj) || 0);
      return m;
    }

    // Is the Sun's centre above the terrain seen from grid pixel (i, j)? sun = unit vector to the Sun (body-fixed).
    // Marches a great circle toward the Sun in steps of stepPx pixels out to maxM metres; stops at the first block.
    function sunVisibleAtGrid(i, j, sun, stepPx, maxM) {
      const h0 = heightAtGrid(i, j);
      if (h0 !== h0) return false;
      const ll = gridToLatLon(i, j), u = latLonToVec(ll.lat, ll.lon), r0 = R + h0;
      const su = sun[0] * u[0] + sun[1] * u[1] + sun[2] * u[2]; // sine of the Sun's elevation above the local horizontal
      let d = [sun[0] - su * u[0], sun[1] - su * u[1], sun[2] - su * u[2]];
      const dn = Math.hypot(d[0], d[1], d[2]); d = [d[0] / dn, d[1] / dn, d[2] / dn];
      for (let s = 1, t; (t = (s * stepPx * scale) / R) * R <= maxM; s++) {
        const ct = Math.cos(t), st = Math.sin(t), g = vecToGrid(u[0] * ct + d[0] * st, u[1] * ct + d[1] * st, u[2] * ct + d[2] * st);
        const hq = heightAtGrid(g[0], g[1]);
        if (hq !== hq) break;
        const up = (R + hq) * ct - r0, along = (R + hq) * st;
        if (up / Math.hypot(up, along) > su) return false;
      }
      return true; // nothing blocked it; the march includes the Moon's curvature, which blocks a low Sun by itself
    }

    // Height (m) at a unit vector; past the polar map edge, the optional global terrain takes over.
    function heightAtVec(x, y, z) {
      const g = vecToGrid(x, y, z), hq = heightAtGrid(g[0], g[1]);
      return hq === hq || !fallback ? hq : fallback(x, y, z);
    }
    // 300 km cap: terrain at distance d must stand d^2 / 2R higher to reach the horizon (26 km at 300 km),
    // more relief than the Moon has, so nothing farther can block the Sun or Earth.
    const dists = Float64Array.from({ length: Math.min(Math.ceil(n * 1.5), Math.ceil(300000 / scale)) }, (_, s) => (s + 1) * scale);
    function horizon(lat, lon, mastM) {
      return march(lat, lon, R + heightAt(lat, lon) + (mastM || 0), R, heightAtVec, dists);
    }

    // Horizon elevation at any azimuth, linear between whole degrees.
    function horizonAt(profile, az) {
      const a = ((az % 360) + 360) % 360, i = Math.floor(a), f = a - i;
      return profile[i] * (1 - f) + profile[(i + 1) % 360] * f;
    }

    return { n, scale, heights: h, heightAt, heightAtGrid, slopeAt, slopeAtGrid, maxSlopeWithin, sunVisibleAtGrid, gridToLatLon, latLonToVec, vecToGrid, horizon, horizonAt };
  }

  Terrain.march = march;
  if (typeof module !== 'undefined' && module.exports) module.exports = Terrain;
  else root.Terrain = Terrain;
})(typeof globalThis !== 'undefined' ? globalThis : this);
