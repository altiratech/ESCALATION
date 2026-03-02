import type {
  BootstrapPayload,
  EpisodeView,
  ExtendCountdownRequest,
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
