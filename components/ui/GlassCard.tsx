import React from 'react';
import { motion, MotionProps } from 'framer-motion';

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
} & MotionProps;

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-6 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;