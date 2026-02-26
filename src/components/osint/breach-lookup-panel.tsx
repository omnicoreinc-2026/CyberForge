import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldOff, Search, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { BreachResponse } from '@/types/osint';
import type { ScanStatus } from '@/types/scan';

function breachSeverityColor(pwnCount: number): string {
  if (pwnCount > 10000000) return 'border-critical/30 bg-critical/5';
  if (pwnCount > 1000000) return 'border-high/30 bg-high/5';
  if (pwnCount > 100000) return 'border-medium/30 bg-medium/5';
  return 'border-low/30 bg-low/5';
}

function formatPwnCount(n: number): string {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

export function BreachLookupPanel() {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<BreachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    setStatus('running'); setError(null);
    try {
      const data = await ApiClient.post<BreachResponse>('/api/osint/breaches', { target: target.trim() });
      setResults(data); setStatus('complete');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Breach lookup failed'); setStatus('error');
    }
  }, [target]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleScan(); }}
          placeholder="Enter email or domain" disabled={status === 'running'}
          className={cn('flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleScan()} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]')}>
          <Search className="h-4 w-4" />{status === 'running' ? 'Checking...' : 'Check Breaches'}
        </motion.button>
      </div>
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /><span className="text-sm text-text-secondary">Checking breach databases...</span></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {results.breaches.length === 0 ? (
            <div className="glass-card flex flex-col items-center gap-3 border-success/30 p-8">
              <ShieldCheck className="h-12 w-12 text-success" />
              <p className="text-lg font-semibold text-success">No breaches found</p>
              <p className="text-sm text-text-secondary">This target was not found in any known data breaches.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">Found <span className="font-mono font-semibold text-danger">{results.totalBreaches}</span> breaches</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.breaches.map((b, idx) => (
                  <motion.div key={b.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                    className={cn('glass-card flex flex-col gap-3 border p-4', breachSeverityColor(b.pwnCount))}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-text-primary text-sm">{b.title}</h4>
                      {b.isVerified && <span className="rounded bg-info/10 px-1.5 py-0.5 text-xs text-info">Verified</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>{formatDate(b.breachDate)}</span>
                      <span className="font-mono font-semibold text-text-secondary">{formatPwnCount(b.pwnCount)} accounts</span>
                    </div>
                    <div className="flex flex-wrap gap-1">{b.dataClasses.map((dc) => (<span key={dc} className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs text-text-muted">{dc}</span>))}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
      {status === 'idle' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"><ShieldOff className="h-10 w-10 opacity-30" /><p className="text-sm">Enter an email or domain to check for data breaches</p></motion.div>)}
    </div>
  );
}
