import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/layout';
import { DashboardPage } from '@/pages/dashboard';
import { ReconPage } from '@/pages/recon';
import { OsintPage } from '@/pages/osint';
import { VulnPage } from '@/pages/vuln';
import { SettingsPage } from '@/components/settings/settings-page';

function PlaceholderPage({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <h1 className="text-2xl font-bold text-text-primary">{name}</h1>
      <p className="text-sm text-text-secondary">This module is under construction.</p>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="recon" element={<ReconPage />} />
        <Route path="osint" element={<OsintPage />} />
        <Route path="vuln" element={<VulnPage />} />
        <Route path="threat" element={<PlaceholderPage name="Threat Intelligence" />} />
        <Route path="logs" element={<PlaceholderPage name="Log Analyzer" />} />
        <Route path="reports" element={<PlaceholderPage name="Reports" />} />
        <Route path="ai" element={<PlaceholderPage name="AI Assistant" />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
