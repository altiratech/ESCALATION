import type { NarrativeBundle } from '@wargames/shared-types';

export interface NarrativePolisher {
  polish(bundle: NarrativeBundle): Promise<NarrativeBundle>;
}

export class PassthroughPolisher implements NarrativePolisher {
  async polish(bundle: NarrativeBundle): Promise<NarrativeBundle> {
    return bundle;
  }
}

export class MockTonePolisher implements NarrativePolisher {
  async polish(bundle: NarrativeBundle): Promise<NarrativeBundle> {
    return {
      ...bundle,
      briefingParagraph: `${bundle.briefingParagraph} Command note: risk remains manageable only with disciplined signaling.`
    };
  }
}
