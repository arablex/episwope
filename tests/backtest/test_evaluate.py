import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.evaluate import (
    tss, lead_times, seasonal_alarms, persistence_alarms,
    block_bootstrap_ci,
)


class EvaluateTest(unittest.TestCase):
    def test_tss_perfect(self):
        ym = [(2014, m) for m in range(1, 13)]
        onsets = {(2014, 6)}
        alarms = {(2014, 5), (2014, 6)}
        self.assertAlmostEqual(tss(ym, onsets, alarms, horizon_months=1), 1.0)

    def test_tss_zero_for_all_or_nothing(self):
        ym = [(2014, m) for m in range(1, 13)]
        onsets = {(2014, 6)}
        alarms = set(ym)
        self.assertAlmostEqual(tss(ym, onsets, alarms, horizon_months=1), 0.0,
                               places=6)

    def test_lead_times_measured_in_weeks(self):
        onsets = {(2014, 6)}
        alarms = {(2014, 4)}
        lt = lead_times(onsets, alarms, horizon_months=3)
        self.assertEqual(len(lt), 1)
        self.assertGreater(lt[0], 4)

    def test_seasonal_baseline_is_deterministic(self):
        ym = [(y, m) for y in (2012, 2013, 2014) for m in range(1, 13)]
        onsets = {(2013, 7), (2014, 7)}
        a1 = seasonal_alarms(ym, onsets)
        a2 = seasonal_alarms(ym, onsets)
        self.assertEqual(a1, a2)
        self.assertTrue(any(m == 7 for (_y, m) in a1))

    def test_persistence_alarms(self):
        ym = [(2014, m) for m in range(1, 6)]
        onsets = {(2014, 2)}
        self.assertEqual(persistence_alarms(ym, onsets), {(2014, 3)})

    def test_block_bootstrap_ci_is_seeded_deterministic(self):
        blocks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
        lo1, hi1 = block_bootstrap_ci(blocks, seed=42)
        lo2, hi2 = block_bootstrap_ci(blocks, seed=42)
        self.assertEqual((lo1, hi1), (lo2, hi2))
        self.assertLess(lo1, hi1)
