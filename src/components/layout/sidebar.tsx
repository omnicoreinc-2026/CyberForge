import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMode } from '@/contexts/mode-context';
import { MODE_CONFIG } from '@/config/mode-data';
import { ModeToggle } from '@/components/shared/mode-toggle';

const sidebarVariants = {
  expanded: { width: 240 },
  collapsed: { width: 72 },
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { mode } = useMode();
  const navItems = MODE_CONFIG[mode].navItems;

  return (
    <motion.aside
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="glass-card flex h-full flex-col rounded-none border-y-0 border-l-0"
    >
      {/* Navigation items */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                'hover:bg-accent-dim',
                isActive
                  ? 'bg-accent-dim text-accent shadow-[inset_0_0_0_1px_var(--color-accent-dim)]'
                  : 'text-text-secondary hover:text-text-primary',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'h-5 w-5 shrink-0 transition-colors',
                    isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary',
                  )}
                />
                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="truncate whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Mode toggle */}
      <div className="border-t border-border px-3 py-2">
        <ModeToggle collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-border px-3 py-3">
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm',
            'text-text-muted transition-colors hover:bg-accent-dim hover:text-text-secondary',
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="truncate whitespace-nowrap"
              >
                Collapse
              </motion.span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
