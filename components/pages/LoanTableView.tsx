import React from "react";
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

  if (loans.length === 0) {
    const emptyMessage = isScopedCustomer && scopedCustomerId
      ? (() => {
        const customer = customerMap.get(scopedCustomerId);
        return `No Loan Entries for ${customer?.name || 'you'}`;
      })()
      : 'No loans recorded yet.';

    return (
      <GlassCard>
        <p className="text-center text-gray-500">{emptyMessage}</p>
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

  // Key for tbody to reset animation on data load
  const [tbodyKey, setTbodyKey] = React.useState(0);
  React.useEffect(() => {
    setTbodyKey((prev) => prev + 1);
  }, [loans]);

  return (
    <GlassCard className="overflow-x-auto">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
        <div className="relative w-full sm:w-64 md:flex-1">
          <input
            type="text"
            placeholder="Filter by customer or check number..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 pr-10 w-full bg-white/50"
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full sm:w-48 md:w-auto bg-white/50"
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
          <tr className="bg-gray-100/70">
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600">#</th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("customer")}
            >
              Customer
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("loan_amount")}
            >
              Loan Amount
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("interest")}
            >
              Interest
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("total_repayable")}
            >
              Total Repayable
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("paid")}
            >
              Paid
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("balance")}
            >
              Balance
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("check_number")}
            >
              Check Number
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("installments")}
            >
              Installment #
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("total_installments")}
            >
              Total Installments
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("payment_date")}
            >
              Payment Date
            </th>
            <th
              className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer"
              onClick={() => handleSort("status")}
            >
              Status
            </th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600">
              Actions
            </th>
          </tr>
        </thead>
        {/* THIS SECTION CONTROLS THE INITIAL ROW-BY-ROW FADE IN */}
        <motion.tbody
          key={tbodyKey}
          layout
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <AnimatePresence>
            {sortedLoans.map((loan: LoanWithCustomer, idx: number) => {
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
                    layout
                    variants={itemVariants}
                    exit="exit"
                    className="even:bg-gray-50/50 hover:bg-indigo-50/50 transition-colors"
                  >
                    <td className="px-4 py-2 border-b font-medium text-sm text-gray-700">{idx + 1}</td>
                    <td className="px-4 py-2 border-b">
                      <button
                        className="font-bold text-indigo-700 hover:underline focus:outline-none text-left"
                        onClick={() =>
                          setExpandedRow(isExpanded ? null : loan.id)
                        }
                        aria-expanded={isExpanded}
                      >
                        {loan.customers?.name ?? "Unknown"}
                      </button>
                    </td>
                    <td className="px-4 py-2 border-b">
                      {formatCurrencyIN(loan.original_amount)}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {formatCurrencyIN(loan.interest_amount)}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {formatCurrencyIN(totalRepayable)}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {formatCurrencyIN(paid)}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {formatCurrencyIN(balance)}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {loan.check_number || "-"}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {loanInstallments.length}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {loan.total_instalments || "-"}
                    </td>
                    <td className="px-4 py-2 border-b">
                      {loan.payment_date ? formatDate(loan.payment_date) : "-"}
                    </td>
                    <td
                      className={`px-4 py-2 border-b font-semibold ${isPaidOff ? "text-green-600" : "text-orange-600"
                        }`}
                    >
                      {isPaidOff ? "Paid Off" : "In Progress"}
                    </td>
                    <td className="px-4 py-2 border-b">
                      <div className="flex gap-2">
                        {!isScopedCustomer && (
                          <>
                            <button
                              onClick={() => setEditLoanTarget(loan)}
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
                              className="p-1 rounded-full hover:bg-red-500/10 transition-colors"
                              title="Delete loan"
                            >
                              <Trash2Icon className="w-5 h-5 text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>

                  <AnimatePresence>
                    {isExpanded && (
                      <tr className="bg-gray-50/20">
                        <td colSpan={12} className="p-0 border-b">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="p-3 border rounded-lg bg-white/80">
                              <h4 className="font-semibold text-gray-700 mb-2">
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
                                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 rounded px-3 py-2 border border-gray-200 gap-2"
                                      >
                                        <div>
                                          <span className="font-medium">
                                            #{inst.installment_number}
                                          </span>
                                          <span className="ml-2 text-gray-600">
                                            {formatDate(inst.date)}
                                          </span>
                                          <span className="ml-2 text-green-700 font-semibold">
                                            {formatCurrencyIN(inst.amount)}
                                          </span>
                                          {inst.late_fee > 0 && (
                                            <span className="ml-2 text-orange-500 text-xs">
                                              (+₹{inst.late_fee} late)
                                            </span>
                                          )}
                                          <span className="ml-2 text-gray-500 text-xs">
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
                                                className="p-1 rounded-full hover:bg-red-500/10 transition-colors ml-2"
                                                aria-label={`Delete installment #${inst.installment_number}`}
                                                whileHover={{ scale: 1.2 }}
                                                whileTap={{ scale: 0.9 }}
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
                                <p className="text-center text-gray-500 py-4">
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
        </motion.tbody>
      </table>

      {/* Mobile stacked cards */}
      {/* This `md:hidden` class is correct. It hides this view on desktop */}
      <div className="md:hidden mt-4 space-y-3">
        {sortedLoans.map((loan, idx) => {
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
                  <div className="w-1/2 bg-green-500 flex items-center justify-start pl-4">
                    <WhatsAppIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="w-1/2 bg-red-500 flex items-center justify-end pr-4">
                    <Trash2Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              )}

              <motion.div
                className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm relative z-10"
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
                onDragStart={() => setDraggingCardId(loan.id)}
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
                    <span className="text-xs text-gray-400">#{idx + 1}</span>
                    <button
                      onClick={() => setExpandedRow(expandedRow === loan.id ? null : loan.id)}
                      className="text-sm font-semibold text-indigo-700 truncate underline"
                    >
                      {customer?.name ?? "Unknown"}
                    </button>
                  </div>
                  <div className="text-lg font-bold">
                    {formatCurrencyIN(totalRepayable)}
                  </div>
                </div>

                {/* Row 2: Total Installments */}
                <div className="text-xs text-gray-500 mt-1">
                  Total Installments: <span className="font-semibold text-gray-700">{loan.total_instalments}</span>
                </div>

                {/* Row 3: Paid */}
                <div className="text-xs text-gray-500 mt-1">
                  Paid: <span className="font-semibold text-green-600">{formatCurrencyIN(paid)}</span>
                </div>

                {/* Row 4: Installments Paid */}
                <div className="text-xs text-gray-500 mt-1">
                  Installments Paid: <span className="font-semibold text-gray-700">{loanInstallments.length}</span>
                </div>

                {/* Row 5: Balance */}
                <div className="text-xs text-gray-500 mt-1">
                  Balance: <span className="font-semibold text-red-600">{formatCurrencyIN(balance)}</span>
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
                    className="p-2 rounded-md bg-green-50 text-green-600"
                    disabled={!isValidPhone}
                    aria-label={`Send loan details for ${customer?.name} on WhatsApp`}
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                  </button>
                  {!isScopedCustomer && (
                    <button
                      onClick={() => setEditLoanTarget(loan)}
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
                      className="p-2 rounded-md bg-red-50 text-red-600"
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
                    <div className="mt-3 border-t pt-3">
                      <h5 className="text-sm font-semibold mb-2">Installments</h5>
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
                              <div>
                                #{inst.installment_number} • {formatDate(inst.date)}
                              </div>
                              <div className="text-green-700 font-semibold">
                                {formatCurrencyIN(inst.amount)}{" "}
                                {inst.late_fee > 0 && (
                                  <span className="text-orange-500 text-xs">
                                    (+{formatCurrencyIN(inst.late_fee)} late)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
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
                                className="p-2 rounded-md bg-green-50 text-green-600"
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
                                    className="p-2 rounded-md bg-red-50 text-red-600"
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

      {/* ... (All modal logic remains unchanged) ... */}

      {/* Loan Edit Modal */}
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
              className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-xs sm:max-w-sm"
            >
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">
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
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 w-full text-base bg-white block"
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
                  <label className="block text-sm font-medium mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-full"
                    value={editForm.amount}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Late Fee
                  </label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-full"
                    value={editForm.late_fee}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, late_fee: e.target.value }))
                    }
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Receipt Number
                  </label>
                  <input
                    type="text"
                    className="border rounded px-2 py-1 w-full"
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
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
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

      {/* Delete Loan Confirmation Modal */}
      <AnimatePresence>
        {deleteLoanTarget && (
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              variants={modalContentVariants}
              className="bg-white rounded-lg shadow-lg p-6 md:p-8 w-[90%] max-w-md"
            >
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">
                Delete Loan
              </h3>
              <p className="mb-4 sm:mb-6 text-sm sm:text-base">
                Are you sure you want to delete the entire loan for{' '}
                <span className="font-semibold">
                  {deleteLoanTarget.customer ?? "this customer"}
                </span>
                ? This will remove the loan and all its installments.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteLoanTarget(null)}
                  className="px-3 py-2 rounded text-xs sm:text-base bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (deleteLoanTarget) {
                      try {
                        await deleteLoan(deleteLoanTarget.id);
                      } catch (err: any) {
                        alert(err?.message || String(err));
                      }
                      setDeleteLoanTarget(null);
                    }
                  }}
                  className="px-3 py-2 rounded text-xs sm:text-base bg-red-600 text-white hover:bg-red-700"
                >
                  Delete Loan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              variants={modalContentVariants}
              className="bg-white rounded-lg shadow-lg p-6 md:p-8 w-[90%] max-w-md"
            >
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">
                Delete Installment
              </h3>
              <p className="mb-4 sm:mb-6 text-sm sm:text-base">
                Are you sure you want to delete installment #
                {deleteTarget.number}?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-2 rounded text-xs sm:text-base bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (deleteTarget) {
                      await deleteInstallment(deleteTarget.id);
                      setDeleteTarget(null);
                    }
                  }}
                  className="px-3 py-2 rounded text-xs sm:text-base bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

export default LoanTableView;
