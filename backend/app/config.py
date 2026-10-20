from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite file on the Docker volume. Any SQLAlchemy URL works (e.g. PostgreSQL later).
    database_url: str = "sqlite:////data/paintrack.db"
    # Default "reference" brand for equivalents; can be changed in the app settings.
    reference_brand: str = "citadel"
    # Paint catalog source: tarball of github.com/Arcturus5404/miniature-paints (MIT).
    catalog_url: str = "https://codeload.github.com/Arcturus5404/miniature-paints/tar.gz/refs/heads/main"
    # Import the catalog automatically when the database has no paints yet.
    auto_import: bool = True
    # Import every brand from the source instead of only the ones listed in catalog.py.
    import_all_brands: bool = False
    # Built frontend served at "/" (set in the Docker image).
    static_dir: Path = Path(__file__).resolve().parent.parent / "static"


settings = Settings()
