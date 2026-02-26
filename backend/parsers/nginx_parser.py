"""Nginx log parser.

Supports:
- Nginx combined access log format (similar to Apache Combined)
- Nginx error log format
    YYYY/MM/DD HH:MM:SS [level] PID#TID: *CID message
"""

import re

from backend.parsers.base_parser import BaseLogParser, LogEntry

# Nginx access log (combined format)
_ACCESS_REGEX = re.compile(
    r'^(\S+)'                          # remote_addr
    r'\s+-\s+'                         # separator
    r'(\S+)'                           # remote_user (or -)
    r'\s+\[([^\]]+)\]'                 # [time_local]
    r'\s+"(\S+)\s+(\S+)\s*(\S*)"'     # "method path protocol"
    r'\s+(\d{3})'                      # status
    r'\s+(\d+)'                        # body_bytes_sent
    r'(?:\s+"([^"]*)")?'              # http_referer
    r'(?:\s+"([^"]*)")?'              # http_user_agent
)

# Nginx error log
_ERROR_REGEX = re.compile(
    r'^(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})'  # timestamp
    r'\s+\[(\w+)\]'                                 # [level]
    r'\s+(\d+)#(\d+):'                              # pid#tid
    r'\s+(?:\*(\d+)\s+)?'                           # *connection_id (optional)
    r'(.*)'                                         # message
)

_STATUS_LEVEL_MAP = {
    range(200, 300): "INFO",
    range(300, 400): "INFO",
    range(400, 500): "WARN",
    range(500, 600): "ERROR",
}

_NGINX_LEVEL_MAP: dict[str, str] = {
    "emerg": "EMERGENCY",
    "alert": "ALERT",
    "crit": "CRITICAL",
    "error": "ERROR",
    "warn": "WARNING",
    "notice": "NOTICE",
    "info": "INFO",
    "debug": "DEBUG",
}


def _status_to_level(status: int) -> str:
    """Map an HTTP status code to a log level."""
    for code_range, level in _STATUS_LEVEL_MAP.items():
        if status in code_range:
            return level
    return "INFO"


class NginxParser(BaseLogParser):
    """Parser for Nginx combined access and error log formats."""

    @property
    def format_name(self) -> str:
        return "nginx"

    def parse_line(self, line: str) -> LogEntry | None:
        """Try to parse the line as an Nginx access or error log entry."""
        entry = self._parse_access(line)
        if entry is not None:
            return entry
        return self._parse_error(line)

    def _parse_access(self, line: str) -> LogEntry | None:
        """Parse an Nginx combined access log line."""
        match = _ACCESS_REGEX.match(line)
        if not match:
            return None

        (ip, user, timestamp, method, path, protocol,
         status_str, bytes_str, referer, user_agent) = match.groups()
        status = int(status_str)
        bytes_sent = int(bytes_str) if bytes_str else 0

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
                "format": "nginx_access",
            },
        )

    def _parse_error(self, line: str) -> LogEntry | None:
        """Parse an Nginx error log line."""
        match = _ERROR_REGEX.match(line)
        if not match:
            return None

        timestamp, level_str, pid, tid, conn_id, message = match.groups()
        level = _NGINX_LEVEL_MAP.get(level_str.lower(), "INFO")

        # Extract client IP if present in the message
        client_match = re.search(r'client:\s*([\d.]+)', message)
        client_ip = client_match.group(1) if client_match else ""

        return LogEntry(
            timestamp=timestamp,
            level=level,
            source=f"nginx/{pid}",
            message=message.strip(),
            raw=line,
            metadata={
                "pid": pid,
                "tid": tid,
                "connection_id": conn_id or "",
                "client": client_ip,
                "format": "nginx_error",
            },
        )
