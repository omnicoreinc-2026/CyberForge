"""Health check router.

Provides a lightweight endpoint for monitoring tools, load balancers,
and the Tauri frontend to verify that the API is reachable.
"""

from fastapi import APIRouter

from backend.config import get_settings
from backend.models.base import HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
)
async def health_check() -> HealthResponse:
    """Return current service status and version."""
    settings = get_settings()
    return HealthResponse(status="ok", version=settings.APP_VERSION)
