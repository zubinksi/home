import { Component, type ReactNode } from 'react';

/**
 * Keeps one broken view from blanking the whole page: shows the error in
 * place instead. `resetKey` clears it when the user picks another view.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: unknown }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[view error]', error);
  }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="view-error">
        <div className="label">THIS VIEW HIT AN ERROR</div>
        <p>{this.state.error.message || String(this.state.error)}</p>
        <button onClick={() => location.reload()}>RELOAD THE PAGE</button>
      </div>
    );
  }
}
