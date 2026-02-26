"""Recon API router.

Provides endpoints for subdomain enumeration, port scanning,
WHOIS lookups, DNS analysis, and technology fingerprinting.
"""

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.database import db
from backend.models.base import ScanRequest
from backend.models.recon import (
    DnsRecord,
    PortScanResult,
    ReconFullResult,
    SubdomainResult,
    TechStackResult,
    WhoisResult,
)
from backend.routers.websocket import manager
from backend.services.recon_service import ReconService
from backend.utils.progress import ProgressEmitter
from backend.utils.validators import sanitize_input, validate_domain, validate_ip, validate_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recon", tags=["recon"])
_service = ReconService()


class PortScanRequest(BaseModel):
    """Request body for port scanning."""
    target: str = Field(..., min_length=1, max_length=253)
    ports: str | None = Field(default=None, max_length=100)
    portRange: str | None = Field(default=None, max_length=100, alias="portRange")

    @property
    def resolved_ports(self) -> str:
        """Accept either 'ports' or 'portRange' from the frontend."""
        return self.portRange or self.ports or "1-1000"


@router.post("/subdomains", summary="Enumerate subdomains")
async def subdomain_scan(request: ScanRequest) -> dict[str, Any]:
    """Enumerate subdomains for the given domain."""
    domain = sanitize_input(request.target)
    if not validate_domain(domain):
        raise HTTPException(status_code=400, detail="Invalid domain name")
    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)
    results = await _service.run_subdomain_scan(domain, scan_id, emitter)
    return {
        "scan_id": scan_id,
        "target": domain,
        "subdomains": [r.model_dump() for r in results],
        "total": len(results),
    }


@router.post("/ports", summary="Port scan")
async def port_scan(request: PortScanRequest) -> dict[str, Any]:
    """Scan ports on the given target."""
    target = sanitize_input(request.target)
    if not (validate_ip(target) or validate_domain(target)):
        raise HTTPException(status_code=400, detail="Invalid target (IP or domain required)")
    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)
    results = await _service.run_port_scan(target, request.resolved_ports, scan_id, emitter)
    open_ports = [r for r in results if r.state == "open"]
    return {
        "scan_id": scan_id,
        "target": target,
        "portRange": request.resolved_ports,
        "ports": [r.model_dump() for r in results],
        "total": len(results),
        "openPorts": len(open_ports),
    }


@router.post("/whois", summary="WHOIS lookup")
async def whois_lookup(request: ScanRequest) -> dict[str, Any]:
    """Perform a WHOIS lookup for the given domain."""
    domain = sanitize_input(request.target)
    if not validate_domain(domain):
        raise HTTPException(status_code=400, detail="Invalid domain name")
    result = await _service.run_whois(domain)
    data = result.model_dump()
    # Add camelCase aliases expected by the frontend
    data["createdDate"] = data.get("creation_date", "")
    data["expiresDate"] = data.get("expiration_date", "")
    data["updatedDate"] = data.get("updated_date", "")
    data["nameServers"] = data.get("name_servers", [])
    data["registrant"] = data.get("registrant", "")
    # Build fields array for the frontend WhoisResponse type
    data["fields"] = [
        {"label": k.replace("_", " ").title(), "value": str(v)[:200]}
        for k, v in data.items()
        if k not in ("raw", "fields", "createdDate", "expiresDate", "updatedDate", "nameServers")
        and v and not isinstance(v, (dict, list))
    ]
    # Return flat structure matching frontend WhoisResponse type
    return {
        "domain": data.get("domain", domain),
        "registrar": data.get("registrar", ""),
        "createdDate": data["createdDate"],
        "expiresDate": data["expiresDate"],
        "updatedDate": data["updatedDate"],
        "nameServers": data["nameServers"],
        "status": data.get("status", []),
        "registrant": data["registrant"],
        "fields": data["fields"],
    }


@router.post("/dns", summary="DNS analysis")
async def dns_analysis(request: ScanRequest) -> dict[str, Any]:
    """Analyze DNS records for the given domain."""
    domain = sanitize_input(request.target)
    if not validate_domain(domain):
        raise HTTPException(status_code=400, detail="Invalid domain name")
    results = await _service.run_dns_analysis(domain)
    records = []
    for r in results:
        d = r.model_dump()
        d["type"] = d.pop("record_type", d.get("type", ""))
        records.append(d)
    return {
        "target": domain,
        "domain": domain,
        "records": records,
    }


@router.post("/tech", summary="Technology fingerprint")
async def tech_fingerprint(request: ScanRequest) -> dict[str, Any]:
    """Fingerprint the technology stack of the target URL."""
    target = sanitize_input(request.target)
    url = target if target.startswith("http") else "https://" + target
    if not validate_url(url):
        raise HTTPException(status_code=400, detail="Invalid URL")
    results = await _service.run_tech_fingerprint(url)
    technologies = []
    for r in results:
        d = r.model_dump()
        d["name"] = d.pop("technology", d.get("name", ""))
        technologies.append(d)
    return {
        "target": url,
        "url": url,
        "technologies": technologies,
    }


@router.post("/full", summary="Full reconnaissance scan")
async def full_recon(request: ScanRequest) -> dict[str, Any]:
    """Run a full reconnaissance scan on the target."""
    target = sanitize_input(request.target)
    if not validate_domain(target):
        raise HTTPException(status_code=400, detail="Invalid domain name")
    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)
    result = await _service.run_full_recon(target, scan_id, emitter)
    return {"scan_id": scan_id, "target": target, "result": result.model_dump()}


@router.get("/history", summary="Recon scan history")
async def recon_history(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: str = Query(default="", max_length=200),
) -> dict[str, Any]:
    """List past recon scans with pagination and optional target search."""
    conn = await db.get_connection()
    offset = (page - 1) * per_page
    params: list = ["recon_%"]
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
