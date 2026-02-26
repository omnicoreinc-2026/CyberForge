"""Pydantic models for the Vulnerability Scanner module.

Defines data structures for HTTP header analysis, SSL/TLS checks,
CVE lookups, dependency vulnerability scanning, and full scan results.
"""

from typing import Any

from pydantic import BaseModel, Field


class HeaderAnalysis(BaseModel):
    """Analysis result for a single HTTP security header."""

    header: str = Field(..., description="Header name.")
    value: str = Field(default="", description="Header value found in response (empty if missing).")
    status: str = Field(..., description="Assessment: pass, warning, fail, info.")
    description: str = Field(default="", description="Explanation of the finding.")
    severity: str = Field(default="info", description="Severity: info, low, medium, high.")


class SslResult(BaseModel):
    """SSL/TLS certificate and connection analysis."""

    valid: bool = Field(..., description="Whether the certificate is valid and trusted.")
    issuer: str = Field(default="", description="Certificate issuer.")
    subject: str = Field(default="", description="Certificate subject (CN).")
    expires: str = Field(default="", description="Certificate expiration date.")
    protocol: str = Field(default="", description="Negotiated TLS protocol version.")
    cipher: str = Field(default="", description="Negotiated cipher suite.")
    grade: str = Field(default="", description="Overall grade: A+, A, B, C, D, F.")
    issues: list[str] = Field(default_factory=list, description="Identified security issues.")


class CveResult(BaseModel):
    """A single CVE vulnerability record."""

    cve_id: str = Field(..., description="CVE identifier (e.g. CVE-2024-1234).")
    description: str = Field(default="", description="Vulnerability description.")
    severity: str = Field(default="", description="Severity: LOW, MEDIUM, HIGH, CRITICAL.")
    cvss_score: float = Field(default=0.0, ge=0.0, le=10.0, description="CVSS v3 base score.")
    published: str = Field(default="", description="Publication date.")
    references: list[str] = Field(default_factory=list, description="Reference URLs.")
    affected_products: list[str] = Field(default_factory=list, description="Affected CPE product strings.")


class DependencyVuln(BaseModel):
    """A vulnerability found in a project dependency."""

    package: str = Field(..., description="Package name.")
    version: str = Field(default="", description="Installed version.")
    cve_id: str = Field(default="", description="Associated CVE identifier.")
    severity: str = Field(default="", description="Severity: LOW, MEDIUM, HIGH, CRITICAL.")
    description: str = Field(default="", description="Vulnerability description.")
    fixed_version: str = Field(default="", description="Version where the issue is fixed.")


class VulnScanResult(BaseModel):
    """Aggregated result from a full vulnerability scan."""

    target: str = Field(..., description="Original scan target.")
    headers: list[HeaderAnalysis] = Field(default_factory=list)
    ssl: SslResult | None = Field(default=None)
    cves: list[CveResult] = Field(default_factory=list)
    dependencies: list[DependencyVuln] = Field(default_factory=list)
