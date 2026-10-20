from __future__ import annotations

import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Brand, InventoryItem, Paint
from app.schemas import InventoryCreate, InventoryOut, InventoryUpdate
from app.routers.settings import get_reference_brand_slug
from app.services import equivalents_for_brand, get_paint, paint_out

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


def _tags_to_str(tags: list[str]) -> str:
    clean = sorted({t.strip() for t in tags if t.strip()}, key=str.lower)
    return ",".join(clean)


def _item_out(session: Session, item: InventoryItem, ref: Brand | None) -> InventoryOut:
    match = None
    if ref is not None and item.paint.brand_id != ref.id:
        found = equivalents_for_brand(session, item.paint, ref, limit=1, owned_first=True)
        match = found[0] if found else None
    return InventoryOut(
        id=item.id,
        quantity=item.quantity,
        status=item.status,
        purchased_at=item.purchased_at,
        note=item.note,
        tags=[t for t in item.tags.split(",") if t],
        paint=paint_out(item.paint, item),
        reference_match=match,
    )


def _filtered(
    session: Session,
    status: str | None,
    brand: str | None,
    type: str | None,
    tag: str | None,
    q: str | None,
    sort: str,
) -> list[InventoryItem]:
    query = select(InventoryItem).join(Paint).join(Brand)
    if status:
        query = query.where(InventoryItem.status.in_(status.split(",")))
    if brand:
        query = query.where(Brand.slug.in_(brand.lower().split(",")))
    if type:
        query = query.where(Paint.type.in_(type.split(",")))
    if tag:
        query = query.where(InventoryItem.tags.ilike(f"%{tag}%"))
    if q:
        for token in q.split():
            query = query.where(or_(Paint.name.ilike(f"%{token}%"), Brand.name.ilike(f"%{token}%")))
    order = {
        "name": (Paint.name,),
        "brand": (Brand.name, Paint.name),
        "hue": (Paint.hue, Paint.lab_l.desc()),
        "recent": (InventoryItem.created_at.desc(),),
    }[sort]
    return list(session.scalars(query.order_by(*order)).unique())


@router.get("", response_model=list[InventoryOut])
def list_inventory(
    status: str | None = Query(None, description="full,low,empty,wishlist (comma separated)"),
    brand: str | None = None,
    type: str | None = None,
    tag: str | None = None,
    q: str | None = None,
    sort: Literal["name", "brand", "hue", "recent"] = "brand",
    ref: str | None = Query(None, description="Reference brand slug for equivalents (default from settings)"),
    session: Session = Depends(get_session),
) -> list[InventoryOut]:
    ref_slug = (ref or get_reference_brand_slug(session)).lower()
    ref_brand = session.scalar(select(Brand).where(Brand.slug == ref_slug)) if ref_slug != "none" else None
    return [_item_out(session, i, ref_brand) for i in _filtered(session, status, brand, type, tag, q, sort)]


@router.get("/export.csv")
def export_inventory(
    status: str | None = None,
    session: Session = Depends(get_session),
) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["brand", "range", "name", "code", "hex", "type", "quantity", "status", "tags", "note"])
    for i in _filtered(session, status, None, None, None, None, "brand"):
        p = i.paint
        writer.writerow(
            [p.brand.name, p.range_name, p.name, p.code or "", p.hex, p.type, i.quantity, i.status, i.tags, i.note or ""]
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="paint-rack.csv"'},
    )


@router.post("", response_model=InventoryOut, status_code=201)
def add_to_inventory(data: InventoryCreate, session: Session = Depends(get_session)) -> InventoryOut:
    paint = get_paint(session, data.paint_id)
    item = session.scalar(select(InventoryItem).where(InventoryItem.paint_id == paint.id))
    if item:  # adding an owned paint again just bumps the quantity
        item.quantity += max(data.quantity, 1) if data.status != "wishlist" else 0
        if data.status != "wishlist":
            item.status = data.status
    else:
        item = InventoryItem(
            paint=paint,
            quantity=0 if data.status == "wishlist" else data.quantity,
            status=data.status,
            purchased_at=data.purchased_at,
            note=data.note,
            tags=_tags_to_str(data.tags),
        )
        session.add(item)
    session.commit()
    return _item_out(session, item, None)


@router.patch("/{item_id}", response_model=InventoryOut)
def update_inventory(item_id: int, data: InventoryUpdate, session: Session = Depends(get_session)) -> InventoryOut:
    item = session.get(InventoryItem, item_id)
    if item is None:
        raise HTTPException(404, "Inventory item not found")
    fields = data.model_dump(exclude_unset=True)
    if "tags" in fields:
        item.tags = _tags_to_str(fields.pop("tags") or [])
    for key, value in fields.items():
        setattr(item, key, value)
    session.commit()
    return _item_out(session, item, None)


@router.delete("/{item_id}", status_code=204)
def delete_inventory(item_id: int, session: Session = Depends(get_session)) -> None:
    item = session.get(InventoryItem, item_id)
    if item is None:
        raise HTTPException(404, "Inventory item not found")
    session.delete(item)
    session.commit()
