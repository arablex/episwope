import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.backtest_phase2 import build_report_v2, CRITERION
from backtest.backtest_combined import CRITERION as PHASE1_CRITERION

PRIOR_POINTS = [
    {"iso": "TH", "year": Y, "month": 6, "p0": 0.3,
     "y": 1 if Y >= 2021 else 0}
    for Y in range(2017, 2025)
] + [
    {"iso": "ID", "year": Y, "month": 9, "p0": 0.25,
     "y": 1 if Y >= 2021 else 0}
    for Y in range(2017, 2025)
]
ZBYKEY = {}
for iso, mo in (("TH", 6), ("ID", 9)):
    for Y in range(2017, 2025):
        ZBYKEY[(iso, Y, mo)] = 2.5 if Y >= 2021 else -0.4


class Phase2Test(unittest.TestCase):
    def test_criterion_is_the_pre_registered_one_verbatim(self):
        # Phase-2 must NOT redefine the bar — identical text to Phase-1.
        self.assertEqual(CRITERION, PHASE1_CRITERION)
        self.assertNotIn("0.78", CRITERION)
        self.assertIn("PR-AUC", CRITERION)

    def test_report_deterministic(self):
        a = build_report_v2(PRIOR_POINTS, ZBYKEY, first_test_year=2020)
        b = build_report_v2(PRIOR_POINTS, ZBYKEY, first_test_year=2020)
        self.assertEqual(a["markdown"], b["markdown"])

    def test_criterion_before_verdict(self):
        md = build_report_v2(PRIOR_POINTS, ZBYKEY,
                             first_test_year=2020)["markdown"]
        self.assertIn("Pre-registered success criterion", md)
        self.assertLess(md.index("Pre-registered success criterion"),
                        md.index("Verdict"))

    def test_verdict_enumerated(self):
        r = build_report_v2(PRIOR_POINTS, ZBYKEY, first_test_year=2020)
        self.assertIn(r["verdict"], ("PROVEN", "NOT DEMONSTRATED"))

    def test_no_train_test_overlap(self):
        r = build_report_v2(PRIOR_POINTS, ZBYKEY, first_test_year=2020)
        for tr_max, te in r["folds"]:
            self.assertLess(tr_max, te)

    def test_calibration_fit_on_prior_only(self):
        """Appending FUTURE-year points must not change ANY already-
        formed fold's calibrated OOS predictions (β + isotonic fit
        strictly on year<Y — no lookahead)."""
        base = build_report_v2(PRIOR_POINTS, ZBYKEY, first_test_year=2020)
        extra = PRIOR_POINTS + [
            {"iso": "TH", "year": 2099, "month": 6, "p0": 0.9, "y": 1}]
        z2 = dict(ZBYKEY)
        z2[("TH", 2099, 6)] = 9.9
        withfut = build_report_v2(extra, z2, first_test_year=2020)
        fold_keys = [k for k in base if k.startswith("oos_")]
        self.assertTrue(fold_keys, "expected at least one OOS fold")
        for k in fold_keys:
            self.assertEqual(base[k], withfut[k],
                             f"future data leaked into fold {k}")


if __name__ == "__main__":
    unittest.main()
