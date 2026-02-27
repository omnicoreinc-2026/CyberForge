import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Search, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import { SeverityBadge } from '@/components/shared/severity-badge';
import type { ShodanResponse } from '@/types/osint';
import type { ScanStatus } from '@/types/scan';

interface ShodanPanelProps {
  externalTarget?: string;
}

export function ShodanPanel({ externalTarget }: ShodanPanelProps) {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<ShodanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<string>('');

  const handleScan = useCallback(async (override?: string) => {
    const t = (override ?? target).trim();
    if (!t) return;
    setStatus('running'); setError(null);
    try {
      const data = await ApiClient.post<ShodanResponse>('/api/osint/shodan', { target: t });
      setResults(data); setStatus('complete');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Shodan lookup failed'); setStatus('error');
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
          placeholder="Enter IP or domain" disabled={status === 'running'}
          className={cn('flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleScan()} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover-glow-accent')}>
          <Search className="h-4 w-4" />{status === 'running' ? 'Searching...' : 'Shodan Lookup'}
        </motion.button>
      </div>
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /><span className="text-sm text-text-secondary">Querying Shodan...</span></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="glass-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Host Information</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {[['IP', results.host.ip], ['Organization', results.host.org], ['OS', results.host.os], ['ISP', results.host.isp], ['Country', results.host.country], ['City', results.host.city]].map(([label, value]) => (
                <div key={label}><span className="text-xs text-text-muted">{label}</span><p className="font-mono text-sm text-text-primary">{value || "-"}</p></div>
              ))}
            </div>
          </div>
          <div className="glass-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Open Ports</h3>
            <div className="flex flex-wrap gap-2">{results.ports.map((p) => (<span key={p} className="rounded-md bg-accent/10 px-2.5 py-1 font-mono text-xs font-medium text-accent">{p}</span>))}</div>
          </div>
          {results.vulnerabilities.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Vulnerabilities</h3>
              <div className="flex flex-col gap-2">{results.vulnerabilities.map((v) => (
                <div key={v.cve} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                  <div className="flex items-center gap-3"><span className="font-mono text-sm text-text-primary">{v.cve}</span><span className="text-xs text-text-secondary">{v.summary}</span></div>
                  <SeverityBadge severity={v.severity} />
                </div>
              ))}</div>
            </div>
          )}
          {results.services.length > 0 && (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Port</th><th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Transport</th><th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Product</th><th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Version</th></tr></thead>
                <tbody>{results.services.map((s, i) => (<tr key={i} className="border-b border-border/50 hover:bg-accent-dim/30"><td className="px-4 py-2.5 font-mono text-accent">{s.port}</td><td className="px-4 py-2.5 text-text-secondary">{s.transport}</td><td className="px-4 py-2.5 text-text-primary">{s.product}</td><td className="px-4 py-2.5 font-mono text-text-muted">{s.version || '-'}</td></tr>))}</tbody></table>
            </div>
          )}
        </motion.div>
      )}
      {status === 'idle' && (
        <div className="flex flex-col items-center gap-6 py-12">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 text-text-muted">
            <Server className="h-10 w-10 opacity-30" /><p className="text-sm">Enter an IP or domain to search Shodan</p>
          </motion.div>
          <div className="glass-card flex items-center gap-3 border-warning/30 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
            <div><p className="text-sm font-medium text-text-primary">API Key Required</p><p className="text-xs text-text-secondary">Configure your Shodan API key in Settings to use this feature.</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
