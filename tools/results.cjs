// Prints the one-year results table (markdown) with the same terrain and maths as the app.
// Run: npm run results   (settings below match the README heading)
const Sky = require('../app/sky.js');
const A = require('../app/analysis.js');
const Terrain = require('../app/terrain.js');
const Globe = require('../app/globe.js');
const { GLOBAL, PATCHES, CATALOG_SITES } = require('../app/data/global.js');
const PRESETS = require('../app/data/sites.js');

const START = '2026-11-14', DAYS = 365, STEP_H = 2, MAST_M = 2, MARGIN_DEG = 0.5;
const globe = Globe(GLOBAL, PATCHES), polar = Terrain(require('../app/data/dem.js'), globe.heightAtVec);
const ground = (lat, lon) => (globe.resolutionAt(lat, lon) === '474 m' || isNaN(polar.heightAt(lat, lon)) ? globe : polar); // same rule as app.js

const extra = ['Apollo 11', 'IM-2 Athena', 'Chandrayaan-3', "Chang'e 4 (far side)"].map((n) => CATALOG_SITES.find((s) => s.name === n));
const times = A.makeTimes(new Date(START + 'T00:00:00Z'), DAYS, STEP_H), bodies = times.map(Sky.bodiesMoonFixed);
const days = (h) => (h / 24).toFixed(1) + ' d';

console.log(`One year from ${START}, ${MAST_M} m mast, ${MARGIN_DEG}° Earth margin, ${STEP_H} h steps\n`);
console.log('| Site | Sunlit | Earth | Both | Longest night | Longest blackout | Slope | Terrain |');
console.log('|---|---|---|---|---|---|---|---|');
for (const p of [...PRESETS, ...extra]) {
  const gr = ground(p.lat, p.lon);
  const site = { lat: p.lat, lon: p.lon, heightM: gr.heightAt(p.lat, p.lon), horizon: gr.horizon(p.lat, p.lon, MAST_M) };
  const m = A.metrics(A.track(site, bodies, polar.horizonAt, MARGIN_DEG), 0, times.length - 1, STEP_H);
  const res = gr === polar ? '480 m' : globe.resolutionAt(p.lat, p.lon);
  console.log(`| ${p.name} | ${m.sunPct.toFixed(1)}% | ${m.earthPct.toFixed(1)}% | ${m.bothPct.toFixed(1)}% | ${days(m.longestDarkH)} | ${days(m.longestBlackoutH)} | ${gr.slopeAt(p.lat, p.lon).toFixed(1)}° | ${res} |`);
}
