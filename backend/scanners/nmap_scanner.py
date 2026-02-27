"""Port scanner with nmap fallback to pure-Python sockets.

Attempts to use python-nmap if nmap is installed on the system.
Falls back to an asyncio socket-based scanner when nmap is unavailable.
"""

import asyncio
import ipaddress
import logging
import shutil
from typing import Optional

from backend.models.recon import PortScanResult
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

# Detect nmap availability at import time
_NMAP_AVAILABLE: bool = shutil.which("nmap") is not None

if _NMAP_AVAILABLE:
    try:
        import nmap  # python-nmap
        logger.info("nmap detected -- using python-nmap for port scanning")
    except ImportError:
        _NMAP_AVAILABLE = False
        logger.info("python-nmap not importable -- falling back to socket scanner")
else:
    logger.info("nmap binary not found -- using pure-Python socket scanner")


# Well-known service names for the socket fallback
_COMMON_SERVICES: dict[int, str] = {
    21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp", 53: "dns",
    80: "http", 110: "pop3", 111: "rpcbind", 135: "msrpc",
    139: "netbios-ssn", 143: "imap", 443: "https", 445: "microsoft-ds",
    465: "smtps", 587: "submission", 631: "ipp", 993: "imaps",
    995: "pop3s", 1433: "mssql", 1521: "oracle", 1723: "pptp",
    3306: "mysql", 3389: "ms-wbt-server", 5432: "postgresql",
    5900: "vnc", 5901: "vnc-1", 6379: "redis", 8080: "http-proxy",
    8443: "https-alt", 8888: "http-alt", 9090: "zeus-admin",
    9200: "elasticsearch", 27017: "mongodb",
}


def _expand_hosts(target: str) -> list[str]:
    """Expand an IP range spec into a list of individual host strings.

    Handles single IPs, CIDR blocks (up to /16), and nmap last-octet ranges.
    """
    target = target.strip()
    # Single IP
    try:
        ipaddress.ip_address(target)
        return [target]
    except ValueError:
        pass
    # CIDR block
    try:
        network = ipaddress.ip_network(target, strict=False)
        if network.num_addresses <= 65536:
            return [str(h) for h in network.hosts()] or [str(network.network_address)]
        return []
    except ValueError:
        pass
    # Nmap last-octet dash range: A.B.C.start-end
    if "-" in target:
        left, _, right = target.partition("-")
        try:
            base = ipaddress.IPv4Address(left.strip())
            end = int(right.strip())
            prefix = str(base).rsplit(".", 1)[0]
            start = int(str(base).rsplit(".", 1)[1])
            if 0 <= end <= 255 and start <= end:
                return [f"{prefix}.{i}" for i in range(start, end + 1)]
        except (ValueError, AttributeError):
            pass
    logger.warning("Could not expand target: %s", target)
    return []


def _parse_port_range(ports: str) -> list[int]:
    """Parse a port specification string into a list of port numbers.

    Supports ranges (1-100), comma-separated (80,443), and combinations.
    """
    result: list[int] = []
    for part in ports.split(","):
        part = part.strip()
        if "-" in part:
            start_str, end_str = part.split("-", 1)
            start, end = int(start_str), int(end_str)
            result.extend(range(start, min(end + 1, 65536)))
        else:
            port = int(part)
            if 1 <= port <= 65535:
                result.append(port)
    return sorted(set(result))


async def _scan_port_socket(target: str, port: int, timeout: float = 2.0) -> PortScanResult | None:
    """Probe a single port using asyncio socket connection.

    Returns an open PortScanResult on success, a closed PortScanResult when
    the host is alive but the port is closed (TCP RST), or None on timeout.
    """
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(target, port),
            timeout=timeout,
        )
        writer.close()
        await writer.wait_closed()
        service = _COMMON_SERVICES.get(port, "")
        return PortScanResult(host=target, port=port, state="open", service=service)
    except ConnectionRefusedError:
        # Host is alive but port is closed (TCP RST received)
        return PortScanResult(host=target, port=port, state="closed", service="")
    except (asyncio.TimeoutError, OSError):
        return None
    except Exception:
        return None


async def _scan_with_nmap(
    target: str,
    ports: str,
    progress_emitter: Optional[ProgressEmitter],
) -> tuple[list[PortScanResult], int]:
    """Run a port scan using python-nmap.

    Executes nmap in a thread to avoid blocking the event loop.
    Returns (open_results, hosts_alive_count).
    """
    results: list[PortScanResult] = []

    def _do_nmap_scan() -> "nmap.PortScanner":
        nm = nmap.PortScanner()
        # No --open so all discovered hosts appear in all_hosts()
        nm.scan(hosts=target, ports=ports, arguments="-sV -T4")
        return nm

    loop = asyncio.get_running_loop()

    if progress_emitter:
        await progress_emitter.emit(10, "running", "Running nmap scan", "port_scan")

    try:
        nm = await loop.run_in_executor(None, _do_nmap_scan)
        hosts_alive = len(nm.all_hosts())

        for host in nm.all_hosts():
            for proto in nm[host].all_protocols():
                port_list = sorted(nm[host][proto].keys())
                for port in port_list:
                    info = nm[host][proto][port]
                    if info.get("state") == "open":
                        results.append(
                            PortScanResult(
                                host=host,
                                port=port,
                                state="open",
                                service=info.get("name", ""),
                                version=info.get("version", ""),
                            )
                        )
    except Exception as exc:
        logger.error("nmap scan failed: %s", exc)
        hosts_alive = 0

    return results, hosts_alive


async def _scan_with_sockets(
    target: str,
    ports: str,
    progress_emitter: Optional[ProgressEmitter],
) -> tuple[list[PortScanResult], int]:
    """Run a port scan using pure-Python async sockets.

    Expands IP ranges and scans ports in batches to control concurrency.
    Returns (open_results, hosts_alive_count). A host is considered alive
    if any port returns open or closed (TCP RST) rather than timing out.
    """
    open_results: list[PortScanResult] = []
    alive_hosts: set[str] = set()
    hosts = _expand_hosts(target)
    port_list = _parse_port_range(ports)
    total = len(hosts) * len(port_list)

    if total == 0:
        return open_results, 0

    batch_size = 100
    completed = 0

    for host in hosts:
        for i in range(0, len(port_list), batch_size):
            batch = port_list[i : i + batch_size]
            tasks = [_scan_port_socket(host, port) for port in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, PortScanResult):
                    # Any TCP response (open or RST) means host is alive
                    alive_hosts.add(result.host)
                    if result.state == "open":
                        open_results.append(result)

            completed += len(batch)
            if progress_emitter:
                pct = int((completed / total) * 90) + 5  # 5-95%
                await progress_emitter.emit(
                    pct, "running",
                    f"Scanning {host}: {completed}/{total} checked, {len(open_results)} open, {len(alive_hosts)} alive",
                    "port_scan",
                )

    return open_results, len(alive_hosts)


async def scan_ports(
    target: str,
    ports: str = "1-1000",
    progress_emitter: Optional[ProgressEmitter] = None,
) -> tuple[list[PortScanResult], int]:
    """Scan ports on *target*, preferring nmap with socket fallback.

    Args:
        target: IP address or hostname to scan.
        ports: Port specification (e.g. "1-1000", "80,443,8080").
        progress_emitter: Optional emitter for real-time progress updates.

    Returns:
        Tuple of (open_port_results, hosts_alive_count).
    """
    if progress_emitter:
        await progress_emitter.emit(0, "running", f"Starting port scan on {target}", "port_scan")

    if _NMAP_AVAILABLE:
        logger.info("Using nmap for port scan of %s ports %s", target, ports)
        results, hosts_alive = await _scan_with_nmap(target, ports, progress_emitter)
    else:
        logger.info("Using socket scanner for %s ports %s", target, ports)
        results, hosts_alive = await _scan_with_sockets(target, ports, progress_emitter)

    if progress_emitter:
        await progress_emitter.emit(
            100, "completed",
            f"Port scan complete: {len(results)} open ports, {hosts_alive} hosts alive",
            "port_scan",
        )

    logger.info("Port scan of %s: %d open ports, %d hosts alive", target, len(results), hosts_alive)
    return results, hosts_alive
