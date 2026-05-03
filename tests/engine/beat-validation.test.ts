import { describe, expect, it } from 'vitest';

import { scenarios } from '@wargames/content';
import { analyzeBeatGraph } from '@wargames/engine';

describe('beat graph validation', () => {
  it('passes structural integrity checks for authored scenario', () => {
    const scenario = scenarios[0];
    if (!scenario) {
      throw new Error('Scenario unavailable');
    }

    const analysis = analyzeBeatGraph(scenario);
    const errors = analysis.issues.filter((issue) => issue.level === 'error');

    expect(errors).toHaveLength(0);
    expect(analysis.unreachableBeatIds).toHaveLength(0);
    expect(analysis.beatsWithoutTerminalPath).toHaveLength(0);
    expect(analysis.terminalBeatIds.length).toBeGreaterThan(0);
  });

  it('warns when a default fallback branch can shadow later branches', () => {
    const scenario = scenarios[0];
    if (!scenario) {
      throw new Error('Scenario unavailable');
    }

    const analysis = analyzeBeatGraph({
      ...scenario,
      startingBeatId: 'start',
      beats: [
        {
          id: 'start',
          phase: 'opening',
          sceneFragments: [],
          advisorLines: {},
          advisorActionGuidance: {},
          truthModel: null,
          windowContext: null,
          headlines: [],
          memoLine: null,
          tickerLine: null,
          imageHints: [],
          branches: [
            {
              targetBeatId: 'fallback_terminal',
              conditions: [],
              minTurn: null,
              maxTurn: null,
              requiresActionTag: null,
              priority: 2
            },
            {
              targetBeatId: 'gated_terminal',
              conditions: [],
              minTurn: null,
              maxTurn: null,
              requiresActionTag: 'military',
              priority: 1
            }
          ],
          terminalOutcome: null,
          meterOverrides: null,
          advisorUnlock: null,
          musicCue: null,
          decisionWindow: null,
          visualCue: null
        },
        {
          id: 'fallback_terminal',
          phase: 'resolution',
          sceneFragments: [],
          advisorLines: {},
          advisorActionGuidance: {},
          truthModel: null,
          windowContext: null,
          headlines: [],
          memoLine: null,
          tickerLine: null,
          imageHints: [],
          branches: [],
          terminalOutcome: 'frozen_conflict',
          meterOverrides: null,
          advisorUnlock: null,
          musicCue: null,
          decisionWindow: null,
          visualCue: null
        },
        {
          id: 'gated_terminal',
          phase: 'resolution',
          sceneFragments: [],
          advisorLines: {},
          advisorActionGuidance: {},
          truthModel: null,
          windowContext: null,
          headlines: [],
          memoLine: null,
          tickerLine: null,
          imageHints: [],
          branches: [],
          terminalOutcome: 'war',
          meterOverrides: null,
          advisorUnlock: null,
          musicCue: null,
          decisionWindow: null,
          visualCue: null
        }
      ]
    });

    expect(analysis.issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        beatId: 'start',
        message: 'Default fallback branch is evaluated before later branches and may shadow them.'
      })
    );
  });
});
