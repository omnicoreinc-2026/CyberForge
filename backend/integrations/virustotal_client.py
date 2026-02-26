"""VirusTotal API v3 client.

Provides async methods for scanning URLs, domains, IPs, and file
hashes against the VirusTotal threat intelligence database.
"""

import logging
from typing import Any

import httpx

from backend.models.osint import VirusTotalResult
from backend.utils.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)

_VT_API_BASE = "https://www.virustotal.com/api/v3"


class VirusTotalClient:
    """Async client for the VirusTotal API v3."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._headers = {"x-apikey": api_key}

    async def _request(self, endpoint: str) -> dict[str, Any]:
        """Make an authenticated GET request to the VT API.

        Args:
            endpoint: API path (e.g. /urls/{id}).

        Returns:
            Parsed JSON response dict.
        """
        try:
            await rate_limiter.acquire("virustotal")
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    _VT_API_BASE + endpoint,
                    headers=self._headers,
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            logger.error("VT API error %d for %s: %s", exc.response.status_code, endpoint, exc)
            return {"error": str(exc)}
        except Exception as exc:
            logger.error("VT request failed for %s: %s", endpoint, exc)
            return {"error": str(exc)}

    def _parse_response(
        self, data: dict[str, Any], target: str, target_type: str
    ) -> VirusTotalResult:
        """Parse a VT API response into a VirusTotalResult."""
        if "error" in data:
            return VirusTotalResult(
                target=target,
                target_type=target_type,
                results=data,
            )

        attributes = data.get("data", {}).get("attributes", {})
        stats = attributes.get("last_analysis_stats", {})
        positives = stats.get("malicious", 0) + stats.get("suspicious", 0)
        total = sum(stats.values()) if stats else 0

        analysis_results = attributes.get("last_analysis_results", {})
        scan_date = attributes.get("last_analysis_date", "")
        if isinstance(scan_date, int):
            from datetime import datetime, timezone
            scan_date = datetime.fromtimestamp(scan_date, tz=timezone.utc).isoformat()

        links = data.get("data", {}).get("links", {})
        permalink = links.get("self", "")

        return VirusTotalResult(
            target=target,
            target_type=target_type,
            positives=positives,
            total=total,
            scan_date=str(scan_date),
            results={
                name: {
                    "category": info.get("category", ""),
                    "result": info.get("result", ""),
                    "engine_name": info.get("engine_name", name),
                }
                for name, info in list(analysis_results.items())[:50]
            },
            permalink=permalink,
        )

    async def scan_url(self, url: str) -> VirusTotalResult:
        """Scan a URL against VirusTotal.

        Args:
            url: URL to scan.

        Returns:
            VirusTotalResult with detection results.
        """
        import base64
        url_id = base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")
        data = await self._request("/urls/" + url_id)
        return self._parse_response(data, url, "url")

    async def scan_domain(self, domain: str) -> VirusTotalResult:
        """Scan a domain against VirusTotal.

        Args:
            domain: Domain name to scan.

        Returns:
            VirusTotalResult with detection results.
        """
        data = await self._request("/domains/" + domain)
        return self._parse_response(data, domain, "domain")

    async def scan_ip(self, ip: str) -> VirusTotalResult:
        """Scan an IP address against VirusTotal.

        Args:
            ip: IP address to scan.

        Returns:
            VirusTotalResult with detection results.
        """
        data = await self._request("/ip_addresses/" + ip)
        return self._parse_response(data, ip, "ip")

    async def scan_hash(self, file_hash: str) -> VirusTotalResult:
        """Look up a file hash in VirusTotal.

        Args:
            file_hash: MD5, SHA-1, or SHA-256 hash.

        Returns:
            VirusTotalResult with detection results.
        """
        data = await self._request("/files/" + file_hash)
        return self._parse_response(data, file_hash, "file")
