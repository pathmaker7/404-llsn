// Makes explainer/deck.pdf play: the scenes of slides 2 to 7 move inside the PDF itself, in a PDF viewer that runs
// PDF scripts (Chrome's does; Safari, Preview and phones do not, they show the still last frame).
// Run after tools/deck-pdf.cjs (npm run deck does both).
//
// How: a PDF cannot hold an SVG animation, but it can hold buttons with a picture each and a script that shows them
// on a timer. So each scene is filmed step by step from deck.html. The first step is a picture of the whole scene;
// every later step is a picture of only the rectangle that changed since the step before. Each picture is a hidden
// button lying exactly over its place on the page, and a small script shows them one after another, each on top of
// the ones before: a flipbook made of patches. Under the buttons the page is untouched: the drawn last frame, sharp
// at any zoom, which is what shows while the film holds (all buttons hidden again), in a viewer without scripts,
// and on paper. A scene restarts when its page is opened, and repeats.
//
//   node tools/deck-animate.cjs [pdf to change, default explainer/deck.pdf]
//   STEP=0.0667 seconds between steps (15 a second), Q=0.86 JPEG quality of photo-like patches, SCALE=2 pixels per CSS pixel
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { serve, launch } = require('./smoke.cjs');
const ROOT = path.join(__dirname, '..');
const PDF = process.argv[2] || path.join(ROOT, 'explainer', 'deck.pdf');
const STEP = +(process.env.STEP || 1 / 15), Q = +(process.env.Q || 0.86), SCALE = +(process.env.SCALE || 2);

// Runs in a blank helper page: decodes a screenshot, finds the rectangle that differs from the screenshot before,
// and hands back that rectangle's pixels twice: exact (RGB bytes) and as a JPEG. Node keeps whichever is smaller enough.
const DIFF = async ([b64, q]) => {
  const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const w = bmp.width, h = bmp.height, cv = new OffscreenCanvas(w, h), cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0); const now = cx.getImageData(0, 0, w, h).data, was = window.was; window.was = now;
  // tiles of 32 pixels that hold a changed pixel, each with the box of its changed pixels
  const T = 32, gw = Math.ceil(w / T), gh = Math.ceil(h / T), box = new Array(gw * gh).fill(null);
  if (!was) box[0] = 'all';
  else for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4)
    if (now[i] !== was[i] || now[i + 1] !== was[i + 1] || now[i + 2] !== was[i + 2]) { const g = (y >> 5) * gw + (x >> 5), b = box[g];
      if (!b) box[g] = [x, y, x, y]; else { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; } }
  // neighbouring tiles form one patch: two things that moved far apart become two small pictures, not one big one
  const rects = [];
  if (!was) rects.push([0, 0, w - 1, h - 1]);
  else for (let g = 0; g < box.length; g++) { if (!box[g]) continue; const r = box[g].slice(), todo = [g]; box[g] = null;
    while (todo.length) { const c = todo.pop(), cx0 = c % gw, cy0 = (c - cx0) / gw;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx0 + dx, ny = cy0 + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const m = ny * gw + nx, b = box[m]; if (!b) continue; box[m] = null; todo.push(m);
        if (b[0] < r[0]) r[0] = b[0]; if (b[1] < r[1]) r[1] = b[1]; if (b[2] > r[2]) r[2] = b[2]; if (b[3] > r[3]) r[3] = b[3]; } }
    // 8 pixels of unchanged picture all round: a viewer smooths a picture's edge into what lies under it, and on a bare
    // edge that left a ghost line of the old picture; with a margin the edge blends into the same pixels
    rects.push([Math.max(0, r[0] - 8), Math.max(0, r[1] - 8), Math.min(w - 1, r[2] + 8), Math.min(h - 1, r[3] + 8)]); }
  const b64of = async (blob) => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  const out = [];
  for (const [x0, y0, x1, y1] of rects) { const pw = x1 - x0 + 1, ph = y1 - y0 + 1, rgb = new Uint8Array(pw * ph * 3);
    for (let y = 0, o = 0; y < ph; y++) for (let x = 0, i = ((y0 + y) * w + x0) * 4; x < pw; x++, i += 4) { rgb[o++] = now[i]; rgb[o++] = now[i + 1]; rgb[o++] = now[i + 2]; }
    const pc = new OffscreenCanvas(pw, ph); pc.getContext('2d').drawImage(cv, x0, y0, pw, ph, 0, 0, pw, ph);
    out.push({ x: x0, y: y0, w: pw, h: ph, rgb: await b64of(new Blob([rgb])), jpg: await b64of(await pc.convertToBlob({ type: 'image/jpeg', quality: q })) }); }
  return out;
};

// 1. Film every scene.
async function film() {
  const srv = await serve(path.join(ROOT, 'explainer')), browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCALE });
  const helper = await browser.newPage(); await helper.goto(`http://127.0.0.1:${srv.address().port}/texts.html`); // any same-origin page: it only lends its canvas
  await page.goto(`http://127.0.0.1:${srv.address().port}/deck.html`); await page.waitForLoadState('networkidle');
  const ids = await page.evaluate(() => [...document.querySelectorAll('section')].map((s) => ({ id: s.id, dur: +s.dataset.dur || 0 })));
  // Where each scene sits on its printed page (the PDF was printed from this layout).
  await page.emulateMedia({ media: 'print' });
  const printed = {};
  for (const s of ids) if (s.dur) printed[s.id] = await page.evaluate((id) => { const el = document.getElementById(id), a = el.getBoundingClientRect(), b = el.querySelector('.scene').getBoundingClientRect();
    return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height }; }, s.id);
  await page.emulateMedia({ media: 'screen' });
  // The film has no Replay button and no endless motion (bobbing, radio waves, the progress line): the printed page has none either.
  await page.addStyleTag({ content: '.replay, .nav { display: none !important; } html { scroll-snap-type: none !important; } .play .bob, .play .wave { animation: none !important; } .bar { display: none !important; }' });
  const slides = [];
  for (let n = 0; n < ids.length; n++) {
    const { id, dur } = ids[n]; if (!dur || (process.env.ONLY && process.env.ONLY !== id)) continue; // ONLY=s3: film one slide, to try settings
    await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
    const seek = (t) => page.evaluate(([id, t]) => { const s = document.getElementById(id); s.classList.remove('play'); void s.getBoundingClientRect(); s.classList.add('play');
      let end = 0; for (const a of s.getAnimations({ subtree: true })) { const e = a.effect.getComputedTiming().endTime; if (isFinite(e)) end = Math.max(end, e); a.pause(); a.currentTime = t * 1000; }
      const sr = s.getBoundingClientRect(), b = s.querySelector('.scene').getBoundingClientRect();
      return { end: end / 1000, top: sr.top + scrollY, x: b.left - sr.left, y: b.top - sr.top, w: b.width, h: b.height }; }, [id, t]);
    const at = await seek(0), p = printed[id];
    if (Math.abs(at.x - p.x) > 0.5 || Math.abs(at.y - p.y) > 0.5 || Math.abs(at.w - p.w) > 0.5 || Math.abs(at.h - p.h) > 0.5)
      throw new Error(`${id}: the scene sits elsewhere on screen (${JSON.stringify(at)}) than in print (${JSON.stringify(p)}), the pictures would not lie over it`);
    if (at.end > dur) throw new Error(`${id}: the film (${at.end} s) is longer than its loop (${dur} s)`);
    // whole pixels, so a picture and its place on the page agree exactly
    const clip = { x: Math.floor(p.x), y: Math.floor(p.y), w: Math.ceil(p.x + p.w) - Math.floor(p.x), h: Math.ceil(p.y + p.h) - Math.floor(p.y) };
    await helper.evaluate(() => { window.was = null; });
    const patches = []; let exact = 0;
    for (let t = 0; t < at.end + STEP; t += STEP) {
      const tt = Math.min(t, at.end); await seek(tt);
      const png = await page.screenshot({ type: 'png', fullPage: true, clip: { x: clip.x, y: at.top + clip.y, width: clip.w, height: clip.h } });
      for (const d of await helper.evaluate(DIFF, [png.toString('base64'), Q])) {
        const flate = zlib.deflateSync(Buffer.from(d.rgb, 'base64'), { level: 9 }), jpg = Buffer.from(d.jpg, 'base64');
        // exact pixels unless the JPEG is far smaller (a patch of photo: part of a screenshot)
        const keepExact = flate.length <= jpg.length * 2.5; if (keepExact) exact++;
        patches.push({ t: Math.round(tt * 1000), x: d.x, y: d.y, w: d.w, h: d.h, data: keepExact ? flate : jpg, filter: keepExact ? '/FlateDecode' : '/DCTDecode' });
      }
    }
    // The last step ends on the printed page itself: from the film's end on, no button shows.
    const end = Math.round(at.end * 1000);
    slides.push({ id, pageIndex: n, dur: Math.round(dur * 1000), end, patches, clip });
    console.log(`${id}: film ${at.end.toFixed(1)} s of a ${dur} s loop, ${patches.length} patches (${exact} exact, ${patches.length - exact} JPEG), ${(patches.reduce((a, f) => a + f.data.length, 0) / 1e6).toFixed(2)} MB`);
  }
  await browser.close(); srv.close();
  return slides;
}

// 2. The script inside the PDF. P: one entry per moving page; t: the moment (ms) each patch appears; c: how many show now.
// Each page calls deckOpen when it is opened (its /AA /O action), so its film starts from the beginning; in a viewer
// that does not tell, every film just keeps looping.
const script = (slides) => `var P=${JSON.stringify(slides.map((s) => ({ p: s.pageIndex, n: s.id, d: s.dur, e: s.end, t: s.patches.map((f) => f.t) })))};
var i,j;
for(i=0;i<P.length;i++){P[i].f=[];P[i].c=0;P[i].s=Date.now();for(j=0;j<P[i].t.length;j++)P[i].f.push(this.getField(P[i].n+"_"+j));}
function deckOpen(p){for(var a=0;a<P.length;a++)if(P[a].p===p)P[a].s=Date.now();deckTick();}
function deckTick(){var now=Date.now(),a,x,k,m;
for(a=0;a<P.length;a++){m=P[a];x=(now-m.s)%m.d;k=0;if(x<m.e)while(k<m.t.length&&m.t[k]<=x)k++;
while(m.c<k){if(m.f[m.c])m.f[m.c].display=display.visible;m.c++;}
while(m.c>k){m.c--;if(m.f[m.c])m.f[m.c].display=display.hidden;}}}
app.setInterval("deckTick()",${Math.round(STEP * 500)});`;

// 3. Add the buttons and the script to the PDF as an appended update: nothing Chrome wrote is rewritten.
function append(slides) {
  const pdf = fs.readFileSync(PDF), text = pdf.toString('latin1');
  if (text.includes('/AcroForm')) throw new Error('this PDF already has the buttons: print it again first (npm run deck)');
  const tr = text.slice(text.lastIndexOf('trailer'));
  const size = +tr.match(/\/Size (\d+)/)[1], root = +tr.match(/\/Root (\d+) 0 R/)[1], info = (tr.match(/\/Info (\d+) 0 R/) || [])[1], prev = +tr.match(/startxref\s+(\d+)/)[1];
  const body = (n) => { const m = text.match(new RegExp(`\\n${n} 0 obj\\s*([\\s\\S]*?)\\s*endobj`)); if (!m) throw new Error('object ' + n + ' not found'); return m[1]; };
  const kids = body(+body(root).match(/\/Pages (\d+) 0 R/)[1]).match(/\/Kids \[([^\]]*)\]/)[1].match(/\d+(?= 0 R)/g).map(Number);
  const out = [], changed = new Map(); let next = size; // changed: object number -> bytes
  const add = (bytes) => { changed.set(next, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'latin1')); return next++; };
  const stream = (dict, data) => Buffer.concat([Buffer.from(`<<${dict} /Length ${data.length}>>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]);
  const num = (v) => +v.toFixed(3), fields = [];
  for (const s of slides) {
    const pageObj = kids[s.pageIndex], dict = body(pageObj), box = dict.match(/\/MediaBox \[([^\]]*)\]/)[1].trim().split(/\s+/).map(Number);
    const k = box[2] / 1440, mine = []; // CSS pixels to points
    s.patches.forEach((f, i) => {
      const W = f.w / SCALE * k, H = f.h / SCALE * k, x = (s.clip.x + f.x / SCALE) * k, y = box[3] - (s.clip.y + (f.y + f.h) / SCALE) * k; // y from the bottom
      const img = add(stream(`/Type /XObject /Subtype /Image /Width ${f.w} /Height ${f.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${f.filter}`, f.data));
      const ap = add(stream(`/Type /XObject /Subtype /Form /BBox [0 0 ${num(W)} ${num(H)}] /Resources <</XObject <</I ${img} 0 R>>>>`, Buffer.from(`q ${num(W)} 0 0 ${num(H)} 0 0 cm /I Do Q`, 'latin1')));
      // a read only push button, hidden (F 2) until the script shows it; a viewer without scripts never shows it
      mine.push(add(`<</Type /Annot /Subtype /Widget /FT /Btn /Ff 65537 /T (${s.id}_${i}) /Rect [${num(x)} ${num(y)} ${num(x + W)} ${num(y + H)}] /F 2 /P ${pageObj} 0 R /AP <</N ${ap} 0 R>>>>`));
    });
    fields.push(...mine);
    const refs = mine.map((n) => `${n} 0 R`).join(' '); // in order: a later patch is drawn over the earlier ones
    const withAnnots = /\/Annots \[/.test(dict) ? dict.replace(/\/Annots \[([^\]]*)\]/, (m, a) => `/Annots [${a} ${refs}]`) : dict.replace(/>>\s*$/, `/Annots [${refs}]>>`);
    if (withAnnots === dict || /\/AA\b/.test(dict)) throw new Error('could not add the buttons to page ' + (s.pageIndex + 1));
    const open = add(`<</S /JavaScript /JS (deckOpen\\(${s.pageIndex}\\);)>>`); // runs when a viewer opens this page
    changed.set(pageObj, Buffer.from(withAnnots.replace(/>>\s*$/, `/AA <</O ${open} 0 R>>>>`), 'latin1'));
  }
  const js = add(stream('', Buffer.from(script(slides), 'latin1')));
  const act = add(`<</S /JavaScript /JS ${js} 0 R>>`);
  const cat = body(root); if (/\/Names|\/OpenAction/.test(cat)) throw new Error('the catalog already has /Names or /OpenAction');
  changed.set(root, Buffer.from(cat.replace(/>>\s*$/, `\n/AcroForm <</Fields [${fields.map((n) => `${n} 0 R`).join(' ')}]>>\n/Names <</JavaScript <</Names [(deck) ${act} 0 R]>>>>>>`), 'latin1'));
  // objects, then a cross reference section for exactly the changed and new ones, then a trailer that points back
  let pos = pdf.length; const off = new Map();
  if (pdf[pdf.length - 1] !== 10) { out.push(Buffer.from('\n', 'latin1')); pos += 1; }
  for (const [n, bytes] of [...changed].sort((a, b) => a[0] - b[0])) { const b = Buffer.concat([Buffer.from(`${n} 0 obj\n`, 'latin1'), bytes, Buffer.from('\nendobj\n', 'latin1')]); off.set(n, pos); out.push(b); pos += b.length; }
  const nums = [...off.keys()].sort((a, b) => a - b); let xref = 'xref\n';
  for (let i = 0; i < nums.length;) { let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    xref += `${nums[i]} ${j - i + 1}\n`; for (let q = i; q <= j; q++) xref += `${String(off.get(nums[q])).padStart(10, '0')} 00000 n \n`; i = j + 1; }
  out.push(Buffer.from(`${xref}trailer\n<</Size ${next} /Root ${root} 0 R${info ? ` /Info ${info} 0 R` : ''} /Prev ${prev}>>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  fs.writeFileSync(PDF, Buffer.concat([pdf, ...out]));
  return fields.length;
}

(async () => {
  const slides = await film();
  const n = append(slides);
  console.log(`wrote ${PDF}: ${n} patches on ${slides.length} pages, ${(fs.statSync(PDF).size / 1e6).toFixed(1)} MB`);
})().catch((e) => { console.error(e.message); process.exit(1); });
