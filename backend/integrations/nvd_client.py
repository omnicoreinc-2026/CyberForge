"""NVD (National Vulnerability Database) API client.

Provides CVE search and lookup functionality using the NVD API 2.0,
with optional nvdlib library support.
"""

import asyncio
import logging
from typing import Optional

from backend.models.vuln import CveResult
from backend.utils.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)

try:
    import nvdlib
    _NVDLIB_AVAILABLE = True
except ImportError:
    _NVDLIB_AVAILABLE = False
    logger.warning("nvdlib not available -- install with: pip install nvdlib")


class NvdClient:
    """Client for the NIST National Vulnerability Database API."""

    def __init__(self, api_key: str = "") -> None:
        self._api_key = api_key

    async def search_cve(self, keyword: str) -> list[CveResult]:
        """Search NVD for CVEs matching *keyword*.

        Args:
            keyword: Search term (product name, CVE ID pattern, etc.).

        Returns:
            List of matching CveResult objects.
        """
        if not _NVDLIB_AVAILABLE:
            logger.error("nvdlib not installed -- cannot search CVEs")
            return []

        loop = asyncio.get_running_loop()

        def _search() -> list:
            kwargs: dict = {"keywordSearch": keyword, "limit": 20}
            if self._api_key:
                kwargs["key"] = self._api_key
            return list(nvdlib.searchCVE(**kwargs))

        try:
            await rate_limiter.acquire("nvd")
            raw_results = await loop.run_in_executor(None, _search)
            return [self._parse_cve(r) for r in raw_results]
        except Exception as exc:
            logger.error("NVD search failed for '%s': %s", keyword, exc)
            return []

    async def get_cve(self, cve_id: str) -> Optional[CveResult]:
        """Retrieve a specific CVE by its ID.

        Args:
            cve_id: CVE identifier (e.g. CVE-2024-1234).

        Returns:
            CveResult if found, None otherwise.
        """
        if not _NVDLIB_AVAILABLE:
            logger.error("nvdlib not installed -- cannot look up CVE")
            return None

        loop = asyncio.get_running_loop()

        def _get() -> object:
            kwargs: dict = {"cveId": cve_id}
            if self._api_key:
                kwargs["key"] = self._api_key
            results = list(nvdlib.searchCVE(**kwargs))
            return results[0] if results else None

        try:
            await rate_limiter.acquire("nvd")
            result = await loop.run_in_executor(None, _get)
            if result is None:
                return None
            return self._parse_cve(result)
        except Exception as exc:
            logger.error("NVD lookup failed for %s: %s", cve_id, exc)
            return None

    @staticmethod
    def _parse_cve(cve_obj: object) -> CveResult:
        """Parse an nvdlib CVE object into a CveResult."""
        cve_id = getattr(cve_obj, "id", "")

        description = ""
        if hasattr(cve_obj, "descriptions"):
            for desc in cve_obj.descriptions:
                if desc.lang == "en":
                    description = desc.value[:1000]
                    break

        severity = ""
        cvss_score = 0.0
        if hasattr(cve_obj, "metrics") and cve_obj.metrics:
            if hasattr(cve_obj.metrics, "cvssMetricV31") and cve_obj.metrics.cvssMetricV31:
                m = cve_obj.metrics.cvssMetricV31[0]
                if hasattr(m, "cvssData"):
                    cvss_score = m.cvssData.baseScore
                    severity = m.cvssData.baseSeverity
            elif hasattr(cve_obj.metrics, "cvssMetricV2") and cve_obj.metrics.cvssMetricV2:
                m = cve_obj.metrics.cvssMetricV2[0]
                if hasattr(m, "cvssData"):
                    cvss_score = m.cvssData.baseScore

        published = ""
        if hasattr(cve_obj, "published"):
            published = str(cve_obj.published)

        references: list[str] = []
        if hasattr(cve_obj, "references"):
            for ref in cve_obj.references[:10]:
                if hasattr(ref, "url"):
                    references.append(ref.url)

        affected: list[str] = []
        if hasattr(cve_obj, "configurations") and cve_obj.configurations:
            for config in cve_obj.configurations:
                if hasattr(config, "nodes"):
                    for node in config.nodes:
                        if hasattr(node, "cpeMatch"):
                            for cpe in node.cpeMatch[:5]:
                                if hasattr(cpe, "criteria"):
                                    affected.append(cpe.criteria)

        return CveResult(
            cve_id=cve_id,
            description=description,
            severity=severity,
            cvss_score=cvss_score,
            published=published,
            references=references,
            affected_products=affected,
        )
