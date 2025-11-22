import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface FireTruckAnimationProps {
    onComplete: () => void;
}

const FireTruckAnimation: React.FC<FireTruckAnimationProps> = ({ onComplete }) => {
    useEffect(() => {
        // Reduced duration slightly for a snappier feel
        const timer = setTimeout(() => {
            onComplete();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md overflow-hidden">
            {/* Background elements for premium feel */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 pointer-events-none" />

            <div className="relative w-full h-48 flex items-center">
                {/* Road line */}
                <div className="absolute bottom-10 left-0 right-0 h-0.5 bg-gray-200/50" />

                <motion.div
                    initial={{ x: '-20vw' }}
                    animate={{ x: '120vw' }}
                    transition={{
                        duration: 2.5,
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
                            transition={{ duration: 2, times: [0, 0.5, 1] }}
                            className="absolute top-1/2 -left-20 h-1 bg-gradient-to-r from-transparent to-indigo-400 rounded-full blur-sm"
                        />

                        <img
                            src="/firetruck.png"
                            alt="Fire Truck"
                            className="w-32 md:w-40 h-auto object-contain drop-shadow-xl filter saturate-110"
                        />
                    </motion.div>
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="absolute bottom-20 flex flex-col items-center gap-2"
            >
                <h3 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600 uppercase">
                    Logging In
                </h3>
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
                            className="w-2 h-2 rounded-full bg-indigo-500"
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default FireTruckAnimation;
