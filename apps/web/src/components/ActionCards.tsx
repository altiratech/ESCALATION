import { useMemo, useState, type ReactNode } from 'react';

import type { ActionDefinition, ActionNarrativePhaseContent, ActionVariantDefinition } from '@wargames/shared-types';

interface ActionCardsProps {
  actions: ActionDefinition[];
  disabled: boolean;
  selectedActionId: string | null;
  selectedVariantId?: string | null;
  selectedVariantLabel?: string | null;
  selectedCustomLabel?: string | null;
  selectedInterpretationRationale?: string | null;
  selectedNarrativeEmphasis?: string | null;
  selectedActionNarrativePreview?: ActionNarrativePhaseContent | null;
  actionAdvisorSummaries: Map<string, { supports: number; cautions: number; opposes: number }>;
  customResponseSlot?: ReactNode;
  onSelect: (actionId: string) => void;
}

const getDefaultVariant = (action: ActionDefinition): ActionVariantDefinition | null => {
  if (!action.variants || action.variants.length === 0) {
    return null;
  }

  return (
    action.variants.find((variant) => variant.id === action.defaultVariantId || variant.isDefault) ??
    action.variants[0] ??
    null
  );
};

const getSelectedVariant = (action: ActionDefinition, selectedVariantId?: string | null): ActionVariantDefinition | null => {
  if (!selectedVariantId) {
    return getDefaultVariant(action);
  }

  return action.variants?.find((variant) => variant.id === selectedVariantId) ?? getDefaultVariant(action);
};

const visibilityTone = (visibility: ActionDefinition['visibility']): string => {
  if (visibility === 'public') {
    return 'text-warning';
  }
  if (visibility === 'semi-public') {
    return 'text-accent';
  }
  return 'text-positive';
};

const postureHint = (action: ActionDefinition): string => {
  const netEscalation = action.signal.escalatory - action.signal.deescalatory;
  if (netEscalation >= 0.5) {
    return 'Beijing is likely to read this as a firmer show of resolve. Allies and markets will quickly judge whether it looks controlled or reckless.';
  }
  if (netEscalation <= -0.5) {
    return 'Beijing is likely to read this as controlled restraint. Allies will test whether it preserves leverage or looks like a step back.';
  }
  return 'Beijing is likely to read this as a mixed signal. It preserves room to maneuver, but it may delay allied commitment and market stabilization.';
};

const visibilityHint = (visibility: ActionDefinition['visibility']): string => {
  if (visibility === 'public') {
    return 'Governments, the counterpart, media channels, insurers, and market participants can react within minutes.';
  }
  if (visibility === 'semi-public') {
    return 'Allied governments, counterpart officials, and industry channels are likely to react first. Broader market awareness can follow quickly on leaks.';
  }
  return 'Initial reaction should stay inside closed channels, but execution problems or leaks can still push the move into public view.';
};

const riskHint = (action: ActionDefinition): string => {
  const dominant = Math.max(
    action.signal.humiliationRisk,
    action.signal.economicStressSignal,
    action.signal.allianceStressSignal
  );
  if (dominant === action.signal.humiliationRisk) {
    return 'Principal risk: Beijing may answer with a sharper move rather than appear to yield under pressure.';
  }
  if (dominant === action.signal.economicStressSignal) {
    return 'Principal risk: shipping, inventory, insurance, and market confidence could deteriorate faster than the coalition can stabilize them.';
  }
  return 'Principal risk: allies may interpret the move differently, weakening joint leverage and broader market confidence.';
};

const firstImpactHint = (action: ActionDefinition): string => {
  if (action.signal.economicStressSignal >= 0.55) {
    return 'Likely first impact: shipping rates, insurance pricing, semiconductor-sensitive names, and broad risk sentiment are the first places to move.';
  }
  if (action.signal.allianceStressSignal >= 0.55) {
    return 'Likely first impact: allied messaging and coalition discipline may wobble, which quickly feeds uncertainty into commercial planning and markets.';
  }
  const netEscalation = action.signal.escalatory - action.signal.deescalatory;
  if (netEscalation >= 0.5) {
    return 'Likely first impact: counterpart military and diplomatic channels harden first; market repricing usually follows once follow-through becomes visible.';
  }
  if (netEscalation <= -0.5) {
    return 'Likely first impact: sentiment and freight expectations may stabilize briefly, provided the move is not read as concession.';
  }
  return 'Likely first impact: most stakeholders will wait for follow-through before repricing risk or changing posture.';
};

const actionOneLiner = (action: ActionDefinition): string => {
  const loweredTags = action.tags.map((tag) => tag.toLowerCase());

  if (loweredTags.includes('diplomacy') && action.visibility === 'secret') {
    return 'Use private channels to test an off-ramp without changing the public posture yet.';
  }
  if (loweredTags.includes('diplomacy') && action.visibility !== 'secret') {
    return 'Put terms on the table publicly and test whether the counterpart wants a visible offramp.';
  }
  if (loweredTags.includes('military')) {
    return 'Change visible military posture to raise the cost of another coercive move.';
  }
  if (loweredTags.includes('intel')) {
    return 'Strengthen surveillance, attribution, and defensive readiness before making a larger move.';
  }
  if (loweredTags.includes('economic')) {
    return 'Use commercial and financial pressure to impose cost beyond the military channel.';
  }

  return action.summary;
};

const hiddenDownsideMeta = (category?: string | null): { label: string; detail: string } | null => {
  if (!category) {
    return null;
  }

  const map: Record<string, { label: string; detail: string }> = {
    attribution: {
      label: 'Attribution risk',
      detail: 'The move can be traced back quickly enough to erase deniability and invite direct counterpressure.'
    },
    collection_overreach: {
      label: 'Collection overreach',
      detail: 'The push for clarity can expose methods or create a noisy intelligence picture that is harder to trust.'
    },
    counterintrusion: {
      label: 'Counterintrusion',
      detail: 'A stronger defensive or cyber move can trigger a reciprocal probe against allied or commercial systems.'
    },
    exposure: {
      label: 'Exposure risk',
      detail: 'A move meant to stay contained can leak, forcing public explanation before the coalition is ready.'
    },
    false_relief: {
      label: 'False relief',
      detail: 'A calmer signal can disguise a harder follow-on move and pull operators into lowering their guard too early.'
    },
    financial_spillover: {
      label: 'Financial spillover',
      detail: 'What begins as a strategic move can quickly widen into margin stress, funding pressure, and broader market instability.'
    },
    force_burn: {
      label: 'Force burn',
      detail: 'Visible readiness can consume limited capacity faster than planners can replenish it.'
    },
    humiliation: {
      label: 'Humiliation risk',
      detail: 'If the counterpart reads the move as public humiliation, the next step can become more retaliatory and less reversible.'
    },
    market_panic: {
      label: 'Market panic',
      detail: 'Markets may treat the move as the start of something worse and reprice faster than governments can steady expectations.'
    },
    miscalculation: {
      label: 'Miscalculation',
      detail: 'The move can be read as preparation for something larger, increasing the odds of an unnecessary collision.'
    },
    misread_weakness: {
      label: 'Misread weakness',
      detail: 'A cautious move can be interpreted as hesitation, encouraging a harder test instead of restraint.'
    },
    normalized_coercion: {
      label: 'Normalized coercion',
      detail: 'If pressure is left partially unanswered, it can harden into a new operating baseline around the corridor.'
    },
    panic_buying: {
      label: 'Panic buying',
      detail: 'Commercial actors may rush to secure inventory and routing, worsening shortages and price shock.'
    },
    panic_signal: {
      label: 'Panic signal',
      detail: 'The move itself may communicate alarm, convincing allies and markets that the worst case is closer than they thought.'
    },
    public_commitment: {
      label: 'Public commitment trap',
      detail: 'Once the line is public, backing away becomes reputationally harder even if conditions change.'
    },
    reciprocal_cyber: {
      label: 'Reciprocal cyber',
      detail: 'The move can invite a symmetric digital response against logistics, communications, or commercial infrastructure.'
    },
    retaliatory_cyber: {
      label: 'Retaliatory cyber',
      detail: 'Counterpressure may surface first in cyber channels instead of the visible military lane.'
    },
    retaliatory_pressure: {
      label: 'Retaliatory pressure',
      detail: 'A firmer move can trigger an immediate answer intended to prove the counterpart still controls the pace.'
    },
    slow_rollout: {
      label: 'Slow rollout',
      detail: 'The move may be too gradual to shape expectations before the next shock arrives.'
    },
    strategic_retreat: {
      label: 'Strategic retreat signal',
      detail: 'The move can be read as preparing to step back rather than preparing to hold the line.'
    },
    systemic_spillover: {
      label: 'Systemic spillover',
      detail: 'The damage can escape the immediate theater and begin stressing the wider financial and operating system.'
    },
    underreaction: {
      label: 'Underreaction',
      detail: 'A moderate signal can buy time but also leave the other side believing the pressure remains cheap.'
    },
    visible_blink: {
      label: 'Visible blink',
      detail: 'If the move looks like a concession, allies and markets may start planning around a weaker coalition line.'
    }
  };

  return map[category] ?? {
    label: 'Hidden downside',
    detail: 'This move carries a delayed risk that may not be obvious until the next decision window.'
  };
};

const firstShockLine = (action: ActionDefinition): string => {
  const loweredTags = action.tags.map((tag) => tag.toLowerCase());

  if (loweredTags.includes('economic')) {
    return 'First shock will likely show up in funding, freight, insurance, and inventory planning.';
  }
  if (loweredTags.includes('intel')) {
    return 'First effect lands in the picture itself: attribution, confidence, and warning time.';
  }
  if (loweredTags.includes('military')) {
    return 'First effect lands in operational tempo and how seriously the counterpart takes the coalition posture.';
  }
  if (loweredTags.includes('diplomacy')) {
    return 'First effect lands in signaling and whether allies see room for a controlled offramp.';
  }
  if (loweredTags.includes('messaging')) {
    return 'First effect lands in public interpretation, coalition messaging, and market sentiment.';
  }

  return 'First effect lands in how the counterpart, allies, and commercial operators interpret the next move.';
};

export const ActionCards = ({
  actions,
  disabled,
  selectedActionId,
  selectedVariantId,
  selectedVariantLabel,
  selectedCustomLabel,
  selectedInterpretationRationale,
  selectedNarrativeEmphasis,
  selectedActionNarrativePreview,
  actionAdvisorSummaries,
  customResponseSlot,
  onSelect
}: ActionCardsProps) => {
  const [showHelp, setShowHelp] = useState(false);

  const sorted = useMemo(() => {
    return [...actions].sort((left, right) => left.name.localeCompare(right.name));
  }, [actions]);

  const selectedAction = useMemo(
    () => sorted.find((entry) => entry.id === selectedActionId) ?? null,
    [selectedActionId, sorted]
  );
  const selectedVariant = useMemo(
    () => (selectedAction ? getSelectedVariant(selectedAction, selectedVariantId) : null),
    [selectedAction, selectedVariantId]
  );

  return (
    <section className="console-subpanel h-full px-3 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Response Options</p>
          <p className="mt-2 text-[0.74rem] leading-relaxed text-textMuted">
            Choose a response, review its likely strategic and market effects below, then confirm it when you are ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center border border-borderTone bg-panelRaised text-[0.72rem] text-textMuted transition hover:border-accent hover:text-textMain"
            onClick={() => setShowHelp((current) => !current)}
          >
            ?
          </button>
          <p className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">{sorted.length} options</p>
        </div>
      </div>

      {showHelp ? (
        <div className="mt-3 border border-borderTone/80 bg-panelRaised/55 px-3 py-2 text-[0.68rem] leading-relaxed text-textMuted">
          Workflow: choose a response, review how it is likely to be read, compare advisor views, and then confirm it
          when you are ready to move the scenario forward.
        </div>
      ) : null}

      <div className="mt-3">
        <p className="label">Available Responses</p>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {sorted.map((action) => {
          const active = action.id === selectedActionId;
          const summary = actionAdvisorSummaries.get(action.id) ?? { supports: 0, cautions: 0, opposes: 0 };
          const defaultVariant = getDefaultVariant(action);
          const downside = hiddenDownsideMeta(defaultVariant?.hiddenDownsideCategory);
          return (
            <button
              key={action.id}
              type="button"
              className={`w-full border px-3 py-2.5 text-left transition ${
                active
                  ? 'border-accent bg-accent/12 text-textMain shadow-[inset_0_-2px_0_rgba(255,177,0,1)]'
                  : 'border-borderTone/80 bg-panelRaised/55 text-textMuted hover:border-accent/70 hover:bg-panelRaised/75 hover:text-textMain'
              } ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
              disabled={disabled}
              onClick={() => onSelect(action.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-[0.92rem] text-inherit">{action.name}</p>
                    <span
                      className={`px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.12em] ${visibilityTone(action.visibility)}`}
                    >
                      {action.visibility}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">
                    {action.tags.slice(0, 2).join(' · ') || 'Response option'}
                  </p>
                  <p className="mt-2 text-[0.69rem] leading-relaxed text-textMain/90">
                    {defaultVariant?.summary ?? actionOneLiner(action)}
                  </p>
                  <p className="mt-1 text-[0.65rem] leading-relaxed text-textMuted">
                    {downside ? `${downside.label}: ${downside.detail}` : firstShockLine(action)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="px-0.5 py-0.5 text-[0.54rem] uppercase tracking-[0.12em] text-positive">
                      Supports {summary.supports}
                    </span>
                    <span className="px-0.5 py-0.5 text-[0.54rem] uppercase tracking-[0.12em] text-warning">
                      Cautions {summary.cautions}
                    </span>
                    <span className="px-0.5 py-0.5 text-[0.54rem] uppercase tracking-[0.12em] text-red-300">
                      Opposes {summary.opposes}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-[0.58rem] uppercase tracking-[0.12em] text-accent/90">
                  {active ? 'Selected' : 'Open'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {customResponseSlot ? <div className="mt-4">{customResponseSlot}</div> : null}

      <div className="mt-4 border border-borderTone bg-panelRaised/40 p-3">
        {selectedAction ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label">Selected Response</p>
                  {selectedCustomLabel ? (
                    <p className="mt-2 text-[0.58rem] uppercase tracking-[0.12em] text-accent">Custom framing</p>
                  ) : null}
                  <h3 className="mt-2 font-display text-xl text-textMain">{selectedCustomLabel ?? selectedAction.name}</h3>
                  {selectedVariantLabel ? (
                    <p className="mt-1 text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">
                      Response envelope: {selectedAction.name} · {selectedVariantLabel}
                    </p>
                  ) : null}
                </div>
              <span className={`px-2 py-1 text-[0.58rem] uppercase tracking-[0.12em] ${visibilityTone(selectedAction.visibility)}`}>
                {selectedAction.visibility}
              </span>
            </div>

            <div className="space-y-2">
              <p className="label">Immediate Move</p>
              <p className="text-[0.8rem] leading-relaxed text-textMain">
                {selectedVariant?.summary ?? actionOneLiner(selectedAction)}
              </p>
              <p className="text-[0.72rem] leading-relaxed text-textMuted">
                {selectedAction.summary}
              </p>
            </div>

            {selectedInterpretationRationale || selectedNarrativeEmphasis ? (
              <div className="grid gap-2 lg:grid-cols-2">
                {selectedInterpretationRationale ? (
                  <div className="console-subpanel px-3 py-2.5">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Custom Interpretation</p>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{selectedInterpretationRationale}</p>
                  </div>
                ) : null}
                {selectedNarrativeEmphasis ? (
                  <div className="console-subpanel px-3 py-2.5">
                    <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Likely Emphasis</p>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">{selectedNarrativeEmphasis}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

              <div className="grid gap-2 lg:grid-cols-2">
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Counterpart Read</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">
                    {selectedActionNarrativePreview?.rivalReaction ?? postureHint(selectedAction)}
                  </p>
                </div>
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Alliance / Market Read</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">
                    {selectedActionNarrativePreview?.allianceReaction ?? visibilityHint(selectedAction.visibility)}
                  </p>
                </div>
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">If This Lands</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">
                    {selectedActionNarrativePreview?.successOutcome ?? firstImpactHint(selectedAction)}
                  </p>
                </div>
                <div className="console-subpanel px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Delayed Risk</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">
                    {selectedActionNarrativePreview?.complicationOutcome ??
                      hiddenDownsideMeta(selectedVariant?.hiddenDownsideCategory)?.detail ??
                      riskHint(selectedAction)}
                  </p>
                </div>
              </div>

              {selectedVariant?.hiddenDownsideCategory ? (
                <div className="rounded-md border border-borderTone/80 bg-panelRaised/35 px-3 py-2.5">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">Hidden Downside</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-textMain">
                    {hiddenDownsideMeta(selectedVariant.hiddenDownsideCategory)?.label ?? 'Delayed downside'}{' '}
                    <span className="text-textMuted">
                      {hiddenDownsideMeta(selectedVariant.hiddenDownsideCategory)?.detail}
                    </span>
                  </p>
                </div>
              ) : null}

            <div className="flex flex-wrap gap-1.5">
              {selectedAction.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-borderTone/80 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.1em] text-textMuted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="label">Selected Response</p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-textMuted">
              No response selected yet. Choose one option above to load the likely consequences, advisor views, and confirmation path.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
