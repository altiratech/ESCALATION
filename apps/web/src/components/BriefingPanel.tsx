import { useEffect, useMemo, useState } from 'react';

import type {
  ActionNarrativePhaseContent,
  ImageAsset,
  NarrativeBundle,
  ScenarioWorldDefinition,
  TurnDebrief
} from '@wargames/shared-types';

interface BriefingPanelProps {
  turn: number;
  maxTurns: number;
  briefing: NarrativeBundle;
  scenarioWorld: ScenarioWorldDefinition | null;
  imageAsset: ImageAsset | null;
  turnDebrief: TurnDebrief | null;
  recentActionNarrative: {
    actionName: string;
    phaseLabel: string;
    detail: ActionNarrativePhaseContent;
  } | null;
  phaseTransition: {
    key: string;
    fromLabel: string;
    toLabel: string;
    fragments: string[];
  } | null;
}

const sourceLabel: Record<TurnDebrief['lines'][number]['tag'], string> = {
  PlayerAction: '[Action]',
  SecondaryEffect: '[Ripple]',
  SystemEvent: '[System]'
};

export const BriefingPanel = ({
  turn,
  maxTurns,
  briefing,
  scenarioWorld,
  imageAsset,
  turnDebrief,
  recentActionNarrative,
  phaseTransition
}: BriefingPanelProps) => {
  const [expandedHeadline, setExpandedHeadline] = useState<number | null>(0);
  const [showOperationalReadout, setShowOperationalReadout] = useState(true);
  const [showPhaseTransition, setShowPhaseTransition] = useState(true);

  useEffect(() => {
    setShowPhaseTransition(true);
  }, [phaseTransition?.key]);

  const signalDetails = useMemo(() => {
    return briefing.headlines.map((_, index) => {
      const details: string[] = [];
      if (index === 0 && briefing.memoLine) {
        details.push(briefing.memoLine);
      }
      if (index === 1 && briefing.tickerLine) {
        details.push(briefing.tickerLine);
      }
      if (details.length === 0 && index === 0 && briefing.tickerLine) {
        details.push(briefing.tickerLine);
      }
      if (details.length === 0) {
        details.push('Analyst desk is still validating corroborating signals from theater channels.');
      }
      return details;
    });
  }, [briefing.headlines, briefing.memoLine, briefing.tickerLine]);

  const signalSource = (index: number): string => {
    if (index === 0) {
      return 'SIGINT';
    }
    if (index === 1) {
      return 'MARKET';
    }
    return 'OSINT';
  };

  const clipText = (value: string, limit = 260): string =>
    value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;

  return (
    <section className="card flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="label">Situation Report</p>
          <h2 className="mt-2 font-display text-2xl text-textMain">Turn {turn} Command Brief</h2>
        </div>
        <p className="rounded-md border border-borderTone bg-panelRaised/70 px-2 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">
          Turn {turn} / {maxTurns}
        </p>
      </div>

      <p className="mt-4 border-l-2 border-accent/70 pl-4 text-sm leading-relaxed text-textMain">{briefing.briefingParagraph}</p>

      {turn === 1 && scenarioWorld ? (
        <section className="mt-5 grid gap-3 lg:grid-cols-2">
          <article className="rounded-lg border border-borderTone bg-panelRaised/60 p-3">
            <p className="label">Theater Context</p>
            <p className="mt-1 text-sm text-textMain">
              {scenarioWorld.region.name} · {scenarioWorld.dateAnchor.month} {scenarioWorld.dateAnchor.year}
            </p>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
              {scenarioWorld.dateAnchor.dayRange}
            </p>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-textMuted">
              {clipText(scenarioWorld.region.description, 330)}
            </p>
          </article>
          <article className="rounded-lg border border-borderTone bg-panelRaised/60 p-3">
            <p className="label">Why It Matters</p>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-textMuted">
              {clipText(scenarioWorld.economicBackdrop.straitEconomicValue, 360)}
            </p>
          </article>
        </section>
      ) : null}

      {phaseTransition ? (
        <section className="mt-5 rounded-lg border border-accent/40 bg-accent/10 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowPhaseTransition((current) => !current)}
          >
            <div>
              <p className="label">Phase Shift</p>
              <p className="mt-1 text-sm text-textMain">
                {phaseTransition.fromLabel} {'->'} {phaseTransition.toLabel}
              </p>
            </div>
            <span className="text-[0.62rem] uppercase tracking-[0.1em] text-accent">
              {showPhaseTransition ? 'Hide' : 'Open'}
            </span>
          </button>
          {showPhaseTransition ? (
            <div className="mt-3 space-y-2 border-t border-accent/20 pt-3 text-[0.78rem] leading-relaxed text-textMuted">
              {phaseTransition.fragments.map((fragment) => (
                <p key={fragment}>{fragment}</p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-5">
        <p className="label">Incoming Signals</p>
      </div>
      <div className="mt-2 space-y-2">
        {briefing.headlines.map((headline, index) => {
          const open = expandedHeadline === index;
          return (
            <article key={headline} className="rounded-md border border-borderTone bg-panelRaised/75">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition hover:bg-panelRaised"
                onClick={() => setExpandedHeadline(open ? null : index)}
              >
                <div>
                  <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">{signalSource(index)}</p>
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-textMain">{headline}</p>
                </div>
                <span className="mt-1 text-[0.62rem] uppercase tracking-[0.1em] text-accent">
                  {open ? 'Hide' : 'Open'}
                </span>
              </button>
              {open ? (
                <div className="space-y-1 border-t border-borderTone/70 px-3 py-2 text-[0.72rem] leading-relaxed text-textMuted">
                  {(signalDetails[index] ?? []).map((detail) => (
                    <p key={`${headline}:${detail}`}>{detail}</p>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {imageAsset ? (
        <figure className="relative mt-5 overflow-hidden rounded-lg border border-borderTone">
          <img
            src={imageAsset.path}
            alt={imageAsset.tags.join(', ')}
            className="h-60 w-full object-cover"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/70 to-transparent" />
          <div className="absolute left-3 top-3 rounded-md border border-warning/60 bg-surface/85 px-2 py-1 text-[0.65rem] uppercase tracking-[0.15em] text-warning">
            Breaking News
          </div>
          {briefing.memoLine ? (
            <div className="absolute bottom-2 left-2 right-2 rounded-md border border-borderTone bg-surface/80 px-2 py-1 text-[0.66rem] text-textMuted">
              {briefing.memoLine}
            </div>
          ) : null}
        </figure>
      ) : null}

      {briefing.tickerLine ? (
        <div className="mt-4 rounded-md border border-accent/50 bg-panelRaised/80 px-2 py-1 text-[0.72rem] text-accent">
          {briefing.tickerLine}
        </div>
      ) : null}

      {recentActionNarrative ? (
        <section className="mt-5 rounded-lg border border-borderTone bg-panelRaised/60 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowOperationalReadout((current) => !current)}
          >
            <div>
              <p className="label">Operational Readout</p>
              <p className="mt-1 text-sm text-textMain">
                {recentActionNarrative.actionName} · {recentActionNarrative.phaseLabel}
              </p>
            </div>
            <span className="text-[0.62rem] uppercase tracking-[0.1em] text-accent">
              {showOperationalReadout ? 'Hide' : 'Open'}
            </span>
          </button>
          {showOperationalReadout ? (
            <div className="mt-3 space-y-3 border-t border-borderTone/70 pt-3">
              <p className="text-[0.75rem] leading-relaxed text-textMuted">
                <span className="text-textMain">Order frame:</span> {recentActionNarrative.detail.preActionBrief}
              </p>
              <p className="text-sm leading-relaxed text-textMain">{recentActionNarrative.detail.executionNarrative}</p>
              <div className="grid gap-3 lg:grid-cols-2">
                <article className="rounded-md border border-borderTone/70 bg-surface/35 p-2">
                  <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">Rival Desk</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMuted">
                    {recentActionNarrative.detail.rivalReaction}
                  </p>
                </article>
                <article className="rounded-md border border-borderTone/70 bg-surface/35 p-2">
                  <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">Alliance Desk</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMuted">
                    {recentActionNarrative.detail.allianceReaction}
                  </p>
                </article>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {turnDebrief && turnDebrief.lines.length > 0 ? (
        <section className="mt-5 rounded-lg border border-borderTone bg-panelRaised/60 p-3">
          <p className="label">Turn Assessment</p>
          <div className="mt-2 space-y-2 text-[0.78rem] leading-relaxed text-textMuted">
            {turnDebrief.lines.map((entry, index) => (
              <p key={`${entry.tag}-${index}`}>
                <span className="text-accent">{sourceLabel[entry.tag]}</span> {entry.text}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
};
