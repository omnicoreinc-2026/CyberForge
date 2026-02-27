import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gauge, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import type { ReputationResponse } from '@/types/osint';
import type { ScanStatus } from '@/types/scan';

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function ScoreGauge({ score }: { score: number }) {
  const color = scoreColor(score);
  const angle = (score / 100) * 180;
  const rad = (angle - 180) * (Math.PI / 180);
  const x = 100 + 70 * Math.cos(rad);
  const y = 100 + 70 * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <svg viewBox="0 0 200 120" className="w-48">
      <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
      <motion.path
        d={"M 30 100 A 70 70 0 " + largeArc + " 1 " + x + " " + y}
        fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeOut" }} />
      <text x="100" y="90" textAnchor="middle" className="fill-text-primary font-mono text-3xl font-bold" fontSize="28">{score}</text>
      <text x="100" y="108" textAnchor="middle" className="fill-text-muted" fontSize="10">/ 100</text>
    </svg>
  );
}

interface ReputationPanelProps {
  externalTarget?: string;
}

export function ReputationPanel({ externalTarget }: ReputationPanelProps) {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<ReputationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<string>('');

  const handleScan = useCallback(async (override?: string) => {
    const t = (override ?? target).trim();
    if (!t) return;
    setStatus('running'); setError(null);
    try {
      const data = await ApiClient.post<ReputationResponse>('/api/osint/reputation', { target: t });
      setResults(data); setStatus('complete');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Reputation check failed'); setStatus('error');
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
        <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleScan(); }}
          placeholder="Enter domain or IP" disabled={status === 'running'}
          className={cn('flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleScan()} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover-glow-accent')}>
          <Search className="h-4 w-4" />{status === 'running' ? 'Checking...' : 'Check Reputation'}
        </motion.button>
      </div>
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /><span className="text-sm text-text-secondary">Checking reputation...</span></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="glass-card flex flex-col items-center gap-4 p-6">
            <ScoreGauge score={results.score} />
            <div className="flex flex-wrap justify-center gap-2">
              {results.categories.map((cat) => (<span key={cat.name} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{cat.name}</span>))}
            </div>
          </div>
          <div className="glass-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Details</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(results.details).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">{key}</span><span className="font-mono text-sm text-text-primary">{value}</span></div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
      {status === 'idle' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"><Gauge className="h-10 w-10 opacity-30" /><p className="text-sm">Enter a domain or IP to check its reputation score</p></motion.div>)}
    </div>
  );
}
