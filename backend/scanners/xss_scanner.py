"""Cross-Site Scripting (XSS) scanner -- pure Python."""

import asyncio
import logging
from typing import Optional
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import httpx

from backend.models.exploit import XSSResult
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

_XSS_PAYLOADS = [
    '<script>alert(1)</script>',
    '"><script>alert(1)</script>',
    "'-alert(1)-'",
    '<img src=x onerror=alert(1)>',
    '"><img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    "javascript:alert(1)",
    '{{7*7}}',
    '${7*7}',
]


async def _test_xss_param(client: httpx.AsyncClient, url: str, param: str) -> list[XSSResult]:
    """Test a single parameter for reflected XSS."""
    results: list[XSSResult] = []
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    for payload in _XSS_PAYLOADS:
        test_params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}
        test_params[param] = payload
        test_url = urlunparse(parsed._replace(query=urlencode(test_params, doseq=True)))

        try:
            resp = await client.get(test_url, timeout=10.0, follow_redirects=True)
            body = resp.text

            if payload in body:
                results.append(XSSResult(
                    url=url,
                    parameter=param,
                    payload=payload,
                    xss_type="reflected",
                    evidence=f"Payload reflected in response body",
                ))
                return results
        except Exception:
            continue

    return results


async def scan_xss(
    target: str,
    progress_emitter: Optional[ProgressEmitter] = None,
) -> list[XSSResult]:
    """Scan target URL for XSS vulnerabilities."""
    if progress_emitter:
        await progress_emitter.emit(0, "running", f"Starting XSS scan on {target}", "xss")

    results: list[XSSResult] = []
    parsed = urlparse(target)
    params = parse_qs(parsed.query, keep_blank_values=True)

    if not params:
        if progress_emitter:
            await progress_emitter.emit(100, "completed", "No query parameters found to test", "xss")
        return results

    async with httpx.AsyncClient(verify=False) as client:
        total = len(params)
        for idx, param in enumerate(params.keys()):
            param_results = await _test_xss_param(client, target, param)
            results.extend(param_results)

            if progress_emitter:
                pct = int(((idx + 1) / total) * 90) + 5
                await progress_emitter.emit(pct, "running", f"Testing parameter: {param}", "xss")

    if progress_emitter:
        await progress_emitter.emit(100, "completed", f"XSS scan complete: {len(results)} findings", "xss")

    return results
