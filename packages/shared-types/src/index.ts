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

export type Visibility = 'public' | 'secret' | 'semi-public';
export type ActorType = 'player' | 'rival';

export type MeterState = Record<MeterKey, number>;

export interface LatentState {
  globalLegitimacy: number;
  rivalDomesticPressure: number;
  playerDomesticApproval: number;
  vulnerabilityFlags: string[];
}

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
  latentDeltas?: Partial<Omit<LatentState, 'vulnerabilityFlags'>>;
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
  latentDeltas?: Partial<Omit<LatentState, 'vulnerabilityFlags'>>;
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

export interface ActionDefinition {
  id: string;
  actor: ActorType;
  name: string;
  summary: string;
  visibility: Visibility;
  tags: string[];
  immediateMeterDeltas: Partial<MeterState>;
  immediateLatentDeltas?: Partial<Omit<LatentState, 'vulnerabilityFlags'>>;
  sideEffects: SideEffectDefinition[];
  delayedEffects: Array<{
    delayTurns: number;
    chance: number;
    meterDeltas: Partial<MeterState>;
    latentDeltas?: Partial<Omit<LatentState, 'vulnerabilityFlags'>>;
    description: string;
  }>;
  intelQualityBoost?: number;
  signal: ActionSignalProfile;
  minTurn?: number;
  maxTurn?: number;
}

export interface RivalArchetype {
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

export interface BeatNode {
  id: string;
  phase: BeatPhase;
  sceneFragments: string[];
  advisorLines: Record<string, string[]>;
  headlines: string[];
  memoLine: string | null;
  tickerLine: string | null;
  imageHints: string[];
  branches: BranchCondition[];
  terminalOutcome: OutcomeCategory | null;
  meterOverrides: Partial<MeterState> | null;
  advisorUnlock: string | null;
  musicCue: string | null;
  decisionWindow: BeatDecisionWindow | null;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  briefing: string;
  role: string;
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
  domain: 'economy' | 'energy' | 'unrest' | 'military' | 'cyber' | 'diplomacy';
  severity: 0 | 1 | 2 | 3 | 4;
  environment: 'generic' | 'coastal' | 'arctic' | 'dense_city' | 'industrial';
  perspective: 'satellite' | 'street' | 'news_frame' | 'memo' | 'ticker';
  tags: string[];
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
  pivotalDecision: {
    turn: number;
    actionId: string;
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

export interface FullCausalityReport {
  outcomeNarrative: OutcomeNarrativeReveal;
  hiddenDeltas: HiddenMeterDelta[];
  adversaryLogicSummary: string;
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
  briefing: NarrativeBundle;
  imageAsset: ImageAsset | null;
  offeredActions: ActionDefinition[];
  recentTurn: TurnHistoryEntry | null;
  outcome: OutcomeCategory | null;
}

export interface BootstrapPayload {
  scenarios: ScenarioDefinition[];
  archetypes: RivalArchetype[];
  actions: ActionDefinition[];
  narrativeCandidates: NarrativeCandidatesPack;
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
