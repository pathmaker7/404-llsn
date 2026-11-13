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
attribute float hgt; attribute float rad; attribute vec2 mxz;
varying vec3 vN; varying float vH; varying float vR; varying vec2 vM;
void main(){ vN = normal; vH = hgt; vR = rad; vM = mxz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const MOON = /* glsl */`uniform sampler2D moon; uniform vec3 sun3;
// One Moon: NASA's colour map of the whole Moon, lit by the real Sun direction. n: unit vector from the Moon's
// centre in scene axes (y points out of the south pole, lon 0 is toward -z, lon 90 E toward +x).
vec3 moonCol(vec3 n){
  float lon = atan(n.x, -n.z), lat = -asin(clamp(n.y, -1.0, 1.0));
  vec3 c = texture2D(moon, vec2(lon / 6.2831853 + 0.5, lat / 3.14159265 + 0.5)).rgb;
  return c * 1.75 * (0.05 + smoothstep(-0.02, 0.12, dot(n, sun3)));
}
`;
const frag = /* glsl */`
uniform vec3 light; uniform float hMin; uniform float hMax; uniform float ringR; uniform float edge;
uniform sampler2D hmap; uniform vec2 sunDir; uniform float sunEl; uniform float pix; uniform float gridN;
varying vec3 vN; varying float vH; varying float vR; varying vec2 vM;
const float RM = 1737400.0;
${MOON}float hAt(vec2 p){ return texture2D(hmap, (p / pix + 0.5 * gridN) / gridN).r; }
// Real shadow: walk from this point toward the Sun over the terrain; lit when no ground rises above the Sun's
// elevation here (elevation at the pole plus the angle this point sits toward the Sun; the sphere drops d*d/2R).
float sunlit(){
  float h0 = hAt(vM) + 2.0, tanS = tan(sunEl + dot(vM, sunDir) / RM), half_ = 0.5 * (gridN - 1.0) * pix, d = pix, vis = 1.0;
  for (int i = 0; i < 80; i++) {
    vec2 q = vM + sunDir * d;
    if (abs(q.x) > half_ || abs(q.y) > half_) break;
    vis = min(vis, smoothstep(-0.004, 0.004, tanS - (hAt(q) - h0 - d * d / (2.0 * RM)) / d));
    if (vis <= 0.0) break;
    d = d * 1.06 + pix * 0.6;
  }
  return vis;
}
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
  col *= mix(0.2, 1.0, sunlit());
  float a = vR / RM, sa = sin(a) / max(vR, 1.0);
  col = mix(col, moonCol(vec3(sa * vM.x, cos(a), sa * vM.y)), smoothstep(edge * 0.5, edge * 0.96, vR)); // the detailed cap fades into the Moon around it
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Overview {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(45, 1, 100, 2e8);
    this.target = new THREE.Vector3(0, 0, 0);
    this.dist = 760000; this.theta = 0; this.phi = 48; // orbit (deg)
    this.anim = null;
    this.pole = new THREE.Vector3();
  }

  build(ov, sites) {
    const n = ov.n, pix = ov.pixel_m, c0 = (n - 1) / 2;
    const pos = new Float32Array(n * n * 3), hgt = new Float32Array(n * n), rad = new Float32Array(n * n), mxz = new Float32Array(n * n * 2);
    const half16 = new Uint16Array(n * n); // heights as a texture for the shadow walk in the shader
    for (let i = 0; i < n * n; i++) half16[i] = THREE.DataUtils.toHalfFloat(ov.h[i]);
    const hmap = new THREE.DataTexture(half16, n, n, THREE.RedFormat, THREE.HalfFloatType);
    hmap.magFilter = hmap.minFilter = THREE.LinearFilter; hmap.needsUpdate = true;
    // Round cap: beyond `edge` nothing is drawn, and in the outer band heights sink to the globe under it.
    const edge = c0 * pix * 0.97, low = ov.min_m * EXAG - 400;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const i = r * n + c, x = (c - c0) * pix, z = (r - c0) * pix, d = Math.hypot(x, z);
      const k = Math.min(Math.max((d - edge * 0.8) / (edge * 0.2), 0), 1), f = k * k * (3 - 2 * k);
      hgt[i] = ov.h[i] * EXAG * (1 - f) + low * f; rad[i] = d; mxz[i * 2] = x; mxz[i * 2 + 1] = z;
      pos.set(curve(x, z, hgt[i]), i * 3);
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let k = 0;
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const a = r * n + c;
      idx.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], k); k += 6;
    }
    const moonTex = new THREE.TextureLoader().load('data/moon.jpg'); // NASA SVS CGI Moon Kit colour map, 2k
    moonTex.colorSpace = THREE.SRGBColorSpace; moonTex.generateMipmaps = false; moonTex.minFilter = THREE.LinearFilter; moonTex.wrapS = THREE.RepeatWrapping;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('hgt', new THREE.BufferAttribute(hgt, 1)); g.setAttribute('rad', new THREE.BufferAttribute(rad, 1)); g.setAttribute('mxz', new THREE.BufferAttribute(mxz, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { light: { value: new THREE.Vector3(0.5, 0.5, -0.7).normalize() },
        hMin: { value: ov.min_m * EXAG }, hMax: { value: ov.max_m * EXAG },
        ringR: { value: 2 * 1737400 * Math.tan(0.5 * DEG) }, edge: { value: edge },
        moon: { value: moonTex }, sun3: { value: new THREE.Vector3(0, 0, -1) },
        hmap: { value: hmap }, sunDir: { value: new THREE.Vector2(0, -1) }, sunEl: { value: 0.02 }, pix: { value: pix }, gridN: { value: n } },
      vertexShader: vert, fragmentShader: frag });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.scene.add(this.mesh);
    // The rest of the Moon: a plain globe (no terrain data outside the cap), lit by the same light, and a few stars.
    const globe = new THREE.Mesh(new THREE.SphereGeometry(R + low - 300, 128, 96), new THREE.ShaderMaterial({
      uniforms: { moon: this.mat.uniforms.moon, sun3: this.mat.uniforms.sun3 },
      vertexShader: 'varying vec3 vN; void main(){ vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: MOON + 'varying vec3 vN; void main(){ gl_FragColor = vec4(moonCol(normalize(vN)), 1.0);\n#include <colorspace_fragment>\n}' }));
    globe.position.y = -R;
    this.scene.add(globe);
    const st = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 2 * Math.PI, q = Math.sqrt(1 - u * u); st.set([6e7 * q * Math.cos(a), 6e7 * u - R, 6e7 * q * Math.sin(a)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(st, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd6e4, size: 1.6, sizeAttenuation: false })));
    // The Sun and Earth as bodies in the sky, in their real directions (drawn far larger than they would look).
    const disc = (stops) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      for (const [o, col] of stops) gr.addColorStop(o, col); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); this.scene.add(s); return s; };
    this.sunBody = disc([[0, '#fff'], [0.13, '#fff'], [0.16, 'rgba(255,244,214,.9)'], [0.22, 'rgba(255,214,140,.35)'], [0.5, 'rgba(255,190,110,.08)'], [1, 'rgba(255,170,60,0)']]); this.sunBody.scale.setScalar(9e6);
    const earthTex = new THREE.TextureLoader().load('data/earth.jpg'); earthTex.colorSpace = THREE.SRGBColorSpace; // NASA Blue Marble
    this.earthBody = new THREE.Mesh(new THREE.SphereGeometry(1.3e6, 64, 32), new THREE.ShaderMaterial({
      uniforms: { map: { value: earthTex }, sun3: this.mat.uniforms.sun3 },
      vertexShader: 'varying vec3 vN; varying vec2 vUv; varying vec3 vV; void main(){ vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 sun3; varying vec3 vN; varying vec2 vUv; varying vec3 vV; void main(){ vec3 n = normalize(vN); float l = dot(n, sun3); float day = smoothstep(-0.03, 0.12, l); vec3 c = mix(vec3(0.0, 0.003, 0.01), texture2D(map, vUv).rgb * (0.4 + 0.9 * max(l, 0.0)), day); c += vec3(0.25, 0.5, 1.0) * pow(1.0 - max(dot(n, vV), 0.0), 3.0) * 0.7 * day; gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}' }));
    this.earthBody.rotation.x = Math.PI; this.scene.add(this.earthBody);
    this.ov = ov; this.edge = edge;
    this.sites = sites.map((s) => {
      const { X, Y } = latlonToMap(s.lat, s.lon);
      const p = new THREE.Vector3(...curve(X, -Y, this.heightAt(X, Y) * EXAG));
      return { ...s, pos: p };
    });
  }

  /** A site added later. onCap: it lies on the detailed polar terrain; otherwise it sits on the globe. */
  addSite(s, onCap) {
    const { X, Y } = latlonToMap(s.lat, s.lon), la = s.lat * DEG, lo = s.lon * DEG;
    const pos = onCap ? new THREE.Vector3(...curve(X, -Y, this.heightAt(X, Y) * EXAG))
      : new THREE.Vector3(R * Math.cos(la) * Math.sin(lo), -R * Math.sin(la) - R, -R * Math.cos(la) * Math.cos(lo));
    const o = { ...s, pos, off: !onCap };
    this.sites.push(o);
    return o;
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
  /** The real Sun and Earth at a moment: sub-solar and sub-Earth longitude and latitude on the Moon, radians.
   *  Shadows follow the Sun; the shading light keeps the Sun's direction but is raised so lit ground stays readable. */
  setSky(sunLon, sunLat, earthLon, earthLat = 0) {
    if (!this.mat) return;
    const dir = (lon, lat) => new THREE.Vector3(Math.cos(lat) * Math.sin(lon), -Math.sin(lat), -Math.cos(lat) * Math.cos(lon));
    this.mat.uniforms.sun3.value.copy(dir(sunLon, sunLat));
    this.sunBody.position.copy(dir(sunLon, sunLat)).multiplyScalar(2.6e7).y -= R; this.earthBody.position.copy(dir(earthLon, earthLat)).multiplyScalar(2.2e7).y -= R;
    this.mat.uniforms.sunDir.value.set(Math.sin(sunLon), -Math.cos(sunLon));
    this.mat.uniforms.sunEl.value = -sunLat; // at the south pole the Sun stands as high as it is south of the equator
    this.setSunAzimuth(sunLon / DEG);
    const at = (lon) => new THREE.Vector3(...curve(Math.sin(lon) * this.edge * 1.04, -Math.cos(lon) * this.edge * 1.04, 0));
    this.sunMark = at(sunLon); this.earthMark = at(earthLon);
  }

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

  /** Opening move: from far enough to see the whole Moon, down to the south pole. */
  intro(ms = 3200) {
    const d1 = this.dist, d0 = 7.5e6, t0 = performance.now();
    this.dist = d0; this.introFrom = d0;
    this.anim = (now) => {
      const u = Math.min((now - t0) / ms, 1), e = 1 - Math.pow(1 - u, 3);
      this.dist = Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * e);
      if (u >= 1) this.anim = null;
    };
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
