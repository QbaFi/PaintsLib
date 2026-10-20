"""Find the closest paints of a target brand to a given colour (CIEDE2000)."""

from __future__ import annotations

from dataclasses import dataclass
from threading import Lock

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.color import ciede2000
from app.models import InventoryItem, Paint

# Paints are only compared within the same "group": comparing a wash with an
# opaque paint is misleading even when the bottle colours look alike.
_SPECIAL_GROUPS = {"contrast", "shade", "technical", "primer"}


def type_group(paint_type: str) -> str:
    return paint_type if paint_type in _SPECIAL_GROUPS else "opaque"


@dataclass
class _BrandIndex:
    key: tuple
    ids: np.ndarray
    labs: np.ndarray
    groups: np.ndarray
    discontinued: np.ndarray


_cache: dict[int, _BrandIndex] = {}
_lock = Lock()


def _brand_index(session: Session, brand_id: int) -> _BrandIndex:
    # Cheap fingerprint so the cache refreshes after an import or a manual edit.
    key = tuple(
        session.execute(
            select(func.count(Paint.id), func.max(Paint.updated_at), func.max(Paint.id)).where(
                Paint.brand_id == brand_id
            )
        ).one()
    )
    with _lock:
        cached = _cache.get(brand_id)
        if cached and cached.key == key:
            return cached
    rows = session.execute(
        select(Paint.id, Paint.lab_l, Paint.lab_a, Paint.lab_b, Paint.type, Paint.discontinued).where(
            Paint.brand_id == brand_id
        )
    ).all()
    index = _BrandIndex(
        key=key,
        ids=np.array([r[0] for r in rows], dtype=int),
        labs=np.array([[r[1], r[2], r[3]] for r in rows], dtype=float).reshape(-1, 3),
        groups=np.array([type_group(r[4]) for r in rows], dtype=object),
        discontinued=np.array([bool(r[5]) for r in rows], dtype=bool),
    )
    with _lock:
        _cache[brand_id] = index
    return index


def find_matches(
    session: Session,
    lab: tuple[float, float, float],
    brand_id: int,
    *,
    limit: int = 3,
    group: str | None = None,
    exclude_ids: set[int] | None = None,
    include_discontinued: bool = False,
    owned_first: bool = False,
) -> list[tuple[int, float]]:
    """Return [(paint_id, delta_e), ...] sorted by best match."""
    index = _brand_index(session, brand_id)
    if index.ids.size == 0:
        return []

    mask = np.ones(index.ids.size, dtype=bool)
    if group:
        mask &= index.groups == group
    if not include_discontinued:
        mask &= ~index.discontinued
    if exclude_ids:
        mask &= ~np.isin(index.ids, list(exclude_ids))
    if not mask.any():
        return []

    ids = index.ids[mask]
    deltas = ciede2000(lab, index.labs[mask])
    order = np.argsort(deltas)
    candidates = [(int(ids[i]), float(deltas[i])) for i in order[: max(limit * 5, limit)]]

    if owned_first and candidates:
        owned = set(
            session.scalars(
                select(InventoryItem.paint_id).where(
                    InventoryItem.paint_id.in_([c[0] for c in candidates]),
                    InventoryItem.status != "wishlist",
                )
            )
        )
        # Owned paints that are still a reasonable match go first.
        candidates.sort(key=lambda c: (not (c[0] in owned and c[1] < 10), c[1]))

    return candidates[:limit]
