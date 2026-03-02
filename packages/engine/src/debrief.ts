import type {
  ActionDefinition,
  BeatPhase,
  DebriefTag,
  DebriefVariantCandidate,
  EventDefinition,
  MeterKey,
  MeterState,
  TurnDebrief
} from '@wargames/shared-types';

const meterNames: Record<MeterKey, string> = {
  economicStability: 'market stability',
  energySecurity: 'energy security',
  domesticCohesion: 'domestic cohesion',
  militaryReadiness: 'force readiness',
  allianceTrust: 'alliance trust',
  escalationIndex: 'escalation pressure'
};

const strongestShift = (before: MeterState, after: MeterState): { meter: MeterKey; delta: number } | null => {
  const candidates = (Object.keys(before) as MeterKey[]).map((meter) => ({
    meter,
    delta: after[meter] - before[meter]
  }));

  const ranked = candidates.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
  const top = ranked[0];
  if (!top || Math.abs(top.delta) < 1) {
    return null;
  }
  return top;
};

const qualitativeShift = (delta: number): string => {
  if (delta >= 8) {
    return 'surged sharply';
  }
  if (delta >= 4) {
    return 'increased materially';
  }
  if (delta >= 1) {
    return 'ticked upward';
  }
  if (delta <= -8) {
    return 'fell sharply';
  }
  if (delta <= -4) {
    return 'declined materially';
  }
  return 'eased slightly';
};

const line = (tag: DebriefTag, text: string): { tag: DebriefTag; text: string } => ({ tag, text });

type DebriefContext = {
  deltas: Record<MeterKey, number>;
  escalationAfter: number;
  turn: number;
  phase: BeatPhase;
  rivalAction: ActionDefinition;
  rivalTokenCount: number;
  triggeredEventCount: number;
  hasOnlyLowVisibilityEvents: boolean;
  primaryEvent: EventDefinition | null;
};

const normalizeCondition = (condition: string): string => condition.toLowerCase().replace(/\s+/g, ' ').trim();

const hasRivalTag = (action: ActionDefinition, tag: string): boolean => {
  const tags = new Set(action.tags.map((entry) => entry.toLowerCase()));
  switch (tag) {
    case 'escalate':
      return tags.has('military') || tags.has('coercion') || tags.has('retaliation') || tags.has('proxy');
    case 'deescalate':
      return tags.has('deescalation') || tags.has('diplomacy');
    case 'info':
      return tags.has('information') || tags.has('messaging');
    case 'military':
      return tags.has('military') || tags.has('posture');
    case 'economic':
      return tags.has('economic') || tags.has('energy');
    default:
      return tags.has(tag);
  }
};

const conditionMatches = (condition: string, context: DebriefContext): boolean => {
  const normalized = normalizeCondition(condition);
  const significantShiftCount = (Object.values(context.deltas)).filter((delta) => Math.abs(delta) >= 5).length;
  const allNearZero = (Object.values(context.deltas)).every((delta) => Math.abs(delta) <= 1);

  switch (normalized) {
    case 'escalationindex delta >= 8':
      return context.deltas.escalationIndex >= 8;
    case 'escalationindex delta 4-7':
      return context.deltas.escalationIndex >= 4 && context.deltas.escalationIndex <= 7;
    case 'escalationindex delta 1-3':
      return context.deltas.escalationIndex >= 1 && context.deltas.escalationIndex <= 3;
    case 'escalationindex delta < 0':
      return context.deltas.escalationIndex < 0;
    case 'alliancetrust delta > 0':
      return context.deltas.allianceTrust > 0;
    case 'alliancetrust delta < -4':
      return context.deltas.allianceTrust < -4;
    case 'economicstability delta < -4':
      return context.deltas.economicStability < -4;
    case 'militaryreadiness delta > 4':
      return context.deltas.militaryReadiness > 4;
    case 'domesticcohesion delta < -4':
      return context.deltas.domesticCohesion < -4;
    case 'multiple meters shifted significantly':
      return significantShiftCount >= 2;
    case 'all deltas near zero':
      return allNearZero;
    case 'energysecurity delta < -4':
      return context.deltas.energySecurity < -4;
    case 'turn >= 7':
      return context.turn >= 7;
    case 'turn >= 8':
      return context.turn >= 8;
    case 'phase == crisis':
      return context.phase === 'crisis';
    case 'rival action has escalate tag':
      return hasRivalTag(context.rivalAction, 'escalate');
    case 'rival action has deescalate tag':
      return hasRivalTag(context.rivalAction, 'deescalate');
    case 'rival action has covert tag':
      return hasRivalTag(context.rivalAction, 'covert');
    case 'rival action has economic tag':
      return hasRivalTag(context.rivalAction, 'economic');
    case 'rival action has info tag':
      return hasRivalTag(context.rivalAction, 'info');
    case 'rival action has military tag':
      return hasRivalTag(context.rivalAction, 'military');
    case 'rival action is proxy_incident':
      return context.rivalAction.id === 'rival_proxy_incident';
    case 'no rivalnarrativetokens available':
      return context.rivalTokenCount === 0;
    case 'rival action is backchannel_reply':
      return context.rivalAction.id === 'rival_backchannel_reply';
    case 'escalationindex >= 70':
      return context.escalationAfter >= 70;
    case 'multiple rivalnarrativetokens':
      return context.rivalTokenCount >= 2;
    case 'rival action diverges from assessed probability':
      return false;
    case 'publicvisibility >= 0.9':
      return (context.primaryEvent?.publicVisibility ?? -1) >= 0.9;
    case 'publicvisibility 0.7-0.89':
      return (context.primaryEvent?.publicVisibility ?? -1) >= 0.7 && (context.primaryEvent?.publicVisibility ?? -1) < 0.9;
    case 'publicvisibility < 0.7':
      return context.primaryEvent !== null && context.primaryEvent.publicVisibility < 0.7;
    case 'no triggered events':
      return context.triggeredEventCount === 0;
    case 'multiple events triggered':
      return context.triggeredEventCount >= 2;
    case 'event domain == unrest':
      return context.primaryEvent?.domain === 'unrest';
    case 'event domain == energy':
      return context.primaryEvent?.domain === 'energy';
    case 'event domain == economy':
      return context.primaryEvent?.domain === 'economy';
    case 'event domain == military':
      return context.primaryEvent?.domain === 'military';
    case 'event domain == diplomacy':
      return context.primaryEvent?.domain === 'diplomacy';
    case 'triggered events all below visibility threshold':
      return context.triggeredEventCount > 0 && context.hasOnlyLowVisibilityEvents;
    case 'crisis phase with triggered event':
      return context.phase === 'crisis' && context.triggeredEventCount > 0;
    default:
      return false;
  }
};

const selectDebriefVariant = (
  source: DebriefTag,
  variants: DebriefVariantCandidate[],
  context: DebriefContext
): DebriefVariantCandidate | null => {
  const bySource = variants.filter((variant) => variant.source === source);
  if (bySource.length === 0) {
    return null;
  }

  if (source === 'SecondaryEffect' && context.rivalTokenCount === 0) {
    const noToken = bySource.find((variant) => normalizeCondition(variant.condition) === 'no rivalnarrativetokens available');
    if (noToken) {
      return noToken;
    }
  }

  if (source === 'SystemEvent' && context.triggeredEventCount === 0) {
    const noEvents = bySource.find((variant) => normalizeCondition(variant.condition) === 'no triggered events');
    if (noEvents) {
      return noEvents;
    }
  }

  for (const variant of bySource) {
    if (conditionMatches(variant.condition, context)) {
      return variant;
    }
  }

  return null;
};

const applyTemplate = (
  template: string,
  values: { playerAction: string; rivalAction: string; rivalToken: string; eventLabel: string }
): string =>
  template
    .replaceAll('{playerAction}', values.playerAction)
    .replaceAll('{rivalAction}', values.rivalAction)
    .replaceAll('{rivalToken}', values.rivalToken)
    .replaceAll('{eventLabel}', values.eventLabel);

export const buildTurnDebrief = (payload: {
  playerAction: ActionDefinition;
  rivalAction: ActionDefinition;
  meterBefore: MeterState;
  meterAfter: MeterState;
  turn: number;
  phase: BeatPhase;
  rivalNarrativeTokens: string[];
  narrativeTokens: string[];
  triggeredEventIds: string[];
  eventTable: EventDefinition[];
  debriefVariants?: DebriefVariantCandidate[];
}): TurnDebrief => {
  const lines: TurnDebrief['lines'] = [];
  const variants = payload.debriefVariants ?? [];
  const eventMap = new Map(payload.eventTable.map((event) => [event.id, event]));
  const triggeredEvents = payload.triggeredEventIds
    .map((id) => eventMap.get(id))
    .filter((event): event is EventDefinition => Boolean(event));
  const primaryEvent = [...triggeredEvents].sort((left, right) => right.publicVisibility - left.publicVisibility)[0] ?? null;
  const deltas: Record<MeterKey, number> = {
    economicStability: payload.meterAfter.economicStability - payload.meterBefore.economicStability,
    energySecurity: payload.meterAfter.energySecurity - payload.meterBefore.energySecurity,
    domesticCohesion: payload.meterAfter.domesticCohesion - payload.meterBefore.domesticCohesion,
    militaryReadiness: payload.meterAfter.militaryReadiness - payload.meterBefore.militaryReadiness,
    allianceTrust: payload.meterAfter.allianceTrust - payload.meterBefore.allianceTrust,
    escalationIndex: payload.meterAfter.escalationIndex - payload.meterBefore.escalationIndex
  };
  const debriefContext: DebriefContext = {
    deltas,
    escalationAfter: payload.meterAfter.escalationIndex,
    turn: payload.turn,
    phase: payload.phase,
    rivalAction: payload.rivalAction,
    rivalTokenCount: payload.rivalNarrativeTokens.length,
    triggeredEventCount: triggeredEvents.length,
    hasOnlyLowVisibilityEvents: triggeredEvents.length > 0 && triggeredEvents.every((event) => event.publicVisibility < 0.7),
    primaryEvent
  };

  const shift = strongestShift(payload.meterBefore, payload.meterAfter);
  const playerVariant = selectDebriefVariant('PlayerAction', variants, debriefContext);
  const actionLine = playerVariant
    ? applyTemplate(playerVariant.template, {
      playerAction: payload.playerAction.name.toLowerCase(),
      rivalAction: payload.rivalAction.name.toLowerCase(),
      rivalToken: payload.rivalNarrativeTokens[0]?.replaceAll('_', ' ') ?? 'secondary effects',
      eventLabel: primaryEvent?.label ?? 'background activity'
    })
    : shift
      ? `You authorized ${payload.playerAction.name.toLowerCase()}; ${meterNames[shift.meter]} ${qualitativeShift(shift.delta)} after implementation.`
      : `You authorized ${payload.playerAction.name.toLowerCase()}; immediate effects remained bounded under current conditions.`;

  lines.push(line('PlayerAction', actionLine));

  const rivalToken = payload.rivalNarrativeTokens[0];
  const secondaryVariant = selectDebriefVariant('SecondaryEffect', variants, debriefContext);
  const secondaryLine = secondaryVariant
    ? applyTemplate(secondaryVariant.template, {
      playerAction: payload.playerAction.name.toLowerCase(),
      rivalAction: payload.rivalAction.name.toLowerCase(),
      rivalToken: rivalToken?.replaceAll('_', ' ') ?? 'secondary effects',
      eventLabel: primaryEvent?.label ?? 'background activity'
    })
    : rivalToken
      ? `The rival answered with ${payload.rivalAction.name.toLowerCase()}, and follow-on reporting suggests ${rivalToken.replaceAll('_', ' ')} across the theater.`
      : `The rival answered with ${payload.rivalAction.name.toLowerCase()}, reinforcing a contested signaling environment.`;
  lines.push(line('SecondaryEffect', secondaryLine));

  const systemVariant = selectDebriefVariant('SystemEvent', variants, debriefContext);

  if (systemVariant) {
    lines.push(
      line(
        'SystemEvent',
        applyTemplate(systemVariant.template, {
          playerAction: payload.playerAction.name.toLowerCase(),
          rivalAction: payload.rivalAction.name.toLowerCase(),
          rivalToken: rivalToken?.replaceAll('_', ' ') ?? 'secondary effects',
          eventLabel: primaryEvent?.label ?? 'background activity'
        })
      )
    );
  } else if (primaryEvent && primaryEvent.publicVisibility >= 0.7) {
    lines.push(
      line(
        'SystemEvent',
        `Operational reporting indicates ${primaryEvent.label.toLowerCase()} activity; intelligence handling remains partially contested.`
      )
    );
  } else if (triggeredEvents.length > 0) {
    lines.push(
      line(
        'SystemEvent',
        'System activity accelerated in the background; available reporting remains incomplete.'
      )
    );
  }

  return {
    lines: lines.slice(0, 3)
  };
};
