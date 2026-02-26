"""HTTP security header analyzer.

Inspects HTTP response headers from a target URL and grades the
presence, absence, and configuration of security-relevant headers.
"""

import logging

import httpx

from backend.models.vuln import HeaderAnalysis

logger = logging.getLogger(__name__)


# Security header definitions:
# (header_name, importance, missing_severity, description_present, description_missing)
_SECURITY_HEADERS: list[tuple[str, str, str, str, str]] = [
    (
        "Strict-Transport-Security",
        "high",
        "high",
        "HSTS is configured, enforcing HTTPS connections.",
        "HSTS is missing. Browsers will not enforce HTTPS, enabling downgrade attacks.",
    ),
    (
        "Content-Security-Policy",
        "high",
        "high",
        "CSP is configured, helping prevent XSS and data injection attacks.",
        "CSP is missing. The site is more vulnerable to XSS and code injection.",
    ),
    (
        "X-Frame-Options",
        "medium",
        "medium",
        "X-Frame-Options is set, mitigating clickjacking attacks.",
        "X-Frame-Options is missing. The site may be vulnerable to clickjacking.",
    ),
    (
        "X-Content-Type-Options",
        "medium",
        "medium",
        "X-Content-Type-Options is set to nosniff, preventing MIME-type sniffing.",
        "X-Content-Type-Options is missing. Browsers may MIME-sniff responses.",
    ),
    (
        "X-XSS-Protection",
        "low",
        "low",
        "X-XSS-Protection is set (legacy header, CSP is preferred).",
        "X-XSS-Protection is missing (legacy header, CSP is preferred).",
    ),
    (
        "Referrer-Policy",
        "medium",
        "medium",
        "Referrer-Policy is configured, controlling referrer information leakage.",
        "Referrer-Policy is missing. Full referrer URLs may be sent to external sites.",
    ),
    (
        "Permissions-Policy",
        "medium",
        "medium",
        "Permissions-Policy is set, restricting browser feature access.",
        "Permissions-Policy is missing. Browser features are unrestricted.",
    ),
]

# Information-disclosure headers that SHOULD NOT be present
_DISCLOSURE_HEADERS: list[tuple[str, str]] = [
    ("Server", "Server header exposes web server software and version information."),
    ("X-Powered-By", "X-Powered-By header exposes the backend technology stack."),
    ("X-AspNet-Version", "X-AspNet-Version header exposes the ASP.NET version."),
    ("X-AspNetMvc-Version", "X-AspNetMvc-Version header exposes the ASP.NET MVC version."),
]


async def analyze_headers(url: str) -> list[HeaderAnalysis]:
    """Analyze HTTP security headers for the given *url*.

    Checks for the presence of recommended security headers and flags
    information-disclosure headers that should be removed.

    Args:
        url: Target URL to analyze (must include http:// or https://).

    Returns:
        List of HeaderAnalysis objects, one per checked header.
    """
    results: list[HeaderAnalysis] = []

    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            verify=False,
        ) as client:
            response = await client.get(url)

        resp_headers = {k.lower(): v for k, v in response.headers.items()}

        # Check required security headers
        for header_name, importance, missing_severity, desc_present, desc_missing in _SECURITY_HEADERS:
            value = resp_headers.get(header_name.lower(), "")
            if value:
                results.append(
                    HeaderAnalysis(
                        header=header_name,
                        value=value,
                        status="pass",
                        description=desc_present,
                        severity="info",
                    )
                )
            else:
                results.append(
                    HeaderAnalysis(
                        header=header_name,
                        value="",
                        status="fail" if importance == "high" else "warning",
                        description=desc_missing,
                        severity=missing_severity,
                    )
                )

        # Check information-disclosure headers (should NOT be present)
        for header_name, description in _DISCLOSURE_HEADERS:
            value = resp_headers.get(header_name.lower(), "")
            if value:
                results.append(
                    HeaderAnalysis(
                        header=header_name,
                        value=value,
                        status="warning",
                        description=f"{description} Value: {value}",
                        severity="low",
                    )
                )
            else:
                results.append(
                    HeaderAnalysis(
                        header=header_name,
                        value="",
                        status="pass",
                        description=f"{header_name} header is not exposed.",
                        severity="info",
                    )
                )

    except Exception as exc:
        logger.error("Header analysis failed for %s: %s", url, exc)
        results.append(
            HeaderAnalysis(
                header="CONNECTION",
                value="",
                status="fail",
                description=f"Could not connect to {url}: {exc}",
                severity="high",
            )
        )

    logger.info("Header analysis for %s: %d checks", url, len(results))
    return results
