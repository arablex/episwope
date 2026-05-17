import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.backtest_combined import build_report, CRITERION

PRIOR_POINTS = [
    {"iso": "TH", "year": Y, "month": 6, "p0": 0.3,
     "y": 1 if Y >= 2020 else 0}
    for Y in range(2016, 2024)
]
ZBYKEY = {("TH", Y, 6): (2.5 if Y >= 2020 else -0.5)
          for Y in range(2016, 2024)}


class BacktestCombinedTest(unittest.TestCase):
    def test_report_deterministic(self):
        a = build_report(PRIOR_POINTS, ZBYKEY, first_test_year=2019)
        b = build_report(PRIOR_POINTS, ZBYKEY, first_test_year=2019)
        self.assertEqual(a["markdown"], b["markdown"])

    def test_criterion_before_verdict(self):
        md = build_report(PRIOR_POINTS, ZBYKEY,
                          first_test_year=2019)["markdown"]
        self.assertIn("Pre-registered success criterion", md)
        self.assertLess(md.index("Pre-registered success criterion"),
                        md.index("Verdict"))

    def test_verdict_enumerated(self):
        r = build_report(PRIOR_POINTS, ZBYKEY, first_test_year=2019)
        self.assertIn(r["verdict"], ("PROVEN", "NOT DEMONSTRATED"))

    def test_no_train_test_overlap(self):
        r = build_report(PRIOR_POINTS, ZBYKEY, first_test_year=2019)
        for tr_max, te in r["folds"]:
            self.assertLess(tr_max, te)

    def test_criterion_text_has_no_target_number(self):
        self.assertNotIn("0.78", CRITERION)
        self.assertIn("PR-AUC", CRITERION)
