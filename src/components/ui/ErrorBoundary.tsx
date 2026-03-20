import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
          <div className="max-w-md p-6 text-center">
            <h1 className="text-xl font-semibold leading-tight text-slate-950 dark:text-slate-50 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm font-normal leading-normal text-slate-500 dark:text-slate-400">
              Restart the app to continue. If the problem persists, check the audit log.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
