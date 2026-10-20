from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.color import match_quality
from app.matching import find_matches, type_group
from app.models import Brand, InventoryItem, Paint, PaintEquivalent
from app.schemas import BrandOut, MatchOut, PaintOut


def paint_out(paint: Paint, item: InventoryItem | None = None) -> PaintOut:
    item = item if item is not None else paint.inventory_item
    return PaintOut(
        id=paint.id,
        name=paint.name,
        range_name=paint.range_name,
        code=paint.code,
        hex=paint.hex,
        type=paint.type,
        discontinued=paint.discontinued,
        custom=paint.custom,
        brand=BrandOut(id=paint.brand.id, slug=paint.brand.slug, name=paint.brand.name),
        owned=item is not None and item.status != "wishlist",
        inventory_id=item.id if item else None,
        inventory_status=item.status if item else None,
        inventory_quantity=item.quantity if item else None,
    )


def get_brand(session: Session, slug: str) -> Brand:
    brand = session.scalar(select(Brand).where(Brand.slug == slug.lower()))
    if brand is None:
        raise HTTPException(404, f"Unknown brand: {slug}")
    return brand


def get_paint(session: Session, paint_id: int) -> Paint:
    paint = session.get(Paint, paint_id)
    if paint is None:
        raise HTTPException(404, "Paint not found")
    return paint


def curated_equivalents(session: Session, paint: Paint, brand_id: int | None = None) -> list[Paint]:
    """Curated pairs work both ways (A≈B means B≈A)."""
    forward = select(PaintEquivalent.equivalent_paint_id).where(PaintEquivalent.paint_id == paint.id)
    backward = select(PaintEquivalent.paint_id).where(PaintEquivalent.equivalent_paint_id == paint.id)
    ids = set(session.scalars(forward)) | set(session.scalars(backward))
    if not ids:
        return []
    query = select(Paint).where(Paint.id.in_(ids))
    if brand_id is not None:
        query = query.where(Paint.brand_id == brand_id)
    return list(session.scalars(query).unique())


def equivalents_for_brand(
    session: Session,
    paint: Paint,
    brand: Brand,
    *,
    limit: int = 3,
    same_type: bool = True,
    owned_first: bool = False,
) -> list[MatchOut]:
    results: list[MatchOut] = [
        MatchOut(paint=paint_out(p), delta_e=None, quality="curated")
        for p in curated_equivalents(session, paint, brand.id)
    ]
    exclude = {paint.id} | {m.paint.id for m in results}
    matches = find_matches(
        session,
        (paint.lab_l, paint.lab_a, paint.lab_b),
        brand.id,
        limit=max(limit - len(results), 0),
        group=type_group(paint.type) if same_type else None,
        exclude_ids=exclude,
        owned_first=owned_first,
    )
    # Fall back to any type if the group has no candidates (e.g. a brand without washes).
    if not matches and same_type and limit > len(results):
        matches = find_matches(
            session,
            (paint.lab_l, paint.lab_a, paint.lab_b),
            brand.id,
            limit=limit - len(results),
            exclude_ids=exclude,
            owned_first=owned_first,
        )
    by_id = {p.id: p for p in session.scalars(select(Paint).where(Paint.id.in_([m[0] for m in matches]))).unique()}
    for pid, delta in matches:
        results.append(
            MatchOut(paint=paint_out(by_id[pid]), delta_e=round(delta, 2), quality=match_quality(delta))
        )
    return results[:limit] if limit else results
