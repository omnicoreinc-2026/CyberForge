import type { Severity } from '@/types/scan';

export interface ShodanHostInfo {
  ip: string;
  org: string;
  os: string;
  isp: string;
  country: string;
  city: string;
  lastUpdate: string;
}

export interface ShodanService {
  port: number;
  transport: string;
  product: string;
  version: string;
  banner: string;
}

export interface ShodanVulnerability {
  cve: string;
  cvss: number;
  severity: Severity;
  summary: string;
}

export interface ShodanResponse {
  host: ShodanHostInfo;
  ports: number[];
  services: ShodanService[];
  vulnerabilities: ShodanVulnerability[];
}

export type VtVerdict = 'clean' | 'suspicious' | 'malicious' | 'undetected';

export interface VtVendorResult {
  vendor: string;
  verdict: VtVerdict;
  detail: string;
}

export interface VtResponse {
  target: string;
  targetType: 'url' | 'domain' | 'ip' | 'hash';
  positives: number;
  total: number;
  scanDate: string;
  permalink: string;
  vendors: VtVendorResult[];
}

export interface BreachRecord {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  pwnCount: number;
  description: string;
  dataClasses: string[];
  isVerified: boolean;
  isSensitive: boolean;
}

export interface BreachResponse {
  target: string;
  totalBreaches: number;
  breaches: BreachRecord[];
}

export interface ReputationCategory {
  name: string;
  score: number;
}

export interface ReputationResponse {
  target: string;
  score: number;
  categories: ReputationCategory[];
  details: Record<string, string>;
}

export type OsintTab = 'shodan' | 'virustotal' | 'breach' | 'reputation';
