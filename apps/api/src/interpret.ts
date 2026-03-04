import type { ActionDefinition } from '@wargames/shared-types';

export type InterpretDecision = 'execute' | 'review' | 'reject';

export interface InterpretSuggestion {
  actionId: string;
  actionName: string;
}

export interface InterpretMatch {
  confidence: number;
  decision: InterpretDecision;
  interpretedActionId: string | null;
  interpretedActionName: string | null;
  suggestions: InterpretSuggestion[];
}

const normalizeCommand = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const asSuggestion = (action: ActionDefinition): InterpretSuggestion => ({
  actionId: action.id,
  actionName: action.name
});

const applyDecision = (
  confidence: number,
  action: ActionDefinition | null,
  suggestions: InterpretSuggestion[]
): InterpretMatch => {
  const decision: InterpretDecision = confidence >= 0.7 ? 'execute' : confidence >= 0.4 ? 'review' : 'reject';
  return {
    confidence,
    decision,
    interpretedActionId: action?.id ?? null,
    interpretedActionName: action?.name ?? null,
    suggestions
  };
};

export const interpretCommand = (commandText: string, offeredActions: ActionDefinition[]): InterpretMatch => {
  const canonical = commandText.trim().toLowerCase();
  const normalized = normalizeCommand(commandText);

  if (!normalized || offeredActions.length === 0) {
    return applyDecision(0.1, null, offeredActions.slice(0, 3).map(asSuggestion));
  }

  const stripped = normalized
    .replace(/^\/?action\s+/, '')
    .replace(/^\/?execute\s+/, '')
    .trim();
  const query = stripped || normalized;

  if (!query) {
    return applyDecision(0.2, null, offeredActions.slice(0, 3).map(asSuggestion));
  }

  const byId = offeredActions.find(
    (entry) => entry.id.toLowerCase() === canonical || normalizeCommand(entry.id) === query
  );
  if (byId) {
    return applyDecision(0.96, byId, [asSuggestion(byId)]);
  }

  const byExactName = offeredActions.find((entry) => normalizeCommand(entry.name) === query);
  if (byExactName) {
    return applyDecision(0.92, byExactName, [asSuggestion(byExactName)]);
  }

  const startsWithMatches = offeredActions.filter((entry) => normalizeCommand(entry.name).startsWith(query));
  if (startsWithMatches.length === 1) {
    return applyDecision(0.84, startsWithMatches[0] ?? null, startsWithMatches.map(asSuggestion));
  }
  if (startsWithMatches.length > 1) {
    return applyDecision(0.58, null, startsWithMatches.slice(0, 4).map(asSuggestion));
  }

  const containsMatches = offeredActions.filter((entry) => {
    const normalizedName = normalizeCommand(entry.name);
    return normalizedName.includes(query) || query.includes(normalizedName);
  });
  if (containsMatches.length === 1) {
    return applyDecision(0.74, containsMatches[0] ?? null, containsMatches.map(asSuggestion));
  }
  if (containsMatches.length > 1) {
    return applyDecision(0.49, null, containsMatches.slice(0, 4).map(asSuggestion));
  }

  const tokenSet = new Set(query.split(' ').filter((token) => token.length >= 3));
  const byTag = offeredActions.filter((entry) => entry.tags.some((tag) => tokenSet.has(tag.toLowerCase())));
  if (byTag.length === 1) {
    return applyDecision(0.7, byTag[0] ?? null, byTag.map(asSuggestion));
  }
  if (byTag.length > 1) {
    return applyDecision(0.45, null, byTag.slice(0, 4).map(asSuggestion));
  }

  const fallbackSuggestions = [...offeredActions]
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 3)
    .map(asSuggestion);

  return applyDecision(0.2, null, fallbackSuggestions);
};
