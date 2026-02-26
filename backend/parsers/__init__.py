"""Log and data parsers (syslog, Apache, Nginx, Windows Event, etc.)."""

from backend.parsers.apache_parser import ApacheParser
from backend.parsers.base_parser import BaseLogParser, LogEntry
from backend.parsers.nginx_parser import NginxParser
from backend.parsers.syslog_parser import SyslogParser
from backend.parsers.windows_event_parser import WindowsEventParser

__all__ = [
    "ApacheParser",
    "BaseLogParser",
    "LogEntry",
    "NginxParser",
    "SyslogParser",
    "WindowsEventParser",
]
