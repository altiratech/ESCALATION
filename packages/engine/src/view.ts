import type {
  ActionDefinition,
  EpisodeView,
  GameState,
  ImageAsset,
  MeterRange
} from '@wargames/shared-types';

import { SeededRng } from './rng';
import { projectVisibleRanges } from './intel';

export const toEpisodeView = (
  state: GameState,
  actionMap: Map<string, ActionDefinition>,
  imageMap: Map<string, ImageAsset>,
  nowMs?: number
): EpisodeView => {
  const previewRng = new SeededRng(state.rngState ^ 0x9e3779b9);
  const visibleRanges: Record<keyof typeof state.meters, MeterRange> =
    state.history[state.history.length - 1]?.visibleRanges ?? projectVisibleRanges(state, previewRng);

  const recentTurn = state.history[state.history.length - 1] ?? null;
  const selectedImageId = recentTurn?.selectedImageId ?? null;
  const activeCountdown = state.activeCountdown
    ? (() => {
        const referenceNow = nowMs ?? (state.activeCountdown.expiresAt - state.activeCountdown.secondsRemaining * 1000);
        return {
          ...state.activeCountdown,
          secondsRemaining: Math.max(0, Math.ceil((state.activeCountdown.expiresAt - referenceNow) / 1000))
        };
      })()
    : null;

  return {
    episodeId: state.id,
    scenarioId: state.scenarioId,
    status: state.status,
    turn: state.turn,
    maxTurns: state.maxTurns,
    meters: state.meters,
    meterLabels: state.meterLabels,
    currentBeatId: state.currentBeatId,
    beatHistory: state.beatHistory,
    timerMode: state.timerMode,
    extendTimerUsesRemaining: state.extendTimerUsesRemaining,
    activeCountdown,
    turnDebrief: state.turnDebrief,
    visibleRanges,
    intelQuality: state.intelQuality,
    briefing: recentTurn?.narrative ?? state.openingBriefing,
    imageAsset: selectedImageId ? imageMap.get(selectedImageId) ?? null : null,
    offeredActions: state.offeredActionIds.map((id) => actionMap.get(id)).filter((entry): entry is ActionDefinition => Boolean(entry)),
    recentTurn,
    outcome: state.outcome
  };
};
