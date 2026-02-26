import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, ClipboardPaste, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient } from '@/lib/api-client';
import type { LogFormat, LogAnalysisResult } from '@/types/log';

interface LogUploadPanelProps {
  onAnalysisComplete: (result: LogAnalysisResult) => void;
}

const FORMAT_OPTIONS: { value: LogFormat; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'syslog', label: 'Syslog' },
  { value: 'apache', label: 'Apache' },
  { value: 'nginx', label: 'Nginx' },
  { value: 'windows_event', label: 'Windows Event' },
];

export function LogUploadPanel({ onAnalysisComplete }: LogUploadPanelProps) {
  const [content, setContent] = useState('');
  const [format, setFormat] = useState<LogFormat>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = useCallback(async () => {
    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await ApiClient.post<LogAnalysisResult>('/api/logs/analyze', {
        content,
        format,
      });
      onAnalysisComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [content, format, onAnalysisComplete]);

  const handleFileRead = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setContent(text);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileRead(file);
      }
    },
    [handleFileRead],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileRead(file);
      }
    },
    [handleFileRead],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Drag & drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'glass-card flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all',
          dragActive
            ? 'border-accent bg-accent-dim'
            : 'border-border hover:border-accent/50',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".log,.txt,.xml,.evtx,.csv"
          onChange={handleFileInput}
          className="hidden"
        />
        <Upload className={cn('h-10 w-10', dragActive ? 'text-accent' : 'text-text-muted')} />
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            {fileName ? fileName : 'Drop a log file here or click to browse'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Supports .log, .txt, .xml, .evtx, .csv
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-text-muted" />
          <span className="text-xs text-text-muted">Syslog, Apache, Nginx, Windows Event</span>
        </div>
      </motion.div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-text-muted">OR PASTE LOG CONTENT</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Paste textarea */}
      <div className="relative">
        <ClipboardPaste className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste log content here..."
          rows={12}
          className={cn(
            'w-full rounded-lg border border-border bg-bg-secondary p-3 pl-10',
            'font-mono text-xs text-text-primary placeholder:text-text-muted',
            'outline-none transition-colors resize-y',
            'focus:border-accent focus:ring-1 focus:ring-accent/30',
          )}
        />
        {content && (
          <span className="absolute bottom-3 right-3 text-xs text-text-muted">
            {content.split('\n').filter(Boolean).length} lines
          </span>
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as LogFormat)}
          className={cn(
            'rounded-lg border border-border bg-bg-secondary px-3 py-2.5',
            'text-sm text-text-primary outline-none',
            'focus:border-accent focus:ring-1 focus:ring-accent/30',
          )}
        >
          {FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAnalyze}
          disabled={loading || !content.trim()}
          className={cn(
            'ml-auto flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5',
            'text-sm font-medium text-bg-primary transition-opacity',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]',
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Analyze
            </>
          )}
        </motion.button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}
    </div>
  );
}
