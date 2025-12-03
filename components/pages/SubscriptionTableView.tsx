import React from "react";
import { motion } from "framer-motion";
import { useData } from "../../context/DataContext";
import GlassCard from "../ui/GlassCard";
import { formatDate } from "../../utils/dateFormatter";
import { WhatsAppIcon, Trash2Icon } from "../../constants";
import { openWhatsApp } from "../../utils/whatsapp";
import { formatCurrencyIN } from "../../utils/numberFormatter";
import EditModal from "../modals/EditModal";

// Add props for delete
interface SubscriptionTableViewProps {
  onDelete: (sub: any) => void;
  deletingId?: string | null;
}

const SubscriptionTableView: React.FC<SubscriptionTableViewProps> = ({
  onDelete,
  deletingId,
}) => {
  const { subscriptions, updateSubscription, isScopedCustomer, scopedCustomerId, customers } = useData();
  const [editSubscriptionTarget, setEditSubscriptionTarget] = React.useState<
    any | null
  >(null);
  const [filter, setFilter] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 25;

  // Sorting state
  const [sortField, setSortField] = React.useState("");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc"
  );

  // First filter by scoped customer if applicable
  const scopedSubscriptions = isScopedCustomer && scopedCustomerId
    ? subscriptions.filter((sub) => sub.customer_id === scopedCustomerId)
    : subscriptions;

  const filteredSubscriptions = scopedSubscriptions.filter((sub) => {
    const customerName = sub.customers?.name?.toLowerCase() || "";
    const receipt = (sub.receipt || "").toLowerCase();
    return (
      customerName.includes(filter.toLowerCase()) ||
      receipt.includes(filter.toLowerCase())
    );
  });

  const sortedSubscriptions = React.useMemo(() => {
    let result = [...filteredSubscriptions];
    
    // If no sort field is set, sort by date descending (latest first)
    if (!sortField) {
      result.sort((a, b) => {
        const aDate = a.date ? new Date(a.date).getTime() : 0;
        const bDate = b.date ? new Date(b.date).getTime() : 0;
        return bDate - aDate;
      });
    } else {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        const compareMaybeNumeric = (x: any, y: any) => {
          const xs = x == null ? "" : String(x).trim();
          const ys = y == null ? "" : String(y).trim();
          const numeric = /^-?\d+(?:\.\d+)?$/;
          if (numeric.test(xs) && numeric.test(ys)) {
            return Number(xs) - Number(ys);
          }
          return xs.localeCompare(ys);
        };
        switch (sortField) {
          case "customer":
            aValue = a.customers?.name || "";
            bValue = b.customers?.name || "";
            break;
          case "amount":
            aValue = a.amount;
            bValue = b.amount;
            break;
          case "date":
            aValue = a.date;
            bValue = b.date;
            break;
          case "receipt":
            aValue = a.receipt || "";
            bValue = b.receipt || "";
            break;
          default:
            aValue = "";
            bValue = "";
        }
        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
        }
        const cmp = compareMaybeNumeric(aValue, bValue);
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [filteredSubscriptions, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedSubscriptions.length / itemsPerPage);
  const paginatedSubscriptions = sortedSubscriptions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  if (subscriptions.length === 0) {
    const emptyMessage = isScopedCustomer && scopedCustomerId
      ? (() => {
        const customer = customers.find(c => c.id === scopedCustomerId);
        return `No Subscription Entries for ${customer?.name || 'you'}`;
      })()
      : 'No subscriptions recorded yet.';

    return (
      <GlassCard>
        <p className="text-center text-gray-500">
          {emptyMessage}
        </p>
      </GlassCard>
    );
  }

  // Sorting handler
  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  return (
    <GlassCard className="overflow-x-auto">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Filter by customer or receipt..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 pr-10 w-full"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              aria-label="Clear filter"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {/* Desktop / Tablet table */}
      <table className="min-w-full border-collapse hidden md:table">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 border-b text-left cursor-pointer">#</th>
            <th
              className="px-4 py-2 border-b text-left cursor-pointer"
              onClick={() => handleSort("customer")}
            >
              Customer
            </th>
            <th
              className="px-4 py-2 border-b text-left cursor-pointer"
              onClick={() => handleSort("amount")}
            >
              Amount
            </th>
            <th
              className="px-4 py-2 border-b text-left cursor-pointer"
              onClick={() => handleSort("date")}
            >
              Date
            </th>
            <th
              className="px-4 py-2 border-b text-left cursor-pointer"
              onClick={() => handleSort("receipt")}
            >
              Receipt
            </th>
            <th
              className="px-4 py-2 border-b text-left cursor-pointer"
              onClick={() => handleSort("late_fee")}
            >
              Late Fee
            </th>
            <th className="px-4 py-2 border-b text-left">Send</th>
            <th className="px-4 py-2 border-b text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedSubscriptions.map((sub, idx) => {
            const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
            const customer = sub.customers;
            let message = "";
            let whatsappUrl = "#";
            let isValidPhone = false;
            if (
              customer &&
              customer.phone &&
              /^\d{10,15}$/.test(customer.phone)
            ) {
              isValidPhone = true;
              message = `Hi ${customer.name}, your subscription payment of ₹${sub.amount
                } was received on ${formatDate(
                  sub.date,
                  "whatsapp"
                )}. Receipt: ${sub.receipt || "-"}${sub.late_fee && sub.late_fee > 0
                  ? ` (including a late fee of ₹${sub.late_fee})`
                  : ""
                }`;
              // Append signature
              message += " Thank You, I J Reddy.";
              whatsappUrl = `https://wa.me/${customer.phone
                }?text=${encodeURIComponent(message)}`;
            }
            return (
              <motion.tr
                key={sub.id}
                className="even:bg-gray-50"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
                <td className="px-4 py-2 border-b font-medium text-sm text-gray-700">{actualIndex}</td>
                <td className="px-4 py-2 border-b">
                  {customer?.name ?? "Unknown"}
                </td>
                <td className="px-4 py-2 border-b">
                  ₹{sub.amount.toLocaleString()}
                </td>
                <td className="px-4 py-2 border-b">
                  {sub.date ? formatDate(sub.date) : "-"}
                </td>
                <td className="px-4 py-2 border-b">{sub.receipt || "-"}</td>
                <td className="px-4 py-2 border-b">
                  {typeof sub.late_fee === "number" && sub.late_fee > 0
                    ? `₹${sub.late_fee}`
                    : "-"}
                </td>
                <td className="px-4 py-2 border-b">
                  <button
                    onClick={() =>
                      isValidPhone &&
                      openWhatsApp(customer?.phone, message, {
                        cooldownMs: 1200,
                      })
                    }
                    className="p-1 rounded-full hover:bg-green-500/10 transition-colors"
                    aria-label={`Send subscription for ${customer?.name} on WhatsApp`}
                    disabled={!isValidPhone}
                  >
                    <WhatsAppIcon className="w-5 h-5 text-green-500" />
                  </button>
                </td>
                <td className="px-4 py-2 border-b">
                  <div className="flex gap-2">
                    {!isScopedCustomer && (
                      <>
                        <button
                          onClick={() => setEditSubscriptionTarget(sub)}
                          className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(sub)}
                          className="p-1 rounded-full hover:bg-red-500/10 transition-colors"
                          aria-label={`Delete subscription for ${customer?.name}`}
                          disabled={deletingId === sub.id}
                        >
                          <Trash2Icon className="w-5 h-5 text-red-500" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-3">
        {paginatedSubscriptions.map((sub, idx) => {
          const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
          const customer = sub.customers;
          let message = "";
          let whatsappUrl = "#";
          let isValidPhone = false;
          if (
            customer &&
            customer.phone &&
            /^\d{10,15}$/.test(customer.phone)
          ) {
            isValidPhone = true;
            message = `Hi ${customer.name
              }, your subscription payment of ${formatCurrencyIN(
                sub.amount
              )} was received on ${formatDate(
                sub.date,
                "whatsapp"
              )}. Receipt: ${sub.receipt || "-"}${sub.late_fee && sub.late_fee > 0
                ? ` (including a late fee of ${formatCurrencyIN(sub.late_fee)})`
                : ""
              }`;
            // Append signature
            message += " Thank You, I J Reddy.";
            whatsappUrl = `https://wa.me/${customer.phone
              }?text=${encodeURIComponent(message)}`;
          }

          return (
            <motion.div
              key={sub.id}
              className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-gray-400">#{actualIndex}</div>
                  <div className="text-sm font-semibold text-indigo-700 truncate">
                    {customer?.name ?? "Unknown"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(sub.date) || "-"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {formatCurrencyIN(sub.amount)}
                  </div>
                  <div className="text-xs text-gray-500">{sub.receipt || "-"}</div>
                </div>
              </div>
                  <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          isValidPhone &&
                          openWhatsApp(customer?.phone, message, {
                            cooldownMs: 1200,
                          })
                        }
                        className="p-2 rounded-md bg-green-50 text-green-600"
                        disabled={!isValidPhone}
                        aria-label={`Send subscription for ${customer?.name} on WhatsApp`}
                      >
                        <WhatsAppIcon className="w-5 h-5" />
                      </button>
                      {!isScopedCustomer && (
                        <button
                          onClick={() => setEditSubscriptionTarget(sub)}
                          className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                        >
                          Edit
                        </button>
                      )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600">
                    Receipt: {sub.receipt || "-"}
                  </div>
                      {!isScopedCustomer && (
                        <button
                          onClick={() => onDelete(sub)}
                          className="p-2 rounded-md bg-red-50 text-red-600"
                          aria-label={`Delete subscription for ${customer?.name}`}
                          disabled={deletingId === sub.id}
                        >
                          <Trash2Icon className="w-5 h-5" />
                        </button>
                      )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, sortedSubscriptions.length)} of{" "}
            {sortedSubscriptions.length} entries
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            
            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first, last, current, and neighbors
              if (
                page === 1 ||
                page === totalPages ||
                Math.abs(page - currentPage) <= 1
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded border ${
                      currentPage === page
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                );
              }
              // Show dots for skipped pages
              if (page === 2 && currentPage > 3) {
                return <span key="dots-start" className="px-2">...</span>;
              }
              if (page === totalPages - 1 && currentPage < totalPages - 2) {
                return <span key="dots-end" className="px-2">...</span>;
              }
              return null;
            })}
            
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Last
            </button>
          </div>
        </motion.div>
      )}

      {editSubscriptionTarget && (
        <EditModal
          type="subscription"
          data={editSubscriptionTarget}
          onClose={() => setEditSubscriptionTarget(null)}
          onSave={async (updated) => {
            try {
              const updates: any = {
                amount: Number(updated.amount),
                date: updated.date || null,
                receipt: updated.receipt || null,
                late_fee:
                  updated.late_fee !== undefined && updated.late_fee !== ""
                    ? Number(updated.late_fee)
                    : null,
              };
              await updateSubscription(editSubscriptionTarget.id, updates);
            } catch (err: any) {
              alert(err.message || String(err));
            } finally {
              setEditSubscriptionTarget(null);
            }
          }}
        />
      )}
    </GlassCard>
  );
};

export default SubscriptionTableView;
