import type { Severity } from '@/types/scan';

export type HeaderStatus = 'pass' | 'fail' | 'warning';

export interface SecurityHeader {
  name: string;
  value: string;
  status: HeaderStatus;
  description: string;
}

export type SecurityGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface HeaderAnalysisResponse {
  url: string;
  grade: SecurityGrade;
  headers: SecurityHeader[];
  score: number;
}

export interface SslCertificateInfo {
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  signatureAlgorithm: string;
}

export interface SslProtocol {
  name: string;
  supported: boolean;
}

export interface SslIssue {
  title: string;
  severity: Severity;
  description: string;
}

export interface SslCheckResponse {
  hostname: string;
  grade: SecurityGrade;
  isValid: boolean;
  certificate: SslCertificateInfo;
  protocols: SslProtocol[];
  cipher: string;
  issues: SslIssue[];
}

export interface CveReference {
  source: string;
  url: string;
}

export interface CveResult {
  cveId: string;
  description: string;
  cvssScore: number;
  severity: Severity;
  publishedDate: string;
  modifiedDate: string;
  affectedProducts: string[];
  references: CveReference[];
}

export interface CveLookupResponse {
  query: string;
  total: number;
  results: CveResult[];
}

export interface VulnerablePackage {
  name: string;
  installedVersion: string;
  fixedVersion: string;
  cveId: string;
  severity: Severity;
  description: string;
}

export interface DependencyCheckResponse {
  filename: string;
  totalPackages: number;
  vulnerableCount: number;
  packages: VulnerablePackage[];
}

export type VulnTab = 'headers' | 'ssl' | 'cve' | 'dependencies' | 'fullscan';
