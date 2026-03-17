import { useEffect, useMemo, useState } from 'react';

import type {
  ActionNarrativePhaseContent,
  BeatTruthModel,
  EpisodeMeterHistoryPoint,
  ImageAsset,
  MeterKey,
  MeterState,
  NarrativeBundle,
  ScenarioContextSection,
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
  truthModel: BeatTruthModel | null;
  windowContextSections: ScenarioContextSection[];
  imageAsset: ImageAsset | null;
  supportingImageAssets: ImageAsset[];
  imageCaptionOverride?: string | null;
  supportingSignals: BriefingSignalItem[];
  turnDebrief: TurnDebrief | null;
  recentActionNarrative: {
    actionName: string;
    phaseLabel: string;
    detail: ActionNarrativePhaseContent;
  } | null;
  recentResolvedAction: {
    label: string;
    summary: string | null;
    hiddenDownsideCategory: string | null;
    narrativeEmphasis: string | null;
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

const normalizeTickerLine = (value: string): string =>
  value.replace(/^(risk|market)\s+ticker:\s*/i, '').trim();

const imagePanelLabel = (asset: ImageAsset): string => {
  if (asset.kind === 'map') {
    return 'Situation Map';
  }
  if (asset.kind === 'artifact') {
    return 'Live Artifact';
  }
  return 'Live Visual';
};

const imagePanelMode = (asset: ImageAsset): string => {
  if (asset.kind === 'map') {
    return 'Orientation';
  }
  if (asset.kind === 'artifact') {
    return 'Evidence';
  }
  return 'Scene Read';
};

const hiddenDownsideLabel = (category?: string | null): string => {
  if (!category) {
    return 'Delayed downside';
  }

  const labels: Record<string, string> = {
    attribution: 'Attribution risk',
    collection_overreach: 'Collection overreach',
    counterintrusion: 'Counterintrusion',
    exposure: 'Exposure risk',
    false_relief: 'False relief',
    financial_spillover: 'Financial spillover',
    force_burn: 'Force burn',
    humiliation: 'Humiliation risk',
    market_panic: 'Market panic',
    miscalculation: 'Miscalculation',
    misread_weakness: 'Misread weakness',
    normalized_coercion: 'Normalized coercion',
    panic_buying: 'Panic buying',
    panic_signal: 'Panic signal',
    public_commitment: 'Public commitment trap',
    reciprocal_cyber: 'Reciprocal cyber',
    retaliatory_cyber: 'Retaliatory cyber',
    retaliatory_pressure: 'Retaliatory pressure',
    slow_rollout: 'Slow rollout',
    strategic_retreat: 'Strategic retreat signal',
    systemic_spillover: 'Systemic spillover',
    underreaction: 'Underreaction',
    visible_blink: 'Visible blink'
  };

  return labels[category] ?? 'Delayed downside';
};

const describeShiftInScene = (key: MeterKey, delta: number): string => {
  if (key === 'economicStability') {
    return delta < 0
      ? 'Insurers widen cover, cargo planners start holding shipments, and the commercial read darkens almost immediately.'
      : 'For the moment, freight desks stop assuming the corridor is about to fail outright.'
  }
  if (key === 'energySecurity') {
    return delta < 0
      ? 'Fuel and logistics desks begin treating Taiwan as part of a wider supply shock instead of a contained regional scare.'
      : 'Energy and logistics planners get a little room back, even if nobody trusts it to last.'
  }
  if (key === 'domesticCohesion') {
    return delta < 0
      ? 'Political aides stop talking only about optics and start asking what shortages, layoffs, or public anger might look like if this keeps spreading.'
      : 'For a few hours the domestic picture holds, which matters because panic at home can break strategy abroad.'
  }
  if (key === 'militaryReadiness') {
    return delta < 0
      ? 'Commanders are warning that every new visible move is burning real slack now.'
      : 'More readiness is on the board, which may steady deterrence or shorten warning time if it is misread.'
  }
  if (key === 'allianceTrust') {
    return delta < 0
      ? 'Calls with allied capitals get sharper as governments start diverging on how much more pain they will absorb.'
      : 'For the moment, allied capitals are speaking from the same page instead of improvising in public.';
  }

  return delta > 0
    ? 'Hotlines sound busier, pilots and captains sound jumpier, and nobody is trusting the next clean picture.'
    : 'The pace slackens for the moment, but nobody in the room thinks the danger is gone.';
};

export const BriefingPanel = ({
  turn,
  briefing,
  scenarioWorld,
  truthModel,
  windowContextSections,
  imageAsset,
  supportingImageAssets,
  imageCaptionOverride,
  supportingSignals,
  turnDebrief,
  recentActionNarrative,
  recentResolvedAction,
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
  const [showBackground, setShowBackground] = useState(false);
  const [expandedBackgroundSectionId, setExpandedBackgroundSectionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<BriefingSectionId>('developments');

  useEffect(() => {
    setActiveSection('developments');
    setExpandedHeadline(null);
    setShowOperationalReadout(false);
    setShowPhaseTransition(Boolean(phaseTransition));
    setShowAllDevelopments(false);
    setShowAllSignals(false);
    setShowBackground(false);
    setExpandedBackgroundSectionId(null);
  }, [turn, phaseTransition?.key]);

  const signalDetails = useMemo(() => {
    return briefing.headlines.map((_, index) => {
      const details: string[] = [];
      if (index === 0 && briefing.memoLine) {
        details.push(briefing.memoLine);
      }
      if (index === 1 && briefing.tickerLine) {
        details.push(normalizeTickerLine(briefing.tickerLine));
      }
      if (details.length === 0 && index === 0 && briefing.tickerLine) {
        details.push(normalizeTickerLine(briefing.tickerLine));
      }
      if (details.length === 0) {
        details.push('Operators are still trying to match the latest report against theater feeds and commercial traffic data.');
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

  const openingBackground = turn === 1 ? scenarioWorld?.openingBackground ?? null : null;
  const primaryHeadlines = briefing.headlines.slice(0, 2);
  const secondaryHeadlines = briefing.headlines.slice(2);
  const visibleSupportingSignals = showAllSignals ? supportingSignals : supportingSignals.slice(0, 2);
  const hiddenSignalCount = Math.max(0, supportingSignals.length - visibleSupportingSignals.length);
  const truthSections = truthModel
    ? ([
        {
          id: 'verified',
          title: 'Verified Facts',
          items: truthModel.verifiedFacts,
          accent: 'text-positive'
        },
        {
          id: 'theories',
          title: 'Working Theories',
          items: truthModel.workingTheories,
          accent: 'text-accent'
        },
        {
          id: 'unknowns',
          title: 'Unknowns',
          items: truthModel.unknowns,
          accent: 'text-warning'
        }
      ] as const).filter((section) => section.items.length > 0)
    : [];
  const recentMeterShifts = useMemo(() => {
    if (!previousMeters) {
      return [];
    }

    return (Object.keys(meters) as MeterKey[])
      .map((key) => ({
        key,
        delta: meters[key] - previousMeters[key]
      }))
      .filter((entry) => entry.delta !== 0)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .slice(0, 2);
  }, [meters, previousMeters]);
  const immediateOutcomeCards = recentActionNarrative
    ? [
        {
          id: 'everyone_saw',
          label: 'What Everyone Saw',
          body: recentActionNarrative.detail.executionNarrative
        },
        {
          id: 'offstage',
          label: 'What Changed Offstage',
          body: [
            recentActionNarrative.detail.successOutcome,
            recentMeterShifts[0] ? describeShiftInScene(recentMeterShifts[0].key, recentMeterShifts[0].delta) : null
          ]
            .filter(Boolean)
            .join(' ')
        },
        {
          id: 'room_fears',
          label: recentResolvedAction?.hiddenDownsideCategory
            ? `What The Room Fears Now // ${hiddenDownsideLabel(recentResolvedAction.hiddenDownsideCategory)}`
            : 'What The Room Fears Now',
          body: recentActionNarrative.detail.complicationOutcome
        }
      ]
    : [];

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
              Read the signal picture first: what is confirmed, what analysts think may be happening, and what is still unknown.
            </p>
          </div>
          <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
            {truthSections.length > 0 ? 'Live read' : 'Open for detail'}
          </p>
        </div>
        {truthSections.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {truthSections.map((section) => (
              <article key={section.id} className="console-subpanel px-3 py-3">
                <p className={`text-[0.58rem] uppercase tracking-[0.12em] ${section.accent}`}>{section.title}</p>
                <div className="mt-2 space-y-2">
                  {section.items.map((item) => (
                    <div key={item.id} className="rounded-md border border-borderTone/70 bg-panelRaised/35 px-3 py-2.5">
                      <p className="text-[0.64rem] uppercase tracking-[0.1em] text-textMain">{item.title}</p>
                      <p className="mt-1 text-[0.7rem] leading-relaxed text-textMuted">{item.body}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <>
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
          </>
        )}
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
          {recentResolvedAction ? (
            <p className="mt-2 text-[0.68rem] leading-relaxed text-textMuted">
              Last move: <span className="text-textMain">{recentResolvedAction.label}</span>
              {recentResolvedAction.summary ? ` // ${recentResolvedAction.summary}` : ''}
            </p>
          ) : null}
          {immediateOutcomeCards.length > 0 ? (
            <div className="mt-3 grid gap-2 xl:grid-cols-3">
              {immediateOutcomeCards.map((card) => (
                <article key={card.id} className="rounded-md border border-borderTone/70 bg-panelRaised/35 px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{card.label}</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{card.body}</p>
                </article>
              ))}
            </div>
          ) : null}
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
      {windowContextSections.length > 0 ? (
        <section className="grid gap-3 xl:grid-cols-2">
          {windowContextSections.map((section) => (
            <article key={section.id} className="console-subpanel px-3 py-3">
              <p className="label">{section.title}</p>
              <p className="mt-2 text-[0.74rem] leading-relaxed text-textMuted">{section.body}</p>
            </article>
          ))}
        </section>
      ) : (
        <section className="console-subpanel px-3 py-3">
          <p className="label">Context</p>
          <p className="mt-2 text-[0.74rem] leading-relaxed text-textMuted">
            No additional context is loaded for this window. Use the current situation and key developments to guide the next response.
          </p>
        </section>
      )}
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
      <div
        className={`grid gap-4 ${
          imageAsset || supportingImageAssets.length > 0 || scenarioWorld?.theaterDiagram
            ? 'xl:grid-cols-[1.04fr_0.96fr]'
            : ''
        }`}
      >
        <div className="space-y-4">
          <article className="console-subpanel px-4 py-3">
            <p className="label">Current Situation</p>
            <p className="mt-3 border-l-2 border-accent/70 pl-4 text-sm leading-relaxed text-textMain">
              {briefing.briefingParagraph}
            </p>
          </article>

          {openingBackground ? (
            <section className="console-subpanel px-4 py-3">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => setShowBackground((current) => !current)}
              >
                <div>
                  <p className="label">Background</p>
                  <p className="mt-2 text-[0.78rem] leading-relaxed text-textMuted">{openingBackground.summary}</p>
                </div>
                <span className="text-[0.58rem] uppercase tracking-[0.12em] text-accent">
                  {showBackground ? 'Hide' : 'Open'}
                </span>
              </button>
              {showBackground ? (
                <div className="mt-3 space-y-2 border-t border-borderTone/70 pt-3">
                  {openingBackground.sections.map((section) => {
                    const open = expandedBackgroundSectionId === section.id;
                    return (
                      <article key={section.id} className="rounded-md border border-borderTone/70 bg-panelRaised/35">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                          onClick={() => setExpandedBackgroundSectionId(open ? null : section.id)}
                        >
                          <span className="text-[0.62rem] uppercase tracking-[0.12em] text-textMain">{section.title}</span>
                          <span className="text-[0.58rem] uppercase tracking-[0.12em] text-accent">
                            {open ? 'Hide' : 'Open'}
                          </span>
                        </button>
                        {open ? (
                          <div className="border-t border-borderTone/70 px-3 py-2.5 text-[0.72rem] leading-relaxed text-textMuted">
                            {section.body}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        {imageAsset || supportingImageAssets.length > 0 ? (
          <div className="space-y-3">
            {imageAsset ? (
              <figure className="overflow-hidden rounded-md border border-borderTone/80 bg-surface/65">
                <div className="flex items-center justify-between border-b border-borderTone/80 px-3 py-2">
                  <p className="label">{imagePanelLabel(imageAsset)}</p>
                  <span className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
                    {imagePanelMode(imageAsset)}
                  </span>
                </div>
                <img
                  src={imageAsset.path}
                  alt={imageAsset.alt}
                  className={`h-[18rem] w-full bg-surface sm:h-[20rem] ${
                    imageAsset.kind === 'map' || imageAsset.kind === 'artifact' ? 'object-contain p-2' : 'object-cover'
                  }`}
                  loading="lazy"
                />
                <figcaption className="border-t border-borderTone/80 px-3 py-2 text-[0.7rem] leading-relaxed text-textMuted">
                  {imageCaptionOverride ?? imageAsset.caption}
                </figcaption>
              </figure>
            ) : null}

            {supportingImageAssets.length > 0 ? (
              <div className={`grid gap-3 ${supportingImageAssets.length > 1 ? 'md:grid-cols-2' : ''}`}>
                {supportingImageAssets.map((asset) => (
                  <figure key={asset.id} className="overflow-hidden rounded-md border border-borderTone/80 bg-surface/65">
                    <div className="flex items-center justify-between border-b border-borderTone/80 px-3 py-2">
                      <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{imagePanelLabel(asset)}</p>
                      <span className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
                        {imagePanelMode(asset)}
                      </span>
                    </div>
                    <img
                      src={asset.path}
                      alt={asset.alt}
                      className={`h-[10.5rem] w-full bg-surface ${
                        asset.kind === 'map' || asset.kind === 'artifact' ? 'object-contain p-2' : 'object-cover'
                      }`}
                      loading="lazy"
                    />
                    <figcaption className="border-t border-borderTone/80 px-3 py-2 text-[0.66rem] leading-relaxed text-textMuted">
                      {asset.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        ) : scenarioWorld?.theaterDiagram ? (
          <figure className="overflow-hidden rounded-md border border-borderTone/80 bg-surface/65">
            <div className="flex items-center justify-between border-b border-borderTone/80 px-3 py-2">
              <p className="label">Situation Map</p>
              <span className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Orientation</span>
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
