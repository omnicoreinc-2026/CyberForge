import { Link } from 'react-router-dom';
import { Search, Bell, Settings, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  backendConnected?: boolean;
}

export function Header({ backendConnected = false }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg-secondary/50 px-6">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-wide">
          <span className="text-accent" style={{ textShadow: '0 0 20px rgba(0, 212, 255, 0.5)' }}>
            Cyber
          </span>
          <span className="text-text-primary">Forge</span>
        </h1>
      </div>

      {/* Center: Global search */}
      <div className="flex max-w-md flex-1 items-center justify-center px-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search targets, CVEs, IOCs..."
            className={cn(
              'w-full rounded-lg border border-border bg-bg-primary/50 py-2 pl-10 pr-4',
              'text-sm text-text-primary placeholder:text-text-muted',
              'outline-none transition-colors',
              'focus:border-accent/50 focus:ring-1 focus:ring-accent/20',
            )}
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
