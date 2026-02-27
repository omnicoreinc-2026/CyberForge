import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import { ScanProgress } from '@/components/shared/scan-progress';
import type { PortScanResponse, PortResult, PortState } from '@/types/recon';
import type { ScanStatus } from '@/types/scan';

type SortField = 'host' | 'port' | 'state' | 'service' | 'version';
type SortDir = 'asc' | 'desc';

const stateColors: Record<PortState, string> = {
  open: 'text-success bg-success/10 border-success/30',
  closed: 'text-danger bg-danger/10 border-danger/30',
  filtered: 'text-warning bg-warning/10 border-warning/30',
};

const portMapColors: Record<PortState, string> = {
  open: 'bg-accent', closed: 'bg-bg-secondary', filtered: 'bg-warning',
};

interface PortScanPanelProps {
  externalTarget?: string;
}

export function PortScanPanel({ externalTarget }: PortScanPanelProps) {
  const [target, setTarget] = useState('');
  const [portRange, setPortRange] = useState('1-1000');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<PortScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('port');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const triggerRef = useRef<string>('');

  const handleScan = useCallback(async (override?: string) => {
    const t = (override ?? target).trim();
    if (!t) return;
    setStatus('running'); setError(null); setProgress(0);
    const iv = setInterval(() => setProgress((p) => Math.min(p + Math.random() * 8, 95)), 500);
    try {
      const data = await ApiClient.post<PortScanResponse>('/api/recon/ports', { target: t, portRange: portRange.trim() });
      clearInterval(iv); setProgress(100); setResults(data); setStatus('complete');
    } catch (err) {
      clearInterval(iv); setError(err instanceof ApiClientError ? err.message : 'Port scan failed'); setStatus('error');
    }
  }, [target, portRange]);

  useEffect(() => {
    if (externalTarget && externalTarget !== triggerRef.current) {
      triggerRef.current = externalTarget;
      setTarget(externalTarget);
      void handleScan(externalTarget);
    }
  }, [externalTarget, handleScan]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const hasHosts = results ? results.ports.some((p) => p.host) : false;

  const sorted: PortResult[] = results ? [...results.ports].sort((a, b) => {
    const c = sortField === 'port' ? a.port - b.port : String(a[sortField]).localeCompare(String(b[sortField]));
    return sortDir === 'asc' ? c : -c;
  }) : [];

  const si = (f: SortField) => (sortField === f ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleScan(); }}
          placeholder="Target IP or domain" disabled={status === 'running'}
          className={cn('flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <input type="text" value={portRange} onChange={(e) => setPortRange(e.target.value)} placeholder="1-1000" disabled={status === 'running'}
          className={cn('w-32 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleScan()} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover-glow-accent')}>
          <Search className="h-4 w-4" />{status === 'running' ? 'Scanning...' : 'Scan Ports'}
        </motion.button>
      </div>
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-12"><ScanProgress progress={progress} currentTask="Scanning ports..." /></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="glass-card flex items-center gap-2 px-4 py-2"><span className="text-xs text-text-muted">Open Ports:</span><span className="font-mono text-sm font-semibold text-success">{results.openPorts}</span></div>
            {results.hostsAlive > 0 && (
              <div className="glass-card flex items-center gap-2 px-4 py-2"><span className="text-xs text-text-muted">Hosts Alive:</span><span className="font-mono text-sm font-semibold text-accent">{results.hostsAlive}</span></div>
            )}
          </div>
          <div className="glass-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Port Map</h3>
            <div className="flex flex-wrap gap-1">{results.ports.map((p, i) => (<motion.div key={p.host + ":" + p.port + ":" + i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.001 }} title={(p.host ? p.host + ":" : "") + "Port " + p.port + " - " + p.state + " (" + p.service + ")"} className={cn("h-2.5 w-2.5 rounded-sm", portMapColors[p.state])} />))}</div>
            <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> Open</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-bg-secondary" /> Closed</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-warning" /> Filtered</span>
            </div>
          </div>
          <div className="glass-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left">
            {hasHosts && <th onClick={() => handleSort('host')} className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-accent">Host{si('host')}</th>}
            {(["port", "state", "service", "version"] as SortField[]).map((f) => (<th key={f} onClick={() => handleSort(f)} className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-accent">{f.charAt(0).toUpperCase() + f.slice(1)}{si(f)}</th>))}</tr></thead>
            <tbody><AnimatePresence>{sorted.map((port, idx) => (<motion.tr key={port.host + ":" + port.port} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02, duration: 0.3 }} className="border-b border-border/50 hover:bg-accent-dim/30">
              {hasHosts && <td className="px-4 py-2.5 font-mono text-accent">{port.host}</td>}
              <td className="px-4 py-2.5 font-mono font-semibold text-text-primary">{port.port}</td><td className="px-4 py-2.5"><span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", stateColors[port.state])}>{port.state}</span></td><td className="px-4 py-2.5 font-mono text-text-secondary">{port.service}</td><td className="px-4 py-2.5 font-mono text-text-muted">{port.version || "-"}</td></motion.tr>))}</AnimatePresence></tbody></table></div></div>
        </motion.div>
      )}
      {status === 'idle' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"><Wifi className="h-10 w-10 opacity-30" /><p className="text-sm">Enter a target and port range to begin scanning</p></motion.div>)}
    </div>
  );
}
