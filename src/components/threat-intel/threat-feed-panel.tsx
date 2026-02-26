import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rss, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiClient } from "@/lib/api-client";
import { formatTimestamp } from "@/lib/utils";
import type { ThreatFeedResponse, ThreatFeedEntry } from "@/types/threat";
import type { ScanStatus } from "@/types/scan";

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const config =
    confidence >= 80
      ? { label: "Critical", color: "bg-danger/20 text-danger" }
      : confidence >= 60
        ? { label: "High", color: "bg-high/20 text-high" }
        : confidence >= 40
          ? { label: "Medium", color: "bg-warning/20 text-warning" }
          : confidence >= 20
            ? { label: "Low", color: "bg-info/20 text-info" }
            : { label: "Info", color: "bg-bg-card text-text-muted" };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", config.color)}>
      {config.label} ({confidence})
    </span>
  );
}

function FeedRow({ entry, index }: { entry: ThreatFeedEntry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02, duration: 0.3 }}
      className="flex items-center gap-4 border-b border-border/50 px-4 py-3 hover:bg-accent-dim/20 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-text-primary truncate">{entry.ioc_value}</span>
          <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs text-text-muted">{entry.ioc_type}</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-text-muted">{entry.threat_type || "unknown"}</span>
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {entry.timestamp ? formatTimestamp(entry.timestamp) : "-"}
          </span>
        </div>
      </div>
      <ConfidenceBadge confidence={entry.confidence} />
      <span className="rounded bg-accent-dim px-2 py-0.5 text-xs text-accent">{entry.source}</span>
    </motion.div>
  );
}

export function ThreatFeedPanel() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [entries, setEntries] = useState<ThreatFeedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchFeed = useCallback(async () => {
    setStatus("running");
    setError(null);
    try {
      const data = await ApiClient.get<ThreatFeedResponse>("/api/threat/feed?limit=50");
      if (mountedRef.current) {
        setEntries(data.entries);
        setStatus("complete");
      }
    } catch {
      if (mountedRef.current) {
        setError("Failed to fetch threat feed");
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    async function load() {
      setStatus("running");
      setError(null);
      try {
        const data = await ApiClient.get<ThreatFeedResponse>("/api/threat/feed?limit=50");
        if (!controller.signal.aborted) {
          setEntries(data.entries);
          setStatus("complete");
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Failed to fetch threat feed");
          setStatus("error");
        }
      }
    }
    void load();
    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rss className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Live Threat Feed</h3>
          {status === "complete" && (
            <span className="text-xs text-text-muted">({entries.length} entries)</span>
          )}
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => void fetchFeed()}
          disabled={status === "running"}
          className={cn(
            "flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-1.5 border border-border",
            "text-xs text-text-secondary hover:text-accent hover:border-accent/30",
            "disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          )}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", status === "running" && "animate-spin")} />
          Refresh
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-card border-danger/30 p-4 text-sm text-danger">{error}
          </motion.div>
        )}
      </AnimatePresence>

      {status === "running" && entries.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-text-secondary">Loading threat feed...</span>
        </motion.div>
      )}

      {status === "complete" && entries.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            {entries.map((entry, idx) => (
              <FeedRow key={entry.id} entry={entry} index={idx} />
            ))}
          </div>
        </motion.div>
      )}

      {status === "complete" && entries.length === 0 && (
        <div className="glass-card p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">No threat feed entries available at this time.</p>
        </div>
      )}
    </div>
  );
}
