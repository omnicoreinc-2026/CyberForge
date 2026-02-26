export interface SubdomainResult {
  subdomain: string;
  ip: string;
  source: string;
}

export interface SubdomainScanResponse {
  target: string;
  total: number;
  subdomains: SubdomainResult[];
}

export type PortState = 'open' | 'closed' | 'filtered';

export interface PortResult {
  port: number;
  state: PortState;
  service: string;
  version: string;
}

export interface PortScanResponse {
  target: string;
  portRange: string;
  total: number;
  openPorts: number;
  ports: PortResult[];
}

export interface WhoisField {
  label: string;
  value: string;
}

export interface WhoisResponse {
  domain: string;
  registrar: string;
  createdDate: string;
  expiresDate: string;
  updatedDate: string;
  nameServers: string[];
  status: string[];
  registrant: string;
  fields: WhoisField[];
}

export type DnsRecordType = 'A' | 'AAAA' | 'MX' | 'NS' | 'TXT' | 'CNAME' | 'SOA';

export interface DnsRecord {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
}

export interface DnsResponse {
  domain: string;
  records: DnsRecord[];
}

export type TechCategory =
  | 'Framework'
  | 'Server'
  | 'CMS'
  | 'CDN'
  | 'Analytics'
  | 'JavaScript'
  | 'Security'
  | 'Cache'
  | 'Database'
  | 'Other';

export interface TechStackItem {
  name: string;
  category: TechCategory;
  version: string;
  confidence: number;
  website?: string;
  icon?: string;
}

export interface TechStackResponse {
  url: string;
  technologies: TechStackItem[];
}

export type ReconTab = 'subdomains' | 'ports' | 'whois' | 'dns' | 'techstack';
