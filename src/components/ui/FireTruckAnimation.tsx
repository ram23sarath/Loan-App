import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface FireTruckAnimationProps {
    onComplete: () => void;
}

const FireTruckAnimation: React.FC<FireTruckAnimationProps> = ({ onComplete }) => {
    useEffect(() => {
        // Duration matches the animation duration for smooth completion
        const timer = setTimeout(() => {
            onComplete();
        }, 4500);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/50 overflow-hidden">
            {/* Animated background gradient orbs — CSS-driven for GPU efficiency */}
            <div
                className="absolute top-1/4 -left-32 w-96 h-96 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl pointer-events-none premium-float"
                style={{ animationDuration: '10s' }}
            />
            <div
                className="absolute bottom-1/4 -right-32 w-96 h-96 bg-gradient-to-r from-pink-400/20 to-orange-400/20 rounded-full blur-3xl pointer-events-none premium-float"
                style={{ animationDuration: '12s', animationDelay: '-4s' }}
            />

            {/* Subtle grid pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none dark:bg-[linear-gradient(rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.05)_1px,transparent_1px)]" />

            {/* Main content container */}
            <div className="relative z-10 flex flex-col items-center px-4">
                {/* Three emblems container */}
                <div className="relative mb-8 flex items-center justify-center gap-4 md:gap-8">
                    {/* Left: AP Government Emblem - Gentle fade-slide from left */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ 
                            type: "tween",
                            duration: 0.5,
                            ease: [0.25, 0.1, 0.25, 1],
                            delay: 0.15 
                        }}
                        className="relative"
                    >
                        {/* Glowing ring behind image */}
                        <div
                            className="absolute inset-0 -m-3 rounded-2xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 opacity-20 blur-xl premium-pulse-glow"
                        />
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
                        initial={{ opacity: 0, scale: 0.85, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ 
                            type: "tween",
                            duration: 0.55,
                            ease: [0.25, 0.1, 0.25, 1],
                            delay: 0.35
                        }}
                        className="relative"
                    >
                        {/* Glowing ring behind image */}
                        <div
                            className="absolute inset-0 -m-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-xl premium-pulse-glow"
                            style={{ animationDelay: '-1s' }}
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
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ 
                            type: "tween",
                            duration: 0.5,
                            ease: [0.25, 0.1, 0.25, 1],
                            delay: 0.2 
                        }}
                        className="relative"
                    >
                        {/* Glowing ring behind image */}
                        <div
                            className="absolute inset-0 -m-3 rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 opacity-20 blur-xl premium-pulse-glow"
                            style={{ animationDelay: '-2s' }}
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
                    className="text-center mb-6"
                >
                    <p className="text-sm uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400 font-semibold mb-3">
                        Welcome to
                    </p>
                    <motion.h1
                        className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-2"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.55, ease: "easeOut" }}
                    >
                        <span className="premium-gradient-text">CTR District Welfare</span>
                    </motion.h1>
                    <motion.h2
                        className="text-2xl md:text-3xl font-bold"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.65, ease: "easeOut" }}
                    >
                        <span className="premium-shimmer-text">LoanApp</span>
                    </motion.h2>
                </motion.div>

                {/* Decorative divider */}
                <motion.div
                    className="flex items-center gap-3 mb-6"
                    initial={{ opacity: 0, scaleX: 0.3 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.7, ease: "easeOut" }}
                >
                    <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-indigo-400 rounded-full" />
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 premium-pulse-glow" />
                    <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-purple-400 rounded-full" />
                </motion.div>
            </div>

            {/* Fire truck animation section */}
            <div className="relative w-full h-32 md:h-40 flex items-center mt-4">
                {/* Road surface */}
                <div className="absolute bottom-8 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-300/60 to-transparent dark:via-slate-600/60" />
                <div className="absolute bottom-6 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />

                <motion.div
                    initial={{ x: '-20vw' }}
                    animate={{ x: '110vw' }}
                    transition={{
                        duration: 4,
                        ease: [0.22, 0.68, 0.36, 1],
                    }}
                    className="absolute left-0"
                >
                    <motion.div
                        animate={{ y: [0, -2, 0] }}
                        transition={{
                            repeat: Infinity,
                            duration: 0.5,
                            ease: "easeInOut"
                        }}
                        className="relative"
                    >
                        {/* Enhanced speed lines */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 0.4, 0] }}
                            transition={{ duration: 3, times: [0, 0.5, 1] }}
                            className="absolute top-1/2 -translate-y-1/2 -left-16 flex flex-col gap-1"
                        >
                            <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-red-400/60 rounded-full" />
                            <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-orange-400/50 rounded-full -ml-2" />
                            <div className="w-10 h-0.5 bg-gradient-to-r from-transparent to-red-400/60 rounded-full" />
                        </motion.div>

                        {/* Fire truck with glow */}
                        <div className="relative">
                            <div className="absolute inset-0 blur-lg bg-red-500/20 rounded-full" />
                            <img
                                src="/firetruck.png"
                                alt="Fire Truck"
                                className="w-28 md:w-36 h-auto object-contain drop-shadow-2xl relative z-10"
                            />
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            {/* Premium loading indicator */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5, ease: "easeOut" }}
                className="absolute bottom-8 md:bottom-12 flex flex-col items-center gap-4"
            >
                <motion.p
                    className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                    Preparing your dashboard...
                </motion.p>

                {/* Animated dots with gradient */}
                <div className="flex gap-2">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.4, 1, 0.4]
                            }}
                            transition={{
                                repeat: Infinity,
                                duration: 1.4,
                                delay: i * 0.2,
                                ease: "easeInOut"
                            }}
                            className="w-2 h-2 rounded-full"
                            style={{
                                background: `linear-gradient(135deg, ${['#818cf8', '#a78bfa', '#c084fc'][i]
                                    }, ${['#6366f1', '#8b5cf6', '#a855f7'][i]
                                    })`
                            }}
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default FireTruckAnimation;
