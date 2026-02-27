"""Directory bruteforce scanner with gobuster fallback to pure-Python."""

import asyncio
import logging
import shutil
from typing import Optional

import httpx

from backend.models.exploit import DirResult
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

_GOBUSTER_AVAILABLE: bool = shutil.which("gobuster") is not None

# Default common paths when no wordlist is available
_DEFAULT_PATHS = [
    "admin", "administrator", "login", "wp-admin", "wp-login.php",
    "dashboard", "api", "api/v1", "api/v2", "console", "config",
    "backup", "backups", ".git", ".env", ".htaccess", "robots.txt",
    "sitemap.xml", "phpmyadmin", "phpinfo.php", "server-status",
    "wp-content", "wp-includes", "uploads", "images", "assets",
    "static", "css", "js", "cgi-bin", "bin", "test", "testing",
    "dev", "development", "staging", "debug", "old", "new",
    "temp", "tmp", "logs", "log", "secret", "private",
    "hidden", ".well-known", "swagger", "graphql", "health",
    "status", "info", "about", "contact", "user", "users",
    "profile", "account", "accounts", "register", "signup",
    "reset", "forgot", "password", "auth", "oauth", "token",
    "session", "sessions", "logout", "panel", "manager",
    "portal", "gateway", "proxy", "redirect", "download",
    "file", "files", "upload", "media", "doc", "docs",
    "documentation", "help", "faq", "support", "ticket",
    "database", "db", "sql", "mysql", "postgres", "redis",
    "cache", "memcached", "queue", "worker", "cron", "job",
    "shell", "cmd", "command", "exec", "run", "eval",
    "xmlrpc.php", "wp-json", "rest", "graphiql", "playground",
]


async def _check_path(client: httpx.AsyncClient, base_url: str, path: str) -> DirResult | None:
    """Check if a path exists on the target."""
    url = f"{base_url.rstrip('/')}/{path}"
    try:
        resp = await client.get(url, timeout=5.0, follow_redirects=False)
        if resp.status_code < 400 or resp.status_code == 403:
            redirect_url = ""
            if 300 <= resp.status_code < 400:
                redirect_url = str(resp.headers.get("location", ""))
            return DirResult(
                url=url,
                status_code=resp.status_code,
                size=len(resp.content),
                redirect_url=redirect_url,
            )
    except Exception:
        pass
    return None


async def scan_dirs(
    target: str,
    wordlist: list[str] | None = None,
    progress_emitter: Optional[ProgressEmitter] = None,
) -> list[DirResult]:
    """Bruteforce directories on target URL."""
    if progress_emitter:
        await progress_emitter.emit(0, "running", f"Starting directory scan on {target}", "dirs")

    paths = wordlist or _DEFAULT_PATHS
    results: list[DirResult] = []
    total = len(paths)
    batch_size = 20

    async with httpx.AsyncClient(verify=False) as client:
        for i in range(0, total, batch_size):
            batch = paths[i:i + batch_size]
            tasks = [_check_path(client, target, p) for p in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, DirResult):
                    results.append(result)

            if progress_emitter:
                completed = min(i + batch_size, total)
                pct = int((completed / total) * 90) + 5
                await progress_emitter.emit(pct, "running", f"Checked {completed}/{total} paths, {len(results)} found", "dirs")

    if progress_emitter:
        await progress_emitter.emit(100, "completed", f"Dir scan complete: {len(results)} paths found", "dirs")

    return results
