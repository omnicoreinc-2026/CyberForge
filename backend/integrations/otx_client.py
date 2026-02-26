"""AlienVault OTX (Open Threat Exchange) API client.

Provides access to OTX DirectConnect API v2 for querying threat
intelligence indicators including IPs, domains, URLs, and file hashes.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_BASE_URL = "https://otx.alienvault.com/api/v1"
_TIMEOUT = 30.0


class OtxClient:
    """Client for the AlienVault OTX DirectConnect API v2."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._headers = {
            "X-OTX-API-KEY": api_key,
            "Accept": "application/json",
        }

    async def _get(self, path: str) -> dict[str, Any]:
        """Execute an authenticated GET request against the OTX API."""
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(
                f"{_BASE_URL}{path}",
                headers=self._headers,
            )
            response.raise_for_status()
            result: dict[str, Any] = response.json()
            return result

    async def get_indicator_ip(self, ip: str) -> dict[str, Any]:
        """Get IP reputation and threat data from OTX."""
        try:
            general = await self._get(f"/indicators/IPv4/{ip}/general")
            return {
                "ip": ip,
                "general": general,
                "pulse_count": general.get("pulse_info", {}).get("count", 0),
                "reputation": general.get("reputation", 0),
                "country": general.get("country_name", ""),
                "asn": general.get("asn", ""),
            }
        except httpx.HTTPStatusError as exc:
            logger.error("OTX IP lookup failed for %s: %s", ip, exc.response.status_code)
            return {"ip": ip, "error": f"HTTP {exc.response.status_code}", "pulse_count": 0}
        except httpx.TimeoutException:
            logger.error("OTX IP lookup timed out for %s", ip)
            return {"ip": ip, "error": "Request timed out", "pulse_count": 0}
        except Exception:
            logger.exception("OTX IP lookup unexpected error for %s", ip)
            return {"ip": ip, "error": "Unexpected error", "pulse_count": 0}

    async def get_indicator_domain(self, domain: str) -> dict[str, Any]:
        """Get domain reputation and threat data from OTX."""
        try:
            general = await self._get(f"/indicators/domain/{domain}/general")
            return {
                "domain": domain,
                "general": general,
                "pulse_count": general.get("pulse_info", {}).get("count", 0),
                "whois": general.get("whois", ""),
                "alexa": general.get("alexa", ""),
            }
        except httpx.HTTPStatusError as exc:
            logger.error("OTX domain lookup failed for %s: %s", domain, exc.response.status_code)
            return {"domain": domain, "error": f"HTTP {exc.response.status_code}", "pulse_count": 0}
        except httpx.TimeoutException:
            logger.error("OTX domain lookup timed out for %s", domain)
            return {"domain": domain, "error": "Request timed out", "pulse_count": 0}
        except Exception:
            logger.exception("OTX domain lookup unexpected error for %s", domain)
            return {"domain": domain, "error": "Unexpected error", "pulse_count": 0}

    async def get_indicator_url(self, url: str) -> dict[str, Any]:
        """Get URL analysis data from OTX."""
        try:
            general = await self._get(f"/indicators/url/{url}/general")
            return {
                "url": url,
                "general": general,
                "pulse_count": general.get("pulse_info", {}).get("count", 0),
                "alexa": general.get("alexa", ""),
            }
        except httpx.HTTPStatusError as exc:
            logger.error("OTX URL lookup failed for %s: %s", url, exc.response.status_code)
            return {"url": url, "error": f"HTTP {exc.response.status_code}", "pulse_count": 0}
        except httpx.TimeoutException:
            logger.error("OTX URL lookup timed out for %s", url)
            return {"url": url, "error": "Request timed out", "pulse_count": 0}
        except Exception:
            logger.exception("OTX URL lookup unexpected error for %s", url)
            return {"url": url, "error": "Unexpected error", "pulse_count": 0}

    async def get_indicator_hash(self, file_hash: str) -> dict[str, Any]:
        """Get file hash analysis data from OTX."""
        try:
            general = await self._get(f"/indicators/file/{file_hash}/general")
            return {
                "hash": file_hash,
                "general": general,
                "pulse_count": general.get("pulse_info", {}).get("count", 0),
            }
        except httpx.HTTPStatusError as exc:
            logger.error("OTX hash lookup failed for %s: %s", file_hash, exc.response.status_code)
            return {"hash": file_hash, "error": f"HTTP {exc.response.status_code}", "pulse_count": 0}
        except httpx.TimeoutException:
            logger.error("OTX hash lookup timed out for %s", file_hash)
            return {"hash": file_hash, "error": "Request timed out", "pulse_count": 0}
        except Exception:
            logger.exception("OTX hash lookup unexpected error for %s", file_hash)
            return {"hash": file_hash, "error": "Unexpected error", "pulse_count": 0}

    async def get_pulses(self, query: str) -> list[dict[str, Any]]:
        """Search OTX pulses by keyword."""
        try:
            data = await self._get(f"/search/pulses?q={query}&page=1&limit=20")
            results: list[dict[str, Any]] = []
            for pulse in data.get("results", []):
                results.append({
                    "id": pulse.get("id", ""),
                    "name": pulse.get("name", ""),
                    "description": pulse.get("description", ""),
                    "author": pulse.get("author_name", ""),
                    "created": pulse.get("created", ""),
                    "modified": pulse.get("modified", ""),
                    "tags": pulse.get("tags", []),
                    "indicator_count": len(pulse.get("indicators", [])),
                    "targeted_countries": pulse.get("targeted_countries", []),
                })
            return results
        except httpx.HTTPStatusError as exc:
            logger.error("OTX pulse search failed: %s", exc.response.status_code)
            return []
        except httpx.TimeoutException:
            logger.error("OTX pulse search timed out")
            return []
        except Exception:
            logger.exception("OTX pulse search unexpected error")
            return []
