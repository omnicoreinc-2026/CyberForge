"""Nuclei-style vulnerability scanner with CLI fallback to Python checks."""

import asyncio
import logging
import shutil
import re
from typing import Optional

import httpx

from backend.models.exploit import NucleiResult
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

_NUCLEI_AVAILABLE: bool = shutil.which("nuclei") is not None

# Python-based signature checks when nuclei binary is not available
_VULN_SIGNATURES = [
    {
        "id": "exposed-git",
        "name": "Git Repository Exposed",
        "severity": "high",
        "path": "/.git/config",
        "match": re.compile(r"\[core\]", re.IGNORECASE),
    },
    {
        "id": "exposed-env",
        "name": "Environment File Exposed",
        "severity": "high",
        "path": "/.env",
        "match": re.compile(r"(DB_|API_KEY|SECRET|PASSWORD)", re.IGNORECASE),
    },
    {
        "id": "exposed-debug",
        "name": "Debug Mode Enabled",
        "severity": "medium",
        "path": "/",
        "match_header": "X-Debug-Token",
    },
    {
        "id": "directory-listing",
        "name": "Directory Listing Enabled",
        "severity": "low",
        "path": "/",
        "match": re.compile(r"Index of /|Directory listing", re.IGNORECASE),
    },
    {
        "id": "server-version-disclosure",
        "name": "Server Version Disclosure",
        "severity": "info",
        "path": "/",
        "match_header": "Server",
    },
    {
        "id": "robots-txt",
        "name": "Robots.txt Found",
        "severity": "info",
        "path": "/robots.txt",
        "match": re.compile(r"(Disallow|Allow|User-agent)", re.IGNORECASE),
    },
    {
        "id": "phpinfo-exposed",
        "name": "PHPInfo Page Exposed",
        "severity": "high",
        "path": "/phpinfo.php",
        "match": re.compile(r"phpinfo\(\)|PHP Version", re.IGNORECASE),
    },
    {
        "id": "wp-login",
        "name": "WordPress Login Found",
        "severity": "info",
        "path": "/wp-login.php",
        "match": re.compile(r"wp-login|WordPress", re.IGNORECASE),
    },
    {
        "id": "swagger-exposed",
        "name": "Swagger UI Exposed",
        "severity": "medium",
        "path": "/swagger/index.html",
        "match": re.compile(r"swagger|openapi", re.IGNORECASE),
    },
    {
        "id": "graphql-exposed",
        "name": "GraphQL Endpoint Exposed",
        "severity": "medium",
        "path": "/graphql",
        "match": re.compile(r"graphql|introspection", re.IGNORECASE),
    },
]


async def _run_nuclei_cli(target: str) -> list[NucleiResult]:
    """Run nuclei binary and parse JSON output."""
    results: list[NucleiResult] = []
    try:
        proc = await asyncio.create_subprocess_exec(
            "nuclei", "-u", target, "-jsonl", "-silent", "-severity", "info,low,medium,high,critical",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=120)

        import json
        for line in stdout.decode(errors="replace").strip().split("\n"):
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                results.append(NucleiResult(
                    template_id=data.get("template-id", ""),
                    name=data.get("info", {}).get("name", ""),
                    severity=data.get("info", {}).get("severity", "info"),
                    matched_url=data.get("matched-at", target),
                    extracted_results=str(data.get("extracted-results", "")),
                ))
            except Exception:
                continue
    except Exception as exc:
        logger.error("Nuclei CLI failed: %s", exc)

    return results


async def _run_python_checks(client: httpx.AsyncClient, target: str) -> list[NucleiResult]:
    """Run Python-based vulnerability signature checks."""
    results: list[NucleiResult] = []

    for sig in _VULN_SIGNATURES:
        url = f"{target.rstrip('/')}{sig['path']}"
        try:
            resp = await client.get(url, timeout=5.0, follow_redirects=True)

            matched = False
            extracted = ""

            if "match" in sig and sig["match"].search(resp.text):
                matched = True
                extracted = f"Pattern matched in response body at {sig['path']}"
            elif "match_header" in sig:
                header_val = resp.headers.get(sig["match_header"], "")
                if header_val:
                    matched = True
                    extracted = f"{sig['match_header']}: {header_val}"

            if matched:
                results.append(NucleiResult(
                    template_id=sig["id"],
                    name=sig["name"],
                    severity=sig["severity"],
                    matched_url=url,
                    extracted_results=extracted,
                ))
        except Exception:
            continue

    return results


async def scan_nuclei(
    target: str,
    progress_emitter: Optional[ProgressEmitter] = None,
) -> list[NucleiResult]:
    """Scan target for known vulnerabilities using nuclei or Python fallback."""
    if progress_emitter:
        await progress_emitter.emit(0, "running", f"Starting vulnerability scan on {target}", "nuclei")

    if _NUCLEI_AVAILABLE:
        logger.info("Using nuclei CLI for %s", target)
        if progress_emitter:
            await progress_emitter.emit(10, "running", "Running nuclei templates...", "nuclei")
        results = await _run_nuclei_cli(target)
    else:
        logger.info("Using Python signature checks for %s", target)
        async with httpx.AsyncClient(verify=False) as client:
            total = len(_VULN_SIGNATURES)
            results = []
            for idx, sig in enumerate(_VULN_SIGNATURES):
                url = f"{target.rstrip('/')}{sig['path']}"
                try:
                    resp = await client.get(url, timeout=5.0, follow_redirects=True)
                    matched = False
                    extracted = ""
                    if "match" in sig and sig["match"].search(resp.text):
                        matched = True
                        extracted = f"Pattern matched at {sig['path']}"
                    elif "match_header" in sig:
                        hv = resp.headers.get(sig["match_header"], "")
                        if hv:
                            matched = True
                            extracted = f"{sig['match_header']}: {hv}"
                    if matched:
                        results.append(NucleiResult(
                            template_id=sig["id"],
                            name=sig["name"],
                            severity=sig["severity"],
                            matched_url=url,
                            extracted_results=extracted,
                        ))
                except Exception:
                    pass

                if progress_emitter:
                    pct = int(((idx + 1) / total) * 90) + 5
                    await progress_emitter.emit(pct, "running", f"Checking signature {idx+1}/{total}", "nuclei")

    if progress_emitter:
        await progress_emitter.emit(100, "completed", f"Vuln scan complete: {len(results)} findings", "nuclei")

    return results
