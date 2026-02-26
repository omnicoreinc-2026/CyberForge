"""Ollama (local LLM) AI provider implementation.

Communicates with a local Ollama server over HTTP using ``httpx``.
No API key is required -- the provider checks reachability instead.
"""

import json
import logging
from typing import AsyncGenerator

import httpx

from backend.ai.base_provider import BaseAIProvider

logger = logging.getLogger(__name__)

# Models available through this provider.
SUPPORTED_MODELS = frozenset({
    "llama3.1",
    "mistral",
    "deepseek-coder",
})

DEFAULT_MODEL = "llama3.1"
OLLAMA_BASE_URL = "http://localhost:11434"
REQUEST_TIMEOUT = 120.0


class OllamaProvider(BaseAIProvider):
    """Local Ollama provider using the HTTP API."""

    def __init__(self, model: str = DEFAULT_MODEL, base_url: str = OLLAMA_BASE_URL) -> None:
        self._model = model if model in SUPPORTED_MODELS else DEFAULT_MODEL
        self._base_url = base_url.rstrip("/")
        self._configured: bool | None = None

    # ------------------------------------------------------------------
    # BaseAIProvider interface
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict],
        system_prompt: str = "",
        stream: bool = False,
    ) -> str | AsyncGenerator[str, None]:
        """Send messages to the local Ollama server."""
        api_messages: list[dict] = []

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

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{self._base_url}/api/chat",
                json={
                    "model": self._model,
                    "messages": api_messages,
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")

    async def _stream_chat(
        self,
        messages: list[dict],
    ) -> AsyncGenerator[str, None]:
        """Yield tokens by reading the NDJSON stream from Ollama."""
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/api/chat",
                json={
                    "model": self._model,
                    "messages": messages,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        content = chunk.get("message", {}).get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue

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
        """Ollama requires no API key; just check if we assume it is reachable."""
        # A lightweight check -- actual connectivity is verified via /test.
        return True

    async def check_connectivity(self) -> bool:
        """Ping the Ollama server to verify it is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False
