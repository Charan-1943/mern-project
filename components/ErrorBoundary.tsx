import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("The preview workspace could not be rendered.", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="crash-card">
          <div className="eyebrow">Preview unavailable</div>
          <h1>This workspace ran into a rendering problem.</h1>
          <p>Try refreshing the page. Your saved assets and tags remain in this browser.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>Reload workspace</button>
        </main>
      );
    }
    return this.props.children;
  }
}
