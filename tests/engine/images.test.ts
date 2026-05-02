import { describe, expect, it } from 'vitest';

import { chooseImageAsset, chooseImageGallery, SeededRng } from '@wargames/engine';
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

  it('prefers a diversified photoreal gallery over generic fallback stills', () => {
    const scenario = { environment: 'coastal' } as ScenarioDefinition;
    const beat = {
      id: 'synthetic_gallery',
      phase: 'climax',
      imageHints: ['taiwan', 'shipping', 'tail_risk'],
      visualCue: {
        preferredKinds: ['scenario_still', 'documentary_still', 'artifact', 'map'],
        tags: ['shipping', 'tail_risk'],
        branchStage: 'tail_risk'
      }
    } as BeatNode;
    const assets = [
      {
        id: 'img_001',
        kind: 'documentary_still',
        path: '/assets/images/img_001.svg',
        alt: 'Generic fallback still',
        caption: 'Generic fallback still',
        environment: 'coastal',
        domain: 'economy',
        severity: 3,
        perspective: 'news_frame',
        tags: ['taiwan', 'shipping', 'tail_risk']
      },
      {
        id: 'photo_shipping',
        kind: 'documentary_still',
        path: '/assets/images/shipping_queue.jpg',
        alt: 'Shipping queue',
        caption: 'Shipping queue',
        environment: 'coastal',
        domain: 'economy',
        severity: 3,
        perspective: 'news_frame',
        tags: ['taiwan', 'shipping', 'tail_risk', 'queue']
      },
      {
        id: 'photo_destroyer',
        kind: 'scenario_still',
        path: '/assets/images/destroyer.jpg',
        alt: 'Destroyer at sea',
        caption: 'Destroyer at sea',
        environment: 'coastal',
        domain: 'military',
        severity: 3,
        perspective: 'shipboard',
        tags: ['taiwan', 'shipping', 'tail_risk', 'visible_deterrence']
      },
      {
        id: 'artifact_order',
        kind: 'artifact',
        path: '/assets/images/order_sheet.png',
        alt: 'Order sheet',
        caption: 'Order sheet',
        environment: 'coastal',
        domain: 'diplomacy',
        severity: 2,
        perspective: 'briefing_slide',
        tags: ['taiwan', 'shipping', 'tail_risk', 'orders']
      }
    ] satisfies ImageAsset[];

    const gallery = chooseImageGallery({
      assets,
      scenario,
      beat,
      meters: {
        economicStability: 39,
        energySecurity: 46,
        domesticCohesion: 42,
        militaryReadiness: 61,
        allianceTrust: 48,
        escalationIndex: 76
      },
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-GALLERY')
    });

    expect(gallery).toHaveLength(3);
    expect(gallery[0]?.id).not.toBe('img_001');
    expect(gallery.map((asset) => asset.id)).toContain('photo_destroyer');
    expect(gallery.map((asset) => asset.id)).toContain('photo_shipping');
    expect(gallery.map((asset) => asset.id)).not.toContain('img_001');
  });

  it('honors beat-authored hero and evidence image ids when present', () => {
    const scenario = { environment: 'coastal' } as ScenarioDefinition;
    const beat = {
      id: 'curated_window',
      phase: 'opening',
      imageHints: ['taiwan', 'anomaly'],
      visualCue: {
        preferredKinds: ['documentary_still', 'artifact', 'map'],
        tags: ['taiwan', 'anomaly', 'surveillance'],
        branchStage: 'ambiguous',
        heroImageIds: ['hero_watch'],
        evidenceImageIds: ['evidence_satellite', 'evidence_artifact']
      }
    } as BeatNode;
    const assets = [
      {
        id: 'hero_watch',
        kind: 'documentary_still',
        path: '/assets/images/watch.jpg',
        alt: 'Watch floor',
        caption: 'Watch floor',
        environment: 'coastal',
        domain: 'military',
        severity: 1,
        perspective: 'news_frame',
        tags: ['taiwan', 'anomaly', 'surveillance']
      },
      {
        id: 'evidence_satellite',
        kind: 'map',
        path: '/assets/images/overhead.jpg',
        alt: 'Satellite read',
        caption: 'Satellite read',
        environment: 'coastal',
        domain: 'military',
        severity: 1,
        perspective: 'satellite',
        tags: ['taiwan', 'anomaly', 'map']
      },
      {
        id: 'evidence_artifact',
        kind: 'artifact',
        path: '/assets/images/log.png',
        alt: 'Bridge log',
        caption: 'Bridge log',
        environment: 'coastal',
        domain: 'military',
        severity: 1,
        perspective: 'memo',
        tags: ['taiwan', 'anomaly', 'surveillance']
      },
      {
        id: 'generic_top_score',
        kind: 'documentary_still',
        path: '/assets/images/generic.jpg',
        alt: 'Generic scene',
        caption: 'Generic scene',
        environment: 'coastal',
        domain: 'military',
        severity: 1,
        perspective: 'street',
        tags: ['taiwan', 'anomaly', 'surveillance', 'public']
      }
    ] satisfies ImageAsset[];

    const gallery = chooseImageGallery({
      assets,
      scenario,
      beat,
      meters: {
        economicStability: 70,
        energySecurity: 68,
        domesticCohesion: 67,
        militaryReadiness: 58,
        allianceTrust: 62,
        escalationIndex: 39
      },
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-CURATED')
    });

    expect(gallery[0]?.id).toBe('hero_watch');
    expect(gallery.map((asset) => asset.id).slice(1)).toEqual(
      expect.arrayContaining(['evidence_satellite', 'evidence_artifact'])
    );
  });

  it('lets selected action context lead a curated beat gallery while preserving curated evidence', () => {
    const scenario = { environment: 'coastal' } as ScenarioDefinition;
    const beat = {
      id: 'curated_decision_context',
      phase: 'rising',
      imageHints: ['taiwan', 'shipping'],
      visualCue: {
        preferredKinds: ['documentary_still', 'artifact', 'map'],
        tags: ['shipping', 'coercion'],
        branchStage: 'coercion',
        heroImageIds: ['curated_watchfloor'],
        evidenceImageIds: ['curated_map']
      }
    } as BeatNode;
    const assets = [
      {
        id: 'curated_watchfloor',
        kind: 'documentary_still',
        path: '/assets/images/watch.jpg',
        alt: 'Watch floor',
        caption: 'Watch floor',
        environment: 'coastal',
        domain: 'military',
        severity: 2,
        perspective: 'news_frame',
        tags: ['taiwan', 'shipping', 'coercion', 'watchfloor']
      },
      {
        id: 'curated_map',
        kind: 'map',
        path: '/assets/images/map.png',
        alt: 'Map',
        caption: 'Map',
        environment: 'coastal',
        domain: 'military',
        severity: 2,
        perspective: 'satellite',
        tags: ['taiwan', 'shipping', 'coercion', 'map']
      },
      {
        id: 'variant_market_room',
        kind: 'documentary_still',
        path: '/assets/images/market-room.jpg',
        alt: 'Market desk',
        caption: 'Market desk',
        environment: 'coastal',
        domain: 'economy',
        severity: 3,
        perspective: 'street',
        tags: ['taiwan', 'shipping', 'coercion', 'market_panic', 'economic_pressure']
      }
    ] satisfies ImageAsset[];
    const action = {
      id: 'sanctions',
      visualTags: ['economic_pressure']
    } as ActionDefinition;
    const variant = {
      id: 'punitive',
      visualTags: ['market_panic']
    } as ActionVariantDefinition;

    const gallery = chooseImageGallery({
      assets,
      scenario,
      beat,
      meters: {
        economicStability: 46,
        energySecurity: 52,
        domesticCohesion: 49,
        militaryReadiness: 60,
        allianceTrust: 51,
        escalationIndex: 62
      },
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-DECISION-CONTEXT'),
      playerAction: action,
      playerVariant: variant
    });

    expect(gallery[0]?.id).toBe('variant_market_room');
    expect(gallery.map((asset) => asset.id)).toEqual(
      expect.arrayContaining(['curated_watchfloor', 'curated_map'])
    );
  });

  it('treats authored hero order as authoritative even when a later hero scores better', () => {
    const scenario = { environment: 'coastal' } as ScenarioDefinition;
    const beat = {
      id: 'curated_hero_order',
      phase: 'opening',
      imageHints: ['taiwan', 'anomaly'],
      visualCue: {
        preferredKinds: ['documentary_still', 'artifact', 'map'],
        tags: ['taiwan', 'anomaly', 'surveillance'],
        branchStage: 'ambiguous',
        heroImageIds: ['first_hero', 'second_hero']
      }
    } as BeatNode;
    const assets = [
      {
        id: 'first_hero',
        kind: 'documentary_still',
        path: '/assets/images/first.jpg',
        alt: 'First hero',
        caption: 'First hero',
        environment: 'coastal',
        domain: 'military',
        severity: 1,
        perspective: 'news_frame',
        tags: ['taiwan', 'anomaly']
      },
      {
        id: 'second_hero',
        kind: 'documentary_still',
        path: '/assets/images/second.jpg',
        alt: 'Second hero',
        caption: 'Second hero',
        environment: 'coastal',
        domain: 'military',
        severity: 1,
        perspective: 'news_frame',
        tags: ['taiwan', 'anomaly', 'surveillance', 'covert', 'warning_time']
      }
    ] satisfies ImageAsset[];

    const selected = chooseImageAsset({
      assets,
      scenario,
      beat,
      meters: {
        economicStability: 71,
        energySecurity: 69,
        domesticCohesion: 68,
        militaryReadiness: 57,
        allianceTrust: 63,
        escalationIndex: 40
      },
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-CURATED-ORDER')
    });

    expect(selected?.id).toBe('first_hero');
  });

  it('does not auto-fill curated galleries with weak fallback images', () => {
    const scenario = { environment: 'coastal' } as ScenarioDefinition;
    const beat = {
      id: 'curated_terminal_window',
      phase: 'climax',
      imageHints: ['taiwan', 'shipping'],
      visualCue: {
        preferredKinds: ['documentary_still', 'artifact', 'map'],
        tags: ['shipping', 'tail_risk'],
        branchStage: 'tail_risk',
        heroImageIds: ['hero_photo'],
        evidenceImageIds: ['evidence_satellite']
      }
    } as BeatNode;
    const assets = [
      {
        id: 'hero_photo',
        kind: 'documentary_still',
        path: '/assets/images/hero.jpg',
        alt: 'Hero photo',
        caption: 'Hero photo',
        environment: 'coastal',
        domain: 'military',
        severity: 3,
        perspective: 'news_frame',
        tags: ['taiwan', 'shipping', 'tail_risk']
      },
      {
        id: 'evidence_satellite',
        kind: 'map',
        path: '/assets/images/sat.jpg',
        alt: 'Evidence satellite',
        caption: 'Evidence satellite',
        environment: 'coastal',
        domain: 'diplomacy',
        severity: 2,
        perspective: 'satellite',
        tags: ['taiwan', 'shipping', 'tail_risk']
      },
      {
        id: 'weak_fallback',
        kind: 'scenario_still',
        path: '/assets/images/weak.svg',
        alt: 'Weak fallback',
        caption: 'Weak fallback',
        environment: 'generic',
        domain: 'diplomacy',
        severity: 0,
        perspective: 'street',
        tags: ['generic']
      }
    ] satisfies ImageAsset[];

    const gallery = chooseImageGallery({
      assets,
      scenario,
      beat,
      meters: {
        economicStability: 43,
        energySecurity: 49,
        domesticCohesion: 47,
        militaryReadiness: 60,
        allianceTrust: 50,
        escalationIndex: 74
      },
      turnDelta: zeroShift,
      recentImageIds: [],
      rng: new SeededRng('IMG-CURATED-NOFILL')
    });

    expect(gallery.map((asset) => asset.id)).toEqual(['hero_photo', 'evidence_satellite']);
  });

  it('still uses authored curated assets even if they appeared recently', () => {
    const scenario = { environment: 'coastal' } as ScenarioDefinition;
    const beat = {
      id: 'curated_recent_assets',
      phase: 'climax',
      imageHints: ['taiwan', 'shipping'],
      visualCue: {
        preferredKinds: ['documentary_still', 'artifact', 'map'],
        tags: ['shipping', 'tail_risk'],
        branchStage: 'tail_risk',
        heroImageIds: ['hero_recent'],
        evidenceImageIds: ['evidence_recent']
      }
    } as BeatNode;
    const assets = [
      {
        id: 'hero_recent',
        kind: 'documentary_still',
        path: '/assets/images/hero.jpg',
        alt: 'Hero recent',
        caption: 'Hero recent',
        environment: 'coastal',
        domain: 'economy',
        severity: 3,
        perspective: 'news_frame',
        tags: ['taiwan', 'shipping', 'tail_risk']
      },
      {
        id: 'evidence_recent',
        kind: 'artifact',
        path: '/assets/images/evidence.png',
        alt: 'Evidence recent',
        caption: 'Evidence recent',
        environment: 'coastal',
        domain: 'military',
        severity: 3,
        perspective: 'surveillance',
        tags: ['taiwan', 'shipping', 'tail_risk']
      },
      {
        id: 'fallback_slide',
        kind: 'scenario_still',
        path: '/assets/images/fallback.svg',
        alt: 'Fallback slide',
        caption: 'Fallback slide',
        environment: 'coastal',
        domain: 'economy',
        severity: 4,
        perspective: 'news_frame',
        tags: ['taiwan', 'shipping', 'tail_risk', 'queue', 'collapse']
      }
    ] satisfies ImageAsset[];

    const gallery = chooseImageGallery({
      assets,
      scenario,
      beat,
      meters: {
        economicStability: 38,
        energySecurity: 44,
        domesticCohesion: 45,
        militaryReadiness: 58,
        allianceTrust: 49,
        escalationIndex: 79
      },
      turnDelta: zeroShift,
      recentImageIds: ['hero_recent', 'evidence_recent'],
      rng: new SeededRng('IMG-CURATED-RECENT')
    });

    expect(gallery.map((asset) => asset.id)).toEqual(['hero_recent', 'evidence_recent']);
  });
});
