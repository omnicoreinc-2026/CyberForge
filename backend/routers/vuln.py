"""Vulnerability Scanner API router.

Provides endpoints for HTTP header analysis, SSL/TLS checks,
CVE lookups, dependency scanning, and full vulnerability scans.
"""

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.database import db
from backend.models.base import ScanRequest
from backend.routers.websocket import manager
from backend.services.vuln_service import VulnService
from backend.utils.progress import ProgressEmitter
from backend.utils.validators import sanitize_input, validate_domain, validate_ip, validate_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vuln", tags=["vulnerability"])


def _get_api_key(service: str) -> str:
    """Retrieve an API key from the OS keyring."""
    try:
        import keyring
        key = keyring.get_password("cyberforge", service)
        return key or ""
    except Exception:
        return ""


def _get_service() -> VulnService:
    """Create a VulnService with available API keys."""
    return VulnService(nvd_api_key=_get_api_key("nvd"))


class SslCheckRequest(BaseModel):
    """Request body for SSL/TLS checks."""
    hostname: str = Field(..., min_length=1, max_length=253)
    port: int = Field(default=443, ge=1, le=65535)


class CveSearchRequest(BaseModel):
    """Request body for CVE searches."""
    keyword: str = Field(..., min_length=1, max_length=200)


class DependencyCheckRequest(BaseModel):
    """Request body for dependency vulnerability checks."""
    content: str = Field(..., min_length=1, description="Raw file content")
    file_type: str = Field(
        default="requirements",
        description="File type: requirements or package_json",
    )


@router.post("/headers", summary="HTTP header analysis")
async def header_analysis(request: ScanRequest) -> dict[str, Any]:
    """Analyze HTTP security headers for the target URL."""
    target = sanitize_input(request.target)
    url = target if target.startswith("http") else "https://" + target
    if not validate_url(url):
        raise HTTPException(status_code=400, detail="Invalid URL")
    service = _get_service()
    scan_id = str(uuid4())
    results = await service.run_header_analysis(url, scan_id)
    return {
        "scan_id": scan_id,
        "target": url,
        "results": [r.model_dump() for r in results],
        "count": len(results),
    }


@router.post("/ssl", summary="SSL/TLS check")
async def ssl_check(request: SslCheckRequest) -> dict[str, Any]:
    """Check SSL/TLS certificate and configuration."""
    hostname = sanitize_input(request.hostname)
    if not (validate_domain(hostname) or validate_ip(hostname)):
        raise HTTPException(status_code=400, detail="Invalid hostname")
    service = _get_service()
    scan_id = str(uuid4())
    result = await service.run_ssl_check(hostname, request.port, scan_id)
    return {"scan_id": scan_id, "target": hostname, "result": result.model_dump()}


@router.post("/cve", summary="CVE lookup")
async def cve_search(request: CveSearchRequest) -> dict[str, Any]:
    """Search NVD for CVEs matching the keyword."""
    keyword = sanitize_input(request.keyword)
    service = _get_service()
    scan_id = str(uuid4())
    results = await service.run_cve_search(keyword, scan_id)
    return {
        "scan_id": scan_id,
        "keyword": keyword,
        "results": [r.model_dump() for r in results],
        "count": len(results),
    }


@router.post("/dependencies", summary="Dependency vulnerability check")
async def dependency_check(request: DependencyCheckRequest) -> dict[str, Any]:
    """Check project dependencies for known vulnerabilities."""
    service = _get_service()
    scan_id = str(uuid4())
    results = await service.run_dependency_check(
        request.content, request.file_type, scan_id,
    )
    return {
        "scan_id": scan_id,
        "file_type": request.file_type,
        "results": [r.model_dump() for r in results],
        "count": len(results),
    }


@router.post("/full", summary="Full vulnerability scan")
async def full_vuln_scan(request: ScanRequest) -> dict[str, Any]:
    """Run a full vulnerability scan on the target."""
    target = sanitize_input(request.target)
    if not (validate_domain(target) or validate_ip(target) or validate_url(target)):
        raise HTTPException(status_code=400, detail="Invalid target")
    service = _get_service()
    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)
    result = await service.run_full_scan(target, scan_id, emitter)
    return {"scan_id": scan_id, "target": target, "result": result.model_dump()}


@router.get("/history", summary="Vulnerability scan history")
async def vuln_history(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: str = Query(default="", max_length=200),
) -> dict[str, Any]:
    """List past vulnerability scans with pagination and optional target search."""
    conn = await db.get_connection()
    offset = (page - 1) * per_page
    params: list = ["vuln_%"]
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
