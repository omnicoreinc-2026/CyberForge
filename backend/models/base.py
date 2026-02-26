"""Shared Pydantic models used across the CyberForge application.

These models define the data contracts for API requests, responses,
WebSocket messages, and internal service communication.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    """Inbound request to start a scan."""

    target: str = Field(
        ...,
        min_length=1,
        max_length=2048,
        description="IP address, domain, URL, or hash to scan.",
    )
    options: dict[str, Any] = Field(
        default_factory=dict,
        description="Module-specific scan options.",
    )


class APIKeyConfig(BaseModel):
    """Payload for storing or updating an API key reference."""

    service: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Third-party service name (e.g. 'shodan', 'virustotal').",
    )
    key: str = Field(
        ...,
        min_length=1,
        description="The API key value. Stored in the OS keyring, not the database.",
    )


# ---------------------------------------------------------------------------
# Response / internal models
# ---------------------------------------------------------------------------

class ScanResult(BaseModel):
    """Represents the output of a completed scan."""

    id: str = Field(..., description="Unique scan result identifier (UUID).")
    scan_type: str = Field(..., description="Scanner module that produced the result.")
    target: str = Field(..., description="Original scan target.")
    results: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of finding objects returned by the scanner.",
    )
    severity: str = Field(
        default="info",
        description="Overall severity: info, low, medium, high, critical.",
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
        description="ISO-8601 timestamp of when the result was created.",
    )


class ScanProgress(BaseModel):
    """Real-time progress update pushed over WebSocket."""

    scan_id: str = Field(..., description="Scan this progress message belongs to.")
    module: str = Field(..., description="Active scanner module name.")
    progress: int = Field(
        ...,
        ge=0,
        le=100,
        description="Completion percentage (0-100).",
    )
    status: str = Field(
        ...,
        description="Current phase: pending, running, completed, error.",
    )
    current_task: str = Field(
        default="",
        description="Human-readable description of the current operation.",
    )


class HealthResponse(BaseModel):
    """Response payload for the /health endpoint."""

    status: str = Field(..., description="Service status string.")
    version: str = Field(..., description="API version.")


# ---------------------------------------------------------------------------
# Report models
# ---------------------------------------------------------------------------

class ReportMeta(BaseModel):
    """Metadata for a generated report."""

    id: str
    title: str
    report_type: str
    pdf_path: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
    )
