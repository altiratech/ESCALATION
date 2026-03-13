import { useMemo, useState } from 'react';

import type { ActionDefinition } from '@wargames/shared-types';

interface ActionCardsProps {
  actions: ActionDefinition[];
  disabled: boolean;
  selectedActionId: string | null;
  actionAdvisorSummaries: Map<string, { supports: number; cautions: number; opposes: number }>;
  onSelect: (actionId: string) => void;
}

const visibilityTone = (visibility: ActionDefinition['visibility']): string => {
  if (visibility === 'public') {
    return 'border-warning/70 text-warning';
  }
  if (visibility === 'semi-public') {
    return 'border-accent/70 text-accent';
  }
  return 'border-positive/70 text-positive';
};

const postureHint = (action: ActionDefinition): string => {
  const netEscalation = action.signal.escalatory - action.signal.deescalatory;
  if (netEscalation >= 0.5) {
    return 'Beijing is likely to read this as a firmer show of resolve; allies and markets will judge whether it looks disciplined or impulsive.';
  }
  if (netEscalation <= -0.5) {
    return 'Beijing is likely to read this as controlled restraint; allies will test whether it preserves leverage or signals retreat.';
  }
  return 'Beijing is likely to read this as a mixed signal that preserves room to maneuver but may delay allied and market conviction.';
};

const visibilityHint = (visibility: ActionDefinition['visibility']): string => {
  if (visibility === 'public') {
    return 'Governments, the counterpart, media channels, insurers, and market participants can react within minutes.';
  }
  if (visibility === 'semi-public') {
    return 'Allied governments, counterpart officials, and industry channels are likely to react first; broader market awareness can follow on leaks.';
  }
  return 'Initial reaction should stay inside closed channels, but execution problems can still push the move into public view.';
};

const riskHint = (action: ActionDefinition): string => {
  const dominant = Math.max(
    action.signal.humiliationRisk,
    action.signal.economicStressSignal,
    action.signal.allianceStressSignal
  );
  if (dominant === action.signal.humiliationRisk) {
    return 'Principal risk: Beijing may answer with a sharper move rather than appear to yield under pressure.';
  }
  if (dominant === action.signal.economicStressSignal) {
    return 'Principal risk: shipping, inventory, insurance, and market confidence could deteriorate faster than the coalition can stabilize them.';
  }
  return 'Principal risk: allies may interpret the move differently, weakening joint leverage and broader market confidence.';
};

const firstImpactHint = (action: ActionDefinition): string => {
  if (action.signal.economicStressSignal >= 0.55) {
    return 'Likely first impact: shipping rates, insurance pricing, semiconductor-sensitive names, and broad risk sentiment are the first places to move.';
  }
  if (action.signal.allianceStressSignal >= 0.55) {
    return 'Likely first impact: allied messaging and coalition discipline may wobble, which quickly feeds uncertainty into commercial planning and markets.';
  }
  const netEscalation = action.signal.escalatory - action.signal.deescalatory;
  if (netEscalation >= 0.5) {
    return 'Likely first impact: counterpart military and diplomatic channels harden first; market repricing usually follows once follow-through becomes visible.';
  }
  if (netEscalation <= -0.5) {
    return 'Likely first impact: sentiment and freight expectations may stabilize briefly, provided the move is not read as concession.';
  }
  return 'Likely first impact: most stakeholders will wait for follow-through before repricing risk or changing posture.';
};

export const ActionCards = ({
  actions,
  disabled,
  selectedActionId,
  actionAdvisorSummaries,
  onSelect
}: ActionCardsProps) => {
  const [showHelp, setShowHelp] = useState(false);

  const sorted = useMemo(() => {
    return [...actions].sort((left, right) => left.name.localeCompare(right.name));
  }, [actions]);

  const selectedAction = useMemo(
    () => sorted.find((entry) => entry.id === selectedActionId) ?? null,
    [selectedActionId, sorted]
  );

  return (
    <section className="console-subpanel h-full px-3 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Response Options</p>
          <p className="mt-2 text-[0.74rem] leading-relaxed text-textMuted">
            Choose a response, review its likely strategic and market effects below, then confirm it when you are ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center border border-borderTone bg-panelRaised text-[0.72rem] text-textMuted transition hover:border-accent hover:text-textMain"
            onClick={() => setShowHelp((current) => !current)}
          >
            ?
          </button>
          <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">{sorted.length} options</p>
        </div>
      </div>

      {showHelp ? (
        <div className="mt-3 border border-borderTone/80 bg-panelRaised/55 px-3 py-2 text-[0.68rem] leading-relaxed text-textMuted">
          Workflow: choose a response, review how it is likely to be read, compare advisor views, and then confirm it
          when you are ready to move the scenario forward.
        </div>
      ) : null}

      <div className="mt-3">
        <p className="label">Available Responses</p>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {sorted.map((action) => {
          const active = action.id === selectedActionId;
          const summary = actionAdvisorSummaries.get(action.id) ?? { supports: 0, cautions: 0, opposes: 0 };
          return (
            <button
              key={action.id}
              type="button"
              className={`w-full border px-3 py-2.5 text-left transition ${
                active
                  ? 'border-accent bg-accent/12 text-textMain shadow-[inset_0_-2px_0_rgba(255,177,0,1)]'
                  : 'border-borderTone/80 bg-panelRaised/55 text-textMuted hover:border-accent/70 hover:bg-panelRaised/75 hover:text-textMain'
              } ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
              disabled={disabled}
              onClick={() => onSelect(action.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-[0.92rem] text-inherit">{action.name}</p>
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.12em] ${visibilityTone(action.visibility)}`}
                    >
                      {action.visibility}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">
                    {action.tags.slice(0, 2).join(' · ') || 'Response option'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-md border border-positive/60 px-1.5 py-0.5 text-[0.54rem] uppercase tracking-[0.12em] text-positive">
                      Supports {summary.supports}
                    </span>
                    <span className="rounded-md border border-warning/60 px-1.5 py-0.5 text-[0.54rem] uppercase tracking-[0.12em] text-warning">
                      Cautions {summary.cautions}
                    </span>
                    <span className="rounded-md border border-red-500/60 px-1.5 py-0.5 text-[0.54rem] uppercase tracking-[0.12em] text-red-300">
                      Opposes {summary.opposes}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-[0.58rem] uppercase tracking-[0.12em] text-accent/90">
                  {active ? 'Selected' : 'Open'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border border-borderTone bg-panelRaised/40 p-3">
        {selectedAction ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label">Selected Response</p>
                  <h3 className="mt-2 font-display text-xl text-textMain">{selectedAction.name}</h3>
                </div>
              <span
                className={`rounded-md border px-2 py-1 text-[0.58rem] uppercase tracking-[0.12em] ${visibilityTone(selectedAction.visibility)}`}
              >
                {selectedAction.visibility}
              </span>
            </div>

            <div className="space-y-2">
              <p className="label">What This Does</p>
              <p className="text-[0.8rem] leading-relaxed text-textMain">{selectedAction.summary}</p>
            </div>

              <div className="grid gap-2 lg:grid-cols-2">
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">How It Will Be Read</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{postureHint(selectedAction)}</p>
                </div>
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Who Reacts First</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{visibilityHint(selectedAction.visibility)}</p>
                </div>
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Likely First Impact</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{firstImpactHint(selectedAction)}</p>
                </div>
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Principal Risk</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{riskHint(selectedAction)}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selectedAction.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-borderTone/80 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.1em] text-textMuted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="label">Selected Response</p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-textMuted">
              No response selected yet. Choose one option above to load the likely consequences, advisor views, and confirmation path.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
