import type { PostGameReport } from '@wargames/shared-types';

import { TimelineChart } from './TimelineChart';

interface ReportViewProps {
  report: PostGameReport;
  onRestart: () => void;
}

export const ReportView = ({ report, onRestart }: ReportViewProps) => {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
      <section className="card p-5">
        <p className="label">Post-Game Intelligence Assessment</p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl capitalize text-accent">{report.outcome.replace('_', ' ')}</h1>
          <button
            type="button"
            className="rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent/10"
            onClick={onRestart}
          >
            New Episode
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-textMuted">{report.outcomeExplanation}</p>
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
