import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.run_backtest import build_report

# Minimal synthetic inputs: one country, alarms perfectly leading onsets.
MONTHLY_S = {"TH": {(2014, 5): 0.9, (2014, 6): 0.9, (2015, 1): 0.1}}
ONSETS = {"TH": {"onsets": {(2014, 6)},
                 "evaluated_year_months": [(2014, 5), (2014, 6), (2015, 1)]}}


class RunBacktestTest(unittest.TestCase):
    def test_report_is_deterministic(self):
        a = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        b = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        self.assertEqual(a["markdown"], b["markdown"])

    def test_report_states_criterion_before_verdict(self):
        r = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        md = r["markdown"]
        self.assertIn("Pre-registered success criterion", md)
        self.assertLess(md.index("Pre-registered success criterion"),
                        md.index("Verdict"))

    def test_verdict_is_one_of_expected(self):
        r = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        self.assertIn(r["verdict"], ("PROVEN", "NOT DEMONSTRATED"))

    def test_skill_vs_seasonal_present(self):
        r = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        self.assertIn("vs seasonal", r["markdown"])
