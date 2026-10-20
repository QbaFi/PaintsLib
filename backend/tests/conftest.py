import os
import tempfile
from pathlib import Path

# Configure the app for tests before anything from `app` is imported.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["AUTO_IMPORT"] = "false"
os.environ["STATIC_DIR"] = _tmp

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from tests.fixtures import CITADEL_MD, VALLEJO_MD  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def client():
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    command.upgrade(cfg, "head")

    from app.db import SessionLocal
    from app.importer import import_catalog
    from app.main import app

    with SessionLocal() as session:
        import_catalog(session, {"Citadel_Colour": CITADEL_MD, "Vallejo": VALLEJO_MD, "Unknown": CITADEL_MD})

    with TestClient(app) as test_client:
        yield test_client
