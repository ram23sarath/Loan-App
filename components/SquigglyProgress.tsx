import React from "react";
import { motion } from "framer-motion";

interface SquigglyProgressProps {
  value: number; // 0–100
  height?: number;
  color?: string; // Progress color
  trackColor?: string; // Background track color
  strokeWidth?: number;
}

export const SquigglyProgress: React.FC<SquigglyProgressProps> = ({
  value,
  height = 24,
  color = "#3b82f6", // Tailwind blue-500
  trackColor = "#cbd5e1", // Tailwind slate-300
  strokeWidth = 4,
}) => {
  // Clamp value
  const safeValue = Math.max(0, Math.min(value, 100));

  // Wave Configuration
  const wavelength = 30; // Width of one complete wave cycle (px)
  const amplitude = height / 2 - strokeWidth; // Height of the wave peak
  const centerY = height / 2;

  // Generate the path for exactly ONE wave cycle
  // M startX startY Q controlX controlY endX endY T endX endY
  const oneWavePath = `
    M 0 ${centerY} 
    Q ${wavelength / 4} ${centerY - amplitude} ${wavelength / 2} ${centerY} 
    T ${wavelength} ${centerY}
  `;

  return (
    <div
      className="relative w-full overflow-hidden rounded-full transform translate-z-0"
      style={{ height, background: "transparent" }} // translate-z-0 forces GPU acceleration
    >
      {/* We define the Wave Pattern inside each SVG that uses it so references resolve reliably. */}

      {/* 1. The Background Track (Static) */}
      <div className="absolute inset-0 w-full h-full">
        <svg className="w-full h-full">
          <defs>
            <pattern
              id={`wave-pattern-${height}`}
              x="0"
              y="0"
              width={wavelength}
              height={height}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={oneWavePath}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </pattern>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#wave-pattern-${height})`}
            className="text-slate-300"
            style={{ color: trackColor }}
          />
        </svg>
      </div>

      {/* 2. The Progress Fill (Animated) */}
      <motion.div
        className="absolute top-0 left-0 h-full overflow-hidden"
        initial={{ width: 0 }}
        animate={{ width: `${safeValue}%` }}
        transition={{ type: "spring", stiffness: 50, damping: 15 }}
      >
        <svg className="h-full w-full" style={{ minWidth: "100vw" }}>
          <defs>
            <pattern
              id={`wave-pattern-${height}`}
              x="0"
              y="0"
              width={wavelength}
              height={height}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={oneWavePath}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </pattern>
          </defs>
           {/* minWidth 100vw ensures the SVG inside the clipped div 
             is always large enough to show the pattern, preventing squash.
           */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#wave-pattern-${height})`}
            style={{ color: color }}
          >
            {/* The Animation: We animate the Pattern X position */}
            <animate
              attributeName="x"
              from="0"
              to={`-${wavelength}`}
              dur="1s"
              repeatCount="indefinite"
            />
          </rect>
        </svg>
      </motion.div>
    </div>
  );
};