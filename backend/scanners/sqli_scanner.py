"""SQL Injection scanner with sqlmap fallback to pure-Python."""

import asyncio
import logging
import shutil
import re
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from typing import Optional

import httpx

from backend.models.exploit import SQLiResult
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

_SQLMAP_AVAILABLE: bool = shutil.which("sqlmap") is not None

# Common SQL injection payloads for detection
_ERROR_PAYLOADS = [
    "' OR '1'='1",
    "' OR '1'='1' --",
    "1' ORDER BY 1--",
    "1 UNION SELECT NULL--",
    "' AND 1=CONVERT(int, @@version)--",
    "1; WAITFOR DELAY '0:0:3'--",
]

_SQL_ERROR_PATTERNS = [
    re.compile(r"SQL syntax.*MySQL", re.IGNORECASE),
    re.compile(r"Warning.*mysql_", re.IGNORECASE),
    re.compile(r"PostgreSQL.*ERROR", re.IGNORECASE),
    re.compile(r"Driver.*SQL[\s\-]*Server", re.IGNORECASE),
    re.compile(r"ORA-\d{5}", re.IGNORECASE),
    re.compile(r"SQLite.*error", re.IGNORECASE),
    re.compile(r"Unclosed quotation mark", re.IGNORECASE),
    re.compile(r"quoted string not properly terminated", re.IGNORECASE),
]

_DBMS_PATTERNS = {
    "MySQL": re.compile(r"mysql|MariaDB", re.IGNORECASE),
    "PostgreSQL": re.compile(r"PostgreSQL|pg_", re.IGNORECASE),
    "MSSQL": re.compile(r"SQL Server|mssql|sqlsrv", re.IGNORECASE),
    "Oracle": re.compile(r"ORA-\d{5}|Oracle", re.IGNORECASE),
    "SQLite": re.compile(r"SQLite", re.IGNORECASE),
}


async def _test_parameter(client: httpx.AsyncClient, url: str, param: str, original_value: str) -> list[SQLiResult]:
    """Test a single URL parameter for SQL injection."""
    results: list[SQLiResult] = []
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    for payload in _ERROR_PAYLOADS:
        test_params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}
        test_params[param] = payload
        test_url = urlunparse(parsed._replace(query=urlencode(test_params, doseq=True)))

        try:
            resp = await client.get(test_url, timeout=10.0, follow_redirects=True)
            body = resp.text

            for pattern in _SQL_ERROR_PATTERNS:
                if pattern.search(body):
                    dbms = ""
                    for db_name, db_pattern in _DBMS_PATTERNS.items():
                        if db_pattern.search(body):
                            dbms = db_name
                            break
                    results.append(SQLiResult(
                        url=url,
                        parameter=param,
                        payload_type="error-based",
                        injectable=True,
                        dbms=dbms,
                        evidence=f"SQL error detected with payload: {payload}",
                    ))
                    return results  # One confirmed finding per parameter is enough
        except Exception:
            continue

    # Time-based blind test
    try:
        test_params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}
        test_params[param] = "1; WAITFOR DELAY '0:0:3'--"
        test_url = urlunparse(parsed._replace(query=urlencode(test_params, doseq=True)))

        import time
        start = time.monotonic()
        await client.get(test_url, timeout=10.0, follow_redirects=True)
        elapsed = time.monotonic() - start

        if elapsed >= 2.5:
            results.append(SQLiResult(
                url=url,
                parameter=param,
                payload_type="time-based",
                injectable=True,
                dbms="",
                evidence=f"Response delayed {elapsed:.1f}s (expected ~3s)",
            ))
    except Exception:
        pass

    return results


async def scan_sqli(
    target: str,
    progress_emitter: Optional[ProgressEmitter] = None,
) -> list[SQLiResult]:
    """Scan target URL for SQL injection vulnerabilities."""
    if progress_emitter:
        await progress_emitter.emit(0, "running", f"Starting SQLi scan on {target}", "sqli")

    results: list[SQLiResult] = []
    parsed = urlparse(target)
    params = parse_qs(parsed.query, keep_blank_values=True)

    if not params:
        # No query parameters to test
        if progress_emitter:
            await progress_emitter.emit(100, "completed", "No query parameters found to test", "sqli")
        return results

    async with httpx.AsyncClient(verify=False) as client:
        total = len(params)
        for idx, (param, values) in enumerate(params.items()):
            original = values[0] if values else ""
            param_results = await _test_parameter(client, target, param, original)
            results.extend(param_results)

            if progress_emitter:
                pct = int(((idx + 1) / total) * 90) + 5
                await progress_emitter.emit(pct, "running", f"Testing parameter: {param}", "sqli")

    if progress_emitter:
        await progress_emitter.emit(100, "completed", f"SQLi scan complete: {len(results)} findings", "sqli")

    return results
