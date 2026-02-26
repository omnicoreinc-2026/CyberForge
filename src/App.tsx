import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/layout';
import { DashboardPage } from '@/pages/dashboard';
import { ReconPage } from '@/pages/recon';
import { OsintPage } from '@/pages/osint';
import { VulnPage } from '@/pages/vuln';
import { SettingsPage } from '@/components/settings/settings-page';
import { LogsPage } from '@/pages/logs';
import { AIPage } from "@/pages/ai";
import { ThreatPage } from "@/pages/threat";
import { ReportsPage } from "@/pages/reports";


export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="recon" element={<ReconPage />} />
        <Route path="osint" element={<OsintPage />} />
        <Route path="vuln" element={<VulnPage />} />
        <Route path="threat" element={<ThreatPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="ai" element={<AIPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
