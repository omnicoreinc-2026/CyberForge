import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import type { DnsResponse, DnsRecord, DnsRecordType } from '@/types/recon';
import type { ScanStatus } from '@/types/scan';

const recordTypes: DnsRecordType[] = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'];

export function DnsPanel() {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<DnsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    setStatus('running'); setError(null);
    try {
      const data = await ApiClient.post<DnsResponse>('/api/recon/dns', { target: target.trim() });
      setResults(data); setStatus('complete');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'DNS lookup failed'); setStatus('error');
    }
  }, [target]);

  const toggleGroup = (type: string) => setCollapsed((prev) => ({ ...prev, [type]: !prev[type] }));

  const grouped = results ? recordTypes.reduce<Record<string, DnsRecord[]>>((acc, type) => {
    const recs = results.records.filter((r) => r.type === type);
    if (recs.length > 0) acc[type] = recs;
    return acc;
  }, {}) : {};

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleScan(); }}
          placeholder="Enter domain (e.g., example.com)" disabled={status === 'running'}
          className={cn('flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleScan()} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]')}>
          <Search className="h-4 w-4" />{status === 'running' ? 'Querying...' : 'DNS Lookup'}
        </motion.button>
      </div>
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /><span className="text-sm text-text-secondary">Querying DNS records...</span></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          {Object.entries(grouped).map(([type, records]) => (
            <div key={type} className="glass-card overflow-hidden">
              <button onClick={() => toggleGroup(type)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent-dim/30">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">{type}</span>
                  <span className="text-xs text-text-muted">{records.length} record{records.length !== 1 ? 's' : ''}</span>
                </div>
                {collapsed[type] ? <ChevronRight className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
              </button>
              <AnimatePresence>
                {!collapsed[type] && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <table className="w-full text-sm">
                      <thead><tr className="border-t border-border text-left"><th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Type</th><th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Name</th><th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Value</th><th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">TTL</th></tr></thead>
                      <tbody>{records.map((rec, i) => (<tr key={i} className="border-t border-border/50 hover:bg-accent-dim/30"><td className="px-4 py-2 font-mono text-xs text-accent">{rec.type}</td><td className="px-4 py-2 font-mono text-xs text-text-primary">{rec.name}</td><td className="px-4 py-2 font-mono text-xs text-text-secondary break-all">{rec.value}</td><td className="px-4 py-2 font-mono text-xs text-text-muted">{rec.ttl}</td></tr>))}</tbody>
                    </table>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
      )}
      {status === 'idle' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"><Network className="h-10 w-10 opacity-30" /><p className="text-sm">Enter a domain to query DNS records</p></motion.div>)}
    </div>
  );
}
