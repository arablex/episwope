import os
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.fetch_gdelt_bq import parse_bq_csv, FIPS_TO_ISO2

SAMPLE = (
    "fips,year,month,articles\n"
    "BG,2017,1,100\n"
    "BG,2017,2,150\n"
    "VM,2018,6,42\n"
    "ZZ,2019,3,9\n"          # unknown FIPS → dropped
    "TH,2020,12,7\n"
)


class ParseBqCsvTest(unittest.TestCase):
    def setUp(self):
        self.m = parse_bq_csv(SAMPLE)

    def test_fips_mapped_to_iso2(self):
        self.assertIn("BD", self.m)   # BG → BD
        self.assertIn("VN", self.m)   # VM → VN
        self.assertIn("TH", self.m)

    def test_unknown_fips_dropped(self):
        flat = {iso for iso in self.m}
        self.assertNotIn("ZZ", flat)
        self.assertEqual(set(self.m), {"BD", "VN", "TH"})

    def test_monthly_counts(self):
        self.assertEqual(self.m["BD"][(2017, 1)], 100)
        self.assertEqual(self.m["BD"][(2017, 2)], 150)
        self.assertEqual(self.m["VN"][(2018, 6)], 42)

    def test_garbage_and_bad_header_raise_or_empty(self):
        self.assertEqual(parse_bq_csv(""), {})
        self.assertEqual(parse_bq_csv("a,b,c\n1,2,3\n"), {})

    def test_mapping_covers_six_gate_countries(self):
        self.assertEqual(
            sorted(FIPS_TO_ISO2.items()),
            sorted({"BG": "BD", "CB": "KH", "CE": "LK",
                    "ID": "ID", "TH": "TH", "VM": "VN"}.items()))


if __name__ == "__main__":
    unittest.main()
