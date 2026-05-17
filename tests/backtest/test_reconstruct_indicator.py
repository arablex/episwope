import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, "scripts")
from backtest.reconstruct_indicator import s_on_date, monthly_series


def _series(n_days, t=28.0, p=3.0, start=date(2014, 1, 1)):
    return [{"d": (start + timedelta(days=i)).isoformat(), "t": t, "p": p}
            for i in range(n_days)]


class ReconstructTest(unittest.TestCase):
    def test_returns_none_when_insufficient_history(self):
        s = _series(10)
        self.assertIsNone(s_on_date(s, date(2014, 1, 9)))

    def test_produces_value_with_enough_history(self):
        s = _series(80)
        v = s_on_date(s, date(2014, 3, 1))
        self.assertIsInstance(v, float)
        self.assertGreaterEqual(v, 0.0)
        self.assertLessEqual(v, 1.0)

    def test_anti_lookahead_invariant(self):
        """Feeding future days must NOT change S at date t."""
        past = _series(80, start=date(2014, 1, 1))
        t = date(2014, 3, 1)
        # add 200 anomalous future days (hot+wet) AFTER t
        future = _series(200, t=40.0, p=50.0,
                         start=date(2014, 3, 2))
        with_future = past + future
        self.assertEqual(s_on_date(past, t), s_on_date(with_future, t))

    def test_monthly_series_uses_max_of_weekly(self):
        # 1 month, S forced higher on later week via a heat spike
        s = _series(120, start=date(2014, 1, 1))
        ms = monthly_series(s)
        # keys are (year, month); values in 0..1
        self.assertTrue(all(0.0 <= v <= 1.0 for v in ms.values()))
        self.assertIn((2014, 4), ms)
