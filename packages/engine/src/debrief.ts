import type {
  ActionDefinition,
  DebriefTag,
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

export const buildTurnDebrief = (payload: {
  playerAction: ActionDefinition;
  rivalAction: ActionDefinition;
  meterBefore: MeterState;
  meterAfter: MeterState;
  narrativeTokens: string[];
  triggeredEventIds: string[];
  eventTable: EventDefinition[];
}): TurnDebrief => {
  const lines: TurnDebrief['lines'] = [];

  const shift = strongestShift(payload.meterBefore, payload.meterAfter);
  const actionLine = shift
    ? `You authorized ${payload.playerAction.name.toLowerCase()}; ${meterNames[shift.meter]} ${qualitativeShift(shift.delta)} after implementation.`
    : `You authorized ${payload.playerAction.name.toLowerCase()}; immediate effects remained bounded under current conditions.`;

  lines.push(line('PlayerAction', actionLine));

  const rivalToken = payload.narrativeTokens[0];
  const secondaryLine = rivalToken
    ? `The rival answered with ${payload.rivalAction.name.toLowerCase()}, and follow-on reporting suggests ${rivalToken.replaceAll('_', ' ')} across the theater.`
    : `The rival answered with ${payload.rivalAction.name.toLowerCase()}, reinforcing a contested signaling environment.`;
  lines.push(line('SecondaryEffect', secondaryLine));

  const eventMap = new Map(payload.eventTable.map((event) => [event.id, event]));
  const visibleEvent = payload.triggeredEventIds
    .map((id) => eventMap.get(id))
    .find((event) => Boolean(event && event.publicVisibility >= 0.7));

  if (visibleEvent) {
    lines.push(
      line(
        'SystemEvent',
        `Operational reporting indicates ${visibleEvent.label.toLowerCase()} activity; intelligence handling remains partially contested.`
      )
    );
  } else if (payload.triggeredEventIds.length > 0) {
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
