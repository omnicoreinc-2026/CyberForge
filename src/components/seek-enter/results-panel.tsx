import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ChevronDown, ChevronRight, Server, Shield,
  AlertTriangle, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SeekResponse, DiscoveredHost } from '@/types/seek-enter';

interface ResultsPanelProps {
  results: SeekResponse;
  onEnter: (host: DiscoveredHost, port: number, service: string, exploitId: string) => void;
  onBack: () => void;
}

function sevColor(cvss: number): string {
  if (cvss >= 9.0) return 'text-danger bg-danger/10 border-danger/30';
  if (cvss >= 7.0) return 'text-warning bg-warning/10 border-warning/30';
  if (cvss >= 4.0) return 'text-info bg-info/10 border-info/30';
  return 'text-success bg-success/10 border-success/30';
}

export function ResultsPanel({ results, onEnter, onBack }: ResultsPanelProps) {
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(
    new Set(results.hosts.filter((h) => h.vulns.length > 0).map((h) => h.ip)),
  );

  const toggleHost = (ip: string) => {
    setExpandedHosts((prev) => {
      const next = new Set(prev);
      if (next.has(ip)) next.delete(ip); else next.add(ip);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> New Scan
        </motion.button>
        <div className="flex items-center gap-4">
          <div className="glass-card flex items-center gap-2 px-3 py-1.5">
            <Server className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs text-text-muted">Hosts:</span>
            <span className="font-mono text-sm font-semibold text-accent">{results.hosts_alive}</span>
          </div>
          <div className="glass-card flex items-center gap-2 px-3 py-1.5">
            <Shield className="h-3.5 w-3.5 text-warning" />
            <span className="text-xs text-text-muted">Services:</span>
            <span className="font-mono text-sm font-semibold text-warning">{results.total_services}</span>
          </div>
          <div className="glass-card flex items-center gap-2 px-3 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-danger" />
            <span className="text-xs text-text-muted">Vulns:</span>
            <span className="font-mono text-sm font-semibold text-danger">{results.total_vulns}</span>
          </div>
        </div>
      </div>

      {/* Host cards */}
      {results.hosts.map((host, idx) => (
        <motion.div
          key={host.ip}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="glass-card overflow-hidden"
        >
          {/* Host header */}
          <button
            onClick={() => toggleHost(host.ip)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent-dim/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedHosts.has(host.ip)
                ? <ChevronDown className="h-4 w-4 text-text-muted" />
                : <ChevronRight className="h-4 w-4 text-text-muted" />
              }
              <span className="font-mono text-sm font-medium text-accent">{host.ip}</span>
              {host.hostname && (
                <span className="text-xs text-text-muted">({host.hostname})</span>
              )}
              {host.os_guess && (
                <span className="rounded border border-border bg-bg-secondary px-2 py-0.5 text-xs text-text-muted">
                  {host.os_guess}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                {host.services.length} svc
              </span>
              {host.vulns.length > 0 && (
                <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs text-danger">
                  {host.vulns.length} vuln
                </span>
              )}
            </div>
          </button>

          {/* Expanded detail */}
          <AnimatePresence>
            {expandedHosts.has(host.ip) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-border"
              >
                {/* Services table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left">
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Port</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Service</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Product / Version</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {host.services.map((svc) => (
                      <tr key={svc.port} className="border-b border-border/30 hover:bg-accent-dim/20">
                        <td className="px-4 py-2 font-mono text-accent text-xs">{svc.port}/{svc.protocol}</td>
                        <td className="px-4 py-2 text-text-primary text-xs">{svc.service}</td>
                        <td className="px-4 py-2 text-text-secondary text-xs">
                          {svc.product}{svc.version ? ` ${svc.version}` : ''}
                        </td>
                        <td className="px-4 py-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onEnter(host, svc.port, svc.service, 'auto')}
                            className="flex items-center gap-1 rounded border border-danger/30 bg-danger/10 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/20 transition-colors"
                          >
                            <Play className="h-3 w-3" /> Enter
                          </motion.button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Vulnerabilities */}
                {host.vulns.length > 0 && (
                  <div className="border-t border-border p-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Vulnerabilities
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {host.vulns.map((vuln, vi) => (
                        <div
                          key={vi}
                          className="flex items-center gap-2 rounded border border-border bg-bg-secondary px-3 py-1.5"
                        >
                          <span className={cn(
                            'rounded-full border px-2 py-0.5 text-xs font-medium',
                            sevColor(vuln.cvss),
                          )}>
                            {vuln.cvss.toFixed(1)}
                          </span>
                          <span className="font-mono text-xs text-text-primary">{vuln.cve_id}</span>
                          {vuln.exploit_available && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                const matchSvc = host.services[0];
                                if (matchSvc) {
                                  onEnter(host, matchSvc.port, matchSvc.service, vuln.exploit_id);
                                }
                              }}
                              className="flex items-center gap-1 rounded bg-danger/20 px-1.5 py-0.5 text-xs text-danger hover:bg-danger/30"
                            >
                              <Play className="h-2.5 w-2.5" /> Exploit
                            </motion.button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}

      {/* Empty state */}
      {results.hosts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 py-12 text-text-muted"
        >
          <Server className="h-10 w-10 opacity-30" />
          <p className="text-sm">No live hosts discovered in {results.cidr}</p>
        </motion.div>
      )}
    </div>
  );
}
