"""Import a paint collection from a CSV file (e.g. exported from Google Sheets or Excel).

Expected columns (header names are case-insensitive, English or Polish):

    Brand | Series | Colour | Conversion | Quantity | Status
    Marka | Seria  | Kolor  | Odpowiednik| Ilość    | Stan

Only Brand and Colour are required. "Conversion" holds the user's own
equivalent paint(s) - several can be separated with "/" - and is stored as
curated equivalents. The matching logic below is pure Python (no database) so
it can be unit tested and reused.
"""

from __future__ import annotations

import csv
import difflib
import io
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass, field

# --- normalisation -------------------------------------------------------------------

_WORD_SWAPS = {"gray": "grey", "color": "colour", "colors": "colours"}


def normalize(text: str) -> str:
    """Lowercase, strip accents/punctuation and unify spelling variants."""
    text = (text or "").replace("ł", "l").replace("Ł", "L")  # the only Polish letter NFKD cannot decompose
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"['’`]", "", text.lower())
    words = re.sub(r"[^a-z0-9.]+", " ", text).split()
    return " ".join(_WORD_SWAPS.get(w, w) for w in words)


BRAND_ALIASES = {
    "citadel": "citadel",
    "citadel colour": "citadel",
    "games workshop": "citadel",
    "gw": "citadel",
    "warhammer": "citadel",
    "vallejo": "vallejo",
    "acrylicos vallejo": "vallejo",
    "army painter": "army-painter",
    "the army painter": "army-painter",
    "tap": "army-painter",
    "ak": "ak",
    "ak interactive": "ak",
    "ak 3rd gen": "ak",
    "green stuff world": "green-stuff-world",
    "gsw": "green-stuff-world",
}

HEADER_ALIASES = {
    "brand": "brand",
    "marka": "brand",
    "producent": "brand",
    "series": "series",
    "range": "series",
    "line": "series",
    "seria": "series",
    "linia": "series",
    "colour": "name",
    "color": "name",
    "name": "name",
    "paint": "name",
    "kolor": "name",
    "nazwa": "name",
    "farba": "name",
    "conversion": "conversion",
    "equivalent": "conversion",
    "odpowiednik": "conversion",
    "konwersja": "conversion",
    "quantity": "quantity",
    "qty": "quantity",
    "ilosc": "quantity",
    "status": "status",
    "stan": "status",
}

STATUS_ALIASES = {
    "full": "full",
    "pelna": "full",
    "ok": "full",
    "low": "low",
    "konczy sie": "low",
    "malo": "low",
    "empty": "empty",
    "pusta": "empty",
    "wishlist": "wishlist",
    "to buy": "wishlist",
    "do kupienia": "wishlist",
    "kupic": "wishlist",
}

# Ranges that are a different product format; used only when nothing else matches.
_SECONDARY_TYPES = {"air", "primer"}


# --- catalog index -----------------------------------------------------------------------


@dataclass(frozen=True)
class CatalogPaint:
    id: int
    brand_slug: str
    brand_name: str
    name: str
    range_name: str
    type: str
    discontinued: bool


class CatalogIndex:
    def __init__(self, paints: Iterable[CatalogPaint]):
        self.by_brand: dict[str, dict[str, list[CatalogPaint]]] = {}
        self.brand_names: dict[str, str] = {}
        for p in paints:
            self.by_brand.setdefault(p.brand_slug, {}).setdefault(normalize(p.name), []).append(p)
            self.brand_names[normalize(p.brand_name)] = p.brand_slug
            self.brand_names[normalize(p.brand_slug.replace("-", " "))] = p.brand_slug

    def resolve_brand(self, brand: str) -> str | None:
        key = normalize(brand)
        return BRAND_ALIASES.get(key) or self.brand_names.get(key)

    def find(
        self, brand_slug: str, name: str, series: str = ""
    ) -> tuple[CatalogPaint | None, str, CatalogPaint | None]:
        """Return (paint, how, suggestion). `how` is "exact", "fuzzy" or "not_found"."""
        names = self.by_brand.get(brand_slug, {})
        key = normalize(name)
        if key in names:
            return self._best(names[key], series), "exact", None
        close = difflib.get_close_matches(key, list(names), n=1, cutoff=0.75)
        if not close:
            return None, "not_found", None
        best = self._best(names[close[0]], series)
        ratio = difflib.SequenceMatcher(None, key, close[0]).ratio()
        # Small typos are accepted automatically (and flagged); bigger differences are only suggested.
        return (best, "fuzzy", None) if ratio >= 0.9 else (None, "not_found", best)

    def find_any_brand(self, name: str, prefer: list[str]) -> tuple[CatalogPaint | None, str]:
        """Look a paint up by name only: preferred brands first, then every other brand."""
        order = prefer + [s for s in self.by_brand if s not in prefer]
        for slug in order:
            paint, how, _ = self.find(slug, name)
            if paint is not None and how == "exact":
                return paint, how
        for slug in prefer:
            paint, how, _ = self.find(slug, name)
            if paint is not None:
                return paint, how
        return None, "not_found"

    @staticmethod
    def _best(candidates: list[CatalogPaint], series: str) -> CatalogPaint:
        s = normalize(series)

        def rank(p: CatalogPaint) -> tuple:
            r = normalize(p.range_name)
            if not s:
                series_score = 1
            elif r == s:
                series_score = 0
            elif set(s.split()) <= set(r.split()) or set(r.split()) <= set(s.split()):
                series_score = 1
            elif s in r or (r and r in s):
                series_score = 2
            else:
                series_score = 3
            return (series_score, p.discontinued, p.type in _SECONDARY_TYPES, len(r), p.id)

        return min(candidates, key=rank)


# --- CSV parsing -----------------------------------------------------------------------


@dataclass
class CsvRow:
    line: int
    brand: str = ""
    series: str = ""
    name: str = ""
    conversion: list[str] = field(default_factory=list)
    quantity: int | None = None
    status: str | None = None
    error: str | None = None


def parse_csv(text: str) -> tuple[list[CsvRow], list[str]]:
    """Parse the uploaded CSV. Returns rows and a list of unrecognised header names."""
    text = text.lstrip("﻿")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    try:
        header = next(reader)
    except StopIteration:
        return [], []
    columns = [HEADER_ALIASES.get(normalize(h)) for h in header]
    unknown = [h.strip() for h, c in zip(header, columns, strict=False) if c is None and h.strip()]

    rows: list[CsvRow] = []
    for line_no, cells in enumerate(reader, start=2):
        values = {c: v.strip() for c, v in zip(columns, cells, strict=False) if c}
        if not any(values.values()):
            continue  # empty line
        row = CsvRow(
            line=line_no,
            brand=values.get("brand", ""),
            series=values.get("series", ""),
            name=values.get("name", ""),
            conversion=[c.strip() for c in re.split(r"[/;|]", values.get("conversion", "")) if c.strip()],
        )
        qty = values.get("quantity", "")
        if qty:
            try:
                row.quantity = max(int(float(qty.replace(",", "."))), 0)
            except ValueError:
                row.error = f"invalid quantity: {qty!r}"
        status = values.get("status", "")
        if status:
            row.status = STATUS_ALIASES.get(normalize(status))
            if row.status is None:
                row.error = f"unknown status: {status!r}"
        if not row.brand or not row.name:
            row.error = "missing brand or paint name"
        rows.append(row)
    return rows, unknown


TEMPLATE_CSV = (
    "Brand,Series,Colour,Conversion,Quantity,Status\n"
    "Citadel,Base,Mephiston Red,,1,full\n"
    "Vallejo,Game Color,Magic Blue,Macragge Blue,1,full\n"
    "Army Painter,Wash,Strong Tone,Agrax Earthshade,1,low\n"
    "Vallejo,Xpress Color,Velvet Red,,,wishlist\n"
)
