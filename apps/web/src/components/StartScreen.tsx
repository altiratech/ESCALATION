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
    label: 'Real-Time',
    detail: 'Live decision pressure with active countdown windows.'
  },
  {
    id: 'relaxed',
    label: 'Extended',
    detail: 'More deliberation time without removing urgency.'
  },
  {
    id: 'off',
    label: 'Untimed',
    detail: 'No countdown pressure. You choose when to hold position.'
  }
] as const;

export const StartScreen = ({ reference, loading, error, onStart }: StartScreenProps) => {
  const [codename, setCodename] = useState('SABLE-ONE');
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const defaultScenario = reference.scenarios[0]?.id ?? '';

  const [scenarioId, setScenarioId] = useState(defaultScenario);
  const [timerMode, setTimerMode] = useState<'standard' | 'relaxed' | 'off'>('standard');

  const selectedScenario = useMemo(
    () => reference.scenarios.find((entry) => entry.id === scenarioId),
    [reference.scenarios, scenarioId]
  );
  const startingBeatId = selectedScenario?.startingBeatId;
  const startingBeat = useMemo(() => {
    if (!selectedScenario || !startingBeatId) {
      return null;
    }
    return selectedScenario.beats.find((beat) => beat.id === startingBeatId) ?? null;
  }, [selectedScenario, startingBeatId]);
  const openingSignals = useMemo(
    () => (startingBeat?.headlines ?? []).slice(0, 3),
    [startingBeat]
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
    <main className="mx-auto flex min-h-screen w-full max-w-[1400px] items-center px-4 py-6 sm:px-6 lg:px-8">
      <section className="card grid w-full grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="label">Escalation // Pre-Mission Dossier</p>
            <h1 className="font-display text-4xl leading-none text-accent sm:text-5xl">ESCALATION</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-textMuted">
              You are entering a ten-turn strategic crisis simulation with hidden state, rival adaptation, and deterministic
              causality.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card bg-panelRaised/70 p-3">
              <p className="label">Episode Length</p>
              <p className="mt-2 font-display text-2xl text-textMain">{selectedScenario?.maxTurns ?? 0} turns</p>
            </div>
            <div className="card bg-panelRaised/70 p-3">
              <p className="label">Pacing</p>
              <p className="mt-2 font-display text-2xl text-textMain">
                {timerModes.find((mode) => mode.id === timerMode)?.label ?? 'Real-Time'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-1">
            <label className="flex flex-col gap-2 text-sm">
              <span className="label">Commander Codename</span>
              <input
                className="rounded-lg border border-borderTone bg-panelRaised/80 px-3 py-2.5 text-textMain focus:border-accent focus:outline-none"
                value={codename}
                onChange={(event) => setCodename(event.target.value)}
                maxLength={40}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-1">
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
          </div>

          <div className="space-y-2">
            <p className="label">Pacing Preference</p>
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

          <div className="rounded-lg border border-borderTone/80 bg-panelRaised/45 px-3 py-2">
            <button
              type="button"
              className="text-[0.68rem] uppercase tracking-[0.12em] text-textMuted hover:text-textMain"
              onClick={() => setShowAdvanced((current) => !current)}
            >
              {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
            </button>
            {showAdvanced ? (
              <div className="mt-2 space-y-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="label">Deterministic Seed (optional)</span>
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-lg border border-borderTone bg-panelRaised/80 px-3 py-2.5 text-textMain focus:border-accent focus:outline-none"
                      value={seed}
                      onChange={(event) => setSeed(event.target.value)}
                      placeholder="Leave blank for auto-seed"
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-borderTone px-3 py-2 text-xs uppercase tracking-[0.12em] text-textMuted transition hover:border-accent hover:text-textMain"
                      onClick={() => setSeed(randomSeed())}
                    >
                      Generate
                    </button>
                  </div>
                </label>
              </div>
            ) : null}
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
            <p className="label">Classified Brief</p>
            <h2 className="mt-3 font-display text-2xl text-textMain">{selectedScenario?.name ?? 'No scenario selected'}</h2>
            <p className="mt-3 text-sm leading-relaxed text-textMuted">
              {selectedScenario?.briefing ?? 'Select a scenario to review strategic role and escalation context.'}
            </p>
            <div className="mt-4 rounded-md border border-borderTone/70 bg-surface/35 px-3 py-2">
              <p className="label">Cold Open</p>
              <p className="mt-2 text-sm leading-relaxed text-textMain">
                {startingBeat?.sceneFragments[0] ?? 'Opening intelligence package unavailable.'}
              </p>
            </div>
            {openingSignals.length > 0 ? (
              <div className="mt-4">
                <p className="label">Initial Intelligence</p>
                <div className="mt-2 space-y-2">
                  {openingSignals.map((headline) => (
                    <p key={headline} className="rounded-md border border-borderTone/70 bg-surface/35 px-2 py-1.5 text-xs leading-relaxed text-textMuted">
                      {headline}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
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
        </aside>
      </section>
    </main>
  );
};
