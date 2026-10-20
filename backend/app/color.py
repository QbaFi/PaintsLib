"""Colour science helpers: sRGB -> CIE L*a*b* (D65) and CIEDE2000 colour difference.

Implemented with numpy so a single colour can be compared against the whole
catalogue of a brand in one vectorised call.
"""

from __future__ import annotations

import colorsys
import re

import numpy as np

HEX_RE = re.compile(r"^#?([0-9a-fA-F]{6})$")

# D65 reference white
_XN, _YN, _ZN = 0.95047, 1.0, 1.08883


def normalize_hex(value: str) -> str:
    match = HEX_RE.match(value.strip())
    if not match:
        raise ValueError(f"Invalid hex colour: {value!r}")
    return "#" + match.group(1).upper()


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    h = normalize_hex(value)[1:]
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def rgb_to_lab(r: int, g: int, b: int) -> tuple[float, float, float]:
    rgb = np.array([r, g, b], dtype=float) / 255.0
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    x = lin @ np.array([0.4124564, 0.3575761, 0.1804375])
    y = lin @ np.array([0.2126729, 0.7151522, 0.0721750])
    z = lin @ np.array([0.0193339, 0.1191920, 0.9503041])

    def f(t: float) -> float:
        return t ** (1 / 3) if t > (6 / 29) ** 3 else t / (3 * (6 / 29) ** 2) + 4 / 29

    fx, fy, fz = f(x / _XN), f(y / _YN), f(z / _ZN)
    return float(116 * fy - 16), float(500 * (fx - fy)), float(200 * (fy - fz))


def rgb_hue(r: int, g: int, b: int) -> float:
    """Hue in degrees (0-360) used for sorting; greys get -1 so they sort first."""
    h, _l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return -1.0 if s < 0.08 else round(h * 360, 2)


def ciede2000(lab1: tuple[float, float, float], labs2: np.ndarray) -> np.ndarray:
    """CIEDE2000 difference between one Lab colour and an (N, 3) array of Lab colours."""
    labs2 = np.atleast_2d(np.asarray(labs2, dtype=float))
    L1, a1, b1 = (float(v) for v in lab1)
    L2, a2, b2 = labs2[:, 0], labs2[:, 1], labs2[:, 2]

    C1 = np.hypot(a1, b1)
    C2 = np.hypot(a2, b2)
    C_bar = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(C_bar**7 / (C_bar**7 + 25.0**7)))
    a1p = (1 + G) * a1
    a2p = (1 + G) * a2
    C1p = np.hypot(a1p, b1)
    C2p = np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360

    dLp = L2 - L1
    dCp = C2p - C1p
    dhp = h2p - h1p
    dhp = np.where(dhp > 180, dhp - 360, dhp)
    dhp = np.where(dhp < -180, dhp + 360, dhp)
    dhp = np.where(C1p * C2p == 0, 0.0, dhp)
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dhp / 2))

    Lbp = (L1 + L2) / 2
    Cbp = (C1p + C2p) / 2
    hsum = h1p + h2p
    hbp = np.where(
        C1p * C2p == 0,
        hsum,
        np.where(
            np.abs(h1p - h2p) <= 180,
            hsum / 2,
            np.where(hsum < 360, (hsum + 360) / 2, (hsum - 360) / 2),
        ),
    )
    T = (
        1
        - 0.17 * np.cos(np.radians(hbp - 30))
        + 0.24 * np.cos(np.radians(2 * hbp))
        + 0.32 * np.cos(np.radians(3 * hbp + 6))
        - 0.20 * np.cos(np.radians(4 * hbp - 63))
    )
    d_theta = 30 * np.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cbp**7 / (Cbp**7 + 25.0**7))
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / np.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -np.sin(np.radians(2 * d_theta)) * Rc

    return np.sqrt(
        (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
    )


def match_quality(delta_e: float) -> str:
    if delta_e < 2:
        return "near_identical"
    if delta_e < 5:
        return "close"
    if delta_e < 10:
        return "similar"
    return "distant"
