import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import FireTruckAnimation from '../ui/FireTruckAnimation';

type FormInputs = {
  email: string; // accepts email or phone
  password: string;
};

const LoginPage = () => {
  const { session, signInWithPassword } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormInputs>();
  const [showAnimation, setShowAnimation] = useState(false);

  const from = location.state?.from?.pathname || "/";

  const normalizeLoginIdentifier = (value: string) => {
    const v = value.trim();
    // If the input looks like a phone (digits only, length between 6 and 15), normalize to email
    const digits = v.replace(/\D/g, '');
    if (/^\d{6,15}$/.test(digits)) {
      return `${digits}@gmail.com`;
    }
    return v;
  };

  const onSubmit: SubmitHandler<FormInputs> = async ({ email, password }) => {
    try {
      const identifier = normalizeLoginIdentifier(email);
      await signInWithPassword(identifier, password);
      // On success, show animation instead of immediate navigation
      setShowAnimation(true);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAnimationComplete = () => {
    navigate(from, { replace: true });
  };

  // If user is already logged in and we are not showing animation, redirect
  if (session && !showAnimation) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      {showAnimation && <FireTruckAnimation onComplete={handleAnimationComplete} />}
      <GlassCard className="w-full max-w-md" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">Loan Management Login</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">Email or Phone</label>
            <input
              id="email"
              type="text"
              {...register('email', { required: 'Email or phone is required' })}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="you@example.com or 9515808010"
              disabled={isSubmitting || showAnimation}
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
              disabled={isSubmitting || showAnimation}
            />
            {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={isSubmitting || showAnimation}
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