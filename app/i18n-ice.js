// Texts of: Ice hunter: tap a spot near the pole, is it dark enough for ice. Added to the app texts (i18n.js); tools/test.cjs checks the three languages hold the same keys.
(function (root) {
  const I = typeof module !== "undefined" && module.exports ? require("./i18n.js") : root.I18n;
  const X = {
    en: {
    },
    ru: {
    },
    ky: {
    },
  };
  for (const l in X) Object.assign(I.S[l], X[l]);
})(typeof globalThis !== "undefined" ? globalThis : this);
