"""WHO endemic-channel outbreak labeling.

For (country, month m, year Y): threshold = mean + 2*SD of month-m
counts over PRIOR years (>= MIN_PRIOR_YEARS required, else Y excluded).
An onset = the FIRST month in season Y whose cases exceed its threshold.
"""
MIN_PRIOR_YEARS = 3


def _mean_sd(xs):
    n = len(xs)
    m = sum(xs) / n
    sd = (sum((x - m) ** 2 for x in xs) / n) ** 0.5
    return m, sd


def onsets(rows):
    """rows: [{iso2,year,month,cases}] → {iso2: {onsets:set, evaluated_year_months:list}}."""
    by_iso = {}
    for r in rows:
        by_iso.setdefault(r["iso2"], {})[(r["year"], r["month"])] = r["cases"]

    result = {}
    for iso, ym in by_iso.items():
        years = sorted({y for (y, _m) in ym})
        onset_set, evaluated = set(), []
        for y in years:
            season_hit = False
            for m in range(1, 13):
                if (y, m) not in ym:
                    continue
                prior = [ym[(py, m)] for py in years
                         if py < y and (py, m) in ym]
                if len(prior) < MIN_PRIOR_YEARS:
                    continue
                evaluated.append((y, m))
                mean, sd = _mean_sd(prior)
                threshold = mean + 2 * sd
                if ym[(y, m)] > threshold and not season_hit:
                    onset_set.add((y, m))
                    season_hit = True
        result[iso] = {"onsets": onset_set,
                       "evaluated_year_months": sorted(evaluated)}
    return result
