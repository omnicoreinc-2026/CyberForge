import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient } from '@/lib/api-client';
import type { DiscoveredHost, EnterEvent, EnterRequest } from '@/types/seek-enter';

interface EnterPanelProps {
  scanId: string;
  host: DiscoveredHost;
  port: number;
  service: string;
  exploitId: string;
  onBack: () => void;
  onReset: () => void;
}

const eventColors: Record<string, string> = {
  info: 'text-info',
  command: 'text-accent font-semibold',
  output: 'text-text-secondary',
  success: 'text-success font-semibold',
  error: 'text-danger',
  complete: 'text-warning font-semibold',
};

export function EnterPanel({
  scanId, host, port, service, exploitId, onBack, onReset,
}: EnterPanelProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [events, setEvents] = useState<EnterEvent[]>([]);
  const [success, setSuccess] = useState<boolean | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [events]);

  const handleEnter = useCallback(async () => {
    setStatus('running');
    setEvents([]);
    setSuccess(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const body: EnterRequest = {
      scan_id: scanId,
      target_ip: host.ip,
      port,
      service,
      exploit_id: exploitId,
      options: {},
    };

    try {
      const response = await fetch(`${ApiClient.BASE_URL}/api/seek-enter/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const dataLine = line.trim();
          if (dataLine.startsWith('data: ')) {
            try {
              const event: EnterEvent = JSON.parse(dataLine.slice(6));
              setEvents((prev) => [...prev, event]);
              if (event.event_type === 'success') setSuccess(true);
              if (event.event_type === 'complete') setStatus('complete');
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      setStatus((prev) => prev === 'running' ? 'complete' : prev);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setEvents((prev) => [...prev, {
          event_type: 'error',
          timestamp: new Date().toISOString(),
          message: `[!] Connection error: ${(err as Error).message}`,
          module: '',
        }]);
        setStatus('error');
      }
    }
  }, [scanId, host.ip, port, service, exploitId]);

  useEffect(() => {
    void handleEnter();
    return () => {
      abortRef.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { abortRef.current?.abort(); onBack(); }}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Results
          </motion.button>
          <div className="h-4 w-px bg-border" />
          <span className="font-mono text-sm text-accent">{host.ip}:{port}</span>
          <span className="text-xs text-text-muted">({service})</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'complete' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> New Seek
            </motion.button>
          )}
          <div className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium',
            status === 'running' && 'border-accent/30 bg-accent/10 text-accent animate-pulse',
            status === 'complete' && success && 'border-success/30 bg-success/10 text-success',
            status === 'complete' && !success && 'border-warning/30 bg-warning/10 text-warning',
            status === 'error' && 'border-danger/30 bg-danger/10 text-danger',
            status === 'idle' && 'border-border bg-bg-secondary text-text-muted',
          )}>
            {status === 'running' ? 'Exploiting...'
              : status === 'complete' && success ? 'Pwned'
              : status === 'complete' ? 'Failed'
              : status === 'error' ? 'Error'
              : 'Idle'}
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Terminal className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Attack Terminal
          </span>
          <div className="flex-1" />
          <span className="text-xs text-text-muted font-mono">
            {events.length} events
          </span>
        </div>
        <div
          ref={terminalRef}
          className="h-[500px] overflow-y-auto bg-[#0a0a0a] p-4 font-mono text-xs leading-relaxed"
        >
          {events.map((event, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.1 }}
              className={cn('whitespace-pre-wrap', eventColors[event.event_type] ?? 'text-text-secondary')}
            >
              {event.message}
            </motion.div>
          ))}
          {status === 'running' && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block text-accent"
            >
              _
            </motion.span>
          )}
        </div>
      </div>
    </div>
  );
}
