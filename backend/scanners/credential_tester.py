"""Default credential tester -- checks common service credentials."""

import asyncio
import logging
from typing import Optional

import httpx

from backend.models.exploit import CredentialResult
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

# Common default credentials for various services
_DEFAULT_CREDS = [
    {"service": "http", "username": "admin", "password": "admin"},
    {"service": "http", "username": "admin", "password": "password"},
    {"service": "http", "username": "admin", "password": "123456"},
    {"service": "http", "username": "root", "password": "root"},
    {"service": "http", "username": "root", "password": "toor"},
    {"service": "http", "username": "administrator", "password": "administrator"},
    {"service": "http", "username": "user", "password": "user"},
    {"service": "http", "username": "test", "password": "test"},
    {"service": "http", "username": "guest", "password": "guest"},
    {"service": "http", "username": "admin", "password": "admin123"},
    {"service": "http", "username": "admin", "password": "1234"},
    {"service": "http", "username": "admin", "password": ""},
    {"service": "ssh", "username": "root", "password": "root"},
    {"service": "ssh", "username": "root", "password": "toor"},
    {"service": "ssh", "username": "admin", "password": "admin"},
    {"service": "ssh", "username": "pi", "password": "raspberry"},
    {"service": "ssh", "username": "ubuntu", "password": "ubuntu"},
    {"service": "ftp", "username": "anonymous", "password": ""},
    {"service": "ftp", "username": "ftp", "password": "ftp"},
    {"service": "ftp", "username": "admin", "password": "admin"},
]


async def _test_http_basic(client: httpx.AsyncClient, url: str, username: str, password: str) -> bool:
    """Test HTTP Basic Auth credentials."""
    try:
        resp = await client.get(url, auth=(username, password), timeout=5.0, follow_redirects=True)
        return resp.status_code not in (401, 403)
    except Exception:
        return False


async def _test_http_form(client: httpx.AsyncClient, url: str, username: str, password: str) -> bool:
    """Test common HTTP form login."""
    login_paths = ["/login", "/admin/login", "/wp-login.php", "/user/login"]
    for path in login_paths:
        login_url = f"{url.rstrip('/')}{path}"
        try:
            resp = await client.post(
                login_url,
                data={"username": username, "password": password, "user": username, "pass": password},
                timeout=5.0,
                follow_redirects=False,
            )
            # A redirect (302) after login often means success
            if resp.status_code in (302, 303) and "location" in resp.headers:
                loc = resp.headers["location"].lower()
                if "dashboard" in loc or "admin" in loc or "home" in loc:
                    return True
        except Exception:
            continue
    return False


async def scan_credentials(
    target: str,
    creds: list[dict] | None = None,
    progress_emitter: Optional[ProgressEmitter] = None,
) -> list[CredentialResult]:
    """Test default credentials against target services."""
    if progress_emitter:
        await progress_emitter.emit(0, "running", f"Starting credential test on {target}", "creds")

    test_creds = creds or [c for c in _DEFAULT_CREDS if c["service"] == "http"]
    results: list[CredentialResult] = []
    total = len(test_creds)

    async with httpx.AsyncClient(verify=False) as client:
        for idx, cred in enumerate(test_creds):
            username = cred["username"]
            password = cred["password"]

            # Test HTTP Basic Auth
            success = await _test_http_basic(client, target, username, password)
            if not success:
                success = await _test_http_form(client, target, username, password)

            results.append(CredentialResult(
                host=target,
                port=443 if target.startswith("https") else 80,
                service="http",
                username=username,
                password=password,
                success=success,
            ))

            if progress_emitter:
                pct = int(((idx + 1) / total) * 90) + 5
                found = sum(1 for r in results if r.success)
                await progress_emitter.emit(pct, "running", f"Tested {idx+1}/{total} creds, {found} valid", "creds")

    if progress_emitter:
        found = sum(1 for r in results if r.success)
        await progress_emitter.emit(100, "completed", f"Credential test complete: {found} valid credentials", "creds")

    return results
