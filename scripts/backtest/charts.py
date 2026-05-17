"""Minimal dependency-free SVG charts (committed alongside the report)."""

W, H, PAD = 480, 360, 48


def _hdr(title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" '
            f'height="{H}" viewBox="0 0 {W} {H}" font-family="sans-serif">'
            f'<rect width="{W}" height="{H}" fill="#ffffff"/>'
            f'<text x="{W//2}" y="24" text-anchor="middle" '
            f'font-size="15" font-weight="700">{title}</text>')


def _axes():
    x0, y0, x1, y1 = PAD, H - PAD, W - PAD, PAD
    return (f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" '
            f'stroke="#888"/><line x1="{x0}" y1="{y0}" x2="{x0}" '
            f'y2="{y1}" stroke="#888"/>')


def roc_svg(points, title="ROC"):
    """points: list of (far, pod) in 0..1, sorted by far ascending."""
    x0, y0 = PAD, H - PAD
    sx, sy = (W - 2 * PAD), (H - 2 * PAD)
    pts = sorted(points)
    poly = " ".join(f"{x0 + p[0]*sx:.1f},{y0 - p[1]*sy:.1f}" for p in pts)
    diag = (f'<line x1="{x0}" y1="{y0}" x2="{x0+sx}" y2="{y0-sy}" '
            f'stroke="#ccc" stroke-dasharray="4"/>')
    return (_hdr(title) + _axes() + diag +
            f'<polyline fill="none" stroke="#0067D6" stroke-width="2" '
            f'points="{poly}"/>'
            f'<text x="{W//2}" y="{H-12}" text-anchor="middle" '
            f'font-size="12">false-alarm rate →</text></svg>')


def histogram_svg(values, bins=8, title="Histogram"):
    if not values:
        return (_hdr(title) +
                f'<text x="{W//2}" y="{H//2}" text-anchor="middle" '
                f'font-size="14" fill="#999">no data</text></svg>')
    lo, hi = min(values), max(values)
    if hi == lo:
        hi = lo + 1.0
    width = (hi - lo) / bins
    counts = [0] * bins
    for v in values:
        idx = min(int((v - lo) / width), bins - 1)
        counts[idx] += 1
    cmax = max(counts) or 1
    x0, y0 = PAD, H - PAD
    sx, sy = (W - 2 * PAD), (H - 2 * PAD)
    bw = sx / bins
    bars = []
    for i, c in enumerate(counts):
        bh = (c / cmax) * sy
        bars.append(
            f'<rect x="{x0 + i*bw:.1f}" y="{y0 - bh:.1f}" '
            f'width="{bw-2:.1f}" height="{bh:.1f}" fill="#0067D6"/>')
    return (_hdr(title) + _axes() + "".join(bars) +
            f'<text x="{W//2}" y="{H-12}" text-anchor="middle" '
            f'font-size="12">weeks ({lo:.0f}–{hi:.0f})</text></svg>')
