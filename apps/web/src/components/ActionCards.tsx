import { useMemo } from 'react';

import type { ActionDefinition } from '@wargames/shared-types';

interface ActionCardsProps {
  actions: ActionDefinition[];
  disabled: boolean;
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
  if (netEscalation >= 20) {
    return 'Likely to signal a harder public posture and compress decision space.';
  }
  if (netEscalation <= -20) {
    return 'Signals restraint and may reopen diplomatic channels.';
  }
  return 'Balanced posture with mixed strategic signaling.';
};

const visibilityHint = (visibility: ActionDefinition['visibility']): string => {
  if (visibility === 'public') {
    return 'Immediately visible to allies, adversaries, and press channels.';
  }
  if (visibility === 'semi-public') {
    return 'Likely to leak through coalition and diplomatic channels.';
  }
  return 'Covert by default, but exposure risk remains if operations degrade.';
};

const riskHint = (action: ActionDefinition): string => {
  const dominant = Math.max(
    action.signal.humiliationRisk,
    action.signal.economicStressSignal,
    action.signal.allianceStressSignal
  );
  if (dominant === action.signal.humiliationRisk) {
    return 'Primary risk: adversary humiliation response.';
  }
  if (dominant === action.signal.economicStressSignal) {
    return 'Primary risk: market stress and commercial disruption.';
  }
  return 'Primary risk: coalition friction and alliance strain.';
};

export const ActionCards = ({ actions, disabled, onSelect }: ActionCardsProps) => {
  const sorted = useMemo(() => {
    return [...actions].sort((left, right) => left.name.localeCompare(right.name));
  }, [actions]);

  return (
    <section className="console-panel p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Primary Decision</p>
          <p className="mt-2 text-[0.74rem] leading-relaxed text-textMuted">
            Choose one response to resolve the current turn. Clicking a card commits immediately and advances the simulation.
          </p>
        </div>
        <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">{sorted.length} options</p>
      </div>
      <div className="console-scroll mt-3 max-h-[30rem] space-y-2 overflow-y-auto pr-1">
        {sorted.map((action) => (
          <button
            key={action.id}
            type="button"
            className="group w-full rounded-md border border-borderTone/80 bg-panelRaised/55 px-3 py-3 text-left transition hover:border-accent/70 hover:bg-panelRaised/75 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={disabled}
            onClick={() => onSelect(action.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-[0.98rem] text-textMain group-hover:text-accent">{action.name}</p>
                  <span className={`rounded-md px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.12em] border ${visibilityTone(action.visibility)}`}>
                    {action.visibility}
                  </span>
                </div>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-textMuted">{action.summary}</p>
              </div>
              <span className="shrink-0 text-[0.58rem] uppercase tracking-[0.12em] text-accent/90">Commit</span>
            </div>
            <div className="mt-2 grid gap-1 text-[0.67rem] leading-relaxed text-textMuted">
              <p><span className="text-textMain">Signal:</span> {postureHint(action)}</p>
              <p><span className="text-textMain">Exposure:</span> {visibilityHint(action.visibility)}</p>
              <p><span className="text-textMain">Risk:</span> {riskHint(action)}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {action.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-md border border-borderTone/80 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.1em] text-textMuted">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
