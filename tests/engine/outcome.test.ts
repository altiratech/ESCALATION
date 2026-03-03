import { describe, expect, it } from 'vitest';

import { actions, adversaryProfiles, images, scenarios } from '@wargames/content';
import { evaluateOutcome, initializeGameState } from '@wargames/engine';

const scenario = scenarios[0];
const adversaryProfile = adversaryProfiles[1];

describe('outcome evaluation', () => {
  it('detects war condition', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Test data unavailable');
    }

    const state = initializeGameState('outcome-war', 'SEED-WAR', {
      scenario,
      adversaryProfile,
      actions,
      images
    });

    state.meters.escalationIndex = 90;
    state.meters.militaryReadiness = 70;
    state.meters.allianceTrust = 30;

    expect(evaluateOutcome(state)).toBe('war');
  });

  it('detects economic collapse after consecutive low econ turns', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Test data unavailable');
    }

    const state = initializeGameState('outcome-econ', 'SEED-ECON', {
      scenario,
      adversaryProfile,
      actions,
      images
    });

    state.history = [
      {
        turn: 1,
        beatIdBefore: 'ns_opening_signal',
        beatIdAfter: 'ns_strait_pressure',
        offeredActionIds: ['targeted_sanctions'],
        playerActionId: 'targeted_sanctions',
        rivalActionId: 'rival_sanction_retaliation',
        meterBefore: { ...state.meters },
        meterAfter: { ...state.meters, economicStability: 18 },
        visibleRanges: Object.fromEntries(
          Object.entries(state.meters).map(([key, value]) => [key, { low: value - 2, high: value + 2, confidence: 80 }])
        ) as any,
        triggeredEvents: [],
        beliefSnapshot: state.beliefs,
        narrative: state.openingBriefing,
        turnDebrief: {
          lines: [
            { tag: 'PlayerAction', text: 'Player action line' },
            { tag: 'SecondaryEffect', text: 'Secondary effect line' }
          ]
        },
        selectedImageId: null,
        rngTrace: []
      },
      {
        turn: 2,
        beatIdBefore: 'ns_strait_pressure',
        beatIdAfter: 'ns_market_spiral',
        offeredActionIds: ['broad_sanctions'],
        playerActionId: 'broad_sanctions',
        rivalActionId: 'rival_energy_coercion',
        meterBefore: { ...state.meters },
        meterAfter: { ...state.meters, economicStability: 15 },
        visibleRanges: Object.fromEntries(
          Object.entries(state.meters).map(([key, value]) => [key, { low: value - 3, high: value + 3, confidence: 70 }])
        ) as any,
        triggeredEvents: [],
        beliefSnapshot: state.beliefs,
        narrative: state.openingBriefing,
        turnDebrief: {
          lines: [
            { tag: 'PlayerAction', text: 'Player action line' },
            { tag: 'SecondaryEffect', text: 'Secondary effect line' }
          ]
        },
        selectedImageId: null,
        rngTrace: []
      }
    ];

    state.meters.economicStability = 15;

    expect(evaluateOutcome(state)).toBe('economic_collapse');
  });
});
