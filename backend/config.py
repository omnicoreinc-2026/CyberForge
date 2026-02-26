"""Application configuration using Pydantic settings.

Loads configuration from environment variables with sensible defaults
for local development. Use a .env file or export variables for production.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """CyberForge API configuration.

    All settings can be overridden via environment variables
    (case-insensitive, prefix-free).
    """

    API_HOST: str = "127.0.0.1"
    API_PORT: int = 8008
    DB_PATH: str = "./data/cyberforge.db"
    DEBUG: bool = True

    # CORS origins allowed to call the API
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:1420",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:1420",
    ]

    # Application metadata
    APP_TITLE: str = "CyberForge API"
    APP_VERSION: str = "0.1.0"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings.

    Uses lru_cache so the Settings object is only created once
    and reused across all dependency injections.
    """
    return Settings()
