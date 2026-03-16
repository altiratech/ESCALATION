import type {
  ActionDefinition,
  ActionVariantDefinition,
  BeatNode,
  GameState,
  MeterKey,
  MeterState,
  NarrativeBundle
} from '@wargames/shared-types';

import { getDominantDomain } from './utils';

const tokenHeadlines: Record<string, string> = {
  backchannel_leak: 'Leak Indicates Undisclosed Contacts Amid Crisis Talks',
  speech_seen_as_ultimatum: 'Regional Media Frames Address as Ultimatum',
  targeted_blowback: 'Secondary Market Frictions Follow Targeted Measures',
  supply_chain_shock: 'Shipping and Finance Channels Report Supply Shock',
  panic_buying: 'Commodity Markets Spike on Reserve Purchases',
  cyber_operation_exposed: 'Forensic Brief Points to Cross-Border Intrusion',
  reciprocal_cyber_strike: 'Critical Service Outages Follow Cyber Retaliation',
  covert_link_exposed: 'Investigative Leak Connects Sabotage to State Actors',
  unsafe_intercept: 'Unsafe Intercept Raises Collision Risk in Strait',
  withdrawal_misread: 'Rival Bloc Interprets Drawdown as Strategic Retreat',
  domestic_surveillance_concerns: 'Civil Oversight Panel Questions Expanded Collection',
  hawks_revolt: 'Domestic Hardliners Reject Concession Framework',
  probe_attributed: 'Attribution Report Credits Counterintelligence Gains',
  drill_accident: 'Training Incident Triggers Emergency Communications',
  rival_hardliner_pushback: 'Rival Hardliners Contest De-Escalation Line',
  disinfo_exposed: 'Coordinated Influence Campaign Exposed by Investigators',
  private_talks_stall: 'Sources Say Private Talks Stalled on Verification',
  street_unrest: 'Demonstrations Spread Across Major Urban Districts',
  power_grid_failure: 'Rolling Blackouts Hit Industrial and Residential Zones',
  markets_selloff: 'Risk Assets Slide on Escalation Premium',
  ally_rebukes_policy: 'Coalition Partner Publicly Distances from Tactics',
  unauthorized_clash: 'Unauthorized Armed Exchange Reported Near Transit Corridor'
};

const buildShiftSceneLine = (before: MeterState, after: MeterState): string | null => {
  const deltas = ([
    { key: 'economicStability', delta: after.economicStability - before.economicStability },
    { key: 'energySecurity', delta: after.energySecurity - before.energySecurity },
    { key: 'domesticCohesion', delta: after.domesticCohesion - before.domesticCohesion },
    { key: 'militaryReadiness', delta: after.militaryReadiness - before.militaryReadiness },
    { key: 'allianceTrust', delta: after.allianceTrust - before.allianceTrust },
    { key: 'escalationIndex', delta: after.escalationIndex - before.escalationIndex }
  ] satisfies Array<{ key: MeterKey; delta: number }>)
    .filter((entry) => Math.abs(entry.delta) >= 2)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 2);

  const phrases = deltas.map((entry) => {
    if (entry.key === 'economicStability') {
      return entry.delta < 0
        ? 'Container lines, insurers, and chip buyers start behaving as if the corridor may fail for real.'
        : 'For the moment, the commercial panic eases enough that desks stop assuming the corridor is already lost.';
    }
    if (entry.key === 'energySecurity') {
      return entry.delta < 0
        ? 'Fuel and freight planners begin treating Taiwan as part of a wider supply shock instead of a contained scare.'
        : 'Fuel and logistics desks get a little room back, even if nobody trusts it to last.';
    }
    if (entry.key === 'domesticCohesion') {
      return entry.delta < 0
        ? 'Political aides stop talking only about optics and start asking what shortages, layoffs, and public anger look like if this spreads.'
        : 'For one more window, the domestic picture holds together well enough to keep strategy from collapsing into panic.';
    }
    if (entry.key === 'militaryReadiness') {
      return entry.delta > 0
        ? 'More steel and surveillance are moving into view, which can steady deterrence or shorten warning time if misread.'
        : 'Some visible readiness comes off the table, which buys reversibility but invites a harder test if the other side senses hesitation.';
    }
    if (entry.key === 'allianceTrust') {
      return entry.delta < 0
        ? 'Calls with allied capitals get sharper as governments start diverging on how much more pain they will absorb.'
        : 'Allied capitals sound more synchronized for now, which matters because mixed messages feed panic fast.';
    }

    return entry.delta > 0
      ? 'Hotlines, pilots, and shipping desks are all working under a tighter clock now.'
      : 'The pace eases for a moment, but nobody in the room trusts the lull yet.';
  });

  if (phrases.length === 0) {
    return null;
  }

  return phrases.join(' ');
};

const buildShiftHeadlines = (before: MeterState, after: MeterState): string[] => {
  const meterChanges = [
    { key: 'economicStability', delta: after.economicStability - before.economicStability },
    { key: 'energySecurity', delta: after.energySecurity - before.energySecurity },
    { key: 'domesticCohesion', delta: after.domesticCohesion - before.domesticCohesion },
    { key: 'militaryReadiness', delta: after.militaryReadiness - before.militaryReadiness },
    { key: 'allianceTrust', delta: after.allianceTrust - before.allianceTrust },
    { key: 'escalationIndex', delta: after.escalationIndex - before.escalationIndex }
  ] satisfies Array<{ key: MeterKey; delta: number }>;

  const shifts: Array<{ key: MeterKey; delta: number }> = meterChanges
    .filter((entry) => Math.abs(entry.delta) >= 2)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 2);

  return shifts.map((entry) => {
    if (entry.key === 'economicStability') {
      return entry.delta < 0
        ? 'Shipping And Market Risk Reprice As Strait Pressure Persists'
        : 'Commercial Stress Eases As Immediate Strait Risk Stabilizes';
    }
    if (entry.key === 'energySecurity') {
      return entry.delta < 0
        ? 'Energy And Logistics Channels Show Strain Under Regional Stress'
        : 'Energy And Logistics Pressure Temporarily Stabilizes';
    }
    if (entry.key === 'domesticCohesion') {
      return entry.delta < 0
        ? 'Domestic Pressure Starts Feeding Back Into Strategic Choices'
        : 'Domestic Backing Holds Long Enough To Preserve Policy Flexibility';
    }
    if (entry.key === 'militaryReadiness') {
      return entry.delta > 0
        ? 'Visible Readiness Posture Hardens As Response Options Narrow'
        : 'Operational Posture Softens As Leaders Preserve Reversible Space';
    }
    if (entry.key === 'allianceTrust') {
      return entry.delta < 0
        ? 'Coalition Discipline Frays As Capitals Read The Crisis Differently'
        : 'Coalition Coordination Improves Around A Narrower Shared Line';
    }
    return entry.delta > 0
      ? 'Escalation Pressure Rises As Off-Ramp Space Tightens'
      : 'Escalation Pressure Eases As The Immediate Misread Risk Pulls Back';
  });
};

const domainMemoLine = (domain: string): string => {
  if (domain === 'economy') {
    return 'Leaked memo: Treasury desk warns of tightening sovereign risk spreads.';
  }
  if (domain === 'energy') {
    return 'Leaked memo: Grid operator requests emergency balancing authority.';
  }
  if (domain === 'military') {
    return 'Leaked memo: Rules of engagement review moved to immediate priority.';
  }
  if (domain === 'cyber') {
    return 'Leaked memo: Incident response cell elevated to 24/7 posture.';
  }
  if (domain === 'unrest') {
    return 'Leaked memo: Interior ministry requests rapid stabilization funding.';
  }
  return 'Leaked memo: Allied envoys request message discipline before next summit.';
};

const domainTickerLine = (state: GameState): string => {
  const premium = Math.round((state.meters.escalationIndex - state.meters.economicStability) * 0.9 + 42);
  return `Market ticker: Regional risk premium ${premium} bps | Energy basket ${Math.round(100 - state.meters.energySecurity + 88)}.`;
};

export const buildOpeningNarrative = (scenarioBriefing: string): NarrativeBundle => {
  return {
    briefingParagraph: scenarioBriefing,
    headlines: ['The first decision window is live and the room is waiting on your read.']
  };
};

export const buildOpeningNarrativeFromBeat = (
  scenarioBriefing: string,
  beat: BeatNode
): NarrativeBundle => {
  const openingParagraph =
    beat.sceneFragments.length > 0
      ? beat.sceneFragments.join(' ').trim()
      : scenarioBriefing;
  const bundle: NarrativeBundle = {
    briefingParagraph: openingParagraph,
    headlines: beat.headlines.slice(0, 2)
  };

  if (beat.memoLine !== null) {
    bundle.memoLine = beat.memoLine;
  }
  if (beat.tickerLine !== null) {
    bundle.tickerLine = beat.tickerLine;
  }

  return bundle;
};

export const buildNarrativeBundle = (
  _turn: number,
  playerAction: ActionDefinition,
  rivalAction: ActionDefinition,
  state: GameState,
  meterBefore: MeterState,
  meterAfter: MeterState,
  narrativeTokens: string[],
  activeBeat?: BeatNode,
  options?: {
    playerVariant?: ActionVariantDefinition | null;
    playerCustomLabel?: string | null;
  }
): NarrativeBundle => {
  const dominantDomain = getDominantDomain({
    economicStability: meterAfter.economicStability - meterBefore.economicStability,
    energySecurity: meterAfter.energySecurity - meterBefore.energySecurity,
    domesticCohesion: meterAfter.domesticCohesion - meterBefore.domesticCohesion,
    militaryReadiness: meterAfter.militaryReadiness - meterBefore.militaryReadiness,
    allianceTrust: meterAfter.allianceTrust - meterBefore.allianceTrust,
    escalationIndex: meterAfter.escalationIndex - meterBefore.escalationIndex
  });

  const beatFragment = activeBeat?.sceneFragments[0] ?? '';
  const beatSecondaryFragment = activeBeat?.sceneFragments[1] ?? '';
  const shiftSceneLine = buildShiftSceneLine(meterBefore, meterAfter);
  const playerActionLabel = options?.playerCustomLabel?.trim() || options?.playerVariant?.label || playerAction.name;
  const variantEmphasis = options?.playerVariant?.narrativeEmphasis?.trim() ?? '';
  const fallbackParagraph = `After ${playerActionLabel.toLowerCase()}, the room gets less certainty, not more. ${rivalAction.summary}`;
  const refinedBriefingParagraph = [
    beatFragment || fallbackParagraph,
    beatSecondaryFragment,
    shiftSceneLine,
    variantEmphasis
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokenHeadlinesList = narrativeTokens
    .map((token) => tokenHeadlines[token])
    .filter((headline): headline is string => Boolean(headline));
  const shiftHeadlines = buildShiftHeadlines(meterBefore, meterAfter);

  const defaultHeadline =
    state.meters.escalationIndex >= 70
      ? 'Secure Rooms Shift From Contingency Talk To Damage Control'
      : state.meters.escalationIndex <= 40
        ? 'The Immediate Panic Backs Off, But Nobody Calls The Crisis Safe'
        : 'New Fragments Keep The Situation Moving Faster Than The Story Around It';

  const beatHeadlines = activeBeat?.headlines ?? [];
  const headlines = Array.from(
    new Set([
      ...tokenHeadlinesList,
      ...shiftHeadlines,
      ...beatHeadlines,
      defaultHeadline
    ])
  ).slice(0, 2);

  return {
    briefingParagraph: refinedBriefingParagraph,
    headlines,
    memoLine: activeBeat?.memoLine ?? domainMemoLine(dominantDomain),
    tickerLine: activeBeat?.tickerLine ?? domainTickerLine(state)
  };
};
