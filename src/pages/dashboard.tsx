import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  Zap,
  Eye,
  KeyRound,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  HourglassIcon,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, formatTimestamp } from '@/lib/utils';
import { AnimatedCounter } from '@/components/shared/animated-counter';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import type { RecentScan } from '@/hooks/use-dashboard-stats';
import { useMode } from '@/contexts/mode-context';
import { MODE_CONFIG } from '@/config/mode-data';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StatCardConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  gradient: string;
  iconColor: string;
}

interface ModuleCardConfig {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  moduleKey: string;
}

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const statCardConfigs: Omit<StatCardConfig, 'label'>[] = [
  { key: 'total_scans', icon: Activity, gradient: 'stat-gradient-scans', iconColor: 'text-accent' },
  { key: 'vulnerabilities_found', icon: ShieldAlert, gradient: 'stat-gradient-vulns', iconColor: 'text-danger' },
  { key: 'threats_detected', icon: Radar, gradient: 'stat-gradient-threats', iconColor: 'text-high' },
  { key: 'reports_generated', icon: FileBarChart, gradient: 'stat-gradient-reports', iconColor: 'text-success' },
];

const modules: ModuleCardConfig[] = [
  {
    path: '/recon',
    label: 'Reconnaissance',
    description: 'Port scanning, subdomain enumeration, and service detection.',
    icon: Search,
    moduleKey: 'recon',
  },
  {
    path: '/exploit',
    label: 'Exploit Arsenal',
    description: 'SQLi, XSS, dir busting, nuclei templates, fuzzing, and credential testing.',
    icon: Zap,
    moduleKey: 'exploit',
  },
  {
    path: '/osint',
    label: 'OSINT',
    description: 'Open source intelligence gathering and analysis.',
    icon: Globe,
    moduleKey: 'osint',
  },
  {
    path: '/vuln',
    label: 'Vulnerability Scanner',
    description: 'CVE detection, service fingerprinting, and exploit matching.',
    icon: Bug,
    moduleKey: 'vuln',
  },
  {
    path: '/threat',
    label: 'Threat Intelligence',
    description: 'IOC lookups, threat feeds, and reputation analysis.',
    icon: AlertTriangle,
    moduleKey: 'threat',
  },
  {
    path: '/logs',
    label: 'Log Analyzer',
    description: 'Security log parsing, anomaly detection, and pattern matching.',
    icon: FileText,
    moduleKey: 'logs',
  },
  {
    path: '/reports',
    label: 'Reports',
    description: 'Generate comprehensive security assessment reports.',
    icon: FileOutput,
    moduleKey: 'reports',
  },
  {
    path: '/ai',
    label: 'AI Assistant',
    description: 'AI-powered security analysis and recommendations.',
    icon: Bot,
    moduleKey: 'ai',
  },
];

const moduleIconMap: Record<string, LucideIcon> = {
  recon: Search,
  recon_subdomains: Search,
  recon_ports: Search,
  recon_whois: Search,
  recon_dns: Search,
  recon_tech: Search,
  recon_full: Search,
  osint: Globe,
  osint_virustotal: Globe,
  osint_shodan: Globe,
  osint_reputation: Globe,
  osint_breach: Globe,
  vuln: Bug,
  vuln_cve: Bug,
  vuln_ssl: Bug,
  vuln_headers: Bug,
  vuln_deps: Bug,
  threat: AlertTriangle,
  threat_ioc: AlertTriangle,
  threat_feed: AlertTriangle,
  threat_ip_rep: AlertTriangle,
  threat_geoip: AlertTriangle,
  logs: FileText,
  log_upload: FileText,
  reports: FileOutput,
  ai: Bot,
};

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
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

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

/* ------------------------------------------------------------------ */
/*  Helper: module name prettifier                                     */
/* ------------------------------------------------------------------ */

function prettifyModule(raw: string): string {
  const map: Record<string, string> = {
    recon_subdomains: 'Subdomain Scan',
    recon_ports: 'Port Scan',
    recon_whois: 'WHOIS Lookup',
    recon_dns: 'DNS Analysis',
    recon_tech: 'Tech Fingerprint',
    recon_full: 'Full Recon',
    osint_virustotal: 'VirusTotal',
    osint_shodan: 'Shodan',
    osint_reputation: 'Reputation',
    osint_breach: 'Breach Lookup',
    vuln_cve: 'CVE Lookup',
    vuln_ssl: 'SSL Check',
    vuln_headers: 'Header Analysis',
    vuln_deps: 'Dependency Check',
    threat_ioc: 'IOC Lookup',
    threat_feed: 'Threat Feed',
    threat_ip_rep: 'IP Reputation',
    threat_geoip: 'GeoIP Lookup',
    log_upload: 'Log Upload',
  };
  return map[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  Helper: status icon & badge                                        */
/* ------------------------------------------------------------------ */

function getStatusIcon(status: string): LucideIcon {
  switch (status) {
    case 'completed':
      return CheckCircle2;
    case 'running':
      return Loader2;
    case 'error':
      return XCircle;
    default:
      return HourglassIcon;
  }
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'status-badge-completed';
    case 'running':
      return 'status-badge-running';
    case 'error':
      return 'status-badge-error';
    default:
      return 'status-badge-pending';
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: relative time                                              */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({
  config,
  value,
  loading,
}: {
  config: StatCardConfig;
  value: number;
  loading: boolean;
}) {
  const Icon = config.icon;

  return (
    <motion.div
      variants={cardVariants}
      className={cn(
        'glass-card flex items-center gap-4 p-5',
        config.gradient,
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-dim">
        <Icon className={cn('h-6 w-6', config.iconColor)} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-border" />
        ) : (
          <AnimatedCounter
            value={value}
            duration={1200}
            className="text-2xl font-bold text-text-primary font-mono block"
          />
        )}
        <p className="text-xs text-text-secondary mt-0.5">{config.label}</p>
      </div>
    </motion.div>
  );
}

function ModuleCard({
  config,
  lastActivity,
  index,
}: {
  config: ModuleCardConfig;
  lastActivity: string | null;
  index: number;
}) {
  const Icon = config.icon;

  return (
    <motion.div
      variants={cardVariants}
      custom={index}
    >
      <Link to={config.path} className="block">
        <motion.div
          whileHover={{ scale: 1.03, y: -3 }}
          whileTap={{ scale: 0.98 }}
          className="glass-card module-card-glow flex flex-col gap-3 p-5 cursor-pointer h-full"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-dim">
              <Icon className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">{config.label}</h3>
              {lastActivity && (
                <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {relativeTime(lastActivity)}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">{config.description}</p>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function RecentActivityItem({ scan, isLast }: { scan: RecentScan; isLast: boolean }) {
  const ModuleIcon = moduleIconMap[scan.module] ?? Activity;
  const StatusIcon = getStatusIcon(scan.status);

  return (
    <div className={cn('flex items-start gap-3 py-3', !isLast && 'timeline-line')}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-dim mt-0.5">
        <ModuleIcon className="h-4 w-4 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary">
            {prettifyModule(scan.module)}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              getStatusBadgeClass(scan.status),
            )}
          >
            <StatusIcon className={cn('h-3 w-3', scan.status === 'running' && 'animate-spin')} />
            {scan.status}
          </span>
        </div>
        <p className="text-xs text-text-secondary mt-0.5 truncate font-mono">
          {scan.target}
        </p>
        <p className="text-[10px] text-text-muted mt-1">
          {formatTimestamp(scan.started_at)}
        </p>
      </div>
    </div>
  );
}

function QuickScanModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [target, setTarget] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const navigate = useNavigate();
  const { mode } = useMode();
  const modeConfig = MODE_CONFIG[mode];

  const scanModules = [
    { key: 'recon', label: 'Reconnaissance', icon: Search },
    { key: 'osint', label: 'OSINT', icon: Globe },
    { key: 'vuln', label: 'Vuln Scanner', icon: Bug },
    { key: 'threat', label: 'Threat Intel', icon: AlertTriangle },
  ];

  function toggleModule(key: string) {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  }

  function handleLaunch() {
    if (!target.trim() || selectedModules.length === 0) return;
    const firstModule = selectedModules[0];
    navigate(`/${firstModule}?target=${encodeURIComponent(target.trim())}`);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="glass-card w-full max-w-md p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Zap className="h-5 w-5 text-accent" />
                {modeConfig.quickActionLabel}
              </h3>
              <button
                onClick={onClose}
                className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-accent-dim"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Target
                </label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="e.g. example.com, 192.168.1.1"
                  className="w-full rounded-lg bg-bg-secondary border border-border px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Modules
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {scanModules.map((mod) => {
                    const isSelected = selectedModules.includes(mod.key);
                    return (
                      <button
                        key={mod.key}
                        onClick={() => toggleModule(mod.key)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all border',
                          isSelected
                            ? 'bg-accent-dim border-accent text-accent'
                            : 'bg-bg-secondary border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
                        )}
                      >
                        <mod.icon className="h-4 w-4" />
                        {mod.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleLaunch}
                disabled={!target.trim() || selectedModules.length === 0}
                className={cn(
                  'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
                  target.trim() && selectedModules.length > 0
                    ? 'bg-accent text-bg-primary hover:brightness-110 glow-accent'
                    : 'bg-border text-text-muted cursor-not-allowed',
                )}
              >
                {modeConfig.quickActionVerb}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Main dashboard page                                                */
/* ------------------------------------------------------------------ */

export function DashboardPage() {
  const { stats, loading, error } = useDashboardStats();
  const [quickScanOpen, setQuickScanOpen] = useState(false);
  const { mode, isLancer } = useMode();
  const modeConfig = MODE_CONFIG[mode];

  // Build mode-aware stat cards with labels from config
  const statCards: StatCardConfig[] = statCardConfigs.map((c, i) => ({
    ...c,
    label: modeConfig.statLabels[i],
  }));

  // Filter modules by mode (exploit only in lancer)
  const visibleModules = isLancer ? modules : modules.filter((m) => m.path !== '/exploit');

  const DashIcon = modeConfig.dashboardIcon;

  // Build a map of module -> last activity timestamp from recent scans
  const moduleLastActivity: Record<string, string> = {};
  if (stats?.recent_scans) {
    for (const scan of stats.recent_scans) {
      const baseModule = scan.module.split('_')[0];
      if (!moduleLastActivity[baseModule]) {
        moduleLastActivity[baseModule] = scan.started_at;
      }
    }
  }

  // Stat values
  const statValues: Record<string, number> = {
    total_scans: stats?.total_scans ?? 0,
    vulnerabilities_found: stats?.vulnerabilities_found ?? 0,
    threats_detected: stats?.threats_detected ?? 0,
    reports_generated: stats?.reports_generated ?? 0,
  };

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-6"
      >
        {/* Page header */}
        <motion.div variants={cardVariants} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DashIcon className="h-7 w-7 text-accent" />
            <div>
              <h1 className="text-xl font-bold text-text-primary">{modeConfig.dashboardTitle}</h1>
              <p className="text-sm text-text-secondary">
                {modeConfig.tagline}
              </p>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger">
              <XCircle className="h-4 w-4" />
              <span>Backend unavailable</span>
            </div>
          )}
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <StatCard
              key={card.key}
              config={card}
              value={statValues[card.key]}
              loading={loading}
            />
          ))}
        </div>

        {/* Quick actions bar */}
        <motion.div variants={cardVariants} className="flex flex-wrap gap-3">
          <button
            onClick={() => setQuickScanOpen(true)}
            className="quick-action-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-accent"
          >
            <Zap className="h-4 w-4" />
            {modeConfig.quickActionLabel}
          </button>
          <Link
            to="/reports"
            className="quick-action-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            <Eye className="h-4 w-4" />
            View Reports
          </Link>
          <Link
            to="/settings"
            className="quick-action-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            <KeyRound className="h-4 w-4" />
            Configure API Keys
          </Link>
        </motion.div>

        {/* Module cards grid */}
        <div>
          <motion.h2
            variants={cardVariants}
            className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted"
          >
            {modeConfig.moduleSectionTitle}
          </motion.h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleModules.map((mod, index) => (
              <ModuleCard
                key={mod.path}
                config={mod}
                lastActivity={moduleLastActivity[mod.moduleKey] ?? null}
                index={index}
              />
            ))}
          </div>
        </div>

        {/* Recent activity section */}
        <motion.div variants={cardVariants}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
            {modeConfig.recentSectionTitle}
          </h2>
          <div className="glass-card p-5">
            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-border" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-border" />
                      <div className="h-3 w-48 animate-pulse rounded bg-border" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recent_scans && stats.recent_scans.length > 0 ? (
              <div className="divide-y divide-border">
                {stats.recent_scans.map((scan, idx) => (
                  <RecentActivityItem
                    key={scan.id}
                    scan={scan}
                    isLast={idx === stats.recent_scans.length - 1}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-10 w-10 text-text-muted mb-3" />
                <p className="text-sm text-text-secondary">No recent activity</p>
                <p className="text-xs text-text-muted mt-1">
                  {modeConfig.emptyStateText}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Quick scan modal */}
      <QuickScanModal open={quickScanOpen} onClose={() => setQuickScanOpen(false)} />
    </>
  );
}
