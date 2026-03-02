import actionsData from '../data/actions.json';
import archetypesData from '../data/archetypes.json';
import scenariosData from '../data/scenarios.json';
import imagesData from '../data/images.json';

import type {
  ActionDefinition,
  ImageAsset,
  RivalArchetype,
  ScenarioDefinition
} from '@wargames/shared-types';

export const actions = actionsData as ActionDefinition[];
export const archetypes = archetypesData as RivalArchetype[];
export const scenarios = scenariosData as ScenarioDefinition[];
export const images = imagesData as ImageAsset[];

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
