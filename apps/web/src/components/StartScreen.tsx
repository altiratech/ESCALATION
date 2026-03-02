import { useMemo, useState } from 'react';

import type { BootstrapPayload } from '@wargames/shared-types';

interface StartScreenProps {
  reference: BootstrapPayload;
  loading: boolean;
  error: string | null;
  onStart: (input: {
    codename: string;
    scenarioId: string;
    seed?: string;
    timerMode: 'standard' | 'relaxed' | 'off';
  }) => Promise<void>;
}

const randomSeed = (): string => Math.random().toString(36).slice(2, 10).toUpperCase();

export const StartScreen = ({ reference, loading, error, onStart }: StartScreenProps) => {
  const [codename, setCodename] = useState('SABLE-ONE');
  const [seed, setSeed] = useState(randomSeed());

  const defaultScenario = reference.scenarios[0]?.id ?? '';

  const [scenarioId, setScenarioId] = useState(defaultScenario);
  const [timerMode, setTimerMode] = useState<'standard' | 'relaxed' | 'off'>('standard');

  const selectedScenario = useMemo(
    () => reference.scenarios.find((entry) => entry.id === scenarioId),
    [reference.scenarios, scenarioId]
  );
  const selectedAdversaryProfile = useMemo(
    () => reference.archetypes.find((entry) => entry.id === selectedScenario?.adversaryProfileId),
    [reference.archetypes, selectedScenario?.adversaryProfileId]
  );

  const handleStart = async (): Promise<void> => {
    const payload: {
      codename: string;
      scenarioId: string;
      seed?: string;
      timerMode: 'standard' | 'relaxed' | 'off';
    } = {
      codename,
      scenarioId,
      timerMode
    };

    const normalizedSeed = seed.trim();
    if (normalizedSeed) {
      payload.seed = normalizedSeed;
    }

    await onStart(payload);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-8">
      <section className="card grid w-full grid-cols-1 gap-6 p-7 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <p className="label">ESCALATION // ACTIVE SCENARIO</p>
          <h1 className="font-display text-4xl tracking-wide text-accent">WARGAMES</h1>
          <p className="max-w-xl text-[0.98rem] leading-relaxed text-textMuted">
            You authorize strategy across diplomacy, economy, cyber, covert, force posture, and public messaging.
            Every turn carries measurable tradeoffs under uncertainty.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="label">Codename</span>
              <input
                className="rounded-md border border-borderTone bg-panelRaised px-3 py-2 text-textMain focus:border-accent focus:outline-none"
                value={codename}
                onChange={(event) => setCodename(event.target.value)}
                maxLength={40}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="label">Deterministic Seed</span>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-md border border-borderTone bg-panelRaised px-3 py-2 text-textMain focus:border-accent focus:outline-none"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                />
                <button
                  type="button"
                  className="rounded-md border border-borderTone px-3 py-2 text-xs text-textMuted hover:border-accent hover:text-textMain"
                  onClick={() => setSeed(randomSeed())}
                >
                  Refresh
                </button>
              </div>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="label">Scenario</span>
              <select
                className="rounded-md border border-borderTone bg-panelRaised px-3 py-2 text-textMain focus:border-accent focus:outline-none"
                value={scenarioId}
                onChange={(event) => setScenarioId(event.target.value)}
              >
                {reference.scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-2 text-sm">
              <span className="label">Adversary Profile</span>
              <div className="rounded-md border border-borderTone bg-panelRaised px-3 py-2 text-textMain">
                {selectedAdversaryProfile?.name ?? 'Scenario-embedded'}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="label">Timer Mode</span>
            <select
              className="rounded-md border border-borderTone bg-panelRaised px-3 py-2 text-textMain focus:border-accent focus:outline-none"
              value={timerMode}
              onChange={(event) => setTimerMode(event.target.value as 'standard' | 'relaxed' | 'off')}
            >
              <option value="standard">Standard (authored duration)</option>
              <option value="relaxed">Relaxed (1.5x duration)</option>
              <option value="off">Off (manual no-action only)</option>
            </select>
          </label>

          {error ? <p className="text-sm text-warning">{error}</p> : null}

          <button
            type="button"
            className="mt-2 rounded-md border border-accent bg-accent/10 px-5 py-3 text-sm font-semibold tracking-wide text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleStart}
            disabled={loading || !codename.trim() || !scenarioId}
          >
            {loading ? 'Initializing Theater...' : 'Begin Episode'}
          </button>
        </div>

        <aside className="card bg-panelRaised p-5">
          <p className="label">Adversary Model</p>
          <h2 className="mt-3 font-display text-2xl text-textMain">{selectedAdversaryProfile?.name ?? 'Scenario-embedded profile'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-textMuted">{selectedAdversaryProfile?.description ?? 'Rival behavior is now fixed by scenario and no longer selectable at start.'}</p>
          <ul className="mt-4 space-y-2 text-xs text-textMuted">
            <li>Risk Tolerance: {Math.round((selectedAdversaryProfile?.riskTolerance ?? 0) * 100)}%</li>
            <li>Escalation Threshold: {Math.round((selectedAdversaryProfile?.escalationThreshold ?? 0) * 100)}%</li>
            <li>Covert Preference: {Math.round((selectedAdversaryProfile?.covertPreference ?? 0) * 100)}%</li>
            <li>Ego Sensitivity: {Math.round((selectedAdversaryProfile?.egoSensitivity ?? 0) * 100)}%</li>
          </ul>
        </aside>
      </section>
    </main>
  );
};
