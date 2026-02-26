"""Reports API router.

Provides endpoints for generating, listing, downloading, and
deleting security reports (PDF and Markdown).
"""

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field

from backend.routers.websocket import manager
from backend.services.report_service import report_service
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["reports"])


class GenerateReportRequest(BaseModel):
    """Request body for report generation."""
    title: str = Field(..., min_length=1, max_length=200)
    report_type: str = Field(default="full", max_length=50)
    scan_ids: list[str] = Field(default_factory=list)
    include_ai_summary: bool = Field(default=False)


@router.post("/generate", summary="Generate a report")
async def generate_report(request: GenerateReportRequest) -> dict[str, Any]:
    """Generate a new report from selected scan results."""
    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)
    try:
        report = await report_service.generate_report(
            title=request.title,
            report_type=request.report_type,
            scan_ids=request.scan_ids,
            include_ai_summary=request.include_ai_summary,
            scan_id=scan_id,
            emitter=emitter,
        )
        return {"scan_id": scan_id, "report": report}
    except Exception as exc:
        logger.exception("Report generation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/", summary="List all reports")
async def list_reports() -> dict[str, Any]:
    """Return all generated reports."""
    reports = await report_service.list_reports()
    return {"reports": reports, "count": len(reports)}


@router.get("/scans/available", summary="List available scans")
async def available_scans() -> dict[str, Any]:
    """Return scans that can be included in a report."""
    scans = await report_service.list_available_scans()
    return {"scans": scans, "count": len(scans)}


@router.get("/{report_id}", summary="Get report details")
async def get_report(report_id: str) -> dict[str, Any]:
    """Return the full report by ID."""
    report = await report_service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"report": report}


@router.get("/{report_id}/pdf", summary="Download report PDF")
async def download_pdf(report_id: str) -> FileResponse:
    """Generate and stream a PDF for the given report."""
    try:
        path = await report_service.generate_pdf(report_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("PDF generation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return FileResponse(
        path=path,
        media_type="application/pdf",
        filename=f"cyberforge-report-{report_id[:8]}.pdf",
    )


@router.get("/{report_id}/markdown", summary="Download report Markdown")
async def download_markdown(report_id: str) -> PlainTextResponse:
    """Render and return the report as Markdown text."""
    try:
        md = await report_service.generate_markdown(report_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return PlainTextResponse(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=cyberforge-report-{report_id[:8]}.md"},
    )


@router.delete("/{report_id}", summary="Delete a report")
async def delete_report(report_id: str) -> dict[str, Any]:
    """Delete a report and its associated PDF."""
    deleted = await report_service.delete_report(report_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"deleted": True, "report_id": report_id}
