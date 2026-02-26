"""Base log parser abstract class.

Defines the interface all log format parsers must implement,
along with shared utilities for line-by-line parsing and
format auto-detection.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class LogEntry:
    """Represents a single parsed log entry."""

    timestamp: str = ""
    level: str = "INFO"
    source: str = ""
    message: str = ""
    raw: str = ""
    metadata: dict[str, str | int | float | None] = field(default_factory=dict)


class BaseLogParser(ABC):
    """Abstract base class for log format parsers.

    Subclasses must implement ``parse_line`` to handle a single raw
    log line and return a ``LogEntry`` (or ``None`` if the line cannot
    be parsed).  ``parse_file`` iterates over all lines in a multi-line
    string and collects successful parses.
    """

    @abstractmethod
    def parse_line(self, line: str) -> LogEntry | None:
        """Parse a single log line into a ``LogEntry``.

        Returns ``None`` when the line does not match the expected format.
        """

    def parse_file(self, content: str) -> list[LogEntry]:
        """Parse an entire log file (as a string) into a list of entries."""
        entries: list[LogEntry] = []
        for line in content.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            entry = self.parse_line(stripped)
            if entry is not None:
                entries.append(entry)
        return entries

    def detect_format(self, sample: str) -> str:
        """Attempt to detect whether *sample* matches this parser's format.

        Returns the format name (e.g. ``"syslog"``, ``"apache"``) when
        at least 40% of the first 10 non-blank lines parse successfully,
        otherwise returns ``"unknown"``.
        """
        lines = [ln.strip() for ln in sample.splitlines() if ln.strip()][:10]
        if not lines:
            return "unknown"
        parsed = sum(1 for ln in lines if self.parse_line(ln) is not None)
        ratio = parsed / len(lines)
        return self.format_name if ratio >= 0.4 else "unknown"

    @property
    @abstractmethod
    def format_name(self) -> str:
        """Human-readable name of the log format (e.g. ``'syslog'``)."""
