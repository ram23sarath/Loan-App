import React, { useState, useRef } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import Toast from '../ui/Toast';
import FireTruckAnimation from '../ui/FireTruckAnimation';
import { EyeIcon, EyeOffIcon } from '../../constants';

type FormInputs = {
  email: string; // accepts email or phone
  password: string;
};

const LoginPage = () => {
  const { session, signInWithPassword } = useData();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormInputs>();
  const [showAnimation, setShowAnimation] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isWiggling, setIsWiggling] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const defaultLandingPath = "/";

  const normalizeLoginIdentifier = (value: string) => {
    const v = value.trim();
    
    // If the input looks like a phone (digits only, length between 6 and 15), normalize to email
    const digits = v.replace(/\D/g, '');
    if (/^\d{6,15}$/.test(digits)) {
      return `${digits}@gmail.com`;
    }
    
    // If input is not an email (no @ symbol), append @gmail.com
    if (!v.includes('@')) {
      return `${v}@gmail.com`;
    }
    
    // Return as-is if it already contains @
    return v;
  };

  const onSubmit: SubmitHandler<FormInputs> = async ({ email, password }) => {
    try {
      const identifier = normalizeLoginIdentifier(email);
      await signInWithPassword(identifier, password);
      // On success, show animation instead of immediate navigation
      setShowAnimation(true);
    } catch (error: any) {
      setToastMessage(error.message);
      setShowToast(true);
      // Trigger wiggle animation
      setIsWiggling(true);
      setTimeout(() => setIsWiggling(false), 600);
    }
  };

  const handleAnimationComplete = () => {
    navigate(defaultLandingPath, { replace: true });
  };

  // Wiggle animation variants
  const wiggleVariants = {
    wiggle: {
      x: [0, -10, 10, -10, 10, 0],
      transition: {
        duration: 0.6,
        ease: 'easeInOut',
      },
    },
    normal: {
      x: 0,
    },
  };

  // If user is already logged in and we are not showing animation, redirect
  if (session && !showAnimation) {
    return <Navigate to={defaultLandingPath} replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8 sm:px-0">
      {showAnimation && <FireTruckAnimation onComplete={handleAnimationComplete} />}
      <Toast message={toastMessage} show={showToast} onClose={() => setShowToast(false)} type="error" />
      <GlassCard className="w-full max-w-md" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">Loan Management Login</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">Phone Number</label>
            <input
              id="email"
              type="text"
              {...register('email', { required: 'Email, username, or phone is required' })}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter Phone Number"
              disabled={isSubmitting || showAnimation}
            />
            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register('password', { required: 'Password is required' })}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="••••••••"
                disabled={isSubmitting || showAnimation}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting || showAnimation}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOffIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
          </div>
          <motion.button
            ref={buttonRef}
            animate={isWiggling ? 'wiggle' : 'normal'}
            variants={wiggleVariants}
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