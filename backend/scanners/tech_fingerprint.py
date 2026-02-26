"""Technology stack fingerprinting scanner.

Analyzes HTTP response headers and HTML content to identify
web server software, frameworks, CMS platforms, and other technologies.
"""

import logging
import re
from typing import Optional

import httpx

from backend.models.recon import TechStackResult

logger = logging.getLogger(__name__)


# Header-based detection rules: (header_name, pattern, tech_name, category)
_HEADER_RULES: list[tuple[str, str, str, str]] = [
    ("server", r"nginx(?:/(\S+))?", "nginx", "web-server"),
    ("server", r"Apache(?:/(\S+))?", "Apache", "web-server"),
    ("server", r"Microsoft-IIS(?:/(\S+))?", "IIS", "web-server"),
    ("server", r"LiteSpeed(?:/(\S+))?", "LiteSpeed", "web-server"),
    ("server", r"cloudflare", "Cloudflare", "cdn"),
    ("server", r"AmazonS3", "Amazon S3", "cloud-storage"),
    ("server", r"openresty(?:/(\S+))?", "OpenResty", "web-server"),
    ("server", r"Caddy", "Caddy", "web-server"),
    ("x-powered-by", r"PHP(?:/(\S+))?", "PHP", "language"),
    ("x-powered-by", r"ASP\.NET", "ASP.NET", "framework"),
    ("x-powered-by", r"Express", "Express.js", "framework"),
    ("x-powered-by", r"Next\.?js(?:\s+(\S+))?", "Next.js", "framework"),
    ("x-generator", r"WordPress(?:\s+(\S+))?", "WordPress", "cms"),
    ("x-generator", r"Drupal(?:\s+(\S+))?", "Drupal", "cms"),
    ("x-drupal-cache", r".*", "Drupal", "cms"),
    ("x-varnish", r".*", "Varnish", "cache"),
    ("x-cache", r".*cloudfront.*", "CloudFront", "cdn"),
    ("via", r".*cloudfront.*", "CloudFront", "cdn"),
    ("x-amz-cf-id", r".*", "CloudFront", "cdn"),
    ("x-vercel-id", r".*", "Vercel", "hosting"),
    ("x-netlify", r".*", "Netlify", "hosting"),
    ("x-github-request-id", r".*", "GitHub Pages", "hosting"),
]


# HTML body detection rules: (pattern, tech_name, category, version_group)
_HTML_RULES: list[tuple[str, str, str, Optional[int]]] = [
    (r'<meta\s+name=["\']generator["\']\s+content=["\']WordPress\s*([\d.]*)', "WordPress", "cms", 1),
    (r'<meta\s+name=["\']generator["\']\s+content=["\']Drupal\s*([\d.]*)', "Drupal", "cms", 1),
    (r'<meta\s+name=["\']generator["\']\s+content=["\']Joomla[!]?\s*([\d.]*)', "Joomla", "cms", 1),
    (r'/wp-content/', "WordPress", "cms", None),
    (r'/wp-includes/', "WordPress", "cms", None),
    (r'sites/default/files', "Drupal", "cms", None),
    (r'__next', "Next.js", "framework", None),
    (r'__nuxt', "Nuxt.js", "framework", None),
    (r'_sveltekit', "SvelteKit", "framework", None),
    (r'react\.production\.min\.js|reactDOM|data-reactroot|__REACT', "React", "js-library", None),
    (r'vue\.runtime|Vue\.js|data-v-[a-f0-9]|__VUE', "Vue.js", "js-library", None),
    (r'ng-version|ng-app|angular\.min\.js', "Angular", "js-framework", None),
    (r'jquery(?:\.min)?\.js|jQuery\s+v?([\d.]+)', "jQuery", "js-library", 1),
    (r'bootstrap(?:\.min)?\.(?:css|js)|Bootstrap\s+v?([\d.]+)', "Bootstrap", "css-framework", 1),
    (r'tailwindcss|tailwind\.min\.css', "Tailwind CSS", "css-framework", None),
    (r'<script[^>]*src=[^>]*gtag|google-analytics|GoogleAnalytics', "Google Analytics", "analytics", None),
    (r'<script[^>]*src=[^>]*gtm\.js', "Google Tag Manager", "analytics", None),
    (r'cloudflare', "Cloudflare", "cdn", None),
    (r'fonts\.googleapis\.com', "Google Fonts", "font-service", None),
]


async def fingerprint_tech(url: str) -> list[TechStackResult]:
    """Fingerprint technologies used by the website at *url*.

    Examines HTTP response headers and HTML body content for known
    technology signatures.

    Args:
        url: Full URL to analyze (must include http:// or https://).

    Returns:
        List of detected TechStackResult objects.
    """
    results: list[TechStackResult] = []
    seen: set[str] = set()

    def _add(tech: str, category: str, version: str = "", confidence: float = 1.0) -> None:
        key = f"{tech}:{category}"
        if key not in seen:
            seen.add(key)
            results.append(
                TechStackResult(
                    technology=tech,
                    category=category,
                    version=version,
                    confidence=confidence,
                )
            )

    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            verify=False,
        ) as client:
            response = await client.get(url)

        # Phase 1: Header analysis
        headers = {k.lower(): v for k, v in response.headers.items()}

        for header_name, pattern, tech_name, category in _HEADER_RULES:
            header_val = headers.get(header_name, "")
            if header_val:
                match = re.search(pattern, header_val, re.IGNORECASE)
                if match:
                    version = ""
                    if match.lastindex and match.lastindex >= 1:
                        version = match.group(1) or ""
                    _add(tech_name, category, version, confidence=0.9)

        # Detect HTTPS
        if url.startswith("https://"):
            _add("HTTPS", "security", confidence=1.0)

        # Check cookies for framework hints
        set_cookie = headers.get("set-cookie", "")
        if "PHPSESSID" in set_cookie:
            _add("PHP", "language", confidence=0.8)
        if "ASP.NET_SessionId" in set_cookie:
            _add("ASP.NET", "framework", confidence=0.8)
        if "JSESSIONID" in set_cookie:
            _add("Java", "language", confidence=0.8)
        if "laravel_session" in set_cookie:
            _add("Laravel", "framework", confidence=0.9)
        if "connect.sid" in set_cookie:
            _add("Express.js", "framework", confidence=0.7)

        # Phase 2: HTML body analysis
        body = response.text[:100_000]  # Limit analysis to first 100KB

        for pattern, tech_name, category, version_group in _HTML_RULES:
            match = re.search(pattern, body, re.IGNORECASE)
            if match:
                version = ""
                if version_group is not None and match.lastindex and match.lastindex >= version_group:
                    version = match.group(version_group) or ""
                _add(tech_name, category, version, confidence=0.7)

    except Exception as exc:
        logger.error("Tech fingerprint failed for %s: %s", url, exc)

    logger.info("Tech fingerprint for %s: %d technologies detected", url, len(results))
    return results
