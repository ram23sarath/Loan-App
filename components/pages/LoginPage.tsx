import React, { useState, useRef, useEffect } from 'react';
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [showLoginOnMobile, setShowLoginOnMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const defaultLandingPath = "/";
  const heroWords = [
    "Welcome",
    "to",
    "Chittor",
    "District",
    "Welfare",
    "Association",
    "LoanApp!",
  ];

  const formVariants = {
    hidden: (mobile: boolean) => ({
      opacity: 0,
      y: mobile ? 180 : 16,
      scale: mobile ? 0.94 : 1,
      filter: 'blur(6px)',
      pointerEvents: 'none',
    }),
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      pointerEvents: 'auto',
      transition: {
        type: 'spring',
        stiffness: 220,
        damping: 26,
        mass: 0.9,
        duration: 0.7,
        delay: 0.05,
      },
    },
  };

  // Detect if screen is mobile size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleScrollToLogin = () => {
    if (!showLoginOnMobile) setShowLoginOnMobile(true);
    // wait for the card to render on mobile then scroll
    setTimeout(() => {
      if (cardRef.current) {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  };

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
  const wordContainerVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: "easeOut",
        staggerChildren: 0.08,
        delayChildren: 0.15,
      },
    },
  };
  const wordVariants = {
    hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  // If user is already logged in and we are not showing animation, redirect
  if (session && !showAnimation) {
    return <Navigate to={defaultLandingPath} replace />;
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-center md:justify-between min-h-screen px-4 py-8 sm:px-0 md:pr-16 md:pl-16">
      {showAnimation && <FireTruckAnimation onComplete={handleAnimationComplete} />}
      <Toast message={toastMessage} show={showToast} onClose={() => setShowToast(false)} type="error" />

      {(!isMobile || !showLoginOnMobile) && (
        <motion.div
          className="w-full flex flex-col items-center md:items-start md:justify-center md:w-1/2 pr-8 mb-6 md:mb-0"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.h1
            className="text-5xl font-extrabold mb-6 leading-tight tracking-tight text-center md:text-left"
            variants={wordContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {heroWords.map((word, index) => (
              <motion.span key={index} variants={wordVariants} className="inline-block px-1">
                <span className="premium-gradient-text drop-shadow-[0_8px_28px_rgba(99,102,241,0.32)]">
                  {word}
                </span>
              </motion.span>
            ))}
          </motion.h1>
          <motion.div
            className="flex flex-col gap-2 mt-4 text-center md:text-left"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <motion.p
              className="text-lg text-gray-600 dark:text-gray-400 font-medium"
              style={{ willChange: "opacity" }}
              animate={{ opacity: [0.82, 1, 0.86] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              Developed and Maintained By
            </motion.p>
            <motion.p
              className="text-3xl font-bold premium-gradient-text drop-shadow-[0_12px_30px_rgba(236,72,153,0.35)]"
              style={{ willChange: "transform" }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            >
              I J Reddy DOP Chittor Fire Station
            </motion.p>
          </motion.div>
          <button
            onClick={handleScrollToLogin}
            className="mt-6 md:hidden inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Login
          </button>
        </motion.div>
      )}

      {(!isMobile || showLoginOnMobile) && (
        <motion.div
          ref={cardRef}
          className="w-full max-w-md"
          variants={formVariants}
          custom={isMobile}
          initial="hidden"
          animate="visible"
        >
          <GlassCard className="w-full" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <h2 className="text-3xl font-bold text-center mb-6 text-gray-800 dark:text-dark-text">Loan Management Login</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-700 dark:text-dark-text">Phone Number</label>
                <input
                  id="email"
                  type="text"
                  {...register('email', { required: 'Email, username, or phone is required' })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                  placeholder="Enter Phone Number"
                  disabled={isSubmitting || showAnimation}
                />
                {errors.email && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2 text-gray-700 dark:text-dark-text">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register('password', { required: 'Password is required' })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                    placeholder="••••••••"
                    disabled={isSubmitting || showAnimation}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting || showAnimation}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:text-dark-muted dark:hover:text-dark-text"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.password.message}</p>}
              </div>
              <motion.button
                ref={buttonRef}
                animate={isWiggling ? 'wiggle' : 'normal'}
                variants={wiggleVariants}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isSubmitting || showAnimation}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 transition-colors duration-300 text-white font-bold py-3 px-4 rounded-lg"
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </motion.button>
            </form>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
};

export default LoginPage;
