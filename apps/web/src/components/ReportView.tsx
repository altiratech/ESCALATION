import type { AdvisorDossier, MeterKey, PostGameReport } from '@wargames/shared-types';

import { TimelineChart } from './TimelineChart';

interface ReportViewProps {
  report: PostGameReport;
  advisorDossiers: AdvisorDossier[];
  onRestart: () => void;
}

const meterLabel: Record<MeterKey, string> = {
  economicStability: 'Economic Stability',
  energySecurity: 'Energy Security',
  domesticCohesion: 'Domestic Cohesion',
  militaryReadiness: 'Military Readiness',
  allianceTrust: 'Alliance Trust',
  escalationIndex: 'Escalation Index'
};

const signed = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

export const ReportView = ({ report, advisorDossiers, onRestart }: ReportViewProps) => {
  const advisorNameById = new Map(advisorDossiers.map((entry) => [entry.id, entry.name]));
  const deepDebrief = report.fullCausality.deepDebrief;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
      <section className="card p-5">
        <p className="label">Post-Game Intelligence Assessment</p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl text-accent">{report.fullCausality.outcomeNarrative.title}</h1>
          <button
            type="button"
            className="rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent/10"
            onClick={onRestart}
          >
            New Episode
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-textMain">{report.fullCausality.outcomeNarrative.summary}</p>
        <p className="mt-2 text-sm leading-relaxed text-textMuted">{report.fullCausality.outcomeNarrative.causalNote}</p>
        <p className="mt-3 text-xs text-textMuted">Baseline outcome model: {report.outcomeExplanation}</p>
      </section>

      <section className="card p-5">
        <p className="label">Timeline</p>
        <div className="mt-3">
          <TimelineChart data={report.timeline} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <p className="label">Pivotal Decision</p>
          <p className="mt-3 text-sm text-textMain">
            Turn {report.pivotalDecision.turn}: <span className="font-semibold">{report.pivotalDecision.actionId}</span>
          </p>
          <p className="mt-2 text-sm text-textMuted">{report.pivotalDecision.reason}</p>

          <p className="label mt-4">Alternative Line</p>
          <p className="mt-2 text-sm text-textMain">
            Suggested action at turn {report.alternativeLine.turn}: <span className="font-semibold">{report.alternativeLine.suggestedActionId}</span>
          </p>
          <p className="mt-2 text-sm text-textMuted">{report.alternativeLine.predictedImpact}</p>

          <p className="label mt-4">Adversary Logic Summary</p>
          <p className="mt-2 text-sm text-textMuted">{report.fullCausality.adversaryLogicSummary}</p>
        </article>

        <article className="card p-5">
          <p className="label">What You Misjudged</p>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-textMuted">
            {report.misjudgments.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      {deepDebrief ? (
        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">Deep Debrief</p>
              <h2 className="mt-2 font-display text-2xl text-textMain">{deepDebrief.grade.title}</h2>
            </div>
            <p className="rounded-md border border-borderTone bg-panelRaised/70 px-3 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">
              Report Score {deepDebrief.grade.score}
            </p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-textMuted">{deepDebrief.grade.description}</p>

          {deepDebrief.strategyArc ? (
            <div className="mt-5 rounded-lg border border-borderTone/70 bg-panelRaised/40 p-4">
              <p className="label">Strategic Arc</p>
              <h3 className="mt-2 text-lg text-textMain">{deepDebrief.strategyArc.headline}</h3>
              <p className="mt-3 text-sm leading-relaxed text-textMuted">{deepDebrief.strategyArc.narrative}</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <article className="rounded-md border border-borderTone/70 bg-surface/30 p-3">
                  <p className="label">Key Turning Point</p>
                  <p className="mt-2 text-sm leading-relaxed text-textMuted">{deepDebrief.strategyArc.keyTurningPoint}</p>
                </article>
                <article className="rounded-md border border-borderTone/70 bg-surface/30 p-3">
                  <p className="label">Counterfactual</p>
                  <p className="mt-2 text-sm leading-relaxed text-textMuted">{deepDebrief.strategyArc.whatIfNote}</p>
                </article>
              </div>
            </div>
          ) : null}

          {deepDebrief.rivalPerspective ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <article className="rounded-md border border-borderTone/70 bg-panelRaised/40 p-4">
                <p className="label">Rival Internal View</p>
                <p className="mt-2 text-sm leading-relaxed text-textMuted">{deepDebrief.rivalPerspective.internalNarrative}</p>
              </article>
              <article className="rounded-md border border-borderTone/70 bg-panelRaised/40 p-4">
                <p className="label">Regime Assessment</p>
                <p className="mt-2 text-sm leading-relaxed text-textMuted">{deepDebrief.rivalPerspective.regimeAssessment}</p>
              </article>
              <article className="rounded-md border border-borderTone/70 bg-panelRaised/40 p-4">
                <p className="label">Public Narrative</p>
                <p className="mt-2 text-sm leading-relaxed text-textMuted">{deepDebrief.rivalPerspective.publicNarrative}</p>
              </article>
            </div>
          ) : null}
        </section>
      ) : null}

      {report.fullCausality.rivalLeaderReveal ? (
        <section className="card p-5">
          <p className="label">Rival Leader Reveal</p>
          <h2 className="mt-2 font-display text-2xl text-textMain">
            {report.fullCausality.rivalLeaderReveal.publicName}
          </h2>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-textMuted">
            {report.fullCausality.rivalLeaderReveal.title} · Age {report.fullCausality.rivalLeaderReveal.age}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-textMuted">
            {report.fullCausality.rivalLeaderReveal.psychologicalSummary}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 text-sm text-textMuted">
              <p><span className="text-textMain">Decision style:</span> {report.fullCausality.rivalLeaderReveal.decisionStyle}</p>
              <p><span className="text-textMain">Risk appetite:</span> {report.fullCausality.rivalLeaderReveal.riskAppetite}</p>
              <p><span className="text-textMain">Red line:</span> {report.fullCausality.rivalLeaderReveal.redLine}</p>
              <p><span className="text-textMain">Golden bridge:</span> {report.fullCausality.rivalLeaderReveal.goldenBridge}</p>
            </div>
            <div className="space-y-2 text-sm text-textMuted">
              <p><span className="text-textMain">Information diet:</span> {report.fullCausality.rivalLeaderReveal.informationDiet}</p>
              <p>{report.fullCausality.rivalLeaderReveal.background}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article>
              <p className="label">Pressure Points</p>
              <ul className="mt-2 space-y-2 text-sm text-textMuted">
                {report.fullCausality.rivalLeaderReveal.pressurePoints.map((point) => (
                  <li key={point.id}>
                    <span className="text-textMain">{point.name}</span>: {point.exploitability}
                  </li>
                ))}
              </ul>
            </article>
            <article>
              <p className="label">Recent Signaling</p>
              <ul className="mt-2 space-y-2 text-sm text-textMuted">
                {report.fullCausality.rivalLeaderReveal.publicStatements.map((statement) => (
                  <li key={statement.context}>
                    <span className="text-textMain">{statement.context}</span>: {statement.analystNote}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      ) : null}

      {deepDebrief && (deepDebrief.advisorReflections.length > 0 || deepDebrief.historicalParallels.length > 0 || deepDebrief.lessonsLearned.length > 0) ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="card p-5">
            <p className="label">Advisor Post-Mortems</p>
            {deepDebrief.advisorReflections.length > 0 ? (
              <div className="mt-3 space-y-3">
                {deepDebrief.advisorReflections.map((entry) => (
                  <article key={entry.advisor} className="rounded-md border border-borderTone/70 bg-panelRaised/40 p-3">
                    <p className="text-sm text-textMain">{advisorNameById.get(entry.advisor) ?? entry.advisor.toUpperCase()}</p>
                    <p className="mt-2 text-sm leading-relaxed text-textMuted">{entry.assessment}</p>
                    <p className="mt-2 text-xs leading-relaxed text-textMuted">
                      <span className="text-textMain">Self-critique:</span> {entry.selfCritique}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-textMuted">
                      <span className="text-textMain">Recommendation:</span> {entry.recommendation}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-textMuted">No deep advisor post-mortems were authored for this outcome.</p>
            )}
          </article>

          <article className="card p-5">
            <p className="label">Historical Parallels</p>
            {deepDebrief.historicalParallels.length > 0 ? (
              <div className="mt-3 space-y-3">
                {deepDebrief.historicalParallels.map((entry) => (
                  <article key={entry.id} className="rounded-md border border-borderTone/70 bg-panelRaised/40 p-3">
                    <p className="text-sm text-textMain">{entry.title}</p>
                    <p className="mt-1 text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">{entry.period}</p>
                    <p className="mt-2 text-sm leading-relaxed text-textMuted">{entry.summary}</p>
                    <p className="mt-2 text-xs leading-relaxed text-textMuted">
                      <span className="text-textMain">Why it matters:</span> {entry.lessonForPlayer}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-textMuted">No authored historical parallels matched this outcome.</p>
            )}
          </article>
        </section>
      ) : null}

      {deepDebrief && deepDebrief.lessonsLearned.length > 0 ? (
        <section className="card p-5">
          <p className="label">Lessons Learned</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {deepDebrief.lessonsLearned.map((entry) => (
              <article key={entry.id} className="rounded-md border border-borderTone/70 bg-panelRaised/40 p-3">
                <p className="text-sm text-textMain">{entry.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-textMuted">{entry.insight}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card p-5">
        <p className="label">Hidden Deltas (Revealed)</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-textMuted">
                <th className="border-b border-borderTone py-2 pr-4">Meter</th>
                <th className="border-b border-borderTone py-2 pr-4">Total Delta</th>
                <th className="border-b border-borderTone py-2">Source Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {report.fullCausality.hiddenDeltas.map((entry) => (
                <tr key={entry.meter} className="text-textMain">
                  <td className="border-b border-borderTone/60 py-2 pr-4">{meterLabel[entry.meter]}</td>
                  <td className="border-b border-borderTone/60 py-2 pr-4">{signed(entry.totalDelta)}</td>
                  <td className="border-b border-borderTone/60 py-2">
                    {entry.breakdown.length > 0
                      ? entry.breakdown.map((part) => `${part.source}:${signed(part.delta)}`).join(' | ')
                      : 'No material hidden contribution'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <p className="label">Unseen System Events</p>
          {report.fullCausality.unseenSystemEvents.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-textMuted">
              {report.fullCausality.unseenSystemEvents.map((event, index) => (
                <li key={`${event.turn}:${event.eventId}:${index}`}>
                  Turn {event.turn}: {event.label} (visibility {event.visibility.toFixed(2)})
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-textMuted">No low-visibility events were logged this run.</p>
          )}
        </article>

        <article className="card p-5">
          <p className="label">Advisor Retrospectives</p>
          {report.fullCausality.advisorRetrospectives.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-textMuted">
              {report.fullCausality.advisorRetrospectives.map((entry) => (
                <li key={`${entry.advisor}:${entry.text}`}>
                  <span className="text-textMain">{entry.advisor.toUpperCase()}</span>: {entry.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-textMuted">No advisor retrospective lines available for this outcome.</p>
          )}
        </article>
      </section>

      <section className="card p-5">
        <p className="label">Branches Not Taken</p>
        <p className="mt-2 text-xs text-textMuted">Top counterfactual branches by stress impact and pivot relevance (max 6).</p>
        {report.fullCausality.branchesNotTaken.length > 0 ? (
          <div className="mt-3 space-y-3">
            {report.fullCausality.branchesNotTaken.map((entry) => (
              <article key={`${entry.turn}:${entry.beatId}`} className="rounded-md border border-borderTone/70 bg-panelRaised/40 p-3">
                <p className="text-sm text-textMain">
                  Turn {entry.turn} | Beat {entry.beatId} | Selected {entry.selectedActionId} {'->'} {entry.selectedBeatId}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-textMuted">
                  {entry.alternatives.map((alt) => (
                    <li key={`${entry.turn}:${entry.beatId}:${alt.targetBeatId}`}>
                      {alt.targetBeatId}: {alt.reason}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-textMuted">No branch alternatives were captured for this run.</p>
        )}
      </section>

      <section className="card p-5">
        <p className="label">Rival Belief Evolution</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-textMuted">
                <th className="border-b border-borderTone py-2 pr-4">Turn</th>
                <th className="border-b border-borderTone py-2 pr-4">P(bluff)</th>
                <th className="border-b border-borderTone py-2 pr-4">P(high threshold)</th>
                <th className="border-b border-borderTone py-2">Humiliation</th>
              </tr>
            </thead>
            <tbody>
              {report.beliefEvolution.map((entry) => (
                <tr key={entry.turn} className="text-textMain">
                  <td className="border-b border-borderTone/60 py-2 pr-4">{entry.turn}</td>
                  <td className="border-b border-borderTone/60 py-2 pr-4">{entry.bluffProb.toFixed(2)}</td>
                  <td className="border-b border-borderTone/60 py-2 pr-4">{entry.thresholdHighProb.toFixed(2)}</td>
                  <td className="border-b border-borderTone/60 py-2">{entry.humiliation.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};
