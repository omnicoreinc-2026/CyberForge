"""AbuseIPDB API v2 client.

Provides IP address reputation checking and abuse report retrieval
from the AbuseIPDB database.
"""

import logging
from typing import Any

import httpx

from backend.utils.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.abuseipdb.com/api/v2"
_TIMEOUT = 30.0

# AbuseIPDB category labels for numeric codes.
_CATEGORY_LABELS: dict[int, str] = {
    1: "DNS Compromise",
    2: "DNS Poisoning",
    3: "Fraud Orders",
    4: "DDoS Attack",
    5: "FTP Brute-Force",
    6: "Ping of Death",
    7: "Phishing",
    8: "Fraud VoIP",
    9: "Open Proxy",
    10: "Web Spam",
    11: "Email Spam",
    12: "Blog Spam",
    13: "VPN IP",
    14: "Port Scan",
    15: "Hacking",
    16: "SQL Injection",
    17: "Spoofing",
    18: "Brute-Force",
    19: "Bad Web Bot",
    20: "Exploited Host",
    21: "Web App Attack",
    22: "SSH",
    23: "IoT Targeted",
}


class AbuseIPDBClient:
    """Client for the AbuseIPDB API v2."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._headers = {
            "Key": api_key,
            "Accept": "application/json",
        }

    async def check_ip(self, ip: str) -> dict[str, Any]:
        """Check an IP address reputation on AbuseIPDB."""
        try:
            await rate_limiter.acquire("abuseipdb")
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.get(
                    f"{_BASE_URL}/check",
                    headers=self._headers,
                    params={
                        "ipAddress": ip,
                        "maxAgeInDays": "90",
                        "verbose": "",
                    },
                )
                response.raise_for_status()
                data = response.json().get("data", {})

            category_ids: list[int] = []
            reports_list = data.get("reports", [])
            if reports_list and isinstance(reports_list, list):
                first_report = reports_list[0]
                if isinstance(first_report, dict):
                    category_ids = first_report.get("categories", [])

            categories = [
                _CATEGORY_LABELS.get(cat_id, f"Category {cat_id}")
                for cat_id in category_ids
            ]

            return {
                "ip": data.get("ipAddress", ip),
                "abuse_score": data.get("abuseConfidenceScore", 0),
                "country": data.get("countryName", ""),
                "country_code": data.get("countryCode", ""),
                "isp": data.get("isp", ""),
                "domain": data.get("domain", ""),
                "usage_type": data.get("usageType", ""),
                "total_reports": data.get("totalReports", 0),
                "num_distinct_users": data.get("numDistinctUsers", 0),
                "last_reported": data.get("lastReportedAt", ""),
                "is_whitelisted": data.get("isWhitelisted", False),
                "is_tor": data.get("isTor", False),
                "categories": categories,
            }
        except httpx.HTTPStatusError as exc:
            logger.error("AbuseIPDB check failed for %s: %s", ip, exc.response.status_code)
            return {"ip": ip, "error": f"HTTP {exc.response.status_code}", "abuse_score": 0}
        except httpx.TimeoutException:
            logger.error("AbuseIPDB check timed out for %s", ip)
            return {"ip": ip, "error": "Request timed out", "abuse_score": 0}
        except Exception:
            logger.exception("AbuseIPDB check unexpected error for %s", ip)
            return {"ip": ip, "error": "Unexpected error", "abuse_score": 0}

    async def get_reports(self, ip: str, max_age: int = 90) -> list[dict[str, Any]]:
        """Get abuse reports for an IP address."""
        max_age = max(1, min(365, max_age))

        try:
            await rate_limiter.acquire("abuseipdb")
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.get(
                    f"{_BASE_URL}/reports",
                    headers=self._headers,
                    params={
                        "ipAddress": ip,
                        "maxAgeInDays": str(max_age),
                        "page": "1",
                        "perPage": "100",
                    },
                )
                response.raise_for_status()
                data = response.json().get("data", {})

            results: list[dict[str, Any]] = []
            for report in data.get("results", []):
                cat_ids = report.get("categories", [])
                categories = [
                    _CATEGORY_LABELS.get(cid, f"Category {cid}")
                    for cid in cat_ids
                ]
                results.append({
                    "reported_at": report.get("reportedAt", ""),
                    "comment": report.get("comment", ""),
                    "categories": categories,
                    "category_ids": cat_ids,
                    "reporter_id": report.get("reporterId", 0),
                    "reporter_country": report.get("reporterCountryCode", ""),
                })
            return results
        except httpx.HTTPStatusError as exc:
            logger.error("AbuseIPDB reports failed for %s: %s", ip, exc.response.status_code)
            return []
        except httpx.TimeoutException:
            logger.error("AbuseIPDB reports timed out for %s", ip)
            return []
        except Exception:
            logger.exception("AbuseIPDB reports unexpected error for %s", ip)
            return []
