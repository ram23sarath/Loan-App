import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useData } from "../../context/DataContext";
import GlassCard from "../ui/GlassCard";
import { formatDate } from "../../utils/dateFormatter";
import { WhatsAppIcon, Trash2Icon } from "../../constants";
import { openWhatsApp } from "../../utils/whatsapp";
import { formatCurrencyIN } from "../../utils/numberFormatter";
import EditModal from "../modals/EditModal";
import { useDebounce } from "../../utils/useDebounce";
import { 
  rowVariants, 
  cardVariants, 
  layoutTransition,
  prefersReducedMotion 
} from "../../utils/useRowDeleteAnimation";

// Add props for delete
interface SubscriptionTableViewProps {
  onDelete: (sub: any) => void;
  deletingId?: string | null;
}

const SubscriptionTableView: React.FC<SubscriptionTableViewProps> = ({
  onDelete,
  deletingId,
}) => {
  const { subscriptions, updateSubscription, isScopedCustomer, scopedCustomerId, customers, customerMap } = useData();
  const [editSubscriptionTarget, setEditSubscriptionTarget] = React.useState<
    any | null
  >(null);
  const [filter, setFilter] = React.useState("");
  const debouncedFilter = useDebounce(filter, 300);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 25;
  const [draggingCardId, setDraggingCardId] = React.useState<string | null>(null);

  // Page picker popup state
  const [pagePickerOpen, setPagePickerOpen] = React.useState<'start' | 'end' | null>(null);
  const [pagePickerOffset, setPagePickerOffset] = React.useState(0); // Which group of 9 pages to show

  // Sorting state
  const [sortField, setSortField] = React.useState("");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc"
  );

  // Memoize scoped and filtered subscriptions to prevent recalculation on every render
  const scopedSubscriptions = React.useMemo(() => {
    return isScopedCustomer && scopedCustomerId
      ? subscriptions.filter((sub) => sub.customer_id === scopedCustomerId)
      : subscriptions;
  }, [subscriptions, isScopedCustomer, scopedCustomerId]);

  const filteredSubscriptions = React.useMemo(() => {
    return scopedSubscriptions.filter((sub) => {
      const customerName = sub.customers?.name?.toLowerCase() || "";
      const receipt = (sub.receipt || "").toLowerCase();
      return (
        customerName.includes(debouncedFilter.toLowerCase()) ||
        receipt.includes(debouncedFilter.toLowerCase())
      );
    });
  }, [scopedSubscriptions, debouncedFilter]);

  const sortedSubscriptions = React.useMemo(() => {
    let result = [...filteredSubscriptions];

    // If no sort field is set, sort by date
    if (!sortField) {
      result.sort((a, b) => {
        const aDate = a.date ? new Date(a.date).getTime() : 0;
        const bDate = b.date ? new Date(b.date).getTime() : 0;

        // For scoped customers, show oldest first (Ascending)
        if (isScopedCustomer) {
          return aDate - bDate;
        }
        // For admins, show newest first (Descending)
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

  // Always show Late Fee column; don't hide it based on page contents

  // Reset to page 1 when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  if (subscriptions.length === 0) {
    const emptyMessage = isScopedCustomer && scopedCustomerId
      ? (() => {
        const customer = customerMap.get(scopedCustomerId);
        return `No Subscription Entries for ${customer?.name || 'you'}`;
      })()
      : 'No subscriptions recorded yet.';

    return (
      <GlassCard>
        <p className="text-center text-gray-500 dark:text-dark-muted">
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
    <GlassCard className="overflow-x-auto" disable3D>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Filter by customer or receipt..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 pr-10 w-full dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 dark:text-dark-muted dark:hover:text-dark-text"
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
          <tr className="bg-gray-100 dark:bg-slate-700">
            <th className="px-4 py-2 border-b text-left cursor-pointer dark:border-dark-border dark:text-dark-text">#</th>
            <th
              className="px-4 py-2 border-b text-left cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("customer")}
            >
              Customer
            </th>
            <th
              className="px-4 py-2 border-b text-left cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("amount")}
            >
              Amount
            </th>
            <th
              className="px-4 py-2 border-b text-center cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("date")}
            >
              Date
            </th>
            <th
              className="px-4 py-2 border-b text-center cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("receipt")}
            >
              Receipt
            </th>
            <th
              className="px-4 py-2 border-b text-center cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("late_fee")}
            >
              Late Fee
            </th>
            {!isScopedCustomer && (
              <th className="px-4 py-2 border-b text-center dark:border-dark-border dark:text-dark-text whitespace-nowrap">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout">
          {paginatedSubscriptions.map((sub, idx) => {
            const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
            const customer = sub.customers;
            const isDeleting = deletingId === sub.id;
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
                } was received on ${formatDate(sub.date, "whatsapp")}${sub.late_fee && sub.late_fee > 0
                  ? ` (Late fee: ₹${sub.late_fee})`
                  : ""
                }. Thank You, I J Reddy.`;
              whatsappUrl = `https://wa.me/${customer.phone
                }?text=${encodeURIComponent(message)}`;
            }
            return (
              <motion.tr
                key={sub.id}
                layout
                variants={rowVariants}
                initial="initial"
                animate={isDeleting ? 'deleting' : 'visible'}
                exit="exit"
                transition={layoutTransition}
                className={`even:bg-gray-50 dark:even:bg-slate-700/50 ${isDeleting ? 'pointer-events-none' : ''}`}
                style={{ overflow: 'hidden' }}
              >
                <td className="px-4 py-2 border-b font-medium text-sm text-gray-700 dark:border-dark-border dark:text-dark-muted">{actualIndex}</td>
                <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                  {customer?.name ?? "Unknown"}
                </td>
                <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                  ₹{sub.amount.toLocaleString()}
                </td>
                <td className="px-4 py-2 border-b text-center dark:border-dark-border dark:text-dark-text">
                  {sub.date ? formatDate(sub.date) : "-"}
                </td>
                <td className="px-4 py-2 border-b text-center dark:border-dark-border dark:text-dark-text">{sub.receipt || "-"}</td>
                <td className="px-4 py-2 border-b text-center dark:border-dark-border dark:text-dark-text">
                  {typeof sub.late_fee === "number" && sub.late_fee > 0
                    ? `₹${sub.late_fee}`
                    : "-"}
                </td>
                {!isScopedCustomer && (
                  <td className="px-4 py-2 border-b dark:border-dark-border">
                    <div className="flex gap-2 items-center justify-center whitespace-nowrap">
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
                      <>
                        <button
                          onClick={() => setEditSubscriptionTarget(sub)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onPointerDown={(e) => (e as any).stopPropagation()}
                          className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(sub)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onPointerDown={(e) => (e as any).stopPropagation()}
                          className="p-1 rounded-full hover:bg-red-500/10 transition-colors"
                          aria-label={`Delete subscription for ${customer?.name}`}
                          disabled={deletingId === sub.id}
                        >
                          <Trash2Icon className="w-5 h-5 text-red-500" />
                        </button>
                      </>
                    </div>
                  </td>
                )}
              </motion.tr>
            );
          })}
          </AnimatePresence>
        </tbody>
      </table>

      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-3">
        <AnimatePresence mode="popLayout">
        {paginatedSubscriptions.map((sub, idx) => {
          const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
          const customer = sub.customers;
          const isDeleting = deletingId === sub.id;
          let message = "";
          let whatsappUrl = "#";
          let isValidPhone = false;
          if (
            customer &&
            customer.phone &&
            /^\d{10,15}$/.test(customer.phone)
          ) {
            isValidPhone = true;
            message = `Hi ${customer.name}, your subscription payment of ${formatCurrencyIN(
              sub.amount
            )} was received on ${formatDate(sub.date, "whatsapp")}${sub.late_fee && sub.late_fee > 0
              ? ` (Late fee: ${formatCurrencyIN(sub.late_fee)})`
              : ""
              }. Thank You, I J Reddy.`;
            whatsappUrl = `https://wa.me/${customer.phone
              }?text=${encodeURIComponent(message)}`;
          }

          return (
            <motion.div 
              key={sub.id} 
              layout
              variants={cardVariants}
              initial="initial"
              animate={isDeleting ? 'deleting' : 'visible'}
              exit="exit"
              transition={layoutTransition}
              className={`relative ${isDeleting ? 'pointer-events-none' : ''}`}
              style={{ overflow: 'hidden' }}
            >
              {/* Swipe background indicators - only visible when dragging this card */}
              {draggingCardId === sub.id && !isDeleting && (
                <div className="absolute inset-0 flex rounded-lg overflow-hidden z-0">
                  <div
                    className={`${isScopedCustomer ? "w-full" : "w-1/2"} bg-green-500 flex items-center justify-start pl-4`}
                  >
                    <WhatsAppIcon className="w-6 h-6 text-white" />
                  </div>
                  {!isScopedCustomer && (
                    <div className="w-1/2 bg-red-500 flex items-center justify-end pr-4">
                      <Trash2Icon className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
              )}

              <motion.div
                className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm relative z-10 dark:bg-dark-card dark:border-dark-border"
                drag={isDeleting ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                dragMomentum={false}
                dragDirectionLock={true}
                style={{ touchAction: "pan-y" }}
                onDragStart={() => setDraggingCardId(sub.id)}
                onDragEnd={(_, info) => {
                  setDraggingCardId(null);
                  const threshold = 100;
                  if (info.offset.x < -threshold && !isScopedCustomer) {
                    // Swipe left - Delete
                    onDelete(sub);
                  } else if (info.offset.x > threshold && isValidPhone) {
                    // Swipe right - WhatsApp
                    openWhatsApp(customer?.phone, message, { cooldownMs: 1200 });
                  }
                }}
              >
                {/* Row 1: # Name and Amount */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 dark:text-dark-muted">#{actualIndex}</span>
                    <span className="text-sm font-semibold text-indigo-700 truncate dark:text-indigo-400">
                      {customer?.name ?? "Unknown"}
                    </span>
                  </div>
                  <div className="text-lg font-bold dark:text-dark-text">
                    {formatCurrencyIN(sub.amount)}
                  </div>
                </div>

                {/* Row 2: Date */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Date: {formatDate(sub.date) || "-"}
                </div>

                {/* Row 3: Receipt Number (and Late Fee if exists) */}
                <div className="text-xs text-gray-500 mt-1 flex justify-between dark:text-dark-muted">
                  <span>Receipt: {sub.receipt || "-"}</span>
                  {typeof sub.late_fee === "number" && sub.late_fee > 0 && (
                    <span className="text-red-500">Late Fee: {formatCurrencyIN(sub.late_fee)}</span>
                  )}
                </div>

                {/* Row 4: Action buttons */}
                <div className="mt-3 flex items-center justify-evenly">
                  <button
                    onClick={() =>
                      isValidPhone &&
                      openWhatsApp(customer?.phone, message, {
                        cooldownMs: 1200,
                      })
                    }
                    className="p-2 rounded-md bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    disabled={!isValidPhone}
                    aria-label={`Send subscription for ${customer?.name} on WhatsApp`}
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                  </button>
                  {!isScopedCustomer && (
                    <button
                      onClick={() => setEditSubscriptionTarget(sub)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onPointerDown={(e) => (e as any).stopPropagation()}
                      className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                    >
                      Edit
                    </button>
                  )}
                  {!isScopedCustomer && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(sub); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onPointerDown={(e) => (e as any).stopPropagation()}
                      className="p-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      aria-label={`Delete subscription for ${customer?.name}`}
                      disabled={deletingId === sub.id}
                    >
                      <Trash2Icon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
          <div className="text-sm text-gray-600 dark:text-dark-muted">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, sortedSubscriptions.length)} of{" "}
            {sortedSubscriptions.length} subscriptions
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Always show first, last, current, and neighbors
              if (
                page === 1 ||
                page === totalPages ||
                Math.abs(page - currentPage) <= 1
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => {
                      setCurrentPage(page);
                      setPagePickerOpen(null);
                    }}
                    className={`px-3 py-1 rounded border ${currentPage === page
                      ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-600"
                      : "border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-slate-700"
                      }`}
                  >
                    {page}
                  </button>
                );
              }
              // Start ellipsis - pages between 1 and current-1
              if (page === 2 && currentPage > 3) {
                const startPages = Array.from({ length: currentPage - 3 }, (_, i) => i + 2);
                const maxOffset = Math.max(0, Math.ceil(startPages.length / 9) - 1);
                const visiblePages = startPages.slice(pagePickerOffset * 9, (pagePickerOffset + 1) * 9);

                return (
                  <div key="dots-start" className="relative">
                    <button
                      onClick={() => {
                        setPagePickerOpen(pagePickerOpen === 'start' ? null : 'start');
                        setPagePickerOffset(0);
                      }}
                      className="px-2 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                      title="Click to show more pages"
                    >
                      ...
                    </button>
                    {pagePickerOpen === 'start' && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-2 z-50 min-w-[140px]">
                        {/* Navigation arrows */}
                        <div className="flex items-center justify-between mb-2 px-1">
                          <button
                            onClick={() => setPagePickerOffset(Math.max(0, pagePickerOffset - 1))}
                            disabled={pagePickerOffset === 0}
                            className="p-1 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ‹
                          </button>
                          <span className="text-xs text-gray-500 dark:text-dark-muted">
                            {pagePickerOffset * 9 + 1}-{Math.min((pagePickerOffset + 1) * 9, startPages.length)} of {startPages.length}
                          </span>
                          <button
                            onClick={() => setPagePickerOffset(Math.min(maxOffset, pagePickerOffset + 1))}
                            disabled={pagePickerOffset >= maxOffset}
                            className="p-1 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ›
                          </button>
                        </div>
                        {/* 3x3 grid of pages */}
                        <div className="grid grid-cols-3 gap-1">
                          {visiblePages.map((p) => (
                            <button
                              key={p}
                              onClick={() => {
                                setCurrentPage(p);
                                setPagePickerOpen(null);
                              }}
                              className={`px-2 py-1 text-sm rounded ${currentPage === p
                                ? "bg-indigo-600 text-white"
                                : "text-gray-700 dark:text-dark-text hover:bg-indigo-100 dark:hover:bg-slate-600"
                                }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              // End ellipsis - pages between current+1 and totalPages-1
              if (page === totalPages - 1 && currentPage < totalPages - 2) {
                const endPages = Array.from({ length: totalPages - currentPage - 2 }, (_, i) => currentPage + 2 + i);
                const maxOffset = Math.max(0, Math.ceil(endPages.length / 9) - 1);
                const visiblePages = endPages.slice(pagePickerOffset * 9, (pagePickerOffset + 1) * 9);

                return (
                  <div key="dots-end" className="relative">
                    <button
                      onClick={() => {
                        setPagePickerOpen(pagePickerOpen === 'end' ? null : 'end');
                        setPagePickerOffset(0);
                      }}
                      className="px-2 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                      title="Click to show more pages"
                    >
                      ...
                    </button>
                    {pagePickerOpen === 'end' && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-2 z-50 min-w-[140px]">
                        {/* Navigation arrows */}
                        <div className="flex items-center justify-between mb-2 px-1">
                          <button
                            onClick={() => setPagePickerOffset(Math.max(0, pagePickerOffset - 1))}
                            disabled={pagePickerOffset === 0}
                            className="p-1 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ‹
                          </button>
                          <span className="text-xs text-gray-500 dark:text-dark-muted">
                            {pagePickerOffset * 9 + 1}-{Math.min((pagePickerOffset + 1) * 9, endPages.length)} of {endPages.length}
                          </span>
                          <button
                            onClick={() => setPagePickerOffset(Math.min(maxOffset, pagePickerOffset + 1))}
                            disabled={pagePickerOffset >= maxOffset}
                            className="p-1 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ›
                          </button>
                        </div>
                        {/* 3x3 grid of pages */}
                        <div className="grid grid-cols-3 gap-1">
                          {visiblePages.map((p) => (
                            <button
                              key={p}
                              onClick={() => {
                                setCurrentPage(p);
                                setPagePickerOpen(null);
                              }}
                              className={`px-2 py-1 text-sm rounded ${currentPage === p
                                ? "bg-indigo-600 text-white"
                                : "text-gray-700 dark:text-dark-text hover:bg-indigo-100 dark:hover:bg-slate-600"
                                }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })}

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Last
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
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
      </AnimatePresence>
    </GlassCard>
  );
};

export default SubscriptionTableView;
