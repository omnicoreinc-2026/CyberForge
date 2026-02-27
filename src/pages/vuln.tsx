import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, ShieldCheck, Lock, Search, Package, Scan } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TargetInput } from '@/components/shared/target-input';
import { HeaderAnalysisPanel } from '@/components/vuln-scanner/header-analysis-panel';
import { SslCheckPanel } from '@/components/vuln-scanner/ssl-check-panel';
import { CveLookupPanel } from '@/components/vuln-scanner/cve-lookup-panel';
import { DependencyCheckPanel } from '@/components/vuln-scanner/dependency-check-panel';
import { ApiClient, ApiClientError } from '@/lib/api-client';
import type { HeaderAnalysisResponse, SslCheckResponse } from '@/types/vuln';
import type { VulnTab } from '@/types/vuln';

const tabs: { id: VulnTab; label: string; icon: typeof Bug }[] = [
  { id: 'headers', label: 'Headers', icon: ShieldCheck },
  { id: 'ssl', label: 'SSL/TLS', icon: Lock },
  { id: 'cve', label: 'CVE Lookup', icon: Search },
  { id: 'dependencies', label: 'Dependencies', icon: Package },
  { id: 'fullscan', label: 'Full Scan', icon: Scan },
];

export function VulnPage() {
  const [searchParams] = useSearchParams();
  const urlTarget = searchParams.get('target') ?? '';
  const [activeTab, setActiveTab] = useState<VulnTab>('headers');
  const [globalTarget, setGlobalTarget] = useState(urlTarget);
  const fullScanTriggerRef = useRef<string>('');
  const [fullScanRunning, setFullScanRunning] = useState(false);
  const [fullScanError, setFullScanError] = useState<string | null>(null);
  const [fullScanHeaders, setFullScanHeaders] = useState<HeaderAnalysisResponse | null>(null);
  const [fullScanSsl, setFullScanSsl] = useState<SslCheckResponse | null>(null);

  const handleGlobalScan = useCallback((t: string) => { setGlobalTarget(t); }, []);

  useEffect(() => {
    if (activeTab === 'fullscan' && globalTarget && globalTarget !== fullScanTriggerRef.current) {
      fullScanTriggerRef.current = globalTarget;
      setFullScanRunning(true);
      setFullScanError(null);
      setFullScanHeaders(null);
      setFullScanSsl(null);
      Promise.all([
        ApiClient.post<HeaderAnalysisResponse>('/api/vuln/headers', { target: globalTarget }),
        ApiClient.post<SslCheckResponse>('/api/vuln/ssl', { hostname: globalTarget }),
      ]).then(([headersData, sslData]) => {
        setFullScanHeaders(headersData);
        setFullScanSsl(sslData);
        setFullScanRunning(false);
      }).catch((err) => {
        setFullScanError(err instanceof ApiClientError ? err.message : 'Full scan failed');
        setFullScanRunning(false);
      });
    }
  }, [activeTab, globalTarget]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Bug className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Vulnerability Scanner</h1>
          <p className="text-sm text-text-secondary">Security header analysis, SSL checks, CVE lookups, and dependency auditing</p>
        </div>
      </div>

      <TargetInput onScan={handleGlobalScan} placeholder="Enter target for vulnerability scan..." initialValue={urlTarget} />

      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-bg-secondary p-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              activeTab === tab.id ? 'bg-accent-dim text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-bg-card')}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === 'headers' && <HeaderAnalysisPanel externalTarget={globalTarget} />}
        {activeTab === 'ssl' && <SslCheckPanel externalTarget={globalTarget} />}
        {activeTab === 'cve' && <CveLookupPanel />}
        {activeTab === 'dependencies' && <DependencyCheckPanel />}
        {activeTab === 'fullscan' && (
          <div className="flex flex-col gap-4">
            {!globalTarget && !fullScanRunning && !fullScanHeaders && !fullScanSsl && (
              <div className="glass-card flex flex-col items-center gap-4 p-12">
                <Scan className="h-12 w-12 text-accent/30" />
                <h3 className="text-lg font-semibold text-text-primary">Full Vulnerability Scan</h3>
                <p className="text-sm text-text-secondary text-center max-w-md">
                  Runs all vulnerability checks (headers, SSL, known CVEs) against the target. Enter a target above and click Scan to begin a comprehensive assessment.
                </p>
              </div>
            )}
            <AnimatePresence>
              {fullScanError && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="glass-card border-danger/30 p-4 text-sm text-danger">{fullScanError}</motion.div>
              )}
            </AnimatePresence>
            {fullScanRunning && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-3 py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-sm text-text-secondary">Running full vulnerability scan...</span>
              </motion.div>
            )}
            {!fullScanRunning && (fullScanHeaders || fullScanSsl) && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
                {fullScanHeaders && (
                  <div className="glass-card p-4">
                    <h3 className="mb-3 text-sm font-semibold text-text-primary flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-accent" />
                      Security Headers &mdash; Grade: <span className="font-mono text-accent">{fullScanHeaders.grade}</span>
                      <span className="ml-2 text-xs text-text-muted">({fullScanHeaders.score}/100)</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border text-left">
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Header</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Value</th>
                        </tr></thead>
                        <tbody>{fullScanHeaders.headers.map((h) => (
                          <tr key={h.name} className="border-b border-border/50">
                            <td className="px-3 py-2 font-mono text-xs text-text-primary">{h.name}</td>
                            <td className={cn('px-3 py-2 text-xs font-medium', h.status === 'pass' ? 'text-success' : h.status === 'fail' ? 'text-danger' : 'text-warning')}>{h.status}</td>
                            <td className="px-3 py-2 font-mono text-xs text-text-muted max-w-xs truncate">{h.value || 'Not set'}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
                {fullScanSsl && (
                  <div className="glass-card p-4">
                    <h3 className="mb-3 text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Lock className="h-4 w-4 text-accent" />
                      SSL/TLS &mdash; Grade: <span className="font-mono text-accent">{fullScanSsl.grade}</span>
                      <span className={cn('ml-2 text-xs font-medium', fullScanSsl.isValid ? 'text-success' : 'text-danger')}>
                        {fullScanSsl.isValid ? 'Valid' : 'Invalid'}
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 text-xs">
                      <div><span className="text-text-muted">Issuer</span><p className="font-mono text-text-primary">{fullScanSsl.certificate.issuer}</p></div>
                      <div><span className="text-text-muted">Subject</span><p className="font-mono text-text-primary">{fullScanSsl.certificate.subject}</p></div>
                      <div><span className="text-text-muted">Cipher</span><p className="font-mono text-text-primary">{fullScanSsl.cipher}</p></div>
                    </div>
                    {fullScanSsl.issues.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Issues</span>
                        <div className="mt-2 flex flex-col gap-1">
                          {fullScanSsl.issues.map((issue, i) => (
                            <div key={i} className="flex items-center justify-between rounded border border-border/50 px-2 py-1 text-xs">
                              <span className="text-text-primary">{issue.title}</span>
                              <span className={cn('font-medium', issue.severity === 'critical' ? 'text-danger' : issue.severity === 'high' ? 'text-high' : issue.severity === 'medium' ? 'text-warning' : 'text-info')}>{issue.severity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
