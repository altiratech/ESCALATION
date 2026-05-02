import type {
  BootstrapPayload,
  EpisodeView,
  ExtendCountdownRequest,
  InterpretCommandRequest,
  InterpretCommandResponse,
  PostGameReport,
  ProfileResponse,
  ResolveInactionRequest,
  StartEpisodeRequest,
  SubmitActionRequest,
  TurnResolution
} from '@wargames/shared-types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

const apiUrl = (path: string): string => `${API_BASE}${path}`;

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload?.message === 'string' ? payload.message : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

export const createProfile = async (codename: string): Promise<ProfileResponse> => {
  const response = await fetch(apiUrl('/api/profiles'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ codename })
  });

  return parseJson<ProfileResponse>(response);
};

export const bootstrapReference = async (): Promise<BootstrapPayload> => {
  const response = await fetch(apiUrl('/api/reference/bootstrap'));
  return parseJson<BootstrapPayload>(response);
};

export const startEpisode = async (payload: StartEpisodeRequest): Promise<EpisodeView> => {
  const response = await fetch(apiUrl('/api/episodes/start'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseJson<EpisodeView>(response);
};

export const fetchEpisode = async (episodeId: string): Promise<EpisodeView> => {
  const response = await fetch(apiUrl(`/api/episodes/${episodeId}`));
  return parseJson<EpisodeView>(response);
};

export interface ActionSubmitResponse {
  stale: boolean;
  episode: EpisodeView;
  resolution?: TurnResolution;
}

export const submitAction = async (
  episodeId: string,
  payload: SubmitActionRequest
): Promise<ActionSubmitResponse> => {
  const response = await fetch(apiUrl(`/api/episodes/${episodeId}/actions`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseJson<ActionSubmitResponse>(response);
};

export const submitInaction = async (
  episodeId: string,
  payload: ResolveInactionRequest
): Promise<ActionSubmitResponse> => {
  const response = await fetch(apiUrl(`/api/episodes/${episodeId}/inaction`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseJson<ActionSubmitResponse>(response);
};

export const interpretCommand = async (
  episodeId: string,
  payload: InterpretCommandRequest
): Promise<InterpretCommandResponse> => {
  const response = await fetch(apiUrl(`/api/episodes/${episodeId}/interpret`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseJson<InterpretCommandResponse>(response);
};

export interface CountdownExtendResponse {
  stale: boolean;
  episode: EpisodeView;
}

export const extendCountdown = async (
  episodeId: string,
  payload: ExtendCountdownRequest
): Promise<CountdownExtendResponse> => {
  const response = await fetch(apiUrl(`/api/episodes/${episodeId}/countdown/extend`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseJson<CountdownExtendResponse>(response);
};

export const fetchReport = async (episodeId: string): Promise<PostGameReport> => {
  const response = await fetch(apiUrl(`/api/episodes/${episodeId}/report`));
  return parseJson<PostGameReport>(response);
};

export interface TelemetryPayload {
  episodeId?: string | null;
  scenarioId?: string | null;
  eventName: 'session_start' | 'decision_made' | 'game_completed' | 'game_abandoned' | 'client_error';
  turnNumber?: number | null;
  elapsedMs?: number | null;
  metadata?: Record<string, unknown>;
}

export const sendTelemetry = (payload: TelemetryPayload): void => {
  const body = JSON.stringify(payload);
  const url = apiUrl('/api/telemetry');

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon(url, blob)) {
      return;
    }
  }

  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body,
    keepalive: true
  }).catch(() => {
    // Telemetry must never interrupt gameplay.
  });
};
