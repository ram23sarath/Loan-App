import React from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { DataProvider } from './context/DataContext';
import Sidebar from './components/Sidebar';
import AddCustomerPage from './components/pages/AddCustomerPage';
import AddRecordPage from './components/pages/AddRecordPage';
import CustomerListPage from './components/pages/CustomerListPage';
import LoanListPage from './components/pages/LoanListPage';
import LoanDetailPage from './components/pages/LoanDetailPage';
import LoanSeniorityPage from './components/pages/LoanSeniorityPage';
import SubscriptionListPage from './components/pages/SubscriptionListPage';
import SummaryPage from './components/pages/SummaryPage';
import DataPage from './components/pages/DataPage';
import LoginPage from './components/pages/LoginPage';
import CustomerDashboard from './components/pages/CustomerDashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useData } from './context/DataContext';

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
        <Route
          path="/summary"
          element={
            <AdminOnlyRoute>
              <SummaryPage />
            </AdminOnlyRoute>
          }
        />
        <Route path="/data" element={<DataPage />} />
      </Routes>
    </AnimatePresence>
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

const App = () => (
  <DataProvider>
    <AutoLogout />
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <div className="flex w-full h-screen overflow-hidden">
              <Sidebar />
              <main
                className="flex-1 h-full overflow-y-auto"
                // Use the CSS variable set by Sidebar to offset content when sidebar is visible on desktop.
                style={{ paddingLeft: 'var(--sidebar-offset, 0px)' }}
              >
                <AnimatedRoutes />
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </HashRouter>
  </DataProvider>
);

export default App;