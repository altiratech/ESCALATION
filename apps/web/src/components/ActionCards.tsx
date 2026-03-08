import { useMemo, useState } from 'react';

import type { ActionDefinition } from '@wargames/shared-types';

import type { AdvisorActionRead } from '../lib/decisionSupport';

interface ActionCardsProps {
  actions: ActionDefinition[];
  disabled: boolean;
  selectedActionId: string | null;
  selectedActionReads: AdvisorActionRead[];
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
    return 'Signals a visibly harder posture and compresses the response window.';
  }
  if (netEscalation <= -0.5) {
    return 'Signals restraint and may reopen diplomatic space if the coalition stays aligned.';
  }
  return 'Carries a mixed signal profile and keeps multiple interpretations in play.';
};

const visibilityHint = (visibility: ActionDefinition['visibility']): string => {
  if (visibility === 'public') {
    return 'Immediately visible to allies, adversaries, markets, and press channels.';
  }
  if (visibility === 'semi-public') {
    return 'Likely to circulate through diplomatic and coalition channels within hours.';
  }
  return 'Initially deniable, but exposure risk grows if execution degrades or follow-on effects surface.';
};

const riskHint = (action: ActionDefinition): string => {
  const dominant = Math.max(
    action.signal.humiliationRisk,
    action.signal.economicStressSignal,
    action.signal.allianceStressSignal
  );
  if (dominant === action.signal.humiliationRisk) {
    return 'Main downside: counterpart humiliation and retaliatory pressure.';
  }
  if (dominant === action.signal.economicStressSignal) {
    return 'Main downside: market stress, shipping disruption, or commercial spillover.';
  }
  return 'Main downside: coalition friction and message discipline problems.';
};

const alignmentTone: Record<AdvisorActionRead['alignment'], string> = {
  supports: 'border-positive/60 text-positive',
  cautions: 'border-warning/60 text-warning',
  opposes: 'border-red-500/60 text-red-300'
};

export const ActionCards = ({
  actions,
  disabled,
  selectedActionId,
  selectedActionReads,
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
    <section className="console-panel p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Primary Decision</p>
          <p className="mt-2 text-[0.74rem] leading-relaxed text-textMuted">
            Select one response below, review the full tradeoffs, then commit from the war-room header.
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
          Workflow: pick a decision, inspect the detail pane, compare advisor reactions, then use the header commit
          button to resolve the turn.
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {sorted.map((action) => {
          const active = action.id === selectedActionId;
          return (
            <button
              key={action.id}
              type="button"
              className={`w-full border px-3 py-2 text-left transition ${
                active
                  ? 'border-accent bg-accent/12 text-textMain shadow-[inset_3px_0_0_rgba(255,177,0,1)]'
                  : 'border-borderTone/80 bg-panelRaised/55 text-textMuted hover:border-accent/70 hover:bg-panelRaised/75 hover:text-textMain'
              } ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
              disabled={disabled}
              onClick={() => onSelect(action.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-[0.96rem] text-inherit">{action.name}</p>
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.12em] ${visibilityTone(action.visibility)}`}
                    >
                      {action.visibility}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.66rem] leading-relaxed text-textMuted">{action.summary}</p>
                </div>
                <span className="shrink-0 text-[0.58rem] uppercase tracking-[0.12em] text-accent/90">
                  {active ? 'Selected' : 'Inspect'}
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
                <p className="label">Selected Action</p>
                <h3 className="mt-2 font-display text-xl text-textMain">{selectedAction.name}</h3>
              </div>
              <span
                className={`rounded-md border px-2 py-1 text-[0.58rem] uppercase tracking-[0.12em] ${visibilityTone(selectedAction.visibility)}`}
              >
                {selectedAction.visibility}
              </span>
            </div>

            <p className="text-[0.8rem] leading-relaxed text-textMain">{selectedAction.summary}</p>

            <div className="grid gap-2">
              <div className="console-subpanel px-3 py-2.5">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Signal</p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{postureHint(selectedAction)}</p>
              </div>
              <div className="console-subpanel px-3 py-2.5">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Exposure</p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{visibilityHint(selectedAction.visibility)}</p>
              </div>
              <div className="console-subpanel px-3 py-2.5">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Primary Risk</p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{riskHint(selectedAction)}</p>
              </div>
            </div>

            <div>
              <p className="label">Advisory Read</p>
              <div className="mt-2 space-y-2">
                {selectedActionReads.map((read) => (
                  <div key={read.advisorId} className="console-subpanel px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.74rem] text-textMain">{read.advisorName}</p>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[0.54rem] uppercase tracking-[0.12em] ${alignmentTone[read.alignment]}`}
                      >
                        {read.alignment}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.68rem] leading-relaxed text-textMuted">{read.rationale}</p>
                  </div>
                ))}
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
            <p className="label">Selected Action</p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-textMuted">
              No decision selected yet. Pick one option above to inspect the tradeoffs before committing the turn.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
