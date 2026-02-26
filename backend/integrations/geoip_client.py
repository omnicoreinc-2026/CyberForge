"""IP Geolocation client using the free ip-api.com service.

Provides geographic location data for IP addresses including country,
region, city, coordinates, ISP, and AS information.

Rate limit: 45 requests per minute for the free tier.
"""

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_BASE_URL = "http://ip-api.com/json"
_TIMEOUT = 30.0

# ip-api.com free tier: 45 requests per minute.
_RATE_LIMIT = 45
_RATE_WINDOW = 60.0  # seconds


class GeoIPClient:
    """Client for the ip-api.com geolocation API.

    Includes simple sliding-window rate limiting to stay within the
    free tier limit of 45 requests per minute.
    """

    def __init__(self) -> None:
        self._request_timestamps: list[float] = []

    def _check_rate_limit(self) -> bool:
        """Check and enforce the rate limit.

        Returns:
            True if the request is allowed, False if rate-limited.
        """
        now = time.monotonic()
        # Remove timestamps outside the sliding window.
        self._request_timestamps = [
            ts for ts in self._request_timestamps
            if now - ts < _RATE_WINDOW
        ]
        if len(self._request_timestamps) >= _RATE_LIMIT:
            return False
        self._request_timestamps.append(now)
        return True

    async def lookup_ip(self, ip: str) -> dict[str, Any]:
        """Get geolocation data for an IP address.

        Args:
            ip: IPv4 or IPv6 address to look up.

        Returns:
            Dict containing country, region, city, lat, lon, ISP, org, and AS data.
        """
        if not self._check_rate_limit():
            logger.warning("GeoIP rate limit reached, request for %s throttled", ip)
            return {
                "ip": ip,
                "error": "Rate limit exceeded. Please wait before making more requests.",
            }

        try:
            fields = "status,message,country,countryCode,regionName,city,lat,lon,isp,org,as,query"
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.get(
                    f"{_BASE_URL}/{ip}",
                    params={"fields": fields},
                )
                response.raise_for_status()
                data: dict[str, Any] = response.json()

            if data.get("status") == "fail":
                logger.warning("GeoIP lookup failed for %s: %s", ip, data.get("message", "unknown"))
                return {
                    "ip": ip,
                    "error": data.get("message", "Lookup failed"),
                }

            return {
                "ip": data.get("query", ip),
                "country": data.get("country", ""),
                "country_code": data.get("countryCode", ""),
                "region": data.get("regionName", ""),
                "city": data.get("city", ""),
                "lat": data.get("lat", 0.0),
                "lon": data.get("lon", 0.0),
                "isp": data.get("isp", ""),
                "org": data.get("org", ""),
                "as_number": data.get("as", ""),
            }
        except httpx.HTTPStatusError as exc:
            logger.error("GeoIP lookup failed for %s: %s", ip, exc.response.status_code)
            return {"ip": ip, "error": f"HTTP {exc.response.status_code}"}
        except httpx.TimeoutException:
            logger.error("GeoIP lookup timed out for %s", ip)
            return {"ip": ip, "error": "Request timed out"}
        except Exception:
            logger.exception("GeoIP lookup unexpected error for %s", ip)
            return {"ip": ip, "error": "Unexpected error"}
