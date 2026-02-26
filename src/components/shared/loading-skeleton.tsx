import { cn } from '@/lib/utils';

type SkeletonVariant = 'text' | 'card' | 'circle' | 'button';

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  className?: string;
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded',
  card: 'h-32 w-full rounded-xl',
  circle: 'h-10 w-10 rounded-full',
  button: 'h-10 w-28 rounded-lg',
};

export function LoadingSkeleton({ variant = 'text', width, height, className }: LoadingSkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-bg-secondary',
        VARIANT_CLASSES[variant],
        className,
      )}
      style={{ width, height }}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function SkeletonGroup({ count = 3, variant = 'text' }: { count?: number; variant?: SkeletonVariant }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <LoadingSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}
