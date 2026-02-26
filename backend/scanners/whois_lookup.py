"""WHOIS domain lookup scanner.

Queries WHOIS servers for domain registration information using
the python-whois library.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any

import whois

from backend.models.recon import WhoisResult

logger = logging.getLogger(__name__)


def _normalize_date(value: Any) -> str:
    """Convert a WHOIS date field to an ISO-8601 string.

    python-whois may return a datetime, a list of datetimes, or a string.
    """
    if value is None:
        return ""
    if isinstance(value, list):
        value = value[0] if value else None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _normalize_list(value: Any) -> list[str]:
    """Ensure a WHOIS field is returned as a list of strings."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(v) for v in value]
    return [str(value)]


async def lookup_whois(domain: str) -> WhoisResult:
    """Perform a WHOIS lookup for *domain*.

    Runs the synchronous python-whois call in a thread executor
    to keep the event loop responsive.

    Args:
        domain: Domain name to query.

    Returns:
        Parsed WhoisResult with registration details.
    """
    loop = asyncio.get_running_loop()

    try:
        w = await loop.run_in_executor(None, whois.whois, domain)

        # Build a safe raw dict from the whois object
        raw: dict[str, Any] = {}
        if hasattr(w, "text"):
            raw["raw_text"] = str(w.text)[:5000]  # Cap raw text size

        name_servers = _normalize_list(w.name_servers)
        status = _normalize_list(w.status)

        return WhoisResult(
            domain=domain,
            registrar=str(w.registrar or ""),
            creation_date=_normalize_date(w.creation_date),
            expiration_date=_normalize_date(w.expiration_date),
            name_servers=[ns.lower() for ns in name_servers],
            status=status,
            raw=raw,
        )
    except Exception as exc:
        logger.error("WHOIS lookup failed for %s: %s", domain, exc)
        return WhoisResult(
            domain=domain,
            registrar="",
            creation_date="",
            expiration_date="",
            name_servers=[],
            status=[],
            raw={"error": str(exc)},
        )
