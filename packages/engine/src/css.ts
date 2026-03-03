import type { CompressedStateSummary, GameState, MeterKey, AdversaryProfile } from '@wargames/shared-types';

const pressureLabelByMeter: Record<MeterKey, string> = {
  economicStability: 'market stress',
  energySecurity: 'energy insecurity',
  domesticCohesion: 'domestic fragmentation',
  militaryReadiness: 'force readiness volatility',
  allianceTrust: 'alliance fracture risk',
  escalationIndex: 'escalation momentum'
};

const dominantPressure = (state: GameState): string => {
  const stress = [
    { meter: 'economicStability' as const, score: 100 - state.meters.economicStability },
    { meter: 'energySecurity' as const, score: 100 - state.meters.energySecurity },
    { meter: 'domesticCohesion' as const, score: 100 - state.meters.domesticCohesion },
    { meter: 'militaryReadiness' as const, score: 100 - state.meters.militaryReadiness },
    { meter: 'allianceTrust' as const, score: 100 - state.meters.allianceTrust },
    { meter: 'escalationIndex' as const, score: state.meters.escalationIndex }
  ].sort((left, right) => right.score - left.score);

  const top = stress[0];
  if (!top) {
    return 'Pressure remains distributed without a single dominant vector.';
  }

  return `Primary pressure vector: ${pressureLabelByMeter[top.meter]} (index ${Math.round(top.score)}).`;
};

const adversaryPosture = (state: GameState, adversaryProfile: AdversaryProfile): string => {
  if (state.beliefs.humiliation > 0.6) {
    return `${adversaryProfile.name} leadership posture is publicly defensive and prone to reputational overreaction.`;
  }
  if (state.beliefs.thresholdHighProb < 0.35) {
    return `${adversaryProfile.name} leadership appears to assess your escalation ceiling as limited.`;
  }
  if (state.beliefs.bluffProb > 0.6) {
    return `${adversaryProfile.name} command circle increasingly treats your signaling as coercive bluffing.`;
  }
  return `${adversaryProfile.name} posture remains watchful with mixed confidence in your threshold discipline.`;
};

export const buildCompressedStateSummary = (payload: {
  state: GameState;
  role: string;
  adversaryProfile: AdversaryProfile;
  narrativeTokens: string[];
}): CompressedStateSummary => {
  const latest = payload.state.history[payload.state.history.length - 1];
  const lastActionPair = latest
    ? `Player used ${latest.playerActionId}; rival answered with ${latest.rivalActionId}.`
    : 'No prior action pair available.';

  return {
    roleLine: `You are the ${payload.role} directing a high-risk crisis response.`,
    turnCounter: `Turn ${payload.state.turn} of ${payload.state.maxTurns}.`,
    meterSnapshot: {
      economicStability: Math.round(payload.state.meters.economicStability),
      energySecurity: Math.round(payload.state.meters.energySecurity),
      domesticCohesion: Math.round(payload.state.meters.domesticCohesion),
      militaryReadiness: Math.round(payload.state.meters.militaryReadiness),
      allianceTrust: Math.round(payload.state.meters.allianceTrust),
      escalationIndex: Math.round(payload.state.meters.escalationIndex)
    },
    dominantPressure: dominantPressure(payload.state),
    lastActionPair,
    activeBeatId: payload.state.currentBeatId,
    narrativeTokens: payload.narrativeTokens.slice(0, 8),
    adversaryPosture: adversaryPosture(payload.state, payload.adversaryProfile)
  };
};

export const serializeCompressedStateSummary = (summary: CompressedStateSummary): string => {
  return [
    summary.roleLine,
    summary.turnCounter,
    `Meters: econ=${summary.meterSnapshot.economicStability}, energy=${summary.meterSnapshot.energySecurity}, cohesion=${summary.meterSnapshot.domesticCohesion}, readiness=${summary.meterSnapshot.militaryReadiness}, trust=${summary.meterSnapshot.allianceTrust}, escalation=${summary.meterSnapshot.escalationIndex}.`,
    summary.dominantPressure,
    `Last action pair: ${summary.lastActionPair}`,
    `Active beat: ${summary.activeBeatId}.`,
    `Narrative tokens: ${summary.narrativeTokens.join(', ') || 'none'}.`,
    summary.adversaryPosture
  ].join(' ');
};

// Coarse deterministic estimate suitable for regression gating.
export const estimateTokenCount = (text: string): number => {
  if (!text.trim()) {
    return 0;
  }
  return Math.ceil(text.length / 4);
};
