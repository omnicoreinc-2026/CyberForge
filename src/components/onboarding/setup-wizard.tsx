import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Key, Brain, Rocket, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const SETUP_KEY = 'cyberforge_setup_complete';

export function isSetupComplete(): boolean {
  return localStorage.getItem(SETUP_KEY) === 'true';
}

export function markSetupComplete(): void {
  localStorage.setItem(SETUP_KEY, 'true');
}

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
}
function WelcomeStep({ onNext }: StepProps) {
  return (
    <div className="flex flex-col items-center text-center px-4">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-accent/20 border border-accent/30"
      >
        <Shield className="h-12 w-12 text-accent" />
      </motion.div>
      <h2 className="text-3xl font-bold text-text-primary mb-4">Welcome to CyberForge</h2>
      <p className="text-text-secondary max-w-md leading-relaxed mb-10 text-base">
        Your AI-powered cybersecurity command center. Let us help you get set up
        so you can start scanning, analyzing, and protecting.
      </p>
      <button onClick={onNext} className="flex items-center gap-2 rounded-xl bg-accent px-8 py-3 text-sm font-semibold text-bg-primary transition-all hover:bg-accent/90 hover:scale-105">
        Get Started <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ApiKeysStep({ onNext, onBack, onSkip }: StepProps) {
  const [keys, setKeys] = useState({ shodan: '', virustotal: '', otx: '' });

  const handleSave = async () => {
    const entries = Object.entries(keys).filter(([, v]) => v.trim());
    if (entries.length > 0) {
      try {
        for (const [service, key] of entries) {
          await fetch('http://localhost:8008/api/settings/api-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service, api_key: key }),
          });
        }
      } catch {
        // Settings page can handle retries
      }
    }
    onNext();
  };

  return (
    <div className="flex flex-col items-center text-center px-4">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30">
        <Key className="h-8 w-8 text-amber-400" />
      </div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">Connect Your Services</h2>
      <p className="text-text-secondary text-sm mb-8 max-w-md">
        Add API keys for external services. You can always update these in Settings later.
      </p>
      <div className="w-full max-w-sm space-y-4 mb-8">
        {[
          { id: 'shodan', label: 'Shodan', placeholder: 'Shodan API key' },
          { id: 'virustotal', label: 'VirusTotal', placeholder: 'VirusTotal API key' },
          { id: 'otx', label: 'AlienVault OTX', placeholder: 'OTX API key' },
        ].map((svc) => (
          <div key={svc.id} className="text-left">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">{svc.label}</label>
            <input
              type="password"
              placeholder={svc.placeholder}
              value={keys[svc.id as keyof typeof keys]}
              onChange={(e) => setKeys((p) => ({ ...p, [svc.id]: e.target.value }))}
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm text-text-muted hover:text-text-secondary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button onClick={onSkip} className="rounded-lg px-4 py-2.5 text-sm text-text-muted hover:text-text-secondary transition-colors">
          Skip for now
        </button>
        <button onClick={handleSave} className="flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-bg-primary transition-all hover:bg-accent/90">
          Save & Continue <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AiStep({ onNext, onBack }: StepProps) {
  const [provider, setProvider] = useState('anthropic');

  const handleSave = async () => {
    try {
      await fetch('http://localhost:8008/api/settings/app', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_provider: provider }),
      });
    } catch {
      // Settings page can handle retries
    }
    onNext();
  };

  const providers = [
    { id: 'anthropic', name: 'Claude (Anthropic)', desc: 'Best for security analysis' },
    { id: 'openai', name: 'GPT (OpenAI)', desc: 'Strong general reasoning' },
    { id: 'ollama', name: 'Ollama (Local)', desc: 'Private, offline capable' },
  ];

  return (
    <div className="flex flex-col items-center text-center px-4">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20 border border-purple-500/30">
        <Brain className="h-8 w-8 text-purple-400" />
      </div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">Choose AI Provider</h2>
      <p className="text-text-secondary text-sm mb-8 max-w-md">
        Select which AI model powers your security assistant and analysis.
      </p>
      <div className="w-full max-w-sm space-y-3 mb-8">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-all',
              provider === p.id
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-border bg-bg-card text-text-secondary hover:border-border-hover'
            )}
          >
            <div className={cn('h-3 w-3 rounded-full border-2 shrink-0', provider === p.id ? 'border-accent bg-accent' : 'border-text-muted')} />
            <div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-text-muted mt-0.5">{p.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm text-text-muted hover:text-text-secondary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button onClick={handleSave} className="flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-bg-primary transition-all hover:bg-accent/90">
          Continue <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ReadyStep({ onNext }: StepProps) {
  const handleFinish = () => {
    markSetupComplete();
    onNext();
  };

  return (
    <div className="flex flex-col items-center text-center px-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 border border-green-500/30"
      >
        <Check className="h-10 w-10 text-green-400" />
      </motion.div>
      <h2 className="text-3xl font-bold text-text-primary mb-4">You are All Set!</h2>
      <p className="text-text-secondary max-w-md leading-relaxed mb-10 text-base">
        CyberForge is ready. Start with a recon scan, check threat intel, or ask the AI assistant for guidance.
      </p>
      <button onClick={handleFinish} className="flex items-center gap-2 rounded-xl bg-accent px-8 py-3 text-sm font-semibold text-bg-primary transition-all hover:bg-accent/90 hover:scale-105">
        Launch CyberForge <Rocket className="h-4 w-4" />
      </button>
    </div>
  );
}

const steps = [
  { id: 'welcome', component: WelcomeStep },
  { id: 'api-keys', component: ApiKeysStep },
  { id: 'ai', component: AiStep },
  { id: 'ready', component: ReadyStep },
];

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      onComplete();
    }
  };

  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));
  const skip = () => goNext();

  const StepComponent = steps[currentStep].component;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-primary">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-border bg-bg-secondary p-10 shadow-2xl"
      >
        {/* Step indicators */}
        <div className="mb-10 flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === currentStep ? 'w-8 bg-accent' : i < currentStep ? 'w-4 bg-accent/50' : 'w-4 bg-border'
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <StepComponent onNext={goNext} onBack={goBack} onSkip={skip} />
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
