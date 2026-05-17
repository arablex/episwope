import os
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.fetch_gdelt import parse_gdelt_timeline, QUERY_TEMPLATE

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "gdelt_sample.json")


class ParseGdeltTest(unittest.TestCase):
    def setUp(self):
        with open(FIX, encoding="utf-8") as f:
            self.monthly = parse_gdelt_timeline(f.read())

    def test_aggregates_daily_to_monthly(self):
        self.assertEqual(self.monthly[(2018, 1)], 5)   # 2 + 3
        self.assertEqual(self.monthly[(2018, 2)], 5)
        self.assertEqual(self.monthly[(2019, 3)], 1)

    def test_missing_months_absent(self):
        self.assertNotIn((2018, 3), self.monthly)

    def test_garbage_returns_empty(self):
        self.assertEqual(parse_gdelt_timeline("not json"), {})
        self.assertEqual(parse_gdelt_timeline('{"timeline":[]}'), {})

    def test_query_template_frozen(self):
        self.assertIn("{iso}", QUERY_TEMPLATE)
        self.assertIn("sourcecountry:", QUERY_TEMPLATE)
