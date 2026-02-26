"""SSL/TLS certificate and connection analyzer.

Uses Python ssl stdlib and the cryptography library to inspect
TLS certificates, protocol versions, cipher suites, and common
configuration issues.
"""

import asyncio
import logging
import ssl
from datetime import datetime, timezone

from cryptography import x509

from backend.models.vuln import SslResult

logger = logging.getLogger(__name__)

_WEAK_CIPHERS: list[str] = [
    "RC4", "DES", "3DES", "MD5", "NULL", "EXPORT", "anon",
]

_DEPRECATED_PROTOCOLS: set[str] = {"SSLv2", "SSLv3", "TLSv1", "TLSv1.1"}


def _grade_ssl(result: SslResult) -> str:
    """Assign a letter grade based on SSL/TLS analysis findings."""
    if not result.valid:
        return "F"
    deductions = 0
    for issue in result.issues:
        il = issue.lower()
        if "expired" in il or "self-signed" in il:
            return "F"
        if "weak cipher" in il:
            deductions += 2
        if "deprecated" in il or "outdated" in il:
            deductions += 2
        if "sha-1" in il:
            deductions += 1
    if result.protocol in _DEPRECATED_PROTOCOLS:
        deductions += 3
    if deductions == 0:
        return "A+"
    elif deductions <= 1:
        return "A"
    elif deductions <= 2:
        return "B"
    elif deductions <= 3:
        return "C"
    elif deductions <= 4:
        return "D"
    return "F"


async def check_ssl(hostname: str, port: int = 443) -> SslResult:
    """Analyze SSL/TLS certificate and connection for *hostname*."""
    loop = asyncio.get_running_loop()

    def _do_ssl_check() -> dict:
        """Perform the actual SSL connection and analysis in a thread."""
        rd: dict = {
            "valid": False, "issuer": "", "subject": "",
            "expires": "", "protocol": "", "cipher": "", "issues": [],
        }
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = True
            ctx.verify_mode = ssl.CERT_REQUIRED
            with ssl.create_connection((hostname, port), timeout=10) as sock:
                with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                    rd["valid"] = True
                    rd["protocol"] = ssock.version() or ""
                    ci = ssock.cipher()
                    if ci:
                        rd["cipher"] = ci[0]
                    cert_der = ssock.getpeercert(binary_form=True)
                    if cert_der:
                        cert = x509.load_der_x509_certificate(cert_der)
                        ia = cert.issuer.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
                        if ia:
                            rd["issuer"] = ia[0].value
                        sa = cert.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
                        if sa:
                            rd["subject"] = sa[0].value
                        not_after = cert.not_valid_after_utc
                        rd["expires"] = not_after.isoformat()
                        now = datetime.now(timezone.utc)
                        if not_after < now:
                            rd["issues"].append("Certificate has expired")
                            rd["valid"] = False
                        elif (not_after - now).days < 30:
                            dl = (not_after - now).days
                            rd["issues"].append("Certificate expires soon (" + str(dl) + " days)")
                        sig = cert.signature_algorithm_oid
                        if sig and "sha1" in str(sig._name).lower():
                            rd["issues"].append("Certificate uses SHA-1 signature (deprecated)")
        except ssl.SSLCertVerificationError as exc:
            rd["issues"].append("Certificate verification failed: " + str(exc))
            rd["valid"] = False
            try:
                ctx2 = ssl.create_default_context()
                ctx2.check_hostname = False
                ctx2.verify_mode = ssl.CERT_NONE
                with ssl.create_connection((hostname, port), timeout=10) as sock:
                    with ctx2.wrap_socket(sock, server_hostname=hostname) as ssock:
                        rd["protocol"] = ssock.version() or ""
                        ci = ssock.cipher()
                        if ci:
                            rd["cipher"] = ci[0]
                        cd = ssock.getpeercert(binary_form=True)
                        if cd:
                            c = x509.load_der_x509_certificate(cd)
                            ia = c.issuer.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
                            if ia:
                                rd["issuer"] = ia[0].value
                            sa = c.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
                            if sa:
                                rd["subject"] = sa[0].value
                            rd["expires"] = c.not_valid_after_utc.isoformat()
                            if c.issuer == c.subject:
                                rd["issues"].append("Certificate is self-signed")
            except Exception:
                pass
        except Exception as exc:
            rd["issues"].append("Connection failed: " + str(exc))
            rd["valid"] = False
        if rd["cipher"]:
            for weak in _WEAK_CIPHERS:
                if weak.upper() in rd["cipher"].upper():
                    rd["issues"].append("Weak cipher detected: " + rd["cipher"])
                    break
        if rd["protocol"] in _DEPRECATED_PROTOCOLS:
            rd["issues"].append("Outdated protocol: " + rd["protocol"])
        return rd

    try:
        data = await loop.run_in_executor(None, _do_ssl_check)
        result = SslResult(
            valid=data["valid"], issuer=data["issuer"], subject=data["subject"],
            expires=data["expires"], protocol=data["protocol"], cipher=data["cipher"],
            grade="", issues=data["issues"],
        )
        result.grade = _grade_ssl(result)
        return result
    except Exception as exc:
        logger.error("SSL check failed for %%s:%%d: %%s", hostname, port, exc)
        return SslResult(
            valid=False, issuer="", subject="", expires="",
            protocol="", cipher="", grade="F",
            issues=["SSL check failed: " + str(exc)],
        )
