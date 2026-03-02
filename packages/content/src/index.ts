import actionsData from '../data/actions.json';
import archetypesData from '../data/archetypes.json';
import scenariosData from '../data/scenarios.json';
import imagesData from '../data/images.json';
import narrativeCandidatesData from '../data/narrative_candidates_v1.json';

import type {
  ActionDefinition,
  ImageAsset,
  NarrativeCandidatesCategory,
  NarrativeCandidatesPack,
  OutcomeCategory,
  PressureTextCandidate,
  RivalArchetype,
  ScenarioDefinition
} from '@wargames/shared-types';

export const actions = actionsData as ActionDefinition[];
export const archetypes = archetypesData as RivalArchetype[];
export const scenarios = scenariosData as ScenarioDefinition[];
export const images = imagesData as ImageAsset[];
export const narrativeCandidates = narrativeCandidatesData as NarrativeCandidatesPack;

export const playerActions = actions.filter((action) => action.actor === 'player');
export const rivalActions = actions.filter((action) => action.actor === 'rival');

export const getScenario = (scenarioId: string): ScenarioDefinition => {
  const scenario = scenarios.find((entry) => entry.id === scenarioId);
  if (!scenario) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }
  return scenario;
};

export const getArchetype = (archetypeId: string): RivalArchetype => {
  const archetype = archetypes.find((entry) => entry.id === archetypeId);
  if (!archetype) {
    throw new Error(`Archetype not found: ${archetypeId}`);
  }
  return archetype;
};

export const getAction = (actionId: string): ActionDefinition => {
  const action = actions.find((entry) => entry.id === actionId);
  if (!action) {
    throw new Error(`Action not found: ${actionId}`);
  }
  return action;
};

const getNarrativeCategory = <T extends NarrativeCandidatesCategory['category']>(
  category: T
): Extract<NarrativeCandidatesCategory, { category: T }> | null => {
  const match = narrativeCandidates.categories.find((entry) => entry.category === category);
  if (!match) {
    return null;
  }
  return match as Extract<NarrativeCandidatesCategory, { category: T }>;
};

const pickThresholdText = (entries: PressureTextCandidate[], secondsRemaining: number): string | null => {
  const sorted = [...entries].sort((left, right) => left.thresholdSeconds - right.thresholdSeconds);
  const selected = sorted.find((entry) => secondsRemaining <= entry.thresholdSeconds);
  return selected?.text ?? null;
};

export const getPressureText = (beatId: string, secondsRemaining: number): string | null => {
  const category = getNarrativeCategory('pressure_text');
  if (!category) {
    return null;
  }

  const beatEntries = category.entries.filter((entry) => entry.beatId === beatId);
  const genericEntries = category.entries.filter((entry) => entry.beatId === '_generic');
  return pickThresholdText(beatEntries, secondsRemaining) ?? pickThresholdText(genericEntries, secondsRemaining);
};

export const getCausalityRevealForOutcome = (outcome: OutcomeCategory): {
  title: string | null;
  summary: string | null;
  causalNote: string | null;
} => {
  const category = getNarrativeCategory('causality_reveal');
  if (!category) {
    return {
      title: null,
      summary: null,
      causalNote: null
    };
  }

  const entries = category.entries.filter((entry) => entry.outcome === outcome);
  const title = entries.find((entry) => entry.field === 'title');
  const summary = entries.find((entry) => entry.field === 'summary');
  const causalNote = entries.find((entry) => entry.field === 'causal_note');

  return {
    title: title?.text ?? title?.template ?? null,
    summary: summary?.text ?? summary?.template ?? null,
    causalNote: causalNote?.text ?? causalNote?.template ?? null
  };
};

export const getAdvisorRetrospectivesForOutcome = (outcome: OutcomeCategory): Array<{ advisor: string; text: string }> => {
  const category = getNarrativeCategory('advisor_retrospective');
  if (!category) {
    return [];
  }

  return category.entries
    .filter((entry) => entry.outcome === outcome)
    .map((entry) => ({
      advisor: entry.advisor,
      text: entry.text
    }));
};
