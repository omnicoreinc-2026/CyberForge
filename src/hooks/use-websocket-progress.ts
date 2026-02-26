import { useState, useEffect, useRef, useCallback } from 'react';
import type { ScanStatus } from '@/types/scan';

interface WebSocketProgressState {
  progress: number;
  status: ScanStatus;
  currentTask: string;
  connected: boolean;
}

const WS_BASE_URL = 'ws://localhost:8008';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useWebSocketProgress(scanId: string | null): WebSocketProgressState {
  const [state, setState] = useState<WebSocketProgressState>({
    progress: 0,
    status: 'idle',
    currentTask: '',
    connected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!scanId) {
      cleanup();
      setState({
        progress: 0,
        status: 'idle',
        currentTask: '',
        connected: false,
      });
      return;
    }

    function connect() {
      cleanup();

      const ws = new WebSocket(`${WS_BASE_URL}/ws/scan/${scanId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setState((prev) => ({ ...prev, connected: true }));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as {
            progress?: number;
            status?: ScanStatus;
            current_task?: string;
          };
          setState((prev) => ({
            ...prev,
            progress: data.progress ?? prev.progress,
            status: data.status ?? prev.status,
            currentTask: data.current_task ?? prev.currentTask,
          }));
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, connected: false }));
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return cleanup;
  }, [scanId, cleanup]);

  return state;
}
