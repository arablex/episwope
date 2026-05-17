"""Path constants for the backtest harness + import bootstrap."""
import os
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent          # repo/scripts
REPO = SCRIPTS.parent                                      # repo root
DATA = REPO / "data" / "backtest"
CLIMATE_DIR = DATA / "climate"
DENGUE_CSV = DATA / "dengue.csv"
DOCS = REPO / "docs" / "validation"
REPORT_MD = DOCS / "dengue-backtest.md"
ROC_SVG = DOCS / "dengue-roc.svg"
LEADTIME_SVG = DOCS / "dengue-leadtime.svg"
GDELT_DIR = DATA / "gdelt"
GDELT_REPORT_MD = DOCS / "gdelt-combined-backtest.md"
GDELT_ROC_SVG = DOCS / "gdelt-roc.svg"
GDELT_PR_SVG = DOCS / "gdelt-pr.svg"

# allow `from _shared.pathogen_suitability import ...` from backtest modules
sys.path.insert(0, str(SCRIPTS))


def ensure_dirs():
    for d in (DATA, CLIMATE_DIR, GDELT_DIR, DOCS):
        d.mkdir(parents=True, exist_ok=True)
