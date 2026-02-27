import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Globe, Wifi, FileText, Network, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TargetInput } from '@/components/shared/target-input';
import { SubdomainPanel } from '@/components/recon/subdomain-panel';
import { PortScanPanel } from '@/components/recon/port-scan-panel';
import { WhoisPanel } from '@/components/recon/whois-panel';
import { DnsPanel } from '@/components/recon/dns-panel';
import { TechStackPanel } from '@/components/recon/tech-stack-panel';
import type { ReconTab } from '@/types/recon';

const tabs: { id: ReconTab; label: string; icon: typeof Search }[] = [
  { id: 'subdomains', label: 'Subdomains', icon: Globe },
  { id: 'ports', label: 'Ports', icon: Wifi },
  { id: 'whois', label: 'WHOIS', icon: FileText },
  { id: 'dns', label: 'DNS', icon: Network },
  { id: 'techstack', label: 'Tech Stack', icon: Layers },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export function ReconPage() {
  const [searchParams] = useSearchParams();
  const urlTarget = searchParams.get('target') ?? '';
  const [activeTab, setActiveTab] = useState<ReconTab>('subdomains');
  const [globalTarget, setGlobalTarget] = useState(urlTarget);

  const handleFullRecon = useCallback((t: string) => { setGlobalTarget(t); }, []);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Search className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Reconnaissance</h1>
          <p className="text-sm text-text-secondary">Subdomain enumeration, port scanning, and service detection</p>
        </div>
      </div>

      <TargetInput onScan={handleFullRecon} placeholder="Enter target for full recon scan..." initialValue={urlTarget} />

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
        {activeTab === 'subdomains' && <SubdomainPanel externalTarget={globalTarget} />}
        {activeTab === 'ports' && <PortScanPanel externalTarget={globalTarget} />}
        {activeTab === 'whois' && <WhoisPanel externalTarget={globalTarget} />}
        {activeTab === 'dns' && <DnsPanel externalTarget={globalTarget} />}
        {activeTab === 'techstack' && <TechStackPanel externalTarget={globalTarget} />}
      </motion.div>
    </motion.div>
  );
}
