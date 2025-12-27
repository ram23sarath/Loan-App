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
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md overflow-hidden">
            {/* Background elements for premium feel */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 pointer-events-none dark:from-indigo-900/40 dark:to-blue-900/40" />

            {/* Officer Image and Greeting */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex flex-col items-center z-10 mb-8"
            >
                <img
                    src="/police_officer.png"
                    alt="Officer"
                    className="w-96 h-auto object-contain drop-shadow-2xl mb-4 rounded-lg"
                />
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-red-600 dark:text-red-500 drop-shadow-sm">
                    Namasthe!
                </h1>
            </motion.div>

            <div className="relative w-full h-48 flex items-center">
                {/* Road line */}
                <div className="absolute bottom-10 left-0 right-0 h-0.5 bg-gray-200/50 dark:bg-slate-700/50" />

                <motion.div
                    initial={{ x: '-20vw' }}
                    animate={{ x: '120vw' }}
                    transition={{
                        duration: 4,
                        ease: [0.45, 0, 0.55, 1], // Custom bezier for smooth acceleration/deceleration
                    }}
                    className="absolute left-0"
                >
                    <motion.div
                        animate={{ y: [0, -2, 0] }}
                        transition={{
                            repeat: Infinity,
                            duration: 0.4,
                            ease: "easeInOut"
                        }}
                        className="relative"
                    >
                        {/* Speed lines effect behind the truck */}
                        <motion.div
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: [0, 0.5, 0], width: [0, 100, 0] }}
                            transition={{ duration: 3, times: [0, 0.5, 1] }}
                            className="absolute top-1/2 -left-20 h-1 bg-gradient-to-r from-transparent to-indigo-400 rounded-full blur-sm dark:to-indigo-300"
                        />

                        <img
                            src="/firetruck.png"
                            alt="Fire Truck"
                            className="w-32 md:w-40 h-auto object-contain drop-shadow-xl filter saturate-110 dark:filter dark:brightness-90"
                        />
                    </motion.div>
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="absolute bottom-10 flex flex-col items-center gap-2"
            >
                <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{
                                repeat: Infinity,
                                duration: 1,
                                delay: i * 0.2,
                                ease: "easeInOut"
                            }}
                            className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-300"
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default FireTruckAnimation;
