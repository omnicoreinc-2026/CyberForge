import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Search, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import type { SubdomainScanResponse, SubdomainResult } from '@/types/recon';
import type { ScanStatus } from '@/types/scan';

type SortField = 'subdomain' | 'ip' | 'source';
type SortDir = 'asc' | 'desc';

interface SubdomainPanelProps {
  externalTarget?: string;
}

export function SubdomainPanel({ externalTarget }: SubdomainPanelProps) {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<SubdomainScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('subdomain');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const triggerRef = useRef<string>('');

  const handleScan = useCallback(async (override?: string) => {
    const t = (override ?? target).trim();
    if (!t) return;
    setStatus('running');
    setError(null);
    try {
      const data = await ApiClient.post<SubdomainScanResponse>('/api/recon/subdomains', { target: t });
      setResults(data);
      setStatus('complete');
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Subdomain scan failed';
      setError(message);
      setStatus('error');
    }
  }, [target]);

  useEffect(() => {
    if (externalTarget && externalTarget !== triggerRef.current) {
      triggerRef.current = externalTarget;
      setTarget(externalTarget);
      void handleScan(externalTarget);
    }
  }, [externalTarget, handleScan]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const sortedSubdomains: SubdomainResult[] = results
    ? [...results.subdomains].sort((a, b) => {
        const cmp = a[sortField].localeCompare(b[sortField]);
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : [];

  const sortIcon = (f: SortField) => (sortField === f ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleScan(); }}
            placeholder="Enter target domain (e.g., example.com)" disabled={status === 'running'}
            className={cn('w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5',
              'text-sm text-text-primary placeholder:text-text-muted font-mono',
              'outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30',
              'disabled:cursor-not-allowed disabled:opacity-50')} />
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => void handleScan(undefined)} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5',
            'text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50',
            'hover-glow-accent')}>
          <Search className="h-4 w-4" />
          {status === 'running' ? 'Scanning...' : 'Enumerate'}
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>
        )}
      </AnimatePresence>

      {status === 'running' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-text-secondary">Enumerating subdomains...</span>
        </motion.div>
      )}

      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-accent" />
            <span className="text-sm text-text-secondary">
              Found <span className="font-mono font-semibold text-accent">{results.total}</span> subdomains
              for <span className="font-mono text-text-primary">{results.target}</span>
            </span>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {(['subdomain', 'ip', 'source'] as SortField[]).map((f) => (
                      <th key={f} onClick={() => handleSort(f)}
                        className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-accent">
                        {f === 'ip' ? 'IP Address' : f.charAt(0).toUpperCase() + f.slice(1)}{sortIcon(f)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {sortedSubdomains.map((sub, idx) => (
                      <motion.tr key={sub.subdomain} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.3 }}
                        className="border-b border-border/50 hover:bg-accent-dim/30">
                        <td className="px-4 py-2.5 font-mono text-text-primary">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 text-accent/60" />{sub.subdomain}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-text-secondary">{sub.ip}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info">{sub.source}</span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {status === 'idle' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
          <Globe className="h-10 w-10 opacity-30" />
          <p className="text-sm">Enter a domain to discover subdomains</p>
        </motion.div>
      )}
    </div>
  );
}
