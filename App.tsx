import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { DataProvider } from './context/DataContext';
import Sidebar from './components/Sidebar';
import AddCustomerPage from './components/pages/AddCustomerPage';
import AddRecordPage from './components/pages/AddRecordPage';
import CustomerListPage from './components/pages/CustomerListPage';
import LoanListPage from './components/pages/LoanListPage';
import LoanDetailPage from './components/pages/LoanDetailPage';
import SubscriptionListPage from './components/pages/SubscriptionListPage';
import SummaryPage from './components/pages/SummaryPage';
import DataPage from './components/pages/DataPage';
import LoginPage from './components/pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

// AnimatedRoutes component to handle page transitions

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location}>
        <Route path="/" element={<AddCustomerPage />} />
        <Route path="/add-record" element={<AddRecordPage />} />
        <Route path="/customers" element={<CustomerListPage />} />
  <Route path="/loans" element={<LoanListPage />} />
        <Route path="/loans/:id" element={<LoanDetailPage />} />
  <Route path="/subscriptions" element={<SubscriptionListPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/data" element={<DataPage />} />
      </Routes>
    </AnimatePresence>
  );
}

import { useData } from './context/DataContext';

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
              <main className="flex-1 h-full overflow-y-auto">
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