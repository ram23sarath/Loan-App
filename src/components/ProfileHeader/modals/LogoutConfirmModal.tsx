import React from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface LogoutConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (typeof document === 'undefined') return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="logout-backdrop"
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
                    onClick={onClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm dark:bg-dark-card dark:border dark:border-dark-border"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 24 }}
                        >
                            <h2 className="text-lg font-bold text-gray-800 mb-2 dark:text-dark-text">Confirm Logout</h2>
                        </motion.div>
                        <motion.p
                            className="text-gray-600 mb-6 dark:text-dark-muted"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.15 }}
                        >
                            Are you sure you want to logout?
                        </motion.p>
                        <motion.div
                            className="flex flex-col gap-3 sm:flex-row sm:justify-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}
                        >
                            <motion.button
                                onClick={onClose}
                                className="flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px] sm:min-h-auto dark:border-dark-border dark:text-dark-text dark:hover:bg-slate-700 dark:active:bg-slate-600"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Cancel
                            </motion.button>
                            <motion.button
                                onClick={onConfirm}
                                className="flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 active:bg-red-800 transition-colors min-h-[44px] sm:min-h-auto"
                                whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)' }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Yes, Logout
                            </motion.button>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default LogoutConfirmModal;
