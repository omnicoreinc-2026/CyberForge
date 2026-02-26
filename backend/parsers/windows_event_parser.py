"""Windows Event Log parser.

Handles exported Windows Event Log data in XML format (.evtx exports).
Falls back to regex-based XML element extraction when a full XML parser
is not practical for large files.
"""

import re
import xml.etree.ElementTree as ET

from backend.parsers.base_parser import BaseLogParser, LogEntry

# Namespace used in Windows Event Log XML
_NS = {"evt": "http://schemas.microsoft.com/win/2004/08/events/event"}

# Regex fallbacks for simple XML field extraction
_EVENT_ID_RE = re.compile(r"<EventID[^>]*>(\d+)</EventID>", re.IGNORECASE)
_LEVEL_RE = re.compile(r"<Level>(\d+)</Level>", re.IGNORECASE)
_TIME_RE = re.compile(r'SystemTime=["\']([^"\']+)["\']', re.IGNORECASE)
_PROVIDER_RE = re.compile(r'Name=["\']([^"\']+)["\']', re.IGNORECASE)
_CHANNEL_RE = re.compile(r"<Channel>([^<]+)</Channel>", re.IGNORECASE)
_MESSAGE_RE = re.compile(r"<Data[^>]*>([^<]+)</Data>", re.IGNORECASE)
_COMPUTER_RE = re.compile(r"<Computer>([^<]+)</Computer>", re.IGNORECASE)

# Windows Event Log level mapping (numeric to string)
_LEVEL_MAP: dict[int, str] = {
    0: "INFO",       # LogAlways
    1: "CRITICAL",   # Critical
    2: "ERROR",      # Error
    3: "WARNING",    # Warning
    4: "INFO",       # Information
    5: "DEBUG",      # Verbose
}


def _level_int_to_str(level_int: int) -> str:
    """Convert a Windows Event Log numeric level to a string."""
    return _LEVEL_MAP.get(level_int, "INFO")


class WindowsEventParser(BaseLogParser):
    """Parser for Windows Event Log XML exports."""

    @property
    def format_name(self) -> str:
        return "windows_event"

    def parse_line(self, line: str) -> LogEntry | None:
        """Parse a single XML event block or a single-line event summary."""
        # Try structured XML parsing first
        entry = self._parse_xml_fragment(line)
        if entry is not None:
            return entry

        # Fallback: regex extraction from a raw XML line/block
        return self._parse_regex(line)

    def parse_file(self, content: str) -> list[LogEntry]:
        """Parse a complete Windows Event Log XML export."""
        entries: list[LogEntry] = []

        # Attempt full XML parse
        try:
            entries = self._parse_full_xml(content)
            if entries:
                return entries
        except ET.ParseError:
            pass

        # Fallback: split on <Event> boundaries and regex-parse each block
        event_blocks = re.split(r"(?=<Event[\s>])", content, flags=re.IGNORECASE)
        for block in event_blocks:
            block = block.strip()
            if not block:
                continue
            entry = self._parse_regex(block)
            if entry is not None:
                entries.append(entry)

        return entries

    def _parse_full_xml(self, content: str) -> list[LogEntry]:
        """Parse the entire XML content as an ElementTree."""
        wrapped = content
        if not content.strip().startswith("<?xml") and "<Events" not in content:
            wrapped = f"<Events>{content}</Events>"

        root = ET.fromstring(wrapped)
        entries: list[LogEntry] = []

        for event_elem in root.iter():
            tag = event_elem.tag.split("}")[-1] if "}" in event_elem.tag else event_elem.tag
            if tag != "Event":
                continue

            entry = self._extract_from_element(event_elem)
            if entry is not None:
                entries.append(entry)

        return entries

    def _extract_from_element(self, event_elem: ET.Element) -> LogEntry | None:
        """Extract a LogEntry from an <Event> XML element."""
        def find_text(parent: ET.Element, path: str) -> str:
            elem = parent.find(f".//evt:{path}", _NS)
            if elem is not None and elem.text:
                return elem.text
            elem = parent.find(f".//{path}")
            if elem is not None and elem.text:
                return elem.text
            return ""

        def find_attr(parent: ET.Element, path: str, attr: str) -> str:
            elem = parent.find(f".//evt:{path}", _NS)
            if elem is None:
                elem = parent.find(f".//{path}")
            if elem is not None:
                return elem.get(attr, "")
            return ""

        event_id = find_text(event_elem, "EventID")
        level_str = find_text(event_elem, "Level")
        timestamp = find_attr(event_elem, "TimeCreated", "SystemTime")
        provider = find_attr(event_elem, "Provider", "Name")
        channel = find_text(event_elem, "Channel")
        computer = find_text(event_elem, "Computer")

        # Collect Data elements as the message
        data_parts: list[str] = []
        for data_elem in event_elem.iter():
            tag = data_elem.tag.split("}")[-1] if "}" in data_elem.tag else data_elem.tag
            if tag == "Data" and data_elem.text:
                data_parts.append(data_elem.text)
        message = " | ".join(data_parts) if data_parts else f"Event {event_id}"

        if not event_id and not timestamp:
            return None

        level_int = int(level_str) if level_str.isdigit() else 4
        level = _level_int_to_str(level_int)

        raw = ET.tostring(event_elem, encoding="unicode", method="xml")

        return LogEntry(
            timestamp=timestamp,
            level=level,
            source=provider or channel or "windows",
            message=message,
            raw=raw,
            metadata={
                "event_id": event_id,
                "level_raw": level_str,
                "provider": provider,
                "channel": channel,
                "computer": computer,
                "format": "windows_event",
            },
        )

    def _parse_xml_fragment(self, text: str) -> LogEntry | None:
        """Try to parse a text block as an XML <Event> fragment."""
        if "<Event" not in text:
            return None
        try:
            elem = ET.fromstring(text)
            return self._extract_from_element(elem)
        except ET.ParseError:
            return None

    def _parse_regex(self, text: str) -> LogEntry | None:
        """Extract event fields from XML text using regex."""
        event_id_match = _EVENT_ID_RE.search(text)
        if not event_id_match:
            return None

        event_id = event_id_match.group(1)

        level_match = _LEVEL_RE.search(text)
        level_int = int(level_match.group(1)) if level_match else 4
        level = _level_int_to_str(level_int)

        time_match = _TIME_RE.search(text)
        timestamp = time_match.group(1) if time_match else ""

        provider_match = _PROVIDER_RE.search(text)
        provider = provider_match.group(1) if provider_match else ""

        channel_match = _CHANNEL_RE.search(text)
        channel = channel_match.group(1) if channel_match else ""

        computer_match = _COMPUTER_RE.search(text)
        computer = computer_match.group(1) if computer_match else ""

        # Collect all <Data> values
        data_values = _MESSAGE_RE.findall(text)
        message = " | ".join(data_values) if data_values else f"Event {event_id}"

        return LogEntry(
            timestamp=timestamp,
            level=level,
            source=provider or channel or "windows",
            message=message,
            raw=text,
            metadata={
                "event_id": event_id,
                "level_raw": str(level_int),
                "provider": provider,
                "channel": channel,
                "computer": computer,
                "format": "windows_event",
            },
        )
