import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { StatusBar } from './status-bar';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ApiClient } from '@/lib/api-client';

export function Layout() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await ApiClient.fetchHealth();
        setBackendConnected(true);
      } catch {
        setBackendConnected(false);
      }
    };

    const checkAi = async () => {
      try {
        const settings = await ApiClient.get<Record<string, string>>('/api/settings/app');
        const provider = settings?.ai_provider;
        setAiConfigured(!!provider && provider !== 'none');
      } catch {
        setAiConfigured(false);
      }
    };

    void checkHealth();
    void checkAi();
    intervalRef.current = setInterval(() => { void checkHealth(); }, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header backendConnected={backendConnected} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        <StatusBar backendConnected={backendConnected} aiConfigured={aiConfigured} />
      </div>
    </div>
  );
}
