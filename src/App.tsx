import React, { Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { DataProvider } from "./context/DataContext";
import { ThemeProvider } from "./context/ThemeContext";
import Sidebar from "./components/Sidebar";
import ProfileHeader from "./components/ProfileHeader";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoadingSpinner from "./components/ui/LoadingSpinner";
import { useData } from "./context/DataContext";
import ErrorBoundary from "./components/ErrorBoundary";
import InactivityLogoutModal from "./components/modals/InactivityLogoutModal";
import { RouteReadySignal } from "./components/RouteReadySignal";

// Lazy load page components for better initial bundle size
const AddCustomerPage = React.lazy(
  () => import("./components/pages/AddCustomerPage"),
);
const AddRecordPage = React.lazy(
  () => import("./components/pages/AddRecordPage"),
);
const CustomerListPage = React.lazy(
  () => import("./components/pages/CustomerListPage"),
);
const CustomerDetailPageComponent = React.lazy(
  () => import("./components/pages/CustomerDetailPage"),
);
const LoanListPage = React.lazy(
  () => import("./components/pages/LoanListPage"),
);
const LoanDetailPage = React.lazy(
  () => import("./components/pages/LoanDetailPage"),
);
const LoanSeniorityPage = React.lazy(
  () => import("./components/pages/LoanSeniorityPage"),
);
const SubscriptionListPage = React.lazy(
  () => import("./components/pages/SubscriptionListPage"),
);
const SummaryPage = React.lazy(() => import("./components/pages/SummaryPage"));
const DataPage = React.lazy(() => import("./components/pages/DataPage"));
const LoginPage = React.lazy(() => import("./components/pages/LoginPage"));
const CustomerDashboard = React.lazy(
  () => import("./components/pages/CustomerDashboard"),
);
const TrashPage = React.lazy(() => import("./components/pages/TrashPage"));

// Wrapper to handle lazy loading timeouts
const LazyPageWrapper: React.FC<{
  children: React.ReactNode;
  pageName?: string;
}> = ({ children, pageName = "page" }) => {
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 10000); // 10s timeout for lazy loading

    return () => clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-800 max-w-md">
          <p className="text-red-700 dark:text-red-400 mb-4 font-medium">
            Loading {pageName} is taking longer than expected.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            This might be due to a slow network connection or a temporary server
            issue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// AdminOnlyRoute component to restrict admin-only pages
const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isScopedCustomer } = useData();
  if (isScopedCustomer) {
    return <Navigate to="/loans" replace />;
  }
  return <>{children}</>;
};

/**
 * Check if running inside native app wrapper
 * The native app sets 'ReactNativeWebView' on the window object
 */
const isInNativeWrapper = (): boolean => {
  return (
    typeof window !== "undefined" &&
    (typeof (window as any).ReactNativeWebView !== "undefined" ||
      navigator.userAgent.includes("LoanAppMobile"))
  );
};

// AnimatedRoutes component to handle page transitions
const AnimatedRoutes = () => {
  const location = useLocation();
  const { isScopedCustomer } = useData();

  // Show minimal spinner during lazy loading - required for native wrapper to avoid blank screens
  // Native has its own loading screen for initial load, but Suspense fallback is needed for navigation
  const suspenseFallback = isInNativeWrapper() ? (
    // Minimal inline spinner for native wrapper - shows during lazy route transitions
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: "50vh",
        backgroundColor: "inherit",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #E5E7EB",
          borderTopColor: "#4F46E5",
          borderRadius: "50%",
          animation: "suspense-spin 0.8s linear infinite",
        }}
      />
    </div>
  ) : (
    <LazyPageWrapper>
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    </LazyPageWrapper>
  );

  return (
    <Suspense fallback={suspenseFallback}>
      <AnimatePresence mode="wait">
        <Routes location={location}>
          <Route
            path="/"
            element={
              isScopedCustomer ? (
                <CustomerDashboard />
              ) : (
                <AdminOnlyRoute>
                  <AddCustomerPage />
                </AdminOnlyRoute>
              )
            }
          />
          <Route
            path="/add-record"
            element={
              <AdminOnlyRoute>
                <AddRecordPage />
              </AdminOnlyRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <AdminOnlyRoute>
                <CustomerListPage />
              </AdminOnlyRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <AdminOnlyRoute>
                <CustomerDetailPageComponent />
              </AdminOnlyRoute>
            }
          />
          <Route path="/loans" element={<LoanListPage />} />
          <Route path="/loan-seniority" element={<LoanSeniorityPage />} />
          <Route path="/loans/:id" element={<LoanDetailPage />} />
          <Route path="/subscriptions" element={<SubscriptionListPage />} />
          <Route
            path="/summary"
            element={
              <ErrorBoundary
                fallback={
                  <div className="p-4 text-red-600">
                    Something went wrong loading the summary. Please try again.
                  </div>
                }
              >
                <SummaryPage />
              </ErrorBoundary>
            }
          />
          <Route path="/data" element={<DataPage />} />
          <Route path="/trash" element={<TrashPage />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};

const AutoLogout = () => {
  const { signOut } = useData();
  const location = useLocation();
  const isLoginRoute = location.pathname === "/login";
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastActivityRef = React.useRef<number>(Date.now());
  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
  const MODAL_GRACE_MS = 2 * 60 * 1000;
  const LAST_ACTIVITY_KEY = "loan_app_last_activity";

  const getStoredLastActivity = React.useCallback(() => {
    if (typeof window === "undefined") return Date.now();
    const stored = window.localStorage.getItem(LAST_ACTIVITY_KEY);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now();
  }, []);

  const setLastActivity = React.useCallback((timestamp: number) => {
    lastActivityRef.current = timestamp;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
    }
  }, []);

  const clearAllTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
  };

  const handleConfirmLogout = () => {
    clearAllTimers();
    setShowLogoutModal(false);
    signOut();
  };

  const handleCloseModal = () => {
    clearAllTimers();
    setShowLogoutModal(false);
    // Restart inactivity timer after user confirms staying active
    setLastActivity(Date.now());
    timerRef.current = setTimeout(() => {
      const lastActivity = getStoredLastActivity();
      const elapsed = Date.now() - lastActivity;
      if (elapsed > INACTIVITY_LIMIT_MS) {
        setShowLogoutModal(false);
        signOut();
        return;
      }
      setShowLogoutModal(true);
      modalTimeoutRef.current = setTimeout(() => {
        setShowLogoutModal(false);
        signOut();
      }, MODAL_GRACE_MS);
    }, INACTIVITY_LIMIT_MS);
  };

  const resetTimer = React.useCallback(() => {
    if (isLoginRoute) return;
    clearAllTimers();
    setLastActivity(Date.now());
    timerRef.current = setTimeout(() => {
      const lastActivity = getStoredLastActivity();
      const elapsed = Date.now() - lastActivity;
      if (elapsed > INACTIVITY_LIMIT_MS) {
        setShowLogoutModal(false);
        signOut();
        return;
      }
      setShowLogoutModal(true);
      // Set a timeout within the modal for auto-logout after 2 more minutes
      modalTimeoutRef.current = setTimeout(() => {
        setShowLogoutModal(false);
        signOut();
      }, MODAL_GRACE_MS);
    }, INACTIVITY_LIMIT_MS); // 30 minutes
  }, [getStoredLastActivity, isLoginRoute, setLastActivity, signOut]);

  const throttledResetTimer = React.useMemo(() => {
    let lastCall = 0;
    const throttleDelay = 500; // Throttle to 500ms intervals
    return () => {
      const now = Date.now();
      if (now - lastCall >= throttleDelay) {
        lastCall = now;
        resetTimer();
      }
    };
  }, [resetTimer]);

  React.useEffect(() => {
    if (isLoginRoute) {
      clearAllTimers();
      setShowLogoutModal(false);
      return;
    }

    const storedLastActivity = getStoredLastActivity();
    const elapsed = Date.now() - storedLastActivity;
    if (elapsed > INACTIVITY_LIMIT_MS) {
      setShowLogoutModal(false);
      signOut();
      return;
    }

    window.addEventListener("mousemove", throttledResetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    resetTimer();

    return () => {
      clearAllTimers();
      window.removeEventListener("mousemove", throttledResetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
    };
  }, [
    getStoredLastActivity,
    isLoginRoute,
    resetTimer,
    signOut,
    throttledResetTimer,
  ]);

  return (
    <InactivityLogoutModal
      isOpen={showLogoutModal}
      onConfirm={handleConfirmLogout}
      onClose={handleCloseModal}
    />
  );
};

const App = () => {
  const profileRef = React.useRef<React.ElementRef<typeof ProfileHeader>>(null);

  return (
    <DataProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AutoLogout />
          <RouteReadySignal>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <div className="w-full h-screen overflow-hidden relative">
                      <ProfileHeader ref={profileRef} />
                      <div className="flex w-full h-screen overflow-hidden">
                        <Sidebar profileRef={profileRef} />
                        <main
                          className="flex-1 h-full overflow-y-auto sidebar-transition"
                          // Use the CSS variable set by Sidebar to offset content when sidebar is visible on desktop.
                          style={{
                            paddingLeft: "var(--sidebar-offset, 0px)",
                            scrollbarGutter: "stable",
                          }}
                        >
                          <AnimatedRoutes />
                        </main>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </RouteReadySignal>
        </BrowserRouter>
      </ThemeProvider>
    </DataProvider>
  );
};

export default App;
