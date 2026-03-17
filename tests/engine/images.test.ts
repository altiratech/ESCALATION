import { describe, expect, it } from 'vitest';

import { chooseImageAsset, SeededRng } from '@wargames/engine';
import type {
  ActionDefinition,
  ActionVariantDefinition,
  BeatNode,
  ImageAsset,
  MeterState,
  ScenarioDefinition
} from '@wargames/shared-types';

const zeroShift: Partial<MeterState> = {
  economicStability: 0,
  energySecurity: 0,
  domesticCohesion: 0,
  militaryReadiness: 0,
  allianceTrust: 0,
  escalationIndex: 0
};

describe('image selection', () => {
  it('prefers the beat-authored image kind and tags before generic fallbacks', () => {
    const scenario = { environment: 'coastal' } as ScenarioDefinition;
    const beat = {
      id: 'synthetic_anomaly',
      phase: 'opening',
      imageHints: ['taiwan', 'anomaly'],
      visualCue: {
        preferredKinds: ['artifact', 'scenario_still', 'map'],
        tags: ['anomaly', 'surveillance'],
        branchStage: 'ambiguous'
      }
    } as BeatNode;
    const assets = [
      {
        id: 'generic_still',
        kind: 'scenario_still',
        path: '/generic-still.svg',
        alt: 'Generic still',
        caption: 'Generic still',
        environment: 'coastal',
        domain: 'military',
        severity: 1,
        tags: ['taiwan']
      },
      {
        id: 'anomaly_artifact',
        kind: 'artifact',
        path: '/anomaly.svg',
        alt: 'Anomaly artifact',
        caption: 'Anomaly artifact',
        environment: 'coastal',
        domain: 'military',
        severity: 1,
        tags: ['taiwan', 'anomaly', 'surveillance']
      },
      {
        id: 'orientation_map',
        kind: 'map',
        path: '/map.svg',
        alt: 'Orientation map',
        caption: 'Orientation map',
        environment: 'coastal',
        domain: 'military',
        severity: 1,
        tags: ['taiwan', 'map']
      }
    ] satisfies ImageAsset[];

    const selected = chooseImageAsset({
      assets,
      scenario,
      beat,
      meters: {
        economicStability: 68,
        energySecurity: 61,
        domesticCohesion: 64,
        militaryReadiness: 57,
        allianceTrust: 63,
        escalationIndex: 38
      },
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-OPENING')
    });

    expect(selected?.id).toBe('anomaly_artifact');
  });

  it('can switch visuals based on the player action posture', () => {
    const scenario = { environment: 'maritime' } as ScenarioDefinition;
    const beat = {
      id: 'synthetic_incident',
      phase: 'crisis',
      imageHints: ['taiwan', 'incident'],
      visualCue: {
        preferredKinds: ['scenario_still'],
        tags: ['incident'],
        branchStage: 'incident'
      }
    } as BeatNode;
    const assets = [
      {
        id: 'quiet_scene',
        kind: 'scenario_still',
        path: '/quiet.svg',
        alt: 'Quiet move',
        caption: 'Quiet move',
        environment: 'maritime',
        domain: 'diplomacy',
        severity: 2,
        tags: ['taiwan', 'incident', 'covert']
      },
      {
        id: 'forceful_scene',
        kind: 'scenario_still',
        path: '/forceful.svg',
        alt: 'Forceful move',
        caption: 'Forceful move',
        environment: 'maritime',
        domain: 'military',
        severity: 2,
        tags: ['taiwan', 'incident', 'visible_deterrence']
      }
    ] satisfies ImageAsset[];
    const meters: MeterState = {
      economicStability: 58,
      energySecurity: 61,
      domesticCohesion: 59,
      militaryReadiness: 63,
      allianceTrust: 56,
      escalationIndex: 68
    };
    const quietAction = {
      id: 'backchannel',
      visualTags: ['covert']
    } as ActionDefinition;
    const forcefulAction = {
      id: 'posture',
      visualTags: ['visible_deterrence']
    } as ActionDefinition;

    const quietSelection = chooseImageAsset({
      assets,
      scenario,
      beat,
      meters,
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-QUIET'),
      playerAction: quietAction
    });

    const forcefulSelection = chooseImageAsset({
      assets,
      scenario,
      beat,
      meters,
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-FORCEFUL'),
      playerAction: forcefulAction
    });

    expect(quietSelection?.id).toBe('quiet_scene');
    expect(forcefulSelection?.id).toBe('forceful_scene');
  });

  it('lets the action variant break ties when the beat is otherwise the same', () => {
    const scenario = { environment: 'coastal' } as ScenarioDefinition;
    const beat = {
      id: 'synthetic_tail_risk',
      phase: 'climax',
      imageHints: ['taiwan', 'tail_risk'],
      visualCue: {
        preferredKinds: ['documentary_still', 'scenario_still'],
        tags: ['shipping', 'tail_risk'],
        branchStage: 'tail_risk'
      }
    } as BeatNode;
    const assets = [
      {
        id: 'market_scene',
        kind: 'documentary_still',
        path: '/market.jpg',
        alt: 'Market panic',
        caption: 'Market panic',
        environment: 'coastal',
        domain: 'economy',
        severity: 3,
        perspective: 'news_frame',
        tags: ['taiwan', 'shipping', 'tail_risk', 'market_panic', 'systemic']
      },
      {
        id: 'naval_scene',
        kind: 'documentary_still',
        path: '/naval.jpg',
        alt: 'Naval posture',
        caption: 'Naval posture',
        environment: 'coastal',
        domain: 'military',
        severity: 3,
        perspective: 'news_frame',
        tags: ['taiwan', 'shipping', 'tail_risk', 'deterrence', 'visible']
      }
    ] satisfies ImageAsset[];
    const action = {
      id: 'shared_action',
      visualTags: ['shipping']
    } as ActionDefinition;
    const punitiveVariant = {
      id: 'maximal',
      visualTags: ['market_panic', 'systemic']
    } as ActionVariantDefinition;
    const forceVariant = {
      id: 'surge',
      visualTags: ['deterrence', 'visible']
    } as ActionVariantDefinition;
    const meters: MeterState = {
      economicStability: 47,
      energySecurity: 51,
      domesticCohesion: 49,
      militaryReadiness: 55,
      allianceTrust: 50,
      escalationIndex: 72
    };

    const punitiveSelection = chooseImageAsset({
      assets,
      scenario,
      beat,
      meters,
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-PUNITIVE'),
      playerAction: action,
      playerVariant: punitiveVariant
    });

    const forceSelection = chooseImageAsset({
      assets,
      scenario,
      beat,
      meters,
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-FORCE'),
      playerAction: action,
      playerVariant: forceVariant
    });

    expect(punitiveSelection?.id).toBe('market_scene');
    expect(forceSelection?.id).toBe('naval_scene');
  });
});
