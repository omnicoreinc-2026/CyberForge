import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScanProgressProps {
  progress: number;
  currentTask?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ScanProgress({
  progress,
  currentTask,
  size = 120,
  strokeWidth = 6,
  className,
}: ScanProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg
          width={size}
          height={size}
          className="rotate-[-90deg]"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border"
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-accent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-text-primary font-mono">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
      {currentTask && (
        <p className="text-xs text-text-secondary text-center max-w-[200px] truncate">
          {currentTask}
        </p>
      )}
    </div>
  );
}
