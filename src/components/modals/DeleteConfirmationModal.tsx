import React from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Trash2Icon } from "../../constants";
import { useModalBackHandler } from "../../utils/useModalBackHandler";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: React.ReactNode;
  isDeleting: boolean;
  confirmText?: string;
  cancelText?: string;
  /** Use 'warning' for amber-themed buttons (e.g., customer deletion with cascade counts) */
  variant?: "danger" | "warning";
}

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants: Variants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
  exit: { scale: 0.9, opacity: 0 },
};

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isDeleting,
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "danger",
}) => {
  useModalBackHandler(isOpen, onClose);

  // Handle Escape key to close modal
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, isDeleting, onClose]);

  if (typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="delete-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={() => !isDeleting && onClose()}
        >
          <motion.div
            key="delete-modal-content"
            className="bg-white rounded-xl shadow-lg p-6 md:p-8 w-[90%] max-w-md flex flex-col items-center dark:bg-dark-card dark:border dark:border-dark-border"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2Icon className="w-10 h-10 text-red-500 mb-2" />
            <h3 className="text-lg font-bold mb-2 text-center text-gray-800 dark:text-dark-text">
              {title}
            </h3>
            <div className="text-gray-700 text-center mb-4 dark:text-dark-muted">
              {message}
            </div>
            <div className="flex gap-4 w-full justify-center">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                disabled={isDeleting}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 rounded-lg text-white font-semibold ${
                  variant === "warning"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-red-500 hover:bg-red-600"
                }`}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default DeleteConfirmationModal;
