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

const environmentLabel: Record<string, string> = {
  coastal: 'Maritime region',
  arctic: 'Arctic region',
  dense_city: 'Urban region',
  industrial: 'Industrial region',
  generic: 'Global setting'
};

export const StartScreen = ({ reference, loading, error, onStart }: StartScreenProps) => {
  const [codename] = useState(() => `RUN-${randomSeed()}`);
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const playableScenarios = useMemo(
    () => reference.scenarios.filter((entry) => !entry.isLegacy),
    [reference.scenarios]
  );
  const defaultScenario = playableScenarios[0]?.id ?? reference.scenarios[0]?.id ?? '';

  const [scenarioId, setScenarioId] = useState(defaultScenario);
  const [timerMode, setTimerMode] = useState<'standard' | 'relaxed' | 'off'>('standard');

  const selectedScenario = useMemo(
    () => playableScenarios.find((entry) => entry.id === scenarioId) ?? reference.scenarios.find((entry) => entry.id === scenarioId),
    [playableScenarios, reference.scenarios, scenarioId]
  );
  const selectedScenarioWorld = useMemo(
    () => reference.scenarioWorld.find((entry) => entry.scenarioId === scenarioId) ?? null,
    [reference.scenarioWorld, scenarioId]
  );

  const runProfile = useMemo(
    () => [
      {
        label: 'Scenario',
        value: selectedScenario?.name ?? 'No scenario selected'
      },
      {
        label: 'Role',
        value: selectedScenario?.role ?? 'N/A'
      },
      {
        label: 'Region',
        value: selectedScenario?.environment
          ? environmentLabel[selectedScenario.environment] ?? 'Global theater'
          : 'N/A'
      },
      {
        label: 'Decision Windows',
        value: `${selectedScenario?.maxTurns ?? 0} staged decision windows`
      }
    ],
    [selectedScenario]
  );

  const systemNotes = useMemo(
    () => [
      'The first decision window opens immediately after launch.',
      'The setup page stays procedural and concise on purpose.',
      'Live guidance, context, and advisors appear after the scenario begins.'
    ],
    []
  );

  const theaterStamp = selectedScenarioWorld
    ? `${selectedScenarioWorld.region.name} / ${selectedScenarioWorld.dateAnchor.month} ${selectedScenarioWorld.dateAnchor.year}`
    : 'Theater data pending';

  const currentTimerLabel = timerModes.find((mode) => mode.id === timerMode)?.label ?? 'Real-Time';

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
    <main className="console-shell">
      <section className="grid min-h-[calc(100vh-1.5rem)] gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="console-sidebar flex flex-col">
          <div className="console-sidebar-brand">Altira Flashpoint</div>

          <div className="console-sidebar-section">
            <p className="console-sidebar-label">Active Scenario</p>
            <div className="console-nav-meta">
              <p className="text-[0.74rem] uppercase tracking-[0.08em] text-textMain">
                {selectedScenario?.name ?? 'No scenario selected'}
              </p>
              <p className="mt-2 text-[0.62rem] uppercase tracking-[0.14em] text-textMuted">{theaterStamp}</p>
            </div>
          </div>

          <div className="console-sidebar-section">
            <p className="console-sidebar-label">Run State</p>
            <div className="space-y-2">
              <div className="console-nav-meta">
                <p className="text-[0.58rem] uppercase tracking-[0.14em] text-textMuted">Pacing</p>
                <p className="mt-1 text-[0.72rem] uppercase tracking-[0.08em] text-textMain">{currentTimerLabel}</p>
              </div>
              <div className="console-nav-meta">
                <p className="text-[0.58rem] uppercase tracking-[0.14em] text-textMuted">Launch Path</p>
                <p className="mt-1 text-[0.72rem] uppercase tracking-[0.08em] text-textMain">Direct scenario start</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <header className="console-topbar px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="console-kicker">Altira Flashpoint // Scenario Setup</p>
                <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.08em] text-textMain sm:text-4xl">
                  Configure Scenario Run
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="console-chip">
                  <strong>Scenario</strong>
                  <span>{selectedScenario?.name ?? 'None'}</span>
                </div>
                <div className="console-chip">
                  <strong>Pacing</strong>
                  <span>{currentTimerLabel}</span>
                </div>
              </div>
            </div>
            <p className="mt-3 max-w-4xl text-[0.76rem] leading-relaxed text-textMuted">
              Choose the scenario and pacing, then begin the first decision window. The detailed background and live context now appear inside the scenario itself instead of on a separate pre-launch page.
            </p>
          </header>

          <section className="grid gap-4 2xl:grid-cols-[1.08fr_0.92fr]">
            <section className="console-panel p-5 sm:p-6">
              <p className="label">Scenario Brief</p>
              <div className="mt-3 console-subpanel px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="console-chip">
                    <strong>Theater</strong>
                    <span>{theaterStamp}</span>
                  </span>
                  <span className="console-chip">
                    <strong>Role</strong>
                    <span>{selectedScenario?.role ?? 'N/A'}</span>
                  </span>
                </div>
                <p className="mt-4 text-[0.88rem] leading-relaxed text-textMain">
                  {selectedScenario?.briefing ?? 'Select a scenario to load the briefing.'}
                </p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="space-y-4">
                  <label className="block text-sm">
                    <span className="label">Scenario</span>
                    <select
                      className="console-input mt-2"
                      value={scenarioId}
                      onChange={(event) => setScenarioId(event.target.value)}
                    >
                      {playableScenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="console-subpanel px-3 py-3">
                    <p className="label">Launch Guidance</p>
                    <p className="mt-2 text-[0.76rem] leading-relaxed text-textMuted">
                      The scenario begins immediately after launch. Window 1 opens with a current situation summary, current developments, and the background needed to make the first decision.
                    </p>
                  </div>
                  <div className="console-subpanel px-3 py-3">
                    <p className="label">What Changes First</p>
                    <p className="mt-2 text-[0.76rem] leading-relaxed text-textMuted">
                      Markets, shipping behavior, and allied interpretation tend to move before formal policy does. The early decisions are about shaping that read before pressure becomes routine.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <p className="label">Pacing Preference</p>
                <div className="grid gap-2 xl:grid-cols-3">
                  {timerModes.map((mode) => {
                    const active = timerMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        className={`border px-3 py-3 text-left transition ${
                          active
                            ? 'border-accent bg-accent/12 text-textMain'
                            : 'border-borderTone bg-panelRaised text-textMuted hover:border-accent/70 hover:text-textMain'
                        }`}
                        onClick={() => setTimerMode(mode.id)}
                      >
                        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">{mode.label}</p>
                        <p className="mt-2 text-[0.74rem] leading-relaxed">{mode.detail}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error ? (
                <p className="mt-5 border border-warning/60 bg-warning/10 px-3 py-2 text-sm text-warning">
                  {error}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="console-button console-button-primary"
                  onClick={() => void handleStart()}
                  disabled={loading || !scenarioId}
                >
                  {loading ? 'Beginning Scenario...' : 'Begin Scenario'}
                </button>
              </div>
            </section>

            <div className="space-y-4">
              <section className="console-panel p-5">
                <p className="label">Run Profile</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {runProfile.map((item) => (
                    <div key={item.label} className="console-subpanel px-3 py-2.5">
                      <p className="text-[0.56rem] uppercase tracking-[0.16em] text-textMuted">{item.label}</p>
                      <p className="mt-2 text-[0.8rem] uppercase tracking-[0.06em] text-textMain">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="console-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="label">Advanced Options</p>
                  <button
                    type="button"
                    className="console-button console-button-ghost"
                    onClick={() => setShowAdvanced((current) => !current)}
                  >
                    {showAdvanced ? 'Hide' : 'Open'}
                  </button>
                </div>
                <p className="mt-2 text-[0.74rem] leading-relaxed text-textMuted">
                  Deterministic seed control is optional and mainly useful for replay and testing.
                </p>
                {showAdvanced ? (
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm">
                      <span className="label">Deterministic Seed</span>
                      <div className="mt-2 flex gap-2">
                        <input
                          className="console-input"
                          value={seed}
                          onChange={(event) => setSeed(event.target.value)}
                          placeholder="Leave blank for auto-seed"
                        />
                        <button
                          type="button"
                          className="console-button console-button-secondary shrink-0"
                          onClick={() => setSeed(randomSeed())}
                        >
                          Generate
                        </button>
                      </div>
                    </label>
                  </div>
                ) : null}
              </section>

              <section className="console-panel p-5">
                <p className="label">Operator Notes</p>
                <div className="mt-3 space-y-2">
                  {systemNotes.map((note) => (
                    <div key={note} className="console-subpanel px-3 py-2.5 text-[0.74rem] leading-relaxed text-textMuted">
                      {note}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
};
