"""OSINT API router.

Provides endpoints for Shodan, VirusTotal, HIBP, and reputation lookups.
"""

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.database import db
from backend.models.base import ScanRequest
from backend.services.osint_service import OsintService
from backend.utils.validators import sanitize_input, validate_domain, validate_ip

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/osint", tags=["osint"])


def _get_api_key(service: str) -> str:
    """Retrieve an API key from the OS keyring."""
    try:
        import keyring
        key = keyring.get_password("cyberforge", service)
        return key or ""
    except Exception:
        return ""


def _get_service() -> OsintService:
    """Create an OsintService with available API keys."""
    return OsintService(
        shodan_key=_get_api_key("shodan"),
        virustotal_key=_get_api_key("virustotal"),
        hibp_key=_get_api_key("hibp"),
    )


class VirusTotalRequest(BaseModel):
    """Request body for VirusTotal scans."""
    target: str = Field(..., min_length=1, max_length=2048)
    target_type: str = Field(default="domain", description="One of: url, domain, ip, hash")


class HIBPRequest(BaseModel):
    """Request body for HIBP checks."""
    target: str = Field(..., min_length=1, max_length=320)
    target_type: str = Field(default="email", description="One of: email, domain")


@router.post("/shodan", summary="Shodan host lookup")
async def shodan_lookup(request: ScanRequest) -> dict[str, Any]:
    """Look up host intelligence from Shodan."""
    target = sanitize_input(request.target)
    if not validate_ip(target):
        raise HTTPException(status_code=400, detail="Shodan requires a valid IP address")
    service = _get_service()
    scan_id = str(uuid4())
    result = await service.run_shodan_lookup(target, scan_id)
    return {"scan_id": scan_id, "target": target, "result": result.model_dump()}


@router.post("/virustotal", summary="VirusTotal scan")
async def virustotal_scan(request: VirusTotalRequest) -> dict[str, Any]:
    """Scan a target against VirusTotal."""
    target = sanitize_input(request.target)
    service = _get_service()
    scan_id = str(uuid4())
    result = await service.run_virustotal_scan(target, request.target_type, scan_id)
    return {"scan_id": scan_id, "target": target, "result": result.model_dump()}


@router.post("/hibp", summary="HIBP breach check")
async def hibp_check(request: HIBPRequest) -> dict[str, Any]:
    """Check for data breaches via Have I Been Pwned."""
    target = sanitize_input(request.target)
    service = _get_service()
    scan_id = str(uuid4())
    results = await service.run_hibp_check(target, request.target_type, scan_id)
    return {
        "scan_id": scan_id,
        "target": target,
        "results": [r.model_dump() for r in results],
        "count": len(results),
    }


@router.post("/reputation", summary="Reputation check")
async def reputation_check(request: ScanRequest) -> dict[str, Any]:
    """Check domain/IP reputation score."""
    target = sanitize_input(request.target)
    if not (validate_ip(target) or validate_domain(target)):
        raise HTTPException(status_code=400, detail="Invalid target (IP or domain required)")
    service = _get_service()
    scan_id = str(uuid4())
    result = await service.run_reputation_check(target, scan_id)
    return {"scan_id": scan_id, "target": target, "result": result.model_dump()}


@router.get("/history", summary="OSINT scan history")
async def osint_history() -> dict[str, Any]:
    """List past OSINT scans."""
    conn = await db.get_connection()
    cursor = await conn.execute(
        "SELECT id, module, target, status, started_at, completed_at, result_count "
        "FROM scan_history WHERE module LIKE ? ORDER BY started_at DESC LIMIT 50",
        ("osint_%",),
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
