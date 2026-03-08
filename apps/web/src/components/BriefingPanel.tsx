import { useEffect, useMemo, useState } from 'react';

import type {
  ActionNarrativePhaseContent,
  ImageAsset,
  NarrativeBundle,
  RivalLeaderDefinition,
  ScenarioWorldDefinition,
  TurnDebrief
} from '@wargames/shared-types';

interface BriefingPanelProps {
  turn: number;
  briefing: NarrativeBundle;
  scenarioWorld: ScenarioWorldDefinition | null;
  counterpartBrief: RivalLeaderDefinition | null;
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
  briefing,
  scenarioWorld,
  counterpartBrief,
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

  const theaterHighlights = scenarioWorld?.region.keyFeatures.slice(0, 3) ?? [];

  return (
    <section className="console-panel flex h-full flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label">Live Briefing</p>
          <h2 className="mt-2 font-display text-[1.55rem] text-textMain">Command Brief</h2>
        </div>
        <p className="rounded-md border border-borderTone bg-panelRaised/60 px-2 py-1 text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
          Active Window
        </p>
      </div>

      <div className="mt-4 grid min-h-0 gap-4 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="min-h-0 space-y-4">
          <article className="console-subpanel px-4 py-3">
            <p className="label">Current Situation</p>
            <p className="mt-3 border-l-2 border-accent/70 pl-4 text-sm leading-relaxed text-textMain">
              {briefing.briefingParagraph}
            </p>
          </article>

          {phaseTransition ? (
            <section className="rounded-md border border-accent/35 bg-accent/10 px-3 py-3">
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
                <span className="text-[0.58rem] uppercase tracking-[0.12em] text-accent">
                  {showPhaseTransition ? 'Hide' : 'Open'}
                </span>
              </button>
              {showPhaseTransition ? (
                <div className="mt-3 space-y-2 border-t border-accent/20 pt-3 text-[0.76rem] leading-relaxed text-textMuted">
                  {phaseTransition.fragments.map((fragment) => (
                    <p key={fragment}>{fragment}</p>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="console-subpanel px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="label">Incoming Signals</p>
              <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Click to expand</p>
            </div>
            <div className="mt-3 space-y-2">
              {briefing.headlines.map((headline, index) => {
                const open = expandedHeadline === index;
                return (
                  <article key={headline} className="rounded-md border border-borderTone/70 bg-panelRaised/45">
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition hover:bg-panelRaised/70"
                      onClick={() => setExpandedHeadline(open ? null : index)}
                    >
                      <div>
                        <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{signalSource(index)}</p>
                        <p className="mt-1 text-[0.78rem] leading-relaxed text-textMain">{headline}</p>
                      </div>
                      <span className="mt-1 text-[0.58rem] uppercase tracking-[0.12em] text-accent">
                        {open ? 'Hide' : 'Open'}
                      </span>
                    </button>
                    {open ? (
                      <div className="space-y-1 border-t border-borderTone/70 px-3 py-2 text-[0.7rem] leading-relaxed text-textMuted">
                        {(signalDetails[index] ?? []).map((detail) => (
                          <p key={`${headline}:${detail}`}>{detail}</p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          {turnDebrief && turnDebrief.lines.length > 0 ? (
            <section className="console-subpanel px-3 py-3">
              <p className="label">Turn Assessment</p>
              <div className="mt-2 space-y-2 text-[0.76rem] leading-relaxed text-textMuted">
                {turnDebrief.lines.map((entry, index) => (
                  <p key={`${entry.tag}-${index}`}>
                    <span className="text-accent">{sourceLabel[entry.tag]}</span> {entry.text}
                  </p>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          {turn === 1 && scenarioWorld ? (
            <section className="console-subpanel px-3 py-3">
              <p className="label">Theater Context</p>
              <p className="mt-1 text-sm text-textMain">
                {scenarioWorld.region.name} · {scenarioWorld.dateAnchor.month} {scenarioWorld.dateAnchor.year}
              </p>
              <p className="mt-2 text-[0.7rem] text-textMuted">{scenarioWorld.dateAnchor.dayRange}</p>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                {clipText(scenarioWorld.region.description, 300)}
              </p>
              {theaterHighlights.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {theaterHighlights.map((feature) => (
                    <span key={feature} className="rounded-md border border-borderTone/70 px-1.5 py-0.5 text-[0.56rem] uppercase tracking-[0.1em] text-textMuted">
                      {feature}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 border-t border-borderTone/70 pt-3">
                <p className="label">Why It Matters</p>
                <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                  {clipText(scenarioWorld.economicBackdrop.straitEconomicValue, 330)}
                </p>
              </div>
            </section>
          ) : null}

          {turn === 1 && counterpartBrief ? (
            <section className="console-subpanel px-3 py-3">
              <p className="label">Known About Counterpart</p>
              <p className="mt-1 text-sm text-textMain">
                {counterpartBrief.leader.publicName} · {counterpartBrief.leader.title}
              </p>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                {clipText(counterpartBrief.leader.psychologicalProfile.summary, 260)}
              </p>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-textMuted">
                <span className="text-textMain">Known red line:</span>{' '}
                {clipText(counterpartBrief.leader.motivations.redLine, 220)}
              </p>
              {(counterpartBrief.leader.intelFragments.opening ?? []).length > 0 ? (
                <div className="mt-3 border-t border-borderTone/70 pt-3">
                  <p className="label">Current Intelligence Read</p>
                  <p className="mt-2 text-[0.7rem] leading-relaxed text-textMuted">
                    {clipText((counterpartBrief.leader.intelFragments.opening ?? [])[0] ?? '', 240)}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {imageAsset ? (
            <figure className="relative overflow-hidden rounded-md border border-borderTone/80">
              <img
                src={imageAsset.path}
                alt={imageAsset.tags.join(', ')}
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent" />
              <div className="absolute left-3 top-3 rounded-md border border-warning/60 bg-surface/85 px-2 py-1 text-[0.6rem] uppercase tracking-[0.14em] text-warning">
                Theater Visual
              </div>
              {briefing.memoLine ? (
                <div className="absolute bottom-2 left-2 right-2 rounded-md border border-borderTone bg-surface/80 px-2 py-1 text-[0.62rem] text-textMuted">
                  {briefing.memoLine}
                </div>
              ) : null}
            </figure>
          ) : null}

          {recentActionNarrative ? (
            <section className="console-subpanel px-3 py-3">
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
                <span className="text-[0.58rem] uppercase tracking-[0.12em] text-accent">
                  {showOperationalReadout ? 'Hide' : 'Open'}
                </span>
              </button>
              {showOperationalReadout ? (
                <div className="mt-3 space-y-3 border-t border-borderTone/70 pt-3">
                  <p className="text-[0.72rem] leading-relaxed text-textMuted">
                    <span className="text-textMain">Order frame:</span> {recentActionNarrative.detail.preActionBrief}
                  </p>
                  <p className="text-[0.82rem] leading-relaxed text-textMain">{recentActionNarrative.detail.executionNarrative}</p>
                  <div className="grid gap-2">
                    <article className="rounded-md border border-borderTone/70 bg-surface/35 p-2">
                      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Rival Desk</p>
                      <p className="mt-1 text-[0.7rem] leading-relaxed text-textMuted">
                        {recentActionNarrative.detail.rivalReaction}
                      </p>
                    </article>
                    <article className="rounded-md border border-borderTone/70 bg-surface/35 p-2">
                      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Alliance Desk</p>
                      <p className="mt-1 text-[0.7rem] leading-relaxed text-textMuted">
                        {recentActionNarrative.detail.allianceReaction}
                      </p>
                    </article>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
};
