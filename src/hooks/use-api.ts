import { useState, useEffect, useCallback } from 'react';
import { ApiClient, ApiClientError } from '@/lib/api-client';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => void;
}

export function useApi<T>(endpoint: string): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await ApiClient.get<T>(endpoint);
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'An unexpected error occurred';
      setState({ data: null, loading: false, error: message });
    }
  }, [endpoint]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch,
  };
}
