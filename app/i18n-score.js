// Texts of: Site score and rank: a number from 0 to 100 and a rank for every site row, and one line in the answer panel. Added to the app texts (i18n.js).
// Keys end in Tip or Note only when they may sit in a tooltip (no double quote, no tag). The period comes from the first screen and is written by src/score.js.
(function (root) {
  const I = typeof module !== "undefined" && module.exports ? require("./i18n.js") : root.I18n;
  const X = {
    en: {
      xSHead: "Score",
      xSTip: "Score from 0 to 100: how many of the landing days in the period you chose are green, so the robot survives its stay. Green days divided by all landing days, times 100, rounded. Rank #1 is the highest score, and sites with the same score share a rank. It changes when you change the dates or the battery and radio limits.",
      xSRow: "Rank {r} of {n}, score {s} of 100",
      xSLine: "Rank {r} of {n}, score {s} of 100 ({period})",
      xSPeriod: "{a} to {b}",
    },
    ru: {
      xSHead: "Оценка",
      xSTip: "Оценка от 0 до 100: сколько дней посадки из выбранного периода зелёные, то есть робот выживает. Число зелёных дней делим на число всех дней посадки, умножаем на 100 и округляем. Позиция №1 у самой высокой оценки, а у мест с одинаковой оценкой позиция одна. Оценка меняется вместе с датами и пределами батареи и связи.",
      xSRow: "Позиция {r} из {n}, оценка {s} из 100",
      xSLine: "Позиция {r} из {n}, оценка {s} из 100 ({period})",
      xSPeriod: "с {a} по {b}",
    },
    ky: {
      xSHead: "Упай",
      xSTip: "Упай 0 менен 100 аралыгында болот. Ал тандалган мезгилдеги конуу күндөрүнүн канчасы жашыл экенин, башкача айтканда робот аман калаарын көрсөтөт. Жашыл күндөрдүн санын бардык конуу күндөрүнүн санына бөлүп, 100 эсе көбөйтүп, бүтүнгө чейин тегеректейбиз. Эң жогорку упай 1-орунду алат, упайы бирдей жерлер бир ордун бөлүшөт. Даталарды же батарея менен байланыштын чектерин өзгөрткөндө упай да өзгөрөт.",
      xSRow: "{n} жердин ичинен {r}-орун, упай {s} / 100",
      xSLine: "{n} жердин ичинен {r}-орун, упай {s} / 100 ({period})",
      xSPeriod: "{a} менен {b} аралыгы",
    },
  };
  for (const l in X) Object.assign(I.S[l], X[l]);
})(typeof globalThis !== "undefined" ? globalThis : this);
