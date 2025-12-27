import React from 'react';
import { motion, MotionProps, Variants } from 'framer-motion';

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  hover3D?: boolean;
  hoverScale?: boolean;
  hoverGlow?: boolean;
} & MotionProps;

// Enhanced card variants with 3D perspective hover
const cardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  hover: {
    y: -4,
    scale: 1.01,
    boxShadow: '0 20px 40px -12px rgba(79, 70, 229, 0.15)',
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  tap: {
    scale: 0.99,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
};

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hover3D = false,
  hoverScale = true,
  hoverGlow = true,
  ...props
}) => {
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
  const cardRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hover3D || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  const transform3D = hover3D ? {
    rotateY: mousePosition.x * 5,
    rotateX: -mousePosition.y * 5,
    transformPerspective: 1000,
  } : {};

  return (
    <motion.div
      ref={cardRef}
      className={`bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border shadow-sm p-6 ${hoverGlow ? 'hover:shadow-lg hover:shadow-indigo-500/5 dark:hover:shadow-indigo-400/5' : ''} transition-shadow duration-300 ${className}`}
      initial="initial"
      animate="animate"
      whileHover={hoverScale ? "hover" : undefined}
      whileTap={hoverScale ? "tap" : undefined}
      variants={hoverScale ? cardVariants : undefined}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: hover3D ? 'preserve-3d' : undefined,
        ...transform3D,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;