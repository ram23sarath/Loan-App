import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useFocusTrap from "../hooks/useFocusTrap";

interface AvatarReminderModalProps {
  isOpen: boolean;
  onOpenAvatar: () => void;
  onDismiss: () => void;
}

const AvatarReminderModal: React.FC<AvatarReminderModalProps> = ({
  isOpen,
  onOpenAvatar,
  onDismiss,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Trap focus inside the modal when open
  useFocusTrap(dialogRef, '[data-initial-focus]');

  // Save previously focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current =
        document.activeElement as HTMLElement | null;
    }
  }, [isOpen]);

  // Restore focus after exit animation completes
  const handleExitComplete = () => {
    try {
      previouslyFocusedRef.current?.focus();
    } catch (e) {
      // Ignore focus errors if element no longer exists
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onDismiss]);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/40 z-[99] flex items-center justify-center p-4"
          onClick={onDismiss}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-reminder-title"
            aria-describedby="avatar-reminder-description"
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-sm border border-gray-200 dark:border-dark-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2
                  id="avatar-reminder-title"
                  className="text-xl md:text-2xl font-bold text-gray-900 dark:text-dark-text"
                >
                  Complete Your Profile
                </h2>
              </div>
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 dark:text-dark-muted dark:hover:text-dark-text transition-colors"
                aria-label="Close"
              >
                <span className="text-xl">✕</span>
              </button>
            </div>

            <p
              id="avatar-reminder-description"
              className="text-gray-600 dark:text-dark-muted mb-6 text-sm md:text-base"
            >
              Add a profile picture to personalize your account. This helps other
              users recognize you in the system.
            </p>

            <div className="flex flex-col gap-3">
              <button
                data-initial-focus
                onClick={onOpenAvatar}
                className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm md:text-base"
              >
                📸 Upload Profile Picture
              </button>
              <button
                onClick={onDismiss}
                className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-dark-text font-medium rounded-lg transition-colors text-sm md:text-base"
              >
                Remind Me Later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AvatarReminderModal;
