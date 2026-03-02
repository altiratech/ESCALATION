import { describe, expect, it } from 'vitest';

import { actions, getDebriefVariants, scenarios } from '@wargames/content';
import { buildTurnDebrief } from '@wargames/engine';

const scenario = scenarios[0];
const debriefVariants = getDebriefVariants();

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
      turn: 3,
      phase: 'rising',
      rivalNarrativeTokens: [],
      narrativeTokens: ['player_only_side_effect_token'],
      triggeredEventIds: [],
      eventTable: scenario.eventTable,
      debriefVariants
    });

    const secondary = debrief.lines.find((line) => line.tag === 'SecondaryEffect');
    expect(secondary?.text).toContain('concrete follow-on effects remain below collection threshold');
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
      turn: 3,
      phase: 'rising',
      rivalNarrativeTokens: ['rival_specific_token'],
      narrativeTokens: ['player_only_side_effect_token'],
      triggeredEventIds: [],
      eventTable: scenario.eventTable,
      debriefVariants
    });

    const secondary = debrief.lines.find((line) => line.tag === 'SecondaryEffect');
    expect(secondary?.text).toContain('rival specific token');
  });

  it('selects high-escalation player variants when thresholds are met', () => {
    const playerAction = actions.find((action) => action.actor === 'player');
    const rivalAction = actions.find((action) => action.id === 'rival_military_drill');

    if (!scenario || !playerAction || !rivalAction) {
      throw new Error('Expected scenario/player/rival content for debrief test');
    }

    const debrief = buildTurnDebrief({
      playerAction,
      rivalAction,
      meterBefore: scenario.initialMeters,
      meterAfter: {
        ...scenario.initialMeters,
        escalationIndex: scenario.initialMeters.escalationIndex + 9
      },
      turn: 8,
      phase: 'crisis',
      rivalNarrativeTokens: ['rival_specific_token'],
      narrativeTokens: [],
      triggeredEventIds: [],
      eventTable: scenario.eventTable,
      debriefVariants
    });

    const playerLine = debrief.lines.find((line) => line.tag === 'PlayerAction');
    expect(playerLine?.text.toLowerCase()).toContain('confrontation envelope');
  });
});
