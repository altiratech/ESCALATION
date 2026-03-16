export const METER_KEYS = [
  'economicStability',
  'energySecurity',
  'domesticCohesion',
  'militaryReadiness',
  'allianceTrust',
  'escalationIndex'
] as const;

export type MeterKey = (typeof METER_KEYS)[number];

export type OutcomeCategory =
  | 'stabilization'
  | 'frozen_conflict'
  | 'war'
  | 'regime_instability'
  | 'economic_collapse';
export type TimerMode = 'standard' | 'relaxed' | 'off';
export type BeatPhase = 'opening' | 'rising' | 'crisis' | 'climax' | 'resolution';
export type DebriefTag = 'PlayerAction' | 'SecondaryEffect' | 'SystemEvent';
export type AdvisorRecommendationAlignment = 'supports' | 'cautions' | 'opposes';
export type TruthTier = 'verified_facts' | 'working_theories' | 'unknowns';

export type Visibility = 'public' | 'secret' | 'semi-public';
export type ActorType = 'player' | 'rival';

export type MeterState = Record<MeterKey, number>;

export interface LatentState {
  globalLegitimacy: number;
  rivalDomesticPressure: number;
  playerDomesticApproval: number;
  usSurgeSlack: number;
  munitionsDepth: number;
  politicalBuffer: number;
  taiwanResilience: number;
  shippingStress: number;
  cyberPrepositioning: number;
  deceptionEffectiveness: number;
  vulnerabilityFlags: string[];
}

export type LatentDelta = Partial<Omit<LatentState, 'vulnerabilityFlags'>>;

export interface BeliefState {
  bluffProb: number;
  thresholdHighProb: number;
  economicallyWeakProb: number;
  allianceFragileProb: number;
  escalationVelocity: number;
  deescalateUnderPressure: number;
  humiliation: number;
}

export interface IntelQualityState {
  byMeter: Record<MeterKey, number>;
  expiresAtTurn: number | null;
}

export interface DelayedEffect {
  id: string;
  sourceActionId: string;
  sourceActor: ActorType;
  applyOnTurn: number;
  chance: number;
  meterDeltas: Partial<MeterState>;
  latentDeltas?: LatentDelta;
  description: string;
}

export interface EventCondition {
  meter?: MeterKey;
  latent?: keyof Omit<LatentState, 'vulnerabilityFlags'>;
  op: 'lt' | 'lte' | 'gt' | 'gte';
  value: number;
}

export interface EventDefinition {
  id: string;
  label: string;
  domain: 'economy' | 'energy' | 'unrest' | 'military' | 'cyber' | 'diplomacy';
  baseChance: number;
  conditions: EventCondition[];
  meterDeltas: Partial<MeterState>;
  latentDeltas?: Partial<Omit<LatentState, 'vulnerabilityFlags'>>;
  publicVisibility: number;
  narrativeToken: string;
}

export interface SideEffectDefinition {
  id: string;
  chance: number;
  meterDeltas: Partial<MeterState>;
  latentDeltas?: LatentDelta;
  narrativeToken: string;
}

export interface ActionSignalProfile {
  escalatory: number;
  deescalatory: number;
  bluffSignal: number;
  resolveSignal: number;
  economicStressSignal: number;
  allianceStressSignal: number;
  humiliationRisk: number;
}

export interface ActionDelayedEffectDefinition {
  delayTurns: number;
  chance: number;
  meterDeltas: Partial<MeterState>;
  latentDeltas?: LatentDelta;
  description: string;
}

export interface ActionVariantDefinition {
  id: string;
  label: string;
  summary: string;
  interpretationHints: string[];
  visualTags?: string[];
  immediateMeterDeltas?: Partial<MeterState>;
  immediateLatentDeltas?: LatentDelta;
  delayedEffects?: ActionDelayedEffectDefinition[];
  narrativeEmphasis: string;
  advisorFraming: string;
  hiddenDownsideCategory: string;
  isDefault?: boolean;
}

export interface ActionDefinition {
  id: string;
  actor: ActorType;
  name: string;
  summary: string;
  visibility: Visibility;
  tags: string[];
  visualTags?: string[];
  immediateMeterDeltas: Partial<MeterState>;
  immediateLatentDeltas?: LatentDelta;
  sideEffects: SideEffectDefinition[];
  delayedEffects: ActionDelayedEffectDefinition[];
  variants?: ActionVariantDefinition[];
  defaultVariantId?: string;
  intelQualityBoost?: number;
  signal: ActionSignalProfile;
  minTurn?: number;
  maxTurn?: number;
}

export interface AdversaryProfile {
  id: string;
  name: string;
  description: string;
  riskTolerance: number;
  escalationThreshold: number;
  covertPreference: number;
  egoSensitivity: number;
  bluffSensitivity: number;
  priorities: {
    preserveEconomy: number;
    preserveRegimeStability: number;
    preserveImage: number;
    projectStrength: number;
    avoidAllianceBreak: number;
  };
}

export interface Condition {
  source: 'meter' | 'latent' | 'belief';
  key: string;
  op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  value: number;
}

export interface BranchCondition {
  targetBeatId: string;
  conditions: Condition[];
  minTurn?: number | null;
  maxTurn?: number | null;
  requiresActionTag?: string | null;
  priority?: number;
}

export interface BeatDecisionWindow {
  seconds: number;
  inactionBeatId: string;
  inactionDeltas: Partial<MeterState>;
  inactionNarrative: string;
}

export interface BeatAdvisorActionGuidance {
  supports: string[];
  cautions: string[];
  opposes: string[];
  rationaleByAlignment: Record<AdvisorRecommendationAlignment, string>;
}

export interface ScenarioContextSection {
  id: string;
  title: string;
  body: string;
}

export interface TruthSignalItem {
  id: string;
  title: string;
  body: string;
}

export interface BeatTruthModel {
  verifiedFacts: TruthSignalItem[];
  workingTheories: TruthSignalItem[];
  unknowns: TruthSignalItem[];
}

export type ImageAssetKind = 'scenario_still' | 'documentary_still' | 'map' | 'artifact';

export interface BeatVisualCue {
  preferredKinds: ImageAssetKind[];
  tags: string[];
  branchStage?: 'ambiguous' | 'compression' | 'coercion' | 'incident' | 'false_relief' | 'tail_risk' | 'collapse';
  caption?: string;
}

export interface BeatNode {
  id: string;
  phase: BeatPhase;
  sceneFragments: string[];
  advisorLines: Record<string, string[]>;
  advisorActionGuidance?: Record<string, BeatAdvisorActionGuidance>;
  truthModel?: BeatTruthModel;
  windowContext?: {
    sections: ScenarioContextSection[];
  };
  headlines: string[];
  memoLine: string | null;
  tickerLine: string | null;
  imageHints: string[];
  visualCue?: BeatVisualCue;
  branches: BranchCondition[];
  terminalOutcome: OutcomeCategory | null;
  meterOverrides: Partial<MeterState> | null;
  advisorUnlock: string | null;
  musicCue: string | null;
  decisionWindow: BeatDecisionWindow | null;
}

export interface MissionObjective {
  id: string;
  label: string;
  description: string;
  primaryMeters: MeterKey[];
  targetDirection: 'high' | 'low';
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  briefing: string;
  role: string;
  worldModelId?: string;
  roleTrackId?: string;
  isLegacy?: boolean;
  autoTerminateCatastrophicOutcomes?: boolean;
  missionObjectives: MissionObjective[];
  adversaryProfileId: string;
  maxTurns: number;
  environment: 'generic' | 'coastal' | 'arctic' | 'dense_city' | 'industrial';
  pressureCurve: number[];
  meterLabels: Record<MeterKey, string>;
  initialMeters: MeterState;
  initialLatent: LatentState;
  initialBeliefs: BeliefState;
  initialIntelQuality: Record<MeterKey, number>;
  startingBeatId: string;
  beats: BeatNode[];
  eventTable: EventDefinition[];
  availablePlayerActionIds: string[];
  availableRivalActionIds: string[];
}

export interface ImageAsset {
  id: string;
  path: string;
  kind: ImageAssetKind;
  domain: 'economy' | 'energy' | 'unrest' | 'military' | 'cyber' | 'diplomacy';
  severity: 0 | 1 | 2 | 3 | 4;
  environment: 'generic' | 'coastal' | 'arctic' | 'dense_city' | 'industrial';
  perspective: 'satellite' | 'street' | 'news_frame' | 'memo' | 'ticker';
  tags: string[];
  alt: string;
  caption: string;
}

export interface NarrativeBundle {
  briefingParagraph: string;
  headlines: string[];
  memoLine?: string;
  tickerLine?: string;
}

export interface MeterRange {
  low: number;
  high: number;
  confidence: number;
}

export interface TurnDebriefLine {
  tag: DebriefTag;
  text: string;
}

export interface TurnDebrief {
  lines: TurnDebriefLine[];
}

export interface ActiveCountdown {
  beatId: string;
  seconds: number;
  secondsRemaining: number;
  expiresAt: number;
  inactionBeatId: string;
  inactionDeltas: Partial<MeterState>;
  inactionNarrative: string;
  extendsUsed: number;
}

export interface TurnHistoryEntry {
  turn: number;
  beatIdBefore: string;
  beatIdAfter: string;
  offeredActionIds: string[];
  playerActionId: string;
  playerActionVariantId?: string | null;
  playerActionVariantLabel?: string | null;
  playerActionCustomLabel?: string | null;
  rivalActionId: string;
  meterBefore: MeterState;
  meterAfter: MeterState;
  visibleRanges: Record<MeterKey, MeterRange>;
  triggeredEvents: string[];
  beliefSnapshot: BeliefState;
  narrative: NarrativeBundle;
  turnDebrief: TurnDebrief;
  selectedImageId: string | null;
  rngTrace: number[];
}

export interface GameState {
  id: string;
  scenarioId: string;
  turn: number;
  maxTurns: number;
  status: 'active' | 'completed';
  meters: MeterState;
  latent: LatentState;
  beliefs: BeliefState;
  intelQuality: IntelQualityState;
  delayedQueue: DelayedEffect[];
  offeredActionIds: string[];
  recentImageIds: string[];
  currentBeatId: string;
  beatHistory: string[];
  activeAdvisors: string[];
  scenarioRole: string;
  meterLabels: Record<MeterKey, string>;
  timerMode: TimerMode;
  extendTimerUsesRemaining: number;
  activeCountdown: ActiveCountdown | null;
  turnDebrief: TurnDebrief | null;
  history: TurnHistoryEntry[];
  seed: string;
  rngState: number;
  outcome: OutcomeCategory | null;
  openingBriefing: NarrativeBundle;
}

export interface TurnResolution {
  turn: number;
  beatIdBefore: string;
  beatIdAfter: string;
  playerActionId: string;
  playerActionVariantId?: string | null;
  playerActionVariantLabel?: string | null;
  playerActionCustomLabel?: string | null;
  rivalActionId: string;
  triggeredEvents: string[];
  selectedImageId: string | null;
  narrative: NarrativeBundle;
  turnDebrief: TurnDebrief;
  visibleRanges: Record<MeterKey, MeterRange>;
  meterBefore: MeterState;
  meterAfter: MeterState;
  beliefsAfter: BeliefState;
  offeredActionIdsNext: string[];
  ended: boolean;
  outcome: OutcomeCategory | null;
  rngTrace: number[];
}

export interface ReportTimelinePoint {
  turn: number;
  escalationIndex: number;
  allianceTrust: number;
  economicStability: number;
}

export interface PostGameReport {
  episodeId: string;
  outcome: OutcomeCategory;
  outcomeExplanation: string;
  timeline: ReportTimelinePoint[];
  finalMeters: MeterState;
  pivotalDecision: {
    turn: number;
    actionId: string;
    actionName: string;
    reason: string;
  };
  beliefEvolution: Array<{
    turn: number;
    bluffProb: number;
    thresholdHighProb: number;
    humiliation: number;
  }>;
  misjudgments: string[];
  alternativeLine: {
    turn: number;
    suggestedActionId: string;
    suggestedActionName: string;
    predictedImpact: string;
  };
  fullCausality: FullCausalityReport;
}

export type CausalityDeltaSource = 'player' | 'rival' | 'event' | 'system';

export interface CausalityDeltaBreakdown {
  source: CausalityDeltaSource;
  delta: number;
}

export interface HiddenMeterDelta {
  meter: MeterKey;
  totalDelta: number;
  breakdown: CausalityDeltaBreakdown[];
}

export interface UnseenSystemEvent {
  turn: number;
  eventId: string;
  label: string;
  visibility: number;
  meterDeltas: Partial<MeterState>;
}

export interface BranchNotTakenOption {
  targetBeatId: string;
  reason: string;
}

export interface BranchNotTakenSummary {
  turn: number;
  beatId: string;
  selectedActionId: string;
  selectedBeatId: string;
  alternatives: BranchNotTakenOption[];
}

export interface AdvisorRetrospectiveLine {
  advisor: string;
  text: string;
}

export interface OutcomeNarrativeReveal {
  title: string;
  summary: string;
  causalNote: string;
}

export type PlayerGradeKey = 'masterful' | 'competent' | 'mixed' | 'poor' | 'catastrophic';

export interface DebriefDeepStrategyArc {
  headline: string;
  narrative: string;
  keyTurningPoint: string;
  whatIfNote: string;
}

export interface DebriefDeepHistoricalParallel {
  id: string;
  title: string;
  period: string;
  summary: string;
  lessonForPlayer: string;
  relevantOutcomes: OutcomeCategory[];
  tags: string[];
}

export interface DebriefDeepLesson {
  id: string;
  title: string;
  insight: string;
  relevantOutcomes: OutcomeCategory[];
  tags: string[];
}

export interface DebriefDeepAdvisorPostMortem {
  assessment: string;
  selfCritique: string;
  recommendation: string;
}

export interface DebriefDeepRivalPerspective {
  internalNarrative: string;
  regimeAssessment: string;
  publicNarrative: string;
}

export interface DebriefDeepGradeDescriptor {
  title: string;
  description: string;
}

export interface DebriefDeepTradeoffCommentary {
  summary: string;
  tradeoff: string;
}

export interface DebriefDeepDefinition {
  scenarioId: string;
  strategyArcSummaries: Partial<Record<OutcomeCategory, DebriefDeepStrategyArc>>;
  historicalParallels: DebriefDeepHistoricalParallel[];
  advisorPostMortems: Record<string, Partial<Record<OutcomeCategory, DebriefDeepAdvisorPostMortem>>>;
  rivalPerspective: Partial<Record<OutcomeCategory, DebriefDeepRivalPerspective>>;
  playerGradeDescriptors: Record<PlayerGradeKey, DebriefDeepGradeDescriptor>;
  tradeoffCommentary?: Record<string, Partial<Record<OutcomeCategory, DebriefDeepTradeoffCommentary>>>;
  lessonsLearned: DebriefDeepLesson[];
}

export interface DebriefDeepGrade {
  key: PlayerGradeKey;
  title: string;
  description: string;
  score: number;
}

export interface DebriefDeepAdvisorReflection extends DebriefDeepAdvisorPostMortem {
  advisor: string;
}

export interface DebriefDeepReport {
  grade: DebriefDeepGrade;
  strategyArc: DebriefDeepStrategyArc | null;
  rivalPerspective: DebriefDeepRivalPerspective | null;
  historicalParallels: DebriefDeepHistoricalParallel[];
  lessonsLearned: DebriefDeepLesson[];
  advisorReflections: DebriefDeepAdvisorReflection[];
}

export type TradeoffScorecardStatus = 'strong' | 'mixed' | 'strained' | 'broken';

export interface TradeoffScorecard {
  id: string;
  label: string;
  score: number;
  status: TradeoffScorecardStatus;
  primaryMeters: MeterKey[];
  summary: string;
  tradeoff: string;
}

export interface FullCausalityReport {
  outcomeNarrative: OutcomeNarrativeReveal;
  hiddenDeltas: HiddenMeterDelta[];
  adversaryLogicSummary: string;
  rivalLeaderReveal: RivalLeaderReveal | null;
  deepDebrief: DebriefDeepReport | null;
  tradeoffScorecards: TradeoffScorecard[];
  unseenSystemEvents: UnseenSystemEvent[];
  branchesNotTaken: BranchNotTakenSummary[];
  advisorRetrospectives: AdvisorRetrospectiveLine[];
}

export interface AdvisorLineCandidate {
  id: string;
  beatId: string;
  advisor: string;
  line: string;
}

export interface DebriefVariantCandidate {
  id: string;
  source: DebriefTag;
  condition: string;
  template: string;
}

export interface PressureTextCandidate {
  id: string;
  beatId: string;
  thresholdSeconds: number;
  text: string;
}

export type CausalityRevealField = 'title' | 'summary' | 'causal_note';

export interface CausalityRevealCandidate {
  id: string;
  outcome: OutcomeCategory;
  field: CausalityRevealField;
  text?: string;
  template?: string;
}

export interface AdvisorRetrospectiveCandidate {
  id: string;
  advisor: string;
  outcome: OutcomeCategory;
  text: string;
}

export interface AdvisorLinesCategory {
  category: 'advisor_lines';
  description: string;
  entries: AdvisorLineCandidate[];
}

export interface DebriefVariantsCategory {
  category: 'debrief_variants';
  description: string;
  entries: DebriefVariantCandidate[];
}

export interface PressureTextCategory {
  category: 'pressure_text';
  description: string;
  entries: PressureTextCandidate[];
}

export interface CausalityRevealCategory {
  category: 'causality_reveal';
  description: string;
  entries: CausalityRevealCandidate[];
}

export interface AdvisorRetrospectiveCategory {
  category: 'advisor_retrospective';
  description: string;
  entries: AdvisorRetrospectiveCandidate[];
}

export type NarrativeCandidatesCategory =
  | AdvisorLinesCategory
  | DebriefVariantsCategory
  | PressureTextCategory
  | CausalityRevealCategory
  | AdvisorRetrospectiveCategory;

export interface NarrativeCandidatesPack {
  version: string;
  scenario: string;
  author: string;
  date: string;
  categories: NarrativeCandidatesCategory[];
}

export type IntelSourceType = 'SIGINT' | 'HUMINT' | 'OSINT' | 'GEOINT' | 'MASINT' | 'FININT';
export type IntelClassification = 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'SECRET/SCI' | 'TOP SECRET/SCI';
export type IntelConfidence = 'low' | 'moderate' | 'high';

export interface IntelFragment {
  id: string;
  beatId: string;
  phase: BeatPhase;
  sourceType: IntelSourceType;
  classification: IntelClassification;
  confidence: IntelConfidence;
  headline: string;
  body: string;
  analystNote?: string;
  contradicts?: string;
  tags: string[];
}

export type NewsWireOutletType =
  | 'wire'
  | 'broadsheet'
  | 'financial'
  | 'defense_trade'
  | 'tabloid'
  | 'state_media'
  | 'social_media';

export type NewsWireRegion = 'domestic' | 'allied' | 'rival' | 'neutral' | 'international' | 'regional';
export type NewsWireTone = 'neutral' | 'hawkish' | 'dovish' | 'alarmist' | 'skeptical' | 'analytical';
export type NewsWireNarrativeWeight = 'background' | 'developing' | 'breaking' | 'exclusive' | 'opinion';

export interface NewsWireArticle {
  id: string;
  beatId: string;
  phase: BeatPhase;
  outlet: string;
  outletType: NewsWireOutletType;
  region: NewsWireRegion;
  headline: string;
  lede: string;
  pullQuote?: string;
  tone: NewsWireTone;
  tags: string[];
  narrativeWeight: NewsWireNarrativeWeight;
}

export interface ActionNarrativePhaseContent {
  preActionBrief: string;
  executionNarrative: string;
  successOutcome: string;
  complicationOutcome: string;
  rivalReaction: string;
  allianceReaction: string;
}

export interface ActionNarrativeDefinition {
  actionId: string;
  phases: Partial<Record<BeatPhase, ActionNarrativePhaseContent>>;
}

export type CinematicPhaseTransitionKey = 'opening_to_rising' | 'rising_to_crisis' | 'crisis_to_climax';
export type CinematicEndingTone = 'somber' | 'bittersweet' | 'ambiguous' | 'devastating';

export interface OpeningCinematic {
  title: string;
  subtitle: string;
  fragments: string[];
  closingLine: string;
  musicCue: string;
}

export interface CinematicTransition {
  fragments: string[];
  musicCue: string;
}

export interface CinematicEnding {
  title: string;
  fragments: string[];
  epilogueNote: string;
  tone: CinematicEndingTone;
  musicCue: string;
}

export interface CinematicsDefinition {
  scenarioId: string;
  openingCinematic: OpeningCinematic;
  phaseTransitions: Partial<Record<CinematicPhaseTransitionKey, CinematicTransition>>;
  endings: Partial<Record<OutcomeCategory, CinematicEnding>>;
}

export interface ScenarioWorldAlliance {
  name: string;
  description: string;
}

export interface ScenarioWorldStakeholder {
  id: string;
  name: string;
  type: string;
  description: string;
  influence: string;
  disposition: string;
}

export interface ScenarioWorldTimelineEvent {
  daysBeforeStart: number;
  event: string;
  significance: string;
}

export interface ScenarioGraphicAsset {
  path: string;
  alt: string;
  caption: string;
}

export interface ScenarioWorldDefinition {
  scenarioId: string;
  region: {
    name: string;
    description: string;
    coordinates: string;
    keyFeatures: string[];
    climateSeason: string;
  };
  dateAnchor: {
    year: number;
    month: string;
    dayRange: string;
    timeContext: string;
  };
  playerNation: {
    name: string;
    governmentType: string;
    currentLeader: string;
    domesticContext: string;
    militaryPosture: string;
    alliances: ScenarioWorldAlliance[];
  };
  rivalState: {
    name: string;
    governmentType: string;
    leaderTitle: string;
    domesticContext: string;
    militaryCapability: string;
    economicLeverage: string;
    knownRedLines: string;
  };
  stakeholders: ScenarioWorldStakeholder[];
  economicBackdrop: {
    globalConditions: string;
    straitEconomicValue: string;
    vulnerabilities: string;
    marketSentiment: string;
  };
  crisisTimeline: ScenarioWorldTimelineEvent[];
  intelligenceGaps: string[];
  openingBackground?: {
    summary: string;
    sections: ScenarioContextSection[];
  };
  legalFramework: {
    maritimeLaw: string;
    treatyObligations: string;
    sanctionsFramework: string;
  };
  theaterDiagram?: ScenarioGraphicAsset;
}

export interface AdvisorScenarioSpecific {
  openingAssessment: string;
  redLine: string;
  preferredEndstate: string;
}

export interface AdvisorTrustTriggers {
  gainsConfidence: string;
  losesConfidence: string;
}

export interface AdvisorDossier {
  id: string;
  name: string;
  title: string;
  organization: string;
  stance: string;
  shortBio: string;
  fullBio: string;
  perspective: string;
  decisionFramework: string;
  blindSpots: string;
  relationships: Record<string, string>;
  formativeExperience: string;
  catchphrases: string[];
  pressureResponse: string;
  trustTriggers: AdvisorTrustTriggers;
  scenarioSpecific: Record<string, AdvisorScenarioSpecific>;
}

export interface RivalLeaderPressurePoint {
  id: string;
  name: string;
  description: string;
  exploitability: string;
  risk: string;
}

export interface RivalLeaderPublicStatement {
  context: string;
  quote: string;
  analystNote: string;
}

export interface RivalLeaderInnerCircleMember {
  title: string;
  role: string;
  influence: string;
  disposition: string;
  knownView: string;
}

export interface RivalLeaderDefinition {
  scenarioId: string;
  adversaryProfileId: string;
  leader: {
    title: string;
    publicName: string;
    aliases: string[];
    age: string;
    background: string;
    psychologicalProfile: {
      summary: string;
      strengths: string[];
      vulnerabilities: string[];
      decisionStyle: string;
      riskAppetite: string;
      informationDiet: string;
    };
    motivations: {
      primary: string;
      secondary: string;
      redLine: string;
      goldenBridge: string;
    };
    pressurePoints: RivalLeaderPressurePoint[];
    intelFragments: Partial<Record<BeatPhase, string[]>>;
    publicStatements: RivalLeaderPublicStatement[];
    innerCircle: RivalLeaderInnerCircleMember[];
  };
}

export interface RivalLeaderReveal {
  title: string;
  publicName: string;
  age: string;
  background: string;
  psychologicalSummary: string;
  decisionStyle: string;
  riskAppetite: string;
  informationDiet: string;
  redLine: string;
  goldenBridge: string;
  pressurePoints: RivalLeaderPressurePoint[];
  publicStatements: RivalLeaderPublicStatement[];
  innerCircle: RivalLeaderInnerCircleMember[];
}

export interface CompressedStateSummary {
  roleLine: string;
  turnCounter: string;
  meterSnapshot: Record<MeterKey, number>;
  dominantPressure: string;
  lastActionPair: string;
  activeBeatId: string;
  narrativeTokens: string[];
  adversaryPosture: string;
}

export interface EpisodeMeterHistoryPoint {
  window: number;
  meters: MeterState;
}

export interface InterpretedAction {
  actionId: string;
  confidence: number;
  modifiers: Partial<MeterState>;
  narrativeGloss: string;
}

export interface ChatMessage {
  id: string;
  role: 'player' | 'system' | 'advisor';
  content: string;
  timestamp: number;
  advisorId?: string;
  turnNumber: number;
}

export interface EpisodeView {
  episodeId: string;
  scenarioId: string;
  status: 'active' | 'completed';
  turn: number;
  maxTurns: number;
  meters: MeterState;
  meterLabels: Record<MeterKey, string>;
  currentBeatId: string;
  beatHistory: string[];
  timerMode: TimerMode;
  extendTimerUsesRemaining: number;
  activeCountdown: ActiveCountdown | null;
  turnDebrief: TurnDebrief | null;
  visibleRanges: Record<MeterKey, MeterRange>;
  intelQuality: IntelQualityState;
  meterHistory: EpisodeMeterHistoryPoint[];
  briefing: NarrativeBundle;
  imageAsset: ImageAsset | null;
  offeredActions: ActionDefinition[];
  recentTurn: TurnHistoryEntry | null;
  outcome: OutcomeCategory | null;
}

export interface BootstrapPayload {
  scenarios: ScenarioDefinition[];
  adversaryProfiles: AdversaryProfile[];
  actions: ActionDefinition[];
  images: ImageAsset[];
  narrativeCandidates: NarrativeCandidatesPack;
  intelFragments: IntelFragment[];
  newsWire: NewsWireArticle[];
  actionNarratives: ActionNarrativeDefinition[];
  cinematics: CinematicsDefinition[];
  scenarioWorld: ScenarioWorldDefinition[];
  advisorDossiers: AdvisorDossier[];
  rivalLeaders: RivalLeaderDefinition[];
}

export interface StartEpisodeRequest {
  profileId: string;
  scenarioId: string;
  seed?: string;
  timerMode?: TimerMode;
}

export interface SubmitActionRequest {
  expectedTurn: number;
  actionId: string;
  variantId?: string | null;
  customLabel?: string | null;
  interpretationRationale?: string | null;
}

export interface InterpretCommandRequest {
  expectedTurn: number;
  commandText: string;
}

export type InterpretDecision = 'execute' | 'review' | 'reject';

export interface InterpretCommandSuggestion {
  actionId: string;
  actionName: string;
  variantId?: string | null;
  variantLabel?: string | null;
}

export interface InterpretCommandResponse {
  stale: boolean;
  episode: EpisodeView;
  confidence: number;
  decision: InterpretDecision;
  interpretedActionId: string | null;
  interpretedActionName: string | null;
  variantId: string | null;
  variantLabel: string | null;
  customLabel: string | null;
  interpretationRationale: string | null;
  narrativeEmphasis: string | null;
  message: string;
  suggestions: InterpretCommandSuggestion[];
}

export interface ResolveInactionRequest {
  expectedTurn: number;
  source: 'timeout' | 'explicit';
}

export interface ExtendCountdownRequest {
  expectedTurn: number;
}

export interface ProfileResponse {
  profileId: string;
  codename: string;
}
