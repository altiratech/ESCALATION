import { useEffect, useMemo, useState } from 'react';

import type { ActionDefinition, AdvisorDossier, BeatNode } from '@wargames/shared-types';

import { getAdvisorActionReads } from '../lib/decisionSupport';

interface AdvisorPanelProps {
  beat: BeatNode | null;
  scenarioId: string;
  advisorDossiers: AdvisorDossier[];
  selectedAction: ActionDefinition | null;
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

const alignmentTone: Record<'supports' | 'cautions' | 'opposes', string> = {
  supports: 'border-positive/60 text-positive',
  cautions: 'border-warning/60 text-warning',
  opposes: 'border-red-500/60 text-red-300'
};

export const AdvisorPanel = ({ beat, scenarioId, advisorDossiers, selectedAction }: AdvisorPanelProps) => {
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

  const dossierByAdvisorId = useMemo(
    () => new Map(advisorDossiers.map((dossier) => [dossier.id, dossier])),
    [advisorDossiers]
  );

  const selectedActionReadsByAdvisorId = useMemo(() => {
    if (!selectedAction) {
      return new Map<string, ReturnType<typeof getAdvisorActionReads>[number]>();
    }

    const activeDossiers = advisorEntries.map((entry) => dossierByAdvisorId.get(entry.advisorId) ?? fallbackProfile(entry.advisorId));
    return new Map(
      getAdvisorActionReads(selectedAction, activeDossiers).map((read) => [read.advisorId, read])
    );
  }, [advisorEntries, dossierByAdvisorId, selectedAction]);

  useEffect(() => {
    setExpandedAdvisorId(null);
  }, [beat?.id]);
  const activeExpandedId = advisorEntries.some((entry) => entry.advisorId === expandedAdvisorId)
    ? expandedAdvisorId
    : null;

  return (
    <section className="console-subpanel h-full px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="label">Advisor Channel</p>
          <h2 className="mt-2 font-display text-lg text-textMain">Advisor Guidance</h2>
          <p className="mt-1 text-[0.72rem] leading-relaxed text-textMuted">
            Open an advisor to inspect the full rationale behind the currently selected response.
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
            const actionRead = selectedActionReadsByAdvisorId.get(entry.advisorId) ?? null;

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
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-textMain">{dossier.name}</p>
                      <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">
                        {dossier.title} · {dossier.organization}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {actionRead ? (
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[0.54rem] uppercase tracking-[0.12em] ${alignmentTone[actionRead.alignment]}`}
                        >
                          {actionRead.alignment}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-md border border-borderTone/70 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] ${tone}`}
                      >
                        {dossier.stance}
                      </span>
                      <span className="text-[0.58rem] uppercase tracking-[0.12em] text-accent">
                        {activeExpandedId === entry.advisorId ? 'Hide' : 'Open'}
                      </span>
                    </div>
                  </div>
                </button>
                {activeExpandedId === entry.advisorId ? (
                  <div className="mt-3 grid gap-2 border-t border-borderTone/70 pt-3">
                    {actionRead ? (
                      <div className="console-subpanel px-3 py-2.5">
                        <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
                          Current read on {selectedAction?.name ?? 'selected response'}
                        </p>
                        <p className="mt-1 text-[0.7rem] leading-relaxed text-textMain">{actionRead.rationale}</p>
                      </div>
                    ) : (
                      <div className="console-subpanel px-3 py-2.5">
                        <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Action guidance</p>
                        <p className="mt-1 text-[0.7rem] leading-relaxed text-textMain">
                          Select a response in the selector to see how this advisor leans on the available options.
                        </p>
                      </div>
                    )}
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
                          <span className="text-textMain">Scenario assessment:</span>{' '}
                          {clipText(scenarioSpecific.openingAssessment, 240)}
                        </p>
                        <p className="text-[0.7rem] leading-relaxed text-textMuted">
                          <span className="text-textMain">Red line:</span> {clipText(scenarioSpecific.redLine, 200)}
                        </p>
                      </>
                    ) : null}
                    <div className="space-y-1.5">
                      {entry.lines.map((line, index) => (
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
