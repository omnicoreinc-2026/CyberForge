"""Pydantic models for the Log Analyzer module.

Defines data structures for log analysis requests, results,
anomaly detection output, and statistical summaries.
"""

from typing import Any

from pydantic import BaseModel, Field


class LogEntryModel(BaseModel):
    """A single parsed log entry."""

    timestamp: str = Field(default="", description="Parsed timestamp string.")
    level: str = Field(default="INFO", description="Log level: ERROR, WARN, INFO, DEBUG, etc.")
    source: str = Field(default="", description="Log source (hostname, IP, application).")
    message: str = Field(default="", description="Log message content.")
    raw: str = Field(default="", description="Original raw log line.")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Format-specific metadata.")


class LogAnomaly(BaseModel):
    """A detected anomaly in the log data."""

    line_number: int = Field(..., ge=0, description="Line number where the anomaly was found.")
    entry: LogEntryModel = Field(..., description="The log entry that triggered the anomaly.")
    reason: str = Field(..., description="Human-readable explanation of the anomaly.")
    severity: str = Field(default="medium", description="Anomaly severity: critical, high, medium, low.")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0, description="Detection confidence 0-1.")


class LogAnalysisRequest(BaseModel):
    """Inbound request to analyze log content."""

    content: str = Field(
        ...,
        min_length=1,
        description="Raw log content to analyze.",
    )
    format: str = Field(
        default="auto",
        description="Log format: auto, syslog, apache, nginx, windows_event.",
    )


class LogAnalysisResult(BaseModel):
    """Complete result from a log analysis operation."""

    entries: list[LogEntryModel] = Field(default_factory=list, description="Parsed log entries.")
    total_lines: int = Field(default=0, ge=0, description="Total lines in the input.")
    parsed_lines: int = Field(default=0, ge=0, description="Lines successfully parsed.")
    format_detected: str = Field(default="unknown", description="Auto-detected log format.")
    anomalies: list[LogAnomaly] = Field(default_factory=list, description="Detected anomalies.")
    statistics: dict[str, Any] = Field(default_factory=dict, description="Statistical summary.")
