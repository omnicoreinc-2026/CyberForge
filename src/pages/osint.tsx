import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Search, ShieldCheck, ShieldOff, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TargetInput } from '@/components/shared/target-input';
import { ShodanPanel } from '@/components/osint/shodan-panel';
import { VirusTotalPanel } from '@/components/osint/virustotal-panel';
import { BreachLookupPanel } from '@/components/osint/breach-lookup-panel';
import { ReputationPanel } from '@/components/osint/reputation-panel';
import type { OsintTab } from '@/types/osint';

const tabs: { id: OsintTab; label: string; icon: typeof Search }[] = [
  { id: 'shodan', label: 'Shodan', icon: Globe },
  { id: 'virustotal', label: 'VirusTotal', icon: ShieldCheck },
  { id: 'breach', label: 'Breach Lookup', icon: ShieldOff },
  { id: 'reputation', label: 'Reputation', icon: Gauge },
];

export function OsintPage() {
  const [searchParams] = useSearchParams();
  const urlTarget = searchParams.get('target') ?? '';
  const [activeTab, setActiveTab] = useState<OsintTab>('shodan');
  const [globalTarget, setGlobalTarget] = useState(urlTarget);

  const handleGlobalScan = useCallback((t: string) => { setGlobalTarget(t); }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Globe className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">OSINT</h1>
          <p className="text-sm text-text-secondary">Open source intelligence gathering and analysis</p>
        </div>
      </div>

      <TargetInput onScan={handleGlobalScan} placeholder="Enter target for OSINT analysis..." initialValue={urlTarget} />

      <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-secondary p-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              activeTab === tab.id ? 'bg-accent-dim text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-bg-card')}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === 'shodan' && <ShodanPanel externalTarget={globalTarget} />}
        {activeTab === 'virustotal' && <VirusTotalPanel externalTarget={globalTarget} />}
        {activeTab === 'breach' && <BreachLookupPanel externalTarget={globalTarget} />}
        {activeTab === 'reputation' && <ReputationPanel externalTarget={globalTarget} />}
      </motion.div>
    </motion.div>
  );
}
