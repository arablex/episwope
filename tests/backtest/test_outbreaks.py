import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.outbreaks import onsets, MIN_PRIOR_YEARS


def _rows(iso, per_year):
    """per_year: {year: {month: cases}}"""
    out = []
    for y, months in sorted(per_year.items()):
        for m, c in sorted(months.items()):
            out.append({"iso2": iso, "year": y, "month": m, "cases": c})
    return out


class OutbreaksTest(unittest.TestCase):
    def test_excludes_years_without_enough_prior_history(self):
        rows = _rows("TH", {2010: {1: 100}, 2011: {1: 110}})
        res = onsets(rows)
        self.assertEqual(res["TH"]["evaluated_year_months"], [])

    def test_flags_month_exceeding_mean_plus_2sd(self):
        # Jan baseline years 2010-2013 ~100; 2014 Jan spikes to 1000
        per = {y: {1: 100 + (y - 2010) * 2} for y in range(2010, 2014)}
        per[2014] = {1: 1000}
        res = onsets(_rows("TH", per))
        self.assertIn((2014, 1), res["TH"]["onsets"])

    def test_normal_month_not_flagged(self):
        per = {y: {1: 100 + (y - 2010) * 2} for y in range(2010, 2014)}
        per[2014] = {1: 103}
        res = onsets(_rows("TH", per))
        self.assertNotIn((2014, 1), res["TH"]["onsets"])

    def test_only_first_exceedance_per_season_is_onset(self):
        base = {y: {6: 50, 7: 55, 8: 60} for y in range(2010, 2014)}
        base[2014] = {6: 5000, 7: 6000, 8: 7000}
        res = onsets(_rows("BR", base))
        self.assertIn((2014, 6), res["BR"]["onsets"])
        self.assertNotIn((2014, 7), res["BR"]["onsets"])

    def test_min_prior_years_constant(self):
        self.assertEqual(MIN_PRIOR_YEARS, 3)
