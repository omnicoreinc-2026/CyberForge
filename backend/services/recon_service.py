"""Recon orchestration service.

Coordinates subdomain enumeration, port scanning, WHOIS lookups,
DNS analysis, and technology fingerprinting. Stores results in the
database and emits progress updates over WebSocket.
"""

import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from backend.database import db
from backend.models.recon import (
    DnsRecord,
    PortScanResult,
    ReconFullResult,
    SubdomainResult,
    TechStackResult,
    WhoisResult,
)
from backend.scanners.dns_analyzer import analyze_dns
from backend.scanners.nmap_scanner import scan_ports
from backend.scanners.subdomain_enum import enumerate_subdomains
from backend.scanners.tech_fingerprint import fingerprint_tech
from backend.scanners.whois_lookup import lookup_whois
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)


class ReconService:
    """Orchestrates reconnaissance scanning operations."""

    async def _store_result(
        self,
        scan_id: str,
        scan_type: str,
        target: str,
        results: list[dict],
        severity: str = "info",
    ) -> None:
        """Persist scan results to the database."""
        conn = await db.get_connection()
        await conn.execute(
            "INSERT OR REPLACE INTO scan_results (id, scan_type, target, results_json, severity, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (scan_id, scan_type, target, json.dumps(results), severity, datetime.now(timezone.utc).isoformat()),
        )
        await conn.commit()

    async def _store_history(
        self,
        scan_id: str,
        module: str,
        target: str,
        status: str,
        result_count: int,
    ) -> None:
        """Record scan execution in scan_history."""
        conn = await db.get_connection()
        now = datetime.now(timezone.utc).isoformat()
        await conn.execute(
            "INSERT OR REPLACE INTO scan_history (id, module, target, status, started_at, completed_at, result_count) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (scan_id, module, target, status, now, now if status in ("completed", "error") else None, result_count),
        )
        await conn.commit()

    async def run_subdomain_scan(
        self,
        domain: str,
        scan_id: str,
        emitter: ProgressEmitter,
    ) -> list[SubdomainResult]:
        """Run subdomain enumeration and store results."""
        await self._store_history(scan_id, "recon_subdomains", domain, "running", 0)
        try:
            results = await enumerate_subdomains(domain, progress_emitter=emitter)
            result_dicts = [r.model_dump() for r in results]
            await self._store_result(scan_id, "recon_subdomains", domain, result_dicts)
            await self._store_history(scan_id, "recon_subdomains", domain, "completed", len(results))
            return results
        except Exception as exc:
            logger.error("Subdomain scan failed: %s", exc)
            await self._store_history(scan_id, "recon_subdomains", domain, "error", 0)
            await emitter.emit(100, "error", str(exc), "subdomain_enum")
            return []

    async def run_port_scan(
        self,
        target: str,
        ports: str,
        scan_id: str,
        emitter: ProgressEmitter,
    ) -> list[PortScanResult]:
        """Run port scan and store results."""
        await self._store_history(scan_id, "recon_ports", target, "running", 0)
        try:
            results = await scan_ports(target, ports=ports, progress_emitter=emitter)
            result_dicts = [r.model_dump() for r in results]
            await self._store_result(scan_id, "recon_ports", target, result_dicts)
            await self._store_history(scan_id, "recon_ports", target, "completed", len(results))
            return results
        except Exception as exc:
            logger.error("Port scan failed: %s", exc)
            await self._store_history(scan_id, "recon_ports", target, "error", 0)
            await emitter.emit(100, "error", str(exc), "port_scan")
            return []

    async def run_whois(self, domain: str) -> WhoisResult:
        """Run WHOIS lookup (no progress emitter needed -- fast operation)."""
        return await lookup_whois(domain)

    async def run_dns_analysis(self, domain: str) -> list[DnsRecord]:
        """Run DNS record analysis."""
        return await analyze_dns(domain)

    async def run_tech_fingerprint(self, url: str) -> list[TechStackResult]:
        """Run technology stack fingerprinting."""
        return await fingerprint_tech(url)

    async def run_full_recon(
        self,
        target: str,
        scan_id: str,
        emitter: ProgressEmitter,
    ) -> ReconFullResult:
        """Run a full reconnaissance scan combining all modules.

        Executes subdomain enumeration, port scanning, WHOIS lookup,
        DNS analysis, and technology fingerprinting sequentially.
        """
        await self._store_history(scan_id, "recon_full", target, "running", 0)
        result = ReconFullResult(target=target)

        try:
            # Phase 1: Subdomains (0-30%)
            await emitter.emit(0, "running", "Starting subdomain enumeration", "recon_full")
            result.subdomains = await enumerate_subdomains(target)
            await emitter.emit(20, "running", "Subdomain enumeration complete", "recon_full")

            # Phase 2: Port scan (30-55%)
            await emitter.emit(25, "running", "Starting port scan", "recon_full")
            result.ports = await scan_ports(target, ports="1-1000")
            await emitter.emit(50, "running", "Port scan complete", "recon_full")

            # Phase 3: WHOIS (55-65%)
            await emitter.emit(55, "running", "Running WHOIS lookup", "recon_full")
            result.whois = await lookup_whois(target)
            await emitter.emit(65, "running", "WHOIS lookup complete", "recon_full")

            # Phase 4: DNS (65-80%)
            await emitter.emit(65, "running", "Analyzing DNS records", "recon_full")
            result.dns_records = await analyze_dns(target)
            await emitter.emit(80, "running", "DNS analysis complete", "recon_full")

            # Phase 5: Tech fingerprint (80-100%)
            url = "https://" + target if not target.startswith("http") else target
            await emitter.emit(80, "running", "Fingerprinting technology stack", "recon_full")
            result.tech_stack = await fingerprint_tech(url)
            await emitter.emit(100, "completed", "Full recon complete", "recon_full")

            # Store aggregated results
            total_findings = (
                len(result.subdomains) + len(result.ports) +
                len(result.dns_records) + len(result.tech_stack) +
                (1 if result.whois else 0)
            )
            await self._store_result(
                scan_id, "recon_full", target,
                [result.model_dump()],
            )
            await self._store_history(scan_id, "recon_full", target, "completed", total_findings)
            return result

        except Exception as exc:
            logger.error("Full recon failed for %s: %s", target, exc)
            await self._store_history(scan_id, "recon_full", target, "error", 0)
            await emitter.emit(100, "error", str(exc), "recon_full")
            return result
