import {
  Shield, Search, Globe, Bug, AlertTriangle, FileText, FileOutput, Bot, Settings,
  Crosshair, Zap, Radar,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppMode } from '@/contexts/mode-context';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface ModeConfig {
  appName: string;
  appNamePrefix: string;
  appNameSuffix: string;
  tagline: string;
  dashboardTitle: string;
  dashboardIcon: LucideIcon;
  navItems: NavItem[];
  statLabels: string[];
  moduleSectionTitle: string;
  quickActionLabel: string;
  quickActionVerb: string;
  activeOpsLabel: string;
  recentSectionTitle: string;
  emptyStateText: string;
}

export const MODE_CONFIG: Record<AppMode, ModeConfig> = {
  forge: {
    appName: 'CyberForge',
    appNamePrefix: 'Cyber',
    appNameSuffix: 'Forge',
    tagline: 'CyberForge Command Center',
    dashboardTitle: 'Command Center',
    dashboardIcon: Shield,
    navItems: [
      { path: '/', label: 'Dashboard', icon: Shield },
      { path: '/recon', label: 'Recon', icon: Search },
      { path: '/osint', label: 'OSINT', icon: Globe },
      { path: '/vuln', label: 'Vuln Scanner', icon: Bug },
      { path: '/threat', label: 'Threat Intel', icon: AlertTriangle },
      { path: '/logs', label: 'Log Analyzer', icon: FileText },
      { path: '/reports', label: 'Reports', icon: FileOutput },
      { path: '/ai', label: 'AI Assistant', icon: Bot },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
    statLabels: ['Total Scans', 'Vulnerabilities Found', 'Threats Detected', 'Reports Generated'],
    moduleSectionTitle: 'Modules',
    quickActionLabel: 'Quick Scan',
    quickActionVerb: 'Launch Scan',
    activeOpsLabel: 'Active Scans',
    recentSectionTitle: 'Recent Activity',
    emptyStateText: 'Run a scan to see results here',
  },
  lancer: {
    appName: 'CyberLancer',
    appNamePrefix: 'Cyber',
    appNameSuffix: 'Lancer',
    tagline: 'CyberLancer Strike Operations',
    dashboardTitle: 'Strike Console',
    dashboardIcon: Crosshair,
    navItems: [
      { path: '/', label: 'Strike Console', icon: Crosshair },
      { path: '/recon', label: 'Recon', icon: Search },
      { path: '/exploit', label: 'Exploit', icon: Zap },
      { path: '/seek-enter', label: 'Seek & Enter', icon: Radar },
      { path: '/osint', label: 'OSINT', icon: Globe },
      { path: '/vuln', label: 'Vuln Scanner', icon: Bug },
      { path: '/threat', label: 'Threat Intel', icon: AlertTriangle },
      { path: '/logs', label: 'Log Analyzer', icon: FileText },
      { path: '/reports', label: 'Reports', icon: FileOutput },
      { path: '/ai', label: 'AI Assistant', icon: Bot },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
    statLabels: ['Strikes Executed', 'Vulns Exploited', 'Targets Compromised', 'Intel Reports'],
    moduleSectionTitle: 'Arsenal',
    quickActionLabel: 'Quick Strike',
    quickActionVerb: 'Launch Strike',
    activeOpsLabel: 'Active Ops',
    recentSectionTitle: 'Recent Operations',
    emptyStateText: 'Launch a strike to see results here',
  },
};

export const MODE_COLORS: Record<AppMode, { accent: string; accentDim: string; accentGlow: string }> = {
  forge: { accent: '#00d4ff', accentDim: 'rgba(0,212,255,0.1)', accentGlow: 'rgba(0,212,255,0.3)' },
  lancer: { accent: '#ff3333', accentDim: 'rgba(255,51,51,0.1)', accentGlow: 'rgba(255,51,51,0.3)' },
};
