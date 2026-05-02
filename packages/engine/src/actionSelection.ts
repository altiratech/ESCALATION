import type {
  ActionDefinition,
  GameState,
  MeterKey,
  MeterState,
  ScenarioDefinition
} from '@wargames/shared-types';

import { SeededRng } from './rng';

const ACTION_OFFER_COUNT = 6;

const stressSignalsByMeter: Record<MeterKey, { prefers: string[]; avoids: string[] }> = {
  economicStability: {
    prefers: ['resource_stockpiling', 'limited_concession', 'backchannel_diplomacy'],
    avoids: ['broad_sanctions', 'military_posture_increase']
  },
  energySecurity: {
    prefers: ['resource_stockpiling', 'cyber_intrusion'],
    avoids: ['broad_sanctions']
  },
  domesticCohesion: {
    prefers: ['public_signaling_speech', 'backchannel_diplomacy'],
    avoids: ['covert_sabotage']
  },
  militaryReadiness: {
    prefers: ['military_posture_increase', 'intelligence_surge'],
    avoids: ['military_posture_decrease']
  },
  allianceTrust: {
    prefers: ['backchannel_diplomacy', 'targeted_sanctions', 'limited_concession'],
    avoids: ['covert_sabotage']
  },
  escalationIndex: {
    prefers: ['military_posture_decrease', 'limited_concession', 'backchannel_diplomacy'],
    avoids: ['covert_sabotage', 'cyber_disruption']
  }
};

const orderedStressMeters = (meters: MeterState): MeterKey[] => {
  return Object.entries(meters)
    .sort((left, right) => left[1] - right[1])
    .map(([key]) => key as MeterKey);
};

export const selectPlayerActionOptions = (
  state: GameState,
  scenario: ScenarioDefinition,
  actionMap: Map<string, ActionDefinition>,
  rng: SeededRng
): string[] => {
  const candidates = scenario.availablePlayerActionIds
    .map((id) => actionMap.get(id))
    .filter((action): action is ActionDefinition => Boolean(action))
    .filter((action) => {
      if (action.minTurn !== undefined && state.turn < action.minTurn) {
        return false;
      }
      if (action.maxTurn !== undefined && state.turn > action.maxTurn) {
        return false;
      }
      return true;
    });

  if (candidates.length <= ACTION_OFFER_COUNT) {
    return candidates.map((action) => action.id);
  }

  const stressedMeters = orderedStressMeters(state.meters);
  const seen = new Set<string>();

  const pickBySignal = (prefer = true): void => {
    for (const meter of stressedMeters) {
      const signals = stressSignalsByMeter[meter];
      const list = prefer ? signals.prefers : signals.avoids;
      for (const actionId of list) {
        if (seen.size >= ACTION_OFFER_COUNT) {
          return;
        }
        if (seen.has(actionId)) {
          continue;
        }
        if (!scenario.availablePlayerActionIds.includes(actionId)) {
          continue;
        }
        seen.add(actionId);
      }
    }
  };

  pickBySignal(true);

  const randomScored = [...candidates].sort((left, right) => {
    const leftScore = (left.signal.resolveSignal - left.signal.escalatory + left.signal.deescalatory) + rng.nextCenteredNoise(0.35);
    const rightScore = (right.signal.resolveSignal - right.signal.escalatory + right.signal.deescalatory) + rng.nextCenteredNoise(0.35);
    return rightScore - leftScore;
  });

  for (const action of randomScored) {
    if (seen.size >= ACTION_OFFER_COUNT) {
      break;
    }
    seen.add(action.id);
  }

  if (!seen.has('military_posture_increase') && !seen.has('military_posture_decrease')) {
    const forced = state.meters.escalationIndex > 60 ? 'military_posture_decrease' : 'military_posture_increase';
    if (scenario.availablePlayerActionIds.includes(forced)) {
      seen.add(forced);
    }
  }

  const offered = [...seen].slice(0, ACTION_OFFER_COUNT);
  while (offered.length < ACTION_OFFER_COUNT) {
    const fallback = candidates[offered.length]?.id;
    if (!fallback) {
      break;
    }
    if (!offered.includes(fallback)) {
      offered.push(fallback);
    }
  }

  return offered;
};
