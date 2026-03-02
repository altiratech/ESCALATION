import { describe, expect, it } from 'vitest';

import {
  actions,
  archetypes,
  getAdvisorRetrospectivesForOutcome,
  getCausalityRevealForOutcome,
  images,
  scenarios
} from '@wargames/content';
import {
  buildActionMap,
  buildPostGameReport,
  evaluateOutcome,
  initializeGameState,
  resolveTurn
} from '@wargames/engine';

const scenario = scenarios[0];
const archetype = archetypes[0];

describe('post-game causality report', () => {
  it('builds full causality sections with narrative pack overlays', () => {
    if (!scenario || !archetype) {
      throw new Error('Scenario/archetype unavailable');
    }

    let state = initializeGameState('report-causality', 'REPORT-CAUSALITY', {
      scenario,
      archetype,
      actions,
      images
    }, {
      nowMs: 10_000
    });

    for (let safety = 0; safety < 12 && state.status === 'active'; safety += 1) {
      const selected = state.offeredActionIds[0];
      if (!selected) {
        break;
      }

      const { nextState } = resolveTurn(state, selected, {
        scenario,
        archetype,
        actions,
        images
      }, 10_000 + (safety * 1_000));
      state = nextState;
    }

    const outcome = state.outcome ?? evaluateOutcome(state);
    const report = buildPostGameReport(state, buildActionMap(actions), {
      scenario,
      archetype,
      causalityNarrative: getCausalityRevealForOutcome(outcome),
      advisorRetrospectives: getAdvisorRetrospectivesForOutcome(outcome)
    });

    expect(report.fullCausality.hiddenDeltas).toHaveLength(6);
    expect(report.fullCausality.outcomeNarrative.title.length).toBeGreaterThan(0);
    expect(report.fullCausality.outcomeNarrative.summary.length).toBeGreaterThan(0);
    expect(report.fullCausality.outcomeNarrative.causalNote.length).toBeGreaterThan(0);
    expect(report.fullCausality.adversaryLogicSummary.length).toBeGreaterThan(20);
    expect(report.fullCausality.advisorRetrospectives.length).toBeGreaterThan(0);
    expect(Array.isArray(report.fullCausality.unseenSystemEvents)).toBe(true);
    expect(Array.isArray(report.fullCausality.branchesNotTaken)).toBe(true);
  });
});
