// Shows one slide of the deck at exact seconds of its animation, and its last frame as the PDF prints it.
//   node tools/deck-preview.cjs <slide id, e.g. s3> <out dir> [--frag <fragment file>] [seconds ...]
// Without --frag it reads the slide from explainer/deck.html. With --frag it puts the fragment (an optional <style> block and one
// <section>) into a copy of the deck in place of the slides between <!--SLIDES--> and <!--/SLIDES-->.
// Run from the repo root. Prints one line per frame and FAILS (exit 1) when the last frame does not fit the 1440x900 page,
// when a picture is missing, on any page error, or when text boxes inside the scene overlap each other in the last frame.
const fs = require('fs'), path = require('path');
const ROOT = process.cwd();
const { serve, launch } = require(path.join(ROOT, 'tools', 'smoke.cjs'));
const args = process.argv.slice(2), id = args[0], OUT = args[1];
const fi = args.indexOf('--frag'), frag = fi > 0 ? args[fi + 1] : null;
const times = args.slice(2).filter((a, i, all) => a !== '--frag' && all[i - 1] !== '--frag').map(Number).filter((n) => n >= 0);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let page_ = 'deck.html';
  if (frag) {
    const deck = fs.readFileSync(path.join(ROOT, 'explainer', 'deck.html'), 'utf8'), f = fs.readFileSync(frag, 'utf8');
    const css = (f.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1], sec = (f.match(/<section[\s\S]*<\/section>/) || [''])[0];
    if (!sec) { console.error('the fragment has no <section>'); process.exit(1); }
    page_ = `_p-${id}.html`;
    fs.writeFileSync(path.join(ROOT, 'explainer', page_), deck.replace(/<!--SLIDES-->[\s\S]*<!--\/SLIDES-->/, () => sec).replace('/*STYLES*/', () => css));
  }
  const srv = await serve(path.join(ROOT, 'explainer')), browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push('page error: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/${page_}`); await page.waitForLoadState('networkidle');
  const has = await page.evaluate((id) => { const s = document.getElementById(id); if (!s) return null; s.scrollIntoView(); return { dur: +s.dataset.dur || 0 }; }, id);
  if (!has) { console.error('no slide with id ' + id); process.exit(1); }
  await page.waitForTimeout(400);
  const list = times.length ? times : Array.from({ length: Math.ceil(has.dur / 2.5) + 1 }, (_, i) => Math.min(has.dur - 0.1, i * 2.5));
  for (const t of list) {
    // Start the slide, then set every animation to second t: exact, and no waiting.
    await page.evaluate(([id, t]) => { const s = document.getElementById(id); s.classList.remove('play'); void s.getBoundingClientRect(); s.classList.add('play');
      for (const a of s.getAnimations({ subtree: true })) { a.pause(); a.currentTime = t * 1000; } }, [id, t]);
    const f = path.join(OUT, `${id}-t${String(t.toFixed(1)).padStart(4, '0')}.png`);
    await (await page.$('#' + id)).screenshot({ path: f });
    console.log(`second ${t}: ${f}`);
  }
  // The last frame as the PDF has it.
  await page.emulateMedia({ media: 'print' });
  const fit = await page.evaluate((id) => { const s = document.getElementById(id), foot = s.querySelector('.foot');
    const low = Math.max(...[...s.querySelectorAll(':scope > :not(.foot):not(.notes)')].map((e) => e.getBoundingClientRect().bottom));
    const box = (e) => e.getBoundingClientRect(), hit = (a, b) => a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
    // text that is shown in the last frame (an ancestor with class z is gone by then)
    const shown = [...s.querySelectorAll('.scene text')].filter((t) => !t.closest('.z') && t.textContent.trim()), clash = [];
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) if (hit(box(shown[i]), box(shown[j]))) clash.push(`"${shown[i].textContent.slice(0, 30)}" over "${shown[j].textContent.slice(0, 30)}"`);
    const sv = s.querySelector('.scene'), sb = sv ? box(sv) : null, out = sv ? shown.filter((t) => { const b = box(t); return b.left < sb.left || b.right > sb.right || b.top < sb.top || b.bottom > sb.bottom; }).map((t) => t.textContent.slice(0, 30)) : [];
    return { h: s.clientHeight, scroll: s.scrollHeight, low: Math.round(low - box(s).top), foot: Math.round(box(foot).top - box(s).top), clash, out,
      broken: [...s.querySelectorAll('img')].filter((i) => !i.naturalWidth).length, top: box(s).top + scrollY }; }, id);
  const f = path.join(OUT, `${id}-pdf-last-frame.png`);
  await page.screenshot({ path: f, clip: { x: 0, y: fit.top, width: 1440, height: 900 }, fullPage: true });
  console.log(`last frame as printed: ${f}`);
  await browser.close(); srv.close();
  if (frag) fs.unlinkSync(path.join(ROOT, 'explainer', page_));
  const bad = [...errors];
  if (fit.scroll > fit.h + 1 || fit.low > fit.foot - 4) bad.push(`the slide does not fit its page: content ends at ${fit.low}, the footer starts at ${fit.foot}`);
  if (fit.broken) bad.push(`${fit.broken} pictures did not load`);
  for (const c of fit.clash) bad.push('texts overlap in the last frame: ' + c);
  for (const o of fit.out) bad.push('text runs outside the scene: ' + o);
  if (bad.length) { console.error('FAIL\n' + bad.join('\n')); process.exit(1); }
  console.log('ok: fits the page, no overlapping text, no errors');
})();
