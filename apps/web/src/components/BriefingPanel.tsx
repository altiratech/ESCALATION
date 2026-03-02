import type { ImageAsset, NarrativeBundle, TurnDebrief } from '@wargames/shared-types';

interface BriefingPanelProps {
  turn: number;
  maxTurns: number;
  briefing: NarrativeBundle;
  imageAsset: ImageAsset | null;
  turnDebrief: TurnDebrief | null;
}

const sourceLabel: Record<TurnDebrief['lines'][number]['tag'], string> = {
  PlayerAction: '[Player Action]',
  SecondaryEffect: '[Secondary Effect]',
  SystemEvent: '[System Event]'
};

export const BriefingPanel = ({ turn, maxTurns, briefing, imageAsset, turnDebrief }: BriefingPanelProps) => {
  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <p className="label">Briefing</p>
        <p className="text-xs text-textMuted">Turn {turn} / {maxTurns}</p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-textMain">{briefing.briefingParagraph}</p>

      <div className="mt-4 space-y-2">
        {briefing.headlines.map((headline) => (
          <div key={headline} className="rounded-sm border border-borderTone bg-panelRaised px-3 py-2 text-[0.8rem] text-textMain">
            {headline}
          </div>
        ))}
      </div>

      {imageAsset ? (
        <figure className="relative mt-5 overflow-hidden rounded-md border border-borderTone">
          <img
            src={imageAsset.path}
            alt={imageAsset.tags.join(', ')}
            className="h-56 w-full object-cover"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/70 to-transparent" />
          <div className="absolute left-3 top-3 rounded-sm border border-warning/60 bg-surface/80 px-2 py-1 text-[0.65rem] uppercase tracking-[0.15em] text-warning">
            Breaking News
          </div>
          {briefing.memoLine ? (
            <div className="absolute bottom-2 left-2 right-2 rounded-sm border border-borderTone bg-surface/80 px-2 py-1 text-[0.66rem] text-textMuted">
              {briefing.memoLine}
            </div>
          ) : null}
        </figure>
      ) : null}

      {briefing.tickerLine ? (
        <div className="mt-4 rounded-sm border border-borderTone bg-panelRaised px-2 py-1 text-[0.72rem] text-accent">
          {briefing.tickerLine}
        </div>
      ) : null}

      {turnDebrief && turnDebrief.lines.length > 0 ? (
        <section className="mt-4 rounded-md border border-borderTone bg-panelRaised/70 p-3">
          <p className="label">Turn Debrief</p>
          <div className="mt-2 space-y-2 text-[0.78rem] leading-relaxed text-textMuted">
            {turnDebrief.lines.map((entry, index) => (
              <p key={`${entry.tag}-${index}`}>
                <span className="text-accent">{sourceLabel[entry.tag]}</span> {entry.text}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
};
