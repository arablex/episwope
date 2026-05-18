"""Isotonic probability calibration via Pool-Adjacent-Violators (PAVA).

Pure numpy, deterministic, no sklearn (numpy-only dependency fence).
The calibrator is a plain hashable/comparable structure ((xs, ys) or
None) so identical inputs yield equal calibrators. It is FIT ONLY on
whatever rows the caller passes — the Phase-2 backtest passes the
strictly-prior training window, so there is no lookahead by
construction (the caller controls the slice; fit() holds no state).
"""


def fit_isotonic(x, y):
    """Fit a non-decreasing step calibrator mapping score → prob.

    Returns ((xs...), (ys...)) of breakpoints, or None if no data.
    """
    if not x:
        return None
    pairs = sorted(zip(x, y, range(len(x))), key=lambda t: (t[0], t[2]))
    xs = [float(p[0]) for p in pairs]
    vals = [float(p[1]) for p in pairs]
    # PAVA: merge adjacent blocks while monotonicity is violated.
    blocks = []  # each: [sum, count]
    for v in vals:
        blocks.append([v, 1])
        while len(blocks) >= 2 and (blocks[-2][0] / blocks[-2][1]
                                    > blocks[-1][0] / blocks[-1][1]):
            s2, c2 = blocks.pop()
            blocks[-1][0] += s2
            blocks[-1][1] += c2
    fitted, i = [], 0
    for s, c in blocks:
        avg = s / c
        for _ in range(c):
            fitted.append(avg)
            i += 1
    return (tuple(xs), tuple(fitted))


def apply_isotonic(cal, v):
    """Map a score through the fitted calibrator (clamped to range)."""
    if cal is None:
        return float(v)
    xs, ys = cal
    if v <= xs[0]:
        return ys[0]
    if v >= xs[-1]:
        return ys[-1]
    # largest xs <= v (right-continuous step)
    lo, hi = 0, len(xs) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if xs[mid] <= v:
            lo = mid
        else:
            hi = mid - 1
    return ys[lo]
