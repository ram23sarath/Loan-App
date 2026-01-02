import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to an error reporting service if desired
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;

    if (hasError) {
      if (fallback) return <>{fallback}</>;
      return (
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">
          <p className="font-semibold mb-1">Something went wrong.</p>
          <p className="text-sm">{error?.message || 'Please try again later.'}</p>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
