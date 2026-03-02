import type { GameState, OutcomeCategory } from '@wargames/shared-types';

const isEconomicCollapse = (state: GameState): boolean => {
  const tail = state.history.slice(-2);
  if (tail.length < 2) {
    return false;
  }
  return tail.every((entry) => entry.meterAfter.economicStability < 20);
};

const isRegimeInstability = (state: GameState): boolean => {
  return state.meters.domesticCohesion < 20 && state.latent.rivalDomesticPressure > 70;
};

const isWar = (state: GameState): boolean => {
  return (
    state.meters.escalationIndex > 85 &&
    state.meters.militaryReadiness > 60 &&
    state.meters.allianceTrust < 35
  );
};

const isStabilization = (state: GameState): boolean => {
  return (
    state.meters.escalationIndex < 40 &&
    state.meters.allianceTrust > 55 &&
    state.meters.economicStability > 55
  );
};

export const evaluateOutcome = (state: GameState): OutcomeCategory => {
  if (isWar(state)) {
    return 'war';
  }

  if (isEconomicCollapse(state)) {
    return 'economic_collapse';
  }

  if (isRegimeInstability(state)) {
    return 'regime_instability';
  }

  if (isStabilization(state)) {
    return 'stabilization';
  }

  return 'frozen_conflict';
};

export const isCatastrophicTermination = (state: GameState): boolean => {
  return isWar(state) || isEconomicCollapse(state) || isRegimeInstability(state);
};

export const describeOutcome = (outcome: OutcomeCategory): string => {
  if (outcome === 'war') {
    return 'Mutual signaling collapsed into open conflict after compounding escalation and alliance fragmentation.';
  }
  if (outcome === 'economic_collapse') {
    return 'Sustained pressure and cascading shocks pushed the economy into collapse before strategic objectives were secured.';
  }
  if (outcome === 'regime_instability') {
    return 'Domestic legitimacy fractured under pressure, forcing crisis decisions under internal instability.';
  }
  if (outcome === 'stabilization') {
    return 'Escalation pressure was contained while alliance coherence and macro stability were preserved.';
  }
  return 'Direct war was avoided, but neither side secured a durable settlement and confrontation remained entrenched.';
};
