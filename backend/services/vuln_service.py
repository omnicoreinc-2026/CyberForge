"""Vulnerability scanning orchestration service.

Coordinates HTTP header analysis, SSL/TLS checks, CVE lookups,
and dependency vulnerability scanning.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from backend.database import db
from backend.integrations.nvd_client import NvdClient
from backend.models.vuln import (
    CveResult,
    DependencyVuln,
    HeaderAnalysis,
    SslResult,
    VulnScanResult,
)
from backend.scanners.dependency_checker import check_package_json, check_requirements
from backend.scanners.header_analyzer import analyze_headers
from backend.scanners.ssl_checker import check_ssl
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)


class VulnService:
    """Orchestrates vulnerability scanning operations."""

    def __init__(self, nvd_api_key: str = "") -> None:
        self._nvd = NvdClient(api_key=nvd_api_key)

    async def _store_result(
        self, scan_id: str, scan_type: str, target: str,
        results: list[dict], severity: str = "info",
    ) -> None:
        """Persist scan results to the database."""
        conn = await db.get_connection()
        await conn.execute(
            "INSERT OR REPLACE INTO scan_results "
            "(id, scan_type, target, results_json, severity, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (scan_id, scan_type, target, json.dumps(results), severity,
             datetime.now(timezone.utc).isoformat()),
        )
        await conn.commit()

    async def _store_history(
        self, scan_id: str, module: str, target: str,
        status: str, result_count: int,
    ) -> None:
        """Record scan execution in scan_history."""
        conn = await db.get_connection()
        now = datetime.now(timezone.utc).isoformat()
        completed_at = now if status in ("completed", "error") else None
        await conn.execute(
            "INSERT OR REPLACE INTO scan_history "
            "(id, module, target, status, started_at, completed_at, result_count) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (scan_id, module, target, status, now, completed_at, result_count),
        )
        await conn.commit()

    async def run_header_analysis(self, url: str, scan_id: str) -> list[HeaderAnalysis]:
        """Run HTTP security header analysis and store results."""
        await self._store_history(scan_id, "vuln_headers", url, "running", 0)
        try:
            results = await analyze_headers(url)
            fail_count = sum(1 for r in results if r.status == "fail")
            severity = "info"
            if fail_count > 3:
                severity = "high"
            elif fail_count > 1:
                severity = "medium"
            elif fail_count > 0:
                severity = "low"
            result_dicts = [r.model_dump() for r in results]
            await self._store_result(scan_id, "vuln_headers", url, result_dicts, severity)
            await self._store_history(scan_id, "vuln_headers", url, "completed", len(results))
            return results
        except Exception as exc:
            logger.error("Header analysis failed: %s", exc)
            await self._store_history(scan_id, "vuln_headers", url, "error", 0)
            return []
    async def run_ssl_check(self, hostname: str, port: int, scan_id: str) -> SslResult:
        """Run SSL/TLS analysis and store results."""
        await self._store_history(scan_id, "vuln_ssl", hostname, "running", 0)
        try:
            result = await check_ssl(hostname, port)
            severity = "info"
            if result.grade == "F":
                severity = "critical"
            elif result.grade == "D":
                severity = "high"
            elif result.grade == "C":
                severity = "medium"
            elif result.grade == "B":
                severity = "low"
            await self._store_result(scan_id, "vuln_ssl", hostname, [result.model_dump()], severity)
            await self._store_history(scan_id, "vuln_ssl", hostname, "completed", len(result.issues))
            return result
        except Exception as exc:
            logger.error("SSL check failed: %s", exc)
            await self._store_history(scan_id, "vuln_ssl", hostname, "error", 0)
            return SslResult(valid=False, grade="F", issues=["Check failed: " + str(exc)])

    async def run_cve_search(self, keyword: str, scan_id: str) -> list[CveResult]:
        """Search NVD for CVEs and store results."""
        await self._store_history(scan_id, "vuln_cve", keyword, "running", 0)
        try:
            results = await self._nvd.search_cve(keyword)
            severity = "info"
            critical_count = sum(1 for r in results if r.severity == "CRITICAL")
            high_count = sum(1 for r in results if r.severity == "HIGH")
            if critical_count > 0:
                severity = "critical"
            elif high_count > 0:
                severity = "high"
            elif results:
                severity = "medium"
            result_dicts = [r.model_dump() for r in results]
            await self._store_result(scan_id, "vuln_cve", keyword, result_dicts, severity)
            await self._store_history(scan_id, "vuln_cve", keyword, "completed", len(results))
            return results
        except Exception as exc:
            logger.error("CVE search failed: %s", exc)
            await self._store_history(scan_id, "vuln_cve", keyword, "error", 0)
            return []

    async def run_dependency_check(
        self, content: str, file_type: str, scan_id: str,
    ) -> list[DependencyVuln]:
        """Check dependencies for known vulnerabilities."""
        target_name = "requirements.txt" if file_type == "requirements" else "package.json"
        await self._store_history(scan_id, "vuln_deps", target_name, "running", 0)
        try:
            if file_type == "requirements":
                results = await check_requirements(content)
            else:
                results = await check_package_json(content)
            severity = "info"
            critical_count = sum(1 for r in results if r.severity == "CRITICAL")
            high_count = sum(1 for r in results if r.severity == "HIGH")
            if critical_count > 0:
                severity = "critical"
            elif high_count > 0:
                severity = "high"
            elif results:
                severity = "medium"
            result_dicts = [r.model_dump() for r in results]
            await self._store_result(scan_id, "vuln_deps", target_name, result_dicts, severity)
            await self._store_history(scan_id, "vuln_deps", target_name, "completed", len(results))
            return results
        except Exception as exc:
            logger.error("Dependency check failed: %s", exc)
            await self._store_history(scan_id, "vuln_deps", target_name, "error", 0)
            return []

    async def run_full_scan(
        self, target: str, scan_id: str, emitter: ProgressEmitter,
    ) -> VulnScanResult:
        """Run a full vulnerability scan combining all modules."""
        await self._store_history(scan_id, "vuln_full", target, "running", 0)
        result = VulnScanResult(target=target)
        try:
            url = target if target.startswith("http") else "https://" + target
            hostname = target.split("://")[-1].split("/")[0].split(":")[0]
            await emitter.emit(0, "running", "Analyzing HTTP headers", "vuln_full")
            result.headers = await analyze_headers(url)
            await emitter.emit(30, "running", "Checking SSL/TLS", "vuln_full")
            result.ssl = await check_ssl(hostname)
            await emitter.emit(60, "running", "Searching for CVEs", "vuln_full")
            result.cves = await self._nvd.search_cve(hostname)
            await emitter.emit(100, "completed", "Full vulnerability scan complete", "vuln_full")
            total = len(result.headers) + len(result.cves) + (1 if result.ssl else 0)
            await self._store_result(scan_id, "vuln_full", target, [result.model_dump()])
            await self._store_history(scan_id, "vuln_full", target, "completed", total)
            return result
        except Exception as exc:
            logger.error("Full vuln scan failed: %s", exc)
            await self._store_history(scan_id, "vuln_full", target, "error", 0)
            await emitter.emit(100, "error", str(exc), "vuln_full")
            return result
