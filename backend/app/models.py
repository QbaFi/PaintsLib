from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

PAINT_TYPES = (
    "base",
    "layer",
    "shade",
    "contrast",
    "technical",
    "metallic",
    "dry",
    "air",
    "primer",
    "other",
)
INVENTORY_STATUSES = ("full", "low", "empty", "wishlist")


class Brand(Base):
    __tablename__ = "brand"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))

    paints: Mapped[list["Paint"]] = relationship(back_populates="brand")


class Paint(Base):
    __tablename__ = "paint"
    __table_args__ = (
        UniqueConstraint("brand_id", "name", "range_name", name="uq_paint_brand_name_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brand.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    range_name: Mapped[str] = mapped_column(String(128), default="")
    code: Mapped[str | None] = mapped_column(String(64))
    hex: Mapped[str] = mapped_column(String(7))
    r: Mapped[int] = mapped_column(Integer)
    g: Mapped[int] = mapped_column(Integer)
    b: Mapped[int] = mapped_column(Integer)
    lab_l: Mapped[float] = mapped_column(Float)
    lab_a: Mapped[float] = mapped_column(Float)
    lab_b: Mapped[float] = mapped_column(Float)
    hue: Mapped[float] = mapped_column(Float, default=0.0)
    type: Mapped[str] = mapped_column(String(32), index=True, default="other")
    discontinued: Mapped[bool] = mapped_column(Boolean, default=False)
    custom: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(64), default="miniature-paints")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    brand: Mapped[Brand] = relationship(back_populates="paints", lazy="joined")
    inventory_item: Mapped["InventoryItem | None"] = relationship(
        back_populates="paint", lazy="selectin", uselist=False
    )


class PaintEquivalent(Base):
    """Manually curated equivalents (take priority over computed colour matches)."""

    __tablename__ = "paint_equivalent"

    paint_id: Mapped[int] = mapped_column(ForeignKey("paint.id", ondelete="CASCADE"), primary_key=True)
    equivalent_paint_id: Mapped[int] = mapped_column(
        ForeignKey("paint.id", ondelete="CASCADE"), primary_key=True
    )
    note: Mapped[str | None] = mapped_column(Text)

    equivalent: Mapped[Paint] = relationship(foreign_keys=[equivalent_paint_id], lazy="joined")


class AppSetting(Base):
    """Simple key/value store for user settings (e.g. the reference brand)."""

    __tablename__ = "app_setting"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)


class InventoryItem(Base):
    __tablename__ = "inventory_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    paint_id: Mapped[int] = mapped_column(
        ForeignKey("paint.id", ondelete="CASCADE"), unique=True, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(16), default="full", index=True)
    purchased_at: Mapped[date | None] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    paint: Mapped[Paint] = relationship(back_populates="inventory_item", lazy="joined")
