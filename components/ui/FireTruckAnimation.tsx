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
            {/* Animated background gradient orbs */}
            <motion.div
                className="absolute top-1/4 -left-32 w-96 h-96 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl pointer-events-none"
                animate={{
                    x: [0, 50, 0],
                    y: [0, 30, 0],
                    scale: [1, 1.1, 1]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute bottom-1/4 -right-32 w-96 h-96 bg-gradient-to-r from-pink-400/20 to-orange-400/20 rounded-full blur-3xl pointer-events-none"
                animate={{
                    x: [0, -50, 0],
                    y: [0, -30, 0],
                    scale: [1.1, 1, 1.1]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Subtle grid pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none dark:bg-[linear-gradient(rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.05)_1px,transparent_1px)]" />

            {/* Main content container */}
            <div className="relative z-10 flex flex-col items-center px-4">
                {/* Three emblems container */}
                <div className="relative mb-8 flex items-center justify-center gap-4 md:gap-8">
                    {/* Left: AP Government Emblem */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: -30 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                        className="relative"
                    >
                        {/* Glowing ring behind image */}
                        <motion.div
                            className="absolute inset-0 -m-3 rounded-2xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 opacity-20 blur-xl"
                            animate={{
                                opacity: [0.2, 0.4, 0.2],
                                scale: [1, 1.05, 1]
                            }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
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

                    {/* Center: Officer Image with premium frame */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="relative"
                    >
                        {/* Glowing ring behind image */}
                        <motion.div
                            className="absolute inset-0 -m-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-xl"
                            animate={{
                                opacity: [0.2, 0.4, 0.2],
                                scale: [1, 1.05, 1]
                            }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
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

                    {/* Right: AP Fire Truck */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: 30 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                        className="relative"
                    >
                        {/* Glowing ring behind image */}
                        <motion.div
                            className="absolute inset-0 -m-3 rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 opacity-20 blur-xl"
                            animate={{
                                opacity: [0.2, 0.4, 0.2],
                                scale: [1, 1.05, 1]
                            }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                    className="text-center mb-6"
                >
                    <motion.p
                        className="text-sm uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400 font-semibold mb-3"
                        initial={{ opacity: 0, letterSpacing: '0.1em' }}
                        animate={{ opacity: 1, letterSpacing: '0.3em' }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                    >
                        Welcome to
                    </motion.p>
                    <motion.h1
                        className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                    >
                        <span className="premium-gradient-text">CTR District Welfare</span>
                    </motion.h1>
                    <motion.h2
                        className="text-2xl md:text-3xl font-bold"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                    >
                        <span className="premium-shimmer-text">LoanApp</span>
                    </motion.h2>
                </motion.div>

                {/* Decorative divider */}
                <motion.div
                    className="flex items-center gap-3 mb-6"
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 0.7 }}
                >
                    <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-indigo-400 rounded-full" />
                    <motion.div
                        className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-purple-400 rounded-full" />
                </motion.div>
            </div>

            {/* Fire truck animation section */}
            <div className="relative w-full h-32 md:h-40 flex items-center mt-4">
                {/* Road surface */}
                <div className="absolute bottom-8 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-300/60 to-transparent dark:via-slate-600/60" />
                <div className="absolute bottom-6 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />

                <motion.div
                    initial={{ x: '-25vw' }}
                    animate={{ x: '120vw' }}
                    transition={{
                        duration: 4,
                        ease: [0.45, 0, 0.55, 1],
                    }}
                    className="absolute left-0"
                >
                    <motion.div
                        animate={{ y: [0, -3, 0] }}
                        transition={{
                            repeat: Infinity,
                            duration: 0.35,
                            ease: "easeInOut"
                        }}
                        className="relative"
                    >
                        {/* Enhanced speed lines */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 0.6, 0] }}
                            transition={{ duration: 3, times: [0, 0.5, 1] }}
                            className="absolute top-1/2 -translate-y-1/2 -left-16 flex flex-col gap-1"
                        >
                            <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-red-400/60 rounded-full" />
                            <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-orange-400/50 rounded-full -ml-2" />
                            <div className="w-10 h-0.5 bg-gradient-to-r from-transparent to-red-400/60 rounded-full" />
                        </motion.div>

                        {/* Fire truck with glow */}
                        <div className="relative">
                            <motion.div
                                className="absolute inset-0 blur-lg bg-red-500/30 rounded-full"
                                animate={{ opacity: [0.3, 0.5, 0.3] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                            />
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="absolute bottom-8 md:bottom-12 flex flex-col items-center gap-4"
            >
                <motion.p
                    className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                    Preparing your dashboard...
                </motion.p>

                {/* Animated dots with gradient */}
                <div className="flex gap-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                scale: [1, 1.4, 1],
                                opacity: [0.4, 1, 0.4]
                            }}
                            transition={{
                                repeat: Infinity,
                                duration: 1.2,
                                delay: i * 0.15,
                                ease: "easeInOut"
                            }}
                            className="w-2 h-2 rounded-full"
                            style={{
                                background: `linear-gradient(135deg, ${['#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6'][i]
                                    }, ${['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'][i]
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
