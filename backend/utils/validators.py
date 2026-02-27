"""Input validation utilities for scan targets.

Every user-supplied target string must pass through these validators
before being forwarded to any scanner module or external API.
"""

import ipaddress
import re
from urllib.parse import urlparse

# Pre-compiled patterns
_DOMAIN_RE = re.compile(
    r"^(?!-)"                           # label cannot start with hyphen
    r"(?:[A-Za-z0-9-]{1,63}\.)*"        # subdomains
    r"[A-Za-z0-9-]{1,63}"              # TLD label
    r"\.[A-Za-z]{2,}$"                 # TLD extension
)

_HASH_PATTERNS: dict[str, re.Pattern[str]] = {
    "md5": re.compile(r"^[a-fA-F0-9]{32}$"),
    "sha1": re.compile(r"^[a-fA-F0-9]{40}$"),
    "sha256": re.compile(r"^[a-fA-F0-9]{64}$"),
}

# Characters that should never appear in sanitised input
_DANGEROUS_CHARS = re.compile(r"[;&|`$(){}!<>\x00-\x1f]")


def validate_ip(ip: str) -> bool:
    """Return True if *ip* is a valid IPv4 or IPv6 address.

    Does not accept CIDR notation -- only single addresses.
    """
    try:
        ipaddress.ip_address(ip.strip())
        return True
    except ValueError:
        return False


def validate_ip_range(target: str) -> bool:
    """Return True if *target* is a valid IP, CIDR block, or nmap-style dash range.

    Accepts:
        - Single IP:              192.168.1.1
        - CIDR block:             10.0.0.0/24
        - Last-octet dash range:  10.0.10.1-254
    """
    target = target.strip()
    if validate_ip(target):
        return True
    # CIDR notation
    try:
        ipaddress.ip_network(target, strict=False)
        return True
    except ValueError:
        pass
    # Nmap last-octet dash range: A.B.C.start-end
    if "-" in target:
        left, _, right = target.partition("-")
        try:
            base = ipaddress.IPv4Address(left.strip())
            end = int(right.strip())
            start = int(str(base).rsplit(".", 1)[1])
            if 0 <= end <= 255 and start <= end:
                return True
        except (ValueError, AttributeError):
            pass
    return False


def validate_domain(domain: str) -> bool:
    """Return True if *domain* looks like a valid DNS domain name.

    Rejects IPs, bare TLDs, and labels longer than 63 characters.
    Total length must not exceed 253 characters (RFC 1035).
    """
    domain = domain.strip().rstrip(".")
    if len(domain) > 253 or len(domain) < 4:
        return False
    return _DOMAIN_RE.match(domain) is not None


def validate_url(url: str) -> bool:
    """Return True if *url* has a valid HTTP(S) scheme and netloc.

    Only http and https schemes are accepted.
    """
    try:
        parsed = urlparse(url.strip())
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False


def validate_hash(hash_str: str) -> tuple[bool, str]:
    """Identify and validate a hex hash string.

    Returns:
        A tuple of (is_valid, hash_type). hash_type is one of
        'md5', 'sha1', 'sha256', or '' if not recognised.
    """
    cleaned = hash_str.strip().lower()
    for hash_type, pattern in _HASH_PATTERNS.items():
        if pattern.match(cleaned):
            return True, hash_type
    return False, ""


def sanitize_input(input_str: str) -> str:
    """Strip dangerous characters from arbitrary user input.

    Removes shell metacharacters, control characters, and trims
    whitespace. Intended as a defence-in-depth measure -- callers
    should still use parameterised queries and avoid shell commands.
    """
    cleaned = _DANGEROUS_CHARS.sub("", input_str)
    return cleaned.strip()
