import { describe, expect, it } from 'vitest';

import {
  actions,
  getDebriefDeep,
  getAdvisorRetrospectivesForOutcome,
  getCausalityRevealForOutcome,
  getRivalLeader,
  getScenarioAdversaryProfile,
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
const adversaryProfile = scenario ? getScenarioAdversaryProfile(scenario.id) : null;
const blackSwanScenario = scenarios.find((entry) => entry.id === 'northern_strait_black_swan');
const blackSwanAdversaryProfile = blackSwanScenario ? getScenarioAdversaryProfile(blackSwanScenario.id) : null;

describe('post-game causality report', () => {
  it('builds full causality sections with narrative pack overlays', () => {
    if (!scenario || !adversaryProfile) {
      throw new Error('Scenario/adversaryProfile unavailable');
    }

    let state = initializeGameState('report-causality', 'REPORT-CAUSALITY', {
      scenario,
      adversaryProfile,
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
        adversaryProfile,
        actions,
        images
      }, 10_000 + (safety * 1_000));
      state = nextState;
    }

    const outcome = state.outcome ?? evaluateOutcome(state);
    const rivalLeader = getRivalLeader(scenario.id, adversaryProfile.id);
    const deepDebrief = getDebriefDeep(scenario.id);
    const report = buildPostGameReport(state, buildActionMap(actions), {
      scenario,
      adversaryProfile,
      rivalLeader,
      deepDebrief,
      causalityNarrative: getCausalityRevealForOutcome(outcome),
      advisorRetrospectives: getAdvisorRetrospectivesForOutcome(outcome)
    });

    expect(report.finalMeters.escalationIndex).toBe(state.meters.escalationIndex);
    expect(report.terminalBeatId).toBe(state.currentBeatId);
    expect(report.pivotalDecision.actionName.length).toBeGreaterThan(0);
    expect(report.alternativeLine.suggestedActionName.length).toBeGreaterThan(0);
    expect(report.fullCausality.hiddenDeltas).toHaveLength(6);
    expect(report.fullCausality.outcomeNarrative.title.length).toBeGreaterThan(0);
    expect(report.fullCausality.outcomeNarrative.summary.length).toBeGreaterThan(0);
    expect(report.fullCausality.outcomeNarrative.causalNote.length).toBeGreaterThan(0);
    expect(report.fullCausality.adversaryLogicSummary.length).toBeGreaterThan(20);
    expect(report.fullCausality.rivalLeaderReveal?.publicName).toBe(rivalLeader?.leader.publicName);
    expect(report.fullCausality.rivalLeaderReveal?.pressurePoints.length).toBeGreaterThan(0);
    expect(report.fullCausality.deepDebrief?.grade.title.length).toBeGreaterThan(0);
    expect(report.fullCausality.deepDebrief?.historicalParallels.length).toBeGreaterThan(0);
    expect(report.fullCausality.deepDebrief?.lessonsLearned.length).toBeGreaterThan(0);
    expect(report.fullCausality.tradeoffScorecards).toHaveLength(5);
    expect(report.fullCausality.tradeoffScorecards[0]?.label.length).toBeGreaterThan(0);
    expect(report.fullCausality.tradeoffScorecards[0]?.tradeoff.length).toBeGreaterThan(0);
    expect(report.fullCausality.tradeoffScorecards[0]?.summary).toBe(
      deepDebrief?.tradeoffCommentary?.economic_containment?.[outcome]?.summary
    );
    expect(report.fullCausality.tradeoffScorecards[0]?.tradeoff).toBe(
      deepDebrief?.tradeoffCommentary?.economic_containment?.[outcome]?.tradeoff
    );
    expect(report.fullCausality.advisorRetrospectives.length).toBeGreaterThan(0);
    expect(Array.isArray(report.fullCausality.unseenSystemEvents)).toBe(true);
    expect(Array.isArray(report.fullCausality.branchesNotTaken)).toBe(true);
    expect(report.fullCausality.branchesNotTaken.length).toBeLessThanOrEqual(6);
  });

  it('prefers terminal-beat-specific deep debrief commentary when available', () => {
    if (!blackSwanScenario || !blackSwanAdversaryProfile) {
      throw new Error('Black swan scenario/adversaryProfile unavailable');
    }

    let state = initializeGameState('report-terminal', 'REPORT-TERMINAL', {
      scenario: blackSwanScenario,
      adversaryProfile: blackSwanAdversaryProfile,
      actions,
      images
    }, {
      nowMs: 20_000
    });

    for (let safety = 0; safety < 4 && state.status === 'active'; safety += 1) {
      const selected = state.offeredActionIds[0];
      if (!selected) {
        break;
      }

      const { nextState } = resolveTurn(state, selected, {
        scenario: blackSwanScenario,
        adversaryProfile: blackSwanAdversaryProfile,
        actions,
        images
      }, 20_000 + (safety * 1_000));
      state = nextState;
    }

    state.status = 'completed';
    state.currentBeatId = 'ns_blockade_lock';
    state.outcome = 'frozen_conflict';
    state.offeredActionIds = [];
    state.activeCountdown = null;

    const deepDebrief = getDebriefDeep(blackSwanScenario.id);
    const report = buildPostGameReport(state, buildActionMap(actions), {
      scenario: blackSwanScenario,
      adversaryProfile: blackSwanAdversaryProfile,
      rivalLeader: getRivalLeader(blackSwanScenario.id, blackSwanAdversaryProfile.id),
      deepDebrief
    });

    expect(report.terminalBeatId).toBe('ns_blockade_lock');
    expect(report.fullCausality.deepDebrief?.strategyArc?.headline).toBe(
      deepDebrief?.terminalBeatStrategyArcs?.ns_blockade_lock?.headline
    );
    expect(report.fullCausality.tradeoffScorecards.find((entry) => entry.id === 'economic_containment')?.summary).toBe(
      deepDebrief?.terminalBeatTradeoffCommentary?.ns_blockade_lock?.economic_containment?.summary
    );
    expect(report.fullCausality.tradeoffScorecards.find((entry) => entry.id === 'economic_containment')?.tradeoff).toBe(
      deepDebrief?.terminalBeatTradeoffCommentary?.ns_blockade_lock?.economic_containment?.tradeoff
    );
  });
});
