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
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <p className="label">Intel Window</p>
        <p className="text-[0.68rem] text-textMuted">
          {intelQuality.expiresAtTurn && intelQuality.expiresAtTurn >= turn
            ? `Enhanced feed until T${intelQuality.expiresAtTurn}`
            : 'Baseline collection'}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {(Object.keys(ranges) as MeterKey[]).map((key) => (
          <div key={key} className="rounded-sm border border-borderTone bg-panelRaised px-2 py-2">
            <p className="text-textMuted">{labels[key]}</p>
            <p className="font-display text-sm text-textMain">{ranges[key].low} - {ranges[key].high}</p>
            <p className="text-[0.63rem] text-textMuted">Confidence {ranges[key].confidence}%</p>
          </div>
        ))}
      </div>
    </section>
  );
};
