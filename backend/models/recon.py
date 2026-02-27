"""Pydantic models for the Recon module.

Defines data structures for subdomain enumeration, port scanning,
WHOIS lookups, DNS analysis, and technology fingerprinting.
"""

from typing import Any

from pydantic import BaseModel, Field


class SubdomainResult(BaseModel):
    """A discovered subdomain with optional resolved IP and source."""

    subdomain: str = Field(..., description="Fully qualified subdomain name.")
    ip: str | None = Field(default=None, description="Resolved IPv4/IPv6 address.")
    source: str = Field(default="dns", description="Discovery method: dns, crt.sh, etc.")


class PortScanResult(BaseModel):
    """A single port finding from a port scan."""

    host: str = Field(default="", description="Host IP or hostname this port belongs to.")
    port: int = Field(..., ge=1, le=65535, description="Port number.")
    state: str = Field(..., description="Port state: open, closed, filtered.")
    service: str = Field(default="", description="Detected service name.")
    version: str = Field(default="", description="Detected service version.")


class WhoisResult(BaseModel):
    """Parsed WHOIS record for a domain."""

    domain: str = Field(..., description="Queried domain name.")
    registrar: str = Field(default="", description="Domain registrar.")
    creation_date: str = Field(default="", description="Domain creation date.")
    expiration_date: str = Field(default="", description="Domain expiration date.")
    name_servers: list[str] = Field(default_factory=list, description="Authoritative name servers.")
    status: list[str] = Field(default_factory=list, description="Domain status codes.")
    raw: dict[str, Any] = Field(default_factory=dict, description="Raw WHOIS data.")


class DnsRecord(BaseModel):
    """A single DNS resource record."""

    record_type: str = Field(..., description="Record type: A, AAAA, MX, NS, TXT, CNAME, SOA.")
    name: str = Field(..., description="Record name / owner.")
    value: str = Field(..., description="Record data / value.")
    ttl: int = Field(default=0, ge=0, description="Time-to-live in seconds.")


class TechStackResult(BaseModel):
    """A detected technology from HTTP fingerprinting."""

    technology: str = Field(..., description="Technology name (e.g. nginx, React).")
    category: str = Field(default="", description="Category: server, framework, cms, etc.")
    version: str = Field(default="", description="Detected version string.")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Detection confidence 0-1.")


class ReconFullResult(BaseModel):
    """Aggregated result from a full reconnaissance scan."""

    target: str = Field(..., description="Original scan target.")
    subdomains: list[SubdomainResult] = Field(default_factory=list)
    ports: list[PortScanResult] = Field(default_factory=list)
    whois: WhoisResult | None = Field(default=None)
    dns_records: list[DnsRecord] = Field(default_factory=list)
    tech_stack: list[TechStackResult] = Field(default_factory=list)
