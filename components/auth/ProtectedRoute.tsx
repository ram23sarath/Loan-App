import React from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import LoadingSpinner from '../ui/LoadingSpinner';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { session, loading } = useData();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;