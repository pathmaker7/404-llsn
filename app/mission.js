// The survival rules for a solar robot staying 14 days. Pure logic, checked at every boundary by tools/test.cjs.
(function (root) {
  // Example values chosen by the team, not NASA requirements. The first two are defaults: the user can change them
  // on the first screen (limits.nightH, limits.silenceH), because a real mission knows its own battery and radio.
  const NIGHT_LIMIT_H = 48; // the battery carries the robot through two days of darkness
  const SILENCE_LIMIT_H = 72; // three days without direct Earth contact and the mission is lost
  const FIRST_SUN_H = 24; // the Sun must be up at landing or rise within a day, so the robot can charge
  const STAY_DAYS = 14;
  const SLOPE_LIMIT = 10, EVA_SLOPE_LIMIT = 20, POLE_LIMIT_DEG = 6; // NASA Artemis III landing site requirements
  const limits = { nightH: NIGHT_LIMIT_H, silenceH: SILENCE_LIMIT_H };

  // x: { m: { longestDarkH, longestBlackoutH, sunPct, earthPct, bothPct, sunElMax, commWindows }, waitH: hours until the
  // Sun is first up (0 when up at landing, Infinity when it never rises in the stay), slope, evaSlope, lat }.
  // "must" rows decide survival, "should" rows are NASA's other site rules, "info" rows only inform.
  function judge(x) {
    const m = x.m;
    return [
      { id: 'night', pri: 'must', ok: m.longestDarkH <= limits.nightH, v: m.longestDarkH },
      { id: 'radio', pri: 'must', ok: m.longestBlackoutH <= limits.silenceH, v: m.longestBlackoutH },
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

  const Mission = { NIGHT_LIMIT_H, SILENCE_LIMIT_H, FIRST_SUN_H, STAY_DAYS, SLOPE_LIMIT, EVA_SLOPE_LIMIT, POLE_LIMIT_DEG, limits, judge };
  if (typeof module !== 'undefined' && module.exports) module.exports = Mission;
  else root.Mission = Mission;
})(typeof globalThis !== 'undefined' ? globalThis : this);
