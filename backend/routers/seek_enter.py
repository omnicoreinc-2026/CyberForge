"""Seek & Enter API router.

Provides endpoints for CIDR host discovery (Seek) and
exploitation (Enter) with SSE terminal streaming.
"""

import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.models.seek_enter import EnterRequest
from backend.services.seek_enter_service import seek_enter_service
from backend.utils.validators import sanitize_input, validate_ip_range

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/seek-enter", tags=["seek-enter"])


class SeekRequest(BaseModel):
    """Request body for the Seek (CIDR discovery) scan."""

    cidr: str = Field(..., min_length=1, max_length=100)
    ports: str = Field(default="1-1000", max_length=200)


@router.post("/seek", summary="Scan CIDR range for live hosts and vulnerabilities")
async def seek_scan(request: SeekRequest) -> dict[str, Any]:
    """Discover live hosts, services, and vulnerabilities in a CIDR range."""
    cidr = sanitize_input(request.cidr)
    if not validate_ip_range(cidr):
        raise HTTPException(status_code=400, detail="Invalid CIDR range or IP address")

    try:
        result = await seek_enter_service.run_seek(cidr, request.ports)
        return {
            "scan_id": result.scan_id,
            "cidr": result.cidr,
            "hosts_scanned": result.hosts_scanned,
            "hosts_alive": result.hosts_alive,
            "total_services": sum(len(h.services) for h in result.hosts),
            "total_vulns": sum(len(h.vulns) for h in result.hosts),
            "hosts": [h.model_dump() for h in result.hosts],
        }
    except Exception as exc:
        logger.exception("Seek scan failed for %s", cidr)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/seek/{scan_id}", summary="Get cached seek scan results")
async def get_seek_results(scan_id: str) -> dict[str, Any]:
    """Retrieve results from a previous seek scan by ID."""
    result = seek_enter_service.get_seek_result(scan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Scan not found or expired")
    return {
        "scan_id": result.scan_id,
        "cidr": result.cidr,
        "hosts_scanned": result.hosts_scanned,
        "hosts_alive": result.hosts_alive,
        "hosts": [h.model_dump() for h in result.hosts],
    }


@router.post("/enter", summary="Start exploitation attempt (SSE stream)")
async def enter_exploit(request: EnterRequest) -> StreamingResponse:
    """Attempt exploitation of a specific host/service.

    Returns a Server-Sent Events (SSE) stream of terminal output.
    """

    async def event_generator():
        async for event in seek_enter_service.run_enter(request):
            data = json.dumps(event.model_dump())
            yield f"data: {data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
