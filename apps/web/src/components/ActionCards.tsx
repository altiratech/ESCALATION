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
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="label">Decision Options</p>
        <p className="text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">{sorted.length} Available</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((action) => (
          <button
            key={action.id}
            type="button"
            className="group rounded-lg border border-borderTone bg-panelRaised/80 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-accent/70 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-55"
            disabled={disabled}
            onClick={() => onSelect(action.id)}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-[1rem] text-textMain group-hover:text-accent">{action.name}</p>
              <span className={`rounded-md px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] border ${visibilityTone(action.visibility)}`}>
                {action.visibility}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-textMuted">{action.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {action.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-md border border-borderTone/80 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.1em] text-textMuted">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-1 text-[0.66rem] leading-relaxed text-textMuted">
              <p>{visibilityHint(action.visibility)}</p>
              <p className="hidden text-accent/90 group-hover:block">{postureHint(action)}</p>
              <p className="hidden text-warning/90 group-hover:block">{riskHint(action)}</p>
            </div>
            <p className="mt-3 text-[0.62rem] uppercase tracking-[0.12em] text-accent/85">Commit Action</p>
          </button>
        ))}
      </div>
    </section>
  );
};
