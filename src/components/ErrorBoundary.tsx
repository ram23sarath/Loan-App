import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((error?: Error) => React.ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  declare state: ErrorBoundaryState;
  declare props: Readonly<ErrorBoundaryProps>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console
    console.error("ErrorBoundary caught an error:", error, info);

    // Report to native mobile wrapper if running in native app
    if (typeof window !== "undefined" && window.isNativeApp?.()) {
      console.log(
        "[ErrorBoundary] Reporting component crash to native wrapper",
      );
      window.NativeBridge?.reportError(
        error.message,
        error.stack,
        info.componentStack,
      );
    }
  }

  render() {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;

    if (hasError) {
      if (fallback) {
        return <>{typeof fallback === "function" ? fallback(error) : fallback}</>;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
          <div className="w-full max-w-xl rounded-2xl border border-red-200/20 bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-red-500/20">
            <p className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-700 dark:bg-red-500/15 dark:text-red-300">
              Application error
            </p>
            <p className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
              Something went wrong while loading the app.
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Open the browser console for the stack trace, then reload the page.
            </p>
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              {error?.message || "Unknown startup error"}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
