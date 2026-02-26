"""AI Assistant router.

Provides endpoints for chat, analysis, status checks, and
connection testing for the AI provider integration.  The chat
endpoint supports Server-Sent Events (SSE) for token-by-token
streaming.
"""

import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.models.ai import (
    AnalysisRequest,
    AnalysisResponse,
    AiStatusResponse,
    ChatRequest,
    ChatResponse,
)
from backend.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------

async def _sse_generator(stream: AsyncGenerator[str, None], model: str) -> AsyncGenerator[str, None]:
    """Wrap a token stream into SSE data frames."""
    try:
        async for token in stream:
            payload = json.dumps({"token": token, "done": False})
            yield f"data: {payload}\n\n"

        # Final event signals completion.
        payload = json.dumps({"token": "", "done": True, "model": model})
        yield f"data: {payload}\n\n"
    except Exception as exc:
        logger.exception("Streaming error")
        error_payload = json.dumps({"error": str(exc), "done": True})
        yield f"data: {error_payload}\n\n"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/chat", summary="Send a chat message")
async def chat(request: ChatRequest):
    """Send a conversation to the AI assistant.

    When stream is True the response is an SSE stream of token
    events.  Otherwise a single JSON ChatResponse is returned.
    """
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    try:
        provider = await ai_service.get_provider()

        if request.stream:
            result = await ai_service.chat(messages, stream=True)
            return StreamingResponse(
                _sse_generator(result, provider.get_model_name()),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        result = await ai_service.chat(messages, stream=False)
        assert isinstance(result, str)
        return ChatResponse(
            message=result,
            model=provider.get_model_name(),
        )

    except Exception as exc:
        logger.exception("Chat request failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/analyze", summary="Run a specialized analysis")
async def analyze(request: AnalysisRequest) -> AnalysisResponse:
    """Run a task-specific analysis (vulnerability, log, report, remediation)."""
    valid_tasks = {"vulnerability", "log", "report", "remediation"}
    if request.task not in valid_tasks:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task '{request.task}'. Must be one of: {', '.join(sorted(valid_tasks))}",
        )

    try:
        provider = await ai_service.get_provider()
        result = await ai_service.analyze(request.content, request.task)
        return AnalysisResponse(
            analysis=result,
            model=provider.get_model_name(),
        )
    except Exception as exc:
        logger.exception("Analysis request failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/status", summary="Check AI provider status")
async def status() -> AiStatusResponse:
    """Return the current AI provider configuration and readiness."""
    try:
        provider = await ai_service.get_provider()
        return AiStatusResponse(
            configured=provider.is_configured,
            provider=ai_service._provider_name,
            model=provider.get_model_name(),
        )
    except Exception:
        logger.exception("Status check failed")
        return AiStatusResponse(
            configured=False,
            provider=ai_service._provider_name,
            model=ai_service._model_name,
        )


@router.post("/test", summary="Test AI provider connection")
async def test_connection() -> dict:
    """Send a lightweight test message to verify the AI provider works."""
    try:
        provider = await ai_service.get_provider()

        if not provider.is_configured:
            return {
                "status": "error",
                "message": "Provider is not configured. Please add an API key in Settings.",
                "provider": ai_service._provider_name,
            }

        # For Ollama, check server reachability first.
        if hasattr(provider, "check_connectivity"):
            reachable = await provider.check_connectivity()
            if not reachable:
                return {
                    "status": "error",
                    "message": "Ollama server is not reachable at localhost:11434.",
                    "provider": "ollama",
                }

        result = await provider.chat(
            [{"role": "user", "content": "Reply with 'CyberForge AI ready' and nothing else."}],
            stream=False,
        )

        return {
            "status": "ok",
            "message": str(result).strip(),
            "provider": ai_service._provider_name,
            "model": provider.get_model_name(),
        }
    except Exception as exc:
        logger.exception("Connection test failed")
        return {
            "status": "error",
            "message": str(exc),
            "provider": ai_service._provider_name,
        }
