"""Abuse.ch ThreatFox API client.

Provides access to the ThreatFox API for querying Indicators of
Compromise (IOCs), malware families, and associated tags.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_BASE_URL = "https://threatfox-api.abuse.ch/api/v1/"
_TIMEOUT = 30.0


class AbusechClient:
    """Client for the Abuse.ch ThreatFox API.

    ThreatFox is a free, community-driven platform for sharing IOCs.
    No API key is required for read-only access.
    """

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Execute a POST request to the ThreatFox API."""
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                _BASE_URL,
                json=payload,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            result: dict[str, Any] = response.json()
            return result

    def _normalize_iocs(self, data: dict[str, Any]) -> list[dict[str, Any]]:
        """Extract and normalize IOC entries from a ThreatFox response."""
        if data.get("query_status") != "ok":
            return []

        results: list[dict[str, Any]] = []
        for entry in data.get("data", []):
            results.append({
                "id": entry.get("id", ""),
                "ioc_type": entry.get("ioc_type", ""),
                "ioc_value": entry.get("ioc", ""),
                "threat_type": entry.get("threat_type", ""),
                "malware": entry.get("malware_printable", ""),
                "malware_alias": entry.get("malware_alias", ""),
                "confidence": entry.get("confidence_level", 0),
                "first_seen": entry.get("first_seen_utc", ""),
                "last_seen": entry.get("last_seen_utc", ""),
                "reporter": entry.get("reporter", ""),
                "tags": entry.get("tags", []),
                "reference": entry.get("reference", ""),
            })
        return results

    async def query_ioc(self, search_term: str) -> list[dict[str, Any]]:
        """Search IOCs on ThreatFox by a general search term."""
        try:
            data = await self._post({
                "query": "search_ioc",
                "search_term": search_term,
            })
            return self._normalize_iocs(data)
        except httpx.HTTPStatusError as exc:
            logger.error("ThreatFox IOC search failed for '%s': %s", search_term, exc.response.status_code)
            return []
        except httpx.TimeoutException:
            logger.error("ThreatFox IOC search timed out for '%s'", search_term)
            return []
        except Exception:
            logger.exception("ThreatFox IOC search unexpected error for '%s'", search_term)
            return []

    async def get_ioc_by_id(self, ioc_id: int) -> dict[str, Any]:
        """Retrieve a specific IOC by its ThreatFox ID."""
        try:
            data = await self._post({
                "query": "ioc",
                "id": ioc_id,
            })
            if data.get("query_status") == "ok" and data.get("data"):
                entries = data["data"]
                entry = entries[0] if isinstance(entries, list) else entries
                return {
                    "id": entry.get("id", ioc_id),
                    "ioc_type": entry.get("ioc_type", ""),
                    "ioc_value": entry.get("ioc", ""),
                    "threat_type": entry.get("threat_type", ""),
                    "malware": entry.get("malware_printable", ""),
                    "confidence": entry.get("confidence_level", 0),
                    "first_seen": entry.get("first_seen_utc", ""),
                    "last_seen": entry.get("last_seen_utc", ""),
                    "reporter": entry.get("reporter", ""),
                    "tags": entry.get("tags", []),
                    "reference": entry.get("reference", ""),
                }
            return {"id": ioc_id, "error": data.get("query_status", "unknown")}
        except httpx.HTTPStatusError as exc:
            logger.error("ThreatFox IOC fetch failed for id=%d: %s", ioc_id, exc.response.status_code)
            return {"id": ioc_id, "error": f"HTTP {exc.response.status_code}"}
        except httpx.TimeoutException:
            logger.error("ThreatFox IOC fetch timed out for id=%d", ioc_id)
            return {"id": ioc_id, "error": "Request timed out"}
        except Exception:
            logger.exception("ThreatFox IOC fetch unexpected error for id=%d", ioc_id)
            return {"id": ioc_id, "error": "Unexpected error"}

    async def query_malware(self, malware: str) -> list[dict[str, Any]]:
        """Search IOCs by malware family name."""
        try:
            data = await self._post({
                "query": "malwareinfo",
                "malware": malware,
            })
            return self._normalize_iocs(data)
        except httpx.HTTPStatusError as exc:
            logger.error("ThreatFox malware search failed for '%s': %s", malware, exc.response.status_code)
            return []
        except httpx.TimeoutException:
            logger.error("ThreatFox malware search timed out for '%s'", malware)
            return []
        except Exception:
            logger.exception("ThreatFox malware search unexpected error for '%s'", malware)
            return []

    async def query_tag(self, tag: str) -> list[dict[str, Any]]:
        """Search IOCs by tag."""
        try:
            data = await self._post({
                "query": "taginfo",
                "tag": tag,
            })
            return self._normalize_iocs(data)
        except httpx.HTTPStatusError as exc:
            logger.error("ThreatFox tag search failed for '%s': %s", tag, exc.response.status_code)
            return []
        except httpx.TimeoutException:
            logger.error("ThreatFox tag search timed out for '%s'", tag)
            return []
        except Exception:
            logger.exception("ThreatFox tag search unexpected error for '%s'", tag)
            return []
