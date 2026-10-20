from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Select, and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.color import hex_to_rgb, match_quality, normalize_hex, rgb_hue, rgb_to_lab
from app.db import get_session
from app.matching import find_matches
from app.models import Brand, InventoryItem, Paint, PaintEquivalent
from app.schemas import (
    BrandOut,
    EquivalentCreate,
    MatchOut,
    PaintCreate,
    PaintOut,
    PaintPage,
    PaintUpdate,
)
from app.services import equivalents_for_brand, get_brand, get_paint, paint_out

router = APIRouter(prefix="/api", tags=["paints"])


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "brand"


def apply_colour(paint: Paint, hex_value: str) -> None:
    paint.hex = normalize_hex(hex_value)
    paint.r, paint.g, paint.b = hex_to_rgb(paint.hex)
    paint.lab_l, paint.lab_a, paint.lab_b = rgb_to_lab(paint.r, paint.g, paint.b)
    paint.hue = rgb_hue(paint.r, paint.g, paint.b)


@router.get("/brands", response_model=list[BrandOut])
def list_brands(session: Session = Depends(get_session)) -> list[BrandOut]:
    rows = session.execute(
        select(Brand, func.count(Paint.id))
        .join(Paint, Paint.brand_id == Brand.id)
        .group_by(Brand.id)
        .order_by(Brand.name)
    ).all()
    return [BrandOut(id=b.id, slug=b.slug, name=b.name, paint_count=c) for b, c in rows]


@router.get("/paints", response_model=PaintPage)
def search_paints(
    q: str | None = None,
    brand: str | None = Query(None, description="Brand slug(s), comma separated"),
    type: str | None = Query(None, description="Paint type(s), comma separated"),
    range_name: str | None = Query(None, alias="range"),
    owned: bool | None = None,
    include_discontinued: bool = False,
    sort: Literal["relevance", "name", "hue", "brand"] = "relevance",
    page: int = Query(1, ge=1),
    page_size: int = Query(60, ge=1, le=200),
    session: Session = Depends(get_session),
) -> PaintPage:
    query = select(Paint).join(Brand).outerjoin(InventoryItem)
    conditions = []
    text = (q or "").strip()

    if brand:
        conditions.append(Brand.slug.in_([b.strip().lower() for b in brand.split(",") if b.strip()]))
    if type:
        conditions.append(Paint.type.in_([t.strip() for t in type.split(",") if t.strip()]))
    if range_name:
        conditions.append(Paint.range_name.ilike(f"%{range_name}%"))
    if owned is True:
        conditions.append(and_(InventoryItem.id.is_not(None), InventoryItem.status != "wishlist"))
    elif owned is False:
        conditions.append(or_(InventoryItem.id.is_(None), InventoryItem.status == "wishlist"))
    if not include_discontinued:
        conditions.append(Paint.discontinued.is_(False))
    query = query.where(*conditions)

    if text:
        tokens = text.split()
        text_query = query.where(
            *[
                or_(Paint.name.ilike(f"%{t}%"), Brand.name.ilike(f"%{t}%"), Paint.code.ilike(f"%{t}%"))
                for t in tokens
            ]
        )
        total = _count(session, text_query)
        if total == 0:
            # Nothing contains the text: fall back to typo-tolerant matching ("abadon" -> "Abaddon Black").
            return _fuzzy_page(session, query, text, page, page_size)
        query = text_query
    else:
        total = _count(session, query)

    if sort == "relevance" and text:
        starts = case((Paint.name.ilike(f"{text}%"), 0), else_=1)
        query = query.order_by(starts, func.length(Paint.name), Paint.name)
    elif sort == "hue":
        query = query.order_by(Paint.hue, Paint.lab_l.desc())
    elif sort == "brand":
        query = query.order_by(Brand.name, Paint.name)
    else:
        query = query.order_by(Paint.name, Brand.name)

    paints = session.scalars(query.offset((page - 1) * page_size).limit(page_size)).unique().all()
    return PaintPage(items=[paint_out(p) for p in paints], total=total, page=page, page_size=page_size)


def _count(session: Session, query: Select) -> int:
    return session.scalar(select(func.count()).select_from(query.with_only_columns(Paint.id).subquery())) or 0


def _fuzzy_score(text: str, name: str) -> float:
    text, name = text.lower(), name.lower()
    whole = SequenceMatcher(None, text, name).ratio()
    words = name.split()
    n = len(text.split())
    # Compare against every run of words of the same length as the query.
    parts = [" ".join(words[i : i + n]) for i in range(max(len(words) - n + 1, 1))]
    return max([whole] + [SequenceMatcher(None, text, p).ratio() for p in parts])


def _fuzzy_page(session: Session, query: Select, text: str, page: int, page_size: int) -> PaintPage:
    rows = session.execute(query.with_only_columns(Paint.id, Paint.name)).all()
    scored = sorted(
        ((score, pid) for pid, name in rows if (score := _fuzzy_score(text, name)) >= 0.72),
        reverse=True,
    )
    ids = [pid for _score, pid in scored]
    page_ids = ids[(page - 1) * page_size : page * page_size]
    by_id = {p.id: p for p in session.scalars(select(Paint).where(Paint.id.in_(page_ids))).unique()}
    return PaintPage(
        items=[paint_out(by_id[i]) for i in page_ids], total=len(ids), page=page, page_size=page_size
    )


@router.get("/paints/{paint_id}", response_model=PaintOut)
def read_paint(paint_id: int, session: Session = Depends(get_session)) -> PaintOut:
    return paint_out(get_paint(session, paint_id))


@router.post("/paints", response_model=PaintOut, status_code=201)
def create_paint(data: PaintCreate, session: Session = Depends(get_session)) -> PaintOut:
    slug = slugify(data.brand_name)
    brand = session.scalar(select(Brand).where(Brand.slug == slug))
    if brand is None:
        brand = Brand(slug=slug, name=data.brand_name.strip())
        session.add(brand)
        session.flush()
    exists = session.scalar(
        select(Paint).where(
            Paint.brand_id == brand.id, Paint.name == data.name, Paint.range_name == data.range_name
        )
    )
    if exists:
        raise HTTPException(409, "Paint already exists in the catalog")
    paint = Paint(
        brand=brand,
        name=data.name.strip(),
        range_name=data.range_name.strip(),
        code=data.code,
        type=data.type,
        custom=True,
        source="user",
    )
    apply_colour(paint, data.hex)
    session.add(paint)
    session.commit()
    return paint_out(paint)


@router.patch("/paints/{paint_id}", response_model=PaintOut)
def update_paint(paint_id: int, data: PaintUpdate, session: Session = Depends(get_session)) -> PaintOut:
    paint = get_paint(session, paint_id)
    if data.hex:
        apply_colour(paint, data.hex)
        paint.source = "user"  # keep manual overrides safe from re-imports
    if data.type:
        paint.type = data.type
    session.commit()
    return paint_out(paint)


@router.delete("/paints/{paint_id}", status_code=204)
def delete_paint(paint_id: int, session: Session = Depends(get_session)) -> None:
    paint = get_paint(session, paint_id)
    if not paint.custom:
        raise HTTPException(400, "Only paints added by hand can be deleted")
    session.delete(paint)
    session.commit()


@router.get("/paints/{paint_id}/equivalents", response_model=list[MatchOut])
def paint_equivalents(
    paint_id: int,
    brand: str | None = Query(None, description="Target brand slug; omit for the best match in every brand"),
    limit: int = Query(3, ge=1, le=20),
    same_type: bool = True,
    owned_first: bool = False,
    session: Session = Depends(get_session),
) -> list[MatchOut]:
    paint = get_paint(session, paint_id)
    if brand:
        return equivalents_for_brand(
            session, paint, get_brand(session, brand), limit=limit, same_type=same_type, owned_first=owned_first
        )
    results: list[MatchOut] = []
    for b in session.scalars(select(Brand).order_by(Brand.name)):
        if b.id == paint.brand_id:
            continue
        best = equivalents_for_brand(session, paint, b, limit=1, same_type=same_type, owned_first=owned_first)
        results.extend(best)
    results.sort(key=lambda m: (m.quality != "curated", m.delta_e if m.delta_e is not None else 0))
    return results


@router.post("/paints/{paint_id}/equivalents", status_code=201)
def add_curated_equivalent(
    paint_id: int, data: EquivalentCreate, session: Session = Depends(get_session)
) -> dict:
    get_paint(session, paint_id)
    get_paint(session, data.equivalent_paint_id)
    if paint_id == data.equivalent_paint_id:
        raise HTTPException(400, "A paint cannot be its own equivalent")
    if session.get(PaintEquivalent, (paint_id, data.equivalent_paint_id)) is None:
        session.add(PaintEquivalent(paint_id=paint_id, equivalent_paint_id=data.equivalent_paint_id, note=data.note))
        session.commit()
    return {"ok": True}


@router.delete("/paints/{paint_id}/equivalents/{other_id}", status_code=204)
def remove_curated_equivalent(paint_id: int, other_id: int, session: Session = Depends(get_session)) -> None:
    for key in ((paint_id, other_id), (other_id, paint_id)):
        row = session.get(PaintEquivalent, key)
        if row:
            session.delete(row)
    session.commit()


@router.get("/match", response_model=list[MatchOut])
def match_colour(
    hex: str,
    brand: str | None = Query(None, description="Target brand slug; omit for the best match per brand"),
    limit: int = Query(5, ge=1, le=50),
    type: str | None = Query(None, description="Restrict to a type group: opaque|contrast|shade|technical|primer"),
    owned_first: bool = False,
    session: Session = Depends(get_session),
) -> list[MatchOut]:
    try:
        rgb = hex_to_rgb(hex)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    lab = rgb_to_lab(*rgb)
    brands = [get_brand(session, brand)] if brand else list(session.scalars(select(Brand).order_by(Brand.name)))
    per_brand = limit if brand else 1

    found: list[tuple[int, float]] = []
    for b in brands:
        found.extend(find_matches(session, lab, b.id, limit=per_brand, group=type, owned_first=owned_first))
    if not brand:
        found.sort(key=lambda m: m[1])
    by_id = {p.id: p for p in session.scalars(select(Paint).where(Paint.id.in_([f[0] for f in found]))).unique()}
    return [
        MatchOut(paint=paint_out(by_id[pid]), delta_e=round(d, 2), quality=match_quality(d)) for pid, d in found
    ]
