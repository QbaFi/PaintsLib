"""Which brands/ranges are imported, and how a source "Set" maps to a paint type.

Edit BRANDS to change what ends up in the catalog. Set IMPORT_ALL_BRANDS=true
in .env to import every brand from the source instead.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass(frozen=True)
class BrandConfig:
    slug: str
    name: str
    # Return True for ranges (source "Set" column) that should be imported.
    include_range: Callable[[str], bool] = field(default=lambda _r: True)


BRANDS: dict[str, BrandConfig] = {
    # key = file name (without .md) in the miniature-paints repository
    "Citadel_Colour": BrandConfig("citadel", "Citadel"),
    "Vallejo": BrandConfig(
        "vallejo",
        "Vallejo",
        include_range=lambda r: r.lower().startswith(("game color", "xpress color", "model color")),
    ),
    "Army_Painter": BrandConfig("army-painter", "The Army Painter"),
    "AK": BrandConfig("ak", "AK Interactive"),
    "GreenStuffWorld": BrandConfig("green-stuff-world", "Green Stuff World"),
}


def fallback_brand(file_stem: str) -> BrandConfig:
    """Brand config for files not listed above (used with IMPORT_ALL_BRANDS)."""
    name = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", file_stem.replace("_", " ")).strip()
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return BrandConfig(slug, name)


# Order matters: the first rule whose keyword appears in the range name wins.
_RANGE_RULES: list[tuple[tuple[str, ...], str]] = [
    (("contrast", "speedpaint", "xpress", "dipping"), "contrast"),
    (("wash", "shade", "tone", "glaze", "ink", "quickshade"), "shade"),
    (("primer", "spray", "surface"), "primer"),
    (("dry",), "dry"),
    (("technical", "special fx", "texture", "effect", "weathering", "chameleon", "fluor"), "technical"),
    (("air",), "air"),
    (("metal",), "metallic"),
    (("layer",), "layer"),
]

_METAL_WORDS = re.compile(
    r"\b(gold|silver|bronze|brass|copper|steel|iron|metal|metallic|chrome|gunmetal|leadbelcher|"
    r"retributor|balthasar|runefang|stormhost|sycorax|auric|liberator|gehenna|ironbreaker)\b",
    re.IGNORECASE,
)


def infer_type(range_name: str, paint_name: str) -> str:
    r = range_name.lower()
    paint_type = "base"
    for keywords, value in _RANGE_RULES:
        if any(k in r for k in keywords):
            paint_type = value
            break
    if paint_type in ("base", "layer") and _METAL_WORDS.search(paint_name):
        return "metallic"
    return paint_type


def clean_range(range_name: str) -> tuple[str, bool]:
    """Strip the '(discontinued)' marker and report whether it was there."""
    discontinued = "discontinued" in range_name.lower()
    cleaned = re.sub(r"\s*\(discontinued\)\s*", " ", range_name, flags=re.IGNORECASE).strip()
    return cleaned, discontinued
