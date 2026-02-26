import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Search, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import type { HeaderAnalysisResponse, HeaderStatus, SecurityGrade } from '@/types/vuln';
import type { ScanStatus } from '@/types/scan';

const statusIcons: Record<HeaderStatus, typeof CheckCircle2> = { pass: CheckCircle2, fail: XCircle, warning: AlertTriangle };
const statusColors: Record<HeaderStatus, string> = { pass: 'text-success', fail: 'text-danger', warning: 'text-warning' };
const gradeColors: Record<SecurityGrade, string> = {
  'A+': 'text-success bg-success/10 border-success/30', 'A': 'text-success bg-success/10 border-success/30',
  'B': 'text-info bg-info/10 border-info/30', 'C': 'text-warning bg-warning/10 border-warning/30',
  'D': 'text-high bg-high/10 border-high/30', 'F': 'text-danger bg-danger/10 border-danger/30',
};

export function HeaderAnalysisPanel() {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<HeaderAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    setStatus('running'); setError(null);
    try {
      const data = await ApiClient.post<HeaderAnalysisResponse>('/api/vuln/headers', { target: target.trim() });
      setResults(data); setStatus('complete');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Header analysis failed'); setStatus('error');
    }
  }, [target]);

  const toggleExpand = (name: string) => setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleScan(); }}
          placeholder="Enter URL (e.g., https://example.com)" disabled={status === 'running'}
          className={cn('flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleScan()} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]')}>
          <Search className="h-4 w-4" />{status === 'running' ? 'Analyzing...' : 'Analyze Headers'}
        </motion.button>
      </div>
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /><span className="text-sm text-text-secondary">Analyzing security headers...</span></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="glass-card flex items-center justify-between p-6">
            <div>
              <span className="text-xs text-text-muted">Security Grade</span>
              <div className={cn('mt-1 inline-flex items-center rounded-lg border px-4 py-2 text-2xl font-bold', gradeColors[results.grade])}>{results.grade}</div>
            </div>
            <div className="text-right">
              <span className="text-xs text-text-muted">Score</span>
              <p className="font-mono text-2xl font-bold text-text-primary">{results.score}/100</p>
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Header</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Value</th>
                <th className="w-8 px-4 py-3"></th>
              </tr></thead>
              <tbody>{results.headers.map((h) => {
                const Icon = statusIcons[h.status];
                return (
                  <tr key={h.name} className="border-b border-border/50 hover:bg-accent-dim/30">
                    <td className="px-4 py-2.5"><Icon className={cn('h-4 w-4', statusColors[h.status])} /></td>
                    <td className="px-4 py-2.5 font-mono text-text-primary">{h.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-secondary max-w-xs truncate">{h.value || 'Not set'}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => toggleExpand(h.name)} className="text-text-muted hover:text-text-secondary">
                        {expanded[h.name] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </motion.div>
      )}
      {status === 'idle' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"><ShieldCheck className="h-10 w-10 opacity-30" /><p className="text-sm">Enter a URL to analyze security headers</p></motion.div>)}
    </div>
  );
}
