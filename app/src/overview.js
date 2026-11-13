// South-pole overview map (LOLA LDEM_80S_80M block-averaged to 1.28 km)
// with candidate-site pins. Display only: vertical exaggeration and lighting
// are illustrative. The map is wrapped onto the Moon's sphere as a round polar cap
// and sits on a plain globe, so the screen shows a piece of the Moon and not a flat tile.
import * as THREE from '../vendor/three.module.js';
import { latlonToMap } from './science.js';

export const EXAG = 2.0;
const DEG = Math.PI / 180, R = 1737400;
/** Map metres (x east, z) and height h -> a point on the sphere, pole at the origin, up = +y. */
function curve(x, z, h) {
  const r = Math.hypot(x, z), a = r / R, s = r < 1 ? 1 : ((R + h) * Math.sin(a)) / r;
  return [x * s, (R + h) * Math.cos(a) - R, z * s];
}

const vert = /* glsl */`
attribute float hgt; attribute float rad;
varying vec3 vN; varying float vH; varying float vR;
void main(){ vN = normal; vH = hgt; vR = rad;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const frag = /* glsl */`
uniform vec3 light; uniform float hMin; uniform float hMax; uniform float ringR; uniform float edge;
varying vec3 vN; varying float vH; varying float vR;
void main(){
  if (vR > edge) discard;
  vec3 n = normalize(vN);
  float l = max(dot(n, light), 0.0);
  float t = clamp((vH - hMin) / (hMax - hMin), 0.0, 1.0);
  vec3 lo = vec3(0.10, 0.11, 0.14), hi = vec3(0.78, 0.76, 0.72);
  vec3 col = mix(lo, hi, 0.25 + 0.75 * t) * (0.18 + 0.95 * l);
  // latitude rings every 1 deg (approx. radius in map metres)
  float r = vR;
  float ring = 1.0 - smoothstep(0.0, 260.0, abs(mod(r + ringR * 0.5, ringR) - ringR * 0.5));
  col = mix(col, vec3(0.27, 0.88, 0.78), ring * 0.22);
  col *= mix(1.0, 0.42, smoothstep(edge * 0.72, edge, vR)); // the cap dims into the plain globe around it
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Overview {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(45, 1, 100, 1.2e7);
    this.target = new THREE.Vector3(0, 0, 0);
    this.dist = 760000; this.theta = 0; this.phi = 48; // orbit (deg)
    this.anim = null;
  }

  build(ov, sites) {
    const n = ov.n, pix = ov.pixel_m, c0 = (n - 1) / 2;
    const pos = new Float32Array(n * n * 3), hgt = new Float32Array(n * n), rad = new Float32Array(n * n);
    // Round cap: beyond `edge` nothing is drawn, and in the outer band heights sink to the globe under it.
    const edge = c0 * pix * 0.97, low = ov.min_m * EXAG - 400;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const i = r * n + c, x = (c - c0) * pix, z = (r - c0) * pix, d = Math.hypot(x, z);
      const k = Math.min(Math.max((d - edge * 0.8) / (edge * 0.2), 0), 1), f = k * k * (3 - 2 * k);
      hgt[i] = ov.h[i] * EXAG * (1 - f) + low * f; rad[i] = d;
      pos.set(curve(x, z, hgt[i]), i * 3);
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let k = 0;
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const a = r * n + c;
      idx.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], k); k += 6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('hgt', new THREE.BufferAttribute(hgt, 1)); g.setAttribute('rad', new THREE.BufferAttribute(rad, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { light: { value: new THREE.Vector3(0.5, 0.5, -0.7).normalize() },
        hMin: { value: ov.min_m * EXAG }, hMax: { value: ov.max_m * EXAG },
        ringR: { value: 2 * 1737400 * Math.tan(0.5 * DEG) }, edge: { value: edge } },
      vertexShader: vert, fragmentShader: frag });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.scene.add(this.mesh);
    // The rest of the Moon: a plain globe (no terrain data outside the cap), lit by the same light, and a few stars.
    const globe = new THREE.Mesh(new THREE.SphereGeometry(R + low - 300, 128, 96), new THREE.ShaderMaterial({
      uniforms: { light: this.mat.uniforms.light },
      vertexShader: 'varying vec3 vN; void main(){ vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 light; varying vec3 vN; void main(){ float l = max(dot(normalize(vN), light), 0.0); gl_FragColor = vec4(vec3(0.27, 0.272, 0.285) * 0.42 * (0.18 + 0.95 * l), 1.0);\n#include <colorspace_fragment>\n}' }));
    globe.position.y = -R;
    this.scene.add(globe);
    const st = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 2 * Math.PI, q = Math.sqrt(1 - u * u); st.set([6e6 * q * Math.cos(a), 6e6 * u - R, 6e6 * q * Math.sin(a)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(st, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd6e4, size: 1.6, sizeAttenuation: false })));
    this.ov = ov;
    this.sites = sites.map((s) => {
      const { X, Y } = latlonToMap(s.lat, s.lon);
      const p = new THREE.Vector3(...curve(X, -Y, this.heightAt(X, Y) * EXAG));
      return { ...s, pos: p };
    });
  }

  heightAt(X, Y) {
    const { n, pixel_m: pix, h } = this.ov, c0 = (n - 1) / 2;
    const c = Math.round(X / pix + c0), r = Math.round(c0 - Y / pix);
    if (r < 0 || c < 0 || r >= n || c >= n) return 0;
    return h[r * n + c];
  }

  /** Illustrative light from the current Sun azimuth, raised to 25 deg. */
  setSunAzimuth(az) {
    const a = az * DEG, e = 25 * DEG;
    this.mat?.uniforms.light.value.set(Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a));
  }

  /** lift: pixels to move the picture up, so the pole stays clear of the panel at the bottom of the map screen. */
  setSize(w, h, lift = 0) {
    this.camera.aspect = w / h;
    if (lift) this.camera.setViewOffset(w, h, 0, lift, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  _place() {
    const t = this.theta * DEG, p = this.phi * DEG;
    this.camera.position.set(
      this.target.x + this.dist * Math.cos(p) * Math.sin(t),
      this.target.y + this.dist * Math.sin(p),
      this.target.z + this.dist * Math.cos(p) * Math.cos(t));
    this.camera.lookAt(this.target);
  }

  flyTo(site, ms = 1800) {
    return new Promise((resolve) => {
      const from = { tx: this.target.x, ty: this.target.y, tz: this.target.z, d: this.dist, th: this.theta, ph: this.phi };
      const to = { tx: site.pos.x, ty: site.pos.y, tz: site.pos.z, d: 2500, th: this.theta + 25, ph: 6 };
      const t0 = performance.now();
      this.anim = (now) => {
        const u = Math.min((now - t0) / ms, 1);
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        const lg = (a, b) => a + (b - a) * e;
        this.target.set(lg(from.tx, to.tx), lg(from.ty, to.ty), lg(from.tz, to.tz));
        this.dist = Math.exp(lg(Math.log(from.d), Math.log(to.d)));
        this.theta = lg(from.th, to.th); this.phi = lg(from.ph, to.ph);
        if (u >= 1) { this.anim = null; resolve(); }
      };
    });
  }

  reset() {
    this.target.set(0, 0, 0); this.dist = 760000; this.theta = 0; this.phi = 48;
  }

  render(now) {
    if (this.anim) this.anim(now);
    this._place();
    this.renderer.render(this.scene, this.camera);
  }

  project(p, w, h, lift = 9500) {
    const v = p.clone().add(new THREE.Vector3(0, lift, 0)).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  }
}
