import { useState } from 'react';

import type { IntelQualityState, MeterKey, MeterRange } from '@wargames/shared-types';

interface IntelPanelProps {
  ranges: Record<MeterKey, MeterRange>;
  intelQuality: IntelQualityState;
  turn: number;
}

const labels: Record<MeterKey, string> = {
  economicStability: 'Economic',
  energySecurity: 'Energy',
  domesticCohesion: 'Domestic',
  militaryReadiness: 'Military',
  allianceTrust: 'Alliance',
  escalationIndex: 'Escalation'
};

export const IntelPanel = ({ ranges, intelQuality, turn }: IntelPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="console-panel p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="label">Confidence Grid</p>
          <p className="mt-1 text-[0.66rem] text-textMuted">
            {intelQuality.expiresAtTurn && intelQuality.expiresAtTurn >= turn
              ? `Enhanced feed until T${intelQuality.expiresAtTurn}`
              : 'Baseline collection'}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-borderTone/80 px-2 py-1 text-[0.6rem] uppercase tracking-[0.12em] text-textMuted transition hover:border-accent hover:text-textMain"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? 'Collapse' : 'Open'}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {(Object.keys(ranges) as MeterKey[]).map((key) => (
            <div key={key} className="console-subpanel px-2.5 py-2">
              <p className="text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">{labels[key]}</p>
              <p className="mt-1 font-display text-sm text-textMain">{ranges[key].low} - {ranges[key].high}</p>
              <p className="text-[0.6rem] text-textMuted">Confidence {ranges[key].confidence}%</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[0.68rem] leading-relaxed text-textMuted">
          Secondary analysis surface. Open the grid if you need the current confidence bands behind each visible meter.
        </p>
      )}
    </section>
  );
};
