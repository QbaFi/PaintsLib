"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "brand",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
    )
    op.create_index("ix_brand_slug", "brand", ["slug"], unique=True)

    op.create_table(
        "paint",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("brand_id", sa.Integer(), sa.ForeignKey("brand.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("range_name", sa.String(128), nullable=False),
        sa.Column("code", sa.String(64), nullable=True),
        sa.Column("hex", sa.String(7), nullable=False),
        sa.Column("r", sa.Integer(), nullable=False),
        sa.Column("g", sa.Integer(), nullable=False),
        sa.Column("b", sa.Integer(), nullable=False),
        sa.Column("lab_l", sa.Float(), nullable=False),
        sa.Column("lab_a", sa.Float(), nullable=False),
        sa.Column("lab_b", sa.Float(), nullable=False),
        sa.Column("hue", sa.Float(), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("discontinued", sa.Boolean(), nullable=False),
        sa.Column("custom", sa.Boolean(), nullable=False),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("brand_id", "name", "range_name", name="uq_paint_brand_name_range"),
    )
    op.create_index("ix_paint_brand_id", "paint", ["brand_id"])
    op.create_index("ix_paint_name", "paint", ["name"])
    op.create_index("ix_paint_type", "paint", ["type"])

    op.create_table(
        "paint_equivalent",
        sa.Column(
            "paint_id", sa.Integer(), sa.ForeignKey("paint.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "equivalent_paint_id",
            sa.Integer(),
            sa.ForeignKey("paint.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("note", sa.Text(), nullable=True),
    )

    op.create_table(
        "app_setting",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
    )

    op.create_table(
        "inventory_item",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("paint_id", sa.Integer(), sa.ForeignKey("paint.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("purchased_at", sa.Date(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("tags", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_inventory_item_paint_id", "inventory_item", ["paint_id"], unique=True)
    op.create_index("ix_inventory_item_status", "inventory_item", ["status"])


def downgrade() -> None:
    op.drop_table("inventory_item")
    op.drop_table("app_setting")
    op.drop_table("paint_equivalent")
    op.drop_table("paint")
    op.drop_table("brand")
