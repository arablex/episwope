import sys
import unittest

sys.path.insert(0, "scripts")
import numpy as np
from backtest.score_model import (
    causal_z, fit_offset_logistic, posterior, pr_auc, brier, MIN_Z_HISTORY,
)


class ScoreModelTest(unittest.TestCase):
    def test_causal_z_needs_history(self):
        self.assertEqual(causal_z([1, 2, 3], 2), 0.0)

    def test_causal_z_uses_only_prior(self):
        series = [10.0] * 24 + [20.0]
        z = causal_z(series, 24)
        self.assertGreater(z, 5.0)
        series2 = series + [999.0, -999.0]
        self.assertEqual(causal_z(series2, 24), z)

    def test_offset_logistic_recovers_signal(self):
        rng = np.random.default_rng(0)
        n = 400
        x = rng.normal(size=n)
        offset = np.full(n, -1.0)
        p = 1 / (1 + np.exp(-(offset + 1.5 * x)))
        y = (rng.uniform(size=n) < p).astype(float)
        beta = fit_offset_logistic(x.reshape(-1, 1), y, offset)
        self.assertGreater(beta[0], 0.5)

    def test_posterior_reduces_to_prior_at_zero(self):
        p0 = 0.3
        self.assertAlmostEqual(posterior(p0, [0.0], [2.0]), p0, places=9)

    def test_pr_auc_perfect_and_constant(self):
        y = [0, 0, 1, 1]
        self.assertAlmostEqual(pr_auc(y, [0.1, 0.2, 0.8, 0.9]), 1.0, places=9)
        self.assertAlmostEqual(pr_auc(y, [0.5, 0.5, 0.5, 0.5]), 0.5, places=6)

    def test_brier(self):
        self.assertAlmostEqual(brier([1, 0], [1.0, 0.0]), 0.0, places=9)
        self.assertAlmostEqual(brier([1, 0], [0.0, 1.0]), 1.0, places=9)

    def test_min_z_history_constant(self):
        self.assertEqual(MIN_Z_HISTORY, 24)
