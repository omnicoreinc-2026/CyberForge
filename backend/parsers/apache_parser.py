"""Apache HTTP Server log parser.

Supports:
- Combined Log Format (access logs)
    %h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-Agent}i"
- Apache error log format
    [timestamp] [module:level] [pid N] [client IP:port] message
"""

import re

from backend.parsers.base_parser import BaseLogParser, LogEntry

# Apache Combined Log Format
_ACCESS_REGEX = re.compile(
    r'^(\S+)'                          # client IP
    r'\s+(\S+)'                        # ident (usually -)
    r'\s+(\S+)'                        # user (usually -)
    r'\s+\[([^\]]+)\]'                 # timestamp [dd/Mon/yyyy:HH:MM:SS +HHMM]
    r'\s+"(\S+)\s+(\S+)\s*(\S*)"'     # "METHOD path protocol"
    r'\s+(\d{3})'                      # status code
    r'\s+(\S+)'                        # bytes (or -)
    r'(?:\s+"([^"]*)")?'              # referer (optional)
    r'(?:\s+"([^"]*)")?'              # user-agent (optional)
)

# Apache error log (2.4+ format)
_ERROR_REGEX = re.compile(
    r'^\[([^\]]+)\]'                   # timestamp
    r'\s+\[(?:(\w+):)?(\w+)\]'        # [module:level]
    r'\s+\[pid\s+(\d+)\]'             # [pid N]
    r'(?:\s+\[client\s+([^\]]+)\])?'  # [client IP:port] (optional)
    r'\s*(.*)'                         # message
)

_STATUS_LEVEL_MAP = {
    range(200, 300): "INFO",
    range(300, 400): "INFO",
    range(400, 500): "WARN",
    range(500, 600): "ERROR",
}

_ERROR_LEVEL_MAP: dict[str, str] = {
    "emerg": "EMERGENCY",
    "alert": "ALERT",
    "crit": "CRITICAL",
    "error": "ERROR",
    "warn": "WARNING",
    "notice": "NOTICE",
    "info": "INFO",
    "debug": "DEBUG",
    "trace1": "DEBUG",
    "trace2": "DEBUG",
    "trace3": "DEBUG",
    "trace4": "DEBUG",
    "trace5": "DEBUG",
    "trace6": "DEBUG",
    "trace7": "DEBUG",
    "trace8": "DEBUG",
}


def _status_to_level(status: int) -> str:
    """Map an HTTP status code to a log level."""
    for code_range, level in _STATUS_LEVEL_MAP.items():
        if status in code_range:
            return level
    return "INFO"


class ApacheParser(BaseLogParser):
    """Parser for Apache Combined and error log formats."""

    @property
    def format_name(self) -> str:
        return "apache"

    def parse_line(self, line: str) -> LogEntry | None:
        """Try to parse the line as an Apache access or error log entry."""
        entry = self._parse_access(line)
        if entry is not None:
            return entry
        return self._parse_error(line)

    def _parse_access(self, line: str) -> LogEntry | None:
        """Parse an Apache Combined access log line."""
        match = _ACCESS_REGEX.match(line)
        if not match:
            return None

        (ip, _ident, user, timestamp, method, path,
         protocol, status_str, bytes_str, referer, user_agent) = match.groups()

        status = int(status_str)
        bytes_sent = int(bytes_str) if bytes_str and bytes_str != "-" else 0

        return LogEntry(
            timestamp=timestamp,
            level=_status_to_level(status),
            source=ip,
            message=f"{method} {path} {status}",
            raw=line,
            metadata={
                "ip": ip,
                "user": user if user != "-" else "",
                "method": method,
                "path": path,
                "protocol": protocol,
                "status_code": status,
                "bytes": bytes_sent,
                "referer": referer or "",
                "user_agent": user_agent or "",
                "format": "apache_access",
            },
        )

    def _parse_error(self, line: str) -> LogEntry | None:
        """Parse an Apache error log line."""
        match = _ERROR_REGEX.match(line)
        if not match:
            return None

        timestamp, module, level_str, pid, client, message = match.groups()
        level = _ERROR_LEVEL_MAP.get(level_str.lower(), "INFO") if level_str else "INFO"

        return LogEntry(
            timestamp=timestamp,
            level=level,
            source=f"apache/{module}" if module else "apache",
            message=message.strip(),
            raw=line,
            metadata={
                "module": module or "",
                "pid": pid,
                "client": client or "",
                "format": "apache_error",
            },
        )
