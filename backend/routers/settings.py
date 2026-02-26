"""Settings router for API key management and app configuration.

Provides endpoints for storing, listing, checking, and deleting
API keys for third-party integrations, using the OS keyring for
secure storage and SQLite for metadata.
"""

import json
import logging

from fastapi import APIRouter, HTTPException

from backend.database import db
from backend.models.settings import (
    ApiKeyInfo,
    ApiKeyStatus,
    ApiKeyStore,
    AppSettings,
    SettingsUpdate,
)
from backend.services.keystore_service import keystore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ---------------------------------------------------------------------------
# API Key Management
# ---------------------------------------------------------------------------


@router.post("/api-keys", summary="Store an API key")
async def store_api_key(payload: ApiKeyStore) -> dict[str, str]:
    """Store an API key in the OS keyring.

    The actual key is stored in the OS keyring (Windows Credential Manager).
    Only metadata (service name, last 4 chars hint) is persisted in SQLite.
    """
    success = await keystore.store_key(payload.service, payload.key)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to store API key in keyring")
    return {"status": "ok", "message": f"API key stored for {payload.service}"}


@router.get("/api-keys", summary="List all stored API key services")
async def list_api_keys() -> list[ApiKeyInfo]:
    """List all stored API key metadata.

    Returns service names, key hints (last 4 chars), and timestamps.
    Never returns the actual API keys.
    """
    services = await keystore.list_services()
    return [
        ApiKeyInfo(
            service=svc["service"],
            key_hint=svc["key_hint"],
            created_at=svc["created_at"],
            configured=svc["configured"],
        )
        for svc in services
    ]


@router.delete("/api-keys/{service}", summary="Remove an API key")
async def delete_api_key(service: str) -> dict[str, str]:
    """Delete an API key from the keyring and its metadata from the database."""
    success = await keystore.delete_key(service)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to delete API key for {service}")
    return {"status": "ok", "message": f"API key removed for {service}"}


@router.get("/api-keys/{service}/status", summary="Check API key status")
async def check_api_key_status(service: str) -> ApiKeyStatus:
    """Check whether an API key is configured for a specific service."""
    configured = await keystore.is_configured(service)
    return ApiKeyStatus(service=service, configured=configured)


# ---------------------------------------------------------------------------
# Application Settings
# ---------------------------------------------------------------------------


@router.get("/app", summary="Get application settings")
async def get_app_settings() -> AppSettings:
    """Retrieve the current application settings."""
    conn = await db.get_connection()
    cursor = await conn.execute(
        "SELECT key, value_json FROM settings"
    )
    rows = await cursor.fetchall()

    settings_dict: dict[str, object] = {}
    for row in rows:
        try:
            settings_dict[row["key"]] = json.loads(row["value_json"])
        except (json.JSONDecodeError, TypeError):
            pass

    return AppSettings(**{k: v for k, v in settings_dict.items() if k in AppSettings.model_fields})


@router.put("/app", summary="Update an application setting")
async def update_app_setting(payload: SettingsUpdate) -> dict[str, str]:
    """Update a single application setting."""
    # Validate the key exists in AppSettings.
    if payload.key not in AppSettings.model_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown setting key: {payload.key}. Valid keys: {list(AppSettings.model_fields.keys())}",
        )

    conn = await db.get_connection()
    value_json = json.dumps(payload.value)
    await conn.execute(
        """
        INSERT INTO settings (key, value_json, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
            value_json = excluded.value_json,
            updated_at = excluded.updated_at
        """,
        (payload.key, value_json),
    )
    await conn.commit()
    return {"status": "ok", "message": f"Setting '{payload.key}' updated"}
