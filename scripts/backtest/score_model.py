"""Causal z-anomaly, offset-logistic MLE (numpy Newton/IRLS), and
proper-scoring metrics. Single covariate by design (thin sample).
logit(P0) enters as a FIXED offset; only beta is learned.
"""
import math

import numpy as np

MIN_Z_HISTORY = 24   # prior monthly points required for a trustworthy z


def causal_z(series, t_index):
    """z of series[t_index] vs STRICTLY-prior values; 0.0 if too short."""
    hist = list(series[:t_index])
    if len(hist) < MIN_Z_HISTORY:
        return 0.0
    mu = sum(hist) / len(hist)
    var = sum((x - mu) ** 2 for x in hist) / len(hist)
    sd = math.sqrt(var)
    if sd < 1e-6:
        sd = 1.0
    return (series[t_index] - mu) / sd


def fit_offset_logistic(X, y, offset, iters=50, ridge=1e-6):
    """MLE of beta in  P(y=1) = sigmoid(offset + X @ beta).

    Newton-Raphson / IRLS. No intercept (prior carries the level via
    offset). Deterministic. X: (n,k) ndarray, y/offset: (n,) arrays.
    """
    X = np.asarray(X, dtype=float)
    y = np.asarray(y, dtype=float)
    offset = np.asarray(offset, dtype=float)
    n, k = X.shape
    beta = np.zeros(k)
    for _ in range(iters):
        eta = offset + X @ beta
        p = 1.0 / (1.0 + np.exp(-np.clip(eta, -30, 30)))
        W = np.clip(p * (1.0 - p), 1e-9, None)
        grad = X.T @ (y - p)
        H = X.T @ (X * W[:, None]) + ridge * np.eye(k)
        step = np.linalg.solve(H, grad)
        beta = beta + step
        if np.max(np.abs(step)) < 1e-10:
            break
    return beta


def posterior(p0, z_row, beta):
    """sigmoid(logit(p0) + z_row . beta) — scalar p0, vectors z_row/beta."""
    p0 = min(max(float(p0), 1e-9), 1 - 1e-9)
    logit0 = math.log(p0 / (1.0 - p0))
    s = logit0 + sum(zi * bi for zi, bi in zip(z_row, beta))
    s = max(-30.0, min(30.0, s))
    return 1.0 / (1.0 + math.exp(-s))


def pr_auc(y, scores):
    """Average precision (PR-AUC). Deterministic; tied scores grouped (standard AP)."""
    pairs = sorted(zip(scores, range(len(y))), key=lambda t: (-t[0], t[1]))
    P = sum(y)
    if P == 0:
        return 0.0
    tp = 0
    fp = 0
    ap = 0.0
    prev_recall = 0.0
    i = 0
    m = len(pairs)
    while i < m:
        j = i
        while j < m and pairs[j][0] == pairs[i][0]:
            j += 1
        for sc, idx in pairs[i:j]:
            if y[idx] == 1:
                tp += 1
            else:
                fp += 1
        recall = tp / P
        precision = tp / (tp + fp)
        ap += precision * (recall - prev_recall)
        prev_recall = recall
        i = j
    return ap


def brier(y, scores):
    return sum((s - yi) ** 2 for s, yi in zip(scores, y)) / len(y)
