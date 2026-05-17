"""Pure pathogen-suitability functions.

Single source of truth: imported by scripts/climate_signals.py (live)
AND scripts/backtest/* (validation). Mordecai et al. 2017 eLife
Aedes/DENV thermal response — fixed literature constants, never fitted.
"""
import math

_AE_TMIN, _AE_TMAX = 17.8, 34.6


def clip01(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def _briere(t, t0=_AE_TMIN, tm=_AE_TMAX):
    return 0.0 if (t <= t0 or t >= tm) else t * (t - t0) * math.sqrt(tm - t)


_AE_PEAK = max(_briere(x / 10.0)
               for x in range(int(_AE_TMIN * 10), int(_AE_TMAX * 10)))


def thermal_aedes(t):
    """Normalised Mordecai-2017 Aedes/DENV thermal suitability (0–1)."""
    return max(0.0, min(1.0, _briere(t) / _AE_PEAK))


def dengue_suitability(t_recent, zT, zP):
    """S_dengue = thermal suitability + lagged precip/temp anomaly push.

    Identical to the original inline climate_signals.py formula.
    """
    g = thermal_aedes(t_recent)
    return clip01(0.55 * g + 0.30 * clip01(zP / 2.0) + 0.15 * clip01(zT / 2.0))
