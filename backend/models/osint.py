"""Pydantic models for the OSINT module.

Defines data structures for Shodan, VirusTotal, HIBP breach checks,
and reputation scoring results.
"""

from typing import Any

from pydantic import BaseModel, Field


class ShodanHostResult(BaseModel):
    """Shodan host intelligence result."""

    ip: str = Field(..., description="Target IP address.")
    ports: list[int] = Field(default_factory=list, description="Open ports discovered.")
    hostnames: list[str] = Field(default_factory=list, description="Associated hostnames.")
    org: str = Field(default="", description="Organization name.")
    os: str = Field(default="", description="Detected operating system.")
    vulns: list[str] = Field(default_factory=list, description="Known vulnerability IDs.")
    data: list[dict[str, Any]] = Field(default_factory=list, description="Raw service banner data.")


class VirusTotalResult(BaseModel):
    """VirusTotal scan/analysis result."""

    target: str = Field(..., description="Scanned target (URL, domain, IP, or hash).")
    target_type: str = Field(..., description="Target type: url, domain, ip, file.")
    positives: int = Field(default=0, ge=0, description="Number of positive detections.")
    total: int = Field(default=0, ge=0, description="Total number of scanners.")
    scan_date: str = Field(default="", description="Date of the scan.")
    results: dict[str, Any] = Field(default_factory=dict, description="Per-engine scan results.")
    permalink: str = Field(default="", description="Link to full VirusTotal report.")


class BreachResult(BaseModel):
    """A single data breach record from HIBP."""

    name: str = Field(..., description="Breach name.")
    domain: str = Field(default="", description="Primary domain of the breached service.")
    breach_date: str = Field(default="", description="Date the breach occurred.")
    added_date: str = Field(default="", description="Date the breach was added to HIBP.")
    modified_date: str = Field(default="", description="Date the breach record was last modified.")
    pwn_count: int = Field(default=0, ge=0, description="Number of compromised accounts.")
    description: str = Field(default="", description="Breach description (may contain HTML).")
    data_classes: list[str] = Field(
        default_factory=list,
        description="Types of data compromised (e.g. emails, passwords).",
    )


class ReputationResult(BaseModel):
    """Domain or IP reputation score."""

    target: str = Field(..., description="Queried target.")
    reputation_score: float = Field(default=0.0, description="Reputation score (0-100, higher=worse).")
    categories: list[str] = Field(default_factory=list, description="Threat categories.")
    details: dict[str, Any] = Field(default_factory=dict, description="Provider-specific details.")
