import React from "react";
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from "framer-motion";
import { useData } from "../../context/DataContext";
import { Trash2Icon, WhatsAppIcon } from "../../constants";
import { openWhatsApp } from "../../utils/whatsapp";
import { formatCurrencyIN } from "../../utils/numberFormatter";
import GlassCard from "../ui/GlassCard";
import { formatDate } from "../../utils/dateFormatter";
import type { LoanWithCustomer, Installment } from "../../types";
import EditModal from "../modals/EditModal";
import { useDebounce } from "../../utils/useDebounce";

// ... (All animation variants remain unchanged) ...
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
  exit: { y: -20, opacity: 0 },
};
const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
const modalContentVariants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 200, damping: 20 },
  },
  exit: { scale: 0.9, opacity: 0 },
};

const LoanTableView: React.FC = () => {
  const {
    loans,
    installments,
    installmentsByLoanId,
    customerMap,
    deleteInstallment,
    deleteLoan,
    updateInstallment,
    updateLoan,
    customers,
    isScopedCustomer,
    scopedCustomerId,
  } = useData();
  const [filter, setFilter] = React.useState("");
  const debouncedFilter = useDebounce(filter, 300);
  const [statusFilter, setStatusFilter] = React.useState("");
  // Default to sorting by status so "In Progress" loans appear first
  const [sortField, setSortField] = React.useState("status");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 25;

  // Page picker popup state
  const [pagePickerOpen, setPagePickerOpen] = React.useState<'start' | 'end' | null>(null);
  const [pagePickerOffset, setPagePickerOffset] = React.useState(0);

  // Helper function for O(1) installment lookup
  const getLoanInstallments = React.useCallback((loanId: string) => {
    return installmentsByLoanId.get(loanId) || [];
  }, [installmentsByLoanId]);

  // Memoize filtered loans to prevent recalculation on every render
  const filteredLoans = React.useMemo(() => {
    return loans.filter((loan) => {
      // Filter by scoped customer if applicable
      if (isScopedCustomer && scopedCustomerId && loan.customer_id !== scopedCustomerId) {
        return false;
      }

      const customerName = loan.customers?.name?.toLowerCase() || "";
      const checkNumber = (loan.check_number || "").toLowerCase();
      const status = (() => {
        const totalRepayable = loan.original_amount + loan.interest_amount;
        const loanInsts = getLoanInstallments(loan.id);
        const paid = loanInsts.reduce((acc, inst) => acc + inst.amount, 0);
        return paid >= totalRepayable ? "Paid Off" : "In Progress";
      })();
      const matchesText =
        customerName.includes(debouncedFilter.toLowerCase()) ||
        checkNumber.includes(debouncedFilter.toLowerCase());
      const matchesStatus = statusFilter === "" || status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [loans, debouncedFilter, statusFilter, isScopedCustomer, scopedCustomerId, getLoanInstallments]);

  const sortedLoans = React.useMemo(() => {
    if (!sortField) return filteredLoans;
    return [...filteredLoans].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      // small helper: if both values are purely numeric strings, compare numerically
      const compareMaybeNumeric = (x: any, y: any) => {
        const xs = x == null ? "" : String(x).trim();
        const ys = y == null ? "" : String(y).trim();
        const numeric = /^-?\d+(?:\.\d+)?$/;
        if (numeric.test(xs) && numeric.test(ys)) {
          return Number(xs) - Number(ys);
        }
        // fallback to locale compare
        return xs.localeCompare(ys);
      };
      // Use O(1) lookup instead of O(n) filter
      const aInsts = getLoanInstallments(a.id);
      const bInsts = getLoanInstallments(b.id);
      switch (sortField) {
        case "customer":
          aValue = a.customers?.name || "";
          bValue = b.customers?.name || "";
          break;
        case "loan_amount":
          aValue = a.original_amount;
          bValue = b.original_amount;
          break;
        case "interest":
          aValue = a.interest_amount;
          bValue = b.interest_amount;
          break;
        case "total_repayable":
          aValue = a.original_amount + a.interest_amount;
          bValue = b.original_amount + b.interest_amount;
          break;
        case "paid":
          aValue = aInsts.reduce((acc, inst) => acc + inst.amount, 0);
          bValue = bInsts.reduce((acc, inst) => acc + inst.amount, 0);
          break;
        case "balance":
          aValue =
            a.original_amount +
            a.interest_amount -
            aInsts.reduce((acc, inst) => acc + inst.amount, 0);
          bValue =
            b.original_amount +
            b.interest_amount -
            bInsts.reduce((acc, inst) => acc + inst.amount, 0);
          break;
        case "check_number":
          aValue = a.check_number || "";
          bValue = b.check_number || "";
          break;
        case "installments":
          aValue = aInsts.length;
          bValue = bInsts.length;
          break;
        case "total_installments":
          aValue = a.total_instalments;
          bValue = b.total_instalments;
          break;
        case "payment_date":
          aValue = a.payment_date;
          bValue = b.payment_date;
          break;
        case "status":
          aValue = (() => {
            const totalRepayable = a.original_amount + a.interest_amount;
            const paid = aInsts.reduce((acc, inst) => acc + inst.amount, 0);
            return paid >= totalRepayable ? "Paid Off" : "In Progress";
          })();
          bValue = (() => {
            const totalRepayable = b.original_amount + b.interest_amount;
            const paid = bInsts.reduce((acc, inst) => acc + inst.amount, 0);
            return paid >= totalRepayable ? "Paid Off" : "In Progress";
          })();
          break;
        default:
          aValue = "";
          bValue = "";
      }
      // if both are numbers, numeric compare
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      // use numeric-aware compare for strings (covers check_number and receipt-like values)
      const cmp = compareMaybeNumeric(aValue, bValue);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredLoans, sortField, sortDirection, getLoanInstallments]);

  // Paginate the sorted loans
  const totalPages = Math.ceil(sortedLoans.length / itemsPerPage);
  const paginatedLoans = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedLoans.slice(start, end);
  }, [sortedLoans, currentPage, itemsPerPage]);

  // Reset to page 1 when filters or sorting changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilter, statusFilter, sortField, sortDirection]);

  if (loans.length === 0) {
    const emptyMessage = isScopedCustomer && scopedCustomerId
      ? (() => {
        const customer = customerMap.get(scopedCustomerId);
        return `No Loan Entries for ${customer?.name || 'you'}`;
      })()
      : 'No loans recorded yet.';

    return (
      <GlassCard>
        <p className="text-center text-gray-500 dark:text-dark-muted">{emptyMessage}</p>
      </GlassCard>
    );
  }

  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    number: number;
  } | null>(null);
  const [deleteLoanTarget, setDeleteLoanTarget] = React.useState<{
    id: string;
    customer?: string | null;
  } | null>(null);
  const [editTarget, setEditTarget] = React.useState<Installment | null>(null);
  const [editLoanTarget, setEditLoanTarget] =
    React.useState<LoanWithCustomer | null>(null);
  const [editForm, setEditForm] = React.useState({
    date: "",
    amount: "",
    late_fee: "",
    receipt_number: "",
  });

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  // Close delete confirmation modals with Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteTarget) {
        setDeleteTarget(null);
        return;
      }
      if (deleteLoanTarget) {
        setDeleteLoanTarget(null);
        return;
      }
    };
    if (deleteTarget || deleteLoanTarget) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return;
  }, [deleteTarget, deleteLoanTarget]);



  return (
    <GlassCard className="overflow-x-auto" disable3D>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
        <div className="relative w-full sm:w-64 md:flex-1">
          <input
            type="text"
            placeholder="Filter by customer or check number..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 pr-10 w-full bg-white/50 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full sm:w-48 md:w-auto bg-white/50 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
        >
          <option value="">All Statuses</option>
          <option value="Paid Off">Paid Off</option>
          <option value="In Progress">In Progress</option>
        </select>
      </div>

      {/* --- THIS IS THE FIX --- */}
      {/* Added `hidden md:table` to hide on mobile and show on desktop */}
      <table className="min-w-full border-collapse hidden md:table">
        <thead>
          <tr className="bg-gray-100/70 dark:bg-slate-700">
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 dark:border-dark-border dark:text-dark-text">#</th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("customer")}
            >
              Customer
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("total_repayable")}
            >
              Total Repayable
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("loan_amount")}
            >
              Loan Amount
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("interest")}
            >
              Interest
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("paid")}
            >
              Paid
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("balance")}
            >
              Balance
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("check_number")}
            >
              Check Number
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("installments")}
            >
              Installment #
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("total_installments")}
            >
              Total Installments
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("payment_date")}
            >
              Payment Date
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text"
              onClick={() => handleSort("status")}
            >
              Status
            </th>
            {!isScopedCustomer && (
              <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 dark:border-dark-border dark:text-dark-text">
                Actions
              </th>
            )}
          </tr>
        </thead>
        {/* THIS SECTION CONTROLS THE INITIAL ROW-BY-ROW FADE IN */}
        <tbody>
          {paginatedLoans.map((loan: LoanWithCustomer, idx: number) => {
            // Use O(1) lookup - installments already sorted by date in the map
            const loanInstallments = getLoanInstallments(loan.id);
            const totalRepayable =
              loan.original_amount + loan.interest_amount;
            const paid = loanInstallments.reduce(
              (acc, inst) => acc + inst.amount,
              0
            );
            const balance = totalRepayable - paid;
            const isPaidOff = paid >= totalRepayable;
            const isExpanded = expandedRow === loan.id;
            return (
              <React.Fragment key={loan.id}>
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.03 }}
                  className="even:bg-gray-50/50 hover:bg-indigo-50/50 transition-colors dark:even:bg-slate-700/50 dark:hover:bg-slate-600/50"
                >
                  <td className="px-4 py-2 border-b font-medium text-sm text-gray-700 dark:border-dark-border dark:text-dark-muted">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                  <td className="px-4 py-2 border-b dark:border-dark-border">
                    <button
                      className="font-bold text-indigo-700 hover:underline focus:outline-none text-left dark:text-indigo-400"
                      onClick={() =>
                        setExpandedRow(isExpanded ? null : loan.id)
                      }
                      aria-expanded={isExpanded}
                    >
                      {loan.customers?.name ?? "Unknown"}
                    </button>
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                    {formatCurrencyIN(totalRepayable)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                    {formatCurrencyIN(loan.original_amount)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                    {formatCurrencyIN(loan.interest_amount)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                    {formatCurrencyIN(paid)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                    {formatCurrencyIN(balance)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                    {loan.check_number || "-"}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                    {loanInstallments.length}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                    {loan.total_instalments || "-"}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text">
                    {loan.payment_date ? formatDate(loan.payment_date) : "-"}
                  </td>
                  <td
                    className={`px-4 py-2 border-b font-semibold dark:border-dark-border ${isPaidOff ? "text-green-600" : "text-orange-600"
                      }`}
                  >
                    {isPaidOff ? "Paid Off" : "In Progress"}
                  </td>
                  {!isScopedCustomer && (
                    <td className="px-4 py-2 border-b dark:border-dark-border">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditLoanTarget(loan)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onPointerDown={(e) => (e as any).stopPropagation()}
                          className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            setDeleteLoanTarget({
                              id: loan.id,
                              customer: loan.customers?.name ?? null,
                            })
                          }
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onPointerDown={(e) => (e as any).stopPropagation()}
                          className="px-2 py-1 rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                          title="Delete loan"
                        >
                          <Trash2Icon className="w-5 h-5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  )}
                </motion.tr>

                <AnimatePresence>
                  {isExpanded && (
                    <tr className="bg-gray-50/20 dark:bg-slate-800/20">
                      <td colSpan={12} className="p-0 border-b dark:border-dark-border">
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 border rounded-lg bg-white/80 dark:bg-dark-card dark:border-dark-border">
                            <h4 className="font-semibold text-gray-700 mb-2 dark:text-dark-text">
                              Installments Paid
                            </h4>
                            {loanInstallments.length > 0 ? (
                              <ul className="space-y-2">
                                {loanInstallments.map((inst) => {
                                  const customer = loan.customers;
                                  let message = "";
                                  let whatsappUrl = "#";
                                  let isValidPhone = false;
                                  if (
                                    customer &&
                                    customer.phone &&
                                    /^\d{10,15}$/.test(customer.phone)
                                  ) {
                                    isValidPhone = true;
                                    message = `Hi ${customer.name}, your installment payment of ₹${inst.amount}`;
                                    if (inst.late_fee && inst.late_fee > 0) {
                                      message += ` (including a ₹${inst.late_fee} late fee)`;
                                    }
                                    message += ` (Installment #${inst.installment_number
                                      }) was received on ${formatDate(
                                        inst.date,
                                        "whatsapp"
                                      )}. Thank you.`;
                                    // Append signature
                                    message += " Thank You, I J Reddy.";
                                    // build wa.me URL and ensure proper encoding
                                    try {
                                      whatsappUrl = `https://wa.me/${customer.phone
                                        }?text=${encodeURIComponent(message)}`;
                                    } catch (err) {
                                      whatsappUrl = `https://api.whatsapp.com/send?phone=${customer.phone
                                        }&text=${encodeURIComponent(message)}`;
                                    }
                                  }
                                  return (
                                    <li
                                      key={inst.id}
                                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 rounded px-3 py-2 border border-gray-200 gap-2 dark:bg-slate-700 dark:border-dark-border"
                                    >
                                      <div>
                                        <span className="font-medium dark:text-dark-text">
                                          #{inst.installment_number}
                                        </span>
                                        <span className="ml-2 text-gray-600 dark:text-dark-muted">
                                          {formatDate(inst.date)}
                                        </span>
                                        <span className="ml-2 text-green-700 font-semibold dark:text-green-400">
                                          {formatCurrencyIN(inst.amount)}
                                        </span>
                                        {inst.late_fee > 0 && (
                                          <span className="ml-2 text-orange-500 text-xs">
                                            (+₹{inst.late_fee} late)
                                          </span>
                                        )}
                                        <span className="ml-2 text-gray-500 text-xs dark:text-dark-muted">
                                          Receipt: {inst.receipt_number}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <motion.button
                                          onClick={() =>
                                            isValidPhone &&
                                            openWhatsApp(
                                              customer?.phone,
                                              message,
                                              { cooldownMs: 1200 }
                                            )
                                          }
                                          className="p-1 rounded-full hover:bg-green-500/10 transition-colors"
                                          aria-label={`Send installment #${inst.installment_number} on WhatsApp`}
                                          whileHover={{ scale: 1.2 }}
                                          whileTap={{ scale: 0.9 }}
                                          disabled={!isValidPhone}
                                        >
                                          <WhatsAppIcon className="w-4 h-4 text-green-500" />
                                        </motion.button>
                                        {!isScopedCustomer && (
                                          <>
                                            <motion.button
                                              onClick={() => {
                                                setEditTarget(inst);
                                                setEditForm({
                                                  date: inst.date,
                                                  amount: inst.amount.toString(),
                                                  late_fee:
                                                    inst.late_fee?.toString() ||
                                                    "",
                                                  receipt_number:
                                                    inst.receipt_number || "",
                                                });
                                              }}
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onTouchStart={(e) => e.stopPropagation()}
                                              onPointerDown={(e) => (e as any).stopPropagation()}
                                              className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 ml-2"
                                              aria-label={`Edit installment #${inst.installment_number}`}
                                              whileHover={{ scale: 1.05 }}
                                              whileTap={{ scale: 0.95 }}
                                            >
                                              Edit
                                            </motion.button>
                                            <motion.button
                                              onClick={() =>
                                                setDeleteTarget({
                                                  id: inst.id,
                                                  number: inst.installment_number,
                                                })
                                              }
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onTouchStart={(e) => e.stopPropagation()}
                                              onPointerDown={(e) => (e as any).stopPropagation()}
                                              className="px-2 py-1 rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors ml-2"
                                              aria-label={`Delete installment #${inst.installment_number}`}
                                              whileHover={{ scale: 1.02 }}
                                              whileTap={{ scale: 0.98 }}
                                            >
                                              <Trash2Icon className="w-4 h-4 text-red-500" />
                                            </motion.button>
                                          </>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-center text-gray-500 py-4 dark:text-dark-muted">
                                No installments have been paid for this loan
                                yet.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Mobile stacked cards */}
      {/* This `md:hidden` class is correct. It hides this view on desktop */}
      <div className="md:hidden mt-4 space-y-3">
        {paginatedLoans.map((loan, idx) => {
          // Use O(1) lookup - installments already sorted by date in the map
          const loanInstallments = getLoanInstallments(loan.id);
          const totalRepayable = loan.original_amount + loan.interest_amount;
          const paid = loanInstallments.reduce(
            (acc, inst) => acc + inst.amount,
            0
          );
          const balance = totalRepayable - paid;
          const customer = loan.customers;

          // WhatsApp message construction for loan - matches displayed fields
          let loanMessage = "";
          let isValidPhone = false;
          if (customer && customer.phone && /^\d{10,15}$/.test(customer.phone)) {
            isValidPhone = true;
            loanMessage = `Hi ${customer.name}, this is regarding your loan.\n\nTotal Repayable: ${formatCurrencyIN(totalRepayable)}\nTotal Installments: ${loan.total_instalments}\nPaid: ${formatCurrencyIN(paid)}\nInstallments Paid: ${loanInstallments.length}\nBalance: ${formatCurrencyIN(balance)}\n\nThank You, I J Reddy.`;
          }

          return (
            <div key={loan.id} className="relative">
              {/* Swipe background indicators - only visible when dragging this card */}
              {draggingCardId === loan.id && (
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, delay: idx * 0.03 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                dragMomentum={false}
                dragDirectionLock={true}
                style={{ touchAction: "pan-y" }}
                onDragStart={() => {
                  setDraggingCardId(loan.id);
                  if (expandedRow === loan.id) {
                    setExpandedRow(null);
                  }
                }}
                onDragEnd={(_, info) => {
                  setDraggingCardId(null);
                  const threshold = 100;
                  if (info.offset.x < -threshold && !isScopedCustomer) {
                    // Swipe left - Delete
                    setDeleteLoanTarget({
                      id: loan.id,
                      customer: customer?.name ?? null,
                    });
                  } else if (info.offset.x > threshold && isValidPhone) {
                    // Swipe right - WhatsApp
                    openWhatsApp(customer?.phone, loanMessage, { cooldownMs: 1200 });
                  }
                }}
              >
                {/* Row 1: # Name and Total Repayable */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 dark:text-dark-muted">#{(currentPage - 1) * itemsPerPage + idx + 1}</span>
                    <button
                      onClick={() => setExpandedRow(expandedRow === loan.id ? null : loan.id)}
                      className="text-sm font-semibold text-indigo-700 truncate underline dark:text-indigo-400"
                    >
                      {customer?.name ?? "Unknown"}
                    </button>
                  </div>
                  <div className="text-lg font-bold dark:text-dark-text">
                    {formatCurrencyIN(totalRepayable)}
                  </div>
                </div>

                {/* Row 2: Total Installments */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Total Installments: <span className="font-semibold text-gray-700 dark:text-dark-text">{loan.total_instalments}</span>
                </div>

                {/* Row 3: Paid */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Paid: <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrencyIN(paid)}</span>
                </div>

                {/* Row 4: Installments Paid */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Installments Paid: <span className="font-semibold text-gray-700 dark:text-dark-text">{loanInstallments.length}</span>
                </div>

                {/* Row 5: Balance */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Balance: <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrencyIN(balance)}</span>
                </div>

                {/* Row 6: Action buttons */}
                <div className="mt-3 flex items-center justify-evenly">
                  <button
                    onClick={() =>
                      isValidPhone &&
                      openWhatsApp(customer?.phone, loanMessage, {
                        cooldownMs: 1200,
                      })
                    }
                    className="p-2 rounded-md bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    disabled={!isValidPhone}
                    aria-label={`Send loan details for ${customer?.name} on WhatsApp`}
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                  </button>
                  {!isScopedCustomer && (
                    <button
                      onClick={() => setEditLoanTarget(loan)}
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
                      onClick={() =>
                        setDeleteLoanTarget({
                          id: loan.id,
                          customer: customer?.name ?? null,
                        })
                      }
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onPointerDown={(e) => (e as any).stopPropagation()}
                      className="p-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      aria-label={`Delete loan for ${customer?.name}`}
                      title="Delete loan"
                    >
                      <Trash2Icon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </motion.div>

              <AnimatePresence>
                {expandedRow === loan.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 border-t pt-3 dark:border-dark-border">
                      <h5 className="text-sm font-semibold mb-2 dark:text-dark-text">Installments</h5>
                      <ul className="space-y-2">
                        {loanInstallments.map((inst) => {
                          // Build WhatsApp message for mobile view
                          let message = "";
                          let isValidPhone = false;
                          if (
                            customer &&
                            customer.phone &&
                            /^\d{10,15}$/.test(customer.phone)
                          ) {
                            isValidPhone = true;
                            message = `Hi ${customer.name}, your installment payment of ₹${inst.amount}`;
                            if (inst.late_fee && inst.late_fee > 0) {
                              message += ` (including a ₹${inst.late_fee} late fee)`;
                            }
                            message += ` (Installment #${inst.installment_number}) was received on ${formatDate(inst.date, "whatsapp")}. Thank you.`;
                            message += " Thank You, I J Reddy.";
                          }
                          return (
                            <li
                              key={inst.id}
                              className="flex items-center justify-between"
                            >
                              <div className="text-sm">
                                <div className="dark:text-dark-text">
                                  #{inst.installment_number} • {formatDate(inst.date)}
                                </div>
                                <div className="text-green-700 font-semibold dark:text-green-400">
                                  {formatCurrencyIN(inst.amount)}{" "}
                                  {inst.late_fee > 0 && (
                                    <span className="text-orange-500 text-xs">
                                      (+{formatCurrencyIN(inst.late_fee)} late)
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-dark-muted">
                                  Receipt: {inst.receipt_number || "-"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isValidPhone) {
                                      openWhatsApp(customer?.phone, message, { cooldownMs: 1200 });
                                    }
                                  }}
                                  className="p-2 rounded-md bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                  aria-label={`Send installment #${inst.installment_number} on WhatsApp`}
                                  disabled={!isValidPhone}
                                >
                                  <WhatsAppIcon className="w-4 h-4" />
                                </button>
                                {!isScopedCustomer && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditTarget(inst);
                                        setEditForm({
                                          date: inst.date,
                                          amount: inst.amount.toString(),
                                          late_fee: inst.late_fee?.toString() || "",
                                          receipt_number: inst.receipt_number || "",
                                        });
                                      }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onTouchStart={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => (e as any).stopPropagation()}
                                      className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteTarget({
                                          id: inst.id,
                                          number: inst.installment_number,
                                        });
                                      }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onTouchStart={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => (e as any).stopPropagation()}
                                      className="p-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                    >
                                      <Trash2Icon className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {
        totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
            <div className="text-sm text-gray-600 dark:text-dark-muted">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, sortedLoans.length)} of{" "}
              {sortedLoans.length} loans
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
        )
      }

      {/* ... (All modal logic remains unchanged) ... */}

      {/* Loan Edit Modal */}
      <AnimatePresence>
        {editLoanTarget && (
          <EditModal
            type="loan"
            data={editLoanTarget}
            onClose={() => setEditLoanTarget(null)}
            onSave={async (updated) => {
              try {
                // build updates object - ensure numeric fields are numbers
                const updates: any = {
                  original_amount: Number(updated.original_amount),
                  interest_amount: Number(updated.interest_amount),
                  check_number: updated.check_number || null,
                  total_instalments: Number(updated.total_instalments) || null,
                  payment_date: updated.payment_date || null,
                };
                await updateLoan(editLoanTarget.id, updates);
              } catch (err: any) {
                alert(err.message || String(err));
              } finally {
                setEditLoanTarget(null);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Installment Edit Modal */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2"
          >
            <motion.div
              variants={modalContentVariants}
              className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-xs sm:max-w-sm dark:bg-dark-card dark:border dark:border-dark-border"
            >
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 dark:text-dark-text">
                Edit Installment #{editTarget.installment_number}
              </h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (editTarget) {
                    await updateInstallment(editTarget.id, {
                      date: editForm.date,
                      amount: Number(editForm.amount),
                      late_fee: Number(editForm.late_fee) || 0,
                      receipt_number: editForm.receipt_number,
                    });
                    setEditTarget(null);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-text">Date</label>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 w-full text-base bg-white block dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
                    style={{ minHeight: '42px', WebkitAppearance: 'none' }}
                    value={editForm.date}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, date: e.target.value }))
                    }
                    required
                    min="1980-01-01"
                    max="2050-12-31"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-text">
                    Amount
                  </label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-full dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
                    value={editForm.amount}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-text">
                    Late Fee
                  </label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-full dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
                    value={editForm.late_fee}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, late_fee: e.target.value }))
                    }
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-text">
                    Receipt Number
                  </label>
                  <input
                    type="text"
                    className="border rounded px-2 py-1 w-full dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
                    value={editForm.receipt_number}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        receipt_number: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Loan Confirmation Modal (portal) */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {deleteLoanTarget && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="delete-loan-backdrop"
            >
              <motion.div
                className="bg-white rounded-xl shadow-lg p-6 md:p-8 w-[90%] max-w-md flex flex-col items-center dark:bg-dark-card dark:border dark:border-dark-border"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                key="delete-loan-content"
              >
                <Trash2Icon className="w-10 h-10 text-red-500 mb-2" />
                <h3 className="text-lg font-bold mb-2 text-center text-gray-800 dark:text-dark-text">Delete Loan?</h3>
                <p className="text-gray-700 text-center mb-4 dark:text-dark-muted">
                  Are you sure you want to delete the entire loan for{' '}
                  <span className="font-semibold">{deleteLoanTarget.customer ?? 'this customer'}</span>?
                </p>
                <div className="flex gap-4 w-full justify-center">
                  <button
                    onClick={() => setDeleteLoanTarget(null)}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!deleteLoanTarget) return;
                      try {
                        await deleteLoan(deleteLoanTarget.id);
                      } catch (err: any) {
                        alert(err?.message || String(err));
                      }
                      setDeleteLoanTarget(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Delete Installment Confirmation Modal (portal) */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="delete-inst-backdrop"
            >
              <motion.div
                className="bg-white rounded-xl shadow-lg p-6 md:p-8 w-[90%] max-w-md flex flex-col items-center dark:bg-dark-card dark:border dark:border-dark-border"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                key="delete-inst-content"
              >
                <Trash2Icon className="w-10 h-10 text-red-500 mb-2" />
                <h3 className="text-lg font-bold mb-2 text-center text-gray-800 dark:text-dark-text">Delete Installment?</h3>
                <p className="text-gray-700 text-center mb-4 dark:text-dark-muted">
                  Are you sure you want to delete installment #{deleteTarget.number}?
                </p>
                <div className="flex gap-4 w-full justify-center">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!deleteTarget) return;
                      await deleteInstallment(deleteTarget.id);
                      setDeleteTarget(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </GlassCard >
  );
};

export default LoanTableView;
