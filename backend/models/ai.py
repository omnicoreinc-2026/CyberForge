"""Pydantic models for the AI assistant module.

Defines data structures for chat messages, analysis requests,
and AI provider responses.
"""

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Chat models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    """A single message in a conversation."""

    role: str = Field(
        ...,
        description="Message role: 'user', 'assistant', or 'system'.",
    )
    content: str = Field(
        ...,
        min_length=1,
        description="Message text content.",
    )


class ChatRequest(BaseModel):
    """Payload for sending a chat message to the AI assistant."""

    messages: list[ChatMessage] = Field(
        ...,
        min_length=1,
        description="Conversation history including the new user message.",
    )
    stream: bool = Field(
        default=False,
        description="Whether to stream the response token by token.",
    )
    context: dict = Field(
        default_factory=dict,
        description="Optional context data (e.g., current scan results, CVE info).",
    )


class ChatResponse(BaseModel):
    """Response from a non-streamed chat request."""

    message: str = Field(..., description="The assistant's reply.")
    model: str = Field(..., description="Model identifier that generated the response.")
    tokens_used: int = Field(
        default=0,
        description="Total tokens consumed (input + output), if available.",
    )


# ---------------------------------------------------------------------------
# Analysis models
# ---------------------------------------------------------------------------

class AnalysisRequest(BaseModel):
    """Payload for running a specialized analysis task."""

    content: str = Field(
        ...,
        min_length=1,
        description="The content to analyze (CVE data, log entries, scan results, etc.).",
    )
    task: str = Field(
        ...,
        description="Analysis task type: 'vulnerability', 'log', 'report', 'remediation'.",
    )
    context: dict = Field(
        default_factory=dict,
        description="Additional context for the analysis.",
    )


class AnalysisResponse(BaseModel):
    """Response from a completed analysis task."""

    analysis: str = Field(..., description="The analysis result text.")
    model: str = Field(..., description="Model identifier that produced the analysis.")


# ---------------------------------------------------------------------------
# Status models
# ---------------------------------------------------------------------------

class AiStatusResponse(BaseModel):
    """AI provider status information."""

    configured: bool = Field(..., description="Whether the AI provider is ready to use.")
    provider: str = Field(..., description="Active provider name: 'anthropic', 'openai', or 'ollama'.")
    model: str = Field(..., description="Active model identifier.")
