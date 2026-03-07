import { useEffect, useMemo, useState } from 'react';

import type { AdvisorDossier, BeatNode } from '@wargames/shared-types';

interface AdvisorPanelProps {
  beat: BeatNode | null;
  scenarioId: string;
  advisorDossiers: AdvisorDossier[];
}

const clipText = (value: string, limit = 220): string =>
  value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;

const fallbackProfile = (advisorId: string): AdvisorDossier => ({
  id: advisorId,
  name: advisorId.toUpperCase(),
  title: 'Advisor',
  organization: 'Command Staff',
  stance: 'Analyst',
  shortBio: 'Profile pending content authoring.',
  fullBio: 'Profile pending content authoring.',
  perspective: 'Monitoring available intelligence before recommending a posture.',
  decisionFramework: 'Decision model unavailable for this advisor.',
  blindSpots: 'Not yet profiled.',
  relationships: {},
  formativeExperience: 'No profile data available.',
  catchphrases: [],
  pressureResponse: 'No pressure profile available.',
  trustTriggers: {
    gainsConfidence: 'No profile data available.',
    losesConfidence: 'No profile data available.'
  },
  scenarioSpecific: {}
});

const stanceTone: Record<string, string> = {
  Hawk: 'text-red-300',
  Dove: 'text-cyan-300',
  Pragmatist: 'text-amber-300',
  Wildcard: 'text-violet-300'
};

export const AdvisorPanel = ({ beat, scenarioId, advisorDossiers }: AdvisorPanelProps) => {
  const [expandedAdvisorId, setExpandedAdvisorId] = useState<string | null | undefined>(undefined);

  const advisorEntries = useMemo(() => {
    if (!beat) {
      return [];
    }

    return Object.entries(beat.advisorLines).map(([advisorId, lines]) => ({
      advisorId,
      lines
    }));
  }, [beat]);

  const dossierByAdvisorId = useMemo(
    () => new Map(advisorDossiers.map((dossier) => [dossier.id, dossier])),
    [advisorDossiers]
  );

  useEffect(() => {
    setExpandedAdvisorId(undefined);
  }, [beat?.id]);

  const defaultExpandedId = advisorEntries[0]?.advisorId ?? null;
  const activeExpandedId = expandedAdvisorId === undefined
    ? defaultExpandedId
    : advisorEntries.some((entry) => entry.advisorId === expandedAdvisorId)
      ? expandedAdvisorId
      : null;

  return (
    <section className="console-panel h-full p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="label">Advisor Channel</p>
          <h2 className="mt-2 font-display text-lg text-textMain">Strategic Inputs</h2>
          <p className="mt-1 text-[0.72rem] leading-relaxed text-textMuted">
            Open an advisor for their lens, scenario-specific red line, and this turn&apos;s reasoning.
          </p>
        </div>
        <p className="rounded-md border border-borderTone bg-panelRaised/60 px-2 py-1 text-[0.6rem] uppercase tracking-[0.12em] text-textMuted">
          Live Counsel
        </p>
      </div>

      {advisorEntries.length === 0 ? (
        <p className="mt-3 rounded-md border border-borderTone bg-panelRaised/60 px-3 py-2 text-sm text-textMuted">
          No advisor guidance is available for this beat.
        </p>
      ) : (
        <div className="console-scroll mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
          {advisorEntries.map((entry) => {
            const dossier = dossierByAdvisorId.get(entry.advisorId) ?? fallbackProfile(entry.advisorId);
            const scenarioSpecific = dossier.scenarioSpecific[scenarioId];
            const tone = stanceTone[dossier.stance] ?? 'text-textMain';

            return (
              <article
                key={entry.advisorId}
                className={`rounded-md border px-3 py-3 transition ${
                  activeExpandedId === entry.advisorId
                    ? 'border-accent/50 bg-panelRaised/80'
                    : 'border-borderTone/70 bg-panelRaised/50'
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedAdvisorId(activeExpandedId === entry.advisorId ? null : entry.advisorId)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-textMain">{dossier.name}</p>
                      <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">
                        {dossier.title} · {dossier.organization}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border border-borderTone/70 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] ${tone}`}>
                        {dossier.stance}
                      </span>
                      <span className="text-[0.58rem] uppercase tracking-[0.12em] text-accent">
                        {activeExpandedId === entry.advisorId ? 'Hide' : 'Open'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[0.8rem] leading-relaxed text-textMain">{entry.lines[0] ?? 'Awaiting guidance.'}</p>
                </button>
                {activeExpandedId === entry.advisorId ? (
                  <div className="mt-3 grid gap-2 border-t border-borderTone/70 pt-3">
                    <p className="text-[0.7rem] leading-relaxed text-textMuted">
                      <span className="text-textMain">Background:</span> {clipText(dossier.shortBio, 180)}
                    </p>
                    <p className="text-[0.7rem] leading-relaxed text-textMuted">
                      <span className="text-textMain">Lens:</span> {clipText(dossier.perspective, 220)}
                    </p>
                    <p className="text-[0.7rem] leading-relaxed text-textMuted">
                      <span className="text-textMain">Decision frame:</span> {clipText(dossier.decisionFramework, 240)}
                    </p>
                    {scenarioSpecific ? (
                      <>
                        <p className="text-[0.7rem] leading-relaxed text-textMuted">
                          <span className="text-textMain">Scenario Assessment:</span> {clipText(scenarioSpecific.openingAssessment, 240)}
                        </p>
                        <p className="text-[0.7rem] leading-relaxed text-textMuted">
                          <span className="text-textMain">Red Line:</span> {clipText(scenarioSpecific.redLine, 200)}
                        </p>
                      </>
                    ) : null}
                    <div className="space-y-1.5">
                      {entry.lines.slice(1).map((line, index) => (
                        <p key={`${entry.advisorId}:detail:${index}`} className="text-[0.72rem] leading-relaxed text-textMuted">
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
