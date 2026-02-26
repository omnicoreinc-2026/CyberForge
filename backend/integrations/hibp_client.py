"""Have I Been Pwned (HIBP) API v3 client.

Checks email addresses and domains against the HIBP breach database.
Respects the HIBP rate limit of 1.5 seconds between requests.
"""

import asyncio
import logging
from typing import Any

import httpx

from backend.models.osint import BreachResult

logger = logging.getLogger(__name__)

_HIBP_API_BASE = "https://haveibeenpwned.com/api/v3"
_USER_AGENT = "CyberForge-SecurityScanner"
_RATE_LIMIT_DELAY = 1.5  # seconds between requests


class HIBPClient:
    """Async client for the Have I Been Pwned API v3."""

    def __init__(self, api_key: str = "") -> None:
        self._api_key = api_key
        self._last_request_time: float = 0.0

    def _get_headers(self) -> dict[str, str]:
        """Build request headers with API key and user agent."""
        headers = {"User-Agent": _USER_AGENT}
        if self._api_key:
            headers["hibp-api-key"] = self._api_key
        return headers

    async def _rate_limit(self) -> None:
        """Enforce HIBP rate limit of 1.5s between requests."""
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_time
        if elapsed < _RATE_LIMIT_DELAY:
            await asyncio.sleep(_RATE_LIMIT_DELAY - elapsed)
        self._last_request_time = asyncio.get_event_loop().time()

    def _parse_breach(self, data: dict[str, Any]) -> BreachResult:
        """Parse a single breach record from the HIBP API response."""
        return BreachResult(
            name=data.get("Name", ""),
            domain=data.get("Domain", ""),
            breach_date=data.get("BreachDate", ""),
            added_date=data.get("AddedDate", ""),
            modified_date=data.get("ModifiedDate", ""),
            pwn_count=data.get("PwnCount", 0),
            description=data.get("Description", ""),
            data_classes=data.get("DataClasses", []),
        )

    async def check_email(self, email: str) -> list[BreachResult]:
        """Check if an email address appears in known data breaches.

        Args:
            email: Email address to check.

        Returns:
            List of BreachResult for breaches containing this email.
        """
        await self._rate_limit()

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    _HIBP_API_BASE + "/breachedaccount/" + email,
                    headers=self._get_headers(),
                    params={"truncateResponse": "false"},
                )

                if response.status_code == 404:
                    logger.info("No breaches found for %s", email)
                    return []
                elif response.status_code == 401:
                    logger.error("HIBP API key required or invalid")
                    return []
                elif response.status_code == 429:
                    logger.warning("HIBP rate limit exceeded")
                    return []

                response.raise_for_status()
                breaches = response.json()
                return [self._parse_breach(b) for b in breaches]

        except Exception as exc:
            logger.error("HIBP email check failed for %s: %s", email, exc)
            return []

    async def check_domain(self, domain: str) -> list[BreachResult]:
        """Check if a domain appears in known data breaches.

        Args:
            domain: Domain name to check.

        Returns:
            List of BreachResult for breaches associated with this domain.
        """
        await self._rate_limit()

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    _HIBP_API_BASE + "/breaches",
                    headers=self._get_headers(),
                    params={"domain": domain},
                )

                if response.status_code == 404:
                    return []

                response.raise_for_status()
                breaches = response.json()
                return [self._parse_breach(b) for b in breaches]

        except Exception as exc:
            logger.error("HIBP domain check failed for %s: %s", domain, exc)
            return []
