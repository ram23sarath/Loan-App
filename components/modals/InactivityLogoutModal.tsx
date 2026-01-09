import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useFocusTrap from "../hooks/useFocusTrap";

interface InactivityLogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const InactivityLogoutModal: React.FC<InactivityLogoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Trap focus inside the modal when open
  useFocusTrap(dialogRef, 'button[class*="bg-blue"]');

  // Save previously focused element and restore on close
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current =
        document.activeElement as HTMLElement | null;
    } else {
      try {
        previouslyFocusedRef.current?.focus();
      } catch (e) {
        // Ignore focus errors if element no longer exists
      }
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-expired-title"
            aria-describedby="session-expired-description"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-sm w-full mx-4"
          >
            <h2
              id="session-expired-title"
              className="text-xl font-semibold text-gray-900 dark:text-white mb-4"
            >
              Session Inactive
            </h2>
            <p
              id="session-expired-description"
              className="text-gray-600 dark:text-gray-300 mb-6"
            >
              Your session has been inactive for 30 minutes. Please confirm to
              continue or you will be logged out.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Continue
              </button>{" "}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default InactivityLogoutModal;
