interface Point {
  turn: number;
  escalationIndex: number;
  allianceTrust: number;
  economicStability: number;
}

interface TimelineChartProps {
  data: Point[];
}

const width = 660;
const height = 240;
const padding = 32;

const toPath = (values: number[], maxTurn: number): string => {
  if (values.length === 0) {
    return '';
  }

  return values
    .map((value, index) => {
      const x = padding + (index / Math.max(1, maxTurn - 1)) * (width - padding * 2);
      const y = padding + ((100 - value) / 100) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

export const TimelineChart = ({ data }: TimelineChartProps) => {
  if (data.length === 0) {
    return <div className="text-sm text-textMuted">No timeline data.</div>;
  }

  const maxTurn = data[data.length - 1]?.turn ?? data.length;
  const escalationPath = toPath(data.map((point) => point.escalationIndex), maxTurn);
  const alliancePath = toPath(data.map((point) => point.allianceTrust), maxTurn);
  const economyPath = toPath(data.map((point) => point.economicStability), maxTurn);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[640px]">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padding + ((100 - tick) / 100) * (height - padding * 2);
          return (
            <g key={tick}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#2d3b49" strokeWidth="1" />
              <text x={8} y={y + 4} fill="#9ca7b3" fontSize="10">{tick}</text>
            </g>
          );
        })}

        <path d={escalationPath} stroke="#cc7f49" strokeWidth="2.3" fill="none" />
        <path d={alliancePath} stroke="#6aa285" strokeWidth="2.3" fill="none" />
        <path d={economyPath} stroke="#c9a86a" strokeWidth="2.3" fill="none" />

        {data.map((point, index) => {
          const x = padding + (index / Math.max(1, maxTurn - 1)) * (width - padding * 2);
          return (
            <text key={point.turn} x={x - 4} y={height - 10} fill="#9ca7b3" fontSize="10">
              {point.turn}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-textMuted">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-warning" /> Escalation Index</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-positive" /> Alliance Trust</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-accent" /> Economic Stability</span>
      </div>
    </div>
  );
};
