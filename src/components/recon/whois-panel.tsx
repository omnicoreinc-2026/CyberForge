import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Search, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { WhoisResponse } from '@/types/recon';
import type { ScanStatus } from '@/types/scan';

function isExpiringSoon(dateStr: string): boolean {
  const expiry = new Date(dateStr);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= 30;
}

export function WhoisPanel() {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<WhoisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    setStatus('running');
    setError(null);
    try {
      const data = await ApiClient.post<WhoisResponse>('/api/recon/whois', {
        target: target.trim(),
      });
      setResults(data);
      setStatus('complete');
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'WHOIS lookup failed';
      setError(message);
      setStatus('error');
    }
  }, [target]);

  const keyValuePairs = results
    ? [
        { label: 'Domain', value: results.domain },
        { label: 'Registrar', value: results.registrar },
        { label: 'Created', value: formatDate(results.createdDate) },
        { label: 'Updated', value: formatDate(results.updatedDate) },
        { label: 'Expires', value: formatDate(results.expiresDate), warn: isExpiringSoon(results.expiresDate) },
        { label: 'Name Servers', value: results.nameServers.join(', ') },
        { label: 'Status', value: results.status.join(', ') },
        { label: 'Registrant', value: results.registrant },
        ...results.fields.map((f) => ({ label: f.label, value: f.value })),
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleScan();
          }}
          placeholder="Enter domain (e.g., example.com)"
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
          onClick={() => void handleScan()}
          disabled={status === 'running' || !target.trim()}
          className={cn(
            'flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5',
            'text-sm font-medium text-bg-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]',
          )}
        >
          <Search className="h-4 w-4" />
          {status === 'running' ? 'Looking up...' : 'WHOIS Lookup'}
        </motion.button>
      </div>

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

      {status === 'running' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-3 py-12"
        >
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-text-secondary">Fetching WHOIS data...</span>
        </motion.div>
      )}

      {status === 'complete' && results && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {keyValuePairs.map((pair) => (
              <div key={pair.label} className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {pair.label}
                </span>
                <span
                  className={cn(
                    'font-mono text-sm',
                    'warn' in pair && pair.warn
                      ? 'flex items-center gap-2 text-warning'
                      : 'text-text-primary',
                  )}
                >
                  {'warn' in pair && pair.warn && <AlertTriangle className="h-3.5 w-3.5" />}
                  {pair.value || '-'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {status === 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted"
        >
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">Enter a domain to look up WHOIS information</p>
        </motion.div>
      )}
    </div>
  );
}
