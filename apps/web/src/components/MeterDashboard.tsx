import type { MeterKey, MeterRange, MeterState } from '@wargames/shared-types';

interface MeterDashboardProps {
  meters: MeterState;
  previousMeters?: MeterState | undefined;
  visibleRanges: Record<MeterKey, MeterRange>;
  embedded?: boolean;
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

const orderedMeterKeys: MeterKey[] = [
  'escalationIndex',
  'allianceTrust',
  'militaryReadiness',
  'economicStability',
  'energySecurity',
  'domesticCohesion'
];

const interpretIndicatorState = (meters: MeterState): string => {
  const escalation =
    meters.escalationIndex >= 75 ? 'Escalation pressure is critical.' : meters.escalationIndex >= 55 ? 'Escalation pressure is elevated.' : 'Escalation pressure is managed.';
  const alliance =
    meters.allianceTrust >= 68 ? 'Allies remain aligned.' : meters.allianceTrust >= 45 ? 'Alliance discipline is under strain.' : 'Alliance cohesion is at risk.';
  const marketComposite = Math.round((meters.economicStability + meters.energySecurity) / 2);
  const markets =
    marketComposite >= 65 ? 'Economic stress is contained for now.' : marketComposite >= 45 ? 'Markets are repricing heightened risk.' : 'Commercial stress is acute.';

  return `${escalation} ${alliance} ${markets}`;
};

export const MeterDashboard = ({ meters, previousMeters, visibleRanges, embedded = false }: MeterDashboardProps) => {
  const rootClassName = embedded ? '' : 'console-panel p-3';

  return (
    <section className={rootClassName}>
      <div className="flex items-center justify-between gap-3">
        <p className="label">Operational Indicators</p>
        <span className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">Live</span>
      </div>
      <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">{interpretIndicatorState(meters)}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {orderedMeterKeys.map((key) => {
          const value = meters[key];
          const previous = previousMeters?.[key] ?? value;
          const delta = value - previous;
          const range = visibleRanges[key];

          return (
            <div key={key} className={`console-subpanel ${embedded ? 'px-2.5 py-2' : 'px-2.5 py-2.5'}`}>
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

              <p className="mt-1.5 text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
                Intel: {range.low}-{range.high} (conf. {range.confidence})
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
