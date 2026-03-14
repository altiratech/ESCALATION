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

type StartFlowStep = 'console' | 'dossier';

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
  coastal: 'Maritime region',
  arctic: 'Arctic region',
  dense_city: 'Urban region',
  industrial: 'Industrial region',
  generic: 'Global setting'
};

const clipText = (value: string, limit = 240): string =>
  value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;

export const StartScreen = ({ reference, loading, error, onStart }: StartScreenProps) => {
  const [step, setStep] = useState<StartFlowStep>('console');
  const [codename] = useState(() => `RUN-${randomSeed()}`);
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
  const selectedRivalLeader = useMemo(
    () => reference.rivalLeaders.find((entry) => entry.scenarioId === scenarioId) ?? null,
    [reference.rivalLeaders, scenarioId]
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
  const crisisStartEvent = useMemo(() => {
    if (!selectedScenarioWorld) {
      return null;
    }
    return (
      selectedScenarioWorld.crisisTimeline.find((event) => event.daysBeforeStart === 0) ??
      selectedScenarioWorld.crisisTimeline[selectedScenarioWorld.crisisTimeline.length - 1] ??
      null
    );
  }, [selectedScenarioWorld]);

  const selectedDossierVisual = useMemo(() => {
    if (!selectedScenario || reference.images.length === 0) {
      return null;
    }

    const hintSet = new Set(startingBeat?.imageHints ?? []);
    const scored = reference.images
      .filter((asset) => asset.environment === selectedScenario.environment || asset.environment === 'generic')
      .map((asset) => {
        let score = 0;
        if (hintSet.has(asset.domain)) {
          score += 4;
        }
        if (hintSet.has(`severity_${asset.severity}`)) {
          score += 2;
        }
        if (hintSet.has(asset.perspective)) {
          score += 4;
        }
        if (asset.perspective === 'news_frame') {
          score += 1;
        }
        if (asset.domain === 'diplomacy' || asset.domain === 'military') {
          score += 1;
        }
        return { asset, score };
      })
      .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id));

    return scored[0]?.asset ?? null;
  }, [reference.images, selectedScenario, startingBeat]);

  const turnOneCarryForward = useMemo(() => {
    const items = [
      {
        label: 'Mandate',
        text: selectedScenario?.briefing ?? ''
      },
      {
        label: 'First watch item',
        text:
          startingBeat?.headlines[0] ??
          crisisStartEvent?.event ??
          selectedScenarioWorld?.economicBackdrop.marketSentiment ??
          ''
      },
      {
        label: 'How the opening decision window resolves',
        text:
          timerMode === 'off'
            ? 'Untimed. The opening window resolves only when you commit one response or explicitly hold position.'
            : 'Live. The opening window resolves when you commit one response or let the active decision window expire.'
      }
    ];

    return items.filter((item) => item.text.trim().length > 0);
  }, [
    crisisStartEvent?.event,
    selectedScenario?.briefing,
    selectedScenarioWorld?.economicBackdrop.marketSentiment,
    startingBeat?.headlines,
    timerMode
  ]);

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
      'Deeper context is available in Scenario Background before launch.',
      'The main response workflow uses guided response selection in the live scenario.'
    ],
    []
  );

  const theaterStamp = selectedScenarioWorld
    ? `${selectedScenarioWorld.region.name} / ${selectedScenarioWorld.dateAnchor.month} ${selectedScenarioWorld.dateAnchor.year}`
    : 'Theater data pending';

  const currentTimerLabel =
    timerModes.find((mode) => mode.id === timerMode)?.label ?? 'Real-Time';

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

  const sidebar = (
    <aside className="console-sidebar flex flex-col">
      <div className="console-sidebar-brand">Altira Flashpoint</div>

      <div className="console-sidebar-section">
        <p className="console-sidebar-label">Navigation</p>
        <button
          type="button"
          className={`console-nav-item ${step === 'console' ? 'console-nav-item-active' : ''}`}
          onClick={() => setStep('console')}
        >
          <span>Scenario Setup</span>
          <span className="text-[0.58rem] text-textMuted">INIT</span>
        </button>
        <button
          type="button"
          className={`console-nav-item ${step === 'dossier' ? 'console-nav-item-active' : ''}`}
          onClick={() => setStep('dossier')}
        >
          <span>Scenario Background</span>
          <span className="text-[0.58rem] text-textMuted">CTX</span>
        </button>
      </div>

      <div className="console-sidebar-section">
        <p className="console-sidebar-label">Active Scenario</p>
        <div className="console-nav-meta">
          <p className="text-[0.74rem] uppercase tracking-[0.08em] text-textMain">
            {selectedScenario?.name ?? 'No scenario selected'}
          </p>
          <p className="mt-2 text-[0.62rem] uppercase tracking-[0.14em] text-textMuted">
            {theaterStamp}
          </p>
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
            <p className="mt-1 text-[0.72rem] uppercase tracking-[0.08em] text-textMain">Direct decision entry</p>
          </div>
        </div>
      </div>
    </aside>
  );

  if (step === 'console') {
    return (
      <main className="console-shell">
        <section className="grid min-h-[calc(100vh-1.5rem)] gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
          {sidebar}

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
                Configure the scenario, then move directly into the first decision window. This screen stays procedural;
                background context and narrative framing live in Scenario Background.
              </p>
            </header>

            <section className="grid gap-4 2xl:grid-cols-[1.08fr_0.92fr]">
              <section className="console-panel p-5 sm:p-6">
                <p className="label">Mission Parameters</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                  <div className="space-y-4">
                    <label className="block text-sm">
                      <span className="label">Scenario</span>
                      <select
                        className="console-input mt-2"
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

                  <div className="space-y-3">
                    <div className="console-subpanel px-3 py-3">
                      <p className="label">Launch Guidance</p>
                      <p className="mt-2 text-[0.76rem] leading-relaxed text-textMuted">
                        Use Scenario Setup to initialize the run. Open Scenario Background only when you need deeper
                        geographic, legal, and actor context before launch.
                      </p>
                    </div>
                    <div className="console-subpanel px-3 py-3">
                      <p className="label">Live Entry</p>
                      <p className="mt-2 text-[0.76rem] leading-relaxed text-textMuted">
                        Launching enters the live scenario immediately and opens the first decision window. There is no
                        extra preview screen after launch.
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
                    className="console-button console-button-secondary"
                    onClick={() => setStep('dossier')}
                  >
                    Open Scenario Background
                  </button>
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
                    Deterministic seed control is optional and primarily useful for replay and debugging.
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
  }

  return (
    <main className="console-shell">
      <section className="grid min-h-[calc(100vh-1.5rem)] gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        {sidebar}

        <section className="min-w-0 space-y-4">
          <header className="console-topbar px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="console-kicker">Altira Flashpoint // Scenario Background</p>
                <h1 className="mt-3 font-display text-3xl uppercase tracking-[0.08em] text-textMain sm:text-4xl">
                  {selectedScenario?.name ?? 'Scenario Background'}
                </h1>
                <p className="mt-4 max-w-4xl text-[0.78rem] leading-relaxed text-textMuted">
                  Review geography, actors, legal framing, and baseline pressure before entering the live scenario. This is
                  the only pre-launch surface intended for deeper scenario context.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="console-button console-button-secondary"
                  onClick={() => setStep('console')}
                >
                  Back to Scenario Setup
                </button>
                <button
                  type="button"
                  className="console-button console-button-primary"
                  onClick={() => void handleStart()}
                  disabled={loading || !scenarioId}
                >
                  {loading ? 'Beginning Scenario...' : 'Begin Scenario'}
                </button>
              </div>
            </div>
          </header>

          <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="space-y-4">
              {selectedScenarioWorld ? (
                <section className="console-panel p-5">
                  <p className="label">Scenario Snapshot</p>
                  <p className="mt-3 font-display text-2xl uppercase tracking-[0.06em] text-textMain">
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
                          {event.daysBeforeStart === 0
                            ? 'Start Day'
                            : `${Math.abs(event.daysBeforeStart)} day${Math.abs(event.daysBeforeStart) === 1 ? '' : 's'} before start`}
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
              {selectedDossierVisual ? (
                <section className="console-panel p-5">
                  <p className="label">Scenario Visual</p>
                  <figure className="mt-3 overflow-hidden border border-borderTone bg-panelRaised">
                    <img
                      src={selectedDossierVisual.path}
                      alt={selectedDossierVisual.tags.join(', ')}
                      className="h-52 w-full object-cover"
                      loading="lazy"
                    />
                    <figcaption className="border-t border-borderTone px-3 py-2 text-[0.72rem] leading-relaxed text-textMuted">
                      {clipText(
                        selectedScenarioWorld?.economicBackdrop.marketSentiment ??
                          selectedScenarioWorld?.region.description ??
                          'Scenario visual reference.',
                        220
                      )}
                    </figcaption>
                  </figure>
                </section>
              ) : null}

              {turnOneCarryForward.length > 0 ? (
                <section className="console-panel p-5">
                  <p className="label">Carry Into The Opening Window</p>
                  <div className="mt-3 space-y-2">
                    {turnOneCarryForward.map((item) => (
                      <div key={item.label} className="console-subpanel px-3 py-2.5">
                        <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{item.label}</p>
                        <p className="mt-1 text-[0.76rem] leading-relaxed text-textMain">{clipText(item.text, 220)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

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

              {selectedRivalLeader ? (
                <section className="console-panel p-5">
                  <p className="label">What We Know</p>
                  <div className="mt-3 space-y-3">
                    <div className="console-subpanel px-3 py-3">
                      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Counterpart Lead</p>
                      <p className="mt-1 text-sm text-textMain">
                        {selectedRivalLeader.leader.publicName} · {selectedRivalLeader.leader.title}
                      </p>
                      <p className="mt-2 text-[0.76rem] leading-relaxed text-textMuted">
                        {clipText(selectedRivalLeader.leader.psychologicalProfile.summary, 260)}
                      </p>
                    </div>
                    <div className="console-subpanel px-3 py-3">
                      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Assessed Objective</p>
                      <p className="mt-2 text-[0.76rem] leading-relaxed text-textMuted">
                        {clipText(selectedRivalLeader.leader.motivations.primary, 220)}
                      </p>
                    </div>
                    <div className="console-subpanel px-3 py-3">
                      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Known Red Line</p>
                      <p className="mt-2 text-[0.76rem] leading-relaxed text-textMuted">
                        {clipText(selectedRivalLeader.leader.motivations.redLine, 240)}
                      </p>
                    </div>
                    {(selectedRivalLeader.leader.intelFragments.opening ?? []).length > 0 ? (
                      <div className="console-subpanel px-3 py-3">
                        <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Opening Intelligence</p>
                        <div className="mt-2 space-y-2">
                          {(selectedRivalLeader.leader.intelFragments.opening ?? []).slice(0, 2).map((entry) => (
                            <p key={entry} className="text-[0.76rem] leading-relaxed text-textMuted">
                              {clipText(entry, 220)}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
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
      </section>
    </main>
  );
};
