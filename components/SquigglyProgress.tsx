import React from "react";

interface SquigglyProgressProps {
    value: number; // 0–100
    height?: number;
    color?: string;
    backgroundColor?: string;
}

export const SquigglyProgress: React.FC<SquigglyProgressProps> = ({
    value,
    height = 12,
    color = "#10b981", // Tailwind green-500
    backgroundColor = "#e5e7eb", // Tailwind gray-200
}) => {
    const width = 100;
    // Ensure value is between 0 and 100
    const safeValue = Math.max(0, Math.min(value, 100));

    // Calculate dash array: [filled_length, gap_length]
    // We want the filled part to be proportional to value
    const dashArray = `${safeValue}, ${width}`;

    return (
        <div style={{ width: "100%" }}>
            <style>
                {`
          @keyframes wave {
            0% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -40; }
          }
        `}
            </style>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                width="100%"
                height={height}
                preserveAspectRatio="none"
                aria-label={`Progress ${value}%`}
                role="progressbar"
                style={{ display: 'block', overflow: 'visible' }}
            >
                {/* Background Path */}
                <path
                    d={`M 0 ${height / 2}
              Q 5 0 10 ${height / 2}
              T ${width} ${height / 2}`}
                    fill="none"
                    stroke={backgroundColor}
                    strokeWidth={height}
                    strokeLinecap="round"
                    className="dark:stroke-slate-700" // Support dark mode via class if possible, or pass prop
                />

                {/* Foreground (Progress) Path */}
                <path
                    d={`M 0 ${height / 2}
              Q 5 0 10 ${height / 2}
              T ${width} ${height / 2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={height}
                    strokeLinecap="round"
                    strokeDasharray={dashArray}
                    style={{
                        transition: "stroke-dasharray 0.4s ease",
                        animation: value < 100 ? "wave 1.5s linear infinite" : "none"
                    }}
                />
            </svg>
        </div>
    );
};
