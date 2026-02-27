export interface DiscoveredService {
  port: number;
  protocol: string;
  service: string;
  product: string;
  version: string;
  extrainfo: string;
  cpe: string;
}

export interface ServiceVuln {
  cve_id: string;
  cvss: number;
  description: string;
  exploit_available: boolean;
  exploit_id: string;
}

export interface DiscoveredHost {
  ip: string;
  hostname: string;
  os_guess: string;
  state: string;
  services: DiscoveredService[];
  vulns: ServiceVuln[];
}

export interface SeekResponse {
  scan_id: string;
  cidr: string;
  hosts_scanned: number;
  hosts_alive: number;
  total_services: number;
  total_vulns: number;
  hosts: DiscoveredHost[];
}

export interface EnterRequest {
  scan_id: string;
  target_ip: string;
  port: number;
  service: string;
  exploit_id: string;
  options: Record<string, unknown>;
}

export interface EnterEvent {
  event_type: 'info' | 'command' | 'output' | 'success' | 'error' | 'complete';
  timestamp: string;
  message: string;
  module: string;
}

export type SeekEnterPhase = 'seek' | 'results' | 'enter';
