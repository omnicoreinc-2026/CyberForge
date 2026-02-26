import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import { SeverityBadge } from '@/components/shared/severity-badge';
import type { DependencyCheckResponse, VulnerablePackage } from '@/types/vuln';
import type { ScanStatus, Severity } from '@/types/scan';

type SortField = 'name' | 'severity' | 'cveId';
type SortDir = 'asc' | 'desc';

const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function DependencyCheckPanel() {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [results, setResults] = useState<DependencyCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteContent, setPasteContent] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = useCallback(async (content: string, filename: string) => {
    setStatus('running'); setError(null);
    try {
      const data = await ApiClient.post<DependencyCheckResponse>('/api/vuln/dependencies', { content, filename });
      setResults(data); setStatus('complete');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Dependency check failed'); setStatus('error');
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) void handleAnalyze(e.target.result as string, file.name); };
    reader.readAsText(file);
  }, [handleAnalyze]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const sorted: VulnerablePackage[] = results ? [...results.packages].sort((a, b) => {
    let c: number;
    if (sortField === 'severity') c = severityOrder[a.severity] - severityOrder[b.severity];
    else c = String(a[sortField]).localeCompare(String(b[sortField]));
    return sortDir === 'asc' ? c : -c;
  }) : [];

  const si = (f: SortField) => (sortField === f ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '');

  return (
    <div className="flex flex-col gap-4">
      {status === 'idle' && (
        <div className="flex flex-col gap-4">
          <div onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn('glass-card flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed p-8 transition-colors',
              dragOver ? 'border-accent bg-accent-dim' : 'border-border hover:border-accent/50')}>
            <Upload className={cn('h-10 w-10', dragOver ? 'text-accent' : 'text-text-muted')} />
            <p className="text-sm text-text-secondary">Drop <span className="font-mono text-accent">requirements.txt</span> or <span className="font-mono text-accent">package.json</span> here</p>
            <p className="text-xs text-text-muted">or click to browse</p>
            <input ref={fileInputRef} type="file" accept=".txt,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs text-text-muted">OR</span><div className="h-px flex-1 bg-border" /></div>
          <div className="flex flex-col gap-2">
            <textarea value={pasteContent} onChange={(e) => setPasteContent(e.target.value)} rows={6}
              placeholder="Paste package.json or requirements.txt content here..."
              className={cn('w-full rounded-lg border border-border bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted font-mono outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none')} />
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => void handleAnalyze(pasteContent, 'pasted-content')}
              disabled={!pasteContent.trim()}
              className={cn('flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-primary disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]')}>
              <FileText className="h-4 w-4" />Analyze Dependencies
            </motion.button>
          </div>
        </div>
      )}
      <AnimatePresence>{error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card border-danger/30 p-4 text-sm text-danger">{error}</motion.div>)}</AnimatePresence>
      {status === 'running' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /><span className="text-sm text-text-secondary">Analyzing dependencies...</span></motion.div>)}
      {status === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="glass-card flex items-center gap-2 px-4 py-2"><span className="text-xs text-text-muted">Packages:</span><span className="font-mono text-sm font-semibold text-text-primary">{results.totalPackages}</span></div>
            <div className="glass-card flex items-center gap-2 px-4 py-2"><span className="text-xs text-text-muted">Vulnerable:</span><span className="font-mono text-sm font-semibold text-danger">{results.vulnerableCount}</span></div>
          </div>
          <div className="glass-card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left">
            <th onClick={() => handleSort('name')} className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-accent">Package{si('name')}</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Installed</th>
            <th onClick={() => handleSort('cveId')} className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-accent">CVE{si('cveId')}</th>
            <th onClick={() => handleSort('severity')} className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-accent">Severity{si('severity')}</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Fixed In</th>
          </tr></thead><tbody>{sorted.map((pkg) => (
            <tr key={pkg.name + pkg.cveId} className="border-b border-border/50 hover:bg-accent-dim/30">
              <td className="px-4 py-2.5 font-mono text-text-primary">{pkg.name}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{pkg.installedVersion}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-accent">{pkg.cveId}</td>
              <td className="px-4 py-2.5"><SeverityBadge severity={pkg.severity} /></td>
              <td className="px-4 py-2.5 font-mono text-xs text-success">{pkg.fixedVersion || '-'}</td>
            </tr>
          ))}</tbody></table></div>
        </motion.div>
      )}
    </div>
  );
}
