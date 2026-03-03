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
    <section className="card flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="label">Mission Briefing</p>
          <h2 className="mt-2 font-display text-2xl text-textMain">Turn {turn} Situation</h2>
        </div>
        <p className="rounded-md border border-borderTone bg-panelRaised/70 px-2 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-textMuted">
          Turn {turn} / {maxTurns}
        </p>
      </div>

      <p className="mt-4 border-l-2 border-accent/70 pl-4 text-sm leading-relaxed text-textMain">{briefing.briefingParagraph}</p>

      <div className="mt-5">
        <p className="label">Incoming Signals</p>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {briefing.headlines.map((headline) => (
          <div key={headline} className="rounded-md border border-borderTone bg-panelRaised/75 px-3 py-2 text-[0.8rem] leading-relaxed text-textMain">
            {headline}
          </div>
        ))}
      </div>

      {imageAsset ? (
        <figure className="relative mt-5 overflow-hidden rounded-lg border border-borderTone">
          <img
            src={imageAsset.path}
            alt={imageAsset.tags.join(', ')}
            className="h-60 w-full object-cover"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/70 to-transparent" />
          <div className="absolute left-3 top-3 rounded-md border border-warning/60 bg-surface/85 px-2 py-1 text-[0.65rem] uppercase tracking-[0.15em] text-warning">
            Breaking News
          </div>
          {briefing.memoLine ? (
            <div className="absolute bottom-2 left-2 right-2 rounded-md border border-borderTone bg-surface/80 px-2 py-1 text-[0.66rem] text-textMuted">
              {briefing.memoLine}
            </div>
          ) : null}
        </figure>
      ) : null}

      {briefing.tickerLine ? (
        <div className="mt-4 rounded-md border border-accent/50 bg-panelRaised/80 px-2 py-1 text-[0.72rem] text-accent">
          {briefing.tickerLine}
        </div>
      ) : null}

      {turnDebrief && turnDebrief.lines.length > 0 ? (
        <section className="mt-5 rounded-lg border border-borderTone bg-panelRaised/60 p-3">
          <p className="label">Deterministic Debrief</p>
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
