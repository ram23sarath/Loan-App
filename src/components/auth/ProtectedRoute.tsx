import React from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import LoadingSpinner from '../ui/LoadingSpinner';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

/**
 * Check if running inside native app wrapper
 * The native app sets 'ReactNativeWebView' on the window object
 */
const isInNativeWrapper = (): boolean => {
  return typeof window !== 'undefined' && 
    (typeof (window as any).ReactNativeWebView !== 'undefined' ||
     navigator.userAgent.includes('LoanAppMobile'));
};

/**
 * ProtectedRoute - Only blocks during auth verification, NOT during data loading
 * 
 * This allows the UI to render immediately after auth is confirmed, while data
 * loads in the background. Users see cached data or skeleton states instead of
 * a full-screen loading spinner.
 * 
 * When running inside the native app wrapper, we skip the loading spinner
 * entirely because the native app already shows its own loading screen.
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { session, isAuthChecking, isRefreshing } = useData();

  // Only block during initial auth check, not during data loading
  // Skip spinner when in native wrapper to avoid double loading screens
  if (isAuthChecking) {
    // If in native app, don't show web spinner (native has its own)
    if (isInNativeWrapper()) {
      return null; // Render nothing, native loading screen is already visible
    }
    return <LoadingSpinner />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Show subtle refresh indicator when data is loading/refreshing
  // The main content remains fully interactive
  return (
    <>
      {children}
      {isRefreshing && (
        <div 
          style={{
            position: 'fixed',
            top: 12,
            right: 12,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(79, 70, 229, 0.2)',
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 50 50"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="#4F46E5"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
            />
          </svg>
          <span style={{ fontSize: 12, color: '#4F46E5', fontWeight: 500 }}>
            Syncing...
          </span>
          <style>{`
            @keyframes spin {
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </>
  );
};

export default ProtectedRoute;
