import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Search, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { VtResponse, VtVerdict } from '@/types/osint';
import type { ScanStatus } from '@/types/scan';

const verdictColors: Record<VtVerdict, string> = {
  clean: 'text-success',
  suspicious: 'text-warning',
  malicious: 'text-danger',
  undetected: 'text-text-muted',
};

const verdictBg: Record<VtVerdict, string> = {
  clean: 'bg-success/10 border-success/30',
  suspicious: 'bg-warning/10 border-warning/30',
  malicious: 'bg-danger/10 border-danger/30',
  undetected: 'bg-bg-secondary border-border',
};

export function VirusTotalPanel() {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<VtResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    setStatus('running'); setError(null);
    try {
      const data = await ApiClient.post<VtResponse>('/api/osint/virustotal', { target: target.trim() });
      setResults(data); setStatus('complete');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'VirusTotal scan failed'); setStatus('error');
    }
  }, [target]);

  const ratio = results ? results.positives / results.total : 0;
  const ringColor = ratio === 0 ? '#22c55e' : ratio < 0.1 ? '#f59e0b' : '#ef4444';
  const chartData = results ? [{ name: 'Positives', value: results.positives }, { name: 'Clean', value: results.total - results.positives }] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleScan(); }}
          placeholder="Enter URL, domain, IP, or hash" disabled={status === 'running'}
          className={cn('flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50')} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleScan()} disabled={status === 'running' || !target.trim()}
          className={cn('flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]')}>
          <Search className="h-4 w-4" />{status === 'running' ? 'Scanning...' : 'VT Lookup'}
        </motion.button>
      </div>
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /><span className="text-sm text-text-secondary">Querying VirusTotal...</span></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="glass-card flex items-center gap-8 p-6">
            <div className="h-32 w-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill={ringColor} /><Cell fill="rgba(255,255,255,0.08)" />
                </Pie></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-3xl font-bold" style={{ color: ringColor }}>{results.positives}/{results.total}</span>
              <span className="text-sm text-text-secondary">Detections</span>
              <span className="text-xs text-text-muted">Scanned: {results.scanDate}</span>
              {results.permalink && (
                <a href={results.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-accent hover:underline">
                  <ExternalLink className="h-3 w-3" />Full Report
                </a>
              )}
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Vendor</th><th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Verdict</th><th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Detail</th></tr></thead>
              <tbody>{results.vendors.map((v) => (<tr key={v.vendor} className="border-b border-border/50 hover:bg-accent-dim/30"><td className="px-4 py-2.5 text-text-primary">{v.vendor}</td><td className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', verdictBg[v.verdict], verdictColors[v.verdict])}>{v.verdict}</span></td><td className="px-4 py-2.5 text-xs text-text-muted">{v.detail || '-'}</td></tr>))}</tbody></table>
          </div>
        </motion.div>
      )}
      {status === 'idle' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"><ShieldCheck className="h-10 w-10 opacity-30" /><p className="text-sm">Enter a URL, domain, IP, or hash to check with VirusTotal</p></motion.div>)}
    </div>
  );
}
