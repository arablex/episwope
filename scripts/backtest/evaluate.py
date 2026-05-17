"""Detection metrics, baselines, and block-bootstrap CIs.

An alarm at (y,m) "covers" an onset if it falls within the window
[onset - horizon_months, onset month]. TSS = POD - FAR_rate
(True Skill Statistic / Peirce). Lead time in weeks.
"""
import random
import statistics


def _months_between(a, b):
    return (b[0] - a[0]) * 12 + (b[1] - a[1])


def _covered(onsets, alarms, horizon_months):
    hit = set()
    for o in onsets:
        for a in alarms:
            d = _months_between(a, o)
            if 0 <= d <= horizon_months:
                hit.add(o)
                break
    return hit


def pod(ym, onsets, alarms, horizon_months):
    if not onsets:
        return 0.0
    return len(_covered(onsets, alarms, horizon_months)) / len(onsets)


def far_rate(ym, onsets, alarms, horizon_months):
    """Fraction of non-onset-window months that fired an alarm."""
    onset_windows = set()
    for o in onsets:
        for k in range(horizon_months + 1):
            onset_windows.add((o[0] + (o[1] - 1 - k) // 12,
                               (o[1] - 1 - k) % 12 + 1))
    negatives = [k for k in ym if k not in onset_windows]
    if not negatives:
        return 0.0
    false_fires = sum(1 for k in negatives if k in alarms)
    return false_fires / len(negatives)


def tss(ym, onsets, alarms, horizon_months):
    return round(pod(ym, onsets, alarms, horizon_months)
                 - far_rate(ym, onsets, alarms, horizon_months), 6)


def lead_times(onsets, alarms, horizon_months):
    """Weeks between the EARLIEST covering alarm and each onset month."""
    out = []
    for o in onsets:
        cands = [_months_between(a, o) for a in alarms
                 if 0 <= _months_between(a, o) <= horizon_months]
        if cands:
            out.append(max(cands) * 4.345)   # months → weeks
    return out


def seasonal_alarms(ym, onsets):
    """Baseline: alarm every month that was EVER an onset month (by m)."""
    onset_months = {m for (_y, m) in onsets}
    return {(y, m) for (y, m) in ym if m in onset_months}


def persistence_alarms(ym, onsets):
    """Baseline: alarm the month AFTER any onset (tomorrow == yesterday)."""
    out = set()
    for (y, m) in onsets:
        nm = (y + (m // 12), m % 12 + 1)
        out.add(nm)
    return out


def random_alarms(ym, rate, seed):
    rng = random.Random(seed)
    return {k for k in ym if rng.random() < rate}


def block_bootstrap_ci(block_values, seed=1234, n=2000, alpha=0.05):
    """Resample (country,year) block statistics with replacement."""
    if not block_values:
        return (0.0, 0.0)
    rng = random.Random(seed)
    k = len(block_values)
    means = []
    for _ in range(n):
        sample = [block_values[rng.randrange(k)] for _ in range(k)]
        means.append(sum(sample) / k)
    means.sort()
    lo = means[int(alpha / 2 * n)]
    hi = means[int((1 - alpha / 2) * n) - 1]
    return (round(lo, 6), round(hi, 6))
