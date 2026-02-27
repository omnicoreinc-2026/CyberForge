"""Seek scanner -- CIDR host discovery with service and vulnerability detection.

Uses nmap for:
  Phase 1: Host discovery (-sn ping scan)
  Phase 2: Service/version detection (-sV) on live hosts
  Phase 3: Vulnerability detection (--script vulners) on detected services

Falls back to async socket scanning when nmap is unavailable.
"""

import asyncio
import logging
import shutil
from typing import Optional, Callable, Awaitable

from backend.models.seek_enter import (
    DiscoveredHost,
    DiscoveredService,
    SeekResult,
    ServiceVuln,
)

logger = logging.getLogger(__name__)

_NMAP_AVAILABLE: bool = shutil.which("nmap") is not None
if _NMAP_AVAILABLE:
    try:
        import nmap
    except ImportError:
        _NMAP_AVAILABLE = False

ProgressCallback = Optional[Callable[[int, str], Awaitable[None]]]


async def seek_scan(
    cidr: str,
    ports: str = "1-1000",
    on_progress: ProgressCallback = None,
) -> SeekResult:
    """Scan a CIDR range for live hosts, services, and vulnerabilities."""
    if _NMAP_AVAILABLE:
        return await _seek_with_nmap(cidr, ports, on_progress)
    else:
        return await _seek_with_sockets(cidr, ports, on_progress)


async def _seek_with_nmap(
    cidr: str, ports: str, on_progress: ProgressCallback,
) -> SeekResult:
    """Three-phase nmap scan: discovery, service detection, vuln scan."""
    loop = asyncio.get_running_loop()

    if on_progress:
        await on_progress(5, "Phase 1: Host discovery (ping scan)")

    def _ping_scan():
        nm = nmap.PortScanner()
        nm.scan(hosts=cidr, arguments="-sn -T4")
        return nm

    nm_ping = await loop.run_in_executor(None, _ping_scan)
    live_hosts = nm_ping.all_hosts()

    if on_progress:
        await on_progress(25, f"Found {len(live_hosts)} live hosts. Phase 2: Service detection")

    if not live_hosts:
        return SeekResult(
            scan_id="", cidr=cidr,
            hosts_scanned=0, hosts_alive=0, hosts=[],
        )

    hosts_str = " ".join(live_hosts)

    def _service_scan():
        nm = nmap.PortScanner()
        nm.scan(hosts=hosts_str, ports=ports, arguments="-sV -O -T4 --script vulners")
        return nm

    nm_full = await loop.run_in_executor(None, _service_scan)

    if on_progress:
        await on_progress(70, "Phase 3: Parsing results and mapping vulnerabilities")

    hosts: list[DiscoveredHost] = []
    for host_ip in nm_full.all_hosts():
        host_data = nm_full[host_ip]

        os_guess = ""
        if "osmatch" in host_data and host_data["osmatch"]:
            os_guess = host_data["osmatch"][0].get("name", "")

        hostname = ""
        if "hostnames" in host_data:
            for hn in host_data["hostnames"]:
                if hn.get("name"):
                    hostname = hn["name"]
                    break

        services: list[DiscoveredService] = []
        vulns: list[ServiceVuln] = []

        for proto in host_data.all_protocols():
            for port_num in sorted(host_data[proto].keys()):
                info = host_data[proto][port_num]
                if info.get("state") != "open":
                    continue

                svc = DiscoveredService(
                    port=port_num,
                    protocol=proto,
                    service=info.get("name", ""),
                    product=info.get("product", ""),
                    version=info.get("version", ""),
                    extrainfo=info.get("extrainfo", ""),
                    cpe=info.get("cpe", ""),
                )
                services.append(svc)

                script_output = info.get("script", {})
                vulners_output = script_output.get("vulners", "")
                if vulners_output:
                    parsed_vulns = _parse_vulners_output(vulners_output)
                    vulns.extend(parsed_vulns)

        hosts.append(DiscoveredHost(
            ip=host_ip, hostname=hostname, os_guess=os_guess,
            state="up", services=services, vulns=vulns,
        ))

    if on_progress:
        total_vulns = sum(len(h.vulns) for h in hosts)
        await on_progress(100, f"Seek complete: {len(hosts)} hosts, {total_vulns} vulnerabilities")

    return SeekResult(
        scan_id="", cidr=cidr,
        hosts_scanned=len(live_hosts), hosts_alive=len(hosts),
        hosts=hosts,
    )


def _parse_vulners_output(raw: str) -> list[ServiceVuln]:
    """Parse nmap vulners script output into ServiceVuln objects."""
    from backend.scanners.enter_engine import EXPLOIT_REGISTRY

    vulns = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("cpe:"):
            continue
        parts = line.split()
        if len(parts) >= 2:
            cve_id = parts[0].strip()
            try:
                cvss = float(parts[1])
            except (ValueError, IndexError):
                cvss = 0.0

            exploit_id = ""
            exploit_available = False
            for eid, mod in EXPLOIT_REGISTRY.items():
                if cve_id in mod.get("cves", []):
                    exploit_id = eid
                    exploit_available = True
                    break

            vulns.append(ServiceVuln(
                cve_id=cve_id, cvss=cvss,
                exploit_available=exploit_available,
                exploit_id=exploit_id,
            ))
    return vulns


async def _seek_with_sockets(
    cidr: str, ports: str, on_progress: ProgressCallback,
) -> SeekResult:
    """Fallback: socket-based host/port discovery.

    Strategy:
      1. Expand the target range into individual IPs.
      2. Fast liveness probe — check a handful of common ports on ALL hosts
         concurrently to find which ones are alive.
      3. Full port scan only the alive hosts.
    """
    from backend.scanners.nmap_scanner import _expand_hosts, _scan_port_socket, _parse_port_range, _COMMON_SERVICES

    all_hosts = _expand_hosts(cidr)
    if not all_hosts:
        logger.warning("No hosts expanded from target: %s", cidr)
        return SeekResult(
            scan_id="", cidr=cidr,
            hosts_scanned=0, hosts_alive=0, hosts=[],
        )

    port_list = _parse_port_range(ports)

    if on_progress:
        await on_progress(5, f"Socket scan: {len(all_hosts)} hosts — Phase 1: liveness probe")

    # Phase 1: Fast liveness probe with common ports (concurrent across hosts)
    probe_ports = [22, 80, 443, 445, 3389, 8080, 21, 23, 53, 3306]
    alive_hosts: set[str] = set()
    host_concurrency = 50  # Probe up to 50 hosts at once

    async def _probe_host(host_ip: str) -> str | None:
        """Return host_ip if any probe port responds, else None."""
        tasks = [_scan_port_socket(host_ip, p, timeout=1.5) for p in probe_ports]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if r is not None and not isinstance(r, Exception):
                return host_ip
        return None

    for i in range(0, len(all_hosts), host_concurrency):
        batch = all_hosts[i:i + host_concurrency]
        results = await asyncio.gather(
            *[_probe_host(h) for h in batch], return_exceptions=True,
        )
        for r in results:
            if isinstance(r, str):
                alive_hosts.add(r)
        if on_progress:
            probed = min(i + host_concurrency, len(all_hosts))
            pct = int((probed / len(all_hosts)) * 40) + 5
            await on_progress(min(pct, 45), f"Probed {probed}/{len(all_hosts)} hosts — {len(alive_hosts)} alive")

    if on_progress:
        await on_progress(50, f"Phase 2: Full port scan on {len(alive_hosts)} alive hosts")

    if not alive_hosts:
        if on_progress:
            await on_progress(100, f"Seek complete: 0 alive hosts out of {len(all_hosts)} scanned")
        return SeekResult(
            scan_id="", cidr=cidr,
            hosts_scanned=len(all_hosts), hosts_alive=0, hosts=[],
        )

    # Phase 2: Full port scan on alive hosts only
    hosts: list[DiscoveredHost] = []
    alive_list = sorted(alive_hosts)
    total_port_checks = len(alive_list) * len(port_list)
    completed = 0
    batch_size = 200

    for host_ip in alive_list:
        services: list[DiscoveredService] = []

        for i in range(0, len(port_list), batch_size):
            batch = port_list[i:i + batch_size]
            tasks = [_scan_port_socket(host_ip, p) for p in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if result is not None and not isinstance(result, Exception):
                    if result.state == "open":
                        services.append(DiscoveredService(
                            port=result.port,
                            protocol="tcp",
                            service=result.service or _COMMON_SERVICES.get(result.port, ""),
                        ))

            completed += len(batch)
            if on_progress and total_port_checks > 0:
                pct = int((completed / total_port_checks) * 45) + 50
                await on_progress(
                    min(pct, 95),
                    f"Scanning {host_ip}: {completed}/{total_port_checks} checks, {len(services)} open",
                )

        if services:
            hosts.append(DiscoveredHost(
                ip=host_ip, state="up", services=services, vulns=[],
            ))

    if on_progress:
        await on_progress(100, f"Seek complete: {len(hosts)} hosts with services (no vuln data without nmap)")

    return SeekResult(
        scan_id="", cidr=cidr,
        hosts_scanned=len(all_hosts), hosts_alive=len(hosts),
        hosts=hosts,
    )
