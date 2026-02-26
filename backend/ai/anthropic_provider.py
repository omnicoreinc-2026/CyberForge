"""Anthropic (Claude) AI provider implementation.

Uses the official ``anthropic`` Python SDK to communicate with
Anthropic's Messages API.  Supports both synchronous and streaming
responses.
"""

import logging
from typing import AsyncGenerator

import anthropic

from backend.ai.base_provider import BaseAIProvider

logger = logging.getLogger(__name__)

# Models available through this provider.
SUPPORTED_MODELS = frozenset({
    "claude-sonnet-4-20250514",
    "claude-haiku-4-5-20251001",
})

DEFAULT_MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096


class AnthropicProvider(BaseAIProvider):
    """Anthropic Claude provider using the official SDK."""

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL) -> None:
        self._api_key = api_key
        self._model = model if model in SUPPORTED_MODELS else DEFAULT_MODEL
        self._client = anthropic.AsyncAnthropic(api_key=api_key)

    # ------------------------------------------------------------------
    # BaseAIProvider interface
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict],
        system_prompt: str = "",
        stream: bool = False,
    ) -> str | AsyncGenerator[str, None]:
        """Send messages to Claude and return the response."""
        # Build the Anthropic messages list (filter out any 'system' role
        # messages -- Anthropic uses a separate ``system`` parameter).
        api_messages: list[dict] = []
        for msg in messages:
            if msg["role"] in ("user", "assistant"):
                api_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        if stream:
            return self._stream_chat(api_messages, system_prompt)

        response = await self._client.messages.create(
            model=self._model,
            max_tokens=MAX_TOKENS,
            system=system_prompt or "You are a helpful cybersecurity assistant.",
            messages=api_messages,
        )

        return response.content[0].text

    async def _stream_chat(
        self,
        messages: list[dict],
        system_prompt: str,
    ) -> AsyncGenerator[str, None]:
        """Yield tokens one-at-a-time using the streaming API."""
        async with self._client.messages.stream(
            model=self._model,
            max_tokens=MAX_TOKENS,
            system=system_prompt or "You are a helpful cybersecurity assistant.",
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def analyze(self, content: str, task: str) -> str:
        """Run a cybersecurity analysis via a single-turn chat."""
        system = (
            "You are a senior cybersecurity analyst. Provide clear, "
            "actionable, and technically accurate analysis."
        )
        messages = [{"role": "user", "content": f"[{task}]\n\n{content}"}]
        result = await self.chat(messages, system_prompt=system, stream=False)
        # chat() with stream=False always returns str
        assert isinstance(result, str)
        return result

    def get_model_name(self) -> str:
        return self._model

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)
