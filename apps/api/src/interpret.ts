import type {
  ActionDefinition,
  ActionVariantDefinition,
  BeatTruthModel,
  GameState,
  InterpretCommandResponse,
  ScenarioDefinition
} from '@wargames/shared-types';

export type InterpretDecision = 'execute' | 'review' | 'reject';

export interface InterpretSuggestion {
  actionId: string;
  actionName: string;
  variantId?: string | null;
  variantLabel?: string | null;
}

export interface InterpretMatch {
  confidence: number;
  decision: InterpretDecision;
  interpretedActionId: string | null;
  interpretedActionName: string | null;
  variantId: string | null;
  variantLabel: string | null;
  customLabel: string | null;
  interpretationRationale: string | null;
  narrativeEmphasis: string | null;
  suggestions: InterpretSuggestion[];
}

interface InterpretContext {
  scenario?: ScenarioDefinition | null;
  state?: GameState | null;
  currentTruthModel?: BeatTruthModel | null;
}

interface ScoredVariant {
  variant: ActionVariantDefinition | null;
  score: number;
  matchedThemes: string[];
}

interface ScoredAction {
  action: ActionDefinition;
  score: number;
  exact: boolean;
  variant: ActionVariantDefinition | null;
  variantScore: number;
  matchedThemes: string[];
}

const normalizeCommand = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const tokenize = (value: string): string[] =>
  normalizeCommand(value)
    .split(' ')
    .filter((token) => token.length >= 2);

const toTitleCase = (value: string): string =>
  value.replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

const unique = (values: string[]): string[] => [...new Set(values)];

const cleanCommand = (value: string): string => {
  const normalized = normalizeCommand(value);
  return normalized
    .replace(/^\/?action\s+/, '')
    .replace(/^\/?execute\s+/, '')
    .replace(/^\/?respond\s+/, '')
    .trim();
};

const asSuggestion = (
  action: ActionDefinition,
  variant: ActionVariantDefinition | null
): InterpretSuggestion => ({
  actionId: action.id,
  actionName: action.name,
  variantId: variant?.id ?? null,
  variantLabel: variant?.label ?? null
});

const getDefaultVariant = (action: ActionDefinition): ActionVariantDefinition | null => {
  if (!action.variants || action.variants.length === 0) {
    return null;
  }
  return (
    action.variants.find((variant) => variant.id === action.defaultVariantId || variant.isDefault) ??
    action.variants[0] ??
    null
  );
};

const includesPhrase = (haystack: string, needle: string): boolean => haystack.includes(needle) || needle.includes(haystack);

const keywordBoost = (
  query: string,
  positiveHints: string[],
  label: string,
  matchedThemes: string[],
  theme: string
): number => {
  const normalizedLabel = normalizeCommand(label);
  let score = 0;

  if (query && includesPhrase(normalizedLabel, query)) {
    score += 0.28;
    matchedThemes.push(`${theme} posture`);
  }

  for (const hint of positiveHints) {
    const normalizedHint = normalizeCommand(hint);
    if (!normalizedHint) {
      continue;
    }
    if (includesPhrase(query, normalizedHint)) {
      score += 0.16;
      matchedThemes.push(theme);
    }
  }

  return score;
};

const scoreVariant = (query: string, tokens: string[], action: ActionDefinition): ScoredVariant => {
  const defaultVariant = getDefaultVariant(action);
  if (!action.variants || action.variants.length === 0) {
    return {
      variant: defaultVariant,
      score: 0,
      matchedThemes: []
    };
  }

  const thematicKeywords = {
    quiet: ['quiet', 'private', 'backchannel', 'discreet', 'deniable', 'low profile', 'off ramp'],
    forceful: ['forceful', 'visible', 'public', 'overt', 'hard', 'surge', 'forward', 'loud', 'demonstration'],
    balanced: ['balanced', 'calibrated', 'measured', 'limited', 'controlled', 'incremental', 'disciplined']
  };

  const scoredVariants = action.variants.map((variant) => {
    const variantLabel = normalizeCommand(variant.label);
    const variantSummary = normalizeCommand(variant.summary);
    const hintTokens = unique(
      [...variant.interpretationHints, variant.label, variant.summary]
        .flatMap((entry) => tokenize(entry))
    );
    const matchedThemes: string[] = [];
    let score = variant.id === action.defaultVariantId || variant.isDefault ? 0.08 : 0;

    if (query && (variantLabel === query || variantSummary === query)) {
      score += 0.8;
      matchedThemes.push('explicit variant request');
    } else {
      if (query && (includesPhrase(variantLabel, query) || includesPhrase(variantSummary, query))) {
        score += 0.32;
        matchedThemes.push('variant wording');
      }

      const matchingTokens = tokens.filter((token) => hintTokens.includes(token));
      if (matchingTokens.length > 0) {
        score += Math.min(0.34, matchingTokens.length * 0.1);
        matchedThemes.push(`command emphasis on ${matchingTokens.slice(0, 2).join(' / ')}`);
      }
    }

    score += keywordBoost(query, thematicKeywords.quiet, variant.label, matchedThemes, 'quiet');
    score += keywordBoost(query, thematicKeywords.forceful, variant.label, matchedThemes, 'forceful');
    score += keywordBoost(query, thematicKeywords.balanced, variant.label, matchedThemes, 'balanced');

    return {
      variant,
      score,
      matchedThemes: unique(matchedThemes)
    };
  });

  const best = scoredVariants.sort((left, right) => right.score - left.score)[0];
  if (!best) {
    return {
      variant: defaultVariant,
      score: 0,
      matchedThemes: []
    };
  }

  if (best.score <= 0.05 && defaultVariant) {
    return {
      variant: defaultVariant,
      score: 0.05,
      matchedThemes: ['default variant']
    };
  }

  return best;
};

const scoreAction = (query: string, tokens: string[], action: ActionDefinition): ScoredAction => {
  const canonicalId = action.id.toLowerCase();
  const normalizedName = normalizeCommand(action.name);
  const normalizedSummary = normalizeCommand(action.summary);
  const matchedThemes: string[] = [];
  let score = 0;
  let exact = false;

  if (canonicalId === query || normalizeCommand(canonicalId) === query) {
    score += 1;
    exact = true;
    matchedThemes.push('exact action id');
  }

  if (normalizedName === query) {
    score = Math.max(score, 0.96);
    exact = true;
    matchedThemes.push('exact response name');
  } else if (query && (normalizedName.startsWith(query) || query.startsWith(normalizedName))) {
    score = Math.max(score, 0.82);
    matchedThemes.push('response name');
  } else if (query && (normalizedName.includes(query) || query.includes(normalizedName))) {
    score = Math.max(score, 0.72);
    matchedThemes.push('partial response name');
  }

  if (query && normalizedSummary.includes(query)) {
    score += 0.18;
    matchedThemes.push('response summary');
  }

  const tagMatches = action.tags.filter((tag) => tokens.includes(normalizeCommand(tag)));
  if (tagMatches.length > 0) {
    score += Math.min(0.24, tagMatches.length * 0.08);
    matchedThemes.push(`tag match: ${tagMatches.slice(0, 2).join(', ')}`);
  }

  const nameTokens = new Set(tokenize(action.name));
  const summaryTokens = new Set(tokenize(action.summary));
  const lexicalMatches = tokens.filter((token) => nameTokens.has(token) || summaryTokens.has(token));
  if (lexicalMatches.length > 0) {
    score += Math.min(0.18, lexicalMatches.length * 0.05);
    matchedThemes.push(`lexical overlap: ${lexicalMatches.slice(0, 2).join(', ')}`);
  }

  const strongNameMatches = tokens.filter((token) => token.length >= 4 && nameTokens.has(token));
  if (strongNameMatches.length > 0) {
    score += Math.min(0.24, strongNameMatches.length * 0.12);
    matchedThemes.push(`response keyword: ${strongNameMatches.slice(0, 2).join(', ')}`);
  }

  const variantScore = scoreVariant(query, tokens, action);
  score += Math.min(0.22, variantScore.score * 0.55);

  return {
    action,
    score,
    exact,
    variant: variantScore.variant,
    variantScore: variantScore.score,
    matchedThemes: unique([...matchedThemes, ...variantScore.matchedThemes])
  };
};

const buildCustomLabel = (
  rawCommandText: string,
  actionName: string,
  variantLabel: string | null
): string | null => {
  const compact = rawCommandText.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return null;
  }

  const normalized = normalizeCommand(compact);
  if (!normalized) {
    return null;
  }

  const actionNormalized = normalizeCommand(actionName);
  const variantNormalized = variantLabel ? normalizeCommand(variantLabel) : '';
  if (normalized === actionNormalized || normalized === variantNormalized) {
    return null;
  }

  const pieces = compact
    .replace(/^[\/-]+/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  if (pieces.length === 0) {
    return null;
  }

  return toTitleCase(pieces.join(' '));
};

const buildContextAnchor = (context?: InterpretContext): string | null => {
  const anchors: string[] = [];
  if (!context?.state) {
    return null;
  }

  if (context.state.latent.deceptionEffectiveness >= 60) {
    anchors.push('the current sensor picture is still degraded');
  }
  if (context.state.latent.shippingStress >= 60) {
    anchors.push('commercial stress is already feeding through shipping and insurance');
  }
  if (context.state.latent.munitionsDepth <= 45) {
    anchors.push('munitions depth is under pressure');
  }
  if (context.currentTruthModel && context.currentTruthModel.unknowns.length >= context.currentTruthModel.verifiedFacts.length) {
    anchors.push('unknowns still outweigh verified facts');
  }

  return anchors[0] ?? null;
};

const buildInterpretationRationale = (
  match: ScoredAction,
  rawCommandText: string,
  context?: InterpretContext
): { customLabel: string | null; interpretationRationale: string | null; narrativeEmphasis: string | null } => {
  const variant = match.variant;
  const customLabel = buildCustomLabel(rawCommandText, match.action.name, variant?.label ?? null);
  const emphasis = variant?.narrativeEmphasis ?? null;
  const contextAnchor = buildContextAnchor(context);
  const leadingTheme = match.matchedThemes[0] ?? 'the phrasing and timing of the instruction';

  const parts = [
    `Mapped to ${match.action.name}${variant ? ` using the ${variant.label} variant` : ''} because the command emphasized ${leadingTheme}.`
  ];

  if (contextAnchor) {
    parts.push(`This fit best because ${contextAnchor}.`);
  }

  if (variant?.hiddenDownsideCategory) {
    parts.push(`The main hidden downside category for this interpretation is ${variant.hiddenDownsideCategory}.`);
  }

  return {
    customLabel,
    interpretationRationale: parts.join(' '),
    narrativeEmphasis: emphasis
  };
};

const applyDecision = (
  rawCommandText: string,
  scored: ScoredAction[],
  context?: InterpretContext
): InterpretMatch => {
  const ranked = [...scored].sort((left, right) => right.score - left.score);
  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const fallbackSuggestions = ranked.slice(0, 3).map((entry) => asSuggestion(entry.action, entry.variant));

  if (!best) {
    return {
      confidence: 0.1,
      decision: 'reject',
      interpretedActionId: null,
      interpretedActionName: null,
      variantId: null,
      variantLabel: null,
      customLabel: null,
      interpretationRationale: null,
      narrativeEmphasis: null,
      suggestions: fallbackSuggestions
    };
  }

  const margin = second ? best.score - second.score : best.score;
  const confidence = Math.max(0.1, Math.min(0.99, best.exact ? best.score : best.score - Math.max(0, 0.1 - margin)));
  const enriched = buildInterpretationRationale(best, rawCommandText, context);

  const strongVariantMatch = best.variantScore >= 0.3 && best.score >= 0.24 && margin >= 0.06;

  if (best.exact || (best.score >= 0.72 && margin >= 0.14) || strongVariantMatch) {
    return {
      confidence,
      decision: 'execute',
      interpretedActionId: best.action.id,
      interpretedActionName: best.action.name,
      variantId: best.variant?.id ?? null,
      variantLabel: best.variant?.label ?? null,
      customLabel: enriched.customLabel,
      interpretationRationale: enriched.interpretationRationale,
      narrativeEmphasis: enriched.narrativeEmphasis,
      suggestions: [asSuggestion(best.action, best.variant)]
    };
  }

  if (best.score >= 0.38) {
    return {
      confidence,
      decision: 'review',
      interpretedActionId: null,
      interpretedActionName: null,
      variantId: null,
      variantLabel: null,
      customLabel: null,
      interpretationRationale: null,
      narrativeEmphasis: null,
      suggestions: fallbackSuggestions
    };
  }

  return {
    confidence,
    decision: 'reject',
    interpretedActionId: null,
    interpretedActionName: null,
    variantId: null,
    variantLabel: null,
    customLabel: null,
    interpretationRationale: null,
    narrativeEmphasis: null,
    suggestions: fallbackSuggestions
  };
};

export const interpretCommand = (
  commandText: string,
  offeredActions: ActionDefinition[],
  context?: InterpretContext
): InterpretMatch => {
  const query = cleanCommand(commandText);
  const tokens = tokenize(query);

  if (!query || offeredActions.length === 0) {
    return {
      confidence: 0.1,
      decision: 'reject',
      interpretedActionId: null,
      interpretedActionName: null,
      variantId: null,
      variantLabel: null,
      customLabel: null,
      interpretationRationale: null,
      narrativeEmphasis: null,
      suggestions: offeredActions.slice(0, 3).map((action) => asSuggestion(action, getDefaultVariant(action)))
    };
  }

  const scored = offeredActions.map((action) => scoreAction(query, tokens, action));
  return applyDecision(commandText, scored, context);
};

export const asInterpretResponseDefaults = (
  response: Partial<InterpretCommandResponse>
): Pick<
  InterpretCommandResponse,
  'variantId' | 'variantLabel' | 'customLabel' | 'interpretationRationale' | 'narrativeEmphasis'
> => ({
  variantId: response.variantId ?? null,
  variantLabel: response.variantLabel ?? null,
  customLabel: response.customLabel ?? null,
  interpretationRationale: response.interpretationRationale ?? null,
  narrativeEmphasis: response.narrativeEmphasis ?? null
});
