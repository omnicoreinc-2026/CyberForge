"""Seek & Enter orchestration service.

Coordinates CIDR scanning, result caching, and exploitation sessions.
"""

import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional
from uuid import uuid4

from backend.database import db
from backend.models.seek_enter import (
    EnterEvent,
    EnterRequest,
    EnterResult,
    SeekResult,
)
from backend.scanners.enter_engine import _event, run_exploit, select_exploit
from backend.scanners.seek_scanner import seek_scan

logger = logging.getLogger(__name__)


class SeekEnterService:
    """Orchestrates Seek & Enter operations."""

    def __init__(self) -> None:
        self._seek_cache: dict[str, SeekResult] = {}
        self._enter_sessions: dict[str, EnterResult] = {}

    async def _store_history(
        self, scan_id: str, module: str, target: str,
        status: str, result_count: int,
    ) -> None:
        conn = await db.get_connection()
        now = datetime.now(timezone.utc).isoformat()
        await conn.execute(
            "INSERT OR REPLACE INTO scan_history "
            "(id, module, target, status, started_at, completed_at, result_count) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (scan_id, module, target, status, now,
             now if status in ("completed", "error") else None, result_count),
        )
        await conn.commit()

    async def _store_result(
        self, scan_id: str, scan_type: str, target: str,
        results: list[dict], severity: str = "info",
    ) -> None:
        conn = await db.get_connection()
        await conn.execute(
            "INSERT OR REPLACE INTO scan_results "
            "(id, scan_type, target, results_json, severity, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (scan_id, scan_type, target, json.dumps(results), severity,
             datetime.now(timezone.utc).isoformat()),
        )
        await conn.commit()

    # --- Seek Phase ---

    async def run_seek(
        self, cidr: str, ports: str = "1-1000",
    ) -> SeekResult:
        """Run CIDR discovery scan and cache results."""
        scan_id = str(uuid4())
        await self._store_history(scan_id, "seek_scan", cidr, "running", 0)

        try:
            result = await seek_scan(cidr, ports)
            result.scan_id = scan_id
            self._seek_cache[scan_id] = result

            total_findings = sum(
                len(h.services) + len(h.vulns) for h in result.hosts
            )
            await self._store_result(
                scan_id, "seek_scan", cidr,
                [h.model_dump() for h in result.hosts],
                severity="high" if any(
                    v.cvss >= 7.0 for h in result.hosts for v in h.vulns
                ) else "medium" if result.hosts else "info",
            )
            await self._store_history(
                scan_id, "seek_scan", cidr, "completed", total_findings,
            )
            return result

        except Exception as exc:
            logger.error("Seek scan failed for %s: %s", cidr, exc)
            await self._store_history(scan_id, "seek_scan", cidr, "error", 0)
            raise

    def get_seek_result(self, scan_id: str) -> Optional[SeekResult]:
        """Retrieve a cached seek result by scan_id."""
        return self._seek_cache.get(scan_id)

    # --- Enter Phase ---

    async def run_enter(
        self, request: EnterRequest,
    ) -> AsyncGenerator[EnterEvent, None]:
        """Execute exploitation and yield terminal events for SSE streaming."""
        session_id = str(uuid4())
        await self._store_history(
            session_id, "enter_exploit",
            f"{request.target_ip}:{request.port}", "running", 0,
        )

        exploit_id = select_exploit(
            request.service, request.port, request.exploit_id,
        )

        if not exploit_id:
            yield _event("error", f"[!] No exploit module available for {request.service}:{request.port}")
            await self._store_history(
                session_id, "enter_exploit",
                f"{request.target_ip}:{request.port}", "error", 0,
            )
            return

        yield _event("info", f"[*] Session ID: {session_id}")
        yield _event("info", f"[*] Selected module: {exploit_id}")

        success = False
        method = exploit_id
        access_level = "none"
        loot: list[str] = []

        try:
            async for event in run_exploit(
                request.target_ip, request.port,
                request.service, exploit_id, request.options,
            ):
                if event.event_type == "success":
                    success = True
                    if "root" in event.message.lower():
                        access_level = "root"
                    elif "admin" in event.message.lower():
                        access_level = "admin"
                    else:
                        access_level = "user"
                    loot.append(event.message)

                yield event

        except Exception as exc:
            yield _event("error", f"[!] Module crashed: {exc}")
            logger.exception("Enter module %s failed", exploit_id)

        enter_result = EnterResult(
            session_id=session_id,
            target_ip=request.target_ip,
            port=request.port,
            service=request.service,
            success=success,
            method=method,
            access_level=access_level,
            loot=loot,
        )
        self._enter_sessions[session_id] = enter_result

        await self._store_result(
            session_id, "enter_exploit",
            f"{request.target_ip}:{request.port}",
            [enter_result.model_dump()],
            severity="critical" if success else "info",
        )
        await self._store_history(
            session_id, "enter_exploit",
            f"{request.target_ip}:{request.port}",
            "completed", 1 if success else 0,
        )

        yield _event(
            "complete",
            f"[*] Result: {'SUCCESS' if success else 'FAILED'} | "
            f"Access: {access_level} | Method: {method}",
        )


seek_enter_service = SeekEnterService()
