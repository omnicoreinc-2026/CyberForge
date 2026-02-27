"""OSINT API router.

Provides endpoints for Shodan, VirusTotal, HIBP, and reputation lookups.
"""

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
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
        key = keyring.get_password("cyberlancer", service)
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
    data = result.model_dump()
    # Flatten to match frontend ShodanResponse: {host, ports, services, vulnerabilities}
    return {
        "scan_id": scan_id,
        "host": {
            "ip": data.get("ip", target),
            "org": data.get("org", ""),
            "os": data.get("os", ""),
            "isp": data.get("isp", ""),
            "country": data.get("country", ""),
            "city": data.get("city", ""),
            "lastUpdate": data.get("last_update", ""),
        },
        "ports": data.get("ports", []),
        "services": data.get("data", []),
        "vulnerabilities": data.get("vulns", []),
    }


@router.post("/virustotal", summary="VirusTotal scan")
async def virustotal_scan(request: VirusTotalRequest) -> dict[str, Any]:
    """Scan a target against VirusTotal."""
    target = sanitize_input(request.target)
    service = _get_service()
    scan_id = str(uuid4())
    result = await service.run_virustotal_scan(target, request.target_type, scan_id)
    data = result.model_dump()
    # Flatten to match frontend VtResponse: {target, positives, total, vendors, ...}
    vendor_results = data.get("results", {})
    vendors = [
        {"vendor": k, "verdict": ("malicious" if v.get("detected") else "clean"), "detail": v.get("result", "")}
        for k, v in vendor_results.items()
    ] if isinstance(vendor_results, dict) else []
    return {
        "scan_id": scan_id,
        "target": data.get("target", target),
        "targetType": data.get("target_type", request.target_type),
        "positives": data.get("positives", 0),
        "total": data.get("total", 0),
        "scanDate": data.get("scan_date", ""),
        "permalink": data.get("permalink", ""),
        "vendors": vendors,
    }


@router.post("/hibp", summary="HIBP breach check")
async def hibp_check(request: HIBPRequest) -> dict[str, Any]:
    """Check for data breaches via Have I Been Pwned."""
    target = sanitize_input(request.target)
    service = _get_service()
    scan_id = str(uuid4())
    results = await service.run_hibp_check(target, request.target_type, scan_id)
    # Flatten to match frontend BreachResponse: {target, totalBreaches, breaches}
    breaches = [r.model_dump() for r in results]
    return {
        "scan_id": scan_id,
        "target": target,
        "totalBreaches": len(breaches),
        "breaches": breaches,
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
    data = result.model_dump()
    # Flatten to match frontend ReputationResponse: {target, score, categories, details}
    return {
        "scan_id": scan_id,
        "target": data.get("target", target),
        "score": data.get("reputation_score", 0),
        "categories": [{"name": c, "score": 0} for c in data.get("categories", [])],
        "details": data.get("details", {}),
    }


@router.get("/history", summary="OSINT scan history")
async def osint_history(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: str = Query(default="", max_length=200),
) -> dict[str, Any]:
    """List past OSINT scans with pagination and optional target search."""
    conn = await db.get_connection()
    offset = (page - 1) * per_page
    params: list = ["osint_%"]
    where = "WHERE module LIKE ?"
    if search:
        where += " AND target LIKE ?"
        params.append(f"%{search}%")
    count_cursor = await conn.execute(f"SELECT COUNT(*) as cnt FROM scan_history {where}", params)
    total = (await count_cursor.fetchone())["cnt"]
    cursor = await conn.execute(
        f"SELECT id, module, target, status, started_at, completed_at, result_count "
        f"FROM scan_history {where} ORDER BY started_at DESC LIMIT ? OFFSET ?",
        params + [per_page, offset],
    )
    rows = await cursor.fetchall()
    return {
        "scans": [
            {"id": row["id"], "module": row["module"], "target": row["target"],
             "status": row["status"], "started_at": row["started_at"],
             "completed_at": row["completed_at"], "result_count": row["result_count"]}
            for row in rows
        ],
        "total": total, "page": page, "per_page": per_page,
    }
