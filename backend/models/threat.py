"""Pydantic models for threat intelligence data.

Defines data structures for IOC results, IP reputation, geolocation,
and threat feed entries returned by integration clients.
"""

from pydantic import BaseModel, Field


class IocResult(BaseModel):
    """Indicator of Compromise returned from ThreatFox or OTX."""

    ioc_type: str = Field(..., description="IOC type: ip, domain, url, hash, email.")
    value: str = Field(..., description="The IOC value itself.")
    threat_type: str = Field(default="", description="Threat classification (e.g. botnet, ransomware).")
    malware: str | None = Field(default=None, description="Associated malware family name.")
    confidence: int = Field(default=0, ge=0, le=100, description="Confidence score 0-100.")
    source: str = Field(default="", description="Data source (e.g. 'threatfox', 'otx').")
    first_seen: str = Field(default="", description="ISO-8601 timestamp of first observation.")
    last_seen: str = Field(default="", description="ISO-8601 timestamp of last observation.")
    tags: list[str] = Field(default_factory=list, description="Associated tags.")


class IpReputationResult(BaseModel):
    """IP reputation data aggregated from AbuseIPDB and similar sources."""

    ip: str = Field(..., description="Queried IP address.")
    abuse_score: int = Field(default=0, ge=0, le=100, description="Abuse confidence score 0-100.")
    country: str = Field(default="", description="Country of origin.")
    isp: str = Field(default="", description="Internet service provider.")
    domain: str = Field(default="", description="Associated domain name.")
    total_reports: int = Field(default=0, ge=0, description="Total number of abuse reports.")
    last_reported: str = Field(default="", description="ISO-8601 timestamp of most recent report.")
    categories: list[str] = Field(default_factory=list, description="Abuse category labels.")


class GeoIpResult(BaseModel):
    """Geolocation data for an IP address."""

    ip: str = Field(..., description="Queried IP address.")
    country: str = Field(default="", description="Full country name.")
    country_code: str = Field(default="", description="Two-letter ISO country code.")
    region: str = Field(default="", description="Region or state name.")
    city: str = Field(default="", description="City name.")
    lat: float = Field(default=0.0, description="Latitude coordinate.")
    lon: float = Field(default=0.0, description="Longitude coordinate.")
    isp: str = Field(default="", description="Internet service provider.")
    org: str = Field(default="", description="Organization name.")
    as_number: str = Field(default="", description="Autonomous system number and name.")


class ThreatFeedEntry(BaseModel):
    """A single entry from a threat intelligence feed."""

    id: str = Field(..., description="Unique entry identifier.")
    ioc_type: str = Field(..., description="IOC type: ip, domain, url, hash.")
    ioc_value: str = Field(..., description="The IOC value.")
    threat_type: str = Field(default="", description="Threat classification.")
    confidence: int = Field(default=0, ge=0, le=100, description="Confidence score 0-100.")
    source: str = Field(default="", description="Feed source name.")
    timestamp: str = Field(default="", description="ISO-8601 timestamp of the entry.")
