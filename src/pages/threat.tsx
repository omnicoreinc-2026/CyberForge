import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Search, Shield, Rss, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { IocLookupPanel } from "@/components/threat-intel/ioc-lookup-panel";
import { IpReputationPanel } from "@/components/threat-intel/ip-reputation-panel";
import { ThreatFeedPanel } from "@/components/threat-intel/threat-feed-panel";
import { GeoipPanel } from "@/components/threat-intel/geoip-panel";
import type { ThreatTab } from "@/types/threat";

const tabs: { id: ThreatTab; label: string; icon: typeof Search }[] = [
  { id: "ioc", label: "IOC Lookup", icon: Search },
  { id: "reputation", label: "IP Reputation", icon: Shield },
  { id: "feed", label: "Threat Feed", icon: Rss },
  { id: "geoip", label: "Geolocation", icon: MapPin },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export function ThreatPage() {
  const [activeTab, setActiveTab] = useState<ThreatTab>("ioc");

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Threat Intelligence</h1>
          <p className="text-sm text-text-secondary">IOC lookups, IP reputation, threat feeds, and geolocation</p>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-secondary p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-accent-dim text-accent shadow-sm"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-card",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === "ioc" && <IocLookupPanel />}
        {activeTab === "reputation" && <IpReputationPanel />}
        {activeTab === "feed" && <ThreatFeedPanel />}
        {activeTab === "geoip" && <GeoipPanel />}
      </motion.div>
    </motion.div>
  );
}
