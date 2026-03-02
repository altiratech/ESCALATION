import { describe, expect, it } from 'vitest';

import { actions, scenarios } from '@wargames/content';
import { buildTurnDebrief } from '@wargames/engine';

const scenario = scenarios[0];

describe('turn debrief token attribution', () => {
  it('does not use player-side tokens in the rival secondary-effect line', () => {
    const playerAction = actions.find((action) => action.actor === 'player');
    const rivalAction = actions.find((action) => action.actor === 'rival');

    if (!scenario || !playerAction || !rivalAction) {
      throw new Error('Expected scenario/player/rival content for debrief test');
    }

    const debrief = buildTurnDebrief({
      playerAction,
      rivalAction,
      meterBefore: scenario.initialMeters,
      meterAfter: {
        ...scenario.initialMeters,
        escalationIndex: scenario.initialMeters.escalationIndex + 2
      },
      rivalNarrativeTokens: [],
      narrativeTokens: ['player_only_side_effect_token'],
      triggeredEventIds: [],
      eventTable: scenario.eventTable
    });

    const secondary = debrief.lines.find((line) => line.tag === 'SecondaryEffect');
    expect(secondary?.text).toContain('reinforcing a contested signaling environment');
    expect(secondary?.text).not.toContain('player only side effect token');
  });

  it('uses rival-side tokens when present', () => {
    const playerAction = actions.find((action) => action.actor === 'player');
    const rivalAction = actions.find((action) => action.actor === 'rival');

    if (!scenario || !playerAction || !rivalAction) {
      throw new Error('Expected scenario/player/rival content for debrief test');
    }

    const debrief = buildTurnDebrief({
      playerAction,
      rivalAction,
      meterBefore: scenario.initialMeters,
      meterAfter: {
        ...scenario.initialMeters,
        escalationIndex: scenario.initialMeters.escalationIndex + 3
      },
      rivalNarrativeTokens: ['rival_specific_token'],
      narrativeTokens: ['player_only_side_effect_token'],
      triggeredEventIds: [],
      eventTable: scenario.eventTable
    });

    const secondary = debrief.lines.find((line) => line.tag === 'SecondaryEffect');
    expect(secondary?.text).toContain('rival specific token');
  });
});
