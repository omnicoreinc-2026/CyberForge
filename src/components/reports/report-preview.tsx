import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  FileDown,
  Shield,
  Target,
  AlertTriangle,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils";
import { ApiClient } from "@/lib/api-client";
import type { Report } from "@/types/report";

interface ReportPreviewProps {
  report: Report;
  onBack: () => void;
}

const riskColors: Record<string, string> = {
  Critical: "bg-danger text-white",
  High: "bg-high text-white",
  Medium: "bg-warning text-bg-primary",
  Low: "bg-success text-white",
  Info: "bg-info text-bg-primary",
};

const sevBadge: Record<string, string> = {
  critical: "bg-danger/20 text-danger",
  high: "bg-high/20 text-high",
  medium: "bg-warning/20 text-warning",
  low: "bg-success/20 text-success",
  info: "bg-info/20 text-info",
};

export function ReportPreview({ report, onBack }: ReportPreviewProps) {
  const { content } = report;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </motion.button>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.open(`${ApiClient.BASE_URL}/api/reports/${report.id}/pdf`, "_blank")}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg-primary hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.open(`${ApiClient.BASE_URL}/api/reports/${report.id}/markdown`, "_blank")}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
          >
            <FileDown className="h-4 w-4" />
            Markdown
          </motion.button>
        </div>
      </div>

      {/* Header Card */}
      <div className="glass-card overflow-hidden">
        <div className="bg-gradient-to-r from-[#0a0a1a] via-[#16213e] to-[#0f3460] p-6 text-white">
          <h1 className="text-xl font-bold">{content.title}</h1>
          <p className="mt-1 text-sm text-[#8ecae6]">CyberForge Security Assessment Report</p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#b8c6db]">
            <span><strong>Type:</strong> {content.report_type}</span>
            <span><strong>Generated:</strong> {formatTimestamp(content.generated_at)}</span>
            <span><strong>Targets:</strong> {content.targets.join(", ") || "N/A"}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4">
          <Shield className="h-5 w-5 text-text-muted" />
          <span className="text-sm text-text-muted">Overall Risk:</span>
          <span className={cn("rounded-lg px-3 py-1 text-sm font-bold uppercase", riskColors[content.overall_risk] || "bg-bg-secondary text-text-muted")}>
            {content.overall_risk}
          </span>
        </div>
      </div>

      {/* Executive Summary */}
      {content.executive_summary && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Executive Summary</h2>
          </div>
          <div className="rounded-lg bg-bg-secondary/50 border-l-4 border-accent p-4 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
            {content.executive_summary}
          </div>
        </div>
      )}

      {/* Statistics */}
      {content.statistics && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Statistics</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <div className="rounded-lg bg-bg-secondary p-3 text-center">
              <div className="text-xl font-bold text-text-primary">{content.statistics.total_scans}</div>
              <div className="text-[10px] uppercase text-text-muted tracking-wide">Scans</div>
            </div>
            <div className="rounded-lg bg-bg-secondary p-3 text-center">
              <div className="text-xl font-bold text-text-primary">{content.statistics.total_findings}</div>
              <div className="text-[10px] uppercase text-text-muted tracking-wide">Findings</div>
            </div>
            {Object.entries(content.statistics.severity_counts).map(([sev, count]) => (
              <div key={sev} className="rounded-lg bg-bg-secondary p-3 text-center">
                <div className={cn("text-xl font-bold", sev === "critical" && "text-danger", sev === "high" && "text-high", sev === "medium" && "text-warning", sev === "low" && "text-success", sev === "info" && "text-info")}>
                  {count}
                </div>
                <div className="text-[10px] uppercase text-text-muted tracking-wide">{sev}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan Results */}
      {content.scans.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Scan Results</h2>
          </div>
          <div className="flex flex-col gap-4">
            {content.scans.map((scan) => (
              <div key={scan.id} className="rounded-lg border border-border bg-bg-secondary/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-text-primary">{scan.scan_type}</span>
                  <span className="text-xs text-text-muted">-</span>
                  <span className="text-xs font-mono text-text-secondary">{scan.target}</span>
                  <span className={cn("ml-auto rounded px-2 py-0.5 text-[10px] font-semibold uppercase", sevBadge[scan.severity] || "bg-bg-secondary text-text-muted")}>
                    {scan.severity}
                  </span>
                </div>
                <div className="text-xs text-text-muted mb-2">
                  {scan.results.length} finding(s) | {new Date(scan.created_at).toLocaleDateString()}
                </div>
                {scan.results.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-2 pr-3 text-left text-text-muted font-medium">#</th>
                          <th className="py-2 pr-3 text-left text-text-muted font-medium">Finding</th>
                          <th className="py-2 pr-3 text-left text-text-muted font-medium">Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scan.results.slice(0, 10).map((finding, idx) => {
                          const name = typeof finding === "object" && finding !== null
                            ? String((finding as Record<string, unknown>).name || (finding as Record<string, unknown>).title || (finding as Record<string, unknown>).host || JSON.stringify(finding).slice(0, 50))
                            : String(finding).slice(0, 50);
                          const fsev = typeof finding === "object" && finding !== null
                            ? String((finding as Record<string, unknown>).severity || (finding as Record<string, unknown>).risk || "info").toLowerCase()
                            : "info";
                          return (
                            <tr key={idx} className="border-b border-border/50">
                              <td className="py-1.5 pr-3 text-text-muted">{idx + 1}</td>
                              <td className="py-1.5 pr-3 text-text-primary font-mono truncate max-w-xs">{name}</td>
                              <td className="py-1.5 pr-3">
                                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", sevBadge[fsev] || "bg-bg-secondary text-text-muted")}>{fsev}</span>
                              </td>
                            </tr>
                          );
                        })}
                        {scan.results.length > 10 && (
                          <tr>
                            <td colSpan={3} className="py-2 text-center text-text-muted italic">
                              ... and {scan.results.length - 10} more findings
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {content.recommendations.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Recommendations</h2>
          </div>
          <div className="flex flex-col gap-3">
            {content.recommendations.map((rec, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-bg-secondary/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase", sevBadge[rec.priority.toLowerCase()] || "bg-bg-secondary text-text-muted")}>
                    {rec.priority}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{rec.title}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-text-muted py-4 border-t border-border">
        Generated by CyberForge Security Command Center
      </div>
    </motion.div>
  );
}
