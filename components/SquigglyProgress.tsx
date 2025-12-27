import React from "react";
import { motion } from "framer-motion";

interface SquigglyProgressProps {
    value: number; // 0–100
    height?: number;
    color?: string; // Progress color
    trackColor?: string; // Background track color
}

export const SquigglyProgress: React.FC<SquigglyProgressProps> = ({
    value,
    height = 16,
    color = "#3b82f6", // Tailwind blue-500
    trackColor = "#e2e8f0", // Tailwind slate-200
}) => {
    // Ensure value is 0-100
    const safeValue = Math.max(0, Math.min(value, 100));

    // Visual parameters
    const strokeWidth = 3;
    const amplitude = height / 2 - strokeWidth;
    const wavelength = 20; // Width of one wave cycle

    // Generate a seamless wave path
    // We need enough width to cover 100% + some buffer for animation
    // Let's create a path that is conceptually 200 units wide (0-200) viewbox
    // so we can animate it sliding.
    // Actually, we can use a pattern or just drawing a long path.
    // M 0 0 Q 5 -10 10 0 T 20 0 T 30 0 ...
    // Center Y is height/2.
    const centerY = height / 2;
    const cycles = 20; // Number of cycles to draw

    let path = `M 0 ${centerY}`;
    for (let i = 0; i < cycles; i++) {
        const startX = i * wavelength;
        // Q control-x control-y end-x end-y
        // We do a full sine wave as two quadratic curves or one smooth cubic?
        // M 0 0 Q 5 -10 10 0 T 20 0
        // This creates one period (0 to 20).
        const midX = startX + (wavelength / 2);
        const endX = startX + wavelength;

        // First half (up)
        // path += ` Q ${startX + wavelength/4} ${centerY - amplitude} ${midX} ${centerY}`;
        // Second half (down) - T command automatically reflects control point for smooth join
        // path += ` T ${endX} ${centerY}`;

        // Simpler: Just standard bezier sine approximation
        // One Q command per half-cycle? 
        // Q cp1x cp1y x y
        path += ` Q ${startX + wavelength / 4} ${centerY - amplitude} ${midX} ${centerY}`;
        path += ` T ${endX} ${centerY}`;
    }

    // To make it responsive without stretching the wave shape weirdly,
    // we can't rely on preserving aspect ratio if width is percentage.
    // But for a progress bar, stretching usually looks okay if it's just horizontal.
    // Let's rely on preserving aspectRatio="none" so it fits the container, 
    // but generate enough points so it looks smooth.

    return (
        <div className="w-full relative overflow-hidden rounded-full" style={{ height }}>
                        <style>{`
                @keyframes squiggly-scroll {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>

            {/* Container for the waves */}
            {/* We use a viewbox that allows the path to be drawn. 
          To support infinite scrolling, we render the path nicely. */}

            {/* OPTION: We assume the SVG coordinates map approximately to pixels for the wavelength to look "professional" 
          Let's set viewBox width to match the cycles * wavelength */}

            {/* Background Track */}
            <div className="absolute inset-0 w-full h-full">
                <svg
                    className="w-full h-full"
                    viewBox={`0 0 ${cycles * wavelength} ${height}`}
                    preserveAspectRatio="none"
                >
                    <path
                        d={path}
                        fill="none"
                        stroke={trackColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke" // Keeps stroke width constant even if stretched
                    />
                </svg>
            </div>

            {/* Foreground Progress (Blue) */}
            {/* We clip this container to the progress percentage */}
            <motion.div
                className="absolute inset-0 w-full h-full"
                initial={{ clipPath: `inset(0 100% 0 0)` }}
                animate={{ clipPath: `inset(0 ${100 - safeValue}% 0 0)` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                {/* Duplicate the SVG horizontally so the animation can scroll seamlessly. */}
                <div
                    style={{
                        width: '200%', // two copies side-by-side
                        height: '100%',
                        display: 'flex',
                        transform: 'translateX(0)',
                        animation: safeValue < 100 ? 'squiggly-scroll 2.5s linear infinite' : 'none'
                    }}
                >
                    {/* First copy */}
                    <div style={{ width: '50%', height: '100%' }}>
                        <svg
                            className="w-full h-full"
                            viewBox={`0 0 ${cycles * wavelength} ${height}`}
                            preserveAspectRatio="none"
                        >
                            <path
                                d={path}
                                fill="none"
                                stroke={color}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        </svg>
                    </div>

                    {/* Second copy (shifted) */}
                    <div style={{ width: '50%', height: '100%' }}>
                        <svg
                            className="w-full h-full"
                            viewBox={`0 0 ${cycles * wavelength} ${height}`}
                            preserveAspectRatio="none"
                        >
                            <g transform={`translate(${cycles * wavelength}, 0)`}>
                                <path
                                    d={path}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </g>
                        </svg>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
