"""Seasonal prior P0(region, month, year): Laplace-smoothed historical
onset frequency from STRICTLY-PRIOR years. No lookahead by construction
(only years < Y enter the estimate). Reuses MIN_PRIOR_YEARS discipline.
"""
from backtest.outbreaks import MIN_PRIOR_YEARS   # = 3

ALPHA = 1.0   # Beta(1,1) / Laplace
BETA = 1.0


def prior_points(onsets_by_iso):
    """onsets_by_iso: {iso: {onsets:set((y,m)), evaluated_year_months:list}}.

    Returns sorted list of dicts {iso, year, month, p0, y}, one per
    (iso, year, month) that has >= MIN_PRIOR_YEARS prior years of the
    SAME calendar month in evaluated_year_months. p0 is the Laplace
    prior from strictly-prior years; y is the actual 0/1 onset label
    for (iso, year, month).
    """
    out = []
    for iso, info in sorted(onsets_by_iso.items()):
        ev = sorted(set(info.get("evaluated_year_months") or []))
        onset = set(info.get("onsets") or [])
        for (Y, m) in ev:
            prior_years = [y for (y, mm) in ev if mm == m and y < Y]
            if len(prior_years) < MIN_PRIOR_YEARS:
                continue
            k = sum(1 for y in prior_years if (y, m) in onset)
            n = len(prior_years)
            p0 = (k + ALPHA) / (n + ALPHA + BETA)
            out.append({"iso": iso, "year": Y, "month": m,
                        "p0": p0, "y": 1 if (Y, m) in onset else 0})
    out.sort(key=lambda r: (r["iso"], r["year"], r["month"]))
    return out
