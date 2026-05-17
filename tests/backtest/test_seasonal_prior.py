import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.seasonal_prior import prior_points, MIN_PRIOR_YEARS


def _onsets(iso, onset_yms, evaluated):
    return {iso: {"onsets": set(onset_yms),
                  "evaluated_year_months": sorted(evaluated)}}


class SeasonalPriorTest(unittest.TestCase):
    def test_excludes_year_without_min_prior(self):
        ev = [(2010, 6), (2011, 6)]
        pts = prior_points(_onsets("TH", [], ev))
        self.assertEqual(pts, [])   # <3 prior same-month years

    def test_prior_is_laplace_strictly_prior(self):
        ev = [(y, 6) for y in (2010, 2011, 2012, 2013)]
        on = [(2010, 6), (2011, 6), (2012, 6)]
        pts = prior_points(_onsets("TH", on, ev))
        row = [p for p in pts if p["iso"] == "TH"
               and p["year"] == 2013 and p["month"] == 6][0]
        self.assertAlmostEqual(row["p0"], 4.0 / 5.0, places=9)
        self.assertEqual(row["y"], 0)

    def test_label_reflects_actual_onset(self):
        ev = [(y, 6) for y in (2010, 2011, 2012, 2013)]
        on = [(2010, 6), (2011, 6), (2012, 6), (2013, 6)]
        pts = prior_points(_onsets("TH", on, ev))
        row = [p for p in pts if p["year"] == 2013 and p["month"] == 6][0]
        self.assertEqual(row["y"], 1)

    def test_anti_lookahead_future_years_ignored(self):
        ev = [(y, 6) for y in (2010, 2011, 2012, 2013, 2014, 2015)]
        on = [(2010, 6), (2011, 6), (2012, 6)]
        base = _onsets("TH", on, ev)
        fut = _onsets("TH", on + [(2014, 6), (2015, 6)], ev)
        r0 = [p for p in prior_points(base)
              if p["year"] == 2013 and p["month"] == 6][0]
        r1 = [p for p in prior_points(fut)
              if p["year"] == 2013 and p["month"] == 6][0]
        self.assertEqual(r0["p0"], r1["p0"])

    def test_min_prior_constant(self):
        self.assertEqual(MIN_PRIOR_YEARS, 3)
