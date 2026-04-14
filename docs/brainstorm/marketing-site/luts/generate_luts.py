#!/usr/bin/env python3
"""
Generates four .cube LUTs matching the SVG filter grades in grading-comparison.html.

The math replicates feColorMatrix (channel mix + offset) followed by
feComponentTransfer (5-point tableValues with linear interpolation) followed
by feColorMatrix type="saturate" (luminance-preserving saturation mix).

These are Rec.709 display-space LUTs — apply them to footage already in
Rec.709 / sRGB. For log footage, apply a log-to-Rec.709 transform first.

LUT size: 33 (standard), 35,937 entries per file.

Output: one .cube per grade, written next to this script.
"""

from pathlib import Path

LUT_SIZE = 33

# ---- Grade definitions (exact match to SVG filters in grading-comparison.html) ----

GRADES = {
    "A_WarmFilmic": {
        "title": "SuperBad A — Warm Filmic (Portra 400)",
        "matrix": [
            [1.05, 0.00, 0.00, 0.02],
            [0.00, 0.98, 0.00, 0.01],
            [0.00, 0.00, 0.92, -0.01],
        ],
        "curve_r": [0.06, 0.25, 0.50, 0.78, 0.96],
        "curve_g": [0.05, 0.24, 0.50, 0.78, 0.95],
        "curve_b": [0.04, 0.22, 0.48, 0.74, 0.92],
        "saturation": 0.92,
    },
    "B_70sWarmFade": {
        "title": "SuperBad B — 70s Warm Fade",
        "matrix": [
            [1.08, 0.02, 0.00, 0.05],
            [0.01, 1.02, 0.00, 0.03],
            [0.00, 0.00, 0.85, -0.02],
        ],
        "curve_r": [0.16, 0.32, 0.52, 0.72, 0.88],
        "curve_g": [0.14, 0.30, 0.50, 0.70, 0.85],
        "curve_b": [0.11, 0.25, 0.44, 0.62, 0.78],
        "saturation": 0.72,
    },
    "C_WarmNeutralCinematic": {
        "title": "SuperBad C — Warm-Neutral Cinematic",
        "matrix": [
            [1.03, 0.00, 0.00, 0.01],
            [0.00, 1.00, 0.00, 0.00],
            [0.00, 0.00, 0.97, -0.005],
        ],
        "curve_r": [0.01, 0.18, 0.48, 0.82, 1.00],
        "curve_g": [0.00, 0.16, 0.46, 0.80, 0.99],
        "curve_b": [0.00, 0.15, 0.44, 0.76, 0.95],
        "saturation": 0.95,
    },
    "D_Documentary": {
        "title": "SuperBad D — Documentary (neutral counterpart)",
        "matrix": [
            [0.98, 0.00, 0.00, 0.00],
            [0.00, 0.99, 0.00, 0.00],
            [0.00, 0.00, 1.02, 0.005],
        ],
        "curve_r": [0.03, 0.22, 0.48, 0.74, 0.93],
        "curve_g": [0.03, 0.22, 0.48, 0.74, 0.94],
        "curve_b": [0.04, 0.24, 0.50, 0.76, 0.96],
        "saturation": 0.78,
    },
}


def clamp(v):
    return max(0.0, min(1.0, v))


def apply_matrix(r, g, b, m):
    rr = m[0][0]*r + m[0][1]*g + m[0][2]*b + m[0][3]
    gg = m[1][0]*r + m[1][1]*g + m[1][2]*b + m[1][3]
    bb = m[2][0]*r + m[2][1]*g + m[2][2]*b + m[2][3]
    return clamp(rr), clamp(gg), clamp(bb)


def apply_curve(v, table):
    """5-stop linear-interpolated curve, matching SVG feFuncR type='table'."""
    n = len(table) - 1  # 4
    x = v * n
    i = int(x)
    if i >= n:
        return clamp(table[n])
    t = x - i
    return clamp(table[i] * (1 - t) + table[i + 1] * t)


def apply_saturation(r, g, b, s):
    """feColorMatrix type='saturate' — Rec.709 luminance-preserving."""
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return (
        clamp(lum + s * (r - lum)),
        clamp(lum + s * (g - lum)),
        clamp(lum + s * (b - lum)),
    )


def process(r, g, b, grade):
    r, g, b = apply_matrix(r, g, b, grade["matrix"])
    r = apply_curve(r, grade["curve_r"])
    g = apply_curve(g, grade["curve_g"])
    b = apply_curve(b, grade["curve_b"])
    r, g, b = apply_saturation(r, g, b, grade["saturation"])
    return r, g, b


def write_cube(path: Path, grade_name: str, grade: dict):
    lines = []
    lines.append(f'TITLE "{grade["title"]}"')
    lines.append(f"LUT_3D_SIZE {LUT_SIZE}")
    lines.append("DOMAIN_MIN 0.0 0.0 0.0")
    lines.append("DOMAIN_MAX 1.0 1.0 1.0")
    lines.append("")
    # .cube convention: R varies fastest, then G, then B.
    step = 1.0 / (LUT_SIZE - 1)
    for bi in range(LUT_SIZE):
        for gi in range(LUT_SIZE):
            for ri in range(LUT_SIZE):
                r, g, b = process(ri * step, gi * step, bi * step, grade)
                lines.append(f"{r:.6f} {g:.6f} {b:.6f}")
    path.write_text("\n".join(lines) + "\n")


def main():
    here = Path(__file__).resolve().parent
    for name, grade in GRADES.items():
        out = here / f"{name}.cube"
        write_cube(out, name, grade)
        print(f"wrote {out.name}  ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
