import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Toast from "../ui/Toast";
import { useForm, SubmitHandler } from "react-hook-form";
import { useLocation } from "react-router-dom";
import { useRouteReady } from "../RouteReadySignal";
import { motion, AnimatePresence } from "framer-motion";
import { useData } from "../../context/DataContext";
import GlassCard from "../ui/GlassCard";
import PageWrapper from "../ui/PageWrapper";
import { useDebounce } from "../../utils/useDebounce";
import type {
  LoanWithCustomer,
  NewLoan,
  NewSubscription,
  NewInstallment,
} from "../../types";
import { formatDate } from "../../utils/dateFormatter";
import { openWhatsApp } from "../../utils/whatsapp";
import { WhatsAppIcon } from "../../constants";

type LoanInputs = {
  original_amount: number;
  totalRepayableAmount: number;
  payment_date: string;
  total_instalments: number;
  check_number?: string;
};

type SubscriptionInputs = Omit<NewSubscription, "customer_id"> & {
  late_fee?: number | null;
};

type InstallmentInputs = Omit<NewInstallment, "loan_id" | "customer_id">;

const getTodayDateString = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const AddRecordPage = () => {
  const signalRouteReady = useRouteReady();
  const {
    customers,
    customerMap,
    loans,
    installments,
    installmentsByLoanId,
    addLoan,
    addSubscription,
    addInstallment,
  } = useData();
  const location = useLocation();

  useEffect(() => {
    signalRouteReady();
  }, [signalRouteReady]);
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [action, setAction] = useState<
    "loan" | "subscription" | "installment" | null
  >(null);
  const [activeLoan, setActiveLoan] = useState<LoanWithCustomer | null>(null);
  const [paidInstallmentNumbers, setPaidInstallmentNumbers] = useState<
    Set<number>
  >(new Set());
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [lastRecordData, setLastRecordData] = useState<{
    type: "loan" | "subscription" | "installment";
    customerPhone?: string;
    data: any;
  } | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });

  const customerLoans = useMemo(() => {
    if (!selectedCustomerId) return [] as LoanWithCustomer[];
    return loans.filter((loan) => loan.customer_id === selectedCustomerId);
  }, [selectedCustomerId, loans]);

  // Calculate if customer has an ongoing loan
  const hasOngoingLoan = useMemo(() => {
    return customerLoans.some((loan) => {
      const loanInstallments = installmentsByLoanId.get(loan.id) || [];
      const amountPaid = loanInstallments.reduce(
        (acc, inst) => acc + inst.amount,
        0,
      );
      const totalRepayable = loan.original_amount + loan.interest_amount;
      const paymentPercentage = (amountPaid / totalRepayable) * 100;
      return paymentPercentage < 80; // Ongoing if less than 80% paid
    });
  }, [customerLoans, installmentsByLoanId]);

  // Get details of ongoing loan for tooltip
  const ongoingLoanInfo = useMemo(() => {
    const ongoing = customerLoans.find((loan) => {
      const loanInstallments = installmentsByLoanId.get(loan.id) || [];
      const amountPaid = loanInstallments.reduce(
        (acc, inst) => acc + inst.amount,
        0,
      );
      const totalRepayable = loan.original_amount + loan.interest_amount;
      const paymentPercentage = (amountPaid / totalRepayable) * 100;
      return paymentPercentage < 80;
    });

    if (!ongoing) return null;

    const loanInstallments = installmentsByLoanId.get(ongoing.id) || [];
    const amountPaid = loanInstallments.reduce(
      (acc, inst) => acc + inst.amount,
      0,
    );
    const totalRepayable = ongoing.original_amount + ongoing.interest_amount;
    const paymentPercentage = Math.round((amountPaid / totalRepayable) * 100);

    return {
      paymentPercentage,
      amountPaid,
      totalRepayable,
    };
  }, [customerLoans, installmentsByLoanId]);

  const loanForm = useForm<LoanInputs>();
  const subscriptionForm = useForm<SubscriptionInputs>();
  const installmentForm = useForm<InstallmentInputs>();

  const resetAll = useCallback(() => {
    loanForm.reset({ payment_date: getTodayDateString() });
    subscriptionForm.reset();
    installmentForm.reset({ date: getTodayDateString() });
  }, [loanForm, subscriptionForm, installmentForm]);

  const successTimeoutRef = useRef<number | null>(null);
  const showTemporarySuccess = (message: string, followUp?: () => void) => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    resetAll();
    setAction(null);
    setShowSuccess(message);
  };

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (location.state?.newCustomerId) {
      setSelectedCustomerId(location.state.newCustomerId);
    }
  }, [location.state]);

  useEffect(() => {
    if (!selectedCustomerId) {
      resetAll();
      setActiveLoan(null);
      setPaidInstallmentNumbers(new Set());
      setAction(null);
      return;
    }

    if (customerLoans.length === 0) {
      setActiveLoan(null);
      setPaidInstallmentNumbers(new Set());
      setAction((prev) => (prev === "installment" ? null : prev));
      return;
    }

    const loanInProgress = customerLoans.find((loan) => {
      const paidCount = (installmentsByLoanId.get(loan.id) || []).length;
      return paidCount < loan.total_instalments;
    });

    if (loanInProgress) {
      setActiveLoan(loanInProgress);

      const loanInstallments =
        installmentsByLoanId.get(loanInProgress.id) || [];
      const sortedInstallments = [...loanInstallments].sort(
        (a, b) => b.installment_number - a.installment_number,
      );
      const paidNumbers = new Set(
        loanInstallments.map((i) => i.installment_number),
      );
      setPaidInstallmentNumbers(paidNumbers);

      if (sortedInstallments.length > 0) {
        const lastInstallment = sortedInstallments[0];
        const nextInstallmentNumber = lastInstallment.installment_number + 1;

        if (nextInstallmentNumber <= loanInProgress.total_instalments) {
          installmentForm.setValue("amount", lastInstallment.amount);
          installmentForm.setValue("installment_number", nextInstallmentNumber);
          installmentForm.setValue("date", getTodayDateString());
        }
      } else {
        const monthlyAmount = Math.round(
          (loanInProgress.original_amount + loanInProgress.interest_amount) /
            loanInProgress.total_instalments,
        );
        installmentForm.setValue("amount", monthlyAmount);
        installmentForm.setValue("installment_number", 1);
        installmentForm.setValue("date", getTodayDateString());
      }

      setAction((prev) => (prev === null ? "installment" : prev));
    } else {
      setActiveLoan(null);
      setPaidInstallmentNumbers(new Set());
      setAction((prev) => (prev === "installment" ? null : prev));
    }
  }, [
    selectedCustomerId,
    customerLoans,
    installments,
    installmentForm,
    resetAll,
  ]);

  const handleLoanSubmit: SubmitHandler<LoanInputs> = async (data) => {
    if (!selectedCustomerId) return;

    if (data.totalRepayableAmount < data.original_amount) {
      loanForm.setError("totalRepayableAmount", {
        type: "manual",
        message: "Must be greater than or equal to original amount.",
      });
      return;
    }

    const newLoanData: NewLoan = {
      customer_id: selectedCustomerId,
      original_amount: data.original_amount,
      interest_amount: data.totalRepayableAmount - data.original_amount,
      payment_date: data.payment_date,
      total_instalments: data.total_instalments,
      check_number: data.check_number || null,
    };

    try {
      await addLoan(newLoanData);
      const selectedCustomer = customerMap.get(selectedCustomerId);
      setLastRecordData({
        type: "loan",
        customerPhone: selectedCustomer?.phone,
        data: {
          customerName: selectedCustomer?.name,
          original_amount: data.original_amount,
          interest_amount: data.totalRepayableAmount - data.original_amount,
          payment_date: data.payment_date,
          total_instalments: data.total_instalments,
        },
      });
      showTemporarySuccess("Loan recorded successfully!");
    } catch (error: any) {
      setToast({ show: true, message: error.message || "An error occurred." });
    }
  };

  const handleSubscriptionSubmit: SubmitHandler<SubscriptionInputs> = async (
    data,
  ) => {
    if (!selectedCustomerId) return;
    const sanitizedLateFee =
      data.late_fee != null && !isNaN(data.late_fee) ? data.late_fee : null;
    const newSubscriptionData: NewSubscription = {
      ...data,
      late_fee: sanitizedLateFee,
      customer_id: selectedCustomerId,
    };

    try {
      await addSubscription(newSubscriptionData);
      const selectedCustomer = customerMap.get(selectedCustomerId);
      setLastRecordData({
        type: "subscription",
        customerPhone: selectedCustomer?.phone,
        data: {
          customerName: selectedCustomer?.name,
          amount: data.amount,
          date: data.date,
          receipt: data.receipt,
          late_fee: data.late_fee,
        },
      });
      showTemporarySuccess("Subscription recorded successfully!", () => {
        if (activeLoan) setAction("installment");
        else setAction(null);
      });
    } catch (error: any) {
      setToast({ show: true, message: error.message || "An error occurred." });
    }
  };

  const handleInstallmentSubmit: SubmitHandler<InstallmentInputs> = async (
    data,
  ) => {
    if (!activeLoan) return;

    const loanInstallments = installmentsByLoanId.get(activeLoan.id) || [];
    const totalPaid = loanInstallments.reduce(
      (sum, inst) => sum + inst.amount,
      0,
    );
    const totalRepayable =
      activeLoan.original_amount + activeLoan.interest_amount;
    const newTotalPaid = totalPaid + data.amount;
    if (newTotalPaid > totalRepayable) {
      installmentForm.setError("amount", {
        type: "manual",
        message: `Total paid (₹${newTotalPaid.toLocaleString()}) cannot exceed total repayable (₹${totalRepayable.toLocaleString()})`,
      });
      return;
    }

    const installmentPayload: NewInstallment = {
      loan_id: activeLoan.id,
      installment_number: data.installment_number,
      amount: data.amount,
      date: data.date,
      receipt_number: data.receipt_number,
    };

    if (data.late_fee && !Number.isNaN(data.late_fee) && data.late_fee > 0) {
      installmentPayload.late_fee = data.late_fee;
    }

    try {
      const newInstallment = await addInstallment(installmentPayload);
      const selectedCustomer = customerMap.get(selectedCustomerId);
      setLastRecordData({
        type: "installment",
        customerPhone: selectedCustomer?.phone,
        data: {
          customerName: selectedCustomer?.name,
          installment_number: data.installment_number,
          amount: data.amount,
          date: data.date,
          receipt_number: data.receipt_number,
          late_fee: data.late_fee,
          loanAmount: activeLoan.original_amount,
          totalRepayable:
            activeLoan.original_amount + activeLoan.interest_amount,
        },
      });

      setShowSuccess(`Installment #${data.installment_number} recorded!`);
      const updatedPaidNumbers = new Set(paidInstallmentNumbers);
      updatedPaidNumbers.add(data.installment_number);
      setPaidInstallmentNumbers(updatedPaidNumbers);

      const nextInstallmentNumber = data.installment_number + 1;
      if (nextInstallmentNumber <= activeLoan.total_instalments) {
        installmentForm.setValue("amount", data.amount);
        installmentForm.setValue("installment_number", nextInstallmentNumber);
        installmentForm.setValue("receipt_number", "");
        installmentForm.setValue("late_fee", 0);
        installmentForm.setValue("date", getTodayDateString());
      } else {
        installmentForm.reset();
        setAction(null);
      }
    } catch (error: any) {
      setToast({ show: true, message: error.message || "An error occurred." });
    }
  };

  const formVariants = {
    hidden: { opacity: 0, y: -20, height: 0, overflow: "hidden" },
    visible: {
      opacity: 1,
      y: 0,
      height: "auto",
      overflow: "visible",
      transition: { duration: 0.4 },
    },
    exit: {
      opacity: 0,
      y: -20,
      height: 0,
      overflow: "hidden",
      transition: { duration: 0.3 },
    },
  };

  // UPDATED: Added marginTop/marginBottom control to exit variant to prevent 'space-y' snap
  const actionButtonsVariants = {
    hidden: {
      opacity: 0,
      y: 10,
      height: 0,
      marginTop: 0,
      marginBottom: 0,
      overflow: "hidden",
    },
    visible: {
      opacity: 1,
      y: 0,
      height: "auto",
      // We don't force margin here so Tailwind classes apply,
      // but Framer Motion will measure them for the exit animation.
      overflow: "visible",
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      y: 10,
      height: 0,
      marginTop: 0, // Collapses the space-y margin
      marginBottom: 0,
      overflow: "hidden",
      transition: {
        height: { duration: 0.3, ease: "easeInOut" },
        marginTop: { duration: 0.3, ease: "easeInOut" },
        marginBottom: { duration: 0.3, ease: "easeInOut" },
        opacity: { duration: 0.2 }, // Fade out slightly faster than collapse
      },
    },
  };

  const monthlyInstallment = activeLoan
    ? (
        (activeLoan.original_amount + activeLoan.interest_amount) /
        activeLoan.total_instalments
      ).toFixed(2)
    : 0;
  const availableInstallmentNumbers = activeLoan
    ? Array.from(
        { length: activeLoan.total_instalments },
        (_, i) => i + 1,
      ).filter((num) => !paidInstallmentNumbers.has(num))
    : [];

  const inputStyles =
    "w-full bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 dark:placeholder-dark-muted text-gray-800 dark:text-dark-text";
  const dateInputStyles =
    "w-full bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 dark:placeholder-dark-muted text-gray-800 dark:text-dark-text text-base block";
  const dateInputInlineStyles = {
    minHeight: "42px",
    WebkitAppearance: "none" as const,
  };
  const selectStyles =
    "w-full bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 dark:text-dark-text";
  const { isSubmitting: isSubmittingLoan } = loanForm.formState;
  const { isSubmitting: isSubmittingSubscription } = subscriptionForm.formState;
  const { isSubmitting: isSubmittingInstallment } = installmentForm.formState;
  const hasCustomerLoans = customerLoans.length > 0;
  const isAnySubmitting =
    isSubmittingLoan || isSubmittingSubscription || isSubmittingInstallment;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()) ||
        c.phone.includes(debouncedCustomerSearch),
    );
  }, [customers, debouncedCustomerSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleSwitchCustomer = () => {
    setSelectedCustomerId("");
    setCustomerSearch("");
    setAction(null);
    setActiveLoan(null);
    setPaidInstallmentNumbers(new Set());
    resetAll();
    setDropdownOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  return (
    <PageWrapper>
      <Toast
        show={toast.show}
        message={toast.message}
        onClose={() => setToast({ show: false, message: "" })}
        type="error"
      />
      <div className="flex items-center justify-center min-h-[60vh] px-2 sm:px-0">
        <GlassCard className="w-full max-w-xs sm:max-w-2xl !p-4 sm:!p-8 mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-gray-800 dark:text-dark-text">
            Record an Action
          </h2>
          <div className="space-y-4 sm:space-y-6">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                Select Customer
              </label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  className="w-full bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg py-2 px-4 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 flex justify-between items-center text-gray-800 dark:text-dark-text"
                  onClick={() => setDropdownOpen((open) => !open)}
                >
                  {selectedCustomerId
                    ? (() => {
                        const selected = customerMap.get(selectedCustomerId);
                        return selected
                          ? `${selected.name} (${selected.phone})`
                          : "Select...";
                      })()
                    : "Select..."}
                  <svg
                    className={`w-4 h-4 ml-2 transition-transform ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {dropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg shadow-lg max-h-60 overflow-auto animate-fadeIn">
                    <div className="relative">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search by name or phone..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        ref={searchInputRef}
                        className="w-full bg-white dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border rounded-t-lg py-2 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-dark-muted text-gray-800 dark:text-dark-text"
                      />
                      {customerSearch && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text p-1"
                          aria-label="Clear search"
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
                    <ul>
                      {filteredCustomers.length === 0 && (
                        <li className="px-4 py-2 text-gray-400 dark:text-dark-muted">
                          No customers found
                        </li>
                      )}
                      {filteredCustomers.map((customer) => (
                        <li
                          key={customer.id}
                          className={`px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-800 dark:text-dark-text ${
                            selectedCustomerId === customer.id
                              ? "bg-indigo-50 dark:bg-indigo-900/50 font-bold"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedCustomerId(customer.id);
                            setDropdownOpen(false);
                          }}
                        >
                          {customer.name} ({customer.phone})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {selectedCustomerId && (
                <motion.div
                  key="action-buttons"
                  variants={actionButtonsVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap justify-center gap-3 py-4">
                    {hasCustomerLoans ? (
                      <>
                        <motion.button
                          whileHover={{ scale: !hasOngoingLoan ? 1.05 : 1 }}
                          whileTap={{ scale: !hasOngoingLoan ? 0.95 : 1 }}
                          onClick={() => setAction("loan")}
                          disabled={isAnySubmitting || hasOngoingLoan}
                          className={`font-bold py-2 px-6 rounded-lg transition-colors ${
                            hasOngoingLoan
                              ? "bg-gray-400 text-gray-700 cursor-not-allowed opacity-60"
                              : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={
                            hasOngoingLoan
                              ? `Ongoing loan at ${ongoingLoanInfo?.paymentPercentage}% paid. Customer must pay >80% before recording new loan.`
                              : ""
                          }
                        >
                          Record Another Loan
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => activeLoan && setAction("installment")}
                          disabled={!activeLoan || isAnySubmitting}
                          className="font-bold py-2 px-6 rounded-lg transition-colors bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Record Installment
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setAction("subscription")}
                          disabled={isAnySubmitting}
                          className="font-bold py-2 px-6 rounded-lg transition-colors bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Record Subscription
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleSwitchCustomer}
                          disabled={isAnySubmitting}
                          className="font-bold py-2 px-6 rounded-lg transition-colors bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Switch Customer
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setAction("loan")}
                          disabled={isAnySubmitting}
                          className="font-bold py-2 px-6 rounded-lg transition-colors bg-gray-100 dark:bg-gray-700 hover:bg-indigo-600 hover:text-white text-gray-800 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Record Loan
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setAction("subscription")}
                          disabled={isAnySubmitting}
                          className="font-bold py-2 px-6 rounded-lg transition-colors bg-gray-100 dark:bg-gray-700 hover:bg-indigo-600 hover:text-white text-gray-800 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Record Subscription
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleSwitchCustomer}
                          disabled={isAnySubmitting}
                          className="font-bold py-2 px-6 rounded-lg transition-colors bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Switch Customer
                        </motion.button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <AnimatePresence mode="wait">
                {action === "installment" && activeLoan && (
                  <motion.div
                    key="installment-form"
                    variants={formVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="border-t border-gray-200 dark:border-dark-border pt-6 mt-6"
                  >
                    <form
                      onSubmit={installmentForm.handleSubmit(
                        handleInstallmentSubmit,
                      )}
                      className="space-y-4 overflow-hidden"
                    >
                      <h3 className="text-xl font-semibold text-center text-gray-800 dark:text-dark-text">
                        Record Installment for {activeLoan.customers?.name}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                            Installment Amount
                          </label>
                          <input
                            type="number"
                            {...installmentForm.register("amount", {
                              required: "Amount is required",
                              valueAsNumber: true,
                              min: {
                                value: 0.01,
                                message: "Amount must be positive",
                              },
                            })}
                            placeholder={`e.g., ₹${monthlyInstallment}`}
                            className={inputStyles}
                            disabled={isSubmittingInstallment}
                          />
                          {installmentForm.formState.errors.amount && (
                            <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                              {installmentForm.formState.errors.amount.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                            Installment Number
                          </label>
                          <select
                            {...installmentForm.register("installment_number", {
                              required: "Please select an installment number",
                              valueAsNumber: true,
                            })}
                            className={selectStyles}
                            disabled={isSubmittingInstallment}
                          >
                            <option value="">Select...</option>
                            {availableInstallmentNumbers.map((num) => (
                              <option key={num} value={num}>
                                {num}
                              </option>
                            ))}
                          </select>
                          {installmentForm.formState.errors
                            .installment_number && (
                            <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                              {
                                installmentForm.formState.errors
                                  .installment_number.message
                              }
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                            Payment Date
                          </label>
                          <div className="overflow-hidden rounded-lg">
                            <input
                              {...installmentForm.register("date", {
                                required: "Date is required",
                              })}
                              type="date"
                              className={dateInputStyles}
                              style={dateInputInlineStyles}
                              disabled={isSubmittingInstallment}
                              min="1980-01-01"
                              max="2050-12-31"
                            />
                          </div>
                          {installmentForm.formState.errors.date && (
                            <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                              {installmentForm.formState.errors.date.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                            Receipt Number
                          </label>
                          <input
                            {...installmentForm.register("receipt_number", {
                              required: "Receipt number is required",
                            })}
                            type="text"
                            placeholder="Installment Receipt No."
                            className={inputStyles}
                            disabled={isSubmittingInstallment}
                          />
                          {installmentForm.formState.errors.receipt_number && (
                            <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                              {
                                installmentForm.formState.errors.receipt_number
                                  .message
                              }
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                          Late Fee (Optional)
                        </label>
                        <input
                          type="number"
                          {...installmentForm.register("late_fee", {
                            valueAsNumber: true,
                            min: {
                              value: 0,
                              message: "Late fee cannot be negative.",
                            },
                          })}
                          placeholder="e.g., 10"
                          className={inputStyles}
                          disabled={isSubmittingInstallment}
                        />
                        {installmentForm.formState.errors.late_fee && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                            {installmentForm.formState.errors.late_fee.message}
                          </p>
                        )}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 font-bold py-2 px-4 rounded-lg text-white"
                        disabled={isSubmittingInstallment}
                      >
                        {isSubmittingInstallment
                          ? "Saving..."
                          : "Submit Payment"}
                      </motion.button>
                    </form>
                  </motion.div>
                )}

                {action === "loan" && (
                  <motion.form
                    key="loan-form"
                    variants={formVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={loanForm.handleSubmit(handleLoanSubmit)}
                    className="space-y-4 overflow-hidden"
                  >
                    <h3 className="text-xl font-semibold text-center text-gray-800 dark:text-dark-text">
                      Loan Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <input
                          {...loanForm.register("original_amount", {
                            required: "Original amount is required",
                            valueAsNumber: true,
                            min: {
                              value: 1,
                              message: "Amount must be positive",
                            },
                          })}
                          type="number"
                          placeholder="₹ Original Amount"
                          className={inputStyles}
                          disabled={isSubmittingLoan}
                        />
                        {loanForm.formState.errors.original_amount && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                            {loanForm.formState.errors.original_amount.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <input
                          {...loanForm.register("totalRepayableAmount", {
                            required: "Total repayable is required",
                            valueAsNumber: true,
                          })}
                          type="number"
                          placeholder="₹ Total Repayable Amount"
                          className={inputStyles}
                          disabled={isSubmittingLoan}
                        />
                        {loanForm.formState.errors.totalRepayableAmount && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                            {
                              loanForm.formState.errors.totalRepayableAmount
                                .message
                            }
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="overflow-hidden rounded-lg">
                          <input
                            {...loanForm.register("payment_date", {
                              required: "Payment date is required",
                            })}
                            type="date"
                            className={dateInputStyles}
                            style={dateInputInlineStyles}
                            disabled={isSubmittingLoan}
                            min="1980-01-01"
                            max="2050-12-31"
                          />
                        </div>
                        {loanForm.formState.errors.payment_date && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                            {loanForm.formState.errors.payment_date.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <input
                          {...loanForm.register("total_instalments", {
                            required: "Total instalments is required",
                            valueAsNumber: true,
                            min: { value: 1, message: "Must be at least 1" },
                          })}
                          type="number"
                          placeholder="Total Instalments"
                          className={inputStyles}
                          disabled={isSubmittingLoan}
                        />
                        {loanForm.formState.errors.total_instalments && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                            {
                              loanForm.formState.errors.total_instalments
                                .message
                            }
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <input
                          {...loanForm.register("check_number")}
                          type="text"
                          placeholder="Check Number (optional)"
                          className={inputStyles}
                          disabled={isSubmittingLoan}
                        />
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-2 px-4 rounded-lg"
                      disabled={isSubmittingLoan}
                    >
                      {isSubmittingLoan ? "Saving..." : "Submit Loan"}
                    </motion.button>
                  </motion.form>
                )}
                {action === "subscription" && (
                  <motion.div
                    key="subscription-form"
                    variants={formVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="border-t border-gray-200 dark:border-dark-border pt-6 mt-6"
                  >
                    <form
                      onSubmit={subscriptionForm.handleSubmit(
                        handleSubscriptionSubmit,
                      )}
                      className="space-y-4 overflow-hidden"
                    >
                      <h3 className="text-xl font-semibold text-center text-gray-800 dark:text-dark-text">
                        Subscription Details
                      </h3>
                      <div>
                        <input
                          {...subscriptionForm.register("amount", {
                            required: "Amount is required",
                            valueAsNumber: true,
                            min: {
                              value: 1,
                              message: "Amount must be positive",
                            },
                          })}
                          type="number"
                          placeholder="₹ Amount"
                          className={inputStyles}
                          disabled={isSubmittingSubscription}
                        />
                        {subscriptionForm.formState.errors.amount && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                            {subscriptionForm.formState.errors.amount.message}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="overflow-hidden rounded-lg">
                            <input
                              {...subscriptionForm.register("date", {
                                required: "Date is required",
                              })}
                              type="date"
                              className={dateInputStyles}
                              style={dateInputInlineStyles}
                              disabled={isSubmittingSubscription}
                              min="1980-01-01"
                              max="2050-12-31"
                            />
                          </div>
                          {subscriptionForm.formState.errors.date && (
                            <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                              {subscriptionForm.formState.errors.date.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <input
                            {...subscriptionForm.register("receipt", {
                              required: "Receipt is required",
                            })}
                            type="text"
                            placeholder="Receipt"
                            className={inputStyles}
                            disabled={isSubmittingSubscription}
                          />
                          {subscriptionForm.formState.errors.receipt && (
                            <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                              {
                                subscriptionForm.formState.errors.receipt
                                  .message
                              }
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                          Late Fee (Optional)
                        </label>
                        <input
                          type="number"
                          {...subscriptionForm.register("late_fee", {
                            valueAsNumber: true,
                            min: {
                              value: 0,
                              message: "Late fee cannot be negative.",
                            },
                          })}
                          placeholder="e.g., 10"
                          className={inputStyles}
                          disabled={isSubmittingSubscription}
                        />
                        {subscriptionForm.formState.errors.late_fee && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                            {subscriptionForm.formState.errors.late_fee.message}
                          </p>
                        )}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-2 px-4 rounded-lg"
                        disabled={isSubmittingSubscription}
                      >
                        {isSubmittingSubscription
                          ? "Saving..."
                          : "Submit Subscription"}
                      </motion.button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {showSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg"
                  >
                    <div className="text-center mb-4">
                      <span className="font-semibold text-lg">
                        {showSuccess}
                      </span>
                    </div>

                    {lastRecordData && lastRecordData.customerPhone && (
                      <div className="flex justify-center mb-4">
                        <motion.button
                          type="button"
                          onClick={() => {
                            const data = lastRecordData.data;
                            let message = "";
                            if (lastRecordData.type === "loan") {
                              message = `Hi ${data.customerName}, your loan of ₹${data.original_amount.toLocaleString()} with interest ₹${data.interest_amount.toLocaleString()} (Total: ₹${(data.original_amount + data.interest_amount).toLocaleString()}) has been recorded. Payment date: ${formatDate(data.payment_date)}. Total installments: ${data.total_instalments}. Thank You, I J Reddy.`;
                            } else if (lastRecordData.type === "subscription") {
                              message = `Hi ${data.customerName}, your subscription of ₹${data.amount.toLocaleString()} was recorded on ${formatDate(data.date)}${data.late_fee && data.late_fee > 0 ? ` (Late fee: ₹${data.late_fee})` : ""}. Thank You, I J Reddy.`;
                            } else if (lastRecordData.type === "installment") {
                              message = `Hi ${data.customerName}, your installment payment of ₹${data.amount.toLocaleString()} (Installment #${data.installment_number}) has been recorded on ${formatDate(data.date)}. Receipt: ${data.receipt_number}${data.late_fee && data.late_fee > 0 ? ` (Late fee: ₹${data.late_fee})` : ""}. Thank You, I J Reddy.`;
                            }
                            openWhatsApp(
                              lastRecordData.customerPhone,
                              message,
                              { cooldownMs: 800 },
                            );
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <WhatsAppIcon className="w-5 h-5" />
                          Send in WhatsApp
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </GlassCard>
      </div>
    </PageWrapper>
  );
};

export default AddRecordPage;
