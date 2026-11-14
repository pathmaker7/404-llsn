// Writes explainer/texts.html: every text of the kids features (My lander, Keep me alive, Ice hunter, Quiz, the first
// visit help) in English, Russian and Kyrgyz side by side, for a native speaker to read on a phone. The Russian and
// Kyrgyz texts were drafted with AI; this page is how the team checks them. Run: node tools/texts-sheet.cjs
// The page is generated from app/i18n-*.js; change a text there, then run this again.
const fs = require('fs');
const path = require('path');
const I = require('../app/i18n.js');
const PARTS = [['lander', 'My lander'], ['game', 'Keep me alive'], ['ice', 'Ice hunter'], ['quiz', 'Quiz'], ['tour', 'Help for a first visit']];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let n = 0, body = '';
for (const [f, title] of PARTS) {
  const before = new Set(Object.keys(I.S.en));
  require(`../app/i18n-${f}.js`);
  const keys = Object.keys(I.S.en).filter((k) => !before.has(k));
  n += keys.length;
  body += `<h2 id="${f}">${esc(title)} <small>${keys.length} texts</small></h2>\n` + keys.map((k) =>
    `<section><code>${esc(k)}</code><p lang="en"><b>EN</b> ${esc(I.S.en[k])}</p><p lang="ru"><b>RU</b> ${esc(I.S.ru[k])}</p><p lang="ky"><b>KY</b> ${esc(I.S.ky[k])}</p></section>`).join('\n') + '\n';
}
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Texts to check: Russian and Kyrgyz</title>
<style>
  body { margin: 0 auto; max-width: 860px; padding: 16px; font: 16px/1.5 system-ui, sans-serif; background: #0b0e13; color: #e6ebf3; }
  h1 { font-size: 24px; margin: 8px 0; } h2 { margin: 32px 0 8px; font-size: 20px; color: #46e0c8; } h2 small { font-weight: 400; color: #8a94a6; font-size: 13px; }
  .lead { color: #b9c2d0; } nav a { color: #46e0c8; margin-right: 14px; white-space: nowrap; }
  section { border: 1px solid #232a36; border-radius: 8px; padding: 8px 12px; margin: 8px 0; background: #11161e; }
  section p { margin: 4px 0; } code { color: #8a94a6; font-size: 12px; } b { display: inline-block; min-width: 28px; font-size: 11px; color: #8a94a6; }
  p[lang="en"] { color: #9aa5b8; }
</style>
</head>
<body>
<h1>Texts to check: Russian and Kyrgyz</h1>
<p class="lead">${n} texts of the children's features of the Lunar Landing Site Navigator. The Russian and Kyrgyz lines were drafted with AI and need a native speaker's eye. Names in braces, like {site} or {n}, are filled in by the app: leave them as they are. Found a wrong or clumsy line? Send its grey code (for example kTIce2) and the wording you would use to the team.</p>
<nav>${PARTS.map(([f, t]) => `<a href="#${f}">${esc(t)}</a>`).join('')}</nav>
${body}</body>
</html>
`;
const out = path.join(__dirname, '..', 'explainer', 'texts.html');
fs.writeFileSync(out, html);
console.log(`${n} texts written to ${out}`);
