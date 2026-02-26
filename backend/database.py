"""Async SQLite database layer for CyberForge.

Uses aiosqlite for non-blocking database operations compatible
with FastAPI's async request handling.
"""

import logging
import os
from pathlib import Path
from typing import Optional

import aiosqlite

from backend.config import get_settings

logger = logging.getLogger(__name__)

# SQL schema definitions
_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS scan_results (
    id          TEXT PRIMARY KEY,
    scan_type   TEXT NOT NULL,
    target      TEXT NOT NULL,
    results_json TEXT NOT NULL DEFAULT '[]',
    severity    TEXT NOT NULL DEFAULT 'info',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scan_history (
    id           TEXT PRIMARY KEY,
    module       TEXT NOT NULL,
    target       TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    started_at   TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    result_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS api_keys_metadata (
    id         TEXT PRIMARY KEY,
    service    TEXT NOT NULL UNIQUE,
    key_hint   TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value_json TEXT NOT NULL DEFAULT '""',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    report_type  TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    pdf_path     TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_results_type ON scan_results(scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_results_target ON scan_results(target);
CREATE INDEX IF NOT EXISTS idx_scan_results_severity ON scan_results(severity);
CREATE INDEX IF NOT EXISTS idx_scan_history_module ON scan_history(module);
CREATE INDEX IF NOT EXISTS idx_scan_history_status ON scan_history(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
"""


class Database:
    """Async SQLite database manager.

    Handles connection lifecycle and schema initialization for
    the CyberForge local database.
    """

    def __init__(self, db_path: Optional[str] = None) -> None:
        settings = get_settings()
        self._db_path: str = db_path or settings.DB_PATH
        self._connection: Optional[aiosqlite.Connection] = None

    async def init_db(self) -> None:
        """Create the database file, parent directories, and all tables.

        Safe to call multiple times -- uses CREATE TABLE IF NOT EXISTS.
        """
        db_dir = Path(self._db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)

        conn = await self.get_connection()
        await conn.executescript(_SCHEMA_SQL)
        await conn.commit()
        logger.info("Database initialized at %s", self._db_path)

    async def get_connection(self) -> aiosqlite.Connection:
        """Return the active database connection, opening one if needed.

        Enables WAL mode and foreign keys on first connect for
        better concurrency and data integrity.
        """
        if self._connection is None:
            self._connection = await aiosqlite.connect(self._db_path)
            self._connection.row_factory = aiosqlite.Row
            await self._connection.execute("PRAGMA journal_mode=WAL;")
            await self._connection.execute("PRAGMA foreign_keys=ON;")
        return self._connection

    async def close(self) -> None:
        """Close the database connection if open."""
        if self._connection is not None:
            await self._connection.close()
            self._connection = None
            logger.info("Database connection closed")


# Module-level singleton
db = Database()
