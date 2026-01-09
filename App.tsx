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

// Lazy load page components for better initial bundle size
const AddCustomerPage = React.lazy(
  () => import("./components/pages/AddCustomerPage")
);
const AddRecordPage = React.lazy(
  () => import("./components/pages/AddRecordPage")
);
const CustomerListPage = React.lazy(
  () => import("./components/pages/CustomerListPage")
);
const CustomerDetailPageComponent = React.lazy(
  () => import("./components/pages/CustomerDetailPage")
);
const LoanListPage = React.lazy(
  () => import("./components/pages/LoanListPage")
);
const LoanDetailPage = React.lazy(
  () => import("./components/pages/LoanDetailPage")
);
const LoanSeniorityPage = React.lazy(
  () => import("./components/pages/LoanSeniorityPage")
);
const SubscriptionListPage = React.lazy(
  () => import("./components/pages/SubscriptionListPage")
);
const SummaryPage = React.lazy(() => import("./components/pages/SummaryPage"));
const DataPage = React.lazy(() => import("./components/pages/DataPage"));
const LoginPage = React.lazy(() => import("./components/pages/LoginPage"));
const CustomerDashboard = React.lazy(
  () => import("./components/pages/CustomerDashboard")
);

// AdminOnlyRoute component to restrict admin-only pages
const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isScopedCustomer } = useData();
  if (isScopedCustomer) {
    return <Navigate to="/loans" replace />;
  }
  return <>{children}</>;
};

// AnimatedRoutes component to handle page transitions
const AnimatedRoutes = () => {
  const location = useLocation();
  const { isScopedCustomer } = useData();
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner />
        </div>
      }
    >
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
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};

const AutoLogout = () => {
  const { signOut } = useData();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

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
    timerRef.current = setTimeout(() => {
      setShowLogoutModal(true);
      modalTimeoutRef.current = setTimeout(() => {
        setShowLogoutModal(false);
        signOut();
      }, 2 * 60 * 1000);
    }, 30 * 60 * 1000);
  };

  const resetTimer = React.useCallback(() => {
    clearAllTimers();
    timerRef.current = setTimeout(() => {
      setShowLogoutModal(true);
      // Set a timeout within the modal for auto-logout after 2 more minutes
      modalTimeoutRef.current = setTimeout(() => {
        setShowLogoutModal(false);
        signOut();
      }, 2 * 60 * 1000); // 2 minutes to respond to modal
    }, 30 * 60 * 1000); // 30 minutes
  }, [signOut]);

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
  }, [resetTimer, throttledResetTimer]);

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
        <AutoLogout />
        <BrowserRouter>
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
                        className="flex-1 h-full overflow-y-auto"
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
        </BrowserRouter>
      </ThemeProvider>
    </DataProvider>
  );
};

export default App;
