# Data, software and asset attribution

All data are NASA/JPL products (US Government works, no copyright in the US) or openly licensed software. This project is an independent entry to the NASA Space Apps Challenge 2026. It is not a NASA product and is not endorsed by NASA.

## Data

| What | Used for | Source |
|---|---|---|
| LRO LOLA `LDEM_80S_80M` (IMG + LBL), PDS data set `LRO-L-LOLA-4-GDR-V1.0`, product V2.0, 2017 | Terrain mesh, horizon masks, overview map | NASA PDS Geosciences Node: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_80m.img (label: same path, `.lbl`) |
| LOLA polar projection catalog `DSMAP_POLAR.CAT` | Projection equations and orientation | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/catalog/dsmap_polar.cat |
| JPL planetary ephemeris DE440 (`de440s.bsp`) | Sun, Earth and Moon positions | NAIF: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp |
| DE440 lunar orientation (`moon_pa_de440_200625.bpc`) | Moon orientation (libration) | NAIF: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc |
| Lunar frame kernel (`moon_de440_250416.tf`), frame `MOON_ME_DE440_ME421` | Mean-Earth frame matching LOLA's DE421 ME frame | NAIF: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf |
| Planetary constants `pck00011.tpc` | Moon radius (1737.4 km) | NAIF: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc |
| JPL Horizons API | Independent validation of Sun/Earth az/el | https://ssd.jpl.nasa.gov/api/horizons.api (docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html) |
| Candidate site coordinates | Site list | NASA M2M-30044 *Moon to Mars Lunar Surface Data Book*, Baseline, 18 Mar 2025, Table A2.1-1 (p. 75). https://ntrs.nasa.gov/citations/20250002845 . Site names and numbers follow Mazarico et al. (2011), *Icarus* 211(2), doi:10.1016/j.icarus.2010.10.030 |

## Software

| Package | License | Use |
|---|---|---|
| three.js r170 (vendored in `web/vendor/three.module.js`, license in `web/vendor/THREE_LICENSE.txt`) | MIT | 3D rendering |
| Skyfield | MIT | Ephemeris computation |
| jplephem (Skyfield dependency) | MIT | Reading SPICE kernels |
| NumPy | BSD-3-Clause | Numerics |
| requests | Apache-2.0 | HTTP |
| pytest | MIT | Tests |

## Fonts

IBM Plex Sans Condensed and IBM Plex Mono (SIL Open Font License 1.1), loaded from Google Fonts. If the fonts fail to load, the page falls back to system fonts.

## Assets

Two NASA images are used: the colour map of the Moon on the globe around the polar terrain, and the Blue Marble picture of the Earth (both credited at the end of this file). The Earth is a sphere with NASA's Blue Marble picture, lit from the true Sun direction; which continents face the Moon is not modelled. The fine surface texture on the near terrain is procedural noise, labelled in the app as illustrative and below the 80 m data resolution.

- Moon colour map on the globe around the polar terrain: NASA Scientific Visualization Studio, CGI Moon Kit (`lroc_color_poles_2k.tif`, from LRO LROC data), https://svs.gsfc.nasa.gov/4720. Converted to JPEG as `app/data/moon.jpg`.
- Earth picture (the Earth in the sky and on labels): NASA Scientific Visualization Studio, Blue Marble flat map with clouds (`flat_earth03.jpg`), https://svs.gsfc.nasa.gov/3615. Stored as `app/data/earth.jpg`.
- Real landings offered in "Replay a real landing" (`app/src/custom.js`). Positions: Apollo 11 and Apollo 17 from the NASA NSSDC lunar landing site table, https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html; Chandrayaan-3 as listed for Statio Shiv Shakti in the IAU Gazetteer of Planetary Nomenclature, https://planetarynames.wr.usgs.gov (the LROC team gives 69.3741°S, 32.32°E, https://lroc.im-ldi.com/images/1314); IM-1 at Malapert A, 80.13°S 1.44°E; Chang'e 6 at 41.6385°S 153.9852°W as listed on Wikipedia's Chang'e 6 page; IM-2 Athena where the LROC team found it, 84.7906°S 29.1957°E, https://lroc.im-ldi.com/images/1408. No data from those missions is used.
- What really happened at those sites (the box in the answer panel and the table under "How do we know?"): Chandrayaan-3 touchdown 23 Aug 2023 12:33 UTC and the lander set into sleep mode on 4 Sep 2023 around 08:00 IST, ISRO as reported in https://spacepolicyonline.com/news/india-says-good-night-to-chandrayaan-3/; IM-1 touchdown 22 Feb 2024 23:24 UTC and last contact 29 Feb 2024, Intuitive Machines as summarised in https://en.wikipedia.org/wiki/IM-1; Chang'e 6 touchdown 1 Jun 2024 22:23 UTC and the Queqiao-2 relay, https://spacepolicyonline.com/news/china-lands-sample-return-probe-on-the-far-side-of-the-moon/; IM-2 on its side in a 20 m crater and the mission ended on 7 Mar 2025, https://spacepolicyonline.com/news/im-2-mission-ends-one-day-after-lunar-landing/ and the LROC page above.
- NASA's VIPER rover "cannot endure more than 50 hours of continuous darkness": https://science.nasa.gov/mission/viper/lunar-operations/ (quoted next to our 2 day battery limit).
- NASA PGDA Lunar Polar Illumination maps, Mazarico et al. 2011 (`AVGVISIB_85S_060M_201608.IMG` and `_EARTH.IMG`), https://pgda.gsfc.nasa.gov/products/69, files from http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/. Used only to check our numbers (`tools/validate-pgda.cjs`, result in `app/data/pgda.json`); the maps are not shipped.
- Ice hunter (`app/src/ice.js`): the context line on a dark spot's card and its source link come from NASA Science, "LCROSS", https://science.nasa.gov/mission/lcross/ (read 15 Nov 2026). The page says: "The Centaur then crashed onto the surface of the Moon at 11:31 UT in the Cabeus crater at the lunar south pole." and "On Nov. 13, 2009, NASA formally announced that data from LCROSS “indicates that the mission successfully uncovered water … near the Moon’s south pole.”" The card says only that, and that ice "could hide" in places the Sun never reaches in our model; whether a spot holds ice is not something the app knows. The spot is judged with the same 320 m averaged NASA LOLA terrain as a dropped lander (`app/data/polar320.bin`), so small shadows and small sunlit peaks are missed.
