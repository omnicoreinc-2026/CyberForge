import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileSearch, Upload, FileText, AlertTriangle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogUploadPanel } from '@/components/log-analyzer/log-upload-panel';
import { LogViewer } from '@/components/log-analyzer/log-viewer';
import { AnomalyPanel } from '@/components/log-analyzer/anomaly-panel';
import { StatsPanel } from '@/components/log-analyzer/stats-panel';
import type { LogTab, LogAnalysisResult } from '@/types/log';

const tabs: { id: LogTab; label: string; icon: typeof FileSearch }[] = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'analysis', label: 'Analysis', icon: FileText },
  { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export function LogsPage() {
  const [activeTab, setActiveTab] = useState<LogTab>('upload');
  const [result, setResult] = useState<LogAnalysisResult | null>(null);

  const handleAnalysisComplete = useCallback((analysisResult: LogAnalysisResult) => {
    setResult(analysisResult);
    setActiveTab('analysis');
  }, []);

  const anomalyCount = result?.anomalies.length ?? 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileSearch className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Log Analyzer</h1>
          <p className="text-sm text-text-secondary">
            Parse, analyze, and detect anomalies in syslog, Apache, Nginx, and Windows Event logs
          </p>
        </div>
      </div>

      {/* Summary bar when results exist */}
      {result && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-card flex items-center gap-6 rounded-xl px-5 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Format:</span>
            <span className="rounded-md bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent">
              {result.format_detected}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Parsed:</span>
            <span className="text-xs font-medium text-text-primary">
              {result.parsed_lines} / {result.total_lines} lines
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Anomalies:</span>
            <span className={cn(
              'text-xs font-medium',
              anomalyCount > 0 ? 'text-warning' : 'text-success',
            )}>
              {anomalyCount}
            </span>
          </div>
          {result.statistics.error_rate !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Error Rate:</span>
              <span className={cn(
                'text-xs font-medium',
                result.statistics.error_rate > 10 ? 'text-danger' : 'text-text-primary',
              )}>
                {result.statistics.error_rate}%
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Tab navigation */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-secondary p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-accent-dim text-accent shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-card',
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === 'anomalies' && anomalyCount > 0 && (
              <span className="ml-1 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                {anomalyCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === 'upload' && (
          <LogUploadPanel onAnalysisComplete={handleAnalysisComplete} />
        )}
        {activeTab === 'analysis' && (
          <LogViewer entries={result?.entries ?? []} anomalies={result?.anomalies ?? []} />
        )}
        {activeTab === 'anomalies' && (
          <AnomalyPanel anomalies={result?.anomalies ?? []} />
        )}
        {activeTab === 'statistics' && (
          <StatsPanel statistics={result?.statistics ?? null} />
        )}
      </motion.div>
    </motion.div>
  );
}
