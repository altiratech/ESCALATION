import type {
  ActionDefinition,
  AdvisorDossier,
  AdvisorRecommendationAlignment,
  BeatNode
} from '@wargames/shared-types';

export type AdvisorAlignment = AdvisorRecommendationAlignment;

export interface AdvisorActionRead {
  advisorId: string;
  advisorName: string;
  stance: string;
  alignment: AdvisorAlignment;
  rationale: string;
}

interface ActionProfile {
  isMilitary: boolean;
  isDeterrence: boolean;
  isDiplomacy: boolean;
  isDeescalatory: boolean;
  isEconomic: boolean;
  isHighCost: boolean;
  isCyber: boolean;
  isCovert: boolean;
  isResilience: boolean;
  isIntel: boolean;
  isPublic: boolean;
  isSecret: boolean;
  isOvert: boolean;
  stronglyEscalatory: boolean;
  stronglyDeescalatory: boolean;
}

const hasTag = (action: ActionDefinition, tag: string): boolean => action.tags.includes(tag);

const getActionProfile = (action: ActionDefinition): ActionProfile => ({
  isMilitary: hasTag(action, 'military'),
  isDeterrence: hasTag(action, 'deterrence'),
  isDiplomacy: hasTag(action, 'diplomacy'),
  isDeescalatory: hasTag(action, 'deescalation'),
  isEconomic: hasTag(action, 'economic') || hasTag(action, 'pressure'),
  isHighCost: hasTag(action, 'high_cost'),
  isCyber: hasTag(action, 'cyber'),
  isCovert: hasTag(action, 'covert') || hasTag(action, 'offensive'),
  isResilience: hasTag(action, 'resilience') || hasTag(action, 'energy'),
  isIntel: hasTag(action, 'intel'),
  isPublic: action.visibility === 'public',
  isSecret: action.visibility === 'secret',
  isOvert: action.visibility !== 'secret',
  stronglyEscalatory: action.signal.escalatory >= 0.7,
  stronglyDeescalatory: action.signal.deescalatory >= 0.7
});

const alignmentFromScore = (score: number): AdvisorAlignment => {
  if (score >= 2) {
    return 'supports';
  }
  if (score <= -2) {
    return 'opposes';
  }
  return 'cautions';
};

const scoreForAdvisor = (action: ActionDefinition, advisorId: string): number => {
  const profile = getActionProfile(action);

  switch (advisorId) {
    case 'cross': {
      let score = 0;
      if (profile.isMilitary || profile.isDeterrence) {
        score += 3;
      }
      if (profile.isPublic && action.signal.resolveSignal >= 0.45) {
        score += 1;
      }
      if (profile.isDiplomacy || profile.isDeescalatory) {
        score -= 3;
      }
      if (profile.isEconomic || profile.isResilience) {
        score -= 1;
      }
      if (profile.isCovert && !profile.isPublic) {
        score -= 1;
      }
      return score;
    }
    case 'chen': {
      let score = 0;
      if (profile.isDiplomacy || profile.isDeescalatory) {
        score += 3;
      }
      if (profile.isPublic && action.signal.allianceStressSignal <= 0.15) {
        score += 1;
      }
      if (profile.stronglyEscalatory || profile.isMilitary || profile.isCovert || profile.isCyber) {
        score -= 3;
      }
      if (profile.isHighCost) {
        score -= 1;
      }
      return score;
    }
    case 'okonkwo': {
      let score = 0;
      if (profile.isEconomic && !profile.isHighCost) {
        score += 3;
      }
      if (profile.isResilience) {
        score += 2;
      }
      if (profile.isDiplomacy && profile.isSecret) {
        score += 1;
      }
      if (profile.isHighCost || action.signal.economicStressSignal >= 0.75) {
        score -= 3;
      }
      if (profile.isMilitary || profile.isCovert) {
        score -= 2;
      }
      return score;
    }
    case 'reed': {
      let score = 0;
      if (profile.isSecret && (profile.isCyber || profile.isCovert || profile.isIntel || profile.isDiplomacy)) {
        score += 3;
      }
      if (profile.isPublic && (profile.isMilitary || profile.isEconomic || profile.isHighCost)) {
        score -= 3;
      }
      if (profile.stronglyDeescalatory && profile.isPublic) {
        score -= 2;
      }
      if (profile.isOvert && !profile.isMilitary && !profile.isEconomic) {
        score -= 1;
      }
      return score;
    }
    default:
      return 0;
  }
};

const rationaleForAdvisor = (advisorId: string, alignment: AdvisorAlignment): string => {
  switch (advisorId) {
    case 'cross':
      if (alignment === 'supports') {
        return 'Sees this as visible resolve that can raise the cost of the next PLA move without conceding initiative.';
      }
      if (alignment === 'opposes') {
        return 'Views this as signaling restraint too early or relying on tools that do not visibly reset deterrence.';
      }
      return 'Sees some signaling value here, but questions whether it shows enough force to change Beijing’s calculus.';
    case 'chen':
      if (alignment === 'supports') {
        return 'Sees this as preserving coalition discipline while leaving room for an off-ramp that does not legitimize coercion.';
      }
      if (alignment === 'opposes') {
        return 'Thinks this hardens positions faster than it buys leverage and may close the diplomatic exit.';
      }
      return 'Accepts parts of the move, but worries execution or framing could split allies or narrow the exit ramp.';
    case 'okonkwo':
      if (alignment === 'supports') {
        return 'Likes the coalition and market-management profile and sees this as pressure the alliance can sustain.';
      }
      if (alignment === 'opposes') {
        return 'Thinks the commercial blowback or coalition cost outweighs the immediate pressure value.';
      }
      return 'Sees leverage here, but worries about shipping, chip, and market spillover if the move is mishandled.';
    case 'reed':
      if (alignment === 'supports') {
        return 'Prefers the optionality and ambiguity here; it applies pressure without forcing an overt commitment.';
      }
      if (alignment === 'opposes') {
        return 'Views this as closing off covert options and forcing the crisis into an overt response channel.';
      }
      return 'Sees utility, but worries the move either telegraphs too much or leaves too little deniable leverage.';
    default:
      if (alignment === 'supports') {
        return 'Current read is favorable.';
      }
      if (alignment === 'opposes') {
        return 'Current read is negative.';
      }
      return 'Current read is mixed.';
  }
};

const authoredAlignmentForAction = (
  actionId: string,
  guidance?: NonNullable<BeatNode['advisorActionGuidance']>[string]
): AdvisorAlignment | null => {
  if (!guidance) {
    return null;
  }
  if (guidance.supports.includes(actionId)) {
    return 'supports';
  }
  if (guidance.cautions.includes(actionId)) {
    return 'cautions';
  }
  if (guidance.opposes.includes(actionId)) {
    return 'opposes';
  }
  return null;
};

export const getAdvisorActionReads = (
  action: ActionDefinition | null,
  advisorDossiers: AdvisorDossier[],
  beat?: BeatNode | null
): AdvisorActionRead[] => {
  if (!action) {
    return [];
  }

  return advisorDossiers.map((dossier) => {
    const authoredGuidance = beat?.advisorActionGuidance?.[dossier.id];
    const authoredAlignment = authoredAlignmentForAction(action.id, authoredGuidance);
    const alignment = authoredAlignment ?? alignmentFromScore(scoreForAdvisor(action, dossier.id));
    return {
      advisorId: dossier.id,
      advisorName: dossier.name,
      stance: dossier.stance,
      alignment,
      rationale: authoredGuidance?.rationaleByAlignment[alignment] ?? rationaleForAdvisor(dossier.id, alignment)
    };
  });
};
