// My lander: the three machines (lander, rover, hopper drone) and the four hats, built from three.js primitives and canvas
// textures. No downloaded assets. Units: the lander body is about 1.1 high, feet at y = 0, the hat sits on `mount`.
import * as THREE from '../vendor/three.module.js';

export const TYPES = ['lander', 'rover', 'hopper'];
export const HATS = ['kyrgyz', 'kazakh', 'uzbek', 'tajik', 'none'];
export const COLORS = ['#e5484d', '#f59e0b', '#2fbf71', '#3b82f6', '#a855f7', '#e4e7ec'];

// ------------------------------------------------------------------ textures (canvas, drawn once, shared)
const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
const cache = {};
const tex = (name, w, h, draw, wrapX = true) => {
  if (!cache[name]) {
    const t = new THREE.CanvasTexture(mk(w, h, draw));
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (wrapX) t.wrapS = THREE.RepeatWrapping;
    cache[name] = t;
  }
  return cache[name];
};
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const speckle = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { const v = 120 + (rnd() * 90) | 0; g.fillStyle = `rgba(${v},${v},${v - 8},${rnd() * a})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); } };

const T = {
  panel: () => tex('panel', 256, 128, (g, w, h) => {
    g.fillStyle = '#16356f'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(120,170,255,.35)'); gr.addColorStop(1, 'rgba(0,0,30,.2)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9fb8e8'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += w / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += h / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }),
  // Kyrgyz ak kalpak: white felt, four stitched seams
  kyFelt: () => tex('kyFelt', 512, 256, (g, w, h) => {
    g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2400, 0.1);
    g.fillStyle = '#2b2b30'; for (const x of [0, w * 0.25, w * 0.5, w * 0.75]) g.fillRect(x - 3, 0, 6, h);
  }),
  // the black brim: velvet with a white embroidered chain of diamonds
  kyBand: () => tex('kyBand', 512, 128, (g, w, h) => {
    g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 12, w, 5); g.fillRect(0, h - 17, w, 5);
    for (let x = 0; x < w; x += 64) {
      g.beginPath(); g.moveTo(x + 32, 28); g.lineTo(x + 58, 64); g.lineTo(x + 32, 100); g.lineTo(x + 6, 64); g.closePath(); g.fill();
      g.fillStyle = '#0c0c0e'; g.beginPath(); g.moveTo(x + 32, 44); g.lineTo(x + 44, 64); g.lineTo(x + 32, 84); g.lineTo(x + 20, 64); g.closePath(); g.fill();
      g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(x + 32, 64, 4, 0, 7); g.fill();
    }
  }),
  kzFelt: () => tex('kzFelt', 256, 256, (g, w, h) => { g.fillStyle = '#f3efe3'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1800, 0.1); }),
  // Kazakh band: deep blue with a gold ram's horn ornament
  kzBand: () => tex('kzBand', 512, 128, (g, w, h) => {
    g.fillStyle = '#1b4aa0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c14e'; g.fillRect(0, 10, w, 6); g.fillRect(0, h - 16, w, 6);
    g.strokeStyle = '#f2c14e'; g.lineWidth = 6; g.lineCap = 'round';
    for (let x = 0; x < w; x += 64) {
      g.beginPath(); g.arc(x + 20, 64, 15, Math.PI * 0.15, Math.PI * 1.65); g.stroke();
      g.beginPath(); g.arc(x + 44, 64, 15, Math.PI * 1.15, Math.PI * 2.65); g.stroke();
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(x + 32, 64, 3.5, 0, 7); g.fill();
    }
  }),
  // Uzbek doppi: black, one white almond ("pepper") on each of the four faces
  uzSide: () => tex('uzSide', 512, 128, (g, w, h) => {
    g.fillStyle = '#0a0a0d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6f4ee'; g.fillRect(0, 6, w, 5); g.fillRect(0, h - 10, w, 4);
    for (let q = 0; q < 4; q++) {
      const cx = q * 128 + 64;
      g.fillStyle = '#f6f4ee'; g.beginPath(); g.moveTo(cx, 20);
      g.bezierCurveTo(cx + 40, 30, cx + 34, 86, cx - 2, 106); g.bezierCurveTo(cx - 20, 80, cx - 26, 46, cx, 20); g.fill();
      g.fillStyle = '#0a0a0d'; g.beginPath(); g.moveTo(cx + 2, 42); g.bezierCurveTo(cx + 20, 48, cx + 16, 74, cx, 86); g.bezierCurveTo(cx - 8, 72, cx - 10, 56, cx + 2, 42); g.fill();
      g.fillStyle = '#f6f4ee'; for (const [dx, dy] of [[-38, 40], [-42, 62], [42, 36], [40, 90]]) { g.beginPath(); g.arc(cx + dx, dy, 3.5, 0, 7); g.fill(); }
    }
  }),
  uzTop: () => tex('uzTop', 128, 128, (g, w, h) => {
    g.fillStyle = '#0a0a0d'; g.fillRect(0, 0, w, h); g.fillStyle = '#f6f4ee';
    g.translate(w / 2, h / 2);
    for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -8); g.bezierCurveTo(26, -22, 30, -50, 4, -58); g.bezierCurveTo(-4, -40, -12, -22, 0, -8); g.fill(); }
  }, false),
  // Tajik toqi: a rounded cap, green with a red and gold flower ring and a striped border
  tjDome: () => tex('tjDome', 512, 256, (g, w, h) => {
    g.fillStyle = '#0e5a3c'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = '#d9342e'; g.beginPath(); g.arc(x + 32, 150, 22, 0, 7); g.fill();
      g.fillStyle = '#f6f1e0'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(x + 32 + Math.cos(k * 1.047) * 15, 150 + Math.sin(k * 1.047) * 15, 7, 4, k * 1.047, 0, 7); g.fill(); }
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(x + 32, 150, 6, 0, 7); g.fill();
      g.strokeStyle = '#f2c14e'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 54, 150); g.quadraticCurveTo(x + 64, 118, x + 74, 150); g.stroke();
      g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(x + 32, 30); g.lineTo(x + 38, 52); g.lineTo(x + 60, 56); g.lineTo(x + 38, 62); g.lineTo(x + 32, 84); g.lineTo(x + 26, 62); g.lineTo(x + 4, 56); g.lineTo(x + 26, 52); g.closePath(); g.fill();
    }
  }),
  tjBand: () => tex('tjBand', 512, 64, (g, w, h) => {
    g.fillStyle = '#f6f1e0'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#d9342e' : '#0e5a3c'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, h); g.closePath(); g.fill(); }
  }),
  glow: () => tex('glow', 64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, false),
  snow: () => tex('snow', 64, 64, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round'; g.translate(32, 32); for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -27); g.moveTo(0, -16); g.lineTo(-7, -23); g.moveTo(0, -16); g.lineTo(7, -23); g.stroke(); } }, false),
  star: () => tex('star', 64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 2); g.lineTo(37, 27); g.lineTo(62, 32); g.lineTo(37, 37); g.lineTo(32, 62); g.lineTo(27, 37); g.lineTo(2, 32); g.lineTo(27, 27); g.closePath(); g.fill(); }, false),
  dust: () => tex('dust', 64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(0.55, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, false),
};
export const glowTexture = T.glow, dustTexture = T.dust;

// ------------------------------------------------------------------ small helpers
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.12, ...o });
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// ------------------------------------------------------------------ hats (base radius about 0.5, base at y = 0)
function hat(kind) {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  if (kind === 'kyrgyz') {
    const felt = std(0xffffff, { map: T.kyFelt(), roughness: 1, metalness: 0 });
    const crown = add(lathe([[0.47, 0.12], [0.46, 0.3], [0.41, 0.56], [0.36, 0.8], [0.3, 1.0], [0.21, 1.17], [0.09, 1.29], [0.0, 1.34]]), felt);
    crown.scale.z = 0.86;
    const black = std(0xffffff, { map: T.kyBand(), roughness: 1, metalness: 0, side: THREE.DoubleSide });
    const band = add(lathe([[0.5, 0], [0.545, 0.05], [0.545, 0.2], [0.5, 0.3]], 40), black); band.scale.z = 0.86;
    // the brim is split: the front and the back are turned up, the sides stay low
    for (const a of [-0.75, Math.PI - 0.75]) { const f = add(new THREE.CylinderGeometry(0.62, 0.53, 0.46, 20, 1, true, a, 1.5), black, 0, 0.32, 0); f.scale.z = 0.86; }
    add(new THREE.SphereGeometry(0.035, 10, 8), std(0x111114), 0, 1.35, 0);
  } else if (kind === 'kazakh') {
    const felt = std(0xffffff, { map: T.kzFelt(), roughness: 1, metalness: 0 });
    add(lathe([[0.5, 0.1], [0.49, 0.26], [0.44, 0.5], [0.36, 0.72], [0.24, 0.88], [0.1, 0.97], [0, 1.0]]), felt);
    const band = std(0xffffff, { map: T.kzBand(), roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    add(lathe([[0.52, 0], [0.545, 0.04], [0.545, 0.3], [0.5, 0.35]], 40), band);
    add(new THREE.SphereGeometry(0.06, 12, 10), std(0xf2c14e, { metalness: 0.5, roughness: 0.35 }), 0, 1.0, 0);
    // a feather on the top
    const f = new THREE.Group(); f.position.set(0, 1.02, 0); f.rotation.z = -0.28; g.add(f);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.5, 6), std(0x3a3a3a)); stem.position.y = 0.25; f.add(stem);
    const vane = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), std(0xf1ece0, { roughness: 1, metalness: 0 })); vane.scale.set(1, 4.2, 0.22); vane.position.y = 0.3; f.add(vane);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0x2b2b30)); tip.scale.set(1, 2, 0.4); tip.position.y = 0.47; f.add(tip);
  } else if (kind === 'uzbek') {
    const side = std(0xffffff, { map: T.uzSide(), roughness: 1, metalness: 0 }), top = std(0xffffff, { map: T.uzTop(), roughness: 1, metalness: 0 }), bot = std(0x0a0a0d);
    const geo = new THREE.CylinderGeometry(0.46, 0.6, 0.38, 4, 1, false); geo.rotateY(Math.PI / 4);
    add(geo, [side, top, bot], 0, 0.19, 0);
    add(new THREE.CylinderGeometry(0.4, 0.46, 0.05, 4), std(0x0a0a0d), 0, 0.395, 0).rotation.y = Math.PI / 4;
  } else if (kind === 'tajik') {
    const dome = add(new THREE.SphereGeometry(0.52, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), std(0xffffff, { map: T.tjDome(), roughness: 1, metalness: 0 }), 0, 0.1, 0);
    dome.scale.y = 0.82;
    add(new THREE.CylinderGeometry(0.535, 0.535, 0.14, 40, 1, true), std(0xffffff, { map: T.tjBand(), roughness: 1, metalness: 0, side: THREE.DoubleSide }), 0, 0.07, 0);
    add(new THREE.SphereGeometry(0.05, 12, 10), std(0xf2c14e, { metalness: 0.5, roughness: 0.35 }), 0, 0.54, 0);
  }
  return g;
}
export const makeHat = hat;

// ------------------------------------------------------------------ the machines
/** cfg { type, color, hat }. Returns the model object: group, update(time, dt), setState(name), setFlame(k), dispose(). */
export class Craft {
  constructor(cfg) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group(); this.group.add(this.inner);
    this.state = 'idle'; this.ok = 0; this.lost = 0; this.flameK = 0; this.time = 0; this.hatLift = 0;
    this.rebuild(cfg);
  }

  rebuild(cfg) {
    for (const c of [...this.inner.children]) { this.inner.remove(c); c.traverse((o) => { o.geometry?.dispose(); }); }
    this.mats = []; this.lamps = []; this.rotors = []; this.frostBits = []; this.cfg = { ...cfg };
    const track = (m) => { m.userData.base = m.color.clone(); m.userData.rough = m.roughness; this.mats.push(m); return m; };
    const body = track(std(cfg.color, { roughness: 0.45, metalness: 0.2 })), foil = track(std(0xd9a238, { metalness: 0.45, roughness: 0.35 })),
      dark = track(std(0x2a2e37)), white = track(std(0xeceff4, { roughness: 0.6 })), leg = track(std(0x9aa3b2, { metalness: 0.4, roughness: 0.45 })),
      panel = track(std(0xffffff, { map: T.panel(), roughness: 0.4, metalness: 0.3 }));
    const R = this.inner;
    const add = (geo, mat, x = 0, y = 0, z = 0, parent = R) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    const bar = (a, b, r, mat) => { // a thin cylinder between two points
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat); m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); R.add(m); return m;
    };
    const lamp = (x, y, z, r = 0.05) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x555a63, emissive: 0x000000, roughness: 0.3 });
      const m = add(new THREE.SphereGeometry(r, 12, 10), mat, x, y, z);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow(), color: 0x33ff88, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.scale.setScalar(r * 9); s.position.set(x, y, z); R.add(s);
      this.lamps.push({ mat, glow: s, phase: this.lamps.length * 1.3 });
    };
    const frost = (x, y, z, s = 1) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.06 * s, 0), new THREE.MeshStandardMaterial({ color: 0xeaf7ff, emissive: 0x5aa8d6, emissiveIntensity: 0.35, roughness: 0.25, flatShading: true }));
      m.position.set(x, y, z); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); m.visible = false; R.add(m); this.frostBits.push(m); };
    const icicle = (x, y, z, len = 0.2) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.04, len, 5), new THREE.MeshStandardMaterial({ color: 0xdff2ff, emissive: 0x6fb8e0, emissiveIntensity: 0.3, roughness: 0.2, transparent: true, opacity: 0.92 }));
      m.position.set(x, y - len / 2, z); m.rotation.x = Math.PI; m.visible = false; R.add(m); this.frostBits.push(m); };
    let mount, hatScale, flameY;

    if (cfg.type === 'rover') {
      add(new THREE.BoxGeometry(1.0, 0.26, 0.6), body, 0, 0.47, 0);
      add(new THREE.BoxGeometry(0.8, 0.07, 0.5), white, 0, 0.64, 0);
      const pan = add(new THREE.BoxGeometry(0.95, 0.03, 0.56), panel, -0.06, 0.76, 0); pan.rotation.z = -0.12;
      add(new THREE.BoxGeometry(0.04, 0.12, 0.04), dark, -0.06, 0.69, 0.2); add(new THREE.BoxGeometry(0.04, 0.12, 0.04), dark, -0.06, 0.69, -0.2);
      const tire = std(0x25282f), hub = std(0xc7ccd6); this.mats.push(tire, hub); tire.userData.base = tire.color.clone(); hub.userData.base = hub.color.clone(); tire.userData.rough = hub.userData.rough = 0.8;
      for (const x of [-0.42, 0, 0.42]) for (const z of [-0.4, 0.4]) {
        const w = add(new THREE.CylinderGeometry(0.17, 0.17, 0.13, 20), tire, x, 0.17, z); w.rotation.x = Math.PI / 2;
        const h = add(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 12), hub, x, 0.17, z); h.rotation.x = Math.PI / 2;
      }
      for (const z of [-0.33, 0.33]) add(new THREE.BoxGeometry(0.95, 0.05, 0.05), dark, 0, 0.3, z);
      bar([0.38, 0.6, 0], [0.38, 1.2, 0], 0.025, dark);
      add(new THREE.BoxGeometry(0.2, 0.14, 0.26), white, 0.38, 1.27, 0);
      for (const z of [-0.07, 0.07]) add(new THREE.SphereGeometry(0.04, 10, 8), std(0x0a1020, { metalness: 0.6, roughness: 0.15 }), 0.49, 1.27, z);
      add(new THREE.ConeGeometry(0.1, 0.14, 12), dark, 0, 0.27, 0).rotation.x = Math.PI;
      lamp(0.51, 0.5, 0.2); lamp(0.51, 0.5, -0.2); lamp(0, 0.5, 0.31); lamp(0, 0.5, -0.31); lamp(-0.4, 0.74, 0);
      for (const [x, y, z] of [[0.3, 0.6, 0.31], [-0.3, 0.6, -0.31], [0, 0.82, 0.1], [-0.35, 0.78, 0.2], [0.5, 0.45, 0], [0.38, 1.36, 0]]) frost(x, y, z);
      for (const [x, z] of [[-0.45, 0.3], [0.3, 0.3], [0.45, -0.3], [-0.2, -0.3]]) icicle(x, 0.34, z, 0.16);
      mount = [0.38, 1.33, 0]; hatScale = 0.5; flameY = 0.27;
    } else if (cfg.type === 'hopper') {
      add(new THREE.SphereGeometry(0.42, 28, 18), body, 0, 0.74, 0);
      const ring = add(new THREE.TorusGeometry(0.43, 0.05, 10, 32), foil, 0, 0.74, 0); ring.rotation.x = Math.PI / 2;
      add(new THREE.SphereGeometry(0.425, 28, 10, 0, Math.PI * 2, 0, 0.8), white, 0, 0.74, 0);
      add(new THREE.ConeGeometry(0.13, 0.2, 14), dark, 0, 0.3, 0).rotation.x = Math.PI;
      for (let k = 0; k < 3; k++) {
        const a = (k * 120 + 30) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        bar([c * 0.22, 0.5, s * 0.22], [c * 0.66, 0.05, s * 0.66], 0.03, leg);
        add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 14), foil, c * 0.66, 0.02, s * 0.66);
      }
      for (let k = 0; k < 4; k++) {
        const a = (k * 90 + 45) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        bar([c * 0.3, 0.82, s * 0.3], [c * 0.85, 0.9, s * 0.85], 0.025, dark);
        add(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 12), dark, c * 0.85, 0.92, s * 0.85);
        const rot = new THREE.Group(); rot.position.set(c * 0.85, 1.0, s * 0.85); R.add(rot);
        add(new THREE.CylinderGeometry(0.32, 0.32, 0.01, 28), new THREE.MeshStandardMaterial({ color: 0x8a94a6, transparent: true, opacity: 0.22, roughness: 0.4 }), 0, 0, 0, rot);
        add(new THREE.BoxGeometry(0.64, 0.015, 0.05), dark, 0, 0.005, 0, rot);
        this.rotors.push(rot);
        lamp(c * 0.85, 0.86, s * 0.85, 0.045);
        frost(c * 0.85, 0.99, s * 0.85, 0.9);
      }
      lamp(0, 0.45, 0.2, 0.04);
      for (const [x, y, z] of [[0.3, 0.9, 0.2], [-0.3, 0.9, -0.2], [0.38, 0.6, 0], [-0.38, 0.6, 0.1], [0, 1.13, 0.15], [0.2, 0.5, -0.3]]) frost(x, y, z);
      for (const [x, z] of [[0.3, 0.2], [-0.3, 0.1], [0, -0.35], [0.1, 0.3]]) icicle(x, 0.48, z, 0.18);
      mount = [0, 1.15, 0]; hatScale = 0.6; flameY = 0.2;
    } else { // the four legged lander
      add(new THREE.CylinderGeometry(0.4, 0.5, 0.46, 10), body, 0, 0.63, 0);
      add(new THREE.CylinderGeometry(0.5, 0.56, 0.2, 10), foil, 0, 0.3, 0);
      add(new THREE.CylinderGeometry(0.44, 0.41, 0.06, 10), white, 0, 0.88, 0);
      add(new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), white, 0, 0.9, 0);
      add(new THREE.ConeGeometry(0.15, 0.22, 16), dark, 0, 0.1, 0).rotation.x = Math.PI;
      for (let k = 0; k < 4; k++) {
        const a = (k * 90 + 45) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        bar([c * 0.4, 0.55, s * 0.4], [c * 0.98, 0.05, s * 0.98], 0.03, leg);
        bar([c * 0.5, 0.3, s * 0.5], [c * 0.8, 0.2, s * 0.8], 0.02, leg);
        add(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16), foil, c * 0.98, 0.02, s * 0.98);
        lamp(c * 0.46, 0.66, s * 0.46);
        frost(c * 0.98, 0.07, s * 0.98); frost(c * 0.45, 0.84, s * 0.45); frost(c * 0.3, 0.9, s * 0.3);
        icicle(c * 0.5, 0.2, s * 0.5, 0.2);
      }
      for (const sx of [-1, 1]) {
        bar([sx * 0.4, 0.78, 0], [sx * 0.62, 0.84, 0], 0.02, dark);
        const p = add(new THREE.BoxGeometry(0.62, 0.025, 0.36), panel, sx * 0.95, 0.88, 0); p.rotation.z = sx * -0.14;
        frost(sx * 0.9, 0.91, 0.1, 1.2); frost(sx * 1.1, 0.88, -0.1);
      }
      bar([0.2, 1.0, 0.12], [0.2, 1.22, 0.12], 0.012, dark);
      const dish = add(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, 0.2, 1.22, 0.12); dish.rotation.x = -0.6;
      mount = [0, 1.17, 0]; hatScale = 0.7; flameY = 0.0;
    }
    // snow on top (a flat white cap) shows with the frost
    const snow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8), new THREE.MeshStandardMaterial({ color: 0xf2faff, roughness: 0.6, flatShading: true }));
    snow.scale.set(1, 0.28, 1); snow.position.set(mount[0], mount[1] - 0.06, mount[2]); snow.visible = false; R.add(snow); this.snow = snow;
    // the hat, on a pivot at the mount so it can wave
    this.pivot = new THREE.Group(); this.pivot.position.set(...mount); R.add(this.pivot);
    this.hat = hat(cfg.hat); this.hat.scale.setScalar(hatScale); this.pivot.add(this.hat);
    this.hatMats = [];
    this.hat.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { m.userData.base = m.color.clone(); this.hatMats.push(m); } });
    this.mount = new THREE.Vector3(...mount); this.hatScale = hatScale; this.hatHeight = hatScale * (cfg.hat === 'kyrgyz' ? 1.35 : cfg.hat === 'kazakh' ? 1.5 : cfg.hat === 'none' ? 0 : 0.5);
    // the thruster flame under the engine
    if (this.flame) { this.group.remove(this.flame); }
    this.flame = new THREE.Group(); this.flame.position.y = flameY; this.flame.visible = false; this.group.add(this.flame);
    const fo = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.95, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    fo.rotation.x = Math.PI; fo.position.y = -0.47; this.flame.add(fo);
    const fi = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.55, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    fi.rotation.x = Math.PI; fi.position.y = -0.27; this.flame.add(fi);
    this.sparks = [];
    for (const kind of ['snow', 'star']) for (let i = 0; i < 9; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === 'snow' ? T.snow() : T.star(), color: kind === 'snow' ? 0xe6f6ff : i % 2 ? 0x6dffa0 : 0xfff2a0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      sp.userData = { kind, a: (i / 9) * Math.PI * 2 + rnd(), r: 0.85 + rnd() * 0.5, h: 0.25 + rnd() * 1.25, ph: rnd() * 6.28, sz: 0.2 + rnd() * 0.12 }; sp.visible = false; R.add(sp); this.sparks.push(sp);
    }
    this.height = mount[1] + this.hatHeight;
    this.apply();
  }

  setState(s) { this.state = s; }
  setFlame(k) { this.flameK = k; }

  /** Advance the look: blend toward the state, wave the hat, blink the lamps, spin the rotors. */
  update(t, dt) {
    this.time = t;
    const to = { ok: this.state === 'ok' ? 1 : 0, lost: this.state === 'lost' ? 1 : 0 };
    const k = Math.min(1, dt * 4);
    this.ok += (to.ok - this.ok) * k; this.lost += (to.lost - this.lost) * k;
    this.apply();
  }

  apply() {
    const t = this.time, ok = this.ok, lost = this.lost, idle = Math.max(0, 1 - ok - lost);
    const frostC = new THREE.Color(0x9ccbe6);
    for (const m of this.mats) { m.color.copy(m.userData.base).lerp(frostC, 0.74 * lost); m.roughness = m.userData.rough + 0.3 * lost; }
    for (const m of this.hatMats) m.color.copy(m.userData.base).lerp(frostC, 0.45 * lost);
    for (const sp of this.sparks) { // snowflakes when it is frozen, green stars when it made it
      const u = sp.userData, f = u.kind === 'snow' ? lost : ok;
      sp.visible = f > 0.03; if (!sp.visible) continue;
      const a = u.a + t * (u.kind === 'snow' ? 0.35 : 1.1), y = u.kind === 'snow' ? u.h + Math.sin(t * 1.3 + u.ph) * 0.1 : this.mount.y - 0.2 + ((t * 0.5 + u.ph) % 1) * 1.1;
      sp.position.set(Math.cos(a) * u.r, y, Math.sin(a) * u.r);
      sp.scale.setScalar(u.sz * (u.kind === 'snow' ? 1.25 : 1) * (0.7 + 0.3 * Math.sin(t * 5 + u.ph)));
      sp.material.opacity = f * (u.kind === 'snow' ? 0.5 + 0.5 * Math.sin(t * 2.4 + u.ph) ** 2 : 0.35 + 0.65 * Math.max(0, Math.sin(t * 4 + u.ph)) ** 2);
    }
    for (const l of this.lamps) {
      const pulse = 0.65 + 0.35 * Math.sin(t * 6 + l.phase), blink = (Math.sin(t * 3 + l.phase) > 0.2 ? 1 : 0.15);
      l.mat.emissive.setRGB(0.1 * idle * blink + 0.1 * ok, 0.55 * idle * blink + 2.2 * ok * pulse, 0.12 * ok * pulse).multiplyScalar(1 - lost);
      l.mat.color.setRGB(0.33 - 0.25 * lost, 0.35 - 0.26 * lost, 0.39 - 0.28 * lost);
      l.glow.material.color.setRGB(idle > ok ? 1 : 0.2, idle > ok ? 0.75 : 1, idle > ok ? 0.25 : 0.55);
      l.glow.material.opacity = (0.5 * idle * blink + 0.95 * ok * pulse) * (1 - lost);
    }
    for (const r of this.rotors) r.rotation.y = t * (this.state === 'lost' ? 0 : 38 - 24 * idle);
    // the hat: waves when it survives, droops when it is lost
    const wave = Math.sin(t * 9);
    this.pivot.position.set(this.mount.x + 0.1 * ok * wave * 0.5, this.mount.y + (0.3 * ok * (0.65 + 0.35 * Math.abs(wave))) - 0.08 * lost, this.mount.z);
    this.pivot.rotation.set(0, 0, ok * wave * 0.55 + lost * 0.42 + idle * Math.sin(t * 1.7) * 0.03);
    for (const b of this.frostBits) { b.visible = lost > 0.05; b.scale.setScalar(Math.max(lost, 0.001)); }
    this.snow.visible = lost > 0.05; this.snow.scale.set(Math.max(lost, 0.001), 0.28 * Math.max(lost, 0.001), Math.max(lost, 0.001));
    // flame
    this.flame.visible = this.flameK > 0.02;
    if (this.flame.visible) { const f = 0.85 + 0.3 * Math.sin(t * 61) * Math.cos(t * 37); this.flame.scale.set(0.8 + 0.4 * this.flameK, this.flameK * f, 0.8 + 0.4 * this.flameK); }
  }

  dispose() { this.group.traverse((o) => { o.geometry?.dispose(); }); }
}
