import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useAnimationBatching } from "../hooks/useAnimationBatching";

interface FireTruckAnimationContentProps {
  onComplete: () => void;
}

const FireTruckAnimationContent: React.FC<FireTruckAnimationContentProps> = ({
  onComplete,
}) => {
  const prefersReducedMotion = useReducedMotion();
  
  // Animation refs
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const truckRef = useRef<HTMLDivElement>(null);
  const speedLinesRef = useRef<HTMLDivElement>(null);
  
  const { register, unregister } = useAnimationBatching();

  // Handle completion timer
  useEffect(() => {
    // Duration matches the animation duration for smooth completion
    // Shorter duration if reduced motion
    const duration = prefersReducedMotion ? 2000 : 4500;
    const timer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [onComplete, prefersReducedMotion]);

  // Handle manual animations
  useEffect(() => {
    if (prefersReducedMotion) return;

    const truckId = `truck-${Math.random()}`;
    const orbsId = `orbs-${Math.random()}`;
    const speedLinesId = `speedlines-${Math.random()}`;

    // Truck bounce animation: 0 -> -2px -> 0 over 0.65s
    const updateTruck = (time: number) => {
      if (!truckRef.current) return;
      const period = 650;
      const t = (time % period) / period; // 0 to 1
      // sin(0)=0, sin(PI/2)=1, sin(PI)=0. We want 0 -> -2 -> 0
      const y = -2 * Math.sin(t * Math.PI);
      truckRef.current.style.transform = `translateY(${y}px)`;
    };

    // Speed lines opacity: 0 -> 0.4 -> 0 over 2s
    const updateSpeedLines = (time: number) => {
        if (!speedLinesRef.current) return;
        const period = 2000;
        const t = (time % period) / period;
        // 0 -> 0.4 -> 0
        const opacity = 0.4 * Math.sin(t * Math.PI);
        speedLinesRef.current.style.opacity = opacity.toFixed(2);
    };

    // Complex float animation for orbs
    const updateOrbs = (time: number) => {
      // Orb 1 (Top Left)
      if (orb1Ref.current) {
        const t = time / 10000; // 10s period
        const rad = t * 2 * Math.PI;
        // Approximate the keyframes with compound sines
        const x = 20 * Math.sin(rad) + 20 * Math.sin(rad / 2); // Roughly 0->40->0
        const y = 15 * Math.sin(rad * 1.5); 
        const s = 1 + 0.05 * Math.sin(rad); 
        orb1Ref.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      }

      // Orb 2 (Bottom Right) - shifted phase
      if (orb2Ref.current) {
        const t = (time + 2000) / 12000; // 12s period, shifted
        const rad = t * 2 * Math.PI;
        const x = -20 * Math.sin(rad);
        const y = 20 * Math.cos(rad);
        const s = 1 + 0.03 * Math.sin(rad * 2);
        orb2Ref.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      }
    };

    register(truckId, updateTruck);
    register(orbsId, updateOrbs);
    register(speedLinesId, updateSpeedLines);

    return () => {
      unregister(truckId);
      unregister(orbsId);
      unregister(speedLinesId);
    };
  }, [prefersReducedMotion, register, unregister]);


  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/50 overflow-hidden"
      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.995 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Animated background gradient orbs — JS-driven for batching efficiency */}
      {!prefersReducedMotion && (
        <>
          <div
            ref={orb1Ref}
            className="absolute top-1/4 -left-32 w-96 h-96 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl pointer-events-none"
            style={{ willChange: 'transform' }}
          />
          <div
            ref={orb2Ref}
            className="absolute bottom-1/4 -right-32 w-96 h-96 bg-gradient-to-r from-pink-400/20 to-orange-400/20 rounded-full blur-3xl pointer-events-none"
            style={{ willChange: 'transform' }}
          />
        </>
      )}

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none dark:bg-[linear-gradient(rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.05)_1px,transparent_1px)]" />

      {/* Main content container */}
      <div className="relative z-10 flex flex-col items-center px-4">
        {/* Three emblems container */}
        <div className="relative mb-8 flex items-center justify-center gap-4 md:gap-8">
          {/* Left: AP Government Emblem - Gentle fade-slide from left */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            transition={{
              type: "tween",
              duration: 0.6,
              ease: [0.25, 0.1, 0.25, 1],
              delay: 0.2,
            }}
            className="relative"
          >
            {/* Glowing ring behind image */}
            <div className={`absolute inset-0 -m-3 rounded-2xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 opacity-20 blur-xl ${!prefersReducedMotion ? 'premium-pulse-glow' : ''}`} />
            <div className="relative p-1 rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-2">
                <img
                  src="/ap_govt_emblem.png"
                  alt="AP Government Emblem"
                  className="w-[4.5rem] md:w-24 h-auto object-contain rounded-lg"
                />
              </div>
            </div>
          </motion.div>

          {/* Center: Officer Image - Smooth scale-up from center */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            transition={{
              type: "tween",
              duration: 0.65,
              ease: [0.25, 0.1, 0.25, 1],
              delay: 0.28,
            }}
            className="relative"
          >
            {/* Glowing ring behind image */}
            <div
              className={`absolute inset-0 -m-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-xl ${!prefersReducedMotion ? 'premium-pulse-glow' : ''}`}
              style={{ animationDelay: "-1s" }}
            />
            <div className="relative p-1 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-2">
                <img
                  src="/police_officer.png"
                  alt="Officer"
                  className="w-[7.5rem] md:w-[9.75rem] h-auto object-contain rounded-lg"
                />
              </div>
            </div>
          </motion.div>

          {/* Right: AP Fire Truck - Gentle fade-slide from right */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            transition={{
              type: "tween",
              duration: 0.6,
              ease: [0.25, 0.1, 0.25, 1],
              delay: 0.22,
            }}
            className="relative"
          >
            {/* Glowing ring behind image */}
            <div
              className={`absolute inset-0 -m-3 rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 opacity-20 blur-xl ${!prefersReducedMotion ? 'premium-pulse-glow' : ''}`}
              style={{ animationDelay: "-2s" }}
            />
            <div className="relative p-1 rounded-2xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-500">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-2">
                <img
                  src="/ap_firetruck_truck.png"
                  alt="AP Fire Services"
                  className="w-[5.5rem] md:w-28 h-auto object-contain rounded-lg"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Premium welcome text */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: "easeOut" }}
          className="text-center mb-6"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400 font-semibold mb-3">
            Welcome to
          </p>
          <motion.h1
            className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-2"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55, ease: "easeOut" }}
          >
            <span className="premium-gradient-text">CTR District Welfare</span>
          </motion.h1>
          <motion.h2
            className="text-2xl md:text-3xl font-bold"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.62, ease: "easeOut" }}
          >
            <span className="premium-shimmer-text">LoanApp</span>
          </motion.h2>
        </motion.div>

        {/* Decorative divider */}
        <motion.div
          className="flex items-center gap-3 mb-6"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scaleX: 0.3 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.7, delay: 0.65, ease: "easeOut" }}
        >
          <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-indigo-400 rounded-full" />
          <div className={`w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 ${!prefersReducedMotion ? 'premium-pulse-glow' : ''}`} />
          <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-purple-400 rounded-full" />
        </motion.div>
      </div>

      {/* Fire truck animation section - HIDE in reduced motion, or make static */}
      {!prefersReducedMotion && (
        <div className="relative w-full h-32 md:h-40 flex items-center mt-4">
          {/* Road surface */}
          <div className="absolute bottom-8 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-300/60 to-transparent dark:via-slate-600/60" />
          <div className="absolute bottom-6 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />

          <motion.div
            initial={{ x: "-20vw", opacity: 0 }}
            animate={{ x: "110vw", opacity: 1 }}
            transition={{
              duration: 4.4,
              delay: 0.25,
              ease: [0.22, 0.68, 0.36, 1],
            }}
            className="absolute left-0"
          >
            <div
              className="relative"
            >
              {/* Enhanced speed lines - CSS animated for performance */}
              <div
                ref={speedLinesRef}
                className={`absolute top-1/2 -translate-y-1/2 -left-16 flex flex-col gap-1`}
                style={{ willChange: 'opacity' }}
              >
                <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-red-400/60 rounded-full" />
                <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-orange-400/50 rounded-full -ml-2" />
                <div className="w-10 h-0.5 bg-gradient-to-r from-transparent to-red-400/60 rounded-full" />
              </div>

              {/* Fire truck with glow */}
              <div className="relative" ref={truckRef} style={{ willChange: 'transform' }}>
                <div className="absolute inset-0 blur-lg bg-red-500/20 rounded-full" />
                <img
                  src="/firetruck.png"
                  alt="Fire Truck"
                  className="w-28 md:w-36 h-auto object-contain drop-shadow-2xl relative z-10"
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Premium loading indicator */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
        className="absolute bottom-8 md:bottom-12 flex flex-col items-center gap-4"
      >
        <p
          className={`text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide ${!prefersReducedMotion ? 'animate-pulse-opacity' : ''}`}
        >
          Preparing your dashboard...
        </p>

        {/* Animated dots with gradient */}
        {/* In reduced motion, maybe just show static dots or none */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${!prefersReducedMotion ? 'dot-animation' : ''} ${i === 1 && !prefersReducedMotion ? 'delay-200' : i === 2 && !prefersReducedMotion ? 'delay-400' : ''}`}
              style={{
                background: `linear-gradient(135deg, ${
                  ["#818cf8", "#a78bfa", "#c084fc"][i]
                }, ${["#6366f1", "#8b5cf6", "#a855f7"][i]})`,
              }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FireTruckAnimationContent;
