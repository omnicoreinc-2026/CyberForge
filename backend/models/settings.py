"""Pydantic models for the Settings module.

Defines data structures for API key management, application settings,
and configuration persistence.
"""

from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ApiKeyStore(BaseModel):
    """Payload for storing a new API key."""

    service: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Third-party service identifier (e.g. 'shodan', 'virustotal').",
    )
    key: str = Field(
        ...,
        min_length=1,
        description="The API key value. Stored in the OS keyring, not the database.",
    )


class SettingsUpdate(BaseModel):
    """Payload for updating a single application setting."""

    key: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Setting key name.",
    )
    value: Any = Field(
        ...,
        description="Setting value (JSON-serializable).",
    )


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ApiKeyInfo(BaseModel):
    """Metadata about a stored API key (never contains the actual key)."""

    service: str = Field(..., description="Third-party service identifier.")
    key_hint: str = Field(
        default="",
        description="Last 4 characters of the stored key for identification.",
    )
    created_at: str = Field(default="", description="ISO-8601 timestamp of when the key was stored.")
    configured: bool = Field(default=False, description="Whether a key is currently stored for this service.")


class ApiKeyStatus(BaseModel):
    """Simple status check for a single service key."""

    service: str = Field(..., description="Service identifier.")
    configured: bool = Field(..., description="Whether the key is configured in the keyring.")


# ---------------------------------------------------------------------------
# Application settings model
# ---------------------------------------------------------------------------

class AppSettings(BaseModel):
    """Application-wide configuration with defaults."""

    ai_provider: str = Field(
        default="anthropic",
        description="AI provider: 'anthropic', 'openai', or 'ollama'.",
    )
    ai_model: str = Field(
        default="claude-sonnet-4-20250514",
        description="Model identifier for the selected AI provider.",
    )
    theme: str = Field(
        default="dark",
        description="UI theme: 'dark' or 'system'.",
    )
    scan_timeout: int = Field(
        default=300,
        ge=30,
        le=3600,
        description="Maximum scan duration in seconds.",
    )
