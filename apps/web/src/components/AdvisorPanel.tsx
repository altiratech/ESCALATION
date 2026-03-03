import { useMemo, useState } from 'react';

import type { BeatNode } from '@wargames/shared-types';

interface AdvisorPanelProps {
  beat: BeatNode | null;
}

const advisorMeta: Record<string, { name: string; title: string; stance: string; bio: string; perspective: string }> = {
  cross: {
    name: 'ADM Vivian Cross',
    title: 'INDOPACOM',
    stance: 'Hawk',
    bio: 'Career naval commander with repeated Pacific theater deployment experience.',
    perspective: 'Favors visible deterrence early to prevent a wider conflict later.'
  },
  chen: {
    name: 'Dr. Elias Chen',
    title: 'NSC Asia',
    stance: 'Dove',
    bio: 'Diplomatic strategist focused on allied cohesion and back-channel negotiation.',
    perspective: 'Treats escalation control as the primary objective in every turn.'
  },
  okonkwo: {
    name: 'Sarah Okonkwo',
    title: 'Treasury',
    stance: 'Pragmatist',
    bio: 'Treasury operator specializing in sanctions architecture and market-contagion risk.',
    perspective: 'Pushes for options that preserve coalition leverage with contained economic spillover.'
  },
  reed: {
    name: 'COL Marcus Reed',
    title: 'CIA Ops',
    stance: 'Wildcard',
    bio: 'Covert operations planner with regional intelligence asset access.',
    perspective: 'Prefers asymmetric pressure and deniable moves over overt declarations.'
  }
};

const stanceTone: Record<string, string> = {
  Hawk: 'text-red-300',
  Dove: 'text-cyan-300',
  Pragmatist: 'text-amber-300',
  Wildcard: 'text-violet-300'
};

export const AdvisorPanel = ({ beat }: AdvisorPanelProps) => {
  const [expandedAdvisorId, setExpandedAdvisorId] = useState<string | null>(null);

  const advisorEntries = useMemo(() => {
    if (!beat) {
      return [];
    }

    return Object.entries(beat.advisorLines).map(([advisorId, lines]) => ({
      advisorId,
      lines
    }));
  }, [beat]);
  const defaultExpandedId = advisorEntries[0]?.advisorId ?? null;
  const activeExpandedId = advisorEntries.some((entry) => entry.advisorId === expandedAdvisorId)
    ? expandedAdvisorId
    : defaultExpandedId;

  return (
    <section className="card h-full space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="label">Advisor Channel</p>
          <h2 className="mt-2 font-display text-xl text-textMain">Strategic Inputs</h2>
        </div>
        <p className="rounded-md border border-borderTone bg-panelRaised/80 px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-textMuted">
          Live Counsel
        </p>
      </div>

      {advisorEntries.length === 0 ? (
        <p className="rounded-lg border border-borderTone bg-panelRaised/70 px-3 py-2 text-sm text-textMuted">
          No advisor guidance is available for this beat.
        </p>
      ) : (
        <div className="space-y-3">
          {advisorEntries.map((entry) => {
            const profile = advisorMeta[entry.advisorId] ?? {
              name: entry.advisorId.toUpperCase(),
              title: 'Advisor',
              stance: 'Analyst',
              bio: 'Profile pending content authoring.',
              perspective: 'Monitoring available intelligence before recommending a posture.'
            };
            const tone = stanceTone[profile.stance] ?? 'text-textMain';

            return (
              <article key={entry.advisorId} className="rounded-lg border border-borderTone bg-panelRaised/75 p-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedAdvisorId(activeExpandedId === entry.advisorId ? null : entry.advisorId)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-textMain">{profile.name}</p>
                      <p className="text-[0.68rem] uppercase tracking-[0.1em] text-textMuted">{profile.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border border-borderTone/70 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] ${tone}`}>{profile.stance}</span>
                      <span className="text-[0.62rem] uppercase tracking-[0.1em] text-accent">
                        {activeExpandedId === entry.advisorId ? 'Hide' : 'Open'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-textMain">{entry.lines[0] ?? 'Awaiting guidance.'}</p>
                </button>
                {activeExpandedId === entry.advisorId ? (
                  <div className="mt-3 space-y-2 border-t border-borderTone/70 pt-3">
                    <p className="text-[0.72rem] leading-relaxed text-textMuted">
                      <span className="text-textMain">Background:</span> {profile.bio}
                    </p>
                    <p className="text-[0.72rem] leading-relaxed text-textMuted">
                      <span className="text-textMain">Lens:</span> {profile.perspective}
                    </p>
                    <div className="space-y-1.5">
                      {entry.lines.slice(1).map((line, index) => (
                        <p key={`${entry.advisorId}:detail:${index}`} className="text-[0.75rem] leading-relaxed text-textMuted">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
