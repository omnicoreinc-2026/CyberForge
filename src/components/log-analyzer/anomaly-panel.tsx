import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowUpDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogAnomaly } from '@/types/log';

interface AnomalyPanelProps {
  anomalies: LogAnomaly[];
}

type SortMode = 'severity' | 'confidence' | 'line';

const SEVERITY_CONFIG: Record<string, { label: string; colorClass: string; order: number }> = {
  critical: { label: 'Critical', colorClass: 'bg-critical/20 text-critical border-critical/30', order: 0 },
  high: { label: 'High', colorClass: 'bg-high/20 text-high border-high/30', order: 1 },
  medium: { label: 'Medium', colorClass: 'bg-medium/20 text-medium border-medium/30', order: 2 },
  low: { label: 'Low', colorClass: 'bg-low/20 text-low border-low/30', order: 3 },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function AnomalyPanel({ anomalies }: AnomalyPanelProps) {
  const [sortMode, setSortMode] = useState<SortMode>('severity');

  const sortedAnomalies = useMemo(() => {
    const sorted = [...anomalies];
    switch (sortMode) {
      case 'severity':
        sorted.sort((a, b) => {
          const aOrder = SEVERITY_CONFIG[a.severity]?.order ?? 99;
          const bOrder = SEVERITY_CONFIG[b.severity]?.order ?? 99;
          return aOrder - bOrder || b.confidence - a.confidence;
        });
        break;
      case 'confidence':
        sorted.sort((a, b) => b.confidence - a.confidence);
        break;
      case 'line':
        sorted.sort((a, b) => a.line_number - b.line_number);
        break;
    }
    return sorted;
  }, [anomalies, sortMode]);

  if (anomalies.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center gap-4 p-12">
        <Shield className="h-12 w-12 text-success/50" />
        <h3 className="text-lg font-semibold text-text-primary">No Anomalies Detected</h3>
        <p className="text-sm text-text-secondary text-center max-w-md">
          No suspicious patterns, attack signatures, or error bursts were found in the analyzed logs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <span className="text-sm font-medium text-text-primary">
            {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} detected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-text-muted" />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className={cn(
              'rounded-md border border-border bg-bg-secondary px-2 py-1',
              'text-xs text-text-primary outline-none',
              'focus:border-accent',
            )}
          >
            <option value="severity">Sort by Severity</option>
            <option value="confidence">Sort by Confidence</option>
            <option value="line">Sort by Line Number</option>
          </select>
        </div>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        className="flex flex-col gap-3"
      >
        {sortedAnomalies.map((anomaly, idx) => {
          const sevConfig = SEVERITY_CONFIG[anomaly.severity] ?? SEVERITY_CONFIG.low;
          return (
            <motion.div key={idx} variants={itemVariants} className="glass-card overflow-hidden rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      sevConfig.colorClass,
                    )}>
                      {sevConfig.label}
                    </span>
                    {anomaly.line_number > 0 && (
                      <span className="text-xs text-text-muted">Line {anomaly.line_number}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-text-primary">{anomaly.reason}</p>
                  {anomaly.entry.message && (
                    <p className="mt-1 font-mono text-xs text-text-secondary truncate max-w-[600px]">
                      {anomaly.entry.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-text-muted">Confidence</span>
                  <span className={cn(
                    'text-sm font-semibold font-mono',
                    anomaly.confidence >= 0.8 ? 'text-danger' : anomaly.confidence >= 0.6 ? 'text-warning' : 'text-text-secondary',
                  )}>
                    {Math.round(anomaly.confidence * 100)}%
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
