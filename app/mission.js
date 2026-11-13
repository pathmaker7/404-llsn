// Mission mode rules: one fixed mission, one decision (the landing spot), a pass or fail from the planner's numbers.
// Pure logic, no page access, so tools/test.cjs can check every boundary.
(function (root) {
  const Analysis = root.Analysis || require('./analysis.js');

  // Teaching values chosen by the team, not NASA requirements.
  const NIGHT_LIMIT_H = 48; // the robot's battery carries it through two days of darkness
  const SILENCE_LIMIT_H = 72; // three days without direct Earth contact and the mission is lost
  const STAY_DAYS = 14;
  const DELAY_DAYS = 21; // the launch slip in step 3
  // Landing day. Chosen from the data (tools/test.cjs holds the proof): on this day two of the four spots keep the
  // robot alive, and 21 days later those two fail while a third passes, so both the place and the date matter.
  // On both days our 480 m engine and the 80 m precomputed series in app/surface/data give the same verdicts.
  const START = '2027-07-22';

  // The four spots: points from NASA's Lunar Surface Data Book (M2M-30044, Table A2.1-1), three of them moved to the
  // best-lit point within 500 m. view: the same point in the 3D surface view (app/surface), as site id and variant.
  const SPOTS = [
    { key: 'wall', name: 'Shackleton rim (Data Book centre)', lat: -89.7668, lon: -171.87, view: ['sr', 'databook'] },
    { key: 'ridge', name: 'Connecting ridge (best within 500 m)', lat: -89.45116, lon: -137.14272, view: ['cr', 'best'] },
    { key: 'rim2', name: 'de Gerlache rim 1 (best within 500 m)', lat: -88.669715, lon: -68.293538, view: ['dg', 'best'] },
    { key: 'plateau', name: 'Leibnitz beta plateau (best within 500 m)', lat: -85.41234, lon: 31.748813, view: ['lbp', 'best'] },
  ];
  const VIEW_FROM = '2027-01-01', VIEW_TO = '2028-12-17'; // the 3D view has data for 2027 and 2028 (14 day stay must fit)

  const SLOPE_LIMIT = 10, EVA_SLOPE_LIMIT = 20, POLE_LIMIT_DEG = 6; // NASA Artemis III landing requirements
  const FIRST_SUN_H = 24; // the Sun must be up at landing or rise within a day, so the robot can charge

  // The mission report. x: { m: Analysis.metrics over the stay, waitH: hours until the Sun is first up (0 when up at
  // landing, Infinity when it never rises in the stay), slope, evaSlope, lat }.
  // "must" rows decide survival, "should" rows are NASA's other site rules, "info" rows only inform.
  function judge(x) {
    const m = x.m;
    return [
      { id: 'night', pri: 'must', ok: m.longestDarkH <= NIGHT_LIMIT_H, v: m.longestDarkH },
      { id: 'radio', pri: 'must', ok: m.longestBlackoutH <= SILENCE_LIMIT_H, v: m.longestBlackoutH },
      { id: 'light', pri: 'must', ok: x.waitH < FIRST_SUN_H, v: x.waitH },
      { id: 'slope', pri: 'must', ok: x.slope < SLOPE_LIMIT, v: x.slope },
      { id: 'eva', pri: 'should', ok: x.evaSlope < EVA_SLOPE_LIMIT, v: x.evaSlope },
      { id: 'pole', pri: 'should', ok: 90 + x.lat <= POLE_LIMIT_DEG, v: 90 + x.lat },
      { id: 'sunPct', pri: 'info', v: m.sunPct },
      { id: 'earthPct', pri: 'info', v: m.earthPct },
      { id: 'bothPct', pri: 'info', v: m.bothPct },
      { id: 'sunMax', pri: 'info', v: m.sunElMax },
      { id: 'windows', pri: 'info', v: m.commWindows.length },
    ];
  }

  // One site (with its track, slope, evaSlope, lat), landing at sample k0 for w samples.
  function evaluate(s, k0, w, stepH) {
    const lit = s.track.lit, k1 = Math.min(lit.length - 1, k0 + w - 1), m = Analysis.metrics(s.track, k0, k1, stepH);
    const j = Analysis.nextChange(lit, k0), waitH = lit[k0] ? 0 : j < 0 || j > k1 ? Infinity : (j - k0) * stepH;
    const rows = judge({ m, waitH, slope: s.slope, evaSlope: s.evaSlope, lat: s.lat });
    return { m, rows, checks: rows.filter((r) => r.pri === 'must'), ok: rows.every((r) => r.pri !== 'must' || r.ok) };
  }

  const Mission = { NIGHT_LIMIT_H, SILENCE_LIMIT_H, STAY_DAYS, DELAY_DAYS, START, SPOTS, VIEW_FROM, VIEW_TO, SLOPE_LIMIT, EVA_SLOPE_LIMIT, POLE_LIMIT_DEG, FIRST_SUN_H, judge, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = Mission;
  else root.Mission = Mission;
})(typeof globalThis !== 'undefined' ? globalThis : this);
