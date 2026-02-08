import React from 'react';
import { motion, Transition, Variants } from 'framer-motion';
import { useData } from '../../context/DataContext';
import Toast from './Toast';

// Smooth page variants - lightweight opacity + subtle y shift (no blur for performance)
const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -4,
  },
};

const pageTransition: Transition = {
  type: 'tween',
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.25,
};

// Container variants for staggered children
const containerVariants: Variants = {
  initial: { opacity: 0 },
  in: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
  out: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

// Child variants for staggered animations
export const childVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  in: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'tween',
      ease: 'easeOut',
      duration: 0.25,
    },
  },
  out: {
    opacity: 0,
    y: -6,
  },
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isScopedCustomer, session, scopedCustomerId, customers } = useData();
  const [toast, setToast] = React.useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });

  React.useEffect(() => {
    const handler = (e: any) => {
      try {
        const d = e?.detail || {};
        const type = d.status === 'success' ? 'success' : 'error';
        const msg = d.message || (type === 'success' ? 'User created successfully' : 'Failed to create user');
        setToast({ show: true, message: msg, type });
      } catch (err) {
        // ignore
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('background-user-create', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('background-user-create', handler as EventListener);
      }
    };
  }, []);

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="w-full min-h-full p-4 pb-24 sm:p-8 landscape:pb-16"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
      }}
    >
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: '', type: 'info' })} type={toast.type as any} />

      {children}
    </motion.div>
  );
};

export default PageWrapper;
