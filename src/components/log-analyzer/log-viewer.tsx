import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogEntry, LogAnomaly } from '@/types/log';

interface LogViewerProps {
  entries: LogEntry[];
  anomalies: LogAnomaly[];
}

const LINES_PER_PAGE = 100;

const LEVEL_COLORS: Record<string, string> = {
  ERROR: 'text-danger',
  CRITICAL: 'text-critical',
  EMERGENCY: 'text-critical',
  ALERT: 'text-critical',
  WARNING: 'text-warning',
  WARN: 'text-warning',
  NOTICE: 'text-info',
  INFO: 'text-info',
  DEBUG: 'text-text-muted',
};

const LEVEL_BG: Record<string, string> = {
  ERROR: 'bg-danger/20 text-danger border-danger/30',
  CRITICAL: 'bg-critical/20 text-critical border-critical/30',
  EMERGENCY: 'bg-critical/20 text-critical border-critical/30',
  ALERT: 'bg-critical/20 text-critical border-critical/30',
  WARNING: 'bg-warning/20 text-warning border-warning/30',
  WARN: 'bg-warning/20 text-warning border-warning/30',
  NOTICE: 'bg-info/20 text-info border-info/30',
  INFO: 'bg-info/20 text-info border-info/30',
  DEBUG: 'bg-bg-secondary text-text-muted border-border',
};

export function LogViewer({ entries, anomalies }: LogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const anomalyLines = useMemo(
    () => new Set(anomalies.map((a) => a.line_number)),
    [anomalies],
  );

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.message.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.level.toLowerCase().includes(q) ||
        e.raw.toLowerCase().includes(q),
    );
  }, [entries, searchQuery]);

  const totalPages = Math.ceil(filteredEntries.length / LINES_PER_PAGE);
  const pagedEntries = useMemo(
    () => filteredEntries.slice(page * LINES_PER_PAGE, (page + 1) * LINES_PER_PAGE),
    [filteredEntries, page],
  );

  const selectedEntry = useMemo(() => {
    if (selectedLine === null) return null;
    return entries[selectedLine - 1] ?? null;
  }, [entries, selectedLine]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    setSelectedLine(null);
  }, []);

  if (entries.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center gap-4 p-12">
        <Search className="h-12 w-12 text-accent/30" />
        <h3 className="text-lg font-semibold text-text-primary">No Log Entries</h3>
        <p className="text-sm text-text-secondary text-center max-w-md">
          Upload or paste log content in the Upload tab to begin analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            placeholder="Search logs..."
            className={cn(
              'w-full rounded-lg border border-border bg-bg-secondary py-2 pl-10 pr-8',
              'text-sm text-text-primary placeholder:text-text-muted outline-none',
              'focus:border-accent focus:ring-1 focus:ring-accent/30',
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="glass-card overflow-hidden rounded-xl">
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-secondary/50 sticky top-0 z-10">
                  <th className="px-3 py-2 text-left font-medium text-text-muted w-12">#</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted w-40">Timestamp</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted w-20">Level</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted w-36">Source</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Message</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {pagedEntries.map((entry, idx) => {
                  const lineNum = page * LINES_PER_PAGE + idx + 1;
                  const isAnomaly = anomalyLines.has(lineNum);
                  const isSelected = selectedLine === lineNum;
                  const levelUpper = entry.level.toUpperCase();
                  return (
                    <tr
                      key={lineNum}
                      onClick={() => setSelectedLine(isSelected ? null : lineNum)}
                      className={cn(
                        'cursor-pointer border-b border-border/50 transition-colors',
                        isAnomaly && 'border-l-2 border-l-danger',
                        isSelected ? 'bg-accent-dim' : 'hover:bg-bg-card-hover',
                      )}
                    >
                      <td className="px-3 py-1.5 text-text-muted">{lineNum}</td>
                      <td className="px-3 py-1.5 text-text-secondary truncate max-w-[160px]">
                        {entry.timestamp || '-'}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                          LEVEL_BG[levelUpper] ?? LEVEL_BG.INFO,
                        )}>
                          {levelUpper}
                        </span>
                      </td>
                      <td className={cn('px-3 py-1.5 truncate max-w-[144px]', LEVEL_COLORS[levelUpper] ?? 'text-text-secondary')}>
                        {entry.source || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-text-primary truncate max-w-[400px]">
                        {entry.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              Showing {page * LINES_PER_PAGE + 1}-{Math.min((page + 1) * LINES_PER_PAGE, filteredEntries.length)} of {filteredEntries.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(0, page - 1))}
                disabled={page === 0}
                className="rounded-md border border-border bg-bg-secondary p-1.5 text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-text-secondary">
                Page {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-md border border-border bg-bg-secondary p-1.5 text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="glass-card w-80 shrink-0 overflow-y-auto rounded-xl p-4"
            style={{ maxHeight: '700px' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-text-primary">Line {selectedLine}</h4>
              <button onClick={() => setSelectedLine(null)} className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <span className="text-text-muted">Level</span>
                <p className={cn('font-medium', LEVEL_COLORS[selectedEntry.level.toUpperCase()] ?? 'text-text-primary')}>
                  {selectedEntry.level}
                </p>
              </div>
              <div>
                <span className="text-text-muted">Timestamp</span>
                <p className="text-text-primary font-mono">{selectedEntry.timestamp || '-'}</p>
              </div>
              <div>
                <span className="text-text-muted">Source</span>
                <p className="text-text-primary">{selectedEntry.source || '-'}</p>
              </div>
              <div>
                <span className="text-text-muted">Message</span>
                <p className="text-text-primary break-words">{selectedEntry.message}</p>
              </div>
              {Object.keys(selectedEntry.metadata).length > 0 && (
                <div>
                  <span className="text-text-muted">Metadata</span>
                  <div className="mt-1 rounded-md bg-bg-secondary p-2 font-mono">
                    {Object.entries(selectedEntry.metadata).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-accent shrink-0">{key}:</span>
                        <span className="text-text-secondary break-all">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <span className="text-text-muted">Raw</span>
                <pre className="mt-1 overflow-x-auto rounded-md bg-bg-secondary p-2 text-[10px] text-text-secondary whitespace-pre-wrap break-all">
                  {selectedEntry.raw}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
