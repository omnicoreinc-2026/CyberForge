"""Web fuzzer -- async HTTP fuzzing of paths, headers, parameters."""

import asyncio
import logging
import statistics
from typing import Optional

import httpx

from backend.models.exploit import FuzzResult
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

_DEFAULT_FUZZ_PAYLOADS = [
    "../", "../../", "../../../etc/passwd", "%00", "%0a", "%0d%0a",
    "{{7*7}}", "${7*7}", "<>", "' OR 1=1--", "admin", "test",
    "null", "undefined", "NaN", "-1", "0", "99999999",
    "AAAA" * 64, "%s" * 10, "%n%n%n", "() { :; };",
    "../../../windows/system32/config/sam",
    "file:///etc/passwd", "php://filter/convert.base64-encode/resource=index",
]


async def _fuzz_path(client: httpx.AsyncClient, base_url: str, payload: str) -> FuzzResult | None:
    """Fuzz a single path."""
    url = f"{base_url.rstrip('/')}/{payload}"
    try:
        resp = await client.get(url, timeout=5.0, follow_redirects=False)
        return FuzzResult(
            url=url,
            payload=payload,
            status_code=resp.status_code,
            response_length=len(resp.content),
            anomaly=False,
        )
    except Exception:
        return None


async def scan_fuzz(
    target: str,
    payloads: list[str] | None = None,
    progress_emitter: Optional[ProgressEmitter] = None,
) -> list[FuzzResult]:
    """Fuzz target URL with payloads and detect anomalous responses."""
    if progress_emitter:
        await progress_emitter.emit(0, "running", f"Starting fuzzer on {target}", "fuzz")

    fuzz_payloads = payloads or _DEFAULT_FUZZ_PAYLOADS
    all_results: list[FuzzResult] = []
    total = len(fuzz_payloads)
    batch_size = 10

    async with httpx.AsyncClient(verify=False) as client:
        # Get baseline
        try:
            baseline = await client.get(target, timeout=5.0, follow_redirects=True)
            baseline_length = len(baseline.content)
            baseline_status = baseline.status_code
        except Exception:
            baseline_length = 0
            baseline_status = 200

        for i in range(0, total, batch_size):
            batch = fuzz_payloads[i:i + batch_size]
            tasks = [_fuzz_path(client, target, p) for p in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, FuzzResult):
                    all_results.append(result)

            if progress_emitter:
                completed = min(i + batch_size, total)
                pct = int((completed / total) * 90) + 5
                await progress_emitter.emit(pct, "running", f"Fuzzed {completed}/{total} payloads", "fuzz")

    # Detect anomalies based on response length deviation
    if all_results:
        lengths = [r.response_length for r in all_results if r.response_length > 0]
        if len(lengths) >= 3:
            mean = statistics.mean(lengths)
            stdev = statistics.stdev(lengths)
            for r in all_results:
                if stdev > 0 and abs(r.response_length - mean) > 2 * stdev:
                    r.anomaly = True
                elif r.status_code != baseline_status:
                    r.anomaly = True

    if progress_emitter:
        anomalies = sum(1 for r in all_results if r.anomaly)
        await progress_emitter.emit(100, "completed", f"Fuzz complete: {anomalies} anomalies in {len(all_results)} responses", "fuzz")

    return all_results
