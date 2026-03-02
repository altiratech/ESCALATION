import { useMemo } from 'react';

import type { BeatNode } from '@wargames/shared-types';

interface AdvisorPanelProps {
  beat: BeatNode | null;
}

const advisorMeta: Record<string, { name: string; title: string; stance: string }> = {
  cross: {
    name: 'ADM Vivian Cross',
    title: 'INDOPACOM',
    stance: 'Hawk'
  },
  chen: {
    name: 'Dr. Elias Chen',
    title: 'NSC Asia',
    stance: 'Dove'
  },
  okonkwo: {
    name: 'Sarah Okonkwo',
    title: 'Treasury',
    stance: 'Pragmatist'
  },
  reed: {
    name: 'COL Marcus Reed',
    title: 'CIA Ops',
    stance: 'Wildcard'
  }
};

const stanceTone: Record<string, string> = {
  Hawk: 'text-red-300',
  Dove: 'text-cyan-300',
  Pragmatist: 'text-amber-300',
  Wildcard: 'text-violet-300'
};

export const AdvisorPanel = ({ beat }: AdvisorPanelProps) => {
  const advisorEntries = useMemo(() => {
    if (!beat) {
      return [];
    }

    return Object.entries(beat.advisorLines).map(([advisorId, lines]) => ({
      advisorId,
      lines
    }));
  }, [beat]);

  return (
    <section className="card h-full space-y-4 p-4">
      <div className="flex items-center justify-between">
        <p className="label">Advisor Panel</p>
        <p className="text-xs text-textMuted">{beat ? beat.phase.toUpperCase() : 'NO BEAT'}</p>
      </div>

      {advisorEntries.length === 0 ? (
        <p className="rounded-md border border-borderTone bg-panelRaised px-3 py-2 text-sm text-textMuted">
          No advisor guidance is available for this beat.
        </p>
      ) : (
        <div className="space-y-3">
          {advisorEntries.map((entry) => {
            const profile = advisorMeta[entry.advisorId] ?? {
              name: entry.advisorId.toUpperCase(),
              title: 'Advisor',
              stance: 'Analyst'
            };
            const tone = stanceTone[profile.stance] ?? 'text-textMain';

            return (
              <article key={entry.advisorId} className="rounded-md border border-borderTone bg-panelRaised p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-textMain">{profile.name}</p>
                    <p className="text-[0.68rem] uppercase tracking-[0.1em] text-textMuted">{profile.title}</p>
                  </div>
                  <span className={`text-[0.68rem] uppercase tracking-[0.12em] ${tone}`}>{profile.stance}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-textMain">{entry.lines[0] ?? 'Awaiting guidance.'}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
