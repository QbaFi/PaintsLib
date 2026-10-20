from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select

from app.config import settings
from app.db import SessionLocal
from app.importer import start_background_import
from app.models import Paint
from app.routers import collection, inventory, paints
from app.routers import settings as settings_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("paintslib")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if settings.auto_import:
        with SessionLocal() as session:
            empty = (session.scalar(select(func.count(Paint.id))) or 0) == 0
        if empty:
            log.info("Empty catalog - importing paints in the background")
            start_background_import()
    yield


app = FastAPI(title="PaintsLib", version="0.1.0", lifespan=lifespan)
app.include_router(paints.router)
app.include_router(collection.router)
app.include_router(inventory.router)
app.include_router(settings_router.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/{_path:path}", include_in_schema=False)
def api_not_found(_path: str) -> JSONResponse:
    return JSONResponse({"detail": "Not Found"}, status_code=404)


# Serve the built React app (present in the Docker image). Unknown paths fall back
# to index.html so client-side routes like /catalog survive a page refresh.
if (settings.static_dir / "index.html").is_file():
    app.mount("/assets", StaticFiles(directory=settings.static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        candidate = (settings.static_dir / full_path).resolve()
        if full_path and candidate.is_file() and settings.static_dir.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(settings.static_dir / "index.html")
