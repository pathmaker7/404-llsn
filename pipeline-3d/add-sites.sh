#!/bin/sh
# Builds terrain and horizon for the team's extra sites into app/data, and checks each against JPL Horizons.
# If the download is slow, fetch ldem_80s_80m.img (115520000 bytes) into pipeline-3d/data/raw/ another way first. Run from the repo root: sh pipeline-3d/add-sites.sh
set -e
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q "numpy>=2.0" "skyfield>=1.49,<2" "requests>=2.31"
.venv/bin/python pipeline/download.py
.venv/bin/python pipeline/build.py --no-best --sites sl sh fr hw mp nb mm sf ff
echo BUILD-DONE
