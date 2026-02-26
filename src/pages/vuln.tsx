import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bug, ShieldCheck, Lock, Search, Package, Scan } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TargetInput } from '@/components/shared/target-input';
import { HeaderAnalysisPanel } from '@/components/vuln-scanner/header-analysis-panel';
import { SslCheckPanel } from '@/components/vuln-scanner/ssl-check-panel';
import { CveLookupPanel } from '@/components/vuln-scanner/cve-lookup-panel';
import { DependencyCheckPanel } from '@/components/vuln-scanner/dependency-check-panel';
import type { VulnTab } from '@/types/vuln';

const tabs: { id: VulnTab; label: string; icon: typeof Bug }[] = [
  { id: 'headers', label: 'Headers', icon: ShieldCheck },
  { id: 'ssl', label: 'SSL/TLS', icon: Lock },
  { id: 'cve', label: 'CVE Lookup', icon: Search },
  { id: 'dependencies', label: 'Dependencies', icon: Package },
  { id: 'fullscan', label: 'Full Scan', icon: Scan },
];

export function VulnPage() {
  const [activeTab, setActiveTab] = useState<VulnTab>('headers');

  const handleGlobalScan = useCallback((target: string) => {
    console.log('Vuln scan on:', target);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Bug className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Vulnerability Scanner</h1>
          <p className="text-sm text-text-secondary">Security header analysis, SSL checks, CVE lookups, and dependency auditing</p>
        </div>
      </div>

      <TargetInput onScan={handleGlobalScan} placeholder="Enter target for vulnerability scan..." />

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
        {activeTab === 'headers' && <HeaderAnalysisPanel />}
        {activeTab === 'ssl' && <SslCheckPanel />}
        {activeTab === 'cve' && <CveLookupPanel />}
        {activeTab === 'dependencies' && <DependencyCheckPanel />}
        {activeTab === 'fullscan' && (
          <div className="glass-card flex flex-col items-center gap-4 p-12">
            <Scan className="h-12 w-12 text-accent/30" />
            <h3 className="text-lg font-semibold text-text-primary">Full Vulnerability Scan</h3>
            <p className="text-sm text-text-secondary text-center max-w-md">
              Runs all vulnerability checks (headers, SSL, known CVEs) against the target. Enter a target above and click Scan to begin a comprehensive assessment.
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
