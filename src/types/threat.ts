import type { Severity } from './scan';

export type ThreatTab = 'ioc' | 'reputation' | 'feed' | 'geoip';

export interface IocResult {
  ioc_type: string;
  value: string;
  threat_type: string;
  malware: string | null;
  confidence: number;
  source: string;
  first_seen: string;
  last_seen: string;
  tags: string[];
}

export interface OtxSourceInfo {
  pulse_count: number;
  reputation: number;
  country: string;
  asn: string;
  error?: string | null;
}

export interface ThreatFoxSourceInfo {
  match_count: number;
  error?: string | null;
}

export interface AbuseIpDbSourceInfo {
  abuse_score: number;
  country: string;
  isp: string;
  total_reports: number;
  last_reported: string;
  categories: number[];
  error?: string | null;
}

export interface GeoIpSourceInfo {
  country: string;
  country_code: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
  org: string;
  as_number: string;
}

export interface IocLookupResponse {
  scan_id: string;
  ioc_value: string;
  ioc_type: string;
  sources: {
    otx?: OtxSourceInfo;
    threatfox?: ThreatFoxSourceInfo;
    abuseipdb?: AbuseIpDbSourceInfo;
    geoip?: GeoIpSourceInfo;
  };
  ioc_results: IocResult[];
  max_confidence: number;
  severity: Severity;
  total_sources_queried: number;
  error?: string;
}

export interface IpReputationData {
  ip: string;
  abuse_score: number;
  country: string;
  isp: string;
  domain: string;
  total_reports: number;
  last_reported: string;
  categories: number[];
}

export interface GeoIpData {
  ip: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
  org: string;
  as_number: string;
}

export interface IpReputationResponse {
  scan_id: string;
  reputation: IpReputationData;
  geolocation: GeoIpData;
  abuseipdb_error?: string | null;
  geoip_error?: string | null;
  error?: string;
}

export interface ThreatFeedEntry {
  id: string;
  ioc_type: string;
  ioc_value: string;
  threat_type: string;
  confidence: number;
  source: string;
  timestamp: string;
}

export interface ThreatFeedResponse {
  entries: ThreatFeedEntry[];
  count: number;
}

export interface ThreatHistoryScan {
  id: string;
  module: string;
  target: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  result_count: number;
}

export interface ThreatHistoryResponse {
  scans: ThreatHistoryScan[];
}

export const ABUSE_CATEGORIES: Record<number, string> = {
  1: 'DNS Compromise',
  2: 'DNS Poisoning',
  3: 'Fraud Orders',
  4: 'DDoS Attack',
  5: 'FTP Brute-Force',
  6: 'Ping of Death',
  7: 'Phishing',
  8: 'Fraud VoIP',
  9: 'Open Proxy',
  10: 'Web Spam',
  11: 'Email Spam',
  12: 'Blog Spam',
  13: 'VPN IP',
  14: 'Port Scan',
  15: 'Hacking',
  16: 'SQL Injection',
  17: 'Spoofing',
  18: 'Brute-Force',
  19: 'Bad Web Bot',
  20: 'Exploited Host',
  21: 'Web App Attack',
  22: 'SSH',
  23: 'IoT Targeted',
};
