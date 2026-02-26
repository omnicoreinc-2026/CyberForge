"""Subdomain enumeration scanner.

Discovers subdomains using DNS brute-force resolution against a built-in
wordlist and certificate transparency logs via crt.sh.
"""

import asyncio
import logging
from typing import Optional

import dns.resolver
import httpx

from backend.models.recon import SubdomainResult
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

# Top 100 common subdomains for brute-force enumeration
_COMMON_SUBDOMAINS: list[str] = [
    "www", "mail", "ftp", "admin", "api", "dev", "staging", "test",
    "blog", "shop", "store", "app", "portal", "m", "mobile", "web",
    "ns1", "ns2", "ns3", "dns", "dns1", "dns2", "mx", "mx1", "mx2",
    "smtp", "pop", "pop3", "imap", "email", "webmail", "remote",
    "vpn", "gateway", "proxy", "cdn", "media", "static", "assets",
    "img", "images", "video", "docs", "wiki", "help", "support",
    "forum", "community", "chat", "status", "monitor", "grafana",
    "jenkins", "ci", "cd", "git", "gitlab", "github", "bitbucket",
    "jira", "confluence", "slack", "teams", "zoom", "meet",
    "auth", "login", "sso", "oauth", "id", "accounts", "signup",
    "register", "dashboard", "panel", "console", "manage", "cms",
    "cpanel", "whm", "plesk", "phpmyadmin", "adminer", "db",
    "database", "mysql", "postgres", "redis", "elasticsearch", "kibana",
    "logstash", "prometheus", "alertmanager", "vault", "consul",
    "docker", "k8s", "kubernetes", "rancher", "swarm",
    "s3", "storage", "backup", "files", "download", "upload",
    "demo", "sandbox", "beta", "alpha", "stage", "uat", "qa",
    "prod", "production", "internal", "intranet", "extranet",
]


async def _resolve_subdomain(subdomain: str, domain: str) -> SubdomainResult | None:
    """Attempt to resolve a single subdomain via DNS A record lookup.

    Returns a SubdomainResult if the name resolves, otherwise None.
    """
    fqdn = f"{subdomain}.{domain}"
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 3.0
        resolver.lifetime = 3.0
        # Run the synchronous resolver in a thread to avoid blocking
        loop = asyncio.get_running_loop()
        answers = await loop.run_in_executor(None, resolver.resolve, fqdn, "A")
        ip = str(answers[0]) if answers else None
        return SubdomainResult(subdomain=fqdn, ip=ip, source="dns")
    except (
        dns.resolver.NXDOMAIN,
        dns.resolver.NoAnswer,
        dns.resolver.NoNameservers,
        dns.resolver.LifetimeTimeout,
        dns.exception.Timeout,
        Exception,
    ):
        return None


async def _query_crt_sh(domain: str) -> list[SubdomainResult]:
    """Query crt.sh certificate transparency logs for subdomains.

    Returns unique subdomains discovered via certificate records.
    """
    results: list[SubdomainResult] = []
    seen: set[str] = set()

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"https://crt.sh/?q=%25.{domain}&output=json",
                follow_redirects=True,
            )
            response.raise_for_status()
            entries = response.json()

        for entry in entries:
            name_value = entry.get("name_value", "")
            # crt.sh may return wildcard or multi-line entries
            for name in name_value.split("\n"):
                name = name.strip().lstrip("*.")
                if name and name.endswith(domain) and name not in seen:
                    seen.add(name)
                    results.append(
                        SubdomainResult(subdomain=name, ip=None, source="crt.sh")
                    )
    except Exception as exc:
        logger.warning("crt.sh query failed for %s: %s", domain, exc)

    return results


async def enumerate_subdomains(
    domain: str,
    progress_emitter: Optional[ProgressEmitter] = None,
) -> list[SubdomainResult]:
    """Enumerate subdomains for *domain* using DNS brute-force and crt.sh.

    Args:
        domain: Target domain name to enumerate.
        progress_emitter: Optional emitter for real-time progress updates.

    Returns:
        List of discovered SubdomainResult objects.
    """
    results: list[SubdomainResult] = []
    seen: set[str] = set()

    total_steps = len(_COMMON_SUBDOMAINS) + 1  # +1 for crt.sh
    completed = 0

    if progress_emitter:
        await progress_emitter.emit(0, "running", f"Starting subdomain enumeration for {domain}", "subdomain_enum")

    # Phase 1: DNS brute-force
    # Process in batches of 20 to avoid overwhelming DNS
    batch_size = 20
    for i in range(0, len(_COMMON_SUBDOMAINS), batch_size):
        batch = _COMMON_SUBDOMAINS[i : i + batch_size]
        tasks = [_resolve_subdomain(sub, domain) for sub in batch]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in batch_results:
            if isinstance(result, SubdomainResult) and result is not None:
                if result.subdomain not in seen:
                    seen.add(result.subdomain)
                    results.append(result)

        completed += len(batch)
        if progress_emitter:
            pct = int((completed / total_steps) * 80)  # DNS phase = 0-80%
            await progress_emitter.emit(
                pct, "running",
                f"DNS brute-force: checked {completed}/{len(_COMMON_SUBDOMAINS)} subdomains",
                "subdomain_enum",
            )

    # Phase 2: crt.sh certificate transparency
    if progress_emitter:
        await progress_emitter.emit(80, "running", "Querying certificate transparency logs", "subdomain_enum")

    crt_results = await _query_crt_sh(domain)
    for result in crt_results:
        if result.subdomain not in seen:
            seen.add(result.subdomain)
            results.append(result)

    if progress_emitter:
        await progress_emitter.emit(
            100, "completed",
            f"Subdomain enumeration complete: {len(results)} found",
            "subdomain_enum",
        )

    logger.info("Subdomain enumeration for %s: %d results", domain, len(results))
    return results
