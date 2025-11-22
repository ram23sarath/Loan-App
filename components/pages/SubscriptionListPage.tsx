import React from "react";
import SubscriptionTableView from "./SubscriptionTableView";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import GlassCard from "../ui/GlassCard";
import PageWrapper from "../ui/PageWrapper";
import {
  HistoryIcon,
  Trash2Icon,
  FileDownIcon,
  WhatsAppIcon,
  SpinnerIcon,
} from "../../constants";
import { openWhatsApp } from "../../utils/whatsapp";
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
  const { subscriptions, deleteSubscription, isRefreshing, isScopedCustomer } = useData();

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

  const handleSendWhatsApp = (sub: SubscriptionWithCustomer) => {
    let message = `Hello ${
      sub.customers?.name || "Customer"
    },\n\nThis is a friendly reminder about your subscription for the year ${
      sub.year
    }. The amount is ₹${sub.amount.toLocaleString()}. We appreciate your support!`;
    // Append signature
    message += " Thank You, I J Reddy.";
    const phoneNumber = sub.customers?.phone;

    if (phoneNumber) {
      const ok = openWhatsApp(phoneNumber, message, { cooldownMs: 1200 });
      if (!ok) {
        // If opening failed, give user a fallback message
        alert(
          "Unable to open WhatsApp. Please try again or check the customer phone number."
        );
      }
    } else {
      alert("Customer phone number not available.");
    }
  };

  const handleExport = () => {
    const subsForExport = subscriptions.map((sub) => ({
      "Customer Name": sub.customers?.name ?? "Unknown",
      "Customer Phone": sub.customers?.phone ?? "N/A",
      Year: sub.year,
      Amount: sub.amount,
      Receipt: sub.receipt,
      Date: formatDate(sub.date),
    }));

    const ws = XLSX.utils.json_to_sheet(subsForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subscriptions");
    XLSX.writeFile(wb, "Subscriptions_Data.xlsx");
  };

  return (
    <PageWrapper>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0 px-2 sm:px-0">
        <h2 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 sm:gap-4">
          <HistoryIcon className="w-8 h-8 sm:w-10 sm:h-10" />
          <span>Subscription Details</span>
          {isRefreshing && (
            <SpinnerIcon className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-indigo-500" />
          )}
        </h2>
        <div className="flex items-center gap-4">
          {subscriptions.length > 0 && (
            <motion.button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 transition-colors p-2 sm:p-3 rounded-lg font-semibold w-auto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FileDownIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Export</span>
            </motion.button>
          )}
        </div>
      </div>

      <SubscriptionTableView
        onDelete={handleDeleteSubscription}
        deletingId={pendingDelete?.id ?? null}
      />

      {/* The Delete confirmation modal is moved here to be a sibling of the other views */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full flex flex-col items-center">
            <Trash2Icon className="w-10 h-10 text-red-500 mb-2" />
            <h3 className="text-lg font-bold mb-2 text-center">
              Delete Subscription?
            </h3>
            <p className="text-gray-700 text-center mb-4">
              Are you sure you want to delete the subscription for{" "}
              <span className="font-semibold">
                {pendingDelete.customers?.name}
              </span>{" "}
              ({pendingDelete.year})?
            </p>
            <div className="flex gap-4 w-full justify-center">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
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
          </div>
        </div>
      )}
    </PageWrapper>
  );
};

export default SubscriptionListPage;
