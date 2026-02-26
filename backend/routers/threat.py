"""Threat intelligence API router.

Provides endpoints for IOC lookups, IP reputation checks,
threat feed aggregation, and IP geolocation.
"""

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.database import db
from backend.routers.websocket import manager
from backend.services.threat_service import ThreatService
from backend.utils.progress import ProgressEmitter
from backend.utils.validators import sanitize_input, validate_ip, validate_domain, validate_url, validate_hash

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/threat", tags=["threat"])
_service = ThreatService()


class IocLookupRequest(BaseModel):
    """Request body for IOC lookups."""
    target: str = Field(..., min_length=1, max_length=500)
    ioc_type: str = Field(default="auto", max_length=20)


class IpRequest(BaseModel):
    """Request body for IP-based lookups."""
    target: str = Field(..., min_length=1, max_length=253)


def _detect_ioc_type(value: str) -> str:
    """Auto-detect the IOC type from its value."""
    if validate_ip(value):
        return "ip"
    if validate_domain(value):
        return "domain"
    if validate_url(value):
        return "url"
    is_hash, _ = validate_hash(value)
    if is_hash:
        return "hash"
    return "unknown"


@router.post("/ioc", summary="IOC lookup")
async def ioc_lookup(request: IocLookupRequest) -> dict[str, Any]:
    """Look up an indicator of compromise across threat intelligence sources."""
    target = sanitize_input(request.target)
    if not target:
        raise HTTPException(status_code=400, detail="Target is required")

    ioc_type = request.ioc_type
    if ioc_type == "auto":
        ioc_type = _detect_ioc_type(target)
    if ioc_type == "unknown":
        raise HTTPException(status_code=400, detail="Unable to detect IOC type. Please specify ip, domain, url, or hash.")

    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)
    result = await _service.lookup_ioc(target, ioc_type, scan_id, emitter)
    return result


@router.post("/ip-reputation", summary="IP reputation check")
async def ip_reputation(request: IpRequest) -> dict[str, Any]:
    """Check the reputation of an IP address."""
    ip = sanitize_input(request.target)
    if not validate_ip(ip):
        raise HTTPException(status_code=400, detail="Invalid IP address")

    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)
    result = await _service.check_ip_reputation(ip, scan_id, emitter)
    return result


@router.get("/feed", summary="Threat feed")
async def threat_feed(limit: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:
    """Retrieve the latest threat feed entries."""
    entries = await _service.get_threat_feed(limit=limit)
    return {"entries": entries, "count": len(entries)}


@router.post("/geoip", summary="IP geolocation")
async def geoip_lookup(request: IpRequest) -> dict[str, Any]:
    """Geolocate an IP address."""
    ip = sanitize_input(request.target)
    if not validate_ip(ip):
        raise HTTPException(status_code=400, detail="Invalid IP address")

    result = await _service.geolocate_ip(ip)
    return result


@router.get("/history", summary="Threat intel scan history")
async def threat_history() -> dict[str, Any]:
    """List past threat intelligence scans."""
    conn = await db.get_connection()
    cursor = await conn.execute(
        "SELECT id, module, target, status, started_at, completed_at, result_count "
        "FROM scan_history WHERE module LIKE ? ORDER BY started_at DESC LIMIT 50",
        ("threat_%",),
    )
    rows = await cursor.fetchall()
    return {
        "scans": [
            {
                "id": row["id"],
                "module": row["module"],
                "target": row["target"],
                "status": row["status"],
                "started_at": row["started_at"],
                "completed_at": row["completed_at"],
                "result_count": row["result_count"],
            }
            for row in rows
        ]
    }
