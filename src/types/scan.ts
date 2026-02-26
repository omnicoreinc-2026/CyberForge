export type ScanStatus = 'idle' | 'running' | 'complete' | 'error';

export type ModuleType =
  | 'recon'
  | 'osint'
  | 'vuln'
  | 'threat'
  | 'logs'
  | 'reports'
  | 'ai';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ScanRequest {
  target: string;
  module: ModuleType;
  options?: Record<string, unknown>;
}

export interface ScanProgress {
  scanId: string;
  status: ScanStatus;
  progress: number;
  currentTask: string;
  startedAt: string;
  estimatedCompletion?: string;
}

export interface ScanResult {
  scanId: string;
  module: ModuleType;
  target: string;
  status: ScanStatus;
  progress: number;
  results: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ApiError {
  message: string;
  status: number;
  detail?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
}
