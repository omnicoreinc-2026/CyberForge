import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  CheckSquare,
  Square,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,

} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import { ReportPreview } from "@/components/reports/report-preview";
import type {
  ReportType,
  AvailableScan,
  AvailableScansResponse,
  GenerateReportResponse,
  Report,
} from "@/types/report";

const reportTypes: { id: ReportType; label: string; description: string }[] = [
  { id: "full", label: "Full Assessment", description: "Comprehensive security assessment covering all modules" },
  { id: "vulnerability", label: "Vulnerability Report", description: "Focus on discovered vulnerabilities and remediation" },
  { id: "recon", label: "Recon Report", description: "Reconnaissance and target enumeration findings" },
  { id: "threat", label: "Threat Report", description: "Threat intelligence analysis and indicators" },
];

const STEPS = ["Configure", "Select Scans", "Options", "Generate"] as const;

export function ReportBuilder() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [reportType, setReportType] = useState<ReportType>("full");
  const [availableScans, setAvailableScans] = useState<AvailableScan[]>([]);
  const [selectedScans, setSelectedScans] = useState<Set<string>>(new Set());
  const [includeAiSummary, setIncludeAiSummary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<Report | null>(null);
  const [loadingScans, setLoadingScans] = useState(false);

  useEffect(() => {
    async function fetchScans() {
      setLoadingScans(true);
      try {
        const data = await ApiClient.get<AvailableScansResponse>("/api/reports/scans/available");
        setAvailableScans(data.scans);
      } catch {
        setAvailableScans([]);
      } finally {
        setLoadingScans(false);
      }
    }
    void fetchScans();
  }, []);

  const toggleScan = useCallback((scanId: string) => {
    setSelectedScans((prev) => {
      const next = new Set(prev);
      if (next.has(scanId)) {
        next.delete(scanId);
      } else {
        next.add(scanId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedScans(new Set(availableScans.map((s) => s.id)));
  }, [availableScans]);

  const deselectAll = useCallback(() => {
    setSelectedScans(new Set());
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const data = await ApiClient.post<GenerateReportResponse>("/api/reports/generate", {
        title: title || "Security Assessment Report",
        report_type: reportType,
        scan_ids: Array.from(selectedScans),
        include_ai_summary: includeAiSummary,
      });
      setGeneratedReport(data.report);
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Report generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [title, reportType, selectedScans, includeAiSummary]);

  const canAdvance = step === 0 ? title.trim().length > 0 : step === 1 ? true : true;

  if (generatedReport) {
    return (
      <ReportPreview
        report={generatedReport}
        onBack={() => {
          setGeneratedReport(null);
          setStep(0);
          setTitle("");
          setSelectedScans(new Set());
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, idx) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => idx < step && setStep(idx)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                idx === step
                  ? "bg-accent text-bg-primary"
                  : idx < step
                    ? "bg-accent/20 text-accent cursor-pointer hover:bg-accent/30"
                    : "bg-bg-secondary text-text-muted"
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-current/20 text-[10px] font-bold">
                {idx + 1}
              </span>
              {label}
            </button>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-text-muted" />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
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

      {/* Step 1: Configure */}
      {step === 0 && (
        <motion.div
          key="step-config"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-col gap-6"
        >
          <div className="glass-card flex flex-col gap-4 p-6">
            <label className="text-sm font-medium text-text-secondary">
              Report Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q1 2026 Security Assessment"
              className="rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div className="glass-card flex flex-col gap-4 p-6">
            <label className="text-sm font-medium text-text-secondary">
              Report Type
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {reportTypes.map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => setReportType(rt.id)}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-4 text-left transition-all",
                    reportType === rt.id
                      ? "border-accent bg-accent/10 shadow-[0_0_15px_rgba(0,212,255,0.1)]"
                      : "border-border bg-bg-secondary hover:border-text-muted"
                  )}
                >
                  <span className="text-sm font-medium text-text-primary">{rt.label}</span>
                  <span className="text-xs text-text-muted">{rt.description}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 2: Select Scans */}
      {step === 1 && (
        <motion.div
          key="step-scans"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="glass-card flex flex-col gap-4 p-6"
        >
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">
              Select Scans to Include ({selectedScans.size} selected)
            </label>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-accent hover:underline">
                Select All
              </button>
              <span className="text-xs text-text-muted">|</span>
              <button onClick={deselectAll} className="text-xs text-text-muted hover:text-text-secondary hover:underline">
                Deselect All
              </button>
            </div>
          </div>

          {loadingScans && (
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span className="text-sm text-text-secondary">Loading available scans...</span>
            </div>
          )}

          {!loadingScans && availableScans.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FileText className="h-10 w-10 text-text-muted/30" />
              <p className="text-sm text-text-muted">
                No scan results available yet. Run scans from other modules first.
              </p>
            </div>
          )}

          {!loadingScans && availableScans.length > 0 && (
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
              {availableScans.map((scan) => (
                <button
                  key={scan.id}
                  onClick={() => toggleScan(scan.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    selectedScans.has(scan.id)
                      ? "border-accent/50 bg-accent/5"
                      : "border-border bg-bg-secondary hover:border-text-muted"
                  )}
                >
                  {selectedScans.has(scan.id) ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-text-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {scan.scan_type}
                      </span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        scan.severity === "critical" && "bg-danger/20 text-danger",
                        scan.severity === "high" && "bg-high/20 text-high",
                        scan.severity === "medium" && "bg-warning/20 text-warning",
                        scan.severity === "low" && "bg-success/20 text-success",
                        scan.severity === "info" && "bg-info/20 text-info",
                      )}>
                        {scan.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span className="truncate">{scan.target}</span>
                      <span>-</span>
                      <span>{new Date(scan.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Step 3: Options */}
      {step === 2 && (
        <motion.div
          key="step-options"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-col gap-6"
        >
          <div className="glass-card flex flex-col gap-4 p-6">
            <label className="text-sm font-medium text-text-secondary">
              AI-Powered Summary
            </label>
            <button
              onClick={() => setIncludeAiSummary((prev) => !prev)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 transition-all",
                includeAiSummary
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-secondary hover:border-text-muted"
              )}
            >
              <Sparkles className={cn("h-5 w-5", includeAiSummary ? "text-accent" : "text-text-muted")} />
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-text-primary">
                  Include AI Executive Summary
                </span>
                <p className="text-xs text-text-muted">
                  Uses your configured AI provider to generate a professional executive summary
                </p>
              </div>
              <div className={cn(
                "h-5 w-9 rounded-full transition-colors",
                includeAiSummary ? "bg-accent" : "bg-border"
              )}>
                <div className={cn(
                  "h-5 w-5 rounded-full bg-white shadow transition-transform",
                  includeAiSummary ? "translate-x-4" : "translate-x-0"
                )} />
              </div>
            </button>
          </div>

          <div className="glass-card flex flex-col gap-3 p-6">
            <label className="text-sm font-medium text-text-secondary">Summary</label>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between rounded-lg bg-bg-secondary p-3">
                <span className="text-text-muted">Title</span>
                <span className="font-medium text-text-primary">{title || "Untitled"}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-bg-secondary p-3">
                <span className="text-text-muted">Type</span>
                <span className="font-medium text-text-primary">{reportType}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-bg-secondary p-3">
                <span className="text-text-muted">Scans</span>
                <span className="font-medium text-text-primary">{selectedScans.size}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-bg-secondary p-3">
                <span className="text-text-muted">AI Summary</span>
                <span className="font-medium text-text-primary">{includeAiSummary ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </motion.button>

        <div className="flex gap-3">
          {step === 2 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => void handleGenerate()}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-bg-primary hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate Report
                </>
              )}
            </motion.button>
          )}

          {step < 2 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStep((s) => Math.min(2, s + 1))}
              disabled={!canAdvance}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-bg-primary hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
