"""CyberForge API -- FastAPI application entrypoint.

Assembles routers, middleware, and lifecycle hooks into a single
ASGI application served by Uvicorn.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.database import db
from backend.routers import assistant, health, logs, osint, recon, settings as settings_router, threat, vuln, websocket

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown tasks.

    Startup:
        - Initialise the SQLite database and run migrations.
    Shutdown:
        - Close the database connection cleanly.
    """
    # -- Startup --
    logger.info("CyberForge API starting up")
    await db.init_db()
    logger.info("Database ready")

    yield

    # -- Shutdown --
    logger.info("CyberForge API shutting down")
    await db.close()
    logger.info("Cleanup complete")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    """Build and return the configured FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_TITLE,
        version=settings.APP_VERSION,
        lifespan=lifespan,
    )

    # -- CORS --
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -- Routers --
    app.include_router(health.router, prefix="/api")
    app.include_router(recon.router, prefix="/api")
    app.include_router(osint.router, prefix="/api")
    app.include_router(vuln.router, prefix="/api")
    app.include_router(threat.router, prefix="/api")
    app.include_router(logs.router, prefix="/api")
    app.include_router(settings_router.router)
    app.include_router(assistant.router)
    app.include_router(websocket.router)

    return app


app = create_app()


# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.DEBUG if get_settings().DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


# ---------------------------------------------------------------------------
# Direct execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "backend.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
    )
