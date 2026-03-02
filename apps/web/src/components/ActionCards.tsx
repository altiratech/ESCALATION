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

export const ActionCards = ({ actions, disabled, onSelect }: ActionCardsProps) => {
  const sorted = useMemo(() => {
    return [...actions].sort((left, right) => left.name.localeCompare(right.name));
  }, [actions]);

  return (
    <section className="card p-4">
      <p className="label">Decision Options</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((action) => (
          <button
            key={action.id}
            type="button"
            className="group rounded-md border border-borderTone bg-panelRaised px-3 py-3 text-left transition hover:border-accent/70 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-55"
            disabled={disabled}
            onClick={() => onSelect(action.id)}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-[1rem] text-textMain group-hover:text-accent">{action.name}</p>
              <span className={`rounded px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] border ${visibilityTone(action.visibility)}`}>
                {action.visibility}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-textMuted">{action.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {action.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-sm border border-borderTone px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.1em] text-textMuted">
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
