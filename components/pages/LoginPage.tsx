
import React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';

type FormInputs = {
  email: string;
  password: string;
};

const LoginPage = () => {
  const { session, signInWithPassword } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormInputs>();

  const from = location.state?.from?.pathname || "/";

  const onSubmit: SubmitHandler<FormInputs> = async ({ email, password }) => {
    try {
      await signInWithPassword(email, password);
      // On success, the onAuthStateChange listener will trigger a re-render
      // and ProtectedRoute will allow access. We can explicitly navigate.
      navigate(from, { replace: true });
    } catch (error: any) {
      alert(error.message);
    }
  };
  
  // If user is already logged in, redirect to home page or intended page
  if (session) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
       <GlassCard className="w-full max-w-md" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">Loan Management Login</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">Email Address</label>
              <input
                id="email"
                type="email"
                {...register('email', { required: 'Email is required' })}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="you@example.com"
                disabled={isSubmitting}
              />
              {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">Password</label>
              <input
                id="password"
                type="password"
                {...register('password', { required: 'Password is required' })}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="••••••••"
                disabled={isSubmitting}
              />
              {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors duration-300 text-white font-bold py-3 px-4 rounded-lg"
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </motion.button>
          </form>
       </GlassCard>
    </div>
  );
};

export default LoginPage;