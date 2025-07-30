
import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { DataProvider } from './context/DataContext';
import Sidebar from './components/Sidebar';
import AddCustomerPage from './components/pages/AddCustomerPage';
import AddRecordPage from './components/pages/AddRecordPage';
import CustomerListPage from './components/pages/CustomerListPage';
import LoanListPage from './components/pages/LoanListPage';
import SubscriptionListPage from './components/pages/SubscriptionListPage';
import LoginPage from './components/pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<AddCustomerPage />} />
        <Route path="/add-record" element={<AddRecordPage />} />
        <Route path="/customers" element={<CustomerListPage />} />
        <Route path="/loans" element={<LoanListPage />} />
        <Route path="/subscriptions" element={<SubscriptionListPage />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => {
  return (
    <DataProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <div className="flex min-h-screen w-full">
                <Sidebar />
                <main className="flex-1">
                  <AnimatedRoutes />
                </main>
              </div>
            </ProtectedRoute>
          } />
        </Routes>
      </HashRouter>
    </DataProvider>
  );
};

export default App;