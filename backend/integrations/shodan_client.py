"""Shodan API client for host and domain intelligence.

Wraps the shodan Python library to provide async-compatible
methods for querying Shodan host and domain data.
"""

import asyncio
import logging
from typing import Any, Optional

from backend.models.osint import ShodanHostResult
from backend.utils.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)

try:
    import shodan as shodan_lib
    _SHODAN_AVAILABLE = True
except ImportError:
    _SHODAN_AVAILABLE = False
    logger.warning("shodan library not available -- install with: pip install shodan")


class ShodanClient:
    """Async wrapper around the Shodan API."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._api: Optional[object] = None
        if _SHODAN_AVAILABLE and api_key:
            self._api = shodan_lib.Shodan(api_key)

    async def search_host(self, ip: str) -> ShodanHostResult:
        """Look up host information for an IP address.

        Args:
            ip: IPv4 or IPv6 address to query.

        Returns:
            ShodanHostResult with open ports, services, and vulns.
        """
        if not self._api:
            logger.error("Shodan API not initialized (missing key or library)")
            return ShodanHostResult(ip=ip)

        loop = asyncio.get_running_loop()

        def _query() -> dict:
            return self._api.host(ip)

        try:
            await rate_limiter.acquire("shodan")
            data = await loop.run_in_executor(None, _query)
            vulns_raw = data.get("vulns", [])
            if isinstance(vulns_raw, dict):
                vulns_list = list(vulns_raw.keys())
            else:
                vulns_list = vulns_raw

            return ShodanHostResult(
                ip=ip,
                ports=data.get("ports", []),
                hostnames=data.get("hostnames", []),
                org=data.get("org", ""),
                os=data.get("os", "") or "",
                vulns=vulns_list,
                data=[
                    {
                        "port": item.get("port"),
                        "transport": item.get("transport", ""),
                        "product": item.get("product", ""),
                        "version": item.get("version", ""),
                        "banner": (item.get("data", ""))[:500],
                    }
                    for item in data.get("data", [])[:20]
                ],
            )
        except Exception as exc:
            logger.error("Shodan host lookup failed for %s: %s", ip, exc)
            return ShodanHostResult(ip=ip)

    async def search_domain(self, domain: str) -> dict[str, Any]:
        """Look up domain information via Shodan DNS.

        Args:
            domain: Domain name to query.

        Returns:
            Raw Shodan DNS result dictionary.
        """
        if not self._api:
            logger.error("Shodan API not initialized")
            return {"error": "Shodan API not configured"}

        loop = asyncio.get_running_loop()

        def _query() -> dict:
            return self._api.dns.domain_info(domain)

        try:
            await rate_limiter.acquire("shodan")
            return await loop.run_in_executor(None, _query)
        except Exception as exc:
            logger.error("Shodan domain lookup failed for %s: %s", domain, exc)
            return {"error": str(exc)}
