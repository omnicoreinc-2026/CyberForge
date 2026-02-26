import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiClient, ApiClientError } from '@/lib/api-client';

interface RecentScan {
  id: string;
  module: string;
  target: string;
  status: string;
  started_at: string;
}

interface ModuleActivity {
  module: string;
  count: number;
}

interface DashboardStats {
  total_scans: number;
  vulnerabilities_found: number;
  threats_detected: number;
  reports_generated: number;
  recent_scans: RecentScan[];
  module_activity: ModuleActivity[];
}

interface UseDashboardStatsReturn {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const REFRESH_INTERVAL_MS = 30_000;

export function useDashboardStats(): UseDashboardStatsReturn {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const data = await ApiClient.get<DashboardStats>('/api/stats/dashboard');
      setStats(data);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Failed to fetch dashboard statistics';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();

    intervalRef.current = setInterval(() => {
      void fetchStats();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStats]);

  const refetch = useCallback(() => {
    setLoading(true);
    void fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch };
}

export type { DashboardStats, RecentScan, ModuleActivity };
