// Makes explainer/deck.pdf play: the scenes of slides 2 to 7 move inside the PDF itself, in a PDF viewer that runs
// PDF scripts (Chrome and Edge do; Safari, Preview and phones do not, they show the still last frame).
// Run after tools/deck-pdf.cjs (npm run deck does both).
//
// How: a PDF cannot hold an SVG animation, but it can hold buttons with a picture each and a script that shows and
// hides them on a timer. So each scene is filmed frame by frame from deck.html, every frame becomes a hidden button
// lying exactly over the scene on its page, and a small script flips them: a flipbook. Under the buttons the page is
// untouched: the drawn last frame, sharp at any zoom, which is what shows while the film holds, in a viewer without
// scripts, and on paper. A scene restarts when its page is opened, and repeats.
//
//   node tools/deck-animate.cjs [pdf to change, default explainer/deck.pdf]
//   STEP=0.25 seconds between frames, Q=68 JPEG quality, SCALE=0.9 pixels per CSS pixel (smaller numbers, smaller file)
const fs = require('fs'), path = require('path');
const { serve, launch } = require('./smoke.cjs');
const ROOT = path.join(__dirname, '..');
const PDF = process.argv[2] || path.join(ROOT, 'explainer', 'deck.pdf');
const STEP = +(process.env.STEP || 0.25), Q = +(process.env.Q || 68), SCALE = +(process.env.SCALE || 0.9);

// 1. Film every scene: one JPEG per moment at which the picture differs from the moment before.
async function film() {
  const srv = await serve(path.join(ROOT, 'explainer')), browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCALE });
  await page.goto(`http://127.0.0.1:${srv.address().port}/deck.html`); await page.waitForLoadState('networkidle');
  const ids = await page.evaluate(() => [...document.querySelectorAll('section')].map((s) => ({ id: s.id, dur: +s.dataset.dur || 0 })));
  // Where each scene sits on its printed page (the PDF was printed from this layout).
  await page.emulateMedia({ media: 'print' });
  const box = (id) => page.evaluate((id) => { const s = document.getElementById(id), a = s.getBoundingClientRect(), b = s.querySelector('.scene').getBoundingClientRect();
    return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height }; }, id);
  const printed = {}; for (const s of ids) if (s.dur) printed[s.id] = await box(s.id);
  await page.emulateMedia({ media: 'screen' });
  // The film has no Replay button and no endless motion (bobbing, radio waves, the progress line): the printed page has none either.
  await page.addStyleTag({ content: '.replay, .nav { display: none !important; } html { scroll-snap-type: none !important; } .play .bob, .play .wave { animation: none !important; } .bar { display: none !important; }' });
  const slides = [];
  for (let n = 0; n < ids.length; n++) {
    const { id, dur } = ids[n]; if (!dur) continue;
    await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
    const seek = (t) => page.evaluate(([id, t]) => { const s = document.getElementById(id); s.classList.remove('play'); void s.getBoundingClientRect(); s.classList.add('play');
      let end = 0; for (const a of s.getAnimations({ subtree: true })) { const e = a.effect.getComputedTiming().endTime; if (isFinite(e)) end = Math.max(end, e); a.pause(); a.currentTime = t * 1000; }
      const sr = s.getBoundingClientRect(), b = s.querySelector('.scene').getBoundingClientRect();
      return { end: end / 1000, top: sr.top + scrollY, x: b.left - sr.left, y: b.top - sr.top, w: b.width, h: b.height }; }, [id, t]);
    const at = await seek(0), p = printed[id];
    if (Math.abs(at.x - p.x) > 0.5 || Math.abs(at.y - p.y) > 0.5 || Math.abs(at.w - p.w) > 0.5 || Math.abs(at.h - p.h) > 0.5)
      throw new Error(`${id}: the scene sits elsewhere on screen (${JSON.stringify(at)}) than in print (${JSON.stringify(p)}), the frames would not lie over it`);
    if (at.end > dur) throw new Error(`${id}: the film (${at.end} s) is longer than its loop (${dur} s)`);
    // whole pixels, so the picture and its place on the page agree exactly
    const clip = { x: Math.floor(p.x), y: Math.floor(p.y), w: Math.ceil(p.x + p.w) - Math.floor(p.x), h: Math.ceil(p.y + p.h) - Math.floor(p.y) };
    const frames = [], times = []; let last = null;
    for (let t = 0; t < at.end + STEP; t += STEP) {
      const tt = Math.min(t, at.end); await seek(tt);
      const jpg = await page.screenshot({ type: 'jpeg', quality: Q, fullPage: true, clip: { x: clip.x, y: at.top + clip.y, width: clip.w, height: clip.h } });
      if (!last || !jpg.equals(last)) { frames.push(jpg); times.push(Math.round(tt * 1000)); last = jpg; }
    }
    // The last picture of the film is the printed page itself, so it is not kept: from its moment on, no button shows.
    const end = times.pop(); frames.pop();
    slides.push({ id, pageIndex: n, dur: Math.round(dur * 1000), end, times, frames, clip });
    console.log(`${id}: film ${at.end.toFixed(1)} s of a ${dur} s loop, ${frames.length} different frames, ${(frames.reduce((a, f) => a + f.length, 0) / 1e6).toFixed(1)} MB`);
  }
  await browser.close(); srv.close();
  return slides;
}

// 2. The script inside the PDF. P: one entry per moving page. Each page calls deckOpen when it is opened (its /AA /O action),
// so its film starts from the beginning; a viewer that does not tell, just keeps every film looping.
const script = (slides) => `var P=${JSON.stringify(slides.map((s) => ({ p: s.pageIndex, n: s.id, d: s.dur, e: s.end, t: s.times })))};
var i,j;
for(i=0;i<P.length;i++){P[i].f=[];P[i].c=-1;P[i].s=Date.now();for(j=0;j<P[i].t.length;j++)P[i].f.push(this.getField(P[i].n+"_"+j));}
function deckOpen(p){for(var a=0;a<P.length;a++)if(P[a].p===p)P[a].s=Date.now();deckTick();}
function deckTick(){var now=Date.now(),a,x,k,m;
for(a=0;a<P.length;a++){m=P[a];x=(now-m.s)%m.d;k=-1;if(x<m.e){k=0;while(k+1<m.t.length&&m.t[k+1]<=x)k++;}
if(k!==m.c){if(k>=0&&m.f[k])m.f[k].display=display.visible;if(m.c>=0&&m.f[m.c])m.f[m.c].display=display.hidden;m.c=k;}}}
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
  const fields = [];
  for (const s of slides) {
    const pageObj = kids[s.pageIndex], dict = body(pageObj), box = dict.match(/\/MediaBox \[([^\]]*)\]/)[1].trim().split(/\s+/).map(Number);
    const k = box[2] / 1440, W = s.clip.w * k, H = s.clip.h * k, x = s.clip.x * k, y = box[3] - (s.clip.y + s.clip.h) * k; // CSS pixels to points, y from the bottom
    const rect = [x, y, x + W, y + H].map((v) => +v.toFixed(3)).join(' '), mine = [];
    s.frames.forEach((jpg, i) => {
      const img = add(stream(`/Type /XObject /Subtype /Image /Width ${Math.round(s.clip.w * SCALE)} /Height ${Math.round(s.clip.h * SCALE)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, jpg));
      const ap = add(stream(`/Type /XObject /Subtype /Form /BBox [0 0 ${+W.toFixed(3)} ${+H.toFixed(3)}] /Resources <</XObject <</I ${img} 0 R>>>>`, Buffer.from(`q ${+W.toFixed(3)} 0 0 ${+H.toFixed(3)} 0 0 cm /I Do Q`, 'latin1')));
      // a read only push button, hidden (F 2) until the script shows it; a viewer without scripts never shows it
      mine.push(add(`<</Type /Annot /Subtype /Widget /FT /Btn /Ff 65537 /T (${s.id}_${i}) /Rect [${rect}] /F 2 /P ${pageObj} 0 R /AP <</N ${ap} 0 R>>>>`));
    });
    fields.push(...mine);
    const refs = mine.map((n) => `${n} 0 R`).join(' ');
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
  let pos = pdf.length; const off = new Map(); const nl = Buffer.from('\n', 'latin1');
  if (pdf[pdf.length - 1] !== 10) { out.push(nl); pos += 1; }
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
  console.log(`wrote ${PDF}: ${n} frames on ${slides.length} pages, ${(fs.statSync(PDF).size / 1e6).toFixed(1)} MB`);
})().catch((e) => { console.error(e.message); process.exit(1); });
