import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn('flex flex-col items-center justify-center py-16 px-8 text-center', className)}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent-dim"
      >
        <Icon className="h-10 w-10 text-accent/60" />
      </motion.div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="max-w-sm text-sm text-text-muted leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/20 px-5 py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent/30"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
