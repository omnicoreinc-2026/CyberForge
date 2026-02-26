"""Token-bucket rate limiter for external API calls.

Prevents CyberForge from exceeding third-party rate limits and
getting blocked by services like Shodan, VirusTotal, NVD, etc.
"""

import asyncio
import time
from collections import defaultdict


class RateLimiter:
    """Async token-bucket rate limiter keyed by service name.

    Usage::

        limiter = RateLimiter()
        limiter.configure("shodan", max_calls=1, period=1.0)
        await limiter.acquire("shodan")  # blocks until a token is available
    """

    def __init__(self) -> None:
        self._configs: dict[str, tuple[int, float]] = {}
        self._tokens: dict[str, float] = defaultdict(float)
        self._last_refill: dict[str, float] = defaultdict(float)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def configure(self, service: str, max_calls: int, period: float) -> None:
        """Set rate limit for a service.

        Args:
            service: Unique key (e.g. "shodan", "virustotal").
            max_calls: Maximum number of calls allowed per period.
            period: Time window in seconds.
        """
        self._configs[service] = (max_calls, period)
        self._tokens[service] = float(max_calls)
        self._last_refill[service] = time.monotonic()

    async def acquire(self, service: str) -> None:
        """Wait until a rate-limit token is available for the service.

        If the service has no configuration, returns immediately.
        """
        if service not in self._configs:
            return

        max_calls, period = self._configs[service]
        async with self._locks[service]:
            while True:
                now = time.monotonic()
                elapsed = now - self._last_refill[service]
                self._tokens[service] += elapsed * (max_calls / period)
                if self._tokens[service] > max_calls:
                    self._tokens[service] = float(max_calls)
                self._last_refill[service] = now

                if self._tokens[service] >= 1.0:
                    self._tokens[service] -= 1.0
                    return

                wait_time = (1.0 - self._tokens[service]) / (max_calls / period)
                await asyncio.sleep(wait_time)


# Global singleton with sensible defaults for known services
rate_limiter = RateLimiter()

# Shodan: 1 req/sec on free plan
rate_limiter.configure("shodan", max_calls=1, period=1.0)

# VirusTotal: 4 req/min on free plan
rate_limiter.configure("virustotal", max_calls=4, period=60.0)

# NVD: 5 req/30sec without API key, 50 req/30sec with key
rate_limiter.configure("nvd", max_calls=5, period=30.0)

# AbuseIPDB: 1000 req/day ~ 1 req/1.5sec to be safe
rate_limiter.configure("abuseipdb", max_calls=1, period=1.5)

# HIBP: 1 req/1.5sec on paid plan
rate_limiter.configure("hibp", max_calls=1, period=1.5)

# OTX: 10 req/min
rate_limiter.configure("otx", max_calls=10, period=60.0)
