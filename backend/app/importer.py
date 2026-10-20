"""Import the paint catalog from github.com/Arcturus5404/miniature-paints (MIT licence).

Usage:
    python -m app.importer                 # download from GitHub
    python -m app.importer --source DIR    # use a local copy of the repository's paints/ folder
    python -m app.importer --all-brands    # import every brand, not only those in catalog.py

The import is idempotent: paints are matched on (brand, name, range) and only
updated. Colours changed by hand in the app are never overwritten.
"""

from __future__ import annotations

import argparse
import io
import logging
import tarfile
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog import BRANDS, BrandConfig, clean_range, fallback_brand, infer_type
from app.color import rgb_hue, rgb_to_hex, rgb_to_lab
from app.config import settings
from app.db import SessionLocal
from app.models import Brand, Paint

log = logging.getLogger("paintslib.importer")


@dataclass
class ParsedPaint:
    name: str
    range_name: str
    code: str | None
    r: int
    g: int
    b: int
    discontinued: bool


@dataclass
class ImportResult:
    brands: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    per_brand: dict[str, int] = field(default_factory=dict)


def parse_markdown(text: str) -> list[ParsedPaint]:
    """Parse one brand file: a markdown table with Name, [Code], [Set], R, G, B, Hex."""
    paints: list[ParsedPaint] = []
    header: list[str] | None = None
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if header is None:
            header = [c.lower() for c in cells]
            continue
        if set(line) <= set("|-: "):
            continue  # separator row
        row = dict(zip(header, cells, strict=False))
        try:
            r, g, b = int(row["r"]), int(row["g"]), int(row["b"])
        except (KeyError, ValueError):
            continue
        name = row.get("name", "").strip()
        if not name or not all(0 <= v <= 255 for v in (r, g, b)):
            continue
        range_name, discontinued = clean_range(row.get("set", "") or "")
        code = (row.get("code") or "").strip()
        paints.append(
            ParsedPaint(
                name=name,
                range_name=range_name,
                code=None if code.lower() in ("", "null", "none") else code,
                r=r,
                g=g,
                b=b,
                discontinued=discontinued,
            )
        )
    return paints


def load_source(source: Path | None) -> dict[str, str]:
    """Return {file_stem: markdown} for every brand file in the source."""
    if source is not None:
        folder = source / "paints" if (source / "paints").is_dir() else source
        return {p.stem: p.read_text(encoding="utf-8") for p in sorted(folder.glob("*.md"))}

    log.info("Downloading catalog from %s", settings.catalog_url)
    resp = httpx.get(settings.catalog_url, follow_redirects=True, timeout=60)
    resp.raise_for_status()
    files: dict[str, str] = {}
    with tarfile.open(fileobj=io.BytesIO(resp.content), mode="r:gz") as tar:
        for member in tar.getmembers():
            parts = Path(member.name).parts
            if member.isfile() and len(parts) >= 2 and parts[-2] == "paints" and member.name.endswith(".md"):
                fh = tar.extractfile(member)
                if fh is not None:
                    files[Path(member.name).stem] = fh.read().decode("utf-8")
    return files


def _brand_for(stem: str, all_brands: bool) -> BrandConfig | None:
    if stem in BRANDS:
        return BRANDS[stem]
    return fallback_brand(stem) if all_brands else None


def import_catalog(session: Session, files: dict[str, str], all_brands: bool = False) -> ImportResult:
    result = ImportResult()
    for stem, text in files.items():
        config = _brand_for(stem, all_brands)
        if config is None:
            continue
        brand = session.scalar(select(Brand).where(Brand.slug == config.slug))
        if brand is None:
            brand = Brand(slug=config.slug, name=config.name)
            session.add(brand)
            session.flush()
        else:
            brand.name = config.name

        existing = {
            (p.name, p.range_name): p for p in session.scalars(select(Paint).where(Paint.brand_id == brand.id))
        }
        count = 0
        for item in parse_markdown(text):
            if not config.include_range(item.range_name):
                continue
            paint = existing.get((item.name, item.range_name))
            if paint is not None and paint.source == "user":
                result.skipped += 1  # colour was edited by hand; keep it
                continue
            if paint is None:
                paint = Paint(brand_id=brand.id, name=item.name, range_name=item.range_name, source="miniature-paints")
                session.add(paint)
                existing[(item.name, item.range_name)] = paint
                result.created += 1
            else:
                result.updated += 1
            paint.code = item.code
            paint.r, paint.g, paint.b = item.r, item.g, item.b
            paint.hex = rgb_to_hex(item.r, item.g, item.b)
            paint.lab_l, paint.lab_a, paint.lab_b = rgb_to_lab(item.r, item.g, item.b)
            paint.hue = rgb_hue(item.r, item.g, item.b)
            paint.type = infer_type(item.range_name, item.name)
            paint.discontinued = item.discontinued
            count += 1
        result.per_brand[config.name] = count
        result.brands += 1
        session.commit()
    return result


# --- background import used by the "update catalog" button in the app -----------------

_state: dict = {"running": False, "finished_at": None, "result": None, "error": None}
_state_lock = threading.Lock()


def import_status() -> dict:
    with _state_lock:
        return dict(_state)


def run_import(source: Path | None = None, all_brands: bool | None = None) -> ImportResult:
    with _state_lock:
        if _state["running"]:
            raise RuntimeError("Import is already running")
        _state.update(running=True, error=None)
    try:
        files = load_source(source)
        with SessionLocal() as session:
            result = import_catalog(
                session, files, settings.import_all_brands if all_brands is None else all_brands
            )
        with _state_lock:
            _state["result"] = result.__dict__
        log.info("Catalog import finished: %s", result)
        return result
    except Exception as exc:
        with _state_lock:
            _state["error"] = str(exc)
        log.exception("Catalog import failed")
        raise
    finally:
        with _state_lock:
            _state.update(running=False, finished_at=datetime.now(timezone.utc).isoformat())


def start_background_import() -> bool:
    if import_status()["running"]:
        return False

    def _target() -> None:
        try:
            run_import()
        except Exception:  # noqa: BLE001 - already logged and stored in _state
            pass

    threading.Thread(target=_target, daemon=True, name="catalog-import").start()
    return True


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Import the miniature paint catalog")
    parser.add_argument("--source", type=Path, help="Local folder with the brand .md files")
    parser.add_argument("--all-brands", action="store_true", help="Import every brand from the source")
    args = parser.parse_args()
    result = run_import(args.source, args.all_brands or None)
    for name, count in sorted(result.per_brand.items()):
        print(f"  {name:<22} {count:>5} paints")
    print(f"Done: {result.created} new, {result.updated} updated, {result.skipped} kept (edited by hand).")


if __name__ == "__main__":
    main()
