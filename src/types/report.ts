export type ReportType = "full" | "vulnerability" | "recon" | "threat";

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface ReportStatistics {
  total_scans: number;
  total_findings: number;
  severity_counts: SeverityCounts;
}

export interface ReportRecommendation {
  priority: string;
  title: string;
  description: string;
}

export interface ReportScan {
  id: string;
  scan_type: string;
  target: string;
  results: Record<string, unknown>[];
  severity: string;
  created_at: string;
}

export interface ReportContent {
  title: string;
  report_type: string;
  generated_at: string;
  overall_risk: string;
  targets: string[];
  statistics: ReportStatistics;
  executive_summary: string | null;
  scans: ReportScan[];
  recommendations: ReportRecommendation[];
}

export interface Report {
  id: string;
  title: string;
  report_type: string;
  content: ReportContent;
  pdf_path: string | null;
  created_at: string;
}

export interface ReportRequest {
  title: string;
  report_type: ReportType;
  scan_ids: string[];
  include_ai_summary: boolean;
}

export interface AvailableScan {
  id: string;
  scan_type: string;
  target: string;
  severity: string;
  created_at: string;
}

export interface ReportListResponse {
  reports: Report[];
  count: number;
}

export interface AvailableScansResponse {
  scans: AvailableScan[];
  count: number;
}

export interface GenerateReportResponse {
  scan_id: string;
  report: Report;
}
