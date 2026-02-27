"""Pydantic models for the Seek & Enter module."""

from typing import Any

from pydantic import BaseModel, Field


class DiscoveredService(BaseModel):
    """A service detected on an open port."""

    port: int = Field(..., ge=1, le=65535, description="Port number.")
    protocol: str = Field(default="tcp", description="Protocol: tcp or udp.")
    service: str = Field(default="", description="Service name (e.g. ssh, http, smb).")
    product: str = Field(default="", description="Product name (e.g. OpenSSH, Apache httpd).")
    version: str = Field(default="", description="Version string.")
    extrainfo: str = Field(default="", description="Extra info from nmap.")
    cpe: str = Field(default="", description="CPE string for the service.")


class ServiceVuln(BaseModel):
    """A vulnerability associated with a discovered service."""

    cve_id: str = Field(default="", description="CVE identifier.")
    cvss: float = Field(default=0.0, ge=0.0, le=10.0, description="CVSS score.")
    description: str = Field(default="", description="Brief vulnerability description.")
    exploit_available: bool = Field(default=False, description="Whether an exploit module exists.")
    exploit_id: str = Field(default="", description="Internal exploit module ID if available.")


class DiscoveredHost(BaseModel):
    """A live host found during CIDR scanning."""

    ip: str = Field(..., description="IP address of the discovered host.")
    hostname: str = Field(default="", description="Resolved hostname if available.")
    os_guess: str = Field(default="", description="Best OS guess from nmap.")
    state: str = Field(default="up", description="Host state.")
    services: list[DiscoveredService] = Field(default_factory=list)
    vulns: list[ServiceVuln] = Field(default_factory=list)


class SeekResult(BaseModel):
    """Complete result from a Seek (CIDR discovery) scan."""

    scan_id: str = Field(..., description="Unique scan identifier.")
    cidr: str = Field(..., description="Original CIDR target.")
    hosts_scanned: int = Field(default=0)
    hosts_alive: int = Field(default=0)
    hosts: list[DiscoveredHost] = Field(default_factory=list)


class EnterRequest(BaseModel):
    """Request to attempt exploitation of a specific service."""

    scan_id: str = Field(..., description="Parent seek scan ID.")
    target_ip: str = Field(..., description="Target host IP address.")
    port: int = Field(..., ge=1, le=65535, description="Target port.")
    service: str = Field(default="", description="Service name hint.")
    exploit_id: str = Field(default="auto", description="Exploit module ID or 'auto'.")
    options: dict[str, Any] = Field(default_factory=dict)


class EnterEvent(BaseModel):
    """A single event in the exploitation terminal stream."""

    event_type: str = Field(..., description="Event type: info, command, output, success, error, complete.")
    timestamp: str = Field(..., description="ISO-8601 timestamp.")
    message: str = Field(..., description="Terminal output line.")
    module: str = Field(default="", description="Active exploit module name.")


class EnterResult(BaseModel):
    """Final result of an exploitation attempt."""

    session_id: str = Field(..., description="Unique exploitation session ID.")
    target_ip: str = Field(..., description="Target host.")
    port: int = Field(..., description="Target port.")
    service: str = Field(default="")
    success: bool = Field(default=False)
    method: str = Field(default="", description="Exploit method used.")
    access_level: str = Field(default="", description="Access gained: none, user, root, admin.")
    loot: list[str] = Field(default_factory=list, description="Collected loot items.")
