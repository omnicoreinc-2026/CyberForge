import { cn } from '@/lib/utils';
import { useMode } from '@/contexts/mode-context';
import { MODE_CONFIG } from '@/config/mode-data';

interface StatusBarProps {
  backendConnected?: boolean;
  activeScans?: number;
  aiConfigured?: boolean;
}

export function StatusBar({
  backendConnected = false,
  activeScans = 0,
  aiConfigured = false,
}: StatusBarProps) {
  const { mode } = useMode();
  const config = MODE_CONFIG[mode];

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-bg-secondary/30 px-6 text-xs text-text-muted">
      {/* Left: Backend status */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full',
            backendConnected
              ? 'bg-success animate-pulse-live'
              : 'bg-danger',
          )}
        />
        <span>
          Backend: {backendConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Center: Active ops */}
      <div className="flex items-center gap-2">
        <span>{config.activeOpsLabel}: {activeScans}</span>
      </div>

      {/* Right: AI status */}
      <div className="flex items-center gap-2">
        <span>AI: {aiConfigured ? 'Ready' : 'Not configured'}</span>
      </div>
    </footer>
  );
}
