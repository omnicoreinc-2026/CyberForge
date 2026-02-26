import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Search, MapPin, Server, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiClient, ApiClientError } from "@/lib/api-client";
import type { IpReputationResponse } from "@/types/threat";
import { ABUSE_CATEGORIES } from "@/types/threat";
import type { ScanStatus } from "@/types/scan";

function AbuseScoreGauge({ score }: { score: number }) {
  const radius = 60;
  const stroke = 10;
  const circumference = Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 80 ? "#ef4444" : score >= 60 ? "#f97316" : score >= 40 ? "#eab308" : score >= 20 ? "#3b82f6" : "#22c55e";

  return (
    <div className="flex flex-col items-center">
      <svg width="150" height="85" viewBox="0 0 150 85">
        <path
          d="M 15 80 A 60 60 0 0 1 135 80"
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-bg-secondary"
        />
        <motion.path
          d="M 15 80 A 60 60 0 0 1 135 80"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <text x="75" y="70" textAnchor="middle" className="fill-text-primary text-2xl font-bold" fontSize="28">
          {score}
        </text>
        <text x="75" y="82" textAnchor="middle" className="fill-text-muted text-xs" fontSize="10">
          / 100
        </text>
      </svg>
      <span
        className={cn("text-sm font-semibold mt-1")}
        style={{ color }}
      >
        {score >= 80 ? "Very Malicious" : score >= 60 ? "Malicious" : score >= 40 ? "Suspicious" : score >= 20 ? "Low Risk" : "Clean"}
      </span>
    </div>
  );
}

function CategoryTag({ categoryId }: { categoryId: number }) {
  const name = ABUSE_CATEGORIES[categoryId] || `Category ${categoryId}`;
  const colors: Record<string, string> = {
    "DDoS Attack": "bg-danger/20 text-danger",
    "Brute-Force": "bg-high/20 text-high",
    "Hacking": "bg-danger/20 text-danger",
    "Port Scan": "bg-warning/20 text-warning",
    "Web App Attack": "bg-danger/20 text-danger",
    "SQL Injection": "bg-danger/20 text-danger",
    "SSH": "bg-high/20 text-high",
    "Phishing": "bg-high/20 text-high",
    "Email Spam": "bg-warning/20 text-warning",
    "IoT Targeted": "bg-high/20 text-high",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", colors[name] || "bg-info/20 text-info")}>
      {name}
    </span>
  );
}

interface IpReputationPanelProps {
  externalTarget?: string;
}

export function IpReputationPanel({ externalTarget }: IpReputationPanelProps) {
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [results, setResults] = useState<IpReputationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<string>('');

  const handleScan = useCallback(async (override?: string) => {
    const t = (override ?? target).trim();
    if (!t) return;
    setStatus("running");
    setError(null);
    try {
      const data = await ApiClient.post<IpReputationResponse>("/api/threat/ip-reputation", { target: t });
      setResults(data);
      setStatus("complete");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "IP reputation check failed";
      setError(message);
      setStatus("error");
    }
  }, [target]);

  useEffect(() => {
    if (externalTarget && externalTarget !== triggerRef.current) {
      triggerRef.current = externalTarget;
      setTarget(externalTarget);
      void handleScan(externalTarget);
    }
  }, [externalTarget, handleScan]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleScan(); }}
            placeholder="Enter IP address (e.g., 8.8.8.8)"
            disabled={status === "running"}
            className={cn(
              "w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5",
              "text-sm text-text-primary placeholder:text-text-muted font-mono",
              "outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => void handleScan()}
          disabled={status === "running" || !target.trim()}
          className={cn(
            "flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5",
            "text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50",
            "hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]",
          )}
        >
          <Search className="h-4 w-4" />
          {status === "running" ? "Checking..." : "Check"}
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-card border-danger/30 p-4 text-sm text-danger">{error}
          </motion.div>
        )}
      </AnimatePresence>

      {status === "running" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-text-secondary">Checking IP reputation...</span>
        </motion.div>
      )}

      {status === "complete" && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass-card p-6 flex flex-col items-center justify-center">
              <AbuseScoreGauge score={results.reputation.abuse_score} />
            </div>

            <div className="glass-card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Server className="h-4 w-4 text-accent" />
                Network Info
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">IP Address</span>
                  <span className="font-mono text-text-primary">{results.reputation.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">ISP</span>
                  <span className="font-mono text-text-secondary truncate ml-2">{results.reputation.isp || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Domain</span>
                  <span className="font-mono text-text-secondary">{results.reputation.domain || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Country</span>
                  <span className="font-mono text-text-secondary">{results.reputation.country || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Total Reports</span>
                  <span className="font-mono text-accent">{results.reputation.total_reports}</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <MapPin className="h-4 w-4 text-accent" />
                Geolocation
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Country</span>
                  <span className="font-mono text-text-secondary">{results.geolocation.country || "-"} {results.geolocation.country_code ? `(${results.geolocation.country_code})` : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Region</span>
                  <span className="font-mono text-text-secondary">{results.geolocation.region || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">City</span>
                  <span className="font-mono text-text-secondary">{results.geolocation.city || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">ISP</span>
                  <span className="font-mono text-text-secondary truncate ml-2">{results.geolocation.isp || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Coordinates</span>
                  <span className="font-mono text-text-secondary">{results.geolocation.lat}, {results.geolocation.lon}</span>
                </div>
              </div>
            </div>
          </div>

          {results.reputation.categories.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Abuse Categories</h3>
              <div className="flex flex-wrap gap-2">
                {results.reputation.categories.map((cat) => (
                  <CategoryTag key={cat} categoryId={cat} />
                ))}
              </div>
            </div>
          )}

          {results.reputation.last_reported && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Clock className="h-3 w-3" />
              Last reported: {results.reputation.last_reported}
            </div>
          )}
        </motion.div>
      )}

      {status === "idle" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
          <Shield className="h-10 w-10 opacity-30" />
          <p className="text-sm">Enter an IP address to check its reputation</p>
        </motion.div>
      )}
    </div>
  );
}
