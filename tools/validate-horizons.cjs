// Compares app/sky.js against NASA JPL Horizons (ground truth) for Sun and Earth
// azimuth/elevation seen from south polar sites. Exits 1 if any error exceeds the limit.
// Run: node tools/validate-horizons.cjs
const Sky = require('../app/sky.js');

const LIMIT_DEG = 0.1;
const BIAS = +process.env.SKY_BIAS_DEG || 0;
const SITES = [
  { name: 'Shackleton center', lat: -89.67, lon: 129.78 },
  { name: 'Malapert area', lat: -85.99, lon: 2.9 },
  { name: 'de Gerlache', lat: -88.5, lon: -87.1 },
  { name: 'Apollo 11', lat: 0.674081, lon: 23.472969 }, // near side: Earth high in the sky
  { name: "Chang'e 4", lat: -45.5, lon: 177.6 }, // far side: Earth always below the horizon
];
const TARGETS = { sun: '10', earth: '399' };

async function horizons(target, site) {
  const p = new URLSearchParams({
    format: 'text', COMMAND: `'${target}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'", CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${site.lon},${site.lat},0'`, START_TIME: "'2026-11-14'", STOP_TIME: "'2026-12-14'",
    STEP_SIZE: "'12h'", QUANTITIES: "'4'", APPARENT: "'AIRLESS'", ANG_FORMAT: "'DEG'", TIME_TYPE: "'UT'",
  });
  const txt = await (await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + p)).text();
  const body = txt.split('$$SOE')[1];
  if (!body) throw new Error('Horizons gave no ephemeris:\n' + txt.slice(0, 500));
  return body.split('$$EOE')[0].trim().split('\n').map((line) => {
    const m = line.match(/(\d{4}-\w{3}-\d{2} \d{2}:\d{2})\s+\S*\s+(-?[\d.]+)\s+(-?[\d.]+)/);
    return { date: new Date(m[1].replace(/-(\w{3})-/, ' $1 ') + ' UTC'), az: +m[2], el: +m[3] };
  });
}

(async () => {
  let worst = 0;
  for (const site of SITES) {
    for (const [body, id] of Object.entries(TARGETS)) {
      const rows = await horizons(id, site);
      let maxEl = 0, maxAz = 0;
      for (const r of rows) {
        const s = Sky.skyAt(r.date, site)[body];
        s.el += BIAS; // SKY_BIAS_DEG=0.2 proves this check can fail
        const dAz = Math.abs(((s.az - r.az + 540) % 360) - 180) * Math.cos((r.el * Math.PI) / 180);
        maxEl = Math.max(maxEl, Math.abs(s.el - r.el));
        maxAz = Math.max(maxAz, dAz);
      }
      worst = Math.max(worst, maxEl, maxAz);
      console.log(`${site.name.padEnd(18)} ${body.padEnd(5)} n=${rows.length}  max|dEl|=${maxEl.toFixed(4)}°  max|dAz·cosEl|=${maxAz.toFixed(4)}°`);
    }
  }
  console.log(`worst ${worst.toFixed(4)}° (limit ${LIMIT_DEG}°) ${worst <= LIMIT_DEG ? 'PASS' : 'FAIL'}`);
  process.exit(worst <= LIMIT_DEG ? 0 : 1);
})();
