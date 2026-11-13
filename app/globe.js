// Whole-Moon terrain: LOLA LDEM_4 (7.58 km) everywhere, LDEM_64 (474 m) patches around curated sites.
// Same interface as Terrain where the app needs it: heightAt, slopeAt, horizon, plus resolutionAt.
(function (root) {
  const Terrain = root.Terrain || require('./terrain.js');
  const D = Math.PI / 180, R = 1737400;
  const decode = (b64) => {
    const bytes = typeof atob !== 'undefined' ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : new Uint8Array(Buffer.from(b64, 'base64'));
    return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  };

  function Globe(G, patches) {
    const g = { ppd: G.ppd, w: G.w, h: G.h, line0: 0, sample0: 0, z: decode(G.data), wrap: true };
    const ps = patches.map((p) => ({ ...p, z: decode(p.data), wrap: false }));

    // Bilinear height in an equirectangular grid; NaN outside a patch.
    function sample(m, lat, lon) {
      // Column relative to the grid's first sample, modulo a full turn: a patch may start west of 0 (sample0 < 0).
      const turn = 360 * m.ppd;
      let L = (90 - lat) * m.ppd - 0.5 - m.line0, S = (((((lon % 360) + 360) % 360) * m.ppd - 0.5 - m.sample0) % turn + turn) % turn;
      if (m.wrap) { L = Math.max(0, Math.min(m.h - 1.001, L)); S = ((S % m.w) + m.w) % m.w; }
      else if (L < 0 || S < 0 || L > m.h - 2 || S > m.w - 2) return NaN;
      const l0 = L | 0, s0 = S | 0, fl = L - l0, fs = S - s0, s1 = m.wrap ? (s0 + 1) % m.w : s0 + 1;
      const a = m.z[l0 * m.w + s0], b = m.z[l0 * m.w + s1], c = m.z[(l0 + 1) * m.w + s0], d = m.z[(l0 + 1) * m.w + s1];
      return (a * (1 - fs) + b * fs) * (1 - fl) + (c * (1 - fs) + d * fs) * fl;
    }
    function patchAt(lat, lon) { return ps.find((p) => sample(p, lat, lon) === sample(p, lat, lon)) || null; }
    function heightAt(lat, lon) {
      for (const p of ps) { const v = sample(p, lat, lon); if (v === v) return v; }
      return sample(g, lat, lon);
    }
    const heightAtVec = (x, y, z) => heightAt(Math.asin(Math.max(-1, Math.min(1, z))) / D, Math.atan2(y, x) / D);

    // Central differences over 2 pixels of whichever grid covers the point.
    function slopeAt(lat, lon) {
      const d = 1 / (patchAt(lat, lon) ? 64 : g.ppd), m = d * D * R, c = Math.max(0.05, Math.cos(lat * D));
      const dn = (heightAt(lat + d, lon) - heightAt(lat - d, lon)) / (2 * m);
      const de = (heightAt(lat, lon + d / c) - heightAt(lat, lon - d / c)) / (2 * m);
      return Math.atan(Math.hypot(dn, de)) / D;
    }

    // Near field at the patch's 474 m spacing out to 75 km, then the global grid at half its pixel to 400 km.
    // ponytail: 400 km cap; terrain 9 km high drops below a 0 degree horizon beyond about 180 km.
    const NEAR = Float64Array.from({ length: 158 }, (_, s) => (s + 1) * 474);
    const FAR = Float64Array.from({ length: 106 }, (_, s) => 75000 + (s + 1) * 3790);
    const BOTH = Float64Array.from([...NEAR, ...FAR]);
    const FAR_ONLY = Float64Array.from({ length: 106 }, (_, s) => (s + 1) * 3790);
    function horizon(lat, lon, mastM) {
      return Terrain.march(lat, lon, R + heightAt(lat, lon) + (mastM || 0), R, heightAtVec, patchAt(lat, lon) ? BOTH : FAR_ONLY);
    }
    // Steepest slope within rM metres, sampled on the grid spacing that covers the point.
    function maxSlopeWithin(lat, lon, rM) {
      const stepM = patchAt(lat, lon) ? 474 : 7580, n = Math.max(1, Math.floor(rM / stepM)), c = Math.max(0.05, Math.cos(lat * D));
      let m = 0;
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++)
        if (a * a + b * b <= n * n) m = Math.max(m, slopeAt(lat + (a * stepM) / R / D, lon + (b * stepM) / R / D / c) || 0);
      return m;
    }
    const resolutionAt =(lat, lon) => (patchAt(lat, lon) ? '474 m' : '7.6 km (coarse)');

    return { heightAt, heightAtVec, slopeAt, maxSlopeWithin, horizon, resolutionAt, global: g };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = Globe;
  else root.Globe = Globe;
})(typeof globalThis !== 'undefined' ? globalThis : this);
