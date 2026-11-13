"""Writes app/data/polar320.bin: LOLA LDEM_80S_80M block-averaged to 320 m, for sites the user adds near the pole.

    python pipeline/mid.py

int16 LE heights in metres relative to the 1737.4 km sphere, 1900 x 1900, same layout as overview.bin
(row 0 = top of the polar stereographic map, toward 0 E; column 0 = left, toward 90 W).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lunar import config, terrain  # noqa: E402
from lunar.dem import load_dem  # noqa: E402

BLOCK = 4
dem = load_dem()
c = terrain.block_mean(dem.dn, BLOCK) * dem.scaling
out = config.WEB_DATA / "polar320.bin"
c.round().astype("<i2").tofile(out)
print(out, c.shape, dem.scale_m * BLOCK, float(c.min()), float(c.max()))
