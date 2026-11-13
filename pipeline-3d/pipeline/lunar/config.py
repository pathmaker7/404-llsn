"""Shared constants, paths and the candidate site list.

Every number here is traceable to a source; see docs/ATTRIBUTION.md.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_RAW = ROOT / "data" / "raw"
KERNELS = ROOT / "data" / "kernels"
CACHE = ROOT / "data" / "cache"
WEB_DATA = ROOT.parent / "app" / "data"  # this repo serves the app from app/

# --- Terrain: LOLA LDEM_80S_80M (values read from ldem_80s_80m.lbl, PDS3 label) ---
DEM_IMG = DATA_RAW / "ldem_80s_80m.img"
DEM_LBL = DATA_RAW / "ldem_80s_80m.lbl"
DEM_URL = ("https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/"
           "lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_80m.img")
DEM_LBL_URL = DEM_URL.replace(".img", ".lbl")

# Mean lunar radius; also the LOLA reference sphere (label: OFFSET = 1737400 m,
# A/B/C_AXIS_RADIUS = 1737.4 km) and the IAU/pck00011 Moon radius.
MOON_RADIUS_M = 1737400.0

OBSERVER_HEIGHT_M = 2.0

# --- Ephemeris kernels (NAIF generic_kernels) ---
KERNEL_FILES = {
    "de440s.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp",
    "moon_pa_de440_200625.bpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc",
    "moon_de440_250416.tf": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf",
    "pck00011.tpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc",
}
# DE440 lunar orientation expressed in a Mean-Earth frame aligned with DE421 ME,
# which is the frame of the LOLA products and of Horizons' lunar site coordinates.
MOON_FRAME = "MOON_ME_DE440_ME421"

# Radii used for angular size. Sun: IAU 2015 nominal solar radius.
# Earth: IUGG mean radius. (Earth's flattening changes its angular size by <0.2%.)
SUN_RADIUS_KM = 695700.0
EARTH_RADIUS_KM = 6371.0

# --- Time grid ---
T_START = "2027-01-01T00:00:00Z"
T_END = "2028-12-31T23:00:00Z"   # inclusive
T_STEP_HOURS = 1

# --- Horizon mask ---
MASK_AZ_STEP_DEG = 0.25
MASK_RAY_STEP_M = 40.0            # half a DEM pixel
MASK_MAX_RANGE_M = 300_000.0      # rays stop earlier at the DEM edge

# --- Candidate sites ---
# Source: NASA M2M-30044 "Moon to Mars Lunar Surface Data Book", Baseline,
# 18 Mar 2025, Table A2.1-1 "Lunar South Pole Features" (p. 75),
# https://ntrs.nasa.gov/citations/20250002845 . The Data Book states the
# coordinates are centre points of region polygons from Mazarico et al. (2011),
# generated from the PGDA South Pole LOLA DEMs and accurate to 5-10 m.
# Latitude planetocentric, longitude east, MOON_ME (DE421) frame.
SITES = [
    {"id": "cr",  "ref": "Site01", "name": "Connecting ridge",      "lat": -89.4632, "lon": -137.4900},
    {"id": "sr",  "ref": "Site04", "name": "Shackleton rim",        "lat": -89.7668, "lon": -171.8700},
    {"id": "nr1", "ref": "Site06", "name": "Nobile rim 1",          "lat": -85.4381, "lon":   37.36667},
    {"id": "ps",  "ref": "Site07", "name": "Peak near Shackleton",  "lat": -88.8110, "lon":  123.6901},
    {"id": "dg",  "ref": "Site11", "name": "de Gerlache rim 1",     "lat": -88.6834, "lon":  -67.9321},
    {"id": "lbp", "ref": "Site20", "name": "Leibnitz beta plateau", "lat": -85.4266, "lon":   31.74276},
    # Added by team 404 agents (ref "Team"): the best-lit point on a crater rim, or the lowest point of a crater
    # floor, found on LOLA terrain around the crater centre from the USGS gazetteer. Not Data Book sites.
    {"id": "sl",  "ref": "Team", "name": "Slater rim",             "lat": -87.6946, "lon":  114.5416},
    {"id": "sh",  "ref": "Team", "name": "Shoemaker rim",          "lat": -88.6483, "lon":   19.4959},
    {"id": "fr",  "ref": "Team", "name": "Faustini rim",           "lat": -87.2067, "lon":   61.7652},
    {"id": "hw",  "ref": "Team", "name": "Haworth rim",            "lat": -85.9697, "lon":   -2.3625},
    {"id": "mp",  "ref": "Team", "name": "Malapert rim",           "lat": -85.3904, "lon":   26.6090},
    {"id": "nb",  "ref": "Team", "name": "Nobile rim",             "lat": -85.2997, "lon":   36.9278},
    {"id": "mm",  "ref": "Team", "name": "Mons Mouton",            "lat": -84.3357, "lon":   31.7595},
    {"id": "sf",  "ref": "Team", "name": "Shackleton floor",       "lat": -89.6334, "lon":  122.6609},
    {"id": "ff",  "ref": "Team", "name": "Faustini floor",         "lat": -87.2456, "lon":   76.8820},
]
SITE_SOURCE = ("NASA M2M-30044 Lunar Surface Data Book (Baseline, 2025-03-18), "
               "Table A2.1-1, p.75")
