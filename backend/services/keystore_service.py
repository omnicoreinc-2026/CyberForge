"""Keystore service for managing API keys.

Uses the OS keyring (Windows Credential Manager on Windows 11) for
secure key storage and aiosqlite for key metadata persistence.
"""

import logging
import uuid
from datetime import datetime, timezone

import keyring
import keyring.errors

from backend.database import db

logger = logging.getLogger(__name__)

# The keyring service namespace used for all CyberForge keys.
_KEYRING_SERVICE = "cyberforge"

# Supported third-party services.
SUPPORTED_SERVICES = frozenset({
    "shodan",
    "virustotal",
    "hibp",
    "openai",
    "anthropic",
    "abuseipdb",
    "otx",
})


class KeystoreService:
    """Manage API keys via the OS keyring with SQLite metadata."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def store_key(self, service: str, key: str) -> bool:
        """Store an API key in the OS keyring and persist metadata.

        Args:
            service: Third-party service identifier.
            key: The raw API key value.

        Returns:
            True on success, False on failure.
        """
        try:
            keyring.set_password(_KEYRING_SERVICE, service, key)
        except Exception:
            logger.exception("Failed to store key in keyring for service=%s", service)
            return False

        key_hint = key[-4:] if len(key) >= 4 else "****"
        now = datetime.now(timezone.utc).isoformat()

        conn = await db.get_connection()
        await conn.execute(
            """
            INSERT INTO api_keys_metadata (id, service, key_hint, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(service) DO UPDATE SET
                key_hint   = excluded.key_hint,
                updated_at = excluded.updated_at
            """,
            (str(uuid.uuid4()), service, key_hint, now, now),
        )
        await conn.commit()
        logger.info("API key stored for service=%s", service)
        return True

    async def get_key(self, service: str) -> str | None:
        """Retrieve an API key from the OS keyring.

        Args:
            service: Third-party service identifier.

        Returns:
            The key string or None if not found.
        """
        try:
            return keyring.get_password(_KEYRING_SERVICE, service)
        except Exception:
            logger.exception("Failed to retrieve key from keyring for service=%s", service)
            return None

    async def delete_key(self, service: str) -> bool:
        """Delete an API key from the keyring and its metadata.

        Args:
            service: Third-party service identifier.

        Returns:
            True on success, False on failure.
        """
        try:
            keyring.delete_password(_KEYRING_SERVICE, service)
        except keyring.errors.PasswordDeleteError:
            logger.warning("No keyring entry found for service=%s during delete", service)
        except Exception:
            logger.exception("Failed to delete key from keyring for service=%s", service)
            return False

        conn = await db.get_connection()
        await conn.execute(
            "DELETE FROM api_keys_metadata WHERE service = ?",
            (service,),
        )
        await conn.commit()
        logger.info("API key deleted for service=%s", service)
        return True

    async def list_services(self) -> list[dict]:
        """List all stored API key metadata.

        Returns:
            List of dicts with service, key_hint, created_at, and configured status.
        """
        conn = await db.get_connection()
        cursor = await conn.execute(
            "SELECT service, key_hint, created_at FROM api_keys_metadata ORDER BY service"
        )
        rows = await cursor.fetchall()

        results: list[dict] = []
        for row in rows:
            service = row["service"]
            configured = await self.is_configured(service)
            results.append({
                "service": service,
                "key_hint": row["key_hint"],
                "created_at": row["created_at"],
                "configured": configured,
            })
        return results

    async def is_configured(self, service: str) -> bool:
        """Check whether an API key exists in the keyring for a service.

        Args:
            service: Third-party service identifier.

        Returns:
            True if a key is stored, False otherwise.
        """
        try:
            password = keyring.get_password(_KEYRING_SERVICE, service)
            return password is not None
        except Exception:
            logger.exception("Failed to check keyring for service=%s", service)
            return False


# Module-level singleton
keystore = KeystoreService()
