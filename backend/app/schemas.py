from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.color import normalize_hex

PaintType = Literal[
    "base", "layer", "shade", "contrast", "technical", "metallic", "dry", "air", "primer", "other"
]
Status = Literal["full", "low", "empty", "wishlist"]
Quality = Literal["near_identical", "close", "similar", "distant", "curated"]


class BrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: str
    name: str
    paint_count: int = 0


class PaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    range_name: str
    code: str | None
    hex: str
    type: str
    discontinued: bool
    custom: bool
    brand: BrandOut
    owned: bool = False
    inventory_id: int | None = None
    inventory_status: Status | None = None
    inventory_quantity: int | None = None


class PaintPage(BaseModel):
    items: list[PaintOut]
    total: int
    page: int
    page_size: int


class MatchOut(BaseModel):
    paint: PaintOut
    delta_e: float | None
    quality: Quality


class PaintCreate(BaseModel):
    brand_name: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    range_name: str = Field(default="", max_length=128)
    code: str | None = None
    hex: str
    type: PaintType = "other"

    @field_validator("hex")
    @classmethod
    def _hex(cls, v: str) -> str:
        return normalize_hex(v)


class PaintUpdate(BaseModel):
    hex: str | None = None
    type: PaintType | None = None

    @field_validator("hex")
    @classmethod
    def _hex(cls, v: str | None) -> str | None:
        return normalize_hex(v) if v else v


class EquivalentCreate(BaseModel):
    equivalent_paint_id: int
    note: str | None = None


class InventoryCreate(BaseModel):
    paint_id: int
    quantity: int = Field(default=1, ge=0)
    status: Status = "full"
    purchased_at: date | None = None
    note: str | None = None
    tags: list[str] = []


class InventoryUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    status: Status | None = None
    purchased_at: date | None = None
    note: str | None = None
    tags: list[str] | None = None


class InventoryOut(BaseModel):
    id: int
    quantity: int
    status: Status
    purchased_at: date | None
    note: str | None
    tags: list[str]
    paint: PaintOut
    reference_match: MatchOut | None = None
