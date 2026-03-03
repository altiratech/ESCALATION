import { useEffect, useMemo, useRef, useState } from 'react';

import type { ActionDefinition } from '@wargames/shared-types';

interface CommandInputProps {
  turn: number;
  actions: ActionDefinition[];
  disabled: boolean;
  onSubmitCommand: (commandText: string) => Promise<string>;
  onSelectAction: (actionId: string) => Promise<void>;
}

interface CommandLine {
  id: number;
  role: 'player' | 'system';
  text: string;
}

const normalizeText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const CommandInput = ({ turn, actions, disabled, onSubmitCommand, onSelectAction }: CommandInputProps) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [lines, setLines] = useState<CommandLine[]>([]);
  const nextLineIdRef = useRef(1);
  const lastTurnRef = useRef<number | null>(null);

  const appendLine = (role: CommandLine['role'], text: string): void => {
    if (!text.trim()) {
      return;
    }

    setLines((current) => {
      const next = [...current, { id: nextLineIdRef.current++, role, text: text.trim() }];
      return next.slice(-8);
    });
  };

  useEffect(() => {
    if (lastTurnRef.current === turn) {
      return;
    }
    lastTurnRef.current = turn;
    appendLine('system', `Turn ${turn}: command channel ready.`);
  }, [turn]);

  const quickActions = useMemo(() => actions.slice(0, 6), [actions]);
  const suggestedActions = useMemo(() => {
    const query = normalizeText(draft);
    if (query.length < 2) {
      return quickActions.slice(0, 3);
    }

    return actions
      .filter((entry) => normalizeText(entry.name).includes(query))
      .slice(0, 3);
  }, [actions, draft, quickActions]);

  const submit = async (): Promise<void> => {
    const commandText = draft.trim();
    if (!commandText || sending || disabled) {
      return;
    }

    appendLine('player', commandText);
    setSending(true);
    setDraft('');

    try {
      const response = await onSubmitCommand(commandText);
      appendLine('system', response);
    } catch (error) {
      appendLine('system', error instanceof Error ? error.message : 'Command dispatch failed.');
    } finally {
      setSending(false);
    }
  };

  const quickDispatch = async (action: ActionDefinition): Promise<void> => {
    if (sending || disabled) {
      return;
    }

    appendLine('player', `Execute ${action.name}`);
    setSending(true);

    try {
      await onSelectAction(action.id);
      appendLine('system', `Quick action request sent: ${action.name}.`);
    } catch (error) {
      appendLine('system', error instanceof Error ? error.message : 'Quick action dispatch failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="card border-accent/40 bg-surface/95 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label">Command Channel</p>
        <span className="text-[0.62rem] uppercase tracking-[0.12em] text-textMuted">
          {disabled || sending ? 'Processing' : 'Open'}
        </span>
      </div>

      {lines.length > 0 ? (
        <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-md border border-borderTone/70 bg-panelRaised/45 p-2 text-[0.7rem]">
          {lines.map((line) => (
            <p key={line.id} className={line.role === 'player' ? 'text-textMain' : 'text-textMuted'}>
              <span className="mr-1 text-[0.6rem] uppercase tracking-[0.1em] text-accent">{line.role === 'player' ? 'You' : 'System'}</span>
              {line.text}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(suggestedActions.length > 0 ? suggestedActions : quickActions.slice(0, 3)).map((action) => (
          <button
            key={action.id}
            type="button"
            className="rounded-md border border-borderTone px-2 py-1 text-[0.6rem] uppercase tracking-[0.09em] text-textMuted transition hover:border-accent hover:text-textMain disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => {
              void quickDispatch(action);
            }}
            disabled={disabled || sending}
          >
            {action.name}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Type an order (e.g., action Public Warning)"
          rows={2}
          className="w-full rounded-md border border-borderTone bg-panelRaised/75 px-3 py-2 text-sm text-textMain focus:border-accent focus:outline-none"
          disabled={disabled || sending}
        />
        <button
          type="button"
          className="rounded-md border border-accent bg-accent/15 px-3 py-2 text-[0.64rem] font-semibold uppercase tracking-[0.11em] text-accent transition hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => {
            void submit();
          }}
          disabled={disabled || sending || !draft.trim()}
        >
          Send
        </button>
      </div>

      <p className="mt-2 text-[0.66rem] text-textMuted">
        Free-form interpretation is currently constrained to action matching. Full interpret-mode routing follows in the next milestone.
      </p>
    </section>
  );
};
