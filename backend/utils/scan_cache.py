"""Scan result caching and deduplication.

Checks the database for recent scan results before re-running scans,
and prevents duplicate concurrent scans for the same target/type.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

from backend.database import db

logger = logging.getLogger(__name__)

# Default cache TTL in seconds (15 minutes)
_DEFAULT_TTL = 900

# Track in-flight scans to prevent duplicates
_in_flight: dict[str, asyncio.Event] = {}
_in_flight_lock = asyncio.Lock()


async def get_cached_result(
    scan_type: str,
    target: str,
    ttl: int = _DEFAULT_TTL,
) -> list[dict] | None:
    """Return cached scan results if they exist and are within TTL.

    Args:
        scan_type: The scan type key (e.g. 'recon_full', 'vuln_headers').
        target: The scan target (domain, IP, URL).
        ttl: Maximum age in seconds for cached results to be valid.

    Returns:
        Parsed results list if a fresh cache hit exists, None otherwise.
    """
    conn = await db.get_connection()
    cursor = await conn.execute(
        "SELECT results_json, created_at FROM scan_results "
        "WHERE scan_type = ? AND target = ? "
        "ORDER BY created_at DESC LIMIT 1",
        (scan_type, target),
    )
    row = await cursor.fetchone()
    if row is None:
        return None

    created_at_str = row["created_at"]
    try:
        created_at = datetime.fromisoformat(created_at_str)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - created_at).total_seconds()
        if age <= ttl:
            logger.debug("Cache hit for %s/%s (age=%.0fs)", scan_type, target, age)
            return json.loads(row["results_json"])
    except (ValueError, TypeError) as exc:
        logger.debug("Cache parse error for %s/%s: %s", scan_type, target, exc)

    return None


async def acquire_scan_lock(scan_type: str, target: str) -> bool:
    """Try to acquire a lock for a scan type/target combination.

    Returns True if the lock was acquired (caller should proceed with scan).
    Returns False if another scan for the same type/target is already running.
    In that case, the caller should wait on the event.
    """
    key = f"{scan_type}:{target}"
    async with _in_flight_lock:
        if key in _in_flight:
            return False
        _in_flight[key] = asyncio.Event()
        return True


async def wait_for_scan(scan_type: str, target: str, timeout: float = 300) -> bool:
    """Wait for an in-flight scan to complete.

    Returns True if the scan completed, False on timeout.
    """
    key = f"{scan_type}:{target}"
    async with _in_flight_lock:
        event = _in_flight.get(key)
    if event is None:
        return True
    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
        return True
    except asyncio.TimeoutError:
        return False


async def release_scan_lock(scan_type: str, target: str) -> None:
    """Release the scan lock and notify waiters."""
    key = f"{scan_type}:{target}"
    async with _in_flight_lock:
        event = _in_flight.pop(key, None)
    if event is not None:
        event.set()
