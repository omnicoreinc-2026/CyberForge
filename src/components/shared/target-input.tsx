import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';

type TargetType = 'ip' | 'domain' | 'url' | 'hash' | 'unknown';

interface TargetInputProps {
  onScan: (target: string, type: TargetType) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  initialValue?: string;
}

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const DOMAIN_REGEX = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
const URL_REGEX = /^https?:\/\/.+/;
const HASH_REGEX = /^[a-fA-F0-9]{32,128}$/;

function detectTargetType(value: string): TargetType {
  const trimmed = value.trim();
  if (!trimmed) return 'unknown';
  if (IP_REGEX.test(trimmed)) return 'ip';
  if (URL_REGEX.test(trimmed)) return 'url';
  if (HASH_REGEX.test(trimmed)) return 'hash';
  if (DOMAIN_REGEX.test(trimmed)) return 'domain';
  return 'unknown';
}

const typeBadgeConfig: Record<TargetType, { label: string; color: string }> = {
  ip: { label: 'IP', color: 'bg-info/20 text-info' },
  domain: { label: 'Domain', color: 'bg-success/20 text-success' },
  url: { label: 'URL', color: 'bg-warning/20 text-warning' },
  hash: { label: 'Hash', color: 'bg-high/20 text-high' },
  unknown: { label: '', color: '' },
};

export function TargetInput({
  onScan,
  placeholder = 'Enter IP, domain, URL, or hash...',
  className,
  disabled = false,
  initialValue = '',
}: TargetInputProps) {
  const [value, setValue] = useState(initialValue);

  const targetType = useMemo(() => detectTargetType(value), [value]);

  const handleScan = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onScan(trimmed, targetType);
  }, [value, targetType, onScan]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleScan();
      }
    },
    [handleScan],
  );

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5 pr-20',
            'text-sm text-text-primary placeholder:text-text-muted',
            'outline-none transition-colors',
            'focus:border-accent focus:ring-1 focus:ring-accent/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        {targetType !== 'unknown' && value.trim() && (
          <span
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs font-medium',
              typeBadgeConfig[targetType].color,
            )}
          >
            {typeBadgeConfig[targetType].label}
          </span>
        )}
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleScan}
        disabled={disabled || !value.trim()}
        className={cn(
          'flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5',
          'text-sm font-medium text-bg-primary',
          'transition-opacity',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover-glow-accent',
        )}
      >
        <Crosshair className="h-4 w-4" />
        Scan
      </motion.button>
    </div>
  );
}
