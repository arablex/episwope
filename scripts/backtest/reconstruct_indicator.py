"""Causal reconstruction of the shipped dengue indicator.

For an evaluation date t, S is computed using ONLY climate days < t,
exactly mirroring climate_signals.py's older/recent split. The Mordecai
curve is fixed constants (no fitting) so there is zero training leakage.
Monthly alignment: month value = MAX of that month's weekly S (declared
a priori in the spec).
"""
import sys
from datetime import date, timedelta

sys.path.insert(0, "scripts")
from _shared.pathogen_suitability import dengue_suitability

RECENT_DAYS = 14      # mirrors climate_signals.RECENT_DAYS
MIN_BASE_DAYS = 35    # mirrors climate_signals.MIN_BASE_DAYS
BASELINE_KEEP = 120   # mirrors climate_signals.BASELINE_KEEP


def _mean_sd(xs):
    if not xs:
        return 0.0, 1.0
    m = sum(xs) / len(xs)
    sd = (sum((x - m) ** 2 for x in xs) / len(xs)) ** 0.5
    return m, (sd if sd > 1e-6 else 1.0)


def s_on_date(series, t):
    """S_dengue as it WOULD have been known on date t (days < t only)."""
    cutoff = t.isoformat()
    hist = [r for r in series if r["d"] < cutoff][-BASELINE_KEEP:]
    if len(hist) < RECENT_DAYS + 7:
        return None
    recent = hist[-RECENT_DAYS:]
    older = hist[:-RECENT_DAYS]
    ref = older if older else hist
    if len(ref) < 7:
        return None
    tm, tsd = _mean_sd([x["t"] for x in ref])
    pm, psd = _mean_sd([x["p"] for x in ref])
    t_recent = sum(x["t"] for x in recent) / len(recent)
    p_recent = sum(x["p"] for x in recent) / len(recent)
    zT = (t_recent - tm) / tsd
    zP = (p_recent - pm) / psd
    return round(dengue_suitability(t_recent, zT, zP), 6)


def _weekly_eval_dates(series):
    if not series:
        return []
    d0 = date.fromisoformat(series[0]["d"])
    d1 = date.fromisoformat(series[-1]["d"])
    out, d = [], d0 + timedelta(days=RECENT_DAYS + 7)
    while d <= d1:
        out.append(d)
        d += timedelta(days=7)
    return out


def monthly_series(series):
    """{(year, month): max weekly S in that month}."""
    monthly = {}
    for d in _weekly_eval_dates(series):
        v = s_on_date(series, d)
        if v is None:
            continue
        k = (d.year, d.month)
        monthly[k] = max(monthly.get(k, 0.0), v)
    return monthly
