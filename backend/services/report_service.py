"""Report generation service for CyberForge."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from backend.database import db
from backend.report_gen.generator import render_html, html_to_pdf, render_markdown
from backend.services.ai_service import ai_service
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

_REPORTS_DIR = Path("data/reports")
_REPORTS_DIR.mkdir(parents=True, exist_ok=True)


class ReportService:
    """Compile, store, and export security reports."""

    async def generate_report(
        self, title: str, report_type: str, scan_ids: list[str],
        include_ai_summary: bool, scan_id: str, emitter: ProgressEmitter,
    ) -> dict:
        """Generate a structured report from one or more scan results."""
        await emitter.emit(5, "running", "Fetching scan results", module="reports")
        conn = await db.get_connection()
        scan_data: list[dict] = []
        for sid in scan_ids:
            cursor = await conn.execute(
                "SELECT id, scan_type, target, results_json, severity, created_at "
                "FROM scan_results WHERE id = ?", (sid,),
            )
            row = await cursor.fetchone()
            if row:
                scan_data.append({
                    "id": row["id"], "scan_type": row["scan_type"],
                    "target": row["target"],
                    "results": json.loads(row["results_json"]),
                    "severity": row["severity"], "created_at": row["created_at"],
                })
        await emitter.emit(30, "running", f"Loaded {len(scan_data)} scan(s)", module="reports")

        severity_counts: dict[str, int] = {
            "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0,
        }
        total_findings = 0
        targets: set[str] = set()
        for scan in scan_data:
            sev = scan.get("severity", "info").lower()
            if sev in severity_counts:
                severity_counts[sev] += 1
            results_list = scan.get("results", [])
            total_findings += len(results_list)
            targets.add(scan.get("target", "unknown"))
            for finding in results_list:
                finding_sev = ""
                if isinstance(finding, dict):
                    finding_sev = str(finding.get("severity", finding.get("risk", ""))).lower()
                if finding_sev in severity_counts:
                    severity_counts[finding_sev] += 1

        if severity_counts["critical"] > 0:
            overall_risk = "Critical"
        elif severity_counts["high"] > 0:
            overall_risk = "High"
        elif severity_counts["medium"] > 0:
            overall_risk = "Medium"
        elif severity_counts["low"] > 0:
            overall_risk = "Low"
        else:
            overall_risk = "Info"

        ai_summary: Optional[str] = None
        if include_ai_summary and scan_data:
            await emitter.emit(40, "running", "Generating AI executive summary", module="reports")
            try:
                summary_input = {
                    "title": title, "report_type": report_type,
                    "total_scans": len(scan_data), "total_findings": total_findings,
                    "severity_counts": severity_counts,
                    "targets": list(targets), "scans": scan_data[:10],
                }
                ai_summary = await ai_service.generate_report_summary(summary_input)
            except Exception:
                logger.exception("AI summary generation failed")
                ai_summary = "AI summary could not be generated at this time."

        await emitter.emit(70, "running", "Compiling report", module="reports")
        report_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        content = {
            "title": title, "report_type": report_type, "generated_at": now,
            "overall_risk": overall_risk, "targets": list(targets),
            "statistics": {"total_scans": len(scan_data), "total_findings": total_findings, "severity_counts": severity_counts},
            "executive_summary": ai_summary, "scans": scan_data,
            "recommendations": self._generate_recommendations(severity_counts, scan_data),
        }
        await conn.execute(
            "INSERT INTO reports (id, title, report_type, content_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (report_id, title, report_type, json.dumps(content), now),
        )
        await conn.commit()
        await emitter.emit(100, "completed", "Report generated successfully", module="reports")
        return {"id": report_id, "title": title, "report_type": report_type, "content": content, "created_at": now}

    async def generate_pdf(self, report_id: str) -> str:
        """Render a stored report to PDF and return the file path."""
        report = await self.get_report(report_id)
        if not report:
            raise ValueError(f"Report {report_id} not found")
        html = render_html(report["content"], "security_report.html")
        import asyncio
        loop = asyncio.get_event_loop()
        output_path = str(_REPORTS_DIR / f"{report_id}.pdf")
        await loop.run_in_executor(None, html_to_pdf, html, output_path)
        conn = await db.get_connection()
        await conn.execute("UPDATE reports SET pdf_path = ? WHERE id = ?", (output_path, report_id))
        await conn.commit()
        return output_path

    async def generate_markdown(self, report_id: str) -> str:
        """Render a stored report as Markdown text."""
        report = await self.get_report(report_id)
        if not report:
            raise ValueError(f"Report {report_id} not found")
        return render_markdown(report["content"])

    async def list_reports(self) -> list[dict]:
        """Return all reports ordered by creation date (newest first)."""
        conn = await db.get_connection()
        cursor = await conn.execute(
            "SELECT id, title, report_type, content_json, pdf_path, created_at FROM reports ORDER BY created_at DESC",
        )
        rows = await cursor.fetchall()
        return [{"id": r["id"], "title": r["title"], "report_type": r["report_type"],
                 "content": json.loads(r["content_json"]), "pdf_path": r["pdf_path"],
                 "created_at": r["created_at"]} for r in rows]

    async def get_report(self, report_id: str) -> Optional[dict]:
        """Fetch a single report by ID."""
        conn = await db.get_connection()
        cursor = await conn.execute(
            "SELECT id, title, report_type, content_json, pdf_path, created_at FROM reports WHERE id = ?",
            (report_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return {"id": row["id"], "title": row["title"], "report_type": row["report_type"],
                "content": json.loads(row["content_json"]), "pdf_path": row["pdf_path"],
                "created_at": row["created_at"]}

    async def delete_report(self, report_id: str) -> bool:
        """Delete a report and its PDF file if present."""
        report = await self.get_report(report_id)
        if not report:
            return False
        if report.get("pdf_path"):
            pdf_file = Path(report["pdf_path"])
            if pdf_file.exists():
                pdf_file.unlink()
        conn = await db.get_connection()
        await conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        await conn.commit()
        return True

    async def list_available_scans(self) -> list[dict]:
        """Return all scan results that can be included in a report."""
        conn = await db.get_connection()
        cursor = await conn.execute(
            "SELECT id, scan_type, target, severity, created_at FROM scan_results ORDER BY created_at DESC LIMIT 100",
        )
        rows = await cursor.fetchall()
        return [{"id": r["id"], "scan_type": r["scan_type"], "target": r["target"],
                 "severity": r["severity"], "created_at": r["created_at"]} for r in rows]

    @staticmethod
    def _generate_recommendations(severity_counts: dict[str, int], scan_data: list[dict]) -> list[dict]:
        """Produce actionable recommendations based on severity distribution."""
        recs: list[dict] = []
        crit = severity_counts.get("critical", 0)
        high = severity_counts.get("high", 0)
        med = severity_counts.get("medium", 0)
        low = severity_counts.get("low", 0)
        if crit > 0:
            recs.append({"priority": "Critical", "title": "Address Critical Vulnerabilities Immediately",
                         "description": f"{crit} critical-severity finding(s) detected. Remediate within 24 hours."})
        if high > 0:
            recs.append({"priority": "High", "title": "Remediate High-Severity Issues",
                         "description": f"{high} high-severity finding(s) detected. Plan remediation within the current sprint."})
        if med > 0:
            recs.append({"priority": "Medium", "title": "Review Medium-Severity Findings",
                         "description": f"{med} medium-severity finding(s) detected. Schedule remediation soon."})
        if low > 0:
            recs.append({"priority": "Low", "title": "Track Low-Severity Items",
                         "description": f"{low} low-severity finding(s). Add to backlog for future hardening."})
        recs.append({"priority": "Info", "title": "Continuous Monitoring",
                     "description": "Schedule regular scans to maintain visibility into the security posture."})
        return recs


# Module-level singleton
report_service = ReportService()
