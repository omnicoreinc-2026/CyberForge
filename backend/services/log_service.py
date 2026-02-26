"""Log analysis orchestration service.

Coordinates log parsing, statistical analysis, and anomaly detection.
Stores results in the database and emits progress updates over WebSocket.
"""

import json
import logging
import re
from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4

from backend.database import db
from backend.models.logs import (
    LogAnalysisResult,
    LogAnomaly,
    LogEntryModel,
)
from backend.parsers.apache_parser import ApacheParser
from backend.parsers.base_parser import BaseLogParser, LogEntry
from backend.parsers.nginx_parser import NginxParser
from backend.parsers.syslog_parser import SyslogParser
from backend.parsers.windows_event_parser import WindowsEventParser
from backend.utils.progress import ProgressEmitter

logger = logging.getLogger(__name__)

# Known attack patterns for anomaly detection
_ATTACK_PATTERNS: list[tuple[str, str, str]] = [
    (r"(?i)(union\s+select|select\s+.*\s+from|drop\s+table|insert\s+into|delete\s+from|update\s+.*\s+set)", "Possible SQL injection attempt", "high"),
    (r"(?i)(\.\.[\/]+|\.\.%2[fF])", "Path traversal attempt detected", "high"),
    (r"(?i)(<script[^>]*>|javascript:|on\w+\s*=)", "Possible XSS (cross-site scripting) attempt", "high"),
    (r"(?i)(\/etc\/passwd|\/etc\/shadow|cmd\.exe|powershell\.exe)", "Suspicious system file access attempt", "critical"),
    (r"(?i)(admin|root|administrator)\s*(login|auth|password)\s*(fail|error|denied|invalid)", "Failed privileged authentication attempt", "high"),
    (r"(?i)(brute\s*force|too\s+many\s+attempts|rate\s+limit|blocked)", "Brute force / rate limit trigger", "medium"),
    (r"(?i)(ssh|ftp|rdp|smb).*?(fail|denied|error|invalid|refused)", "Failed remote access attempt", "medium"),
    (r"(?i)(wget|curl|python-requests|go-http-client|nikto|sqlmap|nmap)", "Automated tool / scanner detected", "medium"),
]

_COMPILED_PATTERNS = [
    (re.compile(pat), reason, sev) for pat, reason, sev in _ATTACK_PATTERNS
]


def _entry_to_model(entry: LogEntry) -> LogEntryModel:
    """Convert an internal LogEntry dataclass to a Pydantic model."""
    return LogEntryModel(
        timestamp=entry.timestamp,
        level=entry.level,
        source=entry.source,
        message=entry.message,
        raw=entry.raw,
        metadata=entry.metadata,
    )


class LogService:
    """Orchestrates log analysis operations."""

    _parsers: list[BaseLogParser] = [
        SyslogParser(),
        ApacheParser(),
        NginxParser(),
        WindowsEventParser(),
    ]

    async def analyze_logs(
        self,
        content: str,
        log_format: str = "auto",
        scan_id: str = "",
        emitter: ProgressEmitter | None = None,
    ) -> LogAnalysisResult:
        """Analyze log content: parse, detect anomalies, compute statistics."""
        if not scan_id:
            scan_id = str(uuid4())

        total_lines = len([ln for ln in content.splitlines() if ln.strip()])

        if emitter:
            await emitter.emit(0, "running", "Detecting log format", "log_analyzer")

        parser = self._select_parser(content, log_format)
        format_detected = parser.format_name if parser else "unknown"

        if emitter:
            await emitter.emit(10, "running", f"Format detected: {format_detected}", "log_analyzer")

        if emitter:
            await emitter.emit(15, "running", "Parsing log entries", "log_analyzer")

        if parser:
            raw_entries = parser.parse_file(content)
        else:
            raw_entries = [
                LogEntry(message=line.strip(), raw=line.strip(), level="INFO")
                for line in content.splitlines() if line.strip()
            ]

        entries = [_entry_to_model(e) for e in raw_entries]
        parsed_lines = len(entries)

        if emitter:
            await emitter.emit(50, "running", f"Parsed {parsed_lines}/{total_lines} lines", "log_analyzer")

        if emitter:
            await emitter.emit(55, "running", "Running anomaly detection", "log_analyzer")

        anomalies = self._detect_anomalies(entries)

        if emitter:
            await emitter.emit(75, "running", f"Found {len(anomalies)} anomalies", "log_analyzer")

        if emitter:
            await emitter.emit(80, "running", "Computing statistics", "log_analyzer")

        statistics = self._compute_statistics(entries)

        if emitter:
            await emitter.emit(95, "running", "Storing results", "log_analyzer")

        await self._store_result(scan_id, content, format_detected, entries, anomalies, statistics)

        if emitter:
            await emitter.emit(100, "completed", "Log analysis complete", "log_analyzer")

        return LogAnalysisResult(
            entries=entries,
            total_lines=total_lines,
            parsed_lines=parsed_lines,
            format_detected=format_detected,
            anomalies=anomalies,
            statistics=statistics,
        )

    def _select_parser(self, content: str, log_format: str) -> BaseLogParser | None:
        """Select the appropriate parser based on format or auto-detection."""
        format_map: dict[str, BaseLogParser] = {p.format_name: p for p in self._parsers}

        if log_format != "auto" and log_format in format_map:
            return format_map[log_format]

        sample = "\n".join(content.splitlines()[:10])
        for parser in self._parsers:
            detected = parser.detect_format(sample)
            if detected != "unknown":
                return parser
        return None

    def _detect_anomalies(self, entries: list[LogEntryModel]) -> list[LogAnomaly]:
        """Run multi-layer anomaly detection across all parsed entries.

        Layers:
            1. Pattern matching (SQL injection, XSS, path traversal, etc.)
            2. Error burst detection (clustered errors in short spans)
            3. Repeated auth failure detection (brute force indicators)
            4. HTTP status code frequency analysis
            5. Request rate spike detection (per-source)
            6. Off-hours activity detection (unusual time windows)
            7. Large response/payload anomaly (oversized requests)
        """
        anomalies: list[LogAnomaly] = []
        existing_lines: set[int] = set()

        # --- Layer 1: Pattern matching ---
        for idx, entry in enumerate(entries):
            text = f"{entry.message} {entry.raw}"
            for pattern, reason, severity in _COMPILED_PATTERNS:
                if pattern.search(text):
                    anomalies.append(LogAnomaly(
                        line_number=idx + 1, entry=entry,
                        reason=reason, severity=severity, confidence=0.85,
                    ))
                    existing_lines.add(idx + 1)
                    break

        # --- Layer 2: Error burst detection ---
        error_entries = [
            (idx, e) for idx, e in enumerate(entries)
            if e.level.upper() in ("ERROR", "CRITICAL", "EMERGENCY", "ALERT")
        ]
        if len(error_entries) >= 5:
            for i in range(len(error_entries) - 4):
                window = error_entries[i:i + 5]
                start_idx = window[0][0]
                end_idx = window[-1][0]
                if end_idx - start_idx <= 20:
                    burst_entry = window[0][1]
                    if (start_idx + 1) not in existing_lines:
                        anomalies.append(LogAnomaly(
                            line_number=start_idx + 1, entry=burst_entry,
                            reason=f"Error burst: {len(window)} errors within {end_idx - start_idx + 1} lines",
                            severity="high", confidence=0.75,
                        ))
                        existing_lines.add(start_idx + 1)

        # --- Layer 3: Repeated auth failure detection ---
        auth_fail_sources: Counter[str] = Counter()
        for entry in entries:
            msg_lower = entry.message.lower()
            if any(kw in msg_lower for kw in ("auth", "login", "password", "credential")):
                if any(kw in msg_lower for kw in ("fail", "denied", "invalid", "error", "rejected")):
                    auth_fail_sources[entry.source] += 1

        for source, count in auth_fail_sources.items():
            if count >= 3:
                anomalies.append(LogAnomaly(
                    line_number=0,
                    entry=LogEntryModel(
                        source=source,
                        message=f"Repeated failed authentication from {source} ({count} attempts)",
                        level="WARNING",
                    ),
                    reason=f"Repeated failed authentication: {count} failures from {source}",
                    severity="critical" if count >= 20 else "high" if count >= 10 else "medium",
                    confidence=min(0.95, 0.5 + count * 0.05),
                ))

        # --- Layer 4: HTTP status code frequency ---
        status_codes: Counter[int] = Counter()
        for entry in entries:
            sc = entry.metadata.get("status_code")
            if isinstance(sc, int):
                status_codes[sc] += 1

        for code, count in status_codes.items():
            if code >= 400 and count >= 10:
                anomalies.append(LogAnomaly(
                    line_number=0,
                    entry=LogEntryModel(message=f"HTTP {code} occurred {count} times", level="WARNING"),
                    reason=f"High frequency of HTTP {code} responses ({count} occurrences)",
                    severity="medium" if code < 500 else "high",
                    confidence=min(0.9, 0.4 + count * 0.02),
                ))

        # --- Layer 5: Request rate spike detection (per-source IP) ---
        ip_time_buckets: dict[str, Counter[str]] = {}
        for entry in entries:
            ip = entry.metadata.get("ip")
            ts = entry.timestamp
            if isinstance(ip, str) and ip and ts:
                if ip not in ip_time_buckets:
                    ip_time_buckets[ip] = Counter()
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    bucket = dt.strftime("%Y-%m-%d %H:%M")
                    ip_time_buckets[ip][bucket] += 1
                except (ValueError, TypeError):
                    pass

        for ip, buckets in ip_time_buckets.items():
            if not buckets:
                continue
            counts = list(buckets.values())
            mean = sum(counts) / len(counts)
            if len(counts) >= 2 and mean > 0:
                std_dev = (sum((c - mean) ** 2 for c in counts) / len(counts)) ** 0.5
                threshold = mean + max(3 * std_dev, 10)
                for bucket_time, count in buckets.items():
                    if count > threshold and count >= 20:
                        anomalies.append(LogAnomaly(
                            line_number=0,
                            entry=LogEntryModel(
                                source=ip,
                                message=f"Request spike from {ip}: {count} requests in 1 minute at {bucket_time}",
                                level="WARNING",
                            ),
                            reason=f"Request rate spike: {count} req/min from {ip} (normal avg: {mean:.0f}/min)",
                            severity="high" if count > threshold * 2 else "medium",
                            confidence=min(0.92, 0.6 + (count - threshold) / 100),
                        ))
                        break  # one alert per IP

        # --- Layer 6: Off-hours activity detection ---
        hour_counts: Counter[int] = Counter()
        off_hours_ips: Counter[str] = Counter()
        for entry in entries:
            ts = entry.timestamp
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    hour_counts[dt.hour] += 1
                    if dt.hour < 6 or dt.hour >= 22:
                        ip = entry.metadata.get("ip", entry.source)
                        if ip:
                            off_hours_ips[ip] += 1
                except (ValueError, TypeError):
                    pass

        total_entries = len(entries)
        if total_entries > 50:
            daytime = sum(hour_counts[h] for h in range(6, 22))
            nighttime = sum(hour_counts[h] for h in list(range(0, 6)) + list(range(22, 24)))
            if daytime > 0 and nighttime > 0:
                night_ratio = nighttime / total_entries
                if night_ratio > 0.3:
                    anomalies.append(LogAnomaly(
                        line_number=0,
                        entry=LogEntryModel(
                            message=f"Unusual off-hours activity: {nighttime} events ({night_ratio:.0%}) between 22:00-06:00",
                            level="WARNING",
                        ),
                        reason=f"High off-hours activity: {night_ratio:.0%} of traffic outside business hours",
                        severity="medium",
                        confidence=min(0.85, 0.5 + night_ratio),
                    ))

        for ip, count in off_hours_ips.most_common(5):
            if count >= 10:
                anomalies.append(LogAnomaly(
                    line_number=0,
                    entry=LogEntryModel(
                        source=ip,
                        message=f"{ip} generated {count} requests during off-hours (22:00-06:00)",
                        level="WARNING",
                    ),
                    reason=f"Off-hours activity from {ip}: {count} requests between 22:00-06:00",
                    severity="medium",
                    confidence=min(0.80, 0.4 + count * 0.03),
                ))

        # --- Layer 7: Oversized request/response detection ---
        for idx, entry in enumerate(entries):
            size = entry.metadata.get("bytes_sent") or entry.metadata.get("body_bytes_sent")
            if isinstance(size, (int, float)) and size > 10_000_000:
                if (idx + 1) not in existing_lines:
                    anomalies.append(LogAnomaly(
                        line_number=idx + 1, entry=entry,
                        reason=f"Unusually large response: {size / 1_000_000:.1f} MB",
                        severity="medium", confidence=0.70,
                    ))

        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        anomalies.sort(key=lambda a: (severity_order.get(a.severity, 99), -a.confidence))
        return anomalies

    def _compute_statistics(self, entries: list[LogEntryModel]) -> dict:
        """Compute statistical summary of parsed log entries."""
        if not entries:
            return {"level_distribution": {}, "top_sources": [], "top_ips": [],
                    "error_rate": 0, "entries_over_time": [], "total_entries": 0}

        level_counter: Counter[str] = Counter()
        for entry in entries:
            level_counter[entry.level.upper()] += 1
        level_distribution = dict(level_counter.most_common())

        source_counter: Counter[str] = Counter()
        for entry in entries:
            if entry.source:
                source_counter[entry.source] += 1
        top_sources = [{"source": src, "count": cnt} for src, cnt in source_counter.most_common(10)]

        ip_counter: Counter[str] = Counter()
        for entry in entries:
            ip = entry.metadata.get("ip")
            if isinstance(ip, str) and ip:
                ip_counter[ip] += 1
        top_ips = [{"ip": ip, "count": cnt} for ip, cnt in ip_counter.most_common(10)]

        total = len(entries)
        error_count = sum(
            1 for e in entries
            if e.level.upper() in ("ERROR", "CRITICAL", "EMERGENCY", "ALERT")
        )
        error_rate = round((error_count / total) * 100, 2) if total > 0 else 0

        time_buckets: Counter[str] = Counter()
        for entry in entries:
            if entry.timestamp:
                ts = entry.timestamp
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    bucket = dt.strftime("%Y-%m-%d %H:00")
                    time_buckets[bucket] += 1
                except (ValueError, TypeError):
                    time_buckets[ts[:13]] += 1

        entries_over_time = [{"time": t, "count": c} for t, c in sorted(time_buckets.items())]

        return {
            "level_distribution": level_distribution,
            "top_sources": top_sources,
            "top_ips": top_ips,
            "error_rate": error_rate,
            "error_count": error_count,
            "entries_over_time": entries_over_time,
            "total_entries": total,
        }

    async def _store_result(
        self, scan_id: str, content: str, format_detected: str,
        entries: list[LogEntryModel], anomalies: list[LogAnomaly], statistics: dict,
    ) -> None:
        """Persist log analysis results to the database."""
        conn = await db.get_connection()
        now = datetime.now(timezone.utc).isoformat()

        result_data = {
            "format_detected": format_detected,
            "total_entries": len(entries),
            "anomaly_count": len(anomalies),
            "statistics": statistics,
            "anomalies": [a.model_dump() for a in anomalies],
        }

        await conn.execute(
            "INSERT OR REPLACE INTO scan_results (id, scan_type, target, results_json, severity, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (scan_id, "log_analysis", f"log_analysis_{format_detected}",
             json.dumps(result_data),
             "high" if any(a.severity in ("critical", "high") for a in anomalies) else "info", now),
        )

        await conn.execute(
            "INSERT OR REPLACE INTO scan_history (id, module, target, status, started_at, completed_at, result_count) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (scan_id, "log_analysis", f"log_{format_detected}", "completed", now, now, len(entries)),
        )
        await conn.commit()

    async def get_history(self, page: int = 1, per_page: int = 20, search: str = "") -> dict:
        """Retrieve past log analysis records with pagination."""
        conn = await db.get_connection()
        offset = (page - 1) * per_page
        params: list = ["log_analysis"]
        where = "WHERE module = ?"
        if search:
            where += " AND target LIKE ?"
            params.append(f"%{search}%")
        count_cursor = await conn.execute(f"SELECT COUNT(*) as cnt FROM scan_history {where}", params)
        total = (await count_cursor.fetchone())["cnt"]
        cursor = await conn.execute(
            f"SELECT id, module, target, status, started_at, completed_at, result_count "
            f"FROM scan_history {where} ORDER BY started_at DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        )
        rows = await cursor.fetchall()
        return {
            "scans": [
                {"id": row["id"], "module": row["module"], "target": row["target"],
                 "status": row["status"], "started_at": row["started_at"],
                 "completed_at": row["completed_at"], "result_count": row["result_count"]}
                for row in rows
            ],
            "total": total, "page": page, "per_page": per_page,
        }
