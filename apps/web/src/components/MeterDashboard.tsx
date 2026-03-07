import type { MeterKey, MeterRange, MeterState } from '@wargames/shared-types';

interface MeterDashboardProps {
  meters: MeterState;
  previousMeters?: MeterState | undefined;
  visibleRanges: Record<MeterKey, MeterRange>;
}

const meterLabels: Record<MeterKey, string> = {
  economicStability: 'Economic Stability',
  energySecurity: 'Energy Security',
  domesticCohesion: 'Domestic Cohesion',
  militaryReadiness: 'Military Readiness',
  allianceTrust: 'Alliance Trust',
  escalationIndex: 'Escalation Index'
};

const barColor = (key: MeterKey, value: number): string => {
  if (key === 'escalationIndex') {
    if (value > 75) {
      return 'bg-warning';
    }
    if (value > 55) {
      return 'bg-accent';
    }
    return 'bg-positive';
  }

  if (value >= 65) {
    return 'bg-positive';
  }
  if (value >= 40) {
    return 'bg-accent';
  }
  return 'bg-warning';
};

const trendArrow = (delta: number): string => {
  if (Math.abs(delta) < 1) {
    return '•';
  }
  return delta > 0 ? '▲' : '▼';
};

export const MeterDashboard = ({ meters, previousMeters, visibleRanges }: MeterDashboardProps) => {
  return (
    <section className="console-panel p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="label">System Telemetry</p>
        <span className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">Live</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(meters) as MeterKey[]).map((key) => {
          const value = meters[key];
          const previous = previousMeters?.[key] ?? value;
          const delta = value - previous;
          const range = visibleRanges[key];

          return (
            <div key={key} className="console-subpanel px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">{meterLabels[key]}</span>
                <span className="font-display text-[0.95rem] text-textMain">
                  {Math.round(value)}
                  <span className="ml-1.5 text-[0.58rem] text-textMuted">
                    {trendArrow(delta)} {Math.abs(Math.round(delta))}
                  </span>
                </span>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                <div
                  className={`h-full ${barColor(key, value)}`}
                  style={{ width: `${value}%` }}
                />
              </div>

              <p className="mt-1.5 text-[0.6rem] uppercase tracking-[0.12em] text-textMuted">
                Intel: {range.low}-{range.high} (conf. {range.confidence})
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
