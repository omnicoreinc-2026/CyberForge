import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShieldAlert, AlertTriangle, Database, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import type { IocLookupResponse, IocResult } from '@/types/threat';
import type { ScanStatus, Severity } from '@/types/scan';

const severityConfig: Record<Severity, { color: string; bg: string }> = {
  critical: { color: 'text-danger', bg: 'bg-danger/10' },
  high: { color: 'text-high', bg: 'bg-high/10' },
  medium: { color: 'text-warning', bg: 'bg-warning/10' },
  low: { color: 'text-info', bg: 'bg-info/10' },
  info: { color: 'text-text-secondary', bg: 'bg-bg-card' },
};

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80 ? 'bg-danger' : value >= 60 ? 'bg-high' : value >= 40 ? 'bg-warning' : value >= 20 ? 'bg-info' : 'bg-text-muted';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <span className="text-xs font-mono text-text-secondary">{value}%</span>
    </div>
  );
}

function SourceCard({ name, data }: { name: string; data: Record<string, unknown> }) {
  const hasError = Boolean(data.error);
  return (
    <div className={cn('glass-card p-4 flex flex-col gap-2', hasError && 'border-danger/30')}>
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-text-primary capitalize">{name}</span>
        {hasError ? <span className="text-xs text-danger ml-auto">Error</span> : null}
      </div>
      {hasError ? (
        <p className="text-xs text-danger">{String(data.error)}</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(data).filter(([k]) => k !== 'error').map(([key, val]) => (
            <div key={key} className="flex items-baseline gap-1">
              <span className="text-xs text-text-muted truncate">{key.replace(/_/g, ' ')}:</span>
              <span className="text-xs font-mono text-text-secondary truncate">
                {Array.isArray(val) ? val.join(', ') || '-' : String(val ?? '-')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IocResultRow({ result, index }: { result: IocResult; index: number }) {
  const sev = severityConfig[
    result.confidence >= 80 ? 'critical' : result.confidence >= 60 ? 'high' : result.confidence >= 40 ? 'medium' : result.confidence >= 20 ? 'low' : 'info'
  ];
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="glass-card p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className={cn("h-4 w-4", sev.color)} />
          <span className="font-mono text-sm text-text-primary truncate max-w-xs">{result.value}</span>
          <span className={cn("rounded px-2 py-0.5 text-xs font-medium", sev.bg, sev.color)}>
            {result.source}
          </span>
        </div>
        <ConfidenceBar value={result.confidence} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-text-muted">Type</span>
          <p className="font-mono text-text-secondary">{result.ioc_type}</p>
        </div>
        <div>
          <span className="text-text-muted">Threat</span>
          <p className="font-mono text-text-secondary">{result.threat_type || "-"}</p>
        </div>
        <div>
          <span className="text-text-muted">Malware</span>
          <p className="font-mono text-text-secondary">{result.malware || "-"}</p>
        </div>
        <div>
          <span className="text-text-muted">First Seen</span>
          <p className="font-mono text-text-secondary">{result.first_seen || "-"}</p>
        </div>
      </div>
      {result.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Tag className="h-3 w-3 text-text-muted" />
          {result.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-accent-dim px-2 py-0.5 text-xs text-accent">
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function IocLookupPanel() {
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [results, setResults] = useState<IocLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    setStatus("running");
    setError(null);
    try {
      const data = await ApiClient.post<IocLookupResponse>("/api/threat/ioc", { target: target.trim() });
      setResults(data);
      setStatus("complete");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "IOC lookup failed";
      setError(message);
      setStatus("error");
    }
  }, [target]);

  const sev = results ? severityConfig[results.severity] : severityConfig.info;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleScan(); }}
            placeholder="Enter IP, domain, URL, or hash..."
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
          {status === "running" ? "Scanning..." : "Lookup"}
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
          <span className="text-sm text-text-secondary">Querying threat intelligence sources...</span>
        </motion.div>
      )}

      {status === "complete" && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className={cn("h-6 w-6", sev.color)} />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {results.ioc_value} <span className="text-text-muted font-normal">({results.ioc_type})</span>
                </p>
                <p className="text-xs text-text-secondary">
                  {results.total_sources_queried} sources queried &middot; {results.ioc_results.length} results
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={cn("rounded px-3 py-1 text-xs font-bold uppercase", sev.bg, sev.color)}>
                {results.severity}
              </span>
              <ConfidenceBar value={results.max_confidence} />
            </div>
          </div>

          {Object.keys(results.sources).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-2">Source Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(results.sources).map(([name, data]) => (
                  <SourceCard key={name} name={name} data={data as unknown as Record<string, unknown>} />
                ))}
              </div>
            </div>
          )}

          {results.ioc_results.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-2">IOC Results</h3>
              <div className="flex flex-col gap-3">
                {results.ioc_results.map((r, idx) => (
                  <IocResultRow key={`${r.source}-${r.value}-${idx}`} result={r} index={idx} />
                ))}
              </div>
            </div>
          )}

          {results.ioc_results.length === 0 && (
            <div className="glass-card p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-secondary">No threat intelligence data found for this indicator.</p>
            </div>
          )}
        </motion.div>
      )}

      {status === "idle" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
          <ShieldAlert className="h-10 w-10 opacity-30" />
          <p className="text-sm">Enter an IOC to look up across threat intelligence sources</p>
        </motion.div>
      )}
    </div>
  );
}
