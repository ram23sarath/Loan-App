import React, { useState, useRef, useEffect, Suspense, lazy } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useData } from "../../context/DataContext";
import { useRouteReady } from "../RouteReadySignal";
import GlassCard from "../ui/GlassCard";
import Toast from "../ui/Toast";
import LoadingSpinner from "../ui/LoadingSpinner";
// Lazy load the heavy animation component
const FireTruckAnimation = lazy(() => import(/* webpackChunkName: "firetruck-animation" */ '../ui/FireTruckAnimation'));
import { EyeIcon, EyeOffIcon } from "../../constants";

type FormInputs = {
  email: string; // accepts email or phone
  password: string;
};

const LoginPage = () => {
  const { session, signInWithPassword } = useData();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInputs>();
  const [showAnimation, setShowAnimation] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isWiggling, setIsWiggling] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [showLoginOnMobile, setShowLoginOnMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const defaultLandingPath = "/";
  const heroWords = [
    { text: "Welcome", accent: false },
    { text: "to", accent: false },
    { text: "Chittoor", accent: true },
    { text: "District", accent: true },
    { text: "Welfare", accent: false },
    { text: "Association", accent: false },
    { text: "LoanApp!", accent: true },
  ];

  const formVariants = {
    hidden: (mobile: boolean) => ({
      opacity: 0,
      y: mobile ? 180 : 16,
      scale: mobile ? 0.94 : 1,
      filter: "blur(6px)",
      pointerEvents: "none",
    }),
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      pointerEvents: "auto",
      transition: {
        type: "spring",
        stiffness: 220,
        damping: 26,
        mass: 0.9,
        duration: 0.7,
        delay: 0.05,
      },
    },
  };

  // Detect if screen is mobile size and preload animation images
  const signalRouteReady = useRouteReady();
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Preload images specifically for the FireTruckAnimation
    // This ensures they are cached and ready to display instantly
    // when the user logs in, preventing pop-in/loading delays.
    const imagesToPreload = [
      "/ap_govt_emblem.png",
      "/police_officer.png",
      "/ap_firetruck_truck.png",
      "/firetruck.png",
    ];

    imagesToPreload.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    // Signal to native wrapper that this page is ready
    signalRouteReady();

    return () => window.removeEventListener("resize", checkMobile);
  }, [signalRouteReady]);

  const handleScrollToLogin = () => {
    if (!showLoginOnMobile) setShowLoginOnMobile(true);
    // wait for the card to render on mobile then scroll
    setTimeout(() => {
      if (cardRef.current) {
        cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  };

  const normalizeLoginIdentifier = (value: string) => {
    const v = value.trim();

    // If the input looks like a phone (digits only, length between 6 and 15), normalize to email
    const digits = v.replace(/\D/g, "");
    if (/^\d{6,15}$/.test(digits)) {
      return `${digits}@gmail.com`;
    }

    // If input is not an email (no @ symbol), append @gmail.com
    if (!v.includes("@")) {
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
        ease: "easeInOut",
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

  // Show only the animation when it's active
  if (showAnimation) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <FireTruckAnimation onComplete={handleAnimationComplete} />
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-center md:justify-between min-h-screen px-4 py-8 sm:px-0 md:pr-16 md:pl-16">
      <Toast
        message={toastMessage}
        show={showToast}
        onClose={() => setShowToast(false)}
        type="error"
      />

      {(!isMobile || !showLoginOnMobile) && (
        <motion.div
          className="w-full flex flex-col items-center md:items-start md:justify-center md:w-1/2 md:pr-8 mb-6 md:mb-0"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black mb-8 leading-[1.1] tracking-tight text-center md:text-left"
            variants={wordContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {heroWords.map((word, index) => (
              <motion.span
                key={index}
                variants={wordVariants}
                className="inline-block px-1 py-0.5"
              >
                <span
                  className={`${
                    word.accent
                      ? "premium-shimmer-text premium-pulse-glow font-black"
                      : "premium-gradient-text"
                  } drop-shadow-[0_8px_32px_rgba(99,102,241,0.35)]`}
                  style={{
                    textShadow: word.accent
                      ? "0 4px 30px rgba(192, 132, 252, 0.4), 0 8px 40px rgba(129, 140, 248, 0.25)"
                      : "none",
                  }}
                >
                  {word.text}
                </span>
              </motion.span>
            ))}
          </motion.h1>
          <motion.div
            className="flex flex-col gap-4 mt-8 text-center md:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
          >
            {/* Decorative divider */}
            <motion.div
              className="h-1 w-24 mx-auto md:mx-0 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
              style={{ transformOrigin: "left" }}
            />

            <motion.p
              className="text-sm uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400 font-semibold premium-breathe"
              initial={{ opacity: 0, letterSpacing: "0.1em" }}
              animate={{ opacity: 1, letterSpacing: "0.25em" }}
              transition={{ duration: 1, delay: 0.9 }}
            >
              Developed & Maintained By
            </motion.p>

            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 1.1 }}
            >
              <motion.p
                className="text-2xl sm:text-3xl lg:text-4xl font-black premium-glow-text leading-tight"
                animate={{
                  y: [0, -6, 0],
                  filter: [
                    "drop-shadow(0 0 20px rgba(102, 126, 234, 0.5))",
                    "drop-shadow(0 0 35px rgba(192, 132, 252, 0.6))",
                    "drop-shadow(0 0 20px rgba(102, 126, 234, 0.5))",
                  ],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                I J Reddy
              </motion.p>
              <motion.p
                className="text-lg sm:text-xl font-semibold text-gray-600 dark:text-gray-300 mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.3 }}
              >
                <span className="premium-gold-text font-bold">DOP</span>
                <span className="mx-2 text-gray-400">•</span>
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Chittoor Fire Station
                </span>
              </motion.p>
            </motion.div>
          </motion.div>
          <motion.button
            onClick={handleScrollToLogin}
            className="mt-10 md:hidden inline-flex items-center justify-center bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-size-200 hover:bg-pos-100 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ backgroundSize: "200% 100%" }}
          >
            <span className="mr-2">Get Started</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </motion.button>
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
          <GlassCard
            className="w-full"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-center mb-6 text-gray-800 dark:text-dark-text">
              Loan Management Login
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2 text-gray-700 dark:text-dark-text"
                >
                  Phone Number
                </label>
                <input
                  id="email"
                  type="text"
                  {...register("email", {
                    required: "Email, username, or phone is required",
                  })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                  placeholder="Enter Phone Number"
                  disabled={isSubmitting || showAnimation}
                />
                {errors.email && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-2 text-gray-700 dark:text-dark-text"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password", {
                      required: "Password is required",
                    })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                    placeholder="••••••••"
                    disabled={isSubmitting || showAnimation}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting || showAnimation}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:text-dark-muted dark:hover:text-dark-text"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOffIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <motion.button
                ref={buttonRef}
                animate={isWiggling ? "wiggle" : "normal"}
                variants={wiggleVariants}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isSubmitting || showAnimation}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 transition-colors duration-300 text-white font-bold py-3 px-4 rounded-lg"
              >
                {isSubmitting ? "Logging in..." : "Login"}
              </motion.button>
            </form>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
};

export default LoginPage;
