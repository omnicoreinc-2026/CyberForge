import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import { ScanProgress } from '@/components/shared/scan-progress';
import type { SeekResponse } from '@/types/seek-enter';
import type { ScanStatus } from '@/types/scan';

interface SeekPanelProps {
  onComplete: (results: SeekResponse) => void;
}

export function SeekPanel({ onComplete }: SeekPanelProps) {
  const [cidr, setCidr] = useState('');
  const [ports, setPorts] = useState('1-1000');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleSeek = useCallback(async () => {
    if (!cidr.trim()) return;
    setStatus('running');
    setError(null);
    setProgress(0);

    const iv = setInterval(
      () => setProgress((p) => Math.min(p + Math.random() * 4, 92)),
      800,
    );

    try {
      const data = await ApiClient.post<SeekResponse>(
        '/api/seek-enter/seek',
        { cidr: cidr.trim(), ports: ports.trim() },
        { timeoutMs: 600_000 }, // 10 min — network scans can take a while
      );
      clearInterval(iv);
      setProgress(100);
      setStatus('complete');
      onComplete(data);
    } catch (err) {
      clearInterval(iv);
      setError(err instanceof ApiClientError ? err.message : 'Seek scan failed');
      setStatus('error');
    }
  }, [cidr, ports, onComplete]);

  return (
    <div className="flex flex-col gap-4">
      {/* CIDR Input */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={cidr}
          onChange={(e) => setCidr(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSeek(); }}
          placeholder="CIDR range (e.g. 192.168.1.0/24, 10.0.0.1-254)"
          disabled={status === 'running'}
          className={cn(
            'flex-1 rounded-lg border border-border bg-bg-secondary px-4 py-2.5',
            'text-sm text-text-primary placeholder:text-text-muted font-mono',
            'outline-none transition-colors',
            'focus:border-accent focus:ring-1 focus:ring-accent/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => void handleSeek()}
          disabled={status === 'running' || !cidr.trim()}
          className={cn(
            'flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5',
            'text-sm font-bold text-bg-primary uppercase tracking-wider',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'hover-glow-accent',
          )}
        >
          <Radar className="h-4 w-4" />
          {status === 'running' ? 'Seeking...' : 'SEEK'}
        </motion.button>
      </div>

      {/* Port range */}
      <div className="glass-card p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Scan Options
        </h3>
        <div className="flex items-center gap-3">
          <label className="text-xs text-text-muted">Port Range:</label>
          <input
            type="text"
            value={ports}
            onChange={(e) => setPorts(e.target.value)}
            disabled={status === 'running'}
            className={cn(
              'w-48 rounded-md border border-border bg-bg-secondary px-3 py-1.5',
              'text-xs font-mono text-text-primary',
              'outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card border-danger/30 p-4 text-sm text-danger"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Running */}
      {status === 'running' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4 py-12"
        >
          <ScanProgress progress={progress} currentTask="Discovering live hosts and services..." />
        </motion.div>
      )}

      {/* Idle */}
      {status === 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"
        >
          <Radar className="h-10 w-10 opacity-30" />
          <p className="text-sm">Enter a CIDR range to discover live hosts and vulnerabilities</p>
          <p className="text-xs text-text-muted">Requires nmap installed for full vulnerability detection</p>
        </motion.div>
      )}
    </div>
  );
}
