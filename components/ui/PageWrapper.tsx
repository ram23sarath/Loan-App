
import React from 'react';
import { motion, Transition } from 'framer-motion';
import { useData } from '../../context/DataContext';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -20,
  },
};

const pageTransition: Transition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.5,
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isScopedCustomer, session } = useData();

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="w-full min-h-full p-4 pb-24 sm:p-8"
    >
      {/* Admin banner shown for non-scoped users (admins) */}
      {session?.user && !isScopedCustomer && (
        <div
          aria-hidden
          className="fixed top-6 right-6 z-50 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-sm text-sm font-semibold"
        >
          Admin
        </div>
      )}

      {children}
    </motion.div>
  );
};

export default PageWrapper;
