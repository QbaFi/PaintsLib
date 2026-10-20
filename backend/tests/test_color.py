import numpy as np
import pytest

from app.color import ciede2000, hex_to_rgb, match_quality, normalize_hex, rgb_to_lab

# Reference pairs from Sharma, Wu & Dalal (2005), "The CIEDE2000 colour-difference formula".
SHARMA_PAIRS = [
    ((50.0000, 2.6772, -79.7751), (50.0000, 0.0000, -82.7485), 2.0425),
    ((50.0000, 0.0000, 0.0000), (50.0000, -1.0000, 2.0000), 2.3669),
    ((50.0000, 2.5000, 0.0000), (73.0000, 25.0000, -18.0000), 27.1492),
    ((60.2574, -34.0099, 36.2677), (60.4626, -34.1751, 39.4387), 1.2644),
    ((22.7233, 20.0904, -46.6940), (23.0331, 14.9730, -42.5619), 2.0373),
    ((2.0776, 0.0795, -1.1350), (0.9033, -0.0636, -0.5514), 0.9082),
]


@pytest.mark.parametrize(("lab1", "lab2", "expected"), SHARMA_PAIRS)
def test_ciede2000_reference_pairs(lab1, lab2, expected):
    assert ciede2000(lab1, np.array([lab2]))[0] == pytest.approx(expected, abs=1e-4)


def test_ciede2000_is_vectorised_and_zero_for_identical():
    labs = np.array([[50, 0, 0], [50, 0, 0], [60, 10, 10]], dtype=float)
    result = ciede2000((50, 0, 0), labs)
    assert result.shape == (3,)
    assert result[0] == pytest.approx(0)
    assert result[2] > 5


def test_rgb_to_lab_known_values():
    assert rgb_to_lab(255, 255, 255) == pytest.approx((100.0, 0.0, 0.0), abs=0.05)
    assert rgb_to_lab(0, 0, 0) == pytest.approx((0.0, 0.0, 0.0), abs=0.05)
    assert rgb_to_lab(255, 0, 0) == pytest.approx((53.24, 80.09, 67.20), abs=0.05)


def test_hex_helpers():
    assert normalize_hex("1a2b3c") == "#1A2B3C"
    assert hex_to_rgb("#FF8000") == (255, 128, 0)
    with pytest.raises(ValueError):
        normalize_hex("#12345")


def test_match_quality_thresholds():
    assert match_quality(1.9) == "near_identical"
    assert match_quality(4.9) == "close"
    assert match_quality(9.9) == "similar"
    assert match_quality(10) == "distant"
