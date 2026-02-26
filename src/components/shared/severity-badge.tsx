import { cn } from '@/lib/utils';
import type { Severity } from '@/types/scan';

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

const severityConfig: Record<Severity, { label: string; colorClass: string }> = {
  critical: {
    label: 'Critical',
    colorClass: 'bg-critical/20 text-critical border-critical/30',
  },
  high: {
    label: 'High',
    colorClass: 'bg-high/20 text-high border-high/30',
  },
  medium: {
    label: 'Medium',
    colorClass: 'bg-medium/20 text-medium border-medium/30',
  },
  low: {
    label: 'Low',
    colorClass: 'bg-low/20 text-low border-low/30',
  },
  info: {
    label: 'Info',
    colorClass: 'bg-info/20 text-info border-info/30',
  },
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.colorClass,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
