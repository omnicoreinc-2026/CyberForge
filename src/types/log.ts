export type LogLevel = 'ERROR' | 'CRITICAL' | 'EMERGENCY' | 'ALERT' | 'WARNING' | 'WARN' | 'NOTICE' | 'INFO' | 'DEBUG';

export type LogFormat = 'auto' | 'syslog' | 'apache' | 'nginx' | 'windows_event';

export type LogTab = 'upload' | 'analysis' | 'anomalies' | 'statistics';

export interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  raw: string;
  metadata: Record<string, unknown>;
}

export interface LogAnomaly {
  line_number: number;
  entry: LogEntry;
  reason: string;
  severity: string;
  confidence: number;
}

export interface LogStatistics {
  level_distribution: Record<string, number>;
  top_sources: { source: string; count: number }[];
  top_ips: { ip: string; count: number }[];
  error_rate: number;
  error_count: number;
  entries_over_time: { time: string; count: number }[];
  total_entries: number;
}

export interface LogAnalysisResult {
  scan_id: string;
  entries: LogEntry[];
  total_lines: number;
  parsed_lines: number;
  format_detected: string;
  anomalies: LogAnomaly[];
  statistics: LogStatistics;
  filename?: string;
}

export interface LogAnalysisRequest {
  content: string;
  format: LogFormat;
}
