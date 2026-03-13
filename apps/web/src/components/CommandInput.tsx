import { useEffect, useRef, useState } from 'react';

import type { ActionDefinition } from '@wargames/shared-types';

interface CommandInputProps {
  turn: number;
  disabled: boolean;
  onSubmitCommand: (commandText: string) => Promise<CommandSubmitResult>;
  onSelectAction: (actionId: string) => Promise<void>;
}

interface CommandLine {
  id: number;
  role: 'player' | 'system';
  text: string;
}

export interface CommandSubmitResult {
  message: string;
  decision?: 'execute' | 'review' | 'reject';
  suggestions?: ActionDefinition[];
}

export const CommandInput = ({ turn, disabled, onSubmitCommand, onSelectAction }: CommandInputProps) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [lines, setLines] = useState<CommandLine[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<ActionDefinition[]>([]);
  const [isOpen, setIsOpen] = useState(false);
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
    setPendingSuggestions([]);
    appendLine('system', `Decision window ${turn}: custom response channel ready.`);
  }, [turn]);

  useEffect(() => {
    if (pendingSuggestions.length > 0 || lines.length > 1) {
      setIsOpen(true);
    }
  }, [lines.length, pendingSuggestions.length]);

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
      setPendingSuggestions(response.suggestions ?? []);
      appendLine('system', response.message);
      if (response.decision === 'review' && (response.suggestions?.length ?? 0) > 0) {
        appendLine('system', 'Clarify by selecting one of the suggested actions below.');
      }
    } catch (error) {
      setPendingSuggestions([]);
      appendLine('system', error instanceof Error ? error.message : 'Command dispatch failed.');
    } finally {
      setSending(false);
    }
  };

  const confirmSuggestedAction = async (action: ActionDefinition): Promise<void> => {
    if (sending || disabled) {
      return;
    }

    appendLine('player', `Select ${action.name}`);
    setSending(true);

    try {
      await onSelectAction(action.id);
      setPendingSuggestions([]);
      appendLine('system', `Selected: ${action.name}. Review it on the decision page and commit it when ready.`);
    } catch (error) {
      appendLine('system', error instanceof Error ? error.message : 'Suggested action selection failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="console-subpanel px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="label">Custom Response (Advanced)</p>
          <p className="mt-2 text-[0.72rem] leading-relaxed text-textMuted">
            Optional advanced input. Use this only if you want custom phrasing or help matching your intent to an available response.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-borderTone/80 px-2 py-1 text-[0.6rem] uppercase tracking-[0.12em] text-textMuted transition hover:border-accent hover:text-textMain"
          onClick={() => setIsOpen((current) => !current)}
        >
          {disabled || sending ? 'Processing' : isOpen ? 'Collapse' : 'Open'}
        </button>
      </div>

      {lines.length > 0 ? (
        <div className={`console-scroll mt-2 max-h-24 space-y-1 overflow-y-auto rounded-md border border-borderTone/70 bg-panelRaised/45 p-2 text-[0.68rem] ${isOpen ? '' : 'opacity-80'}`}>
          {lines.map((line) => (
            <p key={line.id} className={line.role === 'player' ? 'text-textMain' : 'text-textMuted'}>
              <span className="mr-1 text-[0.6rem] uppercase tracking-[0.1em] text-accent">{line.role === 'player' ? 'You' : 'System'}</span>
              {line.text}
            </p>
          ))}
        </div>
      ) : null}

      {!isOpen && pendingSuggestions.length === 0 ? (
        <p className="mt-2 text-[0.66rem] text-textMuted">
          The main workflow is response-based. Open this field only if you want help translating a custom instruction into a suggested response.
        </p>
      ) : null}

      {isOpen && pendingSuggestions.length > 0 ? (
        <div className="mt-2 rounded-md border border-accent/40 bg-accent/10 p-2">
          <p className="text-[0.62rem] uppercase tracking-[0.1em] text-accent">Review Suggested Match</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {pendingSuggestions.map((action) => (
              <button
                key={`confirm:${action.id}`}
                type="button"
                className="rounded-md border border-accent/60 px-2 py-1 text-[0.6rem] uppercase tracking-[0.09em] text-textMain transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => {
                  void confirmSuggestedAction(action);
                }}
                disabled={disabled || sending}
              >
                Select {action.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <>
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
          placeholder="Optional: describe the response you want to make"
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
        Typed instructions are translated into a suggested response. Review the selected response on this page before committing the decision window.
      </p>
        </>
      ) : null}
    </section>
  );
};
