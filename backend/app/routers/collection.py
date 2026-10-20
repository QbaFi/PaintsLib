"""CSV import/export of the user's collection."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.collection_import import TEMPLATE_CSV, CatalogIndex, CatalogPaint, parse_csv
from app.db import get_session
from app.models import Brand, InventoryItem, Paint, PaintEquivalent
from app.schemas import PaintOut
from app.services import paint_out

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

Match = Literal["exact", "fuzzy", "not_found", "unknown_brand", "invalid"]
Action = Literal["added", "updated", "unchanged", "skipped"]


class ImportRequest(BaseModel):
    csv: str
    dry_run: bool = True


class ConversionOut(BaseModel):
    name: str
    match: Match
    paint: PaintOut | None = None


class ImportRowOut(BaseModel):
    line: int
    brand: str
    series: str
    name: str
    match: Match
    action: Action
    paint: PaintOut | None = None
    suggestion: PaintOut | None = None
    error: str | None = None
    conversions: list[ConversionOut] = []


class ImportSummary(BaseModel):
    rows: int
    added: int
    updated: int
    unchanged: int
    skipped: int
    fuzzy: int
    equivalents_added: int
    unknown_columns: list[str]


class ImportReport(BaseModel):
    dry_run: bool
    summary: ImportSummary
    rows: list[ImportRowOut]


@router.get("/template.csv", include_in_schema=False)
def import_template() -> Response:
    return Response(
        TEMPLATE_CSV,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="paintslib-template.csv"'},
    )


def _build_index(session: Session) -> CatalogIndex:
    rows = session.execute(
        select(Paint.id, Brand.slug, Brand.name, Paint.name, Paint.range_name, Paint.type, Paint.discontinued).join(
            Brand
        )
    ).all()
    return CatalogIndex(CatalogPaint(*r) for r in rows)


def _equivalent_exists(session: Session, a: int, b: int) -> bool:
    return (
        session.scalar(
            select(PaintEquivalent.paint_id).where(
                or_(
                    (PaintEquivalent.paint_id == a) & (PaintEquivalent.equivalent_paint_id == b),
                    (PaintEquivalent.paint_id == b) & (PaintEquivalent.equivalent_paint_id == a),
                )
            )
        )
        is not None
    )


@router.post("/import", response_model=ImportReport)
def import_collection(data: ImportRequest, session: Session = Depends(get_session)) -> ImportReport:
    """Import a collection CSV. With dry_run=true nothing is saved - the report is a preview."""
    rows, unknown_columns = parse_csv(data.csv)
    index = _build_index(session)
    existing = {i.paint_id: i for i in session.scalars(select(InventoryItem))}
    planned: dict[int, tuple[int, str]] = {pid: (i.quantity, i.status) for pid, i in existing.items()}
    new_pairs: set[tuple[int, int]] = set()

    def out(paint_id: int | None) -> PaintOut | None:
        return paint_out(session.get(Paint, paint_id)) if paint_id else None

    report: list[ImportRowOut] = []
    for row in rows:
        result = ImportRowOut(
            line=row.line, brand=row.brand, series=row.series, name=row.name, match="invalid", action="skipped"
        )
        report.append(result)
        if row.error:
            result.error = row.error
            continue
        slug = index.resolve_brand(row.brand)
        if slug is None:
            result.match = "unknown_brand"
            continue
        paint, how, suggestion = index.find(slug, row.name, row.series)
        result.match = how  # type: ignore[assignment]
        if paint is None:
            result.suggestion = out(suggestion.id) if suggestion else None
            continue
        result.paint = out(paint.id)

        # Collection entry: new rows default to 1 owned paint; existing rows only change given fields.
        before = planned.get(paint.id)
        status = row.status or (before[1] if before else "full")
        if row.quantity is not None:
            quantity = row.quantity
        elif before:
            quantity = before[0] if not (before[1] == "wishlist" and status != "wishlist") else max(before[0], 1)
        else:
            quantity = 0 if status == "wishlist" else 1
        planned[paint.id] = (quantity, status)
        result.action = "added" if before is None else ("unchanged" if before == (quantity, status) else "updated")

        if not data.dry_run and result.action != "unchanged":
            item = existing.get(paint.id)
            if item is None:
                item = InventoryItem(paint_id=paint.id, quantity=quantity, status=status, tags="")
                session.add(item)
                existing[paint.id] = item
            else:
                item.quantity, item.status = quantity, status

        # The user's own conversions become curated equivalents (Citadel names are looked up first).
        for name in row.conversion:
            target, conv_how = index.find_any_brand(name, ["citadel"])
            conv = ConversionOut(name=name, match=conv_how)  # type: ignore[arg-type]
            result.conversions.append(conv)
            if target is None or target.id == paint.id:
                continue
            conv.paint = out(target.id)
            pair = (min(paint.id, target.id), max(paint.id, target.id))
            if pair in new_pairs or _equivalent_exists(session, *pair):
                continue
            new_pairs.add(pair)
            if not data.dry_run:
                session.add(PaintEquivalent(paint_id=paint.id, equivalent_paint_id=target.id, note="CSV import"))

    if not data.dry_run:
        session.commit()

    summary = ImportSummary(
        rows=len(report),
        added=sum(r.action == "added" for r in report),
        updated=sum(r.action == "updated" for r in report),
        unchanged=sum(r.action == "unchanged" for r in report),
        skipped=sum(r.action == "skipped" for r in report),
        fuzzy=sum(r.match == "fuzzy" for r in report) + sum(c.match == "fuzzy" for r in report for c in r.conversions),
        equivalents_added=len(new_pairs),
        unknown_columns=unknown_columns,
    )
    return ImportReport(dry_run=data.dry_run, summary=summary, rows=report)
