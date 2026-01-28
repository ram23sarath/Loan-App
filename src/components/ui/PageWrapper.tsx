import React from 'react';
import { motion, Transition, Variants } from 'framer-motion';
import { useData } from '../../context/DataContext';
import Toast from './Toast';

// Enhanced page variants - using only opacity and blur to avoid scrollbar flash
const pageVariants: Variants = {
  initial: {
    opacity: 0,
    filter: 'blur(8px)',
  },
  in: {
    opacity: 1,
    filter: 'blur(0px)',
  },
  out: {
    opacity: 0,
    filter: 'blur(4px)',
  },
};

const pageTransition: Transition = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.3,
};

// Container variants for staggered children
const containerVariants: Variants = {
  initial: { opacity: 0 },
  in: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  out: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

// Child variants for staggered animations
export const childVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  out: {
    opacity: 0,
    y: -10,
    scale: 0.95,
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
