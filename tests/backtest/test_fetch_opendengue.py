import os
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.fetch_opendengue import parse_opendengue_csv

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "opendengue_sample.csv")


class ParseOpenDengueTest(unittest.TestCase):
    def setUp(self):
        with open(FIX, encoding="utf-8") as f:
            self.rows = parse_opendengue_csv(f.read())

    def test_only_monthly_rows_kept(self):
        # the weekly Brazil row must be dropped
        self.assertEqual(len(self.rows), 4)

    def test_iso3_to_iso2(self):
        isos = {r["iso2"] for r in self.rows}
        self.assertEqual(isos, {"TH", "BR"})

    def test_year_month_cases(self):
        th_mar = [r for r in self.rows
                  if r["iso2"] == "TH" and r["year"] == 2014 and r["month"] == 3]
        self.assertEqual(len(th_mar), 1)
        self.assertEqual(th_mar[0]["cases"], 3200)

    def test_rows_sorted(self):
        keys = [(r["iso2"], r["year"], r["month"]) for r in self.rows]
        self.assertEqual(keys, sorted(keys))
