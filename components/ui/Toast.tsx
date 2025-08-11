import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ToastProps {
  message: string;
  show: boolean;
  onClose: () => void;
  type?: 'error' | 'success' | 'info';
}

const toastColors = {
  error: 'bg-red-500 text-white',
  success: 'bg-green-500 text-white',
  info: 'bg-indigo-500 text-white',
};

const Toast: React.FC<ToastProps> = ({ message, show, onClose, type = 'error' }) => {
  React.useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3500);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.35 }}
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${toastColors[type]} select-none`}
          role="alert"
        >
          <span>{message}</span>
          <button onClick={onClose} className="ml-2 text-lg font-bold focus:outline-none">&times;</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
