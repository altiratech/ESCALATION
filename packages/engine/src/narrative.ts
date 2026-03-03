import type {
  ActionDefinition,
  BeatNode,
  GameState,
  MeterState,
  NarrativeBundle,
  AdversaryProfile
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

const describeMeterShift = (before: MeterState, after: MeterState): string[] => {
  const deltas: Array<{ label: string; delta: number }> = [
    { label: 'economic stability', delta: after.economicStability - before.economicStability },
    { label: 'energy security', delta: after.energySecurity - before.energySecurity },
    { label: 'domestic cohesion', delta: after.domesticCohesion - before.domesticCohesion },
    { label: 'military readiness', delta: after.militaryReadiness - before.militaryReadiness },
    { label: 'alliance trust', delta: after.allianceTrust - before.allianceTrust },
    { label: 'escalation pressure', delta: after.escalationIndex - before.escalationIndex }
  ];

  return deltas
    .filter((entry) => Math.abs(entry.delta) >= 2)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 2)
    .map((entry) => {
      const direction = entry.delta > 0 ? 'rose' : 'fell';
      return `${entry.label} ${direction} ${Math.abs(Math.round(entry.delta))} points`;
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
    headlines: ['Command authority transferred. First-turn options are now available.']
  };
};

export const buildOpeningNarrativeFromBeat = (
  scenarioBriefing: string,
  beat: BeatNode
): NarrativeBundle => {
  const bundle: NarrativeBundle = {
    briefingParagraph: `${scenarioBriefing} ${beat.sceneFragments[0] ?? ''}`.trim(),
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
  turn: number,
  playerAction: ActionDefinition,
  rivalAction: ActionDefinition,
  state: GameState,
  meterBefore: MeterState,
  meterAfter: MeterState,
  narrativeTokens: string[],
  rivalProfile: AdversaryProfile,
  activeBeat?: BeatNode
): NarrativeBundle => {
  const shifts = describeMeterShift(meterBefore, meterAfter);
  const dominantDomain = getDominantDomain({
    economicStability: meterAfter.economicStability - meterBefore.economicStability,
    energySecurity: meterAfter.energySecurity - meterBefore.energySecurity,
    domesticCohesion: meterAfter.domesticCohesion - meterBefore.domesticCohesion,
    militaryReadiness: meterAfter.militaryReadiness - meterBefore.militaryReadiness,
    allianceTrust: meterAfter.allianceTrust - meterBefore.allianceTrust,
    escalationIndex: meterAfter.escalationIndex - meterBefore.escalationIndex
  });

  const tempoPhrase =
    state.meters.escalationIndex > 72
      ? 'Crisis tempo accelerated beyond prior diplomatic containment.'
      : state.meters.escalationIndex < 44
        ? 'Operational pressure eased, though deterrence friction remains.'
        : 'The theater remains volatile with narrow room for signaling error.';

  const shiftSentence = shifts.length > 0 ? `Key shifts this turn: ${shifts.join('; ')}.` : 'No single metric moved decisively, but pressure remains cumulative.';

  const beatFragment = activeBeat?.sceneFragments[0] ?? '';
  const briefingParagraph = `Turn ${turn}: You authorized ${playerAction.name.toLowerCase()} while the rival answered with ${rivalAction.name.toLowerCase()}. ${tempoPhrase} ${shiftSentence} ${beatFragment} Rival posture reflects ${rivalProfile.name.toLowerCase()} behavior under stress.`
    .replace(/\s+/g, ' ')
    .trim();

  const tokenHeadlinesList = narrativeTokens
    .map((token) => tokenHeadlines[token])
    .filter((headline): headline is string => Boolean(headline));

  const defaultHeadline =
    state.meters.escalationIndex >= 70
      ? 'Defense Networks Shift to Elevated Readiness Across Theaters'
      : state.meters.escalationIndex <= 40
        ? 'Diplomatic Channels Reopen as Immediate Risk Moderates'
        : 'Competing Signals Keep Strategic Environment Unsettled';

  const beatHeadlines = activeBeat?.headlines ?? [];
  const headlines = [
    tokenHeadlinesList[0] ?? beatHeadlines[0] ?? defaultHeadline,
    tokenHeadlinesList[1] ?? beatHeadlines[1] ?? `${rivalProfile.name} leadership circle hardens narrative discipline.`
  ];

  return {
    briefingParagraph,
    headlines,
    memoLine: activeBeat?.memoLine ?? domainMemoLine(dominantDomain),
    tickerLine: activeBeat?.tickerLine ?? domainTickerLine(state)
  };
};
