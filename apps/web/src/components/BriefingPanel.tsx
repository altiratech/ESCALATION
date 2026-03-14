import { useEffect, useMemo, useState } from 'react';

import type {
  ActionNarrativePhaseContent,
  EpisodeMeterHistoryPoint,
  MeterState,
  MissionObjective,
  NarrativeBundle,
  RivalLeaderDefinition,
  ScenarioWorldDefinition,
  TurnDebrief
} from '@wargames/shared-types';

import { MeterDashboard } from './MeterDashboard';

interface BriefingSignalItem {
  id: string;
  channel: string;
  headline: string;
  detail?: string;
}

interface BriefingPanelProps {
  turn: number;
  briefing: NarrativeBundle;
  scenarioWorld: ScenarioWorldDefinition | null;
  counterpartBrief: RivalLeaderDefinition | null;
  missionObjectives: MissionObjective[];
  supportingSignals: BriefingSignalItem[];
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
  meters: MeterState;
  previousMeters?: MeterState | undefined;
  meterHistory: EpisodeMeterHistoryPoint[];
}

type BriefingSectionId = 'developments' | 'context' | 'indicators';

const sourceLabel: Record<TurnDebrief['lines'][number]['tag'], string> = {
  PlayerAction: '[Action]',
  SecondaryEffect: '[Ripple]',
  SystemEvent: '[System]'
};

const sectionLabels: Record<BriefingSectionId, string> = {
  developments: 'Key Developments',
  context: 'Context',
  indicators: 'Operational Indicators'
};

export const BriefingPanel = ({
  turn,
  briefing,
  scenarioWorld,
  counterpartBrief,
  missionObjectives,
  supportingSignals,
  turnDebrief,
  recentActionNarrative,
  phaseTransition,
  meters,
  previousMeters,
  meterHistory
}: BriefingPanelProps) => {
  const [expandedHeadline, setExpandedHeadline] = useState<number | null>(null);
  const [showOperationalReadout, setShowOperationalReadout] = useState(false);
  const [showPhaseTransition, setShowPhaseTransition] = useState(Boolean(phaseTransition));
  const [showAllDevelopments, setShowAllDevelopments] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [activeSection, setActiveSection] = useState<BriefingSectionId>('developments');

  useEffect(() => {
    setActiveSection('developments');
    setExpandedHeadline(null);
    setShowOperationalReadout(false);
    setShowPhaseTransition(Boolean(phaseTransition));
    setShowAllDevelopments(false);
    setShowAllSignals(false);
  }, [turn, phaseTransition?.key]);

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
      return 'Government Signal';
    }
    if (index === 1) {
      return 'Market';
    }
    return 'Open Reporting';
  };

  const clipText = (value: string, limit = 260): string =>
    value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;

  const theaterHighlights = scenarioWorld?.region.keyFeatures.slice(0, 3) ?? [];
  const intelligenceGapPreview = turn === 1 ? scenarioWorld?.intelligenceGaps.slice(0, 3) ?? [] : [];
  const primaryHeadlines = briefing.headlines.slice(0, 2);
  const secondaryHeadlines = briefing.headlines.slice(2);
  const visibleSupportingSignals = showAllSignals ? supportingSignals : supportingSignals.slice(0, 2);
  const hiddenSignalCount = Math.max(0, supportingSignals.length - visibleSupportingSignals.length);

  const renderHeadlineItem = (headline: string, index: number, sourceIndex: number) => {
    const open = expandedHeadline === sourceIndex;
    return (
      <article key={headline} className="rounded-md border border-borderTone/70 bg-panelRaised/45">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition hover:bg-panelRaised/70"
          onClick={() => setExpandedHeadline(open ? null : sourceIndex)}
        >
          <div>
            <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{signalSource(sourceIndex)}</p>
            <p className="mt-1 text-[0.78rem] leading-relaxed text-textMain">{headline}</p>
          </div>
          <span className="mt-1 text-[0.58rem] uppercase tracking-[0.12em] text-accent">{open ? 'Hide' : 'Open'}</span>
        </button>
        {open ? (
          <div className="space-y-1 border-t border-borderTone/70 px-3 py-2 text-[0.7rem] leading-relaxed text-textMuted">
            {(signalDetails[sourceIndex] ?? []).map((detail) => (
              <p key={`${headline}:${detail}`}>{detail}</p>
            ))}
          </div>
        ) : null}
      </article>
    );
  };

  const renderDevelopments = () => (
    <div className="space-y-4">
      {phaseTransition ? (
        <section className="rounded-md border border-accent/35 bg-accent/8 px-3 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowPhaseTransition((current) => !current)}
          >
            <div>
              <p className="label">Situation Change</p>
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

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label">Start Here</p>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-textMuted">
              Read the two developments most likely to change the next response.
            </p>
          </div>
          <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Open for detail</p>
        </div>
        {primaryHeadlines.map((headline, index) => renderHeadlineItem(headline, index, index))}
        {secondaryHeadlines.length > 0 ? (
          <div className="rounded-md border border-borderTone/70 bg-panelRaised/30 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Additional developments</p>
                <p className="mt-1 text-[0.7rem] text-textMuted">
                  Open these only if you want the fuller market and diplomacy picture before deciding.
                </p>
              </div>
              <button
                type="button"
                className="text-[0.58rem] uppercase tracking-[0.12em] text-accent"
                onClick={() => setShowAllDevelopments((current) => !current)}
              >
                {showAllDevelopments ? 'Hide' : `Open ${secondaryHeadlines.length}`}
              </button>
            </div>
            {showAllDevelopments ? (
              <div className="mt-3 space-y-2">
                {secondaryHeadlines.map((headline, index) => renderHeadlineItem(headline, index + 2, index + 2))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {supportingSignals.length > 0 ? (
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label">Watch Items</p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-textMuted">
                Secondary signals that can change how markets, allies, and operators read the situation.
              </p>
            </div>
            <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Support only</p>
          </div>
          <div className="mt-3 grid gap-2 xl:grid-cols-2">
            {visibleSupportingSignals.map((item) => (
              <article key={item.id} className="console-feed-item min-h-[4.5rem]">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{item.channel}</p>
                <p className="mt-1 text-[0.72rem] text-textMain">{item.headline}</p>
                {item.detail ? <p className="mt-1 text-[0.67rem] text-textMuted">{item.detail}</p> : null}
              </article>
            ))}
          </div>
          {hiddenSignalCount > 0 ? (
            <div className="mt-3 flex justify-start">
              <button
                type="button"
                className="text-[0.58rem] uppercase tracking-[0.12em] text-accent"
                onClick={() => setShowAllSignals((current) => !current)}
              >
                {showAllSignals ? 'Show fewer watch items' : `Show ${hiddenSignalCount} more watch items`}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {turnDebrief && turnDebrief.lines.length > 0 ? (
        <section className="console-subpanel px-3 py-3">
          <p className="label">Immediate Outcome</p>
          <div className="mt-2 space-y-2 text-[0.76rem] leading-relaxed text-textMuted">
            {turnDebrief.lines.map((entry, index) => (
              <p key={`${entry.tag}-${index}`}>
                <span className="text-accent">{sourceLabel[entry.tag]}</span> {entry.text}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {recentActionNarrative ? (
        <section className="console-subpanel px-3 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowOperationalReadout((current) => !current)}
          >
            <div>
              <p className="label">What Happened</p>
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
              <div className="grid gap-2 xl:grid-cols-2">
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
  );

  const renderContext = () => (
    <div className="space-y-4">
      {missionObjectives.length > 0 ? (
        <section className="console-subpanel px-3 py-3">
          <p className="label">Decision Priorities</p>
          <div className="mt-3 space-y-2">
            {missionObjectives.map((objective) => (
              <div key={objective.id} className="border-l-2 border-accent/55 pl-3">
                <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{objective.label}</p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{objective.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {scenarioWorld ? (
        <section className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="console-subpanel px-3 py-3">
            <p className="label">Where Pressure Is Building</p>
            <p className="mt-1 text-sm text-textMain">
              {scenarioWorld.region.name} · {scenarioWorld.dateAnchor.month} {scenarioWorld.dateAnchor.year}
            </p>
            <p className="mt-2 text-[0.7rem] text-textMuted">{scenarioWorld.dateAnchor.dayRange}</p>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
              {clipText(scenarioWorld.region.description, 260)}
            </p>
            {theaterHighlights.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {theaterHighlights.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-md border border-borderTone/70 px-1.5 py-0.5 text-[0.56rem] uppercase tracking-[0.1em] text-textMuted"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="console-subpanel px-3 py-3">
            <p className="label">Why Finance Should Care</p>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
              {clipText(scenarioWorld.economicBackdrop.straitEconomicValue, 250)}
            </p>
            <div className="mt-3 border-t border-borderTone/70 pt-3">
              <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Likely market read</p>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                {clipText(scenarioWorld.economicBackdrop.marketSentiment, 220)}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {counterpartBrief || intelligenceGapPreview.length > 0 ? (
        <section className="grid gap-3 xl:grid-cols-[1fr_0.92fr]">
          {counterpartBrief ? (
            <div className="console-subpanel px-3 py-3">
              <p className="label">What We Know</p>
              <p className="mt-1 text-sm text-textMain">
                {counterpartBrief.leader.publicName} · {counterpartBrief.leader.title}
              </p>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
                {clipText(counterpartBrief.leader.psychologicalProfile.summary, 220)}
              </p>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-textMuted">
                <span className="text-textMain">Known red line:</span>{' '}
                {clipText(counterpartBrief.leader.motivations.redLine, 180)}
              </p>
              {(counterpartBrief.leader.intelFragments.opening ?? []).length > 0 ? (
                <p className="mt-2 text-[0.7rem] leading-relaxed text-textMuted">
                  <span className="text-textMain">Current read:</span>{' '}
                  {clipText((counterpartBrief.leader.intelFragments.opening ?? [])[0] ?? '', 170)}
                </p>
              ) : null}
            </div>
          ) : null}

          {intelligenceGapPreview.length > 0 ? (
            <div className="console-subpanel px-3 py-3">
              <p className="label">What We Still Don't Know</p>
              <div className="mt-2 space-y-2">
                {intelligenceGapPreview.map((entry) => (
                  <p key={entry} className="border-l border-borderTone/80 pl-3 text-[0.72rem] leading-relaxed text-textMuted">
                    {clipText(entry, 200)}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  const renderIndicators = () => (
    <div className="space-y-4">
      <MeterDashboard
        meters={meters}
        previousMeters={previousMeters}
        meterHistory={meterHistory}
        embedded
      />
    </div>
  );

  const renderSectionContent = (section: BriefingSectionId) => {
    if (section === 'context') {
      return renderContext();
    }
    if (section === 'indicators') {
      return renderIndicators();
    }
    return renderDevelopments();
  };

  return (
    <section className="console-panel console-panel-muted p-4 sm:p-5">
      <div className={`grid gap-4 ${scenarioWorld?.theaterDiagram ? 'xl:grid-cols-[1.04fr_0.96fr]' : ''}`}>
        <article className="console-subpanel px-4 py-3">
          <p className="label">Current Situation</p>
          <p className="mt-3 border-l-2 border-accent/70 pl-4 text-sm leading-relaxed text-textMain">
            {briefing.briefingParagraph}
          </p>
        </article>

        {scenarioWorld?.theaterDiagram ? (
          <figure className="overflow-hidden rounded-md border border-borderTone/80 bg-surface/65">
            <div className="flex items-center justify-between border-b border-borderTone/80 px-3 py-2">
              <p className="label">Theater Diagram</p>
              <span className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Route context</span>
            </div>
            <img
              src={scenarioWorld.theaterDiagram.path}
              alt={scenarioWorld.theaterDiagram.alt}
              className="h-[18rem] w-full bg-surface object-contain p-2 sm:h-[20rem]"
              loading="lazy"
            />
            <figcaption className="border-t border-borderTone/80 px-3 py-2 text-[0.7rem] leading-relaxed text-textMuted">
              {scenarioWorld.theaterDiagram.caption}
            </figcaption>
          </figure>
        ) : null}
      </div>

      <section className="mt-4 console-subpanel px-3 py-3">
        <div className="hidden lg:block">
          <div className="flex flex-wrap gap-2 border-b border-borderTone/70 pb-3">
            {(Object.keys(sectionLabels) as BriefingSectionId[]).map((section) => {
              const active = activeSection === section;
              return (
                <button
                  key={section}
                  type="button"
                  className={`briefing-tab ${active ? 'briefing-tab-active' : ''}`}
                  onClick={() => setActiveSection(section)}
                >
                  {sectionLabels[section]}
                </button>
              );
            })}
          </div>
          <div className="mt-4 min-h-[18rem]">{renderSectionContent(activeSection)}</div>
        </div>

        <div className="space-y-2 lg:hidden">
          {(Object.keys(sectionLabels) as BriefingSectionId[]).map((section) => {
            const active = activeSection === section;
            return (
              <div key={section} className="rounded-md border border-borderTone/70 bg-panelRaised/35">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                  onClick={() => setActiveSection(section)}
                >
                  <span className="label text-textMain">{sectionLabels[section]}</span>
                  <span className="text-[0.58rem] uppercase tracking-[0.12em] text-accent">
                    {active ? 'Open' : 'View'}
                  </span>
                </button>
                {active ? <div className="border-t border-borderTone/70 px-3 py-3">{renderSectionContent(section)}</div> : null}
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
};
