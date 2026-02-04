import React, { useState } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  notificationItemVariants,
  checkmarkVariants,
  checkmarkPathVariants,
} from "../constants/animations";

export interface Notification {
  id: number | string;
  message: string;
  status: "success" | "processing" | "warning" | "error";
  created_at: string;
  isLocal?: boolean;
}

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  loading: boolean;
  isScopedCustomer: boolean;
  isClearing: boolean;
  deletingNotificationId: number | string | null;
  swipedNotificationId: number | string | null;
  onDelete: (id: number | string) => void;
  onClearAll: () => void;
  onSwipe: (id: number | string, direction: "left" | "right") => void;
}

interface ClearMessagesControlProps {
  onClearAll: () => void;
}

const ClearMessagesControl: React.FC<ClearMessagesControlProps> = ({
  onClearAll,
}) => {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
          aria-label="Clear all notifications"
        >
          Clear Messages
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 dark:text-dark-muted">
            Are you sure?
          </span>
          <button
            onClick={() => {
              setConfirm(false);
              onClearAll();
            }}
            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            aria-label="Confirm clear notifications"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors dark:bg-dark-border dark:text-dark-muted"
            aria-label="Cancel clear notifications"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  loading,
  isScopedCustomer,
  isClearing,
  deletingNotificationId,
  swipedNotificationId,
  onDelete,
  onClearAll,
  onSwipe,
}) => {
  if (typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="notification-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4"
          onClick={onClose}
        >
          <motion.div
            key="notification-modal-content"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl relative dark:bg-dark-card dark:border dark:border-dark-border max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-dark-text flex items-center gap-2 flex-shrink-0">
                🔔 System Notifications
              </h3>
              {notifications.length > 0 && !isScopedCustomer && (
                <div className="mr-8">
                  {!isClearing && (
                    <ClearMessagesControl onClearAll={onClearAll} />
                  )}
                  {isClearing && (
                    <button
                      disabled
                      className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded opacity-60"
                    >
                      Snapping...
                    </button>
                  )}
                </div>
              )}{" "}
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors dark:text-dark-muted dark:hover:text-dark-text"
              aria-label="Close notifications modal"
            >
              ✕
            </button>
            <div className="flex-1 overflow-y-auto min-h-[100px] overflow-x-hidden p-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-indigo-600 dark:text-indigo-400 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                  <span className="text-sm font-medium">
                    Loading activity log...
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {notifications.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-8 text-gray-500 dark:text-dark-muted"
                      >
                        No recent system notifications found.
                      </motion.div>
                    ) : (
                      notifications.map((note) => {
                        const canDelete = !isScopedCustomer && !note.isLocal;
                        const isSwipedCard = swipedNotificationId === note.id;
                        const isBeingDeleted =
                          deletingNotificationId === note.id || isClearing;

                        return (
                          <motion.div
                            key={note.id}
                            layout
                            variants={notificationItemVariants}
                            initial="hidden"
                            animate={
                              isSwipedCard
                                ? "swipeExit"
                                : isBeingDeleted
                                  ? "exit"
                                  : "visible"
                            }
                            exit={isSwipedCard ? "swipeExit" : "exit"}
                            drag={canDelete && !isBeingDeleted ? "x" : false}
                            dragElastic={0.2}
                            dragMomentum={false}
                            onDragEnd={(event, info) => {
                              if (canDelete && !isBeingDeleted) {
                                const threshold = 100;
                                if (Math.abs(info.offset.x) > threshold) {
                                  onSwipe(
                                    note.id,
                                    info.offset.x > 0 ? "right" : "left",
                                  );
                                  onDelete(note.id);
                                }
                              }
                            }}
                            className={`w-full p-3 rounded-xl border flex items-start gap-3 relative overflow-hidden group ${canDelete ? "cursor-grab active:cursor-grabbing" : ""} ${
                              note.status === "success"
                                ? "bg-green-50 border-green-100 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
                                : note.status === "processing"
                                  ? "bg-blue-50 border-blue-100 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                  : note.status === "warning"
                                    ? "bg-amber-50 border-amber-100 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300"
                                    : "bg-red-50 border-red-100 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
                            }`}
                          >
                            {/* Swipe hint background */}
                            {canDelete && (
                              <motion.div
                                className="absolute inset-0 bg-red-200 dark:bg-red-900/40 flex items-center justify-center"
                                initial={{ opacity: 0 }}
                                whileHover={{ opacity: 0.15 }}
                              >
                                <span className="text-xl">🗑️</span>
                              </motion.div>
                            )}

                            {/* Checkmark animation when swiped */}
                            <AnimatePresence>
                              {isSwipedCard && (
                                <motion.div
                                  className="absolute inset-0 bg-green-500/90 dark:bg-green-600/90 rounded-xl flex items-center justify-center"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.1 }}
                                >
                                  <motion.svg
                                    width="56"
                                    height="56"
                                    viewBox="0 0 56 56"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    variants={checkmarkVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                  >
                                    <motion.path
                                      d="M12 28L22 38L44 16"
                                      variants={checkmarkPathVariants}
                                    />
                                  </motion.svg>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <span className="text-lg flex-shrink-0 mt-0.5 relative z-10">
                              {note.status === "success"
                                ? "✅"
                                : note.status === "processing"
                                  ? "⏳"
                                  : note.status === "warning"
                                    ? "⚠️"
                                    : "❌"}
                            </span>
                            <div className="flex flex-col gap-0.5 relative z-10 flex-1">
                              <span className="font-medium text-sm">
                                {note.message}
                              </span>
                              <span className="text-[10px] opacity-70">
                                {new Date(note.created_at).toLocaleString()}
                              </span>
                            </div>
                            {canDelete && (
                              <button
                                onClick={() => onDelete(note.id)}
                                disabled={isBeingDeleted}
                                className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-0.5 relative z-10"
                                title="Delete notification (or swipe)"
                                aria-label="Delete notification"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default NotificationModal;
