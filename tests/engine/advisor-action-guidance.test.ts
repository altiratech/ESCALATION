import { describe, expect, it } from 'vitest';

import { advisorDossiers, getAction, getScenario } from '@wargames/content';

import { getAdvisorActionReads } from '../../apps/web/src/lib/decisionSupport';

describe('advisor action guidance', () => {
  it('covers every active advisor on each non-terminal beat with a full action partition', () => {
    const scenario = getScenario('northern_strait_flashpoint');
    const expectedActionIds = new Set(scenario.availablePlayerActionIds);

    for (const beat of scenario.beats) {
      if (beat.terminalOutcome) {
        continue;
      }

      const activeAdvisorIds = Object.keys(beat.advisorLines);
      expect(activeAdvisorIds.length).toBeGreaterThan(0);
      expect(beat.advisorActionGuidance).toBeTruthy();

      for (const advisorId of activeAdvisorIds) {
        const guidance = beat.advisorActionGuidance?.[advisorId];
        expect(guidance, `${beat.id}:${advisorId}`).toBeTruthy();

        const partition = [...(guidance?.supports ?? []), ...(guidance?.cautions ?? []), ...(guidance?.opposes ?? [])];
        expect(new Set(partition).size, `${beat.id}:${advisorId}:duplicate`).toBe(partition.length);
        expect(new Set(partition), `${beat.id}:${advisorId}:coverage`).toEqual(expectedActionIds);
      }
    }
  });

  it('prefers authored beat guidance over heuristic scoring when guidance exists', () => {
    const scenario = getScenario('northern_strait_flashpoint');
    const beat = scenario.beats.find((entry) => entry.id === 'ns_opening_signal');
    const action = getAction('military_posture_increase');

    if (!beat) {
      throw new Error('Expected ns_opening_signal beat');
    }

    const dossiers = advisorDossiers.filter((dossier) => ['cross', 'chen'].includes(dossier.id));
    const reads = getAdvisorActionReads(action, dossiers, beat);

    expect(reads.find((entry) => entry.advisorId === 'cross')).toMatchObject({
      alignment: 'supports',
      rationale: 'Backs visible deterrence that prevents the inspection regime from becoming the new baseline.'
    });
    expect(reads.find((entry) => entry.advisorId === 'chen')).toMatchObject({
      alignment: 'opposes',
      rationale: 'Rejects moves that harden positions faster than they build allied leverage or a credible off-ramp.'
    });
  });
});
