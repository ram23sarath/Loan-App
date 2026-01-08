import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon } from "../../constants";
import { formatCurrencyIN } from "../../utils/numberFormatter";
import { formatDate } from "../../utils/dateFormatter";
import PagePickerPopover from "./PagePickerPopover";
import useFocusTrap from "../hooks/useFocusTrap";

type Item = {
  id?: string;
  date?: string;
  amount: number;
  receipt?: string;
  notes?: string;
  source?: string;
  customer?: string;
  remaining?: number;
  extra?: Record<string, any>;
};

interface SummaryLine {
  label: string;
  value: number;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface Props {
  open: boolean;
  title: string;
  items: Item[];
  onClose: () => void;
  summary?: SummaryLine[];
  pagination?: Pagination;
}

const FYBreakdownModal: React.FC<Props> = ({
  open,
  title,
  items,
  onClose,
  summary = [],
  pagination,
}) => {
  const [pagePickerOpen, setPagePickerOpen] = useState<"start" | "end" | null>(
    null
  );
  const [pagePickerOffset, setPagePickerOffset] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Generate unique IDs for ARIA attributes
  const modalId = `fy-breakdown-modal-${Date.now()}`;
  const titleId = `${modalId}-title`;
  const contentId = `${modalId}-content`;

  // Ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];
  const target = typeof document !== "undefined" ? document.body : null;
  const hasSource = safeItems.some((it) => !!it.source);
  const hasRemaining = safeItems.some((it) => it.remaining !== undefined);
  const shouldDisplaySource =
    hasSource &&
    !title.includes("Late Fees") &&
    !title.includes("Interest") &&
    !title.includes("Subscriptions");

  // Generate gridTemplateColumns based on visible columns
  const visibleColumnCount =
    4 + (shouldDisplaySource ? 1 : 0) + (hasRemaining ? 1 : 0); // DATE, CUSTOMER, AMOUNT, NOTES + optional SOURCE + optional REMAINING
  const gridTemplateColumns = `repeat(${visibleColumnCount}, 1fr)`;

  // Apply focus trap when modal opens
  useFocusTrap(dialogRef, "button[class*='rounded']:first-of-type");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
          role="presentation"
        >
          <motion.div
            ref={dialogRef}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 md:p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto dark:text-gray-100"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={contentId}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id={titleId} className="text-xl font-semibold">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close modal"
              >
                <XIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {safeItems.length === 0 && summary.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No records for this category in the selected financial year.
              </p>
            ) : (
              <div id={contentId} className="space-y-2">
                {summary.length > 0 && (
                  <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    {summary.map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="text-gray-700 dark:text-gray-300">
                          {s.label}
                        </div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrencyIN(s.value)}
                        </div>
                      </div>
                    ))}
                    <div className="mt-2 border-t pt-2" />
                  </div>
                )}
                <div
                  className="hidden md:grid gap-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 p-2 rounded"
                  style={{ display: "grid", gridTemplateColumns }}
                >
                  <div>Date</div>
                  <div>Customer</div>
                  {shouldDisplaySource && <div>Source</div>}
                  {hasRemaining && <div className="text-right">Remaining</div>}
                  <div className="text-right">Amount</div>
                  <div>Notes / Receipt</div>
                </div>
                {safeItems.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    No records available for this breakdown.
                  </div>
                ) : (
                  safeItems.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      className="grid gap-3 p-3 border-b dark:border-gray-700 last:border-b-0 md:gap-3 md:px-3 md:py-3 md:items-start"
                      style={{
                        display: "grid",
                        gridTemplateColumns,
                        gridAutoRows: "auto",
                      }}
                    >
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="block text-xs text-gray-500 dark:text-gray-500 md:hidden mb-1">
                          Date
                        </span>
                        {it.date ? formatDate(it.date) : "-"}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 font-medium md:font-normal">
                        <span className="block text-xs text-gray-500 dark:text-gray-500 md:hidden mb-1">
                          Customer
                        </span>
                        {it.customer || "-"}
                      </div>
                      {shouldDisplaySource && (
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="block text-xs text-gray-500 dark:text-gray-500 md:hidden mb-1">
                            Source
                          </span>
                          {it.source || "-"}
                        </div>
                      )}
                      {hasRemaining && (
                        <div className="text-sm text-right text-gray-700 dark:text-gray-300">
                          <span className="block text-xs text-gray-500 dark:text-gray-500 md:hidden mb-1">
                            Remaining
                          </span>
                          {formatCurrencyIN(it.remaining ?? 0)}
                        </div>
                      )}
                      <div className="text-sm font-medium text-right text-gray-800 dark:text-gray-200">
                        <span className="block text-xs text-gray-500 dark:text-gray-500 md:hidden mb-1">
                          Amount
                        </span>
                        {formatCurrencyIN(it.amount)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="block text-xs text-gray-500 dark:text-gray-500 md:hidden mb-1">
                          Notes / Receipt
                        </span>
                        {it.receipt || it.notes || "-"}
                      </div>
                    </div>
                  ))
                )}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing page {pagination.currentPage} of{" "}
                      {pagination.totalPages}
                    </div>
                    <div className="flex gap-2 flex-wrap justify-center">
                      <button
                        onClick={() => pagination.onPageChange(1)}
                        disabled={pagination.currentPage === 1}
                        className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        First
                      </button>
                      <button
                        onClick={() =>
                          pagination.onPageChange(
                            Math.max(1, pagination.currentPage - 1)
                          )
                        }
                        disabled={pagination.currentPage === 1}
                        className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        Previous
                      </button>

                      {Array.from(
                        { length: pagination.totalPages },
                        (_, i) => i + 1
                      ).map((page) => {
                        // Always show first, last, current, and neighbors
                        if (
                          page === 1 ||
                          page === pagination.totalPages ||
                          Math.abs(page - pagination.currentPage) <= 1
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => {
                                pagination.onPageChange(page);
                                setPagePickerOpen(null);
                              }}
                              className={`px-3 py-1 rounded border ${
                                pagination.currentPage === page
                                  ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-600"
                                  : "border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-slate-700"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        }
                        // Start ellipsis - pages between 1 and current-1
                        if (page === 2 && pagination.currentPage > 3) {
                          const startPages = Array.from(
                            { length: pagination.currentPage - 3 },
                            (_, i) => i + 2
                          );
                          return (
                            <div key="dots-start">
                              <PagePickerPopover
                                pages={startPages}
                                currentPage={pagination.currentPage}
                                onPageChange={pagination.onPageChange}
                                openKey="start"
                                isOpen={pagePickerOpen === "start"}
                                setOpen={setPagePickerOpen}
                                offset={pagePickerOffset}
                                setOffset={setPagePickerOffset}
                                label="Start Pages"
                              />
                            </div>
                          );
                        }
                        // End ellipsis - pages between current+1 and totalPages-1
                        if (
                          page === pagination.totalPages - 1 &&
                          pagination.currentPage < pagination.totalPages - 2
                        ) {
                          const endPages = Array.from(
                            {
                              length:
                                pagination.totalPages -
                                pagination.currentPage -
                                2,
                            },
                            (_, i) => pagination.currentPage + 2 + i
                          );
                          return (
                            <div key="dots-end">
                              <PagePickerPopover
                                pages={endPages}
                                currentPage={pagination.currentPage}
                                onPageChange={pagination.onPageChange}
                                openKey="end"
                                isOpen={pagePickerOpen === "end"}
                                setOpen={setPagePickerOpen}
                                offset={pagePickerOffset}
                                setOffset={setPagePickerOffset}
                                label="End Pages"
                              />
                            </div>
                          );
                        }
                        return null;
                      })}

                      <button
                        onClick={() =>
                          pagination.onPageChange(
                            Math.min(
                              pagination.totalPages,
                              pagination.currentPage + 1
                            )
                          )
                        }
                        disabled={
                          pagination.currentPage === pagination.totalPages
                        }
                        className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        Next
                      </button>
                      <button
                        onClick={() =>
                          pagination.onPageChange(pagination.totalPages)
                        }
                        disabled={
                          pagination.currentPage === pagination.totalPages
                        }
                        className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!target) return modalContent;
  return ReactDOM.createPortal(modalContent, target);
};

export default FYBreakdownModal;
