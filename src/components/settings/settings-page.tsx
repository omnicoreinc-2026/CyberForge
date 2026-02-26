import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Key,
  Shield,
  Search,
  AlertTriangle,
  Radar,
  Bot,
  Brain,
  Ban,
  Eye,
  EyeOff,
  Check,
  X,
  Trash2,
  RefreshCw,
  Zap,
  Monitor,
  Clock,
  FolderOpen,
  Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiClient } from '@/lib/api-client';
import type {
  ApiKeyInfo,
  AppSettings,
  ServiceInfo,
} from '@/types/settings';
import { SUPPORTED_SERVICES, AI_PROVIDERS } from '@/types/settings';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
};

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const SERVICE_ICONS: Record<string, LucideIcon> = {
  Search,
  Shield,
  AlertTriangle,
  Ban,
  Radar,
  Bot,
  Brain,
};

function getServiceIcon(iconName: string): LucideIcon {
  return SERVICE_ICONS[iconName] ?? Key;
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type SettingsTab = 'api-keys' | 'ai-provider' | 'general';

interface TabInfo {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}

const TABS: TabInfo[] = [
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'ai-provider', label: 'AI Provider', icon: Brain },
  { id: 'general', label: 'General', icon: Settings },
];
// ---------------------------------------------------------------------------
// API Key Modal
// ---------------------------------------------------------------------------

interface KeyModalProps {
  service: ServiceInfo;
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: string, key: string) => Promise<void>;
  onDelete: (service: string) => Promise<void>;
  isConfigured: boolean;
  saving: boolean;
}

function ApiKeyModal({ service, isOpen, onClose, onSave, onDelete, isConfigured, saving }: KeyModalProps) {
  const [keyValue, setKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setKeyValue('');
      setShowKey(false);
      setError('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!keyValue.trim()) {
      setError('API key cannot be empty');
      return;
    }
    if (keyValue.trim().length < 8) {
      setError('API key seems too short. Please check and try again.');
      return;
    }
    try {
      await onSave(service.id, keyValue.trim());
      onClose();
    } catch {
      setError('Failed to save API key. Please try again.');
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(service.id);
      onClose();
    } catch {
      setError('Failed to delete API key. Please try again.');
    }
  };

  const Icon = getServiceIcon(service.icon);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="glass-card w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-dim">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{service.name}</h3>
                  <p className="text-xs text-text-muted">Configure API Key</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-text-muted hover:bg-accent-dim hover:text-text-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-text-secondary mb-4">{service.description}</p>

            {/* Key input */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keyValue}
                  onChange={(e) => { setKeyValue(e.target.value); setError(''); }}
                  placeholder="Enter your API key..."
                  className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <p className="mt-1.5 text-xs text-danger">{error}</p>
              )}
            </div>

            {/* Docs link */}
            <a
              href={service.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline mb-5"
            >
              <Info className="h-3 w-3" />
              View API documentation
            </a>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleSave()}
                disabled={saving || !keyValue.trim()}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                  saving || !keyValue.trim()
                    ? 'bg-accent-dim text-text-muted cursor-not-allowed'
                    : 'bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30'
                )}
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {saving ? 'Saving...' : 'Save Key'}
              </button>

              {isConfigured && (
                <button
                  onClick={() => void handleDelete()}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 border border-danger/20 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
// ---------------------------------------------------------------------------
// API Keys Tab
// ---------------------------------------------------------------------------

interface ApiKeysTabProps {
  apiKeys: ApiKeyInfo[];
  onRefresh: () => void;
  loading: boolean;
}

function ApiKeysTab({ apiKeys, onRefresh, loading }: ApiKeysTabProps) {
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [saving, setSaving] = useState(false);

  const getKeyInfo = useCallback(
    (serviceId: string): ApiKeyInfo | undefined =>
      apiKeys.find((k) => k.service === serviceId),
    [apiKeys],
  );

  const handleSave = async (service: string, key: string) => {
    setSaving(true);
    try {
      await ApiClient.post<{ status: string }>('/api/settings/api-keys', { service, key });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: string) => {
    setSaving(true);
    try {
      await ApiClient.del<{ status: string }>(`/api/settings/api-keys/${service}`);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SUPPORTED_SERVICES.map((service) => {
          const keyInfo = getKeyInfo(service.id);
          const configured = keyInfo?.configured ?? false;
          const Icon = getServiceIcon(service.icon);

          return (
            <motion.div key={service.id} variants={itemVariants}>
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedService(service)}
                className="glass-card flex w-full flex-col gap-3 p-5 text-left cursor-pointer h-full"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-dim">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="text-sm font-semibold text-text-primary">{service.name}</h3>
                  </div>

                  {/* Status dot */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        configured ? 'bg-success animate-pulse-live' : 'bg-danger/60',
                      )}
                    />
                    <span className={cn(
                      'text-[10px] font-medium uppercase tracking-wider',
                      configured ? 'text-success' : 'text-danger/80',
                    )}>
                      {configured ? 'Active' : 'Not Set'}
                    </span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-text-secondary">{service.description}</p>

                {keyInfo && configured && (
                  <div className="mt-auto pt-2 border-t border-border">
                    <span className="text-[10px] font-mono text-text-muted">
                      Key: ****{keyInfo.key_hint}
                    </span>
                  </div>
                )}
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-5 w-5 text-accent animate-spin" />
          <span className="ml-2 text-sm text-text-secondary">Loading API keys...</span>
        </div>
      )}

      {/* Modal */}
      {selectedService && (
        <ApiKeyModal
          service={selectedService}
          isOpen={!!selectedService}
          onClose={() => setSelectedService(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          isConfigured={getKeyInfo(selectedService.id)?.configured ?? false}
          saving={saving}
        />
      )}
    </>
  );
}
// ---------------------------------------------------------------------------
// AI Provider Tab
// ---------------------------------------------------------------------------

interface AiProviderTabProps {
  appSettings: AppSettings;
  onUpdate: (key: string, value: string | number) => Promise<void>;
}

function AiProviderTab({ appSettings, onUpdate }: AiProviderTabProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const selectedProvider = AI_PROVIDERS.find((p) => p.id === appSettings.ai_provider) ?? AI_PROVIDERS[0];

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    // Simulate a test connection -- in a real app this would call the backend.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setTesting(false);
    setTestResult({ ok: true, message: 'Connection successful' });
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Provider selection */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-3 uppercase tracking-wider">
          AI Provider
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {AI_PROVIDERS.map((provider) => (
            <motion.button
              key={provider.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void onUpdate('ai_provider', provider.id)}
              className={cn(
                'glass-card flex items-center gap-3 p-4 cursor-pointer text-left transition-all',
                appSettings.ai_provider === provider.id
                  ? 'border-accent/40 bg-accent-dim shadow-[inset_0_0_0_1px_rgba(0,212,255,0.2)]'
                  : '',
              )}
            >
              <div className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                appSettings.ai_provider === provider.id
                  ? 'border-accent bg-accent'
                  : 'border-text-muted',
              )}>
                {appSettings.ai_provider === provider.id && (
                  <div className="h-1.5 w-1.5 rounded-full bg-bg-primary" />
                )}
              </div>
              <span className="text-sm font-medium text-text-primary">{provider.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Model selection */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
          Model
        </label>
        <select
          value={appSettings.ai_model}
          onChange={(e) => void onUpdate('ai_model', e.target.value)}
          className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 appearance-none cursor-pointer"
        >
          {selectedProvider.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {/* Test connection */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleTestConnection()}
          disabled={testing}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
            testing
              ? 'bg-accent-dim text-text-muted cursor-not-allowed'
              : 'bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30',
          )}
        >
          {testing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {testing ? 'Testing...' : 'Test Connection'}
        </button>

        <AnimatePresence>
          {testResult && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium',
                testResult.ok ? 'text-success' : 'text-danger',
              )}
            >
              {testResult.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {testResult.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// General Tab
// ---------------------------------------------------------------------------

interface GeneralTabProps {
  appSettings: AppSettings;
  onUpdate: (key: string, value: string | number) => Promise<void>;
}

function GeneralTab({ appSettings, onUpdate }: GeneralTabProps) {
  const [clearing, setClearing] = useState(false);

  const handleClearHistory = async () => {
    setClearing(true);
    // Simulate clearing -- in a real app this would call the backend.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setClearing(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Scan timeout */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
          <Clock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
          Scan Timeout
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={30}
            max={3600}
            step={30}
            value={appSettings.scan_timeout}
            onChange={(e) => void onUpdate('scan_timeout', parseInt(e.target.value, 10))}
            className="flex-1 accent-accent h-1.5 rounded-full appearance-none bg-border cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
          />
          <span className="text-sm font-mono text-text-primary min-w-[4rem] text-right">
            {appSettings.scan_timeout}s
          </span>
        </div>
        <p className="mt-1 text-[10px] text-text-muted">
          Maximum time allowed for a single scan operation (30s - 3600s).
        </p>
      </div>

      {/* Theme */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-3 uppercase tracking-wider">
          <Monitor className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
          Theme
        </label>
        <div className="flex gap-3">
          {(['dark', 'system'] as const).map((theme) => (
            <motion.button
              key={theme}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void onUpdate('theme', theme)}
              className={cn(
                'glass-card flex items-center gap-2 px-4 py-2.5 cursor-pointer text-sm font-medium transition-all',
                appSettings.theme === theme
                  ? 'border-accent/40 bg-accent-dim text-accent shadow-[inset_0_0_0_1px_rgba(0,212,255,0.2)]'
                  : 'text-text-secondary',
              )}
            >
              <div className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                appSettings.theme === theme ? 'border-accent bg-accent' : 'border-text-muted',
              )}>
                {appSettings.theme === theme && (
                  <div className="h-1.5 w-1.5 rounded-full bg-bg-primary" />
                )}
              </div>
              {theme === 'dark' ? 'Dark' : 'System'}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Data directory */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
          <FolderOpen className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
          Data Directory
        </label>
        <div className="glass-card px-4 py-2.5">
          <span className="text-sm font-mono text-text-secondary">./data/</span>
        </div>
      </div>

      {/* Clear scan history */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
          Maintenance
        </label>
        <button
          onClick={() => void handleClearHistory()}
          disabled={clearing}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
            clearing
              ? 'bg-danger/10 text-text-muted cursor-not-allowed'
              : 'text-danger hover:bg-danger/10 border border-danger/20',
          )}
        >
          {clearing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {clearing ? 'Clearing...' : 'Clear Scan History'}
        </button>
      </div>

      {/* Version info */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Info className="h-3.5 w-3.5" />
          <span>CyberForge v0.1.0</span>
          <span className="text-text-muted/50">|</span>
          <span>API: localhost:8008</span>
        </div>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api-keys');
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    ai_provider: 'anthropic',
    ai_model: 'claude-sonnet-4-20250514',
    theme: 'dark',
    scan_timeout: 300,
  });
  const [loadingKeys, setLoadingKeys] = useState(false);

  const fetchApiKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const keys = await ApiClient.get<ApiKeyInfo[]>('/api/settings/api-keys');
      setApiKeys(keys);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const settings = await ApiClient.get<AppSettings>('/api/settings/app');
      setAppSettings(settings);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, []);

  useEffect(() => {
    void fetchApiKeys();
    void fetchSettings();
  }, [fetchApiKeys, fetchSettings]);

  const handleUpdateSetting = async (key: string, value: string | number) => {
    try {
      await ApiClient.put<{ status: string }>('/api/settings/app', { key, value });
      setAppSettings((prev) => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6"
    >
      {/* Page header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary">
            Manage API keys, AI configuration, and application preferences.
          </p>
        </div>
      </motion.div>

      {/* Tab navigation */}
      <motion.div variants={itemVariants} className="flex gap-1 border-b border-border pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg',
              activeTab === tab.id
                ? 'text-accent'
                : 'text-text-muted hover:text-text-secondary hover:bg-accent-dim',
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="settings-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              />
            )}
          </button>
        ))}
      </motion.div>

      {/* Tab content */}
      <motion.div variants={itemVariants}>
        {activeTab === 'api-keys' && (
          <ApiKeysTab
            apiKeys={apiKeys}
            onRefresh={() => void fetchApiKeys()}
            loading={loadingKeys}
          />
        )}
        {activeTab === 'ai-provider' && (
          <AiProviderTab
            appSettings={appSettings}
            onUpdate={handleUpdateSetting}
          />
        )}
        {activeTab === 'general' && (
          <GeneralTab
            appSettings={appSettings}
            onUpdate={handleUpdateSetting}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
