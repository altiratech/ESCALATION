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

const clipText = (value: string, limit = 220): string =>
  value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;

export const StartScreen = ({ reference, loading, error, onStart }: StartScreenProps) => {
  const [codename, setCodename] = useState('SABLE-ONE');
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedSignal, setExpandedSignal] = useState<number | null>(0);

  const defaultScenario = reference.scenarios[0]?.id ?? '';

  const [scenarioId, setScenarioId] = useState(defaultScenario);
  const [timerMode, setTimerMode] = useState<'standard' | 'relaxed' | 'off'>('standard');

  const selectedScenario = useMemo(
    () => reference.scenarios.find((entry) => entry.id === scenarioId),
    [reference.scenarios, scenarioId]
  );
  const selectedScenarioWorld = useMemo(
    () => reference.scenarioWorld.find((entry) => entry.scenarioId === scenarioId) ?? null,
    [reference.scenarioWorld, scenarioId]
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
  const signalDetails = useMemo(
    () =>
      openingSignals.map((_, index) => {
        const details: string[] = [];
        if (index === 0 && startingBeat?.memoLine) {
          details.push(startingBeat.memoLine);
        }
        if (index === 1 && startingBeat?.tickerLine) {
          details.push(startingBeat.tickerLine);
        }
        if (index === 0 && startingBeat?.sceneFragments[1]) {
          details.push(startingBeat.sceneFragments[1]);
        }
        if (details.length === 0) {
          details.push('Additional field confirmation is pending from intelligence channels.');
        }
        return details;
      }),
    [openingSignals, startingBeat?.memoLine, startingBeat?.tickerLine, startingBeat?.sceneFragments]
  );
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
    () => (selectedScenarioWorld?.stakeholders ?? []).slice(0, 3),
    [selectedScenarioWorld]
  );
  const keyFeaturePreview = useMemo(
    () => (selectedScenarioWorld?.region.keyFeatures ?? []).slice(0, 4),
    [selectedScenarioWorld]
  );
  const intelligenceGapPreview = useMemo(
    () => (selectedScenarioWorld?.intelligenceGaps ?? []).slice(0, 2),
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1400px] items-center px-4 py-6 sm:px-6 lg:px-8">
      <section className="card grid w-full grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="label">Escalation // Pre-Mission Dossier</p>
            <h1 className="font-display text-4xl leading-none text-accent sm:text-5xl">
              {selectedScenario?.name ?? 'Scenario Briefing'}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-textMuted">
              The situation is deteriorating. Your next ten turns will decide whether this crisis stabilizes, hardens into
              conflict, or breaks containment entirely.
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
            <p className="label">Scenario Brief</p>
            <h2 className="mt-3 font-display text-2xl text-textMain">{selectedScenario?.name ?? 'No scenario selected'}</h2>
            <p className="mt-3 text-sm leading-relaxed text-textMuted">
              {selectedScenario?.briefing ?? 'Select a scenario to review strategic role and escalation context.'}
            </p>
            <div className="mt-4 rounded-md border border-borderTone/70 bg-surface/35 px-3 py-2">
              <p className="label">Situation Report</p>
              <p className="mt-2 text-sm leading-relaxed text-textMain">
                {startingBeat?.sceneFragments[0] ?? 'Opening intelligence package unavailable.'}
              </p>
            </div>
            {selectedScenarioWorld ? (
              <div className="mt-4 rounded-md border border-borderTone/70 bg-surface/35 px-3 py-2">
                <p className="label">Theater Snapshot</p>
                <p className="mt-2 text-xs leading-relaxed text-textMain">
                  {selectedScenarioWorld.region.name} · {selectedScenarioWorld.dateAnchor.month} {selectedScenarioWorld.dateAnchor.year}
                </p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-textMuted">
                  {selectedScenarioWorld.region.coordinates}
                </p>
                <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                  {clipText(selectedScenarioWorld.economicBackdrop.globalConditions)}
                </p>
              </div>
            ) : null}
            {openingSignals.length > 0 ? (
              <div className="mt-4">
                <p className="label">Initial Intelligence</p>
                <div className="mt-2 space-y-2">
                  {openingSignals.map((headline, index) => {
                    const open = expandedSignal === index;
                    return (
                      <article key={headline} className="rounded-md border border-borderTone/70 bg-surface/35">
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-2 py-1.5 text-left"
                          onClick={() => setExpandedSignal(open ? null : index)}
                        >
                          <p className="text-xs leading-relaxed text-textMuted">{headline}</p>
                          <span className="text-[0.62rem] uppercase tracking-[0.1em] text-accent">{open ? 'Hide' : 'Open'}</span>
                        </button>
                        {open ? (
                          <div className="space-y-1 border-t border-borderTone/70 px-2 py-1.5 text-[0.7rem] leading-relaxed text-textMuted">
                            {signalDetails[index]?.map((detail) => (
                              <p key={`${headline}:${detail}`}>{detail}</p>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {keyFeaturePreview.length > 0 ? (
              <div className="mt-4">
                <p className="label">Strategic Features</p>
                <div className="mt-2 space-y-1.5">
                  {keyFeaturePreview.map((feature) => (
                    <p key={feature} className="rounded-md border border-borderTone/70 bg-surface/35 px-2 py-1.5 text-[0.72rem] leading-relaxed text-textMuted">
                      {feature}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {advisorFirstTakes.length > 0 ? (
              <div className="mt-4">
                <p className="label">Senior Staff Assessment</p>
                <div className="mt-2 space-y-2">
                  {advisorFirstTakes.map((entry) => (
                    <div key={entry.advisorId} className="rounded-md border border-borderTone/70 bg-surface/35 px-2 py-1.5">
                      <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">
                        {advisorNameById[entry.advisorId] ?? entry.advisorId.toUpperCase()}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-textMain">{entry.line}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {stakeholderPreview.length > 0 ? (
              <div className="mt-4">
                <p className="label">Primary Stakeholders</p>
                <div className="mt-2 space-y-2">
                  {stakeholderPreview.map((stakeholder) => (
                    <div key={stakeholder.id} className="rounded-md border border-borderTone/70 bg-surface/35 px-2 py-1.5">
                      <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">
                        {stakeholder.type.replace('_', ' ')}
                      </p>
                      <p className="mt-1 text-xs text-textMain">{stakeholder.name}</p>
                      <p className="mt-1 text-[0.72rem] leading-relaxed text-textMuted">
                        {clipText(stakeholder.disposition, 140)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {intelligenceGapPreview.length > 0 ? (
              <div className="mt-4">
                <p className="label">Known Intelligence Gaps</p>
                <div className="mt-2 space-y-1.5">
                  {intelligenceGapPreview.map((gap) => (
                    <p key={gap} className="rounded-md border border-borderTone/70 bg-surface/35 px-2 py-1.5 text-[0.72rem] leading-relaxed text-textMuted">
                      {gap}
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
                <span>Theater</span>
                <span className="text-textMain">
                  {selectedScenario?.environment ? environmentLabel[selectedScenario.environment] ?? 'Global theater' : 'N/A'}
                </span>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
};
