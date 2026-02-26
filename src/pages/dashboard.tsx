import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  Search,
  Globe,
  Bug,
  AlertTriangle,
  FileText,
  FileOutput,
  Bot,
  Activity,
  ShieldAlert,
  Radar,
  FileBarChart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
}

interface ModuleCardProps {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  index: number;
}

const stats: StatCardProps[] = [
  { label: 'Total Scans', value: 0, icon: Activity },
  { label: 'Vulnerabilities Found', value: 0, icon: ShieldAlert },
  { label: 'Threats Detected', value: 0, icon: Radar },
  { label: 'Reports Generated', value: 0, icon: FileBarChart },
];

const modules: Omit<ModuleCardProps, 'index'>[] = [
  {
    path: '/recon',
    label: 'Reconnaissance',
    description: 'Port scanning, subdomain enumeration, and service detection.',
    icon: Search,
  },
  {
    path: '/osint',
    label: 'OSINT',
    description: 'Open source intelligence gathering and analysis.',
    icon: Globe,
  },
  {
    path: '/vuln',
    label: 'Vulnerability Scanner',
    description: 'CVE detection, service fingerprinting, and exploit matching.',
    icon: Bug,
  },
  {
    path: '/threat',
    label: 'Threat Intelligence',
    description: 'IOC lookups, threat feeds, and reputation analysis.',
    icon: AlertTriangle,
  },
  {
    path: '/logs',
    label: 'Log Analyzer',
    description: 'Security log parsing, anomaly detection, and pattern matching.',
    icon: FileText,
  },
  {
    path: '/reports',
    label: 'Reports',
    description: 'Generate comprehensive security assessment reports.',
    icon: FileOutput,
  },
  {
    path: '/ai',
    label: 'AI Assistant',
    description: 'AI-powered security analysis and recommendations.',
    icon: Bot,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
};

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <motion.div variants={cardVariants} className="glass-card flex items-center gap-4 p-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-dim">
        <Icon className="h-6 w-6 text-accent" />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    </motion.div>
  );
}

function ModuleCard({ path, label, description, icon: Icon, index: _index }: ModuleCardProps) {
  return (
    <motion.div variants={cardVariants}>
      <Link to={path} className="block">
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="glass-card flex flex-col gap-3 p-5 cursor-pointer h-full"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-dim">
              <Icon className="h-5 w-5 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">{description}</p>
        </motion.div>
      </Link>
    </motion.div>
  );
}

export function DashboardPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6"
    >
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Command Center</h1>
          <p className="text-sm text-text-secondary">CyberForge Security Operations Dashboard</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Module cards grid */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Modules
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((mod, index) => (
            <ModuleCard key={mod.path} {...mod} index={index} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
