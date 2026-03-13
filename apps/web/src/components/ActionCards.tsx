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
            Review the available responses, inspect the selected option below, then confirm it from the decision bar.
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
          Workflow: choose a response, review what it signals and risks, compare advisor views, then confirm it when you
          are ready to move the scenario forward.
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

              <div className="grid gap-2">
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">What This Signals</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{postureHint(selectedAction)}</p>
                </div>
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Who Will Notice</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{visibilityHint(selectedAction.visibility)}</p>
                </div>
                <div className="console-subpanel px-3 py-2.5">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Primary Risk</p>
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
              No response selected yet. Choose one option above to load the full tradeoffs, advisor views, and confirmation path.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
