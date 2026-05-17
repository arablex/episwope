import os
import re
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.paths import GDELT_DIR, GDELT_REPORT_MD, GDELT_ROC_SVG, GDELT_PR_SVG

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCRIPTS = os.path.join(REPO, "scripts")
_BAD = re.compile(r"^\s*(import|from)\s+(numpy|sklearn|scipy|pandas)\b", re.M)


class DependencyFenceTest(unittest.TestCase):
    def test_no_heavy_deps_outside_backtest(self):
        offenders = []
        for root, _dirs, files in os.walk(SCRIPTS):
            if os.path.join("scripts", "backtest") in root:
                continue
            for fn in files:
                if not fn.endswith(".py"):
                    continue
                p = os.path.join(root, fn)
                with open(p, encoding="utf-8") as f:
                    if _BAD.search(f.read()):
                        offenders.append(os.path.relpath(p, REPO))
        self.assertEqual(offenders, [], f"heavy deps leaked: {offenders}")

    def test_gdelt_paths_under_data_backtest(self):
        self.assertTrue(str(GDELT_DIR).endswith("data/backtest/gdelt"))
        self.assertTrue(str(GDELT_REPORT_MD).endswith(
            "docs/validation/gdelt-combined-backtest.md"))
        self.assertTrue(str(GDELT_ROC_SVG).endswith("gdelt-roc.svg"))
        self.assertTrue(str(GDELT_PR_SVG).endswith("gdelt-pr.svg"))
