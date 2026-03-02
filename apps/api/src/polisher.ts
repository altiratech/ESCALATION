import { MockTonePolisher, PassthroughPolisher, type NarrativePolisher } from '@wargames/engine';

import type { Env } from './db';

export const createPolisher = (env: Env): NarrativePolisher => {
  if (env.LLM_MODE === 'mock') {
    return new MockTonePolisher();
  }
  return new PassthroughPolisher();
};
