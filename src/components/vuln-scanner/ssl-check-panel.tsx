import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Search, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import { SeverityBadge } from '@/components/shared/severity-badge';
import { formatDate } from '@/lib/utils';
import type { SslCheckResponse, SecurityGrade } from '@/types/vuln';
import type { ScanStatus } from '@/types/scan';

const gradeColors: Record<SecurityGrade, string> = {
  'A+': 'text-success bg-success/10 border-success/30', 'A': 'text-success bg-success/10 border-success/30',
  'B': 'text-info bg-info/10 border-info/30', 'C': 'text-warning bg-warning/10 border-warning/30',
  'D': 'text-high bg-high/10 border-high/30', 'F': 'text-danger bg-danger/10 border-danger/30',
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function SslCheckPanel() {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<SslCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    setStatus('running'); setError(null);
    try {
      const data = await ApiClient.post<SslCheckResponse>('/api/vuln/ssl', { hostname: target.trim() });
      setResults(data); setStatus('complete');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'SSL check failed'); setStatus('error');
    }
  }, [target]);

  const daysLeft = results ? daysUntil(results.certificate.validTo) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleScan(); }}
          placeholder="Enter hostname (e.g., example.com)" disabled={status === 'running'}
          className={cn('flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleScan()} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]')}>
          <Search className="h-4 w-4" />{status === 'running' ? 'Checking...' : 'Check SSL'}
        </motion.button>
      </div>
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /><span className="text-sm text-text-secondary">Checking SSL/TLS configuration...</span></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="glass-card flex items-center gap-3 p-4">
              {results.isValid ? <CheckCircle2 className="h-8 w-8 text-success" /> : <XCircle className="h-8 w-8 text-danger" />}
              <span className={cn('text-lg font-bold', results.isValid ? 'text-success' : 'text-danger')}>{results.isValid ? 'Valid' : 'Invalid'}</span>
            </div>
            <div className={cn('glass-card rounded-lg border px-4 py-3 text-2xl font-bold', gradeColors[results.grade])}>{results.grade}</div>
          </div>
          <div className="glass-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Certificate</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div><span className="text-xs text-text-muted">Issuer</span><p className="font-mono text-sm text-text-primary">{results.certificate.issuer}</p></div>
              <div><span className="text-xs text-text-muted">Subject</span><p className="font-mono text-sm text-text-primary">{results.certificate.subject}</p></div>
              <div><span className="text-xs text-text-muted">Valid From</span><p className="font-mono text-sm text-text-primary">{formatDate(results.certificate.validFrom)}</p></div>
              <div><span className="text-xs text-text-muted">Valid To</span><p className={cn('font-mono text-sm', daysLeft <= 30 ? 'text-warning' : 'text-text-primary')}>{formatDate(results.certificate.validTo)} ({daysLeft}d)</p></div>
              <div><span className="text-xs text-text-muted">Algorithm</span><p className="font-mono text-sm text-text-primary">{results.certificate.signatureAlgorithm}</p></div>
              <div><span className="text-xs text-text-muted">Cipher</span><p className="font-mono text-sm text-text-primary">{results.cipher}</p></div>
            </div>
          </div>
          <div className="glass-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Protocols</h3>
            <div className="flex flex-wrap gap-2">{results.protocols.map((p) => (
              <span key={p.name} className={cn('rounded-md border px-2.5 py-1 font-mono text-xs font-medium', p.supported ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-bg-secondary text-text-muted')}>{p.name}</span>
            ))}</div>
          </div>
          {results.issues.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Issues</h3>
              <div className="flex flex-col gap-2">{results.issues.map((issue, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                  <span className="text-sm text-text-primary">{issue.title}</span>
                  <SeverityBadge severity={issue.severity} />
                </div>
              ))}</div>
            </div>
          )}
        </motion.div>
      )}
      {status === 'idle' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"><Lock className="h-10 w-10 opacity-30" /><p className="text-sm">Enter a hostname to check SSL/TLS configuration</p></motion.div>)}
    </div>
  );
}
