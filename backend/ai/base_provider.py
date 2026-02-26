"""Abstract base class for AI providers.

Defines the interface that all AI provider implementations
(Anthropic, OpenAI, Ollama) must conform to.
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator


class BaseAIProvider(ABC):
    """Abstract base for AI provider integrations.

    Each provider must implement chat, analyze, and model introspection
    methods. The ``is_configured`` property determines whether the
    provider has valid credentials and is ready for use.
    """

    @abstractmethod
    async def chat(
        self,
        messages: list[dict],
        system_prompt: str = "",
        stream: bool = False,
    ) -> str | AsyncGenerator[str, None]:
        """Send a chat conversation and return the assistant reply.

        Args:
            messages: List of ``{"role": ..., "content": ...}`` dicts.
            system_prompt: Optional system-level instruction prepended
                to the conversation.
            stream: When True, return an async generator that yields
                tokens one at a time.

        Returns:
            The full reply string, or an async generator of token strings
            when streaming.
        """

    @abstractmethod
    async def analyze(self, content: str, task: str) -> str:
        """Run a focused analysis on the given content.

        Args:
            content: Raw text to analyze (CVE data, logs, etc.).
            task: Short label for the analysis type.

        Returns:
            The analysis result as a string.
        """

    @abstractmethod
    def get_model_name(self) -> str:
        """Return the identifier of the currently active model."""

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """Whether the provider has valid credentials / connectivity."""
