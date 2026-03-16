import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Flashpoint render failure', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6">
          <section className="card p-6">
            <p className="label">Live Scenario Unavailable</p>
            <h1 className="mt-3 font-display text-2xl text-textMain">The scenario view hit an unexpected error.</h1>
            <p className="mt-3 text-sm leading-relaxed text-textMuted">
              We kept the failure contained instead of dropping you onto a blank page. Reload the scenario to recover the latest state.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-accent transition hover:bg-accent/20"
                onClick={this.handleReload}
              >
                Reload Scenario
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
