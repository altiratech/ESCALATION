import actionsData from '../data/actions.json';
import archetypesData from '../data/archetypes.json';
import scenariosData from '../data/scenarios.json';
import imagesData from '../data/images.json';
import narrativeCandidatesData from '../data/narrative_candidates_v2.json';

import type {
  ActionDefinition,
  AdvisorLineCandidate,
  AdvisorRetrospectiveCandidate,
  CausalityRevealCandidate,
  DebriefTag,
  DebriefVariantCandidate,
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
export const images = imagesData as ImageAsset[];

type RawNarrativeCategory = {
  category?: string;
  name?: string;
  description?: string;
  entries?: unknown;
  candidates?: unknown;
};

type RawNarrativePack = {
  version?: string;
  scenario?: string;
  author?: string;
  date?: string;
  categories?: unknown;
};

const normalizeNarrativeCategory = (raw: RawNarrativeCategory): NarrativeCandidatesCategory | null => {
  const category = typeof raw.category === 'string'
    ? raw.category
    : typeof raw.name === 'string'
      ? raw.name
      : null;

  if (!category) {
    return null;
  }

  const description = typeof raw.description === 'string' ? raw.description : '';
  const entries = Array.isArray(raw.entries)
    ? raw.entries
    : Array.isArray(raw.candidates)
      ? raw.candidates
      : [];

  switch (category) {
    case 'advisor_lines':
      return {
        category,
        description,
        entries: entries as AdvisorLineCandidate[]
      };
    case 'debrief_variants':
      return {
        category,
        description,
        entries: entries as DebriefVariantCandidate[]
      };
    case 'pressure_text':
      return {
        category,
        description,
        entries: entries as PressureTextCandidate[]
      };
    case 'causality_reveal':
      return {
        category,
        description,
        entries: entries as CausalityRevealCandidate[]
      };
    case 'advisor_retrospective':
      return {
        category,
        description,
        entries: entries as AdvisorRetrospectiveCandidate[]
      };
    default:
      return null;
  }
};

const normalizeNarrativeCandidatesPack = (rawPack: RawNarrativePack): NarrativeCandidatesPack => {
  const categories = Array.isArray(rawPack.categories)
    ? rawPack.categories
      .map((entry) => normalizeNarrativeCategory(entry as RawNarrativeCategory))
      .filter((entry): entry is NarrativeCandidatesCategory => entry !== null)
    : [];

  return {
    version: rawPack.version ?? 'unknown',
    scenario: rawPack.scenario ?? 'unknown',
    author: rawPack.author ?? 'unknown',
    date: rawPack.date ?? 'unknown',
    categories
  };
};

export const narrativeCandidates = normalizeNarrativeCandidatesPack(narrativeCandidatesData as RawNarrativePack);

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

export const getScenarioArchetype = (scenarioId: string): RivalArchetype => {
  const scenario = getScenario(scenarioId);
  return getArchetype(scenario.adversaryProfileId);
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

const dedupeLines = (lines: string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    if (seen.has(line)) {
      continue;
    }
    seen.add(line);
    unique.push(line);
  }
  return unique;
};

const buildAdvisorLineOverlay = (): Map<string, AdvisorLineCandidate[]> => {
  const category = getNarrativeCategory('advisor_lines');
  const byBeat = new Map<string, AdvisorLineCandidate[]>();
  if (!category) {
    return byBeat;
  }

  for (const entry of category.entries) {
    const current = byBeat.get(entry.beatId) ?? [];
    current.push(entry);
    byBeat.set(entry.beatId, current);
  }

  return byBeat;
};

const mergeScenarioAdvisorLines = (
  scenario: ScenarioDefinition,
  byBeat: Map<string, AdvisorLineCandidate[]>
): ScenarioDefinition => {
  // Precedence rule: scenario-authored lines are baseline; pack lines append if non-duplicate.
  return {
    ...scenario,
    beats: scenario.beats.map((beat) => {
      const overlays = byBeat.get(beat.id);
      if (!overlays || overlays.length === 0) {
        return beat;
      }

      const merged: Record<string, string[]> = Object.fromEntries(
        Object.entries(beat.advisorLines).map(([advisor, lines]) => [advisor, dedupeLines(lines)])
      );

      for (const overlay of overlays) {
        const existing = merged[overlay.advisor] ?? [];
        merged[overlay.advisor] = dedupeLines([...existing, overlay.line]);
      }

      return {
        ...beat,
        advisorLines: merged
      };
    })
  };
};

const advisorLineOverlayByBeat = buildAdvisorLineOverlay();
export const scenarios = (scenariosData as ScenarioDefinition[]).map((scenario) =>
  scenario.id === narrativeCandidates.scenario
    ? mergeScenarioAdvisorLines(scenario, advisorLineOverlayByBeat)
    : scenario
);

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

export const getDebriefVariants = (tag?: DebriefTag): DebriefVariantCandidate[] => {
  const category = getNarrativeCategory('debrief_variants');
  if (!category) {
    return [];
  }

  if (!tag) {
    return category.entries;
  }

  return category.entries.filter((entry) => entry.source === tag);
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
