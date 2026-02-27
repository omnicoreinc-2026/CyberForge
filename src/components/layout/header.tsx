import { Link } from 'react-router-dom';
import { Search, Bell, Settings, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMode } from '@/contexts/mode-context';
import { MODE_CONFIG } from '@/config/mode-data';

interface HeaderProps {
  backendConnected?: boolean;
}

export function Header({ backendConnected = false }: HeaderProps) {
  const { mode } = useMode();
  const config = MODE_CONFIG[mode];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg-secondary/50 px-6">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-wide">
          <span className="text-accent" style={{ textShadow: '0 0 20px var(--color-accent-glow)' }}>
            {config.appNamePrefix}
          </span>
          <span className="text-text-primary">{config.appNameSuffix}</span>
        </h1>
      </div>

      {/* Center: Global search */}
      <div className="flex max-w-md flex-1 items-center justify-center px-8">
        <div className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-border bg-bg-primary/50 px-3 py-2',
          'transition-colors focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20',
        )}>
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            type="text"
            placeholder="Search targets, CVEs, IOCs..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <button
          className="relative rounded-lg p-2 text-text-muted transition-colors hover:bg-accent-dim hover:text-text-secondary"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>

        {/* Backend status */}
        <div className="flex items-center gap-2 text-xs">
          {backendConnected ? (
            <>
              <Wifi className="h-4 w-4 text-success" />
              <span className="hidden text-success sm:inline">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-danger" />
              <span className="hidden text-danger sm:inline">Disconnected</span>
            </>
          )}
        </div>

        {/* Settings link */}
        <Link
          to="/settings"
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-accent-dim hover:text-text-secondary"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
