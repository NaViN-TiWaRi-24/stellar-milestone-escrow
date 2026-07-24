import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureOperationalError } from "../lib/telemetry";
import "./AppErrorBoundary.css";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    captureOperationalError("react_render", error);
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="app-error-fallback" role="alert">
        <div>
          <p className="eyebrow">Something went wrong</p>
          <h1>The escrow dashboard could not be displayed.</h1>
          <p>
            Your wallet remains under your control. Try rendering the app again,
            or reload the page if the problem continues.
          </p>
          <div className="app-error-actions">
            <button type="button" onClick={this.retry}>
              Try again
            </button>
            <button type="button" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      </main>
    );
  }
}
