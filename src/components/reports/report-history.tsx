import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Trash2,
  Eye,
  FileDown,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import { ReportPreview } from "@/components/reports/report-preview";
import type { Report, ReportListResponse } from "@/types/report";

const typeColors: Record<string, string> = {
  full: "bg-accent/20 text-accent",
  vulnerability: "bg-danger/20 text-danger",
  recon: "bg-info/20 text-info",
  threat: "bg-warning/20 text-warning",
};

export function ReportHistory() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.get<ReportListResponse>("/api/reports/");
      setReports(data.reports);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const handleDelete = useCallback(async (reportId: string) => {
    setDeletingId(reportId);
    try {
      await ApiClient.del(`/api/reports/${reportId}`);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete report");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleDownloadPdf = useCallback((reportId: string) => {
    window.open(`${ApiClient.BASE_URL}/api/reports/${reportId}/pdf`, "_blank");
  }, []);

  const handleDownloadMd = useCallback((reportId: string) => {
    window.open(`${ApiClient.BASE_URL}/api/reports/${reportId}/markdown`, "_blank");
  }, []);

  if (selectedReport) {
    return (
      <ReportPreview
        report={selectedReport}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card flex items-center gap-3 border-danger/30 p-4 text-sm text-danger"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm text-text-secondary">Loading reports...</span>
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="glass-card flex flex-col items-center gap-4 p-16 text-center">
          <FileText className="h-12 w-12 text-text-muted/20" />
          <h3 className="text-lg font-semibold text-text-primary">No Reports Yet</h3>
          <p className="text-sm text-text-muted max-w-sm">
            Generate your first security report from the Create Report tab.
          </p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="grid gap-4">
          {reports.map((report, idx) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-text-primary truncate">
                    {report.title}
                  </h3>
                  <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase", typeColors[report.report_type] || "bg-bg-secondary text-text-muted")}>
                    {report.report_type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(report.created_at)}
                  </span>
                  <span>{report.content.statistics?.total_findings ?? 0} findings</span>
                  <span className={cn(
                    "font-semibold",
                    report.content.overall_risk === "Critical" && "text-danger",
                    report.content.overall_risk === "High" && "text-high",
                    report.content.overall_risk === "Medium" && "text-warning",
                    report.content.overall_risk === "Low" && "text-success",
                    report.content.overall_risk === "Info" && "text-info",
                  )}>
                    {report.content.overall_risk} Risk
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedReport(report)}
                  className="rounded-lg border border-border p-2 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-accent"
                  title="View Report"
                >
                  <Eye className="h-4 w-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDownloadPdf(report.id)}
                  className="rounded-lg border border-border p-2 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-accent"
                  title="Download PDF"
                >
                  <Download className="h-4 w-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDownloadMd(report.id)}
                  className="rounded-lg border border-border p-2 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-accent"
                  title="Download Markdown"
                >
                  <FileDown className="h-4 w-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => void handleDelete(report.id)}
                  disabled={deletingId === report.id}
                  className="rounded-lg border border-border p-2 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger hover:border-danger/30 disabled:opacity-50"
                  title="Delete Report"
                >
                  {deletingId === report.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
