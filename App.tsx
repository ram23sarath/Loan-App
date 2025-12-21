import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import ProfileHeader from './components/ProfileHeader';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { useData } from './context/DataContext';

// Lazy load page components for better initial bundle size
const AddCustomerPage = React.lazy(() => import('./components/pages/AddCustomerPage'));
const AddRecordPage = React.lazy(() => import('./components/pages/AddRecordPage'));
const CustomerListPage = React.lazy(() => import('./components/pages/CustomerListPage'));
const LoanListPage = React.lazy(() => import('./components/pages/LoanListPage'));
const LoanDetailPage = React.lazy(() => import('./components/pages/LoanDetailPage'));
const LoanSeniorityPage = React.lazy(() => import('./components/pages/LoanSeniorityPage'));
const SubscriptionListPage = React.lazy(() => import('./components/pages/SubscriptionListPage'));
const SummaryPage = React.lazy(() => import('./components/pages/SummaryPage'));
const DataPage = React.lazy(() => import('./components/pages/DataPage'));
const LoginPage = React.lazy(() => import('./components/pages/LoginPage'));
const CustomerDashboard = React.lazy(() => import('./components/pages/CustomerDashboard'));

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
    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}>
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
          <Route path="/login" element={<LoginPage />} />
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
          <Route path="/loans" element={<LoanListPage />} />
          <Route
            path="/loan-seniority"
            element={
              <AdminOnlyRoute>
                <LoanSeniorityPage />
              </AdminOnlyRoute>
            }
          />
          <Route path="/loans/:id" element={<LoanDetailPage />} />
          <Route path="/subscriptions" element={<SubscriptionListPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/data" element={<DataPage />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

const AutoLogout = () => {
  const { signOut } = useData();
  React.useEffect(() => {
    let timer: any;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        signOut();
        alert('You have been logged out due to inactivity.');
      }, 30 * 60 * 1000); // 30 minutes
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [signOut]);
  return null;
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
            <Route path="/*" element={
              <ProtectedRoute>
                <div className="w-full h-screen overflow-hidden relative">
                  <ProfileHeader ref={profileRef} />
                  <div className="flex w-full h-screen overflow-hidden">
                    <Sidebar profileRef={profileRef} />
                    <main
                      className="flex-1 h-full overflow-y-auto"
                      // Use the CSS variable set by Sidebar to offset content when sidebar is visible on desktop.
                      style={{ paddingLeft: 'var(--sidebar-offset, 0px)' }}
                    >
                      <AnimatedRoutes />
                    </main>
                  </div>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </DataProvider>
  );
};

export default App;