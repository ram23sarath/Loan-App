import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import LoadingSpinner from '../ui/LoadingSpinner';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { session, loading } = useData();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;