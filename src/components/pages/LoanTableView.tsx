import React from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useData } from "../../context/DataContext";
import { Trash2Icon, WhatsAppIcon } from "../../constants";
import { openWhatsApp } from "../../utils/whatsapp";
import { formatCurrencyIN } from "../../utils/numberFormatter";
import GlassCard from "../ui/GlassCard";
import { formatDate } from "../../utils/dateFormatter";
import type { LoanWithCustomer, Installment } from "../../types";
import { getLoanStatus } from "../../utils/loanStatus";
import EditModal from "../modals/EditModal";
import RecordInstallmentModal from "../modals/RecordInstallmentModal";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import { useDeferredSearch } from "../../utils/useDebounce";
import { 
  rowVariants, 
  cardVariants, 
  layoutTransition 
} from "../../utils/useRowDeleteAnimation";

// Performance Note: Removed unused staggerChildren animation variants
// The table already uses pagination (25 items) which is sufficient for performance.
// Layout animations are only enabled during delete operations to prevent
// expensive recalculations on every render.

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
  // Use useDeferredSearch for better React 18 concurrent rendering
  // This integrates with React's scheduler instead of using setTimeout
  const debouncedFilter = useDeferredSearch(filter);
  const [statusFilter, setStatusFilter] = React.useState("");
  // Default to sorting by status so "In Progress" loans appear first
  const [sortField, setSortField] = React.useState("status");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc"
  );
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 25;

  // Page picker popup state
  const [pagePickerOpen, setPagePickerOpen] = React.useState<
    "start" | "end" | null
  >(null);
  const [pagePickerOffset, setPagePickerOffset] = React.useState(0);
  const pagePickerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!pagePickerOpen) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        pagePickerRef.current &&
        !pagePickerRef.current.contains(event.target as Node)
      ) {
        setPagePickerOpen(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("click", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [pagePickerOpen]);

  // Helper function for O(1) installment lookup
  const getLoanInstallments = React.useCallback(
    (loanId: string) => {
      return installmentsByLoanId.get(loanId) || [];
    },
    [installmentsByLoanId]
  );

  // Memoize filtered loans to prevent recalculation on every render
  const filteredLoans = React.useMemo(() => {
    return loans.filter((loan) => {
      // Filter by scoped customer if applicable
      if (
        isScopedCustomer &&
        scopedCustomerId &&
        loan.customer_id !== scopedCustomerId
      ) {
        return false;
      }

      const customerName = loan.customers?.name?.toLowerCase() || "";
      const checkNumber = (loan.check_number || "").toLowerCase();
      const loanInsts = getLoanInstallments(loan.id);
      const status = getLoanStatus(loan, loanInsts).status;
      const matchesText =
        customerName.includes(debouncedFilter.toLowerCase()) ||
        checkNumber.includes(debouncedFilter.toLowerCase());
      const matchesStatus = statusFilter === "" || status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [
    loans,
    debouncedFilter,
    statusFilter,
    isScopedCustomer,
    scopedCustomerId,
    getLoanInstallments,
  ]);

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
      const aStatus = getLoanStatus(a, aInsts);
      const bStatus = getLoanStatus(b, bInsts);
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
          aValue = aStatus.paid;
          bValue = bStatus.paid;
          break;
        case "balance":
          aValue = aStatus.totalRepayable - aStatus.paid;
          bValue = bStatus.totalRepayable - bStatus.paid;
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
          aValue = aStatus.status;
          bValue = bStatus.status;
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

  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = React.useState<string | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    number: number;
  } | null>(null);
  const [deleteLoanTarget, setDeleteLoanTarget] = React.useState<{
    id: string;
    customer?: string | null;
  } | null>(null);
  const [deletingLoan, setDeletingLoan] = React.useState(false);
  const [deletingInstallment, setDeletingInstallment] = React.useState(false);
  
  // Track IDs being deleted for background animation
  const [animatingLoanId, setAnimatingLoanId] = React.useState<string | null>(null);
  const [animatingInstallmentId, setAnimatingInstallmentId] = React.useState<string | null>(null);
  
  const [editTarget, setEditTarget] = React.useState<Installment | null>(null);
  const [editLoanTarget, setEditLoanTarget] =
    React.useState<LoanWithCustomer | null>(null);
  const [recordInstallmentTarget, setRecordInstallmentTarget] =
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

  // Close actions dropdown with Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Close actions dropdown
      if (expandedRow?.startsWith("actions-")) {
        setExpandedRow(null);
        return;
      }
    };
    if (expandedRow?.startsWith("actions-")) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
    return;
  }, [expandedRow]);

  // Close actions dropdown when clicking outside
  React.useEffect(() => {
    if (!expandedRow?.startsWith("actions-")) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.actions-dropdown-container')) {
        setExpandedRow(null);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expandedRow]);

  React.useEffect(() => {
    if (!editTarget) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Esc") {
        return;
      }
      try {
        event.preventDefault();
        event.stopPropagation();
        if (typeof (event as any).stopImmediatePropagation === "function") {
          (event as any).stopImmediatePropagation();
        }
      } catch (err) {
        // ignore
      }
      setEditTarget(null);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown, true);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown, true);
      }
    };
  }, [editTarget]);

  if (loans.length === 0) {
    const emptyMessage =
      isScopedCustomer && scopedCustomerId
        ? (() => {
          const customer = customerMap.get(scopedCustomerId);
          return `No Loan Entries for ${customer?.name || "you"}`;
        })()
        : "No loans recorded yet.";

    return (
      <GlassCard>
        <p className="text-center text-gray-500 dark:text-dark-muted">
          {emptyMessage}
        </p>
      </GlassCard>
    );
  }

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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
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
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 dark:border-dark-border dark:text-dark-text whitespace-nowrap">
              #
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("customer")}
            >
              Customer
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("total_repayable")}
            >
              Total Repayable
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("loan_amount")}
            >
              Loan Amount
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("interest")}
            >
              Interest
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("paid")}
            >
              Paid
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("balance")}
            >
              Balance
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("check_number")}
            >
              Check Number
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("installments")}
            >
              Installment #
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("total_installments")}
            >
              Total Installments
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("payment_date")}
            >
              Payment Date
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer dark:border-dark-border dark:text-dark-text whitespace-nowrap"
              onClick={() => handleSort("status")}
            >
              Status
            </th>
            {!isScopedCustomer && (
              <th className="px-2 py-2 border-b text-left text-sm font-semibold text-gray-600 dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                Actions
              </th>
            )}
          </tr>
        </thead>
        {/* THIS SECTION CONTROLS THE INITIAL ROW-BY-ROW FADE IN */}
        <tbody>
          <AnimatePresence mode="popLayout">
          {paginatedLoans.map((loan: LoanWithCustomer, idx: number) => {
            // Use O(1) lookup - installments already sorted by date in the map
            const loanInstallments = getLoanInstallments(loan.id);
            const loanStatus = getLoanStatus(loan, loanInstallments);
            const totalRepayable = loanStatus.totalRepayable;
            const paid = loanStatus.paid;
            const balance = totalRepayable - paid;
            const isPaidOff = loanStatus.isPaidOff;
            const isExpanded = expandedRow === loan.id;
            const isDeleting = animatingLoanId === loan.id;
            return (
              <React.Fragment key={loan.id}>
                <motion.tr
                  layout={!!animatingLoanId} // Only enable layout animations during delete to prevent expensive recalcs
                  variants={rowVariants}
                  initial={false} // Skip initial animation for faster renders
                  animate={isDeleting ? 'deleting' : 'visible'}
                  exit="exit"
                  transition={isDeleting ? layoutTransition : undefined}
                  className={`even:bg-gray-50/50 hover:bg-indigo-50/50 transition-colors dark:even:bg-slate-700/50 dark:hover:bg-slate-600/50 ${isDeleting ? 'pointer-events-none' : ''}`}
                  style={{ overflow: 'hidden' }}
                >
                  <td className="px-4 py-2 border-b font-medium text-sm text-gray-700 dark:border-dark-border dark:text-dark-muted whitespace-nowrap">
                    {(currentPage - 1) * itemsPerPage + idx + 1}
                  </td>
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
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                    {formatCurrencyIN(totalRepayable)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                    {formatCurrencyIN(loan.original_amount)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                    {formatCurrencyIN(loan.interest_amount)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                    {formatCurrencyIN(paid)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                    {formatCurrencyIN(balance)}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                    {loan.check_number || "-"}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                    {loanInstallments.length}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                    {loan.total_instalments || "-"}
                  </td>
                  <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-text whitespace-nowrap">
                    {loan.payment_date ? formatDate(loan.payment_date) : "-"}
                  </td>
                  <td
                    className={`px-4 py-2 border-b font-semibold dark:border-dark-border whitespace-nowrap ${isPaidOff ? "text-green-600" : "text-orange-600"
                      }`}
                  >
                    {loanStatus.status}
                  </td>
                  {!isScopedCustomer && (
                    <td className="px-2 py-2 border-b dark:border-dark-border">
                      <div className="relative inline-block actions-dropdown-container">
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRow(expandedRow === `actions-${loan.id}` ? null : `actions-${loan.id}`);
                          }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                          title="Actions"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <motion.svg 
                            className="w-5 h-5 text-gray-600 dark:text-dark-text" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                            animate={{ rotate: expandedRow === `actions-${loan.id}` ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </motion.svg>
                        </motion.button>
                        <AnimatePresence>
                          {expandedRow === `actions-${loan.id}` && (
                            <motion.div 
                              className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-1 min-w-[140px] overflow-hidden"
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                            >
                              <motion.button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRecordInstallmentTarget(loan);
                                  setExpandedRow(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-green-600 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.1 }}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                Installment
                              </motion.button>
                              <motion.button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditLoanTarget(loan);
                                  setExpandedRow(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.1 }}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Edit
                              </motion.button>
                              <motion.button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteLoanTarget({
                                    id: loan.id,
                                    customer: loan.customers?.name ?? null,
                                  });
                                  setExpandedRow(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.1 }}
                              >
                                <Trash2Icon className="w-4 h-4" />
                                Delete
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                  )}
                </motion.tr>

                <AnimatePresence>
                  {isExpanded && (
                    <tr className="bg-gray-50/20 dark:bg-slate-800/20">
                      <td
                        colSpan={isScopedCustomer ? 12 : 13}
                        className="p-0 border-b dark:border-dark-border"
                      >
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
                              <AnimatePresence mode="popLayout">
                              <ul className="space-y-2">
                                {loanInstallments.map((inst) => {
                                  const customer = loan.customers;
                                  const isInstDeleting = animatingInstallmentId === inst.id;
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
                                    <motion.li
                                      key={inst.id}
                                      layout
                                      variants={rowVariants}
                                      initial="initial"
                                      animate={isInstDeleting ? 'deleting' : 'visible'}
                                      exit="exit"
                                      transition={layoutTransition}
                                      className={`flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 rounded px-3 py-2 border border-gray-200 gap-2 dark:bg-slate-700 dark:border-dark-border ${isInstDeleting ? 'pointer-events-none' : ''}`}
                                      style={{ overflow: 'hidden' }}
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
                                          Receipt: {inst.receipt_number || "-"}
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
                                                  amount:
                                                    inst.amount.toString(),
                                                  late_fee:
                                                    inst.late_fee?.toString() ||
                                                    "",
                                                  receipt_number:
                                                    inst.receipt_number || "",
                                                });
                                              }}
                                              onMouseDown={(e) =>
                                                e.stopPropagation()
                                              }
                                              onTouchStart={(e) =>
                                                e.stopPropagation()
                                              }
                                              onPointerDown={(e) =>
                                                (e as any).stopPropagation()
                                              }
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
                                                  number:
                                                    inst.installment_number,
                                                })
                                              }
                                              onMouseDown={(e) =>
                                                e.stopPropagation()
                                              }
                                              onTouchStart={(e) =>
                                                e.stopPropagation()
                                              }
                                              onPointerDown={(e) =>
                                                (e as any).stopPropagation()
                                              }
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
                                    </motion.li>
                                  );
                                })}
                              </ul>
                              </AnimatePresence>
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
          </AnimatePresence>
        </tbody>
      </table>

      {/* Mobile stacked cards */}
      {/* This `md:hidden` class is correct. It hides this view on desktop */}
      <div className="md:hidden mt-4 space-y-3">
        <AnimatePresence mode="popLayout">
        {paginatedLoans.map((loan, idx) => {
          // Use O(1) lookup - installments already sorted by date in the map
          const loanInstallments = getLoanInstallments(loan.id);
          const loanStatus = getLoanStatus(loan, loanInstallments);
          const totalRepayable = loanStatus.totalRepayable;
          const paid = loanStatus.paid;
          const balance = totalRepayable - paid;
          const customer = loan.customers;
          const isDeleting = animatingLoanId === loan.id;

          // WhatsApp message construction for loan - matches displayed fields
          let loanMessage = "";
          let isValidPhone = false;
          if (
            customer &&
            customer.phone &&
            /^\d{10,15}$/.test(customer.phone)
          ) {
            isValidPhone = true;
            loanMessage = `Hi ${customer.name
              }, this is regarding your loan.\n\nTotal Repayable: ${formatCurrencyIN(
                totalRepayable
              )}\nTotal Installments: ${loan.total_instalments
              }\nPaid: ${formatCurrencyIN(paid)}\nInstallments Paid: ${loanInstallments.length
              }\nBalance: ${formatCurrencyIN(balance)}\n\nThank You, I J Reddy.`;
          }

          return (
            <motion.div 
              key={loan.id} 
              layout={!!animatingLoanId} // Only enable layout animations during delete
              variants={cardVariants}
              initial={false} // Skip initial animation for faster renders
              animate={isDeleting ? 'deleting' : 'visible'}
              exit="exit"
              transition={isDeleting ? layoutTransition : undefined}
              className={`relative ${isDeleting ? 'pointer-events-none' : ''}`}
              style={{ overflow: 'hidden' }}
            >
              {/* Swipe background indicators - only visible when dragging this card */}
              {draggingCardId === loan.id && !isDeleting && (
                <div className="absolute inset-0 flex rounded-lg overflow-hidden z-0">
                  <div
                    className={`${isScopedCustomer ? "w-full" : "w-1/2"
                      } bg-green-500 flex items-center justify-start pl-4`}
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
                    openWhatsApp(customer?.phone, loanMessage, {
                      cooldownMs: 1200,
                    });
                  }
                }}
              >
                {/* Row 1: # Name and Total Repayable */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 dark:text-dark-muted">
                      #{(currentPage - 1) * itemsPerPage + idx + 1}
                    </span>
                    <button
                      onClick={() =>
                        setExpandedRow(expandedRow === loan.id ? null : loan.id)
                      }
                      className="text-sm font-semibold text-indigo-700 truncate underline dark:text-indigo-400"
                    >
                      {customer?.name ?? "Unknown"}
                    </button>
                  </div>
                  <div className="text-lg font-bold dark:text-dark-text">
                    {formatCurrencyIN(totalRepayable)}
                  </div>
                </div>

                {/* Row 2: Status */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Status:{" "}
                  <span
                    className={`font-semibold ${loanStatus.isPaidOff
                      ? "text-green-600"
                      : "text-orange-600"
                      }`}
                  >
                    {loanStatus.status}
                  </span>
                </div>

                {/* Row 3: Total Installments */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Total Installments:{" "}
                  <span className="font-semibold text-gray-700 dark:text-dark-text">
                    {loan.total_instalments}
                  </span>
                </div>

                {/* Row 4: Paid */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Paid:{" "}
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrencyIN(paid)}
                  </span>
                </div>

                {/* Row 4: Installments Paid */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Installments Paid:{" "}
                  <span className="font-semibold text-gray-700 dark:text-dark-text">
                    {loanInstallments.length}
                  </span>
                </div>

                {/* Row 5: Balance */}
                <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                  Balance:{" "}
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {formatCurrencyIN(balance)}
                  </span>
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
                      onClick={() => setRecordInstallmentTarget(loan)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onPointerDown={(e) => (e as any).stopPropagation()}
                      className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700"
                      title="Record installment"
                    >
                      + Installments
                    </button>
                  )}
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
                      <h5 className="text-sm font-semibold mb-2 dark:text-dark-text">
                        Installments
                      </h5>
                      <AnimatePresence mode="popLayout">
                      <ul className="space-y-2">
                        {loanInstallments.map((inst) => {
                          // Build WhatsApp message for mobile view
                          const isInstDeleting = animatingInstallmentId === inst.id;
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
                            message += ` (Installment #${inst.installment_number
                              }) was received on ${formatDate(
                                inst.date,
                                "whatsapp"
                              )}. Thank you.`;
                            message += " Thank You, I J Reddy.";
                          }
                          return (
                            <motion.li
                              key={inst.id}
                              layout
                              variants={rowVariants}
                              initial="initial"
                              animate={isInstDeleting ? 'deleting' : 'visible'}
                              exit="exit"
                              transition={layoutTransition}
                              className={`flex items-center justify-between ${isInstDeleting ? 'pointer-events-none' : ''}`}
                              style={{ overflow: 'hidden' }}
                            >
                              <div className="text-sm">
                                <div className="dark:text-dark-text">
                                  #{inst.installment_number} •{" "}
                                  {formatDate(inst.date)}
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
                                      openWhatsApp(customer?.phone, message, {
                                        cooldownMs: 1200,
                                      });
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
                                          late_fee:
                                            inst.late_fee?.toString() || "",
                                          receipt_number:
                                            inst.receipt_number || "",
                                        });
                                      }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onTouchStart={(e) => e.stopPropagation()}
                                      onPointerDown={(e) =>
                                        (e as any).stopPropagation()
                                      }
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
                                      onPointerDown={(e) =>
                                        (e as any).stopPropagation()
                                      }
                                      className="p-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                    >
                                      <Trash2Icon className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </motion.li>
                          );
                        })}
                      </ul>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                const startPages = Array.from(
                  { length: currentPage - 3 },
                  (_, i) => i + 2
                );
                const maxOffset = Math.max(
                  0,
                  Math.ceil(startPages.length / 9) - 1
                );
                const visiblePages = startPages.slice(
                  pagePickerOffset * 9,
                  (pagePickerOffset + 1) * 9
                );

                return (
                  <div
                    key="dots-start"
                    className="relative"
                    ref={pagePickerOpen === "start" ? pagePickerRef : null}
                  >
                    <button
                      onClick={() => {
                        setPagePickerOpen(
                          pagePickerOpen === "start" ? null : "start"
                        );
                        setPagePickerOffset(0);
                      }}
                      className="px-2 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                      title="Click to show more pages"
                    >
                      ...
                    </button>
                    {pagePickerOpen === "start" && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-2 z-50 min-w-[140px]">
                        <div className="flex items-center justify-between mb-2 px-1">
                          <button
                            onClick={() =>
                              setPagePickerOffset(
                                Math.max(0, pagePickerOffset - 1)
                              )
                            }
                            disabled={pagePickerOffset === 0}
                            className="p-1 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ‹
                          </button>
                          <span className="text-xs text-gray-500 dark:text-dark-muted">
                            {pagePickerOffset * 9 + 1}-
                            {Math.min(
                              (pagePickerOffset + 1) * 9,
                              startPages.length
                            )}{" "}
                            of {startPages.length}
                          </span>
                          <button
                            onClick={() =>
                              setPagePickerOffset(
                                Math.min(maxOffset, pagePickerOffset + 1)
                              )
                            }
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
                const endPages = Array.from(
                  { length: totalPages - currentPage - 2 },
                  (_, i) => currentPage + 2 + i
                );
                const maxOffset = Math.max(
                  0,
                  Math.ceil(endPages.length / 9) - 1
                );
                const visiblePages = endPages.slice(
                  pagePickerOffset * 9,
                  (pagePickerOffset + 1) * 9
                );

                return (
                  <div
                    key="dots-end"
                    className="relative"
                    ref={pagePickerOpen === "end" ? pagePickerRef : null}
                  >
                    <button
                      onClick={() => {
                        setPagePickerOpen(
                          pagePickerOpen === "end" ? null : "end"
                        );
                        setPagePickerOffset(0);
                      }}
                      className="px-2 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                      title="Click to show more pages"
                    >
                      ...
                    </button>
                    {pagePickerOpen === "end" && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-2 z-50 min-w-[140px]">
                        <div className="flex items-center justify-between mb-2 px-1">
                          <button
                            onClick={() =>
                              setPagePickerOffset(
                                Math.max(0, pagePickerOffset - 1)
                              )
                            }
                            disabled={pagePickerOffset === 0}
                            className="p-1 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ‹
                          </button>
                          <span className="text-xs text-gray-500 dark:text-dark-muted">
                            {pagePickerOffset * 9 + 1}-
                            {Math.min(
                              (pagePickerOffset + 1) * 9,
                              endPages.length
                            )}{" "}
                            of {endPages.length}
                          </span>
                          <button
                            onClick={() =>
                              setPagePickerOffset(
                                Math.min(maxOffset, pagePickerOffset + 1)
                              )
                            }
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
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
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

      {/* ... (All modal logic remains unchanged) ... */}

      {/* Loan Edit Modal */}
      <AnimatePresence>
        {editLoanTarget && (
          <EditModal
            type="loan"
            data={editLoanTarget}
            onClose={() => setEditLoanTarget(null)}
            onSave={async (updated) => {
              const errors: string[] = [];

              const parseRequiredNumber = (value: any, label: string) => {
                const trimmed =
                  value === undefined || value === null
                    ? ""
                    : String(value).trim();
                if (trimmed === "") {
                  errors.push(`${label} is required.`);
                  return null;
                }
                const parsed = Number(trimmed);
                if (!Number.isFinite(parsed)) {
                  errors.push(`Please enter a valid number for ${label}.`);
                  return null;
                }
                return parsed;
              };

              const loanAmount = parseRequiredNumber(
                updated.original_amount,
                "Loan amount"
              );
              const interestAmount = parseRequiredNumber(
                updated.interest_amount,
                "Interest amount"
              );

              let totalInstalments: number | null = null;
              const totalInstalmentsRaw = updated.total_instalments;
              const totalTrimmed =
                totalInstalmentsRaw === undefined ||
                  totalInstalmentsRaw === null
                  ? ""
                  : String(totalInstalmentsRaw).trim();
              if (totalTrimmed !== "") {
                const parsedTotal = Number(totalTrimmed);
                if (
                  !Number.isFinite(parsedTotal) ||
                  !Number.isInteger(parsedTotal) ||
                  parsedTotal < 0
                ) {
                  errors.push(
                    "Please enter a non-negative integer for total installments."
                  );
                } else {
                  totalInstalments = parsedTotal;
                }
              }

              const checkNumber = updated.check_number
                ? String(updated.check_number).trim()
                : "";
              const paymentDate = updated.payment_date
                ? String(updated.payment_date).trim()
                : "";

              if (
                errors.length > 0 ||
                loanAmount === null ||
                interestAmount === null
              ) {
                alert(errors.join("\n") || "Please check the form inputs.");
                return;
              }

              try {
                const updates: any = {
                  original_amount: loanAmount,
                  interest_amount: interestAmount,
                  check_number: checkNumber || null,
                  total_instalments: totalInstalments,
                  payment_date: paymentDate || null,
                };
                await updateLoan(editLoanTarget.id, updates);
                setEditLoanTarget(null);
              } catch (err: any) {
                alert(err.message || String(err));
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Installment Edit Modal */}
      {ReactDOM.createPortal(
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
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
              >
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 dark:text-dark-text">
                  Edit Installment #{editTarget.installment_number}
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (editTarget) {
                      try {
                        await updateInstallment(editTarget.id, {
                          date: editForm.date,
                          amount: Number(editForm.amount),
                          late_fee: Number(editForm.late_fee) || 0,
                          receipt_number: editForm.receipt_number,
                        });
                        setEditTarget(null);
                      } catch (err: any) {
                        alert(err?.message || String(err));
                      }
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-dark-text">
                      Date
                    </label>
                    <input
                      type="date"
                      className="border rounded px-2 py-1 w-full text-base bg-white block dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
                      style={{ minHeight: "42px", WebkitAppearance: "none" }}
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
        </AnimatePresence>,
        document.body
      )}

      {/* Delete Loan Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!deleteLoanTarget}
        onClose={() => setDeleteLoanTarget(null)}
        onConfirm={async () => {
          if (!deleteLoanTarget) return;
          const deleteId = deleteLoanTarget.id;
          
          setDeletingLoan(true);
          // Start the background animation immediately
          setAnimatingLoanId(deleteId);
          
          try {
            await deleteLoan(deleteId);
            // Close modal after successful delete
            setDeleteLoanTarget(null);
          } catch (err: any) {
            // On error, stop the animation and show error
            setAnimatingLoanId(null);
            alert(err?.message || String(err));
          } finally {
            setDeletingLoan(false);
            setAnimatingLoanId(null);
          }
        }}
        title="Move Loan to Trash?"
        message={
          <>
            Are you sure you want to move the loan for{" "}
            <span className="font-semibold">
              {deleteLoanTarget?.customer ?? "this customer"}
            </span>
            {" "}to trash? You can restore it later from the Trash page.
          </>
        }
        isDeleting={deletingLoan}
        confirmText="Move to Trash"
      />

      {/* Delete Installment Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const deleteId = deleteTarget.id;
          
          setDeletingInstallment(true);
          // Start the background animation immediately
          setAnimatingInstallmentId(deleteId);
          
          try {
            await deleteInstallment(deleteId);
            // Close modal after successful delete
            setDeleteTarget(null);
          } catch (err: any) {
            // On error, stop the animation and show error
            setAnimatingInstallmentId(null);
            alert(err?.message || String(err));
          } finally {
            setDeletingInstallment(false);
            setAnimatingInstallmentId(null);
          }
        }}
        title="Delete Installment?"
        message={<>Are you sure you want to delete installment #{deleteTarget?.number}?</>}
        isDeleting={deletingInstallment}
        confirmText="Delete"
      />

      {/* Record Installment Modal */}
      {recordInstallmentTarget && (
        <RecordInstallmentModal
          loan={recordInstallmentTarget}
          onClose={() => setRecordInstallmentTarget(null)}
          onSuccess={() => {
            // Modal will close itself after success
            // The installments will be refreshed automatically via DataContext
          }}
        />
      )}
    </GlassCard>
  );
};

export default LoanTableView;
