"""Syslog (RFC 3164) log parser.

Handles the traditional BSD syslog format:
    <priority>timestamp hostname app[pid]: message

Also handles the common variant without the priority prefix:
    timestamp hostname app[pid]: message
"""

import re
from datetime import datetime

from backend.parsers.base_parser import BaseLogParser, LogEntry

# RFC 3164 with optional priority
# Example: <34>Oct 11 22:14:15 mymachine su[12345]: 'su root' failed
_SYSLOG_REGEX = re.compile(
    r"^(?:<(\d{1,3})>)?"                          # optional <priority>
    r"(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})"     # timestamp (e.g. Oct 11 22:14:15)
    r"\s+([\w.\-]+)"                               # hostname
    r"\s+([\w.\-/]+)"                              # app name
    r"(?:\[(\d+)\])?"                              # optional [pid]
    r":\s*(.*)"                                    # message
)

# Alternative: ISO timestamp variant sometimes seen in rsyslog
_SYSLOG_ISO_REGEX = re.compile(
    r"^(?:<(\d{1,3})>)?"                           # optional <priority>
    r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"      # ISO timestamp
    r"(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?)"          # fractional seconds + tz
    r"\s+([\w.\-]+)"                               # hostname
    r"\s+([\w.\-/]+)"                              # app name
    r"(?:\[(\d+)\])?"                              # optional [pid]
    r":\s*(.*)"                                    # message
)

# Syslog severity levels derived from the priority value
_SYSLOG_SEVERITIES = [
    "EMERGENCY", "ALERT", "CRITICAL", "ERROR",
    "WARNING", "NOTICE", "INFO", "DEBUG",
]


def _priority_to_severity(priority: int) -> str:
    """Extract the severity level from an RFC 3164 priority value."""
    severity_index = priority & 0x07
    if 0 <= severity_index < len(_SYSLOG_SEVERITIES):
        return _SYSLOG_SEVERITIES[severity_index]
    return "INFO"


def _normalize_timestamp(raw_ts: str) -> str:
    """Try to normalise a syslog timestamp to ISO-8601."""
    # Already ISO?
    if "T" in raw_ts:
        return raw_ts
    # BSD format (no year) -- assume current year
    try:
        dt = datetime.strptime(raw_ts, "%b %d %H:%M:%S")
        dt = dt.replace(year=datetime.now().year)
        return dt.isoformat()
    except ValueError:
        return raw_ts


class SyslogParser(BaseLogParser):
    """Parser for RFC 3164 syslog messages."""

    @property
    def format_name(self) -> str:
        return "syslog"

    def parse_line(self, line: str) -> LogEntry | None:
        """Parse a single syslog line."""
        for regex in (_SYSLOG_REGEX, _SYSLOG_ISO_REGEX):
            match = regex.match(line)
            if match:
                priority_str, timestamp, hostname, app_name, pid, message = match.groups()

                priority = int(priority_str) if priority_str else None
                severity = _priority_to_severity(priority) if priority is not None else "INFO"

                return LogEntry(
                    timestamp=_normalize_timestamp(timestamp),
                    level=severity,
                    source=f"{hostname}/{app_name}",
                    message=message,
                    raw=line,
                    metadata={
                        "hostname": hostname,
                        "app_name": app_name,
                        "pid": pid or "",
                        "priority": priority if priority is not None else "",
                        "format": "syslog",
                    },
                )

        return None
