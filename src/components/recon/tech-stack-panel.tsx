import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import type { TechStackResponse, TechCategory } from '@/types/recon';
import type { ScanStatus } from '@/types/scan';

const categoryColors: Record<TechCategory, string> = {
  Framework: 'bg-info/20 text-info border-info/30',
  Server: 'bg-success/20 text-success border-success/30',
  CMS: 'bg-high/20 text-high border-high/30',
  CDN: 'bg-warning/20 text-warning border-warning/30',
  Analytics: 'bg-medium/20 text-medium border-medium/30',
  JavaScript: 'bg-accent/20 text-accent border-accent/30',
  Security: 'bg-critical/20 text-critical border-critical/30',
  Cache: 'bg-low/20 text-low border-low/30',
  Database: 'bg-info/20 text-info border-info/30',
  Other: 'bg-text-muted/20 text-text-muted border-text-muted/30',
};

interface TechStackPanelProps {
  externalTarget?: string;
}

export function TechStackPanel({ externalTarget }: TechStackPanelProps) {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<TechStackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<string>('');

  const handleScan = useCallback(async (override?: string) => {
    const t = (override ?? target).trim();
    if (!t) return;
    setStatus('running'); setError(null);
    try {
      const data = await ApiClient.post<TechStackResponse>('/api/recon/tech', { target: t });
      setResults(data); setStatus('complete');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Tech stack detection failed'); setStatus('error');
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
          placeholder="Enter URL (e.g., https://example.com)" disabled={status === 'running'}
          className={cn('flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleScan()} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]')}>
          <Search className="h-4 w-4" />{status === 'running' ? 'Detecting...' : 'Detect Stack'}
        </motion.button>
      </div>
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /><span className="text-sm text-text-secondary">Detecting technologies...</span></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.technologies.map((tech, idx) => (
            <motion.div key={tech.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }} className="glass-card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-text-primary text-sm">{tech.name}</h4>
                <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', categoryColors[tech.category])}>{tech.category}</span>
              </div>
              {tech.version && <span className="font-mono text-xs text-text-muted">v{tech.version}</span>}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs"><span className="text-text-muted">Confidence</span><span className="font-mono text-text-secondary">{tech.confidence}%</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
                  <motion.div initial={{ width: 0 }} animate={{ width: tech.confidence + "%" }} transition={{ duration: 0.8, delay: idx * 0.05 }}
                    className={cn('h-full rounded-full', tech.confidence > 80 ? 'bg-accent' : tech.confidence > 50 ? 'bg-warning' : 'bg-text-muted')} />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      {status === 'idle' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"><Layers className="h-10 w-10 opacity-30" /><p className="text-sm">Enter a URL to detect technologies</p></motion.div>)}
    </div>
  );
}
