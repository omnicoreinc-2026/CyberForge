import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, PlusCircle, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReportBuilder } from "@/components/reports/report-builder";
import { ReportHistory } from "@/components/reports/report-history";

type ReportsTab = "create" | "history";

const tabs: { id: ReportsTab; label: string; icon: typeof FileText }[] = [
  { id: "create", label: "Create Report", icon: PlusCircle },
  { id: "history", label: "Report History", icon: History },
];

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>("create");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <FileText className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            Report Generator
          </h1>
          <p className="text-sm text-text-secondary">
            Generate professional security assessment reports from scan results
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-bg-secondary p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-accent-dim text-accent shadow-sm"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-card"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "create" && <ReportBuilder />}
        {activeTab === "history" && <ReportHistory />}
      </motion.div>
    </motion.div>
  );
}
