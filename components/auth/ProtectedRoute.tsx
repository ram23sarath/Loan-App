
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useData } from '../../context/DataContext';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { session, loading } = useData();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
        <p className="text-xl font-semibold text-gray-700">Authenticating...</p>
      </div>
    );
  }

  if (!session) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to so we can send them along after they log in.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
