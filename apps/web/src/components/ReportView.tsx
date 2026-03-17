import type {
  AdvisorDossier,
  CinematicsDefinition,
  MeterKey,
  MissionObjective,
  PostGameReport,
  ScenarioDefinition,
  TradeoffScorecardStatus
} from '@wargames/shared-types';

import { TimelineChart } from './TimelineChart';

interface ReportViewProps {
  report: PostGameReport;
  scenario: ScenarioDefinition | null;
  advisorDossiers: AdvisorDossier[];
  cinematics: CinematicsDefinition | null;
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

type ObjectiveStatus = 'held' | 'strained' | 'failed';

interface ObjectiveAssessment {
  objective: MissionObjective;
  score: number;
  status: ObjectiveStatus;
  summary: string;
}

const mandateTone: Record<ObjectiveStatus, string> = {
  held: 'border-positive/60 text-positive',
  strained: 'border-warning/60 text-warning',
  failed: 'border-red-500/60 text-red-300'
};

const tradeoffTone: Record<TradeoffScorecardStatus, string> = {
  strong: 'border-positive/60 text-positive',
  mixed: 'border-accent/60 text-accent',
  strained: 'border-warning/60 text-warning',
  broken: 'border-red-500/60 text-red-300'
};

const objectiveStatusForScore = (score: number): ObjectiveStatus => {
  if (score >= 68) {
    return 'held';
  }
  if (score >= 46) {
    return 'strained';
  }
  return 'failed';
};

const computeObjectiveScore = (objective: MissionObjective, report: PostGameReport): number => {
  const scores = objective.primaryMeters.map((meter) => {
    const raw = report.finalMeters[meter];
    return objective.targetDirection === 'low' ? 100 - raw : raw;
  });
  const average = scores.reduce((total, value) => total + value, 0) / Math.max(1, scores.length);
  return Math.round(average);
};

const summarizeObjective = (objective: MissionObjective, report: PostGameReport, status: ObjectiveStatus): string => {
  const meterReadout = objective.primaryMeters
    .map((meter) => `${meterLabel[meter]} ${Math.round(report.finalMeters[meter])}`)
    .join(' · ');

  if (status === 'held') {
    return `${objective.description} Final read: ${meterReadout}.`;
  }
  if (status === 'strained') {
    return `${objective.description} This objective held only partially by the close of the episode. Final read: ${meterReadout}.`;
  }
  return `${objective.description} The mandate broke down on this line by the end of the episode. Final read: ${meterReadout}.`;
};

const deriveObjectiveAssessments = (
  scenario: ScenarioDefinition | null,
  report: PostGameReport
): ObjectiveAssessment[] => {
  if (!scenario?.missionObjectives?.length) {
    return [];
  }

  return scenario.missionObjectives.map((objective) => {
    const score = computeObjectiveScore(objective, report);
    const status = objectiveStatusForScore(score);
    return {
      objective,
      score,
      status,
      summary: summarizeObjective(objective, report, status)
    };
  });
};

const deriveMandateHeadline = (
  report: PostGameReport,
  objectives: ObjectiveAssessment[]
): { title: string; summary: string } => {
  if (objectives.length === 0) {
    return {
      title: report.fullCausality.outcomeNarrative.title,
      summary: report.fullCausality.outcomeNarrative.summary
    };
  }

  const held = objectives.filter((entry) => entry.status === 'held').length;
  const failed = objectives.filter((entry) => entry.status === 'failed').length;
  const average = Math.round(objectives.reduce((total, entry) => total + entry.score, 0) / objectives.length);

  if (report.outcome === 'stabilization' && failed === 0 && average >= 68) {
    return {
      title: 'Mandate Held Under Pressure',
      summary: `The run met the core mandate with ${held}/${objectives.length} primary objectives held and no outright failures.`
    };
  }
  if (failed <= 1 && report.outcome !== 'war' && average >= 46) {
    return {
      title: 'Mandate Partially Held',
      summary: `The run preserved parts of the mandate, but at least one objective was strained or broken under accumulated pressure.`
    };
  }
  return {
    title: 'Mandate Broken',
    summary: `The run failed to preserve enough of the mission mandate once the crisis moved into its decisive turns.`
  };
};

export const ReportView = ({ report, scenario, advisorDossiers, cinematics, onRestart }: ReportViewProps) => {
  const advisorNameById = new Map(advisorDossiers.map((entry) => [entry.id, entry.name]));
  const deepDebrief = report.fullCausality.deepDebrief;
  const endingCinematic = (
    report.terminalBeatId
      ? cinematics?.terminalBeatEndings?.[report.terminalBeatId] ?? null
      : null
  ) ?? cinematics?.endings[report.outcome] ?? null;
  const objectiveAssessments = deriveObjectiveAssessments(scenario, report);
  const mandateHeadline = deriveMandateHeadline(report, objectiveAssessments);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
      <section className="card p-5">
        <p className="label">Mandate Assessment</p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl text-accent">{mandateHeadline.title}</h1>
          <button
            type="button"
            className="rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent/10"
            onClick={onRestart}
          >
            Return To Scenario Setup
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-textMain">{mandateHeadline.summary}</p>
        <p className="mt-2 text-sm leading-relaxed text-textMuted">{report.fullCausality.outcomeNarrative.summary}</p>
        <p className="mt-2 text-sm leading-relaxed text-textMuted">{report.fullCausality.outcomeNarrative.causalNote}</p>
        <p className="mt-3 text-xs text-textMuted">Baseline outcome model: {report.outcomeExplanation}</p>
      </section>

      {objectiveAssessments.length > 0 ? (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label">Mandate Scorecards</p>
              <p className="mt-2 text-sm text-textMuted">
                Success is measured against the scenario mandate, not a generic win/loss score.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {objectiveAssessments.map((entry) => (
              <article key={entry.objective.id} className="rounded-md border border-borderTone/70 bg-panelRaised/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-textMain">{entry.objective.label}</p>
                  <span className={`rounded-md border px-2 py-0.5 text-[0.56rem] uppercase tracking-[0.12em] ${mandateTone[entry.status]}`}>
                    {entry.status}
                  </span>
                </div>
                <p className="mt-2 text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">Mandate score {entry.score}</p>
                <p className="mt-3 text-sm leading-relaxed text-textMuted">{entry.summary}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {report.fullCausality.tradeoffScorecards.length > 0 ? (
        <section className="card p-5">
          <div>
            <p className="label">Tradeoff Scorecards</p>
            <p className="mt-2 text-sm text-textMuted">
              These cards show what the run preserved, where it paid a price, and which strategic line broke first.
            </p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {report.fullCausality.tradeoffScorecards.map((entry) => (
              <article key={entry.id} className="rounded-md border border-borderTone/70 bg-panelRaised/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-textMain">{entry.label}</p>
                    <p className="mt-2 text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">
                      Score {entry.score}
                    </p>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[0.56rem] uppercase tracking-[0.12em] ${tradeoffTone[entry.status]}`}>
                    {entry.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-textMuted">{entry.summary}</p>
                <div className="mt-3 rounded-md border border-borderTone/70 bg-surface/30 p-3">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Primary tradeoff</p>
                  <p className="mt-1 text-sm leading-relaxed text-textMain">{entry.tradeoff}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {endingCinematic ? (
        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">Aftermath Sequence</p>
              <h2 className="mt-2 font-display text-2xl text-textMain">{endingCinematic.title}</h2>
            </div>
            <p className="rounded-md border border-borderTone bg-panelRaised/70 px-3 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">
              {endingCinematic.tone}
            </p>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-textMuted">
            {endingCinematic.fragments.map((fragment) => (
              <p key={fragment}>{fragment}</p>
            ))}
          </div>
          <p className="mt-4 border-l-2 border-accent/70 pl-4 text-sm leading-relaxed text-textMain">
            {endingCinematic.epilogueNote}
          </p>
        </section>
      ) : null}

      <section className="card p-5">
        <p className="label">Scenario Timeline</p>
        <div className="mt-3">
          <TimelineChart data={report.timeline} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
          <article className="card p-5">
            <p className="label">Pivotal Decision</p>
            <p className="mt-3 text-sm text-textMain">
            Decision window {report.pivotalDecision.turn}: <span className="font-semibold">{report.pivotalDecision.actionName}</span>
            </p>
          <p className="mt-2 text-sm text-textMuted">{report.pivotalDecision.reason}</p>

          <p className="label mt-4">Alternative Line</p>
          <p className="mt-2 text-sm text-textMain">
            Suggested action in decision window {report.alternativeLine.turn}: <span className="font-semibold">{report.alternativeLine.suggestedActionName}</span>
          </p>
          <p className="mt-2 text-sm text-textMuted">{report.alternativeLine.predictedImpact}</p>

          <p className="label mt-4">Observed Counterpart Logic</p>
          <p className="mt-2 text-sm text-textMuted">{report.fullCausality.adversaryLogicSummary}</p>
        </article>

        <article className="card p-5">
          <p className="label">Decision Blind Spots</p>
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
              <p className="label">Strategic Debrief</p>
              <h2 className="mt-2 font-display text-2xl text-textMain">{deepDebrief.grade.title}</h2>
            </div>
            <p className="rounded-md border border-borderTone bg-panelRaised/70 px-3 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">
              Strategic Read {deepDebrief.grade.score}
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
                <p className="label">Counterpart Internal View</p>
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
          <p className="label">Counterpart Assessment</p>
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
        <p className="label">Hidden Effects (Revealed)</p>
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
                  Decision window {event.turn}: {event.label} (visibility {event.visibility.toFixed(2)})
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
                  Decision window {entry.turn} | Chosen response {entry.selectedActionId}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-textMuted">
                  {entry.alternatives.map((alt) => (
                    <li key={`${entry.turn}:${entry.beatId}:${alt.targetBeatId}`}>
                      {alt.reason}
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
        <p className="label">Counterpart Assessment Path</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-textMuted">
                <th className="border-b border-borderTone py-2 pr-4">Window</th>
                <th className="border-b border-borderTone py-2 pr-4">Perceived bluff risk</th>
                <th className="border-b border-borderTone py-2 pr-4">Perceived escalation threshold</th>
                <th className="border-b border-borderTone py-2">Humiliation pressure</th>
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
