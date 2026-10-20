from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings as app_config
from app.db import get_session
from app.importer import import_status, start_background_import
from app.models import AppSetting, Brand, InventoryItem, Paint

router = APIRouter(prefix="/api", tags=["settings"])

REFERENCE_BRAND_KEY = "reference_brand"


def get_reference_brand_slug(session: Session) -> str:
    row = session.get(AppSetting, REFERENCE_BRAND_KEY)
    return row.value if row else app_config.reference_brand


class SettingsOut(BaseModel):
    reference_brand: str


class SettingsUpdate(BaseModel):
    reference_brand: str


@router.get("/settings", response_model=SettingsOut)
def read_settings(session: Session = Depends(get_session)) -> SettingsOut:
    return SettingsOut(reference_brand=get_reference_brand_slug(session))


@router.put("/settings", response_model=SettingsOut)
def update_settings(data: SettingsUpdate, session: Session = Depends(get_session)) -> SettingsOut:
    slug = data.reference_brand.strip().lower()
    if session.scalar(select(Brand).where(Brand.slug == slug)) is None:
        raise HTTPException(404, f"Unknown brand: {slug}")
    row = session.get(AppSetting, REFERENCE_BRAND_KEY)
    if row is None:
        session.add(AppSetting(key=REFERENCE_BRAND_KEY, value=slug))
    else:
        row.value = slug
    session.commit()
    return SettingsOut(reference_brand=slug)


@router.get("/catalog/status")
def catalog_status(session: Session = Depends(get_session)) -> dict:
    return {
        **import_status(),
        "paint_count": session.scalar(select(func.count(Paint.id))) or 0,
        "brand_count": session.scalar(select(func.count(Brand.id))) or 0,
        "inventory_count": session.scalar(select(func.count(InventoryItem.id))) or 0,
    }


@router.post("/catalog/import", status_code=202)
def catalog_import() -> dict:
    if not start_background_import():
        raise HTTPException(409, "Import is already running")
    return {"started": True}
