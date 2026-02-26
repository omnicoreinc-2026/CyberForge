"""Log Analyzer API router.

Provides endpoints for uploading, analyzing, and reviewing log files.
Supports auto-detection of syslog, Apache, Nginx, and Windows Event formats.
"""

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from backend.models.logs import LogAnalysisRequest
from backend.routers.websocket import manager
from backend.services.log_service import LogService
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/logs", tags=["logs"])
_service = LogService()


@router.post("/analyze", summary="Analyze log content")
async def analyze_logs(request: LogAnalysisRequest) -> dict[str, Any]:
    """Parse and analyze log content submitted as JSON."""
    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)

    try:
        result = await _service.analyze_logs(
            content=request.content,
            log_format=request.format,
            scan_id=scan_id,
            emitter=emitter,
        )
        return {
            "scan_id": scan_id,
            "entries": [e.model_dump() for e in result.entries],
            "total_lines": result.total_lines,
            "parsed_lines": result.parsed_lines,
            "format_detected": result.format_detected,
            "anomalies": [a.model_dump() for a in result.anomalies],
            "statistics": result.statistics,
        }
    except Exception as exc:
        logger.error("Log analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/upload", summary="Upload and analyze a log file")
async def upload_log_file(
    file: UploadFile = File(...),
    log_format: str = "auto",
) -> dict[str, Any]:
    """Upload a log file for analysis."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Read file content
    try:
        raw_bytes = await file.read()
        content = raw_bytes.decode("utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read file: {exc}") from exc

    if not content.strip():
        raise HTTPException(status_code=400, detail="File is empty")

    scan_id = str(uuid4())
    emitter = ProgressEmitter(manager, scan_id)

    try:
        result = await _service.analyze_logs(
            content=content,
            log_format=log_format,
            scan_id=scan_id,
            emitter=emitter,
        )
        return {
            "scan_id": scan_id,
            "filename": file.filename,
            "entries": [e.model_dump() for e in result.entries],
            "total_lines": result.total_lines,
            "parsed_lines": result.parsed_lines,
            "format_detected": result.format_detected,
            "anomalies": [a.model_dump() for a in result.anomalies],
            "statistics": result.statistics,
        }
    except Exception as exc:
        logger.error("Log file analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/history", summary="Log analysis history")
async def log_history(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: str = Query(default="", max_length=200),
) -> dict[str, Any]:
    """List past log analysis runs with pagination."""
    return await _service.get_history(page=page, per_page=per_page, search=search)
