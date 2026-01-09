import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";
import SubscriptionTableView from "./SubscriptionTableView";
import { useData } from "../../context/DataContext";
import PageWrapper from "../ui/PageWrapper";
import { HistoryIcon, Trash2Icon, SpinnerIcon } from "../../constants";
import type { SubscriptionWithCustomer } from "../../types";
import { formatDate } from "../../utils/dateFormatter";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const SubscriptionListPage = () => {
  const { subscriptions, deleteSubscription, isRefreshing, isScopedCustomer } =
    useData();

  // always use table view for subscriptions
  const [pendingDelete, setPendingDelete] =
    React.useState<SubscriptionWithCustomer | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleDeleteSubscription = (sub: SubscriptionWithCustomer) => {
    setPendingDelete(sub);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSubscription(pendingDelete.id);
      setPendingDelete(null);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Close delete confirmation modal with Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pendingDelete) {
        setPendingDelete(null);
      }
    };
    if (pendingDelete) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
    return;
  }, [pendingDelete]);

  return (
    <PageWrapper>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0 px-2 sm:px-0">
        <h2 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 sm:gap-4 text-gray-800 dark:text-dark-text">
          <HistoryIcon className="w-8 h-8 sm:w-10 sm:h-10" />
          <span>Subscription Details</span>
          {isRefreshing && (
            <SpinnerIcon className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-indigo-500" />
          )}
        </h2>
      </div>

      <SubscriptionTableView
        onDelete={handleDeleteSubscription}
        deletingId={pendingDelete?.id ?? null}
      />

      {/* The Delete confirmation modal is portalled to document.body to avoid transformed ancestors affecting fixed positioning */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {pendingDelete && (
            <motion.div
              key="pending-delete-backdrop"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                key="pending-delete-content"
                className="bg-white rounded-xl shadow-lg p-6 md:p-8 w-[90%] max-w-md flex flex-col items-center dark:bg-dark-card dark:border dark:border-dark-border"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <Trash2Icon className="w-10 h-10 text-red-500 mb-2" />
                <h3 className="text-lg font-bold mb-2 text-center text-gray-800 dark:text-dark-text">
                  Delete Subscription?
                </h3>
                <p className="text-gray-700 text-center mb-4 dark:text-dark-muted">
                  Are you sure you want to delete the subscription for{" "}
                  <span className="font-semibold">
                    {pendingDelete.customers?.name}
                  </span>{" "}
                  from {formatDate(pendingDelete.date)}?
                </p>
                <div className="flex gap-4 w-full justify-center">
                  <button
                    onClick={() => setPendingDelete(null)}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </PageWrapper>
  );
};

export default SubscriptionListPage;
