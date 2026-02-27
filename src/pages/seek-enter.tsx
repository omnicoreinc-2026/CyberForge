import { useState } from 'react';
import { motion } from 'framer-motion';
import { Radar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeekPanel } from '@/components/seek-enter/seek-panel';
import { ResultsPanel } from '@/components/seek-enter/results-panel';
import { EnterPanel } from '@/components/seek-enter/enter-panel';
import type { SeekResponse, SeekEnterPhase, DiscoveredHost } from '@/types/seek-enter';

const PHASES: SeekEnterPhase[] = ['seek', 'results', 'enter'];

export function SeekEnterPage() {
  const [phase, setPhase] = useState<SeekEnterPhase>('seek');
  const [seekResults, setSeekResults] = useState<SeekResponse | null>(null);
  const [selectedHost, setSelectedHost] = useState<DiscoveredHost | null>(null);
  const [selectedPort, setSelectedPort] = useState(0);
  const [selectedService, setSelectedService] = useState('');
  const [selectedExploitId, setSelectedExploitId] = useState('auto');

  const handleSeekComplete = (results: SeekResponse) => {
    setSeekResults(results);
    setPhase('results');
  };

  const handleEnterSelect = (
    host: DiscoveredHost, port: number, service: string, exploitId: string,
  ) => {
    setSelectedHost(host);
    setSelectedPort(port);
    setSelectedService(service);
    setSelectedExploitId(exploitId);
    setPhase('enter');
  };

  const handleBack = () => {
    if (phase === 'enter') setPhase('results');
    else if (phase === 'results') setPhase('seek');
  };

  const handleReset = () => {
    setPhase('seek');
    setSeekResults(null);
    setSelectedHost(null);
  };

  const phaseIndex = PHASES.indexOf(phase);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radar className="h-7 w-7 text-accent" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Seek & Enter</h1>
            <p className="text-sm text-text-secondary">
              Network discovery and exploitation
            </p>
          </div>
        </div>

        {/* Phase indicator */}
        <div className="flex items-center gap-2">
          {PHASES.map((p, i) => (
            <div key={p} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-border" />}
              <div className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                i === phaseIndex
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : i < phaseIndex
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-border bg-bg-secondary text-text-muted',
              )}>
                <span className="font-mono">{i + 1}</span>
                <span className="capitalize">{p}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active phase panel */}
      <div className="min-h-[500px]">
        {phase === 'seek' && (
          <SeekPanel onComplete={handleSeekComplete} />
        )}
        {phase === 'results' && seekResults && (
          <ResultsPanel
            results={seekResults}
            onEnter={handleEnterSelect}
            onBack={handleBack}
          />
        )}
        {phase === 'enter' && selectedHost && seekResults && (
          <EnterPanel
            scanId={seekResults.scan_id}
            host={selectedHost}
            port={selectedPort}
            service={selectedService}
            exploitId={selectedExploitId}
            onBack={handleBack}
            onReset={handleReset}
          />
        )}
      </div>
    </motion.div>
  );
}
