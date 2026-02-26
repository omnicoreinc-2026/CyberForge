"""Dashboard statistics router.

Provides aggregated statistics for the CyberForge command center
dashboard, including scan counts, vulnerability metrics, and
recent activity data.
"""

import logging
from typing import Any

from fastapi import APIRouter

from backend.database import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/dashboard", summary="Dashboard statistics")
async def dashboard_stats() -> dict[str, Any]:
    """Return aggregated statistics for the dashboard.

    Includes:
        - total_scans: count of all scans from scan_history
        - vulnerabilities_found: count of vulnerability-related results
        - threats_detected: count of threat/OSINT-related results
        - reports_generated: count of generated reports
        - recent_scans: last 5 scans with basic metadata
        - module_activity: scan count per module for charting
    """
    conn = await db.get_connection()

    # Total scans
    cursor = await conn.execute("SELECT COUNT(*) as cnt FROM scan_history")
    row = await cursor.fetchone()
    total_scans: int = row["cnt"] if row else 0

    # Vulnerabilities found: scan_results where scan_type contains 'vuln'
    # or severity is critical/high
    cursor = await conn.execute(
        "SELECT COUNT(*) as cnt FROM scan_results "
        "WHERE LOWER(scan_type) LIKE '%vuln%' "
        "OR LOWER(severity) IN ('critical', 'high')"
    )
    row = await cursor.fetchone()
    vulnerabilities_found: int = row["cnt"] if row else 0

    # Threats detected: scan_results where scan_type contains 'threat' or 'osint'
    cursor = await conn.execute(
        "SELECT COUNT(*) as cnt FROM scan_results "
        "WHERE LOWER(scan_type) LIKE '%threat%' "
        "OR LOWER(scan_type) LIKE '%osint%'"
    )
    row = await cursor.fetchone()
    threats_detected: int = row["cnt"] if row else 0

    # Reports generated
    cursor = await conn.execute("SELECT COUNT(*) as cnt FROM reports")
    row = await cursor.fetchone()
    reports_generated: int = row["cnt"] if row else 0

    # Recent scans (last 5)
    cursor = await conn.execute(
        "SELECT id, module, target, status, started_at "
        "FROM scan_history "
        "ORDER BY started_at DESC "
        "LIMIT 5"
    )
    rows = await cursor.fetchall()
    recent_scans: list[dict[str, Any]] = [
        {
            "id": r["id"],
            "module": r["module"],
            "target": r["target"],
            "status": r["status"],
            "started_at": r["started_at"],
        }
        for r in rows
    ]

    # Module activity: count of scans per module
    cursor = await conn.execute(
        "SELECT module, COUNT(*) as count "
        "FROM scan_history "
        "GROUP BY module "
        "ORDER BY count DESC"
    )
    rows = await cursor.fetchall()
    module_activity: list[dict[str, Any]] = [
        {"module": r["module"], "count": r["count"]}
        for r in rows
    ]

    return {
        "total_scans": total_scans,
        "vulnerabilities_found": vulnerabilities_found,
        "threats_detected": threats_detected,
        "reports_generated": reports_generated,
        "recent_scans": recent_scans,
        "module_activity": module_activity,
    }
