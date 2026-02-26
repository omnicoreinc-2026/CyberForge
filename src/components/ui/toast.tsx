import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToastContext, useToastState, type Toast, type ToastType } from '@/hooks/use-toast';

const ICON_MAP: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP: Record<ToastType, string> = {
  success: 'border-l-[#22c55e]',
  error: 'border-l-[#ef4444]',
  warning: 'border-l-[#f59e0b]',
  info: 'border-l-[#3b82f6]',
};

const ICON_COLOR_MAP: Record<ToastType, string> = {
  success: 'text-[#22c55e]',
  error: 'text-[#ef4444]',
  warning: 'text-[#f59e0b]',
  info: 'text-[#3b82f6]',
};

const BAR_COLOR_MAP: Record<ToastType, string> = {
  success: 'bg-[#22c55e]',
  error: 'bg-[#ef4444]',
  warning: 'bg-[#f59e0b]',
  info: 'bg-[#3b82f6]',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const Icon = ICON_MAP[toast.type];

  useEffect(() => {
    const start = toast.createdAt;
    const end = start + toast.duration;
    let raf: number;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, ((end - now) / toast.duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        onRemove(toast.id);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [toast, onRemove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-bg-card backdrop-blur-xl',
        'border-l-[3px] shadow-lg shadow-black/30',
        'w-80',
        COLOR_MAP[toast.type],
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', ICON_COLOR_MAP[toast.type])} />
        <p className="flex-1 text-sm text-text-primary leading-snug">{toast.message}</p>
        <button
          onClick={() => onRemove(toast.id)}
          className="shrink-0 rounded p-0.5 text-text-muted hover:text-text-secondary transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="h-0.5 w-full bg-border">
        <div
          className={cn('h-full transition-none', BAR_COLOR_MAP[toast.type])}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, addToast, removeToast } = useToastState();

  return (
    <ToastContext value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext>
  );
}
