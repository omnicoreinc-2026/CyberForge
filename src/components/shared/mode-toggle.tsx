import { motion } from 'framer-motion';
import { Shield, Crosshair } from 'lucide-react';
import { useMode } from '@/contexts/mode-context';
import { cn } from '@/lib/utils';

interface ModeToggleProps {
  collapsed: boolean;
}

export function ModeToggle({ collapsed }: ModeToggleProps) {
  const { mode, toggleMode, isForge } = useMode();

  return (
    <button
      onClick={toggleMode}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm',
        'transition-all duration-300',
        isForge
          ? 'text-[#00d4ff] hover:bg-[rgba(0,212,255,0.1)]'
          : 'text-[#ff3333] hover:bg-[rgba(255,51,51,0.1)]',
      )}
      title={isForge ? 'Switch to CyberLancer (Offensive)' : 'Switch to CyberForge (Defensive)'}
    >
      <motion.div
        key={mode}
        initial={{ rotate: -180, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {isForge ? (
          <Shield className="h-5 w-5 shrink-0" />
        ) : (
          <Crosshair className="h-5 w-5 shrink-0" />
        )}
      </motion.div>
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          className="truncate whitespace-nowrap text-xs font-bold uppercase tracking-wider"
        >
          {isForge ? 'Forge Mode' : 'Lancer Mode'}
        </motion.span>
      )}
    </button>
  );
}
