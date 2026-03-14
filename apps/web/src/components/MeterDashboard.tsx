import type { EpisodeMeterHistoryPoint, MeterKey, MeterRange, MeterState } from '@wargames/shared-types';

interface MeterDashboardProps {
  meters: MeterState;
  previousMeters?: MeterState | undefined;
  visibleRanges: Record<MeterKey, MeterRange>;
  meterHistory: EpisodeMeterHistoryPoint[];
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

const isPositiveDirection = (key: MeterKey, delta: number): boolean => {
  if (Math.abs(delta) < 1) {
    return false;
  }
  if (key === 'escalationIndex') {
    return delta < 0;
  }
  return delta > 0;
};

const semanticTrendColor = (key: MeterKey, delta: number): string => {
  if (Math.abs(delta) < 1) {
    return '#8fa3b3';
  }
  return isPositiveDirection(key, delta) ? '#72d48f' : '#ff8a5c';
};

const semanticTrendTextClass = (key: MeterKey, delta: number): string => {
  if (Math.abs(delta) < 1) {
    return 'text-textMuted';
  }
  return isPositiveDirection(key, delta) ? 'text-positive' : 'text-red-400';
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

const buildSparklinePoints = (values: number[], width: number, height: number, padding = 6): string => {
  if (values.length === 0) {
    return '';
  }

  return values
    .map((value, index) => {
      const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
      const y = padding + ((100 - value) / 100) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
};

const Sparkline = ({ values, color }: { values: number[]; color: string }) => {
  const width = 220;
  const height = 72;
  const padding = 6;
  const points = buildSparklinePoints(values, width, height);
  const finalValue = values[values.length - 1] ?? 0;
  const finalIndex = Math.max(0, values.length - 1);
  const finalX = padding + (finalIndex / Math.max(1, values.length - 1)) * (width - padding * 2);
  const finalY = padding + ((100 - finalValue) / 100) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[4.5rem] w-full">
      {[20, 50, 80].map((tick) => {
        const y = 6 + ((100 - tick) / 100) * (height - 12);
        return <line key={tick} x1="6" x2={width - 6} y1={y} y2={y} stroke="rgba(64, 78, 90, 0.6)" strokeWidth="1" />;
      })}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={finalX} cy={finalY} r="3.5" fill={color} />
    </svg>
  );
};

export const MeterDashboard = ({ meters, previousMeters, visibleRanges, meterHistory, embedded = false }: MeterDashboardProps) => {
  const rootClassName = embedded ? '' : 'console-panel p-3';

  return (
    <section className={rootClassName}>
      <div className="flex items-center justify-between gap-3">
        <p className="label">Operational Indicators</p>
        <span className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">Window trend</span>
      </div>
      <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">{interpretIndicatorState(meters)}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {orderedMeterKeys.map((key) => {
          const value = meters[key];
          const previous = previousMeters?.[key] ?? value;
          const delta = value - previous;
          const range = visibleRanges[key];
          const historyValues = meterHistory.map((entry) => entry.meters[key]);
          const color = semanticTrendColor(key, delta);
          const deltaToneClass = semanticTrendTextClass(key, delta);

          return (
            <div key={key} className={`console-subpanel ${embedded ? 'px-2.5 py-2' : 'px-2.5 py-2.5'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">{meterLabels[key]}</span>
                <span className="font-display text-[0.95rem] text-textMain">
                  {Math.round(value)}
                  <span className={`ml-1.5 text-[0.58rem] ${deltaToneClass}`}>
                    {trendArrow(delta)} {Math.abs(Math.round(delta))}
                  </span>
                </span>
              </div>

              <div className="mt-2 rounded-sm border border-borderTone/60 bg-surface/45 px-1 py-1">
                <Sparkline values={historyValues} color={color} />
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.58rem] uppercase tracking-[0.12em] text-textMuted">
                <span>Intel: {range.low}-{range.high}</span>
                <span>Conf. {range.confidence}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
