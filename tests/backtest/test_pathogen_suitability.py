import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))
from _shared.pathogen_suitability import clip01, thermal_aedes, dengue_suitability


# --- verbatim snapshot of the ORIGINAL inline formula (reference) ---
_AE_TMIN, _AE_TMAX = 17.8, 34.6


def _briere_ref(t, t0=_AE_TMIN, tm=_AE_TMAX):
    return 0.0 if (t <= t0 or t >= tm) else t * (t - t0) * math.sqrt(tm - t)


_AE_PEAK_REF = max(_briere_ref(x / 10.0)
                    for x in range(int(_AE_TMIN * 10), int(_AE_TMAX * 10)))


def _thermal_ref(t):
    return max(0.0, min(1.0, _briere_ref(t) / _AE_PEAK_REF))


def _clip_ref(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def _sd_ref(t_recent, zT, zP):
    g = _thermal_ref(t_recent)
    return _clip_ref(0.55 * g + 0.30 * _clip_ref(zP / 2.0)
                     + 0.15 * _clip_ref(zT / 2.0))
# --- end snapshot ---


class CharacterizationTest(unittest.TestCase):
    def test_clip01_matches(self):
        for v in (-3.0, -0.1, 0.0, 0.4, 1.0, 1.5):
            self.assertEqual(clip01(v), _clip_ref(v))

    def test_thermal_matches_on_grid(self):
        for x in range(100, 400):           # 10.0 .. 39.9 °C
            t = x / 10.0
            self.assertAlmostEqual(thermal_aedes(t), _thermal_ref(t), places=12)

    def test_dengue_suitability_matches_on_grid(self):
        for tx in range(150, 360, 5):       # 15.0 .. 35.5 °C
            for zT in (-2.0, -0.5, 0.0, 1.0, 3.0):
                for zP in (-2.0, 0.0, 1.5, 4.0):
                    t = tx / 10.0
                    self.assertAlmostEqual(
                        dengue_suitability(t, zT, zP),
                        _sd_ref(t, zT, zP), places=12)


if __name__ == "__main__":
    unittest.main()
