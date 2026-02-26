"""Recon API router.

Provides endpoints for subdomain enumeration, port scanning,
WHOIS lookups, DNS analysis, and technology fingerprinting.
"""

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
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
    ports: str = Field(default="1-1000", max_length=100)


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
        "results": [r.model_dump() for r in results],
        "count": len(results),
    }


@router.post("/ports", summary="Port scan")
async def port_scan(request: PortScanRequest) -> dict[str, Any]:
    """Scan ports on the given target."""
    target = sanitize_input(request.target)
    if not (validate_ip(target) or validate_domain(target)):
        raise HTTPException(status_code=400, detail="Invalid target (IP or domain required)")
    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)
    results = await _service.run_port_scan(target, request.ports, scan_id, emitter)
    return {
        "scan_id": scan_id,
        "target": target,
        "results": [r.model_dump() for r in results],
        "count": len(results),
    }


@router.post("/whois", summary="WHOIS lookup")
async def whois_lookup(request: ScanRequest) -> dict[str, Any]:
    """Perform a WHOIS lookup for the given domain."""
    domain = sanitize_input(request.target)
    if not validate_domain(domain):
        raise HTTPException(status_code=400, detail="Invalid domain name")
    result = await _service.run_whois(domain)
    return {"target": domain, "result": result.model_dump()}


@router.post("/dns", summary="DNS analysis")
async def dns_analysis(request: ScanRequest) -> dict[str, Any]:
    """Analyze DNS records for the given domain."""
    domain = sanitize_input(request.target)
    if not validate_domain(domain):
        raise HTTPException(status_code=400, detail="Invalid domain name")
    results = await _service.run_dns_analysis(domain)
    return {
        "target": domain,
        "results": [r.model_dump() for r in results],
        "count": len(results),
    }


@router.post("/tech", summary="Technology fingerprint")
async def tech_fingerprint(request: ScanRequest) -> dict[str, Any]:
    """Fingerprint the technology stack of the target URL."""
    target = sanitize_input(request.target)
    url = target if target.startswith("http") else "https://" + target
    if not validate_url(url):
        raise HTTPException(status_code=400, detail="Invalid URL")
    results = await _service.run_tech_fingerprint(url)
    return {
        "target": url,
        "results": [r.model_dump() for r in results],
        "count": len(results),
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
async def recon_history() -> dict[str, Any]:
    """List past recon scans."""
    conn = await db.get_connection()
    cursor = await conn.execute(
        "SELECT id, module, target, status, started_at, completed_at, result_count "
        "FROM scan_history WHERE module LIKE ? ORDER BY started_at DESC LIMIT 50",
        ("recon_%",),
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
