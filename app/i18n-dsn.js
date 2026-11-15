// Texts of: Dishes on Earth, the line under the checks of the answer panel. Added to the app texts (i18n.js); tools/test.cjs checks that the three languages hold the same keys.
// Keys end in Tip only when they sit in a tooltip (no double quote, no tag). The 10 degrees is the team's own planning value, not a NASA rule.
(function (root) {
  const I = typeof module !== "undefined" && module.exports ? require("./i18n.js") : root.I18n;
  const X = {
    en: {
      xDLabel: "Dish on Earth",
      xDWait: "checking the three dish sites…",
      xDSee: "a dish can see the Moon for {p} of the hours Earth is in view.",
      xDAt: "At landing: {where}.",
      xDNoneNow: "none",
      xDNoEarth: "Earth never rises over the horizon here during this stay, so there is nothing for a dish to hear.",
      xDMost: "over 99%",
      xDFew: "less than 1%",
      xDGoldstone: "Goldstone",
      xDMadrid: "Madrid",
      xDCanberra: "Canberra",
      xDTip: "Earth in view is half of a radio link. The other half is a big dish on Earth with the Moon in its sky. Every hour we check NASA's three Deep Space Network sites (Goldstone, Madrid, Canberra): the Moon counts when it is 10° or more above the horizon at one of them. This is geometry only. The 10° is our own planning value, not a NASA rule. A real call also needs a scheduled pass on a shared network and a link budget (enough signal power). The sites are about 120° apart around the globe, so the Moon is almost always in view of at least one, which is why the number is usually near 100%. Positions: NASA DSN Now, eyes.nasa.gov/dsn/config.xml.",
    },
    ru: {
      xDLabel: "Антенна на Земле",
      xDWait: "проверяем три площадки антенн…",
      xDSee: "антенна видит Луну {p} часов из тех, когда видна Земля.",
      xDAt: "В момент посадки: {where}.",
      xDNoneNow: "нет",
      xDNoEarth: "За время этой миссии Земля здесь ни разу не поднимается над горизонтом, поэтому антенне нечего слушать.",
      xDMost: "более 99%",
      xDFew: "менее 1%",
      xDGoldstone: "Голдстоун",
      xDMadrid: "Мадрид",
      xDCanberra: "Канберра",
      xDTip: "Видимость Земли это только половина радиосвязи. Вторая половина: большая антенна на Земле, у которой Луна над горизонтом. Каждый час мы проверяем три площадки Сети дальней космической связи NASA (Голдстоун, Мадрид, Канберра): Луна считается видимой, если хотя бы на одной из них она выше горизонта на 10° или больше. Это только геометрия. Значение 10° наше собственное, для планирования, а не правило NASA. Для настоящего сеанса нужны ещё сеанс по расписанию на общей сети и расчёт линии связи (достаточная мощность сигнала). Площадки стоят примерно в 120° друг от друга по долготе, поэтому Луна почти всегда видна хотя бы с одной из них, и число обычно близко к 100%. Положения: NASA DSN Now, eyes.nasa.gov/dsn/config.xml.",
    },
    ky: {
      xDLabel: "Жердеги антенна",
      xDWait: "үч антенна аянтчасын текшерип жатабыз…",
      xDSee: "Жер көрүнүп турган сааттарда антенна Айды {p} убакытта көрө алат.",
      xDAt: "Конуу учурунда: {where}.",
      xDNoneNow: "жок",
      xDNoEarth: "Бул миссия учурунда Жер бул жерде горизонттун үстүнө эч качан чыкпайт, ошондуктан антеннага угуучу эч нерсе жок.",
      xDMost: "99 пайыздан көп",
      xDFew: "1 пайыздан аз",
      xDGoldstone: "Голдстоун",
      xDMadrid: "Мадрид",
      xDCanberra: "Канберра",
      xDTip: "Жердин көрүнүшү радиобайланыштын жарымы гана. Экинчи жарымы: Жердеги чоң антеннанын асманында Ай болушу керек. Биз ар саатта NASA агенттигинин Терең космос тармагынын үч аянтчасын (Голдстоун, Мадрид, Канберра) текшеребиз: алардын биринде Ай горизонттон 10° же андан жогору турса, Ай көрүнөт деп эсептейбиз. Бул геометрия гана. 10° биздин өзүбүздүн пландоо маанибиз, NASA эрежеси эмес. Чыныгы байланыш үчүн дагы көп миссия колдонгон тармактагы убакыт тартиби жана сигналдын жетиштүү кубаттуулугу (байланыш линиясынын эсеби) керек. Аянтчалар узундук боюнча бири-биринен болжол менен 120° алыс турат, ошондуктан Ай дээрлик ар дайым жок дегенде биринен көрүнөт, андыктан сан көбүнчө 100% га жакын. Координаттар: NASA DSN Now, eyes.nasa.gov/dsn/config.xml.",
    },
  };
  for (const l in X) Object.assign(I.S[l], X[l]);
})(typeof globalThis !== "undefined" ? globalThis : this);
