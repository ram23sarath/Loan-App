import React, { useState } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  notificationItemVariants,
  checkmarkVariants,
  checkmarkPathVariants,
} from "../constants/animations";
import {
  NOTIFICATION_FILTER_KEYS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
} from "../../../../shared/notificationSchema.js";

export interface Notification {
  id: number | string;
  message: string;
  status: (typeof NOTIFICATION_STATUSES)[keyof typeof NOTIFICATION_STATUSES];
  type: (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES] | string;
  created_at: string;
  metadata?: Record<string, any> | null;
  isLocal?: boolean;
}

type NotificationFilterKey =
  (typeof NOTIFICATION_FILTER_KEYS)[keyof typeof NOTIFICATION_FILTER_KEYS];

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  loading: boolean;
  hasMoreNotifications: boolean;
  isScopedCustomer: boolean;
  isClearing: boolean;
  deletingNotificationId: number | string | null;
  swipedNotificationId: number | string | null;
  onDelete: (id: number | string) => void;
  onClearAll: () => void;
  onLoadMore: () => void;
  onSwipe: (id: number | string, direction: "left" | "right") => void;
  error?: string | null;
  onRetry?: () => void;
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
          aria-label="Mark all notifications as read"
        >
          Mark All Read
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
            aria-label="Confirm mark all notifications read"
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
  error,
  onRetry,
  hasMoreNotifications,
  isScopedCustomer,
  isClearing,
  deletingNotificationId,
  swipedNotificationId,
  onDelete,
  onClearAll,
  onLoadMore,
  onSwipe,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<
    (typeof NOTIFICATION_FILTER_KEYS)[keyof typeof NOTIFICATION_FILTER_KEYS]
  >(NOTIFICATION_FILTER_KEYS.ALL);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: number | string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredNotifications = notifications.filter((note) => {
    if (selectedFilter === NOTIFICATION_FILTER_KEYS.ALL) return true;
    if (selectedFilter === NOTIFICATION_FILTER_KEYS.QUARTERLY_INTEREST) {
      return note.type === NOTIFICATION_TYPES.QUARTERLY_INTEREST;
    }
    if (selectedFilter === NOTIFICATION_FILTER_KEYS.SENIORITY) {
      return note.type === NOTIFICATION_TYPES.SENIORITY_REQUEST;
    }
    if (selectedFilter === NOTIFICATION_FILTER_KEYS.DEFAULTS) {
      return note.type === NOTIFICATION_TYPES.INSTALLMENT_DEFAULT;
    }
    return true;
  });

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
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {(() => {
                const tabs: { key: NotificationFilterKey; label: string }[] = [
                  { key: NOTIFICATION_FILTER_KEYS.ALL, label: "All" },
                  {
                    key: NOTIFICATION_FILTER_KEYS.QUARTERLY_INTEREST,
                    label: "Quarterly Interest",
                  },
                  {
                    key: NOTIFICATION_FILTER_KEYS.SENIORITY,
                    label: "Seniority",
                  },
                  { key: NOTIFICATION_FILTER_KEYS.DEFAULTS, label: "Defaults" },
                ];

                return tabs.map((tab) => {
                  const active = selectedFilter === tab.key;
                  return (
                    <button
                      key={String(tab.key)}
                      onClick={() => setSelectedFilter(tab.key)}
                      className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-dark-card dark:text-dark-muted dark:border-dark-border dark:hover:bg-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                });
              })()}
            </div>
            <div className="flex-1 overflow-y-auto min-h-[100px] overflow-x-hidden p-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-indigo-600 dark:text-indigo-400 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
                  <span className="text-sm font-medium">
                    Loading activity log...
                  </span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-red-600 dark:text-red-400 py-8">
                  <div className="text-sm font-semibold">
                    Failed to load notifications
                  </div>
                  <div className="text-xs opacity-80 max-w-xl text-center">
                    {error}
                  </div>
                  {onRetry && (
                    <div className="pt-4">
                      <button
                        onClick={onRetry}
                        className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-dark-border dark:text-dark-text dark:hover:bg-slate-700"
                      >
                        Retry
                      </button>
                    </div>
                  )}{" "}
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filteredNotifications.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-8 text-gray-500 dark:text-dark-muted"
                      >
                        No recent system notifications found.
                      </motion.div>
                    ) : (
                      filteredNotifications.map((note) => {
                        const canDelete = !isScopedCustomer && !note.isLocal;
                        const isSwipedCard = swipedNotificationId === note.id;
                        const isBeingDeleted =
                          deletingNotificationId === note.id || isClearing;
                        const isExpanded = expandedRows.has(String(note.id));
                        const isQuarterly =
                          note.type === NOTIFICATION_TYPES.QUARTERLY_INTEREST;
                        const metadata = note.metadata || {};
                        const sampledCustomers =
                          metadata.sampled_customers || {};
                        const successfulCustomers =
                          sampledCustomers.success || [];
                        const skippedCustomers = sampledCustomers.skipped || [];
                        const errorCustomers = sampledCustomers.errors || [];
                        const totalInterestCollected = metadata.total_interest;

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
                              note.status === NOTIFICATION_STATUSES.SUCCESS
                                ? "bg-green-50 border-green-100 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
                                : note.status === NOTIFICATION_STATUSES.PENDING
                                  ? "bg-blue-50 border-blue-100 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                  : note.status ===
                                      NOTIFICATION_STATUSES.WARNING
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
                              {note.status === NOTIFICATION_STATUSES.SUCCESS
                                ? "✅"
                                : note.status === NOTIFICATION_STATUSES.PENDING
                                  ? "⏳"
                                  : note.status ===
                                      NOTIFICATION_STATUSES.WARNING
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
                              {isQuarterly && (
                                <>
                                  <button
                                    onClick={() => toggleExpanded(note.id)}
                                    className="mt-1 text-xs underline opacity-90 hover:opacity-100 text-left"
                                  >
                                    {isExpanded
                                      ? "Hide details"
                                      : "View details"}
                                  </button>
                                  <AnimatePresence initial={false}>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-2 text-xs space-y-1 overflow-hidden"
                                      >
                                        <div>
                                          Quarter:{" "}
                                          <strong>
                                            {metadata.quarter || "-"}
                                          </strong>{" "}
                                          ({metadata.period_start || "-"} →{" "}
                                          {metadata.period_end || "-"})
                                        </div>
                                        <div>
                                          FY:{" "}
                                          <strong>{metadata.fy || "-"}</strong>
                                        </div>
                                        <div>
                                          Total Interest Collected:{" "}
                                          <strong>
                                            ₹
                                            {Number(
                                              totalInterestCollected || 0,
                                            ).toLocaleString("en-IN")}
                                          </strong>
                                        </div>
                                        <div>
                                          Processed:{" "}
                                          <strong>
                                            {metadata.total_customers_processed ??
                                              0}
                                          </strong>{" "}
                                          | Success:{" "}
                                          <strong>
                                            {metadata.success_count ?? 0}
                                          </strong>{" "}
                                          | Skipped:{" "}
                                          <strong>
                                            {metadata.skipped_count ?? 0}
                                          </strong>{" "}
                                          | Errors:{" "}
                                          <strong>
                                            {metadata.error_count ?? 0}
                                          </strong>
                                        </div>

                                        {successfulCustomers.length > 0 && (
                                          <div>
                                            <div className="font-semibold">
                                              Sample Success
                                            </div>
                                            <ul className="list-disc pl-4">
                                              {successfulCustomers.map(
                                                (customer: any) => (
                                                  <li key={`ok-${customer.id}`}>
                                                    {customer.name}: ₹
                                                    {Number(
                                                      customer.interest_charged ||
                                                        0,
                                                    ).toLocaleString("en-IN")}
                                                  </li>
                                                ),
                                              )}
                                            </ul>
                                          </div>
                                        )}

                                        {skippedCustomers.length > 0 && (
                                          <div>
                                            <div className="font-semibold">
                                              Sample Skipped
                                            </div>
                                            <ul className="list-disc pl-4">
                                              {skippedCustomers.map(
                                                (customer: any) => (
                                                  <li
                                                    key={`skip-${customer.id}`}
                                                  >
                                                    {customer.name}:{" "}
                                                    {customer.reason}
                                                  </li>
                                                ),
                                              )}
                                            </ul>
                                          </div>
                                        )}

                                        {errorCustomers.length > 0 && (
                                          <div>
                                            <div className="font-semibold">
                                              Sample Errors
                                            </div>
                                            <ul className="list-disc pl-4">
                                              {errorCustomers.map(
                                                (customer: any) => (
                                                  <li
                                                    key={`err-${customer.id}`}
                                                  >
                                                    {customer.name}:{" "}
                                                    {customer.error}
                                                  </li>
                                                ),
                                              )}
                                            </ul>
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </>
                              )}
                            </div>
                            {canDelete && (
                              <button
                                onClick={() => onDelete(note.id)}
                                disabled={isBeingDeleted}
                                className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-0.5 relative z-10"
                                title="Mark notification as read (or swipe)"
                                aria-label="Mark notification as read"
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
                  {!loading && hasMoreNotifications && (
                    <div className="pt-2 flex justify-center">
                      <button
                        onClick={onLoadMore}
                        className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-dark-border dark:text-dark-text dark:hover:bg-slate-700"
                      >
                        Load More
                      </button>
                    </div>
                  )}
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
