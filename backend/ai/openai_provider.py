"""OpenAI AI provider implementation.

Uses the official ``openai`` Python SDK for GPT model access.
Supports both synchronous and streaming chat completions.
"""

import logging
from typing import AsyncGenerator

import openai

from backend.ai.base_provider import BaseAIProvider

logger = logging.getLogger(__name__)

# Models available through this provider.
SUPPORTED_MODELS = frozenset({
    "gpt-4o",
    "gpt-4o-mini",
})

DEFAULT_MODEL = "gpt-4o"
MAX_TOKENS = 4096


class OpenAIProvider(BaseAIProvider):
    """OpenAI GPT provider using the official SDK."""

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL) -> None:
        self._api_key = api_key
        self._model = model if model in SUPPORTED_MODELS else DEFAULT_MODEL
        self._client = openai.AsyncOpenAI(api_key=api_key)

    # ------------------------------------------------------------------
    # BaseAIProvider interface
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict],
        system_prompt: str = "",
        stream: bool = False,
    ) -> str | AsyncGenerator[str, None]:
        """Send messages to GPT and return the response."""
        api_messages: list[dict] = []

        # Prepend system prompt as the first message.
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        else:
            api_messages.append({
                "role": "system",
                "content": "You are a helpful cybersecurity assistant.",
            })

        for msg in messages:
            if msg["role"] in ("user", "assistant"):
                api_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        if stream:
            return self._stream_chat(api_messages)

        response = await self._client.chat.completions.create(
            model=self._model,
            max_tokens=MAX_TOKENS,
            messages=api_messages,
        )

        return response.choices[0].message.content or ""

    async def _stream_chat(
        self,
        messages: list[dict],
    ) -> AsyncGenerator[str, None]:
        """Yield tokens one-at-a-time using the streaming API."""
        stream = await self._client.chat.completions.create(
            model=self._model,
            max_tokens=MAX_TOKENS,
            messages=messages,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content

    async def analyze(self, content: str, task: str) -> str:
        """Run a cybersecurity analysis via a single-turn chat."""
        system = (
            "You are a senior cybersecurity analyst. Provide clear, "
            "actionable, and technically accurate analysis."
        )
        messages = [{"role": "user", "content": f"[{task}]\n\n{content}"}]
        result = await self.chat(messages, system_prompt=system, stream=False)
        assert isinstance(result, str)
        return result

    def get_model_name(self) -> str:
        return self._model

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)
