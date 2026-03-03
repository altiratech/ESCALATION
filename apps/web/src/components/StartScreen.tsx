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
const timerModes = [
  {
    id: 'standard',
    label: 'Standard',
    detail: 'Authored beat windows with full pressure.'
  },
  {
    id: 'relaxed',
    label: 'Relaxed',
    detail: '1.5x countdown windows and fewer forced snaps.'
  },
  {
    id: 'off',
    label: 'Off',
    detail: 'No countdown. Use explicit Take No Action.'
  }
] as const;

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
    () => reference.adversaryProfiles.find((entry) => entry.id === selectedScenario?.adversaryProfileId),
    [reference.adversaryProfiles, selectedScenario?.adversaryProfileId]
  );
  const beatCount = selectedScenario?.beats.length ?? 0;
  const timedBeatCount = selectedScenario?.beats.filter((beat) => beat.decisionWindow).length ?? 0;
  const profile = selectedAdversaryProfile ?? null;

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
    <main className="mx-auto flex min-h-screen w-full max-w-[1400px] items-center px-4 py-6 sm:px-6 lg:px-8">
      <section className="card grid w-full grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="label">Escalation // Pre-Mission Dossier</p>
            <h1 className="font-display text-4xl leading-none text-accent sm:text-5xl">WARGAMES</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-textMuted">
              Ten turns, hidden state, and rival adaptation under uncertainty. Every run is deterministic to its seed and
              every branch is attributable in post-game causality review.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card bg-panelRaised/70 p-3">
              <p className="label">Episode Length</p>
              <p className="mt-2 font-display text-2xl text-textMain">{selectedScenario?.maxTurns ?? 0} turns</p>
            </div>
            <div className="card bg-panelRaised/70 p-3">
              <p className="label">Beat Graph</p>
              <p className="mt-2 font-display text-2xl text-textMain">{beatCount} beats</p>
            </div>
            <div className="card bg-panelRaised/70 p-3">
              <p className="label">Timed Beats</p>
              <p className="mt-2 font-display text-2xl text-textMain">{timedBeatCount}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="label">Commander Codename</span>
              <input
                className="rounded-lg border border-borderTone bg-panelRaised/80 px-3 py-2.5 text-textMain focus:border-accent focus:outline-none"
                value={codename}
                onChange={(event) => setCodename(event.target.value)}
                maxLength={40}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="label">Deterministic Seed</span>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border border-borderTone bg-panelRaised/80 px-3 py-2.5 text-textMain focus:border-accent focus:outline-none"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg border border-borderTone px-3 py-2 text-xs uppercase tracking-[0.12em] text-textMuted transition hover:border-accent hover:text-textMain"
                  onClick={() => setSeed(randomSeed())}
                >
                  Reseed
                </button>
              </div>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="label">Scenario</span>
              <select
                className="rounded-lg border border-borderTone bg-panelRaised/80 px-3 py-2.5 text-textMain focus:border-accent focus:outline-none"
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
              <div className="rounded-lg border border-borderTone bg-panelRaised/80 px-3 py-2.5 text-textMain">
                {selectedAdversaryProfile?.name ?? 'Scenario-embedded'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="label">Timer Mode</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {timerModes.map((mode) => {
                const active = timerMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    className={`rounded-lg border px-3 py-3 text-left transition ${
                      active
                        ? 'border-accent bg-accent/15 text-textMain'
                        : 'border-borderTone bg-panelRaised/80 text-textMuted hover:border-accent/60 hover:text-textMain'
                    }`}
                    onClick={() => setTimerMode(mode.id)}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em]">{mode.label}</p>
                    <p className="mt-1 text-[0.72rem] leading-relaxed">{mode.detail}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="rounded-lg border border-warning/60 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p> : null}

          <button
            type="button"
            className="rounded-lg border border-accent bg-accent/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleStart}
            disabled={loading || !codename.trim() || !scenarioId}
          >
            {loading ? 'Initializing Theater...' : 'Begin Episode'}
          </button>
        </div>

        <aside className="space-y-4">
          <article className="card h-full bg-panelRaised/75 p-5">
            <p className="label">Scenario Brief</p>
            <h2 className="mt-3 font-display text-2xl text-textMain">{selectedScenario?.name ?? 'No scenario selected'}</h2>
            <p className="mt-3 text-sm leading-relaxed text-textMuted">
              {selectedScenario?.briefing ?? 'Select a scenario to review strategic role and escalation context.'}
            </p>
            <div className="mt-4 grid gap-2 text-xs text-textMuted">
              <div className="flex items-center justify-between rounded-md border border-borderTone/70 bg-surface/35 px-2 py-1.5">
                <span>Role</span>
                <span className="text-textMain">{selectedScenario?.role ?? 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-borderTone/70 bg-surface/35 px-2 py-1.5">
                <span>Environment</span>
                <span className="text-textMain">{selectedScenario?.environment ?? 'N/A'}</span>
              </div>
            </div>
          </article>

          <article className="card bg-panelRaised/75 p-5">
            <p className="label">Adversary Model</p>
            <h3 className="mt-3 font-display text-xl text-textMain">{profile?.name ?? 'Scenario-embedded profile'}</h3>
            <p className="mt-2 text-sm leading-relaxed text-textMuted">
              {profile?.description ?? 'Rival behavior is fixed by scenario and not selectable at runtime.'}
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-textMuted">
              <li>Risk Tolerance: {Math.round((profile?.riskTolerance ?? 0) * 100)}%</li>
              <li>Escalation Threshold: {Math.round((profile?.escalationThreshold ?? 0) * 100)}%</li>
              <li>Covert Preference: {Math.round((profile?.covertPreference ?? 0) * 100)}%</li>
              <li>Ego Sensitivity: {Math.round((profile?.egoSensitivity ?? 0) * 100)}%</li>
            </ul>
          </article>
        </aside>
      </section>
    </main>
  );
};
