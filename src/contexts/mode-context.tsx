import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type AppMode = 'forge' | 'lancer';

interface ModeContextValue {
  mode: AppMode;
  toggleMode: () => void;
  isForge: boolean;
  isLancer: boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const STORAGE_KEY = 'cyberforge_app_mode';

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'lancer' ? 'lancer' : 'forge';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode);
    localStorage.setItem(STORAGE_KEY, mode);
    document.title = mode === 'forge'
      ? 'CyberForge Command Center'
      : 'CyberLancer Strike Platform';
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'forge' ? 'lancer' : 'forge'));
  }, []);

  return (
    <ModeContext.Provider value={{ mode, toggleMode, isForge: mode === 'forge', isLancer: mode === 'lancer' }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
