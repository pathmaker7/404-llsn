// Draws the Moon and the Earth of slide 1 as real globes: NASA's own maps (the two pictures the app already uses,
// app/data/moon.jpg and app/data/earth.jpg, credited in app/ATTRIBUTION.md) wrapped on a sphere with the app's 3D library.
//   node tools/deck-globes.cjs      writes explainer/shots/moon-disc.png and explainer/shots/earth-disc.png
// The Moon is drawn evenly lit (its shading is laid over it on the slide, so the light stays put while the Moon rolls);
// the Earth is lit from the upper left, where the slide's Sun is.
const fs = require('fs'), path = require('path');
const { serve, launch } = require('./smoke.cjs');
const ROOT = path.join(__dirname, '..');

(async () => {
  const srv = await serve(path.join(ROOT, 'app')), browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
  // an empty page on the app's own address, so the app's library and maps can be loaded from it
  await page.route('**/__globes.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>globes</title>' }));
  await page.goto(`http://127.0.0.1:${srv.address().port}/__globes.html`);
  const shot = (o) => page.evaluate(async (o) => {
    const THREE = await import('/vendor/three.module.js');
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(o.size, o.size, false); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1.004, 1.004, 1.004, -1.004, 0.1, 10); cam.position.z = 3;
    const tex = await new THREE.TextureLoader().loadAsync(o.map); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), new THREE.MeshLambertMaterial({ map: tex }));
    ball.rotation.y = o.turn; ball.rotation.x = o.tilt; scene.add(ball);
    scene.add(new THREE.AmbientLight(0xffffff, o.ambient));
    const sun = new THREE.DirectionalLight(0xffffff, o.sun); sun.position.set(...o.from); scene.add(sun);
    r.render(scene, cam);
    return r.domElement.toDataURL('image/png').split(',')[1];
  }, o);
  const out = path.join(ROOT, 'explainer', 'shots');
  // the Moon: its Earth-facing side, lit from the front with a little falloff to the edge
  fs.writeFileSync(path.join(out, 'moon-disc.png'), Buffer.from(await shot({ map: '/data/moon.jpg', size: 1100, turn: -Math.PI / 2, tilt: 0, ambient: 1.5, sun: 1.9, from: [0, 0, 1] }), 'base64'));
  // the Earth: Central Asia near the middle, lit from the upper left
  fs.writeFileSync(path.join(out, 'earth-disc.png'), Buffer.from(await shot({ map: '/data/earth.jpg', size: 520, turn: -Math.PI / 2 - 1.25, tilt: 0.55, ambient: 0.5, sun: 3.2, from: [-1.2, 0.9, 1] }), 'base64'));
  await browser.close(); srv.close();
  console.log('wrote moon-disc.png and earth-disc.png in', out);
})();
