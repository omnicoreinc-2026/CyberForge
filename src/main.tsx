import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@/styles/globals.css';
import { App } from './App';
import { ToastProvider } from '@/components/ui/toast';
import { SetupWizard, isSetupComplete } from '@/components/onboarding/setup-wizard';

function Root() {
  const [setupDone, setSetupDone] = useState(isSetupComplete());

  return (
    <StrictMode>
      <ToastProvider>
        <BrowserRouter>
          {setupDone ? <App /> : <SetupWizard onComplete={() => setSetupDone(true)} />}
        </BrowserRouter>
      </ToastProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
