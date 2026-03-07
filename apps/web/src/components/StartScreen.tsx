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

type StartFlowStep = 'home' | 'brief' | 'dossier';

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

const advisorNameById: Record<string, string> = {
  cross: 'ADM Vivian Cross',
  chen: 'Dr. Elias Chen',
  okonkwo: 'Sarah Okonkwo',
  reed: 'COL Marcus Reed'
};

const environmentLabel: Record<string, string> = {
  coastal: 'Maritime theater',
  arctic: 'Arctic theater',
  dense_city: 'Urban theater',
  industrial: 'Industrial theater',
  generic: 'Global theater'
};

const roleLenses = [
  {
    label: 'Public Leadership',
    detail: 'National security, emergency, and continuity leaders testing crisis decisions under pressure.'
  },
  {
    label: 'Corporate Resilience',
    detail: 'Operational leaders stress-testing supply chains, infrastructure exposure, and response cadence.'
  },
  {
    label: 'Financial Risk',
    detail: 'Investors, compliance teams, and risk operators modeling market spillover and second-order effects.'
  }
];

const productHighlights = [
  {
    label: 'Scenario Format',
    value: '10-turn crisis runs'
  },
  {
    label: 'Grounding',
    value: 'Real-world theaters'
  },
  {
    label: 'Replay',
    value: 'Deterministic seed path'
  },
  {
    label: 'Review',
    value: 'Full causality report'
  }
];

const clipText = (value: string, limit = 240): string =>
  value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;

export const StartScreen = ({ reference, loading, error, onStart }: StartScreenProps) => {
  const [step, setStep] = useState<StartFlowStep>('home');
  const [codename, setCodename] = useState('SABLE-ONE');
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOpeningSequence, setShowOpeningSequence] = useState(false);

  const defaultScenario = reference.scenarios[0]?.id ?? '';

  const [scenarioId, setScenarioId] = useState(defaultScenario);
  const [timerMode, setTimerMode] = useState<'standard' | 'relaxed' | 'off'>('standard');

  const selectedScenario = useMemo(
    () => reference.scenarios.find((entry) => entry.id === scenarioId),
    [reference.scenarios, scenarioId]
  );
  const selectedCinematics = useMemo(
    () => reference.cinematics.find((entry) => entry.scenarioId === scenarioId) ?? null,
    [reference.cinematics, scenarioId]
  );
  const selectedScenarioWorld = useMemo(
    () => reference.scenarioWorld.find((entry) => entry.scenarioId === scenarioId) ?? null,
    [reference.scenarioWorld, scenarioId]
  );

  const startingBeat = useMemo(() => {
    if (!selectedScenario?.startingBeatId) {
      return null;
    }
    return selectedScenario.beats.find((beat) => beat.id === selectedScenario.startingBeatId) ?? null;
  }, [selectedScenario]);

  const advisorFirstTakes = useMemo(() => {
    if (!startingBeat) {
      return [];
    }

    return Object.entries(startingBeat.advisorLines)
      .map(([advisorId, lines]) => ({
        advisorId,
        line: lines[0] ?? ''
      }))
      .filter((entry) => entry.line.length > 0)
      .slice(0, 4);
  }, [startingBeat]);

  const stakeholderPreview = useMemo(
    () => (selectedScenarioWorld?.stakeholders ?? []).slice(0, 4),
    [selectedScenarioWorld]
  );
  const alliancePreview = useMemo(
    () => (selectedScenarioWorld?.playerNation.alliances ?? []).slice(0, 3),
    [selectedScenarioWorld]
  );
  const keyFeaturePreview = useMemo(
    () => (selectedScenarioWorld?.region.keyFeatures ?? []).slice(0, 5),
    [selectedScenarioWorld]
  );
  const intelligenceGapPreview = useMemo(
    () => (selectedScenarioWorld?.intelligenceGaps ?? []).slice(0, 3),
    [selectedScenarioWorld]
  );
  const timelinePreview = useMemo(
    () => (selectedScenarioWorld?.crisisTimeline ?? []).slice(0, 5),
    [selectedScenarioWorld]
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

  if (step === 'home') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[1520px] items-center px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid w-full gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="console-panel p-6 sm:p-8">
            <p className="console-kicker">Altira Flashpoint // Scenario Intelligence</p>
            <h1 className="mt-4 max-w-4xl font-display text-4xl leading-none text-textMain sm:text-5xl lg:text-6xl">
              Interactive crisis simulations for leaders navigating real-world shock scenarios.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-textMuted sm:text-base">
              Altira Flashpoint is the scenario-intelligence layer inside Altira: real theaters, fictionalized decision
              rooms, deterministic
              causality, and replayable crisis runs built to stress-test how policy, operations, and markets can unravel.
            </p>

            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              {roleLenses.map((lens) => (
                <article key={lens.label} className="console-subpanel px-3 py-3">
                  <p className="label">{lens.label}</p>
                  <p className="mt-2 text-[0.82rem] leading-relaxed text-textMuted">{lens.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {productHighlights.map((highlight) => (
                <div key={highlight.label} className="console-metric">
                  <p className="console-metric-label">{highlight.label}</p>
                  <p className="console-metric-value">{highlight.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-lg border border-accent bg-accent/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent/25"
                onClick={() => setStep('brief')}
              >
                Open Mission Queue
              </button>
              <button
                type="button"
                className="rounded-lg border border-borderTone px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-textMuted transition hover:border-accent hover:text-textMain"
                onClick={() => setStep('dossier')}
              >
                Review Theater Dossier
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="console-panel p-5">
              <p className="label">Featured Scenario</p>
              <h2 className="mt-3 font-display text-3xl text-textMain">
                {selectedScenario?.name ?? 'No scenario selected'}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-textMuted">
                {selectedScenario?.briefing ?? 'Select a scenario to review the current featured crisis run.'}
              </p>
              {selectedScenarioWorld ? (
                <div className="mt-4 grid gap-2">
                  <div className="console-subpanel px-3 py-2">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Theater</p>
                    <p className="mt-1 text-sm text-textMain">
                      {selectedScenarioWorld.region.name} · {selectedScenarioWorld.dateAnchor.month} {selectedScenarioWorld.dateAnchor.year}
                    </p>
                  </div>
                  <div className="console-subpanel px-3 py-2">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Why it matters</p>
                    <p className="mt-1 text-[0.78rem] leading-relaxed text-textMuted">
                      {clipText(selectedScenarioWorld.economicBackdrop.straitEconomicValue, 220)}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="console-panel p-5">
              <p className="label">Current Build</p>
              <div className="mt-3 space-y-2">
                <div className="console-subpanel px-3 py-2">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Live Theater</p>
                  <p className="mt-1 text-sm text-textMain">Taiwan Strait flagship scenario</p>
                </div>
                <div className="console-subpanel px-3 py-2">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Role Path</p>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-textMuted">
                    Public-official lens live now. Corporate and financial overlays are the next expansion path.
                  </p>
                </div>
                <div className="console-subpanel px-3 py-2">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Run Output</p>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-textMuted">
                    Every episode ends with a full causality review so the player can see what the rival inferred,
                    what the system hid, and what branches were not taken.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </main>
    );
  }

  if (step === 'brief') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[1480px] items-center px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid w-full gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="console-panel p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="console-kicker">Altira Flashpoint // Mission Setup</p>
                <h1 className="mt-3 font-display text-4xl text-textMain sm:text-5xl">Scenario Brief</h1>
              </div>
              <button
                type="button"
                className="rounded-lg border border-borderTone px-3 py-2 text-xs uppercase tracking-[0.12em] text-textMuted transition hover:border-accent hover:text-textMain"
                onClick={() => setStep('home')}
              >
                Back
              </button>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-textMuted">
              Choose the scenario, your codename, and pacing. Deeper context has been moved out of this screen into the
              dedicated theater dossier so this launch step stays focused.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="console-subpanel px-3 py-2.5">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Role</p>
                <p className="mt-1 text-sm text-textMain">{selectedScenario?.role ?? 'N/A'}</p>
              </div>
              <div className="console-subpanel px-3 py-2.5">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Theater</p>
                <p className="mt-1 text-sm text-textMain">
                  {selectedScenario?.environment ? environmentLabel[selectedScenario.environment] ?? 'Global theater' : 'N/A'}
                </p>
              </div>
              <div className="console-subpanel px-3 py-2.5">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Episode Format</p>
                <p className="mt-1 text-sm text-textMain">{selectedScenario?.maxTurns ?? 0}-turn crisis run</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
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

            <div className="mt-5 space-y-2">
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

            <div className="mt-5 rounded-lg border border-borderTone/80 bg-panelRaised/45 px-3 py-2">
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

            {error ? (
              <p className="mt-5 rounded-lg border border-warning/60 bg-warning/10 px-3 py-2 text-sm text-warning">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-lg border border-borderTone px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-textMuted transition hover:border-accent hover:text-textMain"
                onClick={() => setStep('dossier')}
              >
                Review Theater Dossier
              </button>
              <button
                type="button"
                className="rounded-lg border border-accent bg-accent/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => void handleStart()}
                disabled={loading || !codename.trim() || !scenarioId}
              >
                {loading ? 'Initializing Theater...' : 'Enter War Room'}
              </button>
            </div>
          </div>

          <aside className="console-panel flex p-6 sm:p-8">
            <div className="my-auto">
              <p className="label">Scenario Brief</p>
              <h2 className="mt-3 font-display text-3xl text-textMain sm:text-4xl">
                {selectedScenario?.name ?? 'No scenario selected'}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-textMuted">
                {selectedScenario?.briefing ?? 'Select a scenario to review the active mission brief.'}
              </p>
            </div>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1560px] items-start px-4 py-6 sm:px-6 lg:px-8">
      <section className="w-full space-y-4">
        <header className="console-topbar px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="console-kicker">Altira Flashpoint // Theater Dossier</p>
              <h1 className="mt-3 font-display text-4xl text-textMain sm:text-5xl">
                {selectedScenario?.name ?? 'Theater Dossier'}
              </h1>
              <p className="mt-4 max-w-4xl text-sm leading-relaxed text-textMuted">
                Review the geography, economic stakes, actor map, and baseline pressure before you enter the war room.
                This page holds the deeper context that no longer belongs on the mission-setup screen.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-lg border border-borderTone px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-textMuted transition hover:border-accent hover:text-textMain"
                onClick={() => setStep('brief')}
              >
                Back to Brief
              </button>
              <button
                type="button"
                className="rounded-lg border border-accent bg-accent/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => void handleStart()}
                disabled={loading || !codename.trim() || !scenarioId}
              >
                {loading ? 'Initializing Theater...' : 'Enter War Room'}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-4">
            {selectedScenarioWorld ? (
              <section className="console-panel p-5">
                <p className="label">Theater Snapshot</p>
                <p className="mt-3 font-display text-2xl text-textMain">
                  {selectedScenarioWorld.region.name} · {selectedScenarioWorld.dateAnchor.month} {selectedScenarioWorld.dateAnchor.year}
                </p>
                <p className="mt-2 text-[0.78rem] text-textMuted">{selectedScenarioWorld.dateAnchor.dayRange}</p>
                <p className="mt-3 text-sm leading-relaxed text-textMuted">
                  {selectedScenarioWorld.region.description}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="console-subpanel px-3 py-2">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Coordinates</p>
                    <p className="mt-1 text-[0.8rem] text-textMain">{selectedScenarioWorld.region.coordinates}</p>
                  </div>
                  <div className="console-subpanel px-3 py-2">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Season</p>
                    <p className="mt-1 text-[0.8rem] text-textMain">{selectedScenarioWorld.region.climateSeason}</p>
                  </div>
                </div>
              </section>
            ) : null}

            {selectedScenarioWorld ? (
              <section className="console-panel p-5">
                <p className="label">Why It Matters</p>
                <div className="mt-3 space-y-3">
                  <div className="console-subpanel px-3 py-3">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Strategic Value</p>
                    <p className="mt-2 text-[0.82rem] leading-relaxed text-textMuted">
                      {selectedScenarioWorld.economicBackdrop.straitEconomicValue}
                    </p>
                  </div>
                  <div className="console-subpanel px-3 py-3">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Global Conditions</p>
                    <p className="mt-2 text-[0.82rem] leading-relaxed text-textMuted">
                      {selectedScenarioWorld.economicBackdrop.globalConditions}
                    </p>
                  </div>
                  <div className="console-subpanel px-3 py-3">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Vulnerabilities</p>
                    <p className="mt-2 text-[0.82rem] leading-relaxed text-textMuted">
                      {selectedScenarioWorld.economicBackdrop.vulnerabilities}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {timelinePreview.length > 0 ? (
              <section className="console-panel p-5">
                <p className="label">Crisis Trajectory</p>
                <div className="mt-3 space-y-2">
                  {timelinePreview.map((event) => (
                    <div key={`${event.daysBeforeStart}-${event.event}`} className="console-subpanel px-3 py-2.5">
                      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
                        {event.daysBeforeStart === 0 ? 'Start Day' : `${Math.abs(event.daysBeforeStart)} day${Math.abs(event.daysBeforeStart) === 1 ? '' : 's'} before start`}
                      </p>
                      <p className="mt-1 text-[0.8rem] leading-relaxed text-textMain">{event.event}</p>
                      <p className="mt-1 text-[0.72rem] leading-relaxed text-textMuted">{event.significance}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedScenarioWorld ? (
              <section className="console-panel p-5">
                <p className="label">Alliance And Legal Frame</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="console-subpanel px-3 py-3">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Maritime Law</p>
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-textMuted">
                      {clipText(selectedScenarioWorld.legalFramework.maritimeLaw, 220)}
                    </p>
                  </div>
                  <div className="console-subpanel px-3 py-3">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Treaty Obligations</p>
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-textMuted">
                      {clipText(selectedScenarioWorld.legalFramework.treatyObligations, 220)}
                    </p>
                  </div>
                  <div className="console-subpanel px-3 py-3 sm:col-span-2">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Sanctions Framework</p>
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-textMuted">
                      {clipText(selectedScenarioWorld.legalFramework.sanctionsFramework, 340)}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <div className="space-y-4">
            {selectedScenarioWorld ? (
              <section className="console-panel p-5">
                <p className="label">Actor Map</p>
                <div className="mt-3 grid gap-3">
                  <div className="console-subpanel px-3 py-3">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Player Nation</p>
                    <p className="mt-1 text-sm text-textMain">{selectedScenarioWorld.playerNation.name}</p>
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-textMuted">
                      {selectedScenarioWorld.playerNation.domesticContext}
                    </p>
                    <p className="mt-2 text-[0.76rem] text-textMuted">
                      <span className="text-textMain">Posture:</span> {selectedScenarioWorld.playerNation.militaryPosture}
                    </p>
                  </div>
                  <div className="console-subpanel px-3 py-3">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Rival State</p>
                    <p className="mt-1 text-sm text-textMain">{selectedScenarioWorld.rivalState.name}</p>
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-textMuted">
                      {selectedScenarioWorld.rivalState.domesticContext}
                    </p>
                    <p className="mt-2 text-[0.76rem] text-textMuted">
                      <span className="text-textMain">Capability:</span> {selectedScenarioWorld.rivalState.militaryCapability}
                    </p>
                    <p className="mt-2 text-[0.76rem] text-textMuted">
                      <span className="text-textMain">Red line:</span> {selectedScenarioWorld.rivalState.knownRedLines}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {alliancePreview.length > 0 ? (
              <section className="console-panel p-5">
                <p className="label">Alliance Network</p>
                <div className="mt-3 space-y-2">
                  {alliancePreview.map((alliance) => (
                    <div key={alliance.name} className="console-subpanel px-3 py-2.5">
                      <p className="text-[0.76rem] text-textMain">{alliance.name}</p>
                      <p className="mt-1 text-[0.72rem] leading-relaxed text-textMuted">{alliance.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {keyFeaturePreview.length > 0 ? (
              <section className="console-panel p-5">
                <p className="label">Strategic Features</p>
                <div className="mt-3 space-y-2">
                  {keyFeaturePreview.map((feature) => (
                    <div key={feature} className="console-subpanel px-3 py-2.5 text-[0.76rem] leading-relaxed text-textMuted">
                      {feature}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {stakeholderPreview.length > 0 ? (
              <section className="console-panel p-5">
                <p className="label">Primary Stakeholders</p>
                <div className="mt-3 space-y-2">
                  {stakeholderPreview.map((stakeholder) => (
                    <div key={stakeholder.id} className="console-subpanel px-3 py-2.5">
                      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
                        {stakeholder.type.replace('_', ' ')}
                      </p>
                      <p className="mt-1 text-[0.8rem] text-textMain">{stakeholder.name}</p>
                      <p className="mt-1 text-[0.72rem] leading-relaxed text-textMuted">
                        {clipText(stakeholder.disposition, 170)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {advisorFirstTakes.length > 0 ? (
              <section className="console-panel p-5">
                <p className="label">Senior Staff Assessment</p>
                <div className="mt-3 space-y-2">
                  {advisorFirstTakes.map((entry) => (
                    <div key={entry.advisorId} className="console-subpanel px-3 py-2.5">
                      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
                        {advisorNameById[entry.advisorId] ?? entry.advisorId.toUpperCase()}
                      </p>
                      <p className="mt-1 text-[0.78rem] leading-relaxed text-textMain">{entry.line}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {intelligenceGapPreview.length > 0 ? (
              <section className="console-panel p-5">
                <p className="label">Known Intelligence Gaps</p>
                <div className="mt-3 space-y-2">
                  {intelligenceGapPreview.map((gap) => (
                    <div key={gap} className="console-subpanel px-3 py-2.5 text-[0.76rem] leading-relaxed text-textMuted">
                      {gap}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedCinematics ? (
              <section className="console-panel p-5">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setShowOpeningSequence((current) => !current)}
                >
                  <div>
                    <p className="label">Opening Sequence</p>
                    <p className="mt-2 text-sm text-textMain">{selectedCinematics.openingCinematic.title}</p>
                    <p className="mt-1 text-[0.72rem] uppercase tracking-[0.12em] text-textMuted">
                      {selectedCinematics.openingCinematic.subtitle}
                    </p>
                  </div>
                  <span className="text-[0.62rem] uppercase tracking-[0.1em] text-accent">
                    {showOpeningSequence ? 'Hide' : 'Open'}
                  </span>
                </button>
                <div className="mt-3 space-y-2 border-t border-borderTone/70 pt-3 text-[0.78rem] leading-relaxed text-textMuted">
                  {(showOpeningSequence
                    ? selectedCinematics.openingCinematic.fragments
                    : selectedCinematics.openingCinematic.fragments.slice(0, 2)
                  ).map((fragment) => (
                    <p key={fragment}>{fragment}</p>
                  ))}
                  <p className="border-l-2 border-accent/70 pl-3 text-sm text-textMain">
                    {selectedCinematics.openingCinematic.closingLine}
                  </p>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
};
