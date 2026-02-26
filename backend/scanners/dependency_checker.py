"""Dependency vulnerability checker.

Parses requirements.txt and package.json files, then checks each
dependency against the NVD for known CVEs.
"""

import asyncio
import json
import logging
import re
from typing import Optional

from backend.models.vuln import DependencyVuln

logger = logging.getLogger(__name__)

try:
    import nvdlib
    _NVDLIB_AVAILABLE = True
except ImportError:
    _NVDLIB_AVAILABLE = False
    logger.warning("nvdlib not available -- dependency CVE lookups will be limited")


def _parse_requirements_txt(content: str) -> list[tuple[str, str]]:
    """Parse a requirements.txt file into (package, version) tuples."""
    packages: list[tuple[str, str]] = []
    for line in content.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        match = re.match(r"^([A-Za-z0-9_.-]+)\s*[=~<>!]=?\s*([\d.]+)", line)
        if match:
            packages.append((match.group(1).lower(), match.group(2)))
        else:
            name_match = re.match(r"^([A-Za-z0-9_.-]+)", line)
            if name_match:
                packages.append((name_match.group(1).lower(), ""))
    return packages


def _parse_package_json(content: str) -> list[tuple[str, str]]:
    """Parse a package.json file into (package, version) tuples."""
    packages: list[tuple[str, str]] = []
    try:
        data = json.loads(content)
        for dep_key in ("dependencies", "devDependencies"):
            deps = data.get(dep_key, {})
            for name, version_spec in deps.items():
                version = re.sub(r"^[~^>=<]*", "", version_spec)
                packages.append((name.lower(), version))
    except (json.JSONDecodeError, AttributeError) as exc:
        logger.error("Failed to parse package.json: %s", exc)
    return packages


async def _check_package_nvd(package: str, version: str) -> list[DependencyVuln]:
    """Check a single package against the NVD database."""
    vulns: list[DependencyVuln] = []
    if not _NVDLIB_AVAILABLE or not version:
        return vulns

    loop = asyncio.get_running_loop()

    def _search() -> list:
        try:
            results = nvdlib.searchCVE(
                keywordSearch=package + " " + version, limit=5
            )
            return list(results)
        except Exception as exc:
            logger.debug("NVD search failed for %s %s: %s", package, version, exc)
            return []

    try:
        cve_results = await loop.run_in_executor(None, _search)
        for cve in cve_results:
            severity = "UNKNOWN"
            cvss_score = 0.0
            if hasattr(cve, "metrics") and cve.metrics:
                if hasattr(cve.metrics, "cvssMetricV31") and cve.metrics.cvssMetricV31:
                    m = cve.metrics.cvssMetricV31[0]
                    cvss_score = m.cvssData.baseScore if hasattr(m, "cvssData") else 0.0
                    severity = m.cvssData.baseSeverity if hasattr(m, "cvssData") else "UNKNOWN"
                elif hasattr(cve.metrics, "cvssMetricV2") and cve.metrics.cvssMetricV2:
                    m = cve.metrics.cvssMetricV2[0]
                    cvss_score = m.cvssData.baseScore if hasattr(m, "cvssData") else 0.0
            description = ""
            if hasattr(cve, "descriptions") and cve.descriptions:
                for desc in cve.descriptions:
                    if desc.lang == "en":
                        description = desc.value[:500]
                        break
            vulns.append(DependencyVuln(
                package=package, version=version,
                cve_id=cve.id if hasattr(cve, "id") else "",
                severity=severity, description=description, fixed_version="",
            ))
    except Exception as exc:
        logger.debug("NVD lookup error for %s: %s", package, exc)
    return vulns


async def check_requirements(content: str) -> list[DependencyVuln]:
    """Check a requirements.txt file for known vulnerabilities."""
    packages = _parse_requirements_txt(content)
    all_vulns: list[DependencyVuln] = []
    for package, version in packages:
        vulns = await _check_package_nvd(package, version)
        all_vulns.extend(vulns)
        await asyncio.sleep(0.6)
    logger.info("Requirements check: %d vulns in %d packages", len(all_vulns), len(packages))
    return all_vulns


async def check_package_json(content: str) -> list[DependencyVuln]:
    """Check a package.json file for known vulnerabilities."""
    packages = _parse_package_json(content)
    all_vulns: list[DependencyVuln] = []
    for package, version in packages:
        vulns = await _check_package_nvd(package, version)
        all_vulns.extend(vulns)
        await asyncio.sleep(0.6)
    logger.info("package.json check: %d vulns in %d packages", len(all_vulns), len(packages))
    return all_vulns
