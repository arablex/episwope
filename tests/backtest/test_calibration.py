import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.calibration import fit_isotonic, apply_isotonic


class IsotonicTest(unittest.TestCase):
    def test_monotone_nondecreasing_output(self):
        x = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
        y = [0, 0, 1, 0, 1, 1, 1, 1]
        cal = fit_isotonic(x, y)
        out = [apply_isotonic(cal, v) for v in sorted(x)]
        for a, b in zip(out, out[1:]):
            self.assertLessEqual(a, b)

    def test_recovers_perfect_step(self):
        x = [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9]
        y = [0, 0, 0, 0, 1, 1, 1, 1]
        cal = fit_isotonic(x, y)
        self.assertLess(apply_isotonic(cal, 0.25), 0.5)
        self.assertGreater(apply_isotonic(cal, 0.75), 0.5)

    def test_clamps_outside_training_range(self):
        cal = fit_isotonic([0.3, 0.4, 0.5, 0.6], [0, 0, 1, 1])
        self.assertEqual(apply_isotonic(cal, -5.0),
                         apply_isotonic(cal, 0.30))
        self.assertEqual(apply_isotonic(cal, 9.0),
                         apply_isotonic(cal, 0.60))

    def test_deterministic(self):
        x = [0.2, 0.5, 0.1, 0.9, 0.4, 0.7]
        y = [0, 1, 0, 1, 0, 1]
        self.assertEqual(fit_isotonic(x, y), fit_isotonic(x, y))

    def test_fit_uses_only_passed_data_no_leak(self):
        """Calibrator fit on a PRIOR slice must be byte-identical whether
        or not future rows exist — the caller controls the slice; this
        asserts fit() has no hidden global/state dependence."""
        prior_x = [0.1, 0.2, 0.3, 0.4, 0.5]
        prior_y = [0, 0, 1, 0, 1]
        c1 = fit_isotonic(prior_x, prior_y)
        # building a calibrator from prior only, then more data later,
        # must NOT retroactively change the prior calibrator object
        c2 = fit_isotonic(prior_x, prior_y)
        _future = fit_isotonic(prior_x + [0.99, 0.01], prior_y + [1, 0])
        self.assertEqual(c1, c2)
        self.assertEqual(apply_isotonic(c1, 0.35), apply_isotonic(c2, 0.35))

    def test_degenerate_inputs(self):
        self.assertEqual(apply_isotonic(fit_isotonic([], []), 0.5), 0.5)
        one = fit_isotonic([0.4], [1])
        self.assertTrue(0.0 <= apply_isotonic(one, 0.4) <= 1.0)


if __name__ == "__main__":
    unittest.main()
