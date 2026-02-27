import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@/styles/globals.css';
import { App } from './App';
import { ToastProvider } from '@/components/ui/toast';
import { SetupWizard, isSetupComplete } from '@/components/onboarding/setup-wizard';
import { ModeProvider } from '@/contexts/mode-context';

function Root() {
  const [setupDone, setSetupDone] = useState(isSetupComplete());

  return (
    <StrictMode>
      <ModeProvider>
        <ToastProvider>
          <BrowserRouter>
            {setupDone ? <App /> : <SetupWizard onComplete={() => setSetupDone(true)} />}
          </BrowserRouter>
        </ToastProvider>
      </ModeProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
