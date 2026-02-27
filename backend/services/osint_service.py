"""OSINT orchestration service."""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.database import db
from backend.integrations.hibp_client import HIBPClient
from backend.integrations.shodan_client import ShodanClient
from backend.integrations.virustotal_client import VirusTotalClient
from backend.models.osint import (
    BreachResult,
    ReputationResult,
    ShodanHostResult,
    VirusTotalResult,
)

logger = logging.getLogger(__name__)


class OsintService:
    """Orchestrates OSINT scanning operations."""

    def __init__(
        self,
        shodan_key: str = "",
        virustotal_key: str = "",
        hibp_key: str = "",
    ) -> None:
        self._shodan = ShodanClient(shodan_key) if shodan_key else None
        self._virustotal = VirusTotalClient(virustotal_key) if virustotal_key else None
        self._hibp = HIBPClient(hibp_key)

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

    async def run_shodan_lookup(self, ip: str, scan_id: str) -> ShodanHostResult:
        """Run a Shodan host lookup and store results."""
        await self._store_history(scan_id, "osint_shodan", ip, "running", 0)
        if not self._shodan:
            logger.error("Shodan API key not configured")
            await self._store_history(scan_id, "osint_shodan", ip, "error", 0)
            return ShodanHostResult(ip=ip)
        try:
            result = await self._shodan.search_host(ip)
            await self._store_result(scan_id, "osint_shodan", ip, [result.model_dump()])
            await self._store_history(scan_id, "osint_shodan", ip, "completed", len(result.ports))
            return result
        except Exception as exc:
            logger.error("Shodan lookup failed: %s", exc)
            await self._store_history(scan_id, "osint_shodan", ip, "error", 0)
            return ShodanHostResult(ip=ip)

    async def run_virustotal_scan(
        self, target: str, target_type: str, scan_id: str,
    ) -> VirusTotalResult:
        """Run a VirusTotal scan and store results."""
        await self._store_history(scan_id, "osint_virustotal", target, "running", 0)
        if not self._virustotal:
            logger.error("VirusTotal API key not configured")
            await self._store_history(scan_id, "osint_virustotal", target, "error", 0)
            return VirusTotalResult(target=target, target_type=target_type)
        try:
            scan_methods = {
                "url": self._virustotal.scan_url,
                "domain": self._virustotal.scan_domain,
                "ip": self._virustotal.scan_ip,
                "hash": self._virustotal.scan_hash,
            }
            scan_fn = scan_methods.get(target_type, self._virustotal.scan_domain)
            result = await scan_fn(target)
            severity = "info"
            if result.positives > 5:
                severity = "critical"
            elif result.positives > 2:
                severity = "high"
            elif result.positives > 0:
                severity = "medium"
            await self._store_result(
                scan_id, "osint_virustotal", target, [result.model_dump()], severity,
            )
            await self._store_history(
                scan_id, "osint_virustotal", target, "completed", result.positives,
            )
            return result
        except Exception as exc:
            logger.error("VirusTotal scan failed: %s", exc)
            await self._store_history(scan_id, "osint_virustotal", target, "error", 0)
            return VirusTotalResult(target=target, target_type=target_type)

    async def run_hibp_check(
        self, target: str, target_type: str, scan_id: str,
    ) -> list[BreachResult]:
        """Run an HIBP breach check and store results."""
        await self._store_history(scan_id, "osint_hibp", target, "running", 0)
        try:
            if target_type == "email":
                results = await self._hibp.check_email(target)
            else:
                results = await self._hibp.check_domain(target)
            severity = "info"
            if len(results) > 5:
                severity = "high"
            elif len(results) > 0:
                severity = "medium"
            result_dicts = [r.model_dump() for r in results]
            await self._store_result(scan_id, "osint_hibp", target, result_dicts, severity)
            await self._store_history(scan_id, "osint_hibp", target, "completed", len(results))
            return results
        except Exception as exc:
            logger.error("HIBP check failed: %s", exc)
            await self._store_history(scan_id, "osint_hibp", target, "error", 0)
            return []

    async def run_reputation_check(self, target: str, scan_id: str) -> ReputationResult:
        """Run a reputation check using VirusTotal data."""
        await self._store_history(scan_id, "osint_reputation", target, "running", 0)
        try:
            vt_result: Optional[VirusTotalResult] = None
            if self._virustotal:
                try:
                    vt_result = await self._virustotal.scan_domain(target)
                except Exception:
                    try:
                        vt_result = await self._virustotal.scan_ip(target)
                    except Exception:
                        pass

            score = 0.0
            categories: list[str] = []
            details: dict[str, Any] = {}

            if not self._virustotal:
                # No API key configured
                details["Status"] = "VirusTotal API key not configured"
                details["Action"] = "Add your API key in Settings to enable reputation checks"
            elif vt_result and vt_result.total > 0:
                # Score = reputation quality (100 = clean, 0 = fully malicious)
                threat_pct = (vt_result.positives / vt_result.total) * 100
                score = round(100.0 - threat_pct, 2)
                categories.append("Clean" if vt_result.positives == 0 else "Malicious")
                details["Detections"] = f"{vt_result.positives} / {vt_result.total} engines"
                details["Source"] = "VirusTotal"
                details["Target"] = target
            elif vt_result is not None:
                score = 50.0
                details["Status"] = "No scan data returned by VirusTotal"
                details["Source"] = "VirusTotal"
            else:
                details["Status"] = "VirusTotal lookup failed"

            result = ReputationResult(
                target=target, reputation_score=round(score, 2),
                categories=categories, details=details,
            )
            # Severity based on how LOW the reputation score is
            severity = "info"
            if score < 20:
                severity = "critical"
            elif score < 40:
                severity = "high"
            elif score < 60:
                severity = "medium"
            await self._store_result(
                scan_id, "osint_reputation", target, [result.model_dump()], severity,
            )
            await self._store_history(scan_id, "osint_reputation", target, "completed", 1)
            return result
        except Exception as exc:
            logger.error("Reputation check failed: %s", exc)
            await self._store_history(scan_id, "osint_reputation", target, "error", 0)
            return ReputationResult(target=target, reputation_score=0.0)
