import React, {
  useMemo,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";
import PageWrapper from "../ui/PageWrapper";
import GlassCard from "../ui/GlassCard";
import { useRouteReady } from "../RouteReadySignal";
import { UsersIcon } from "../../constants";
import { FIRE_STATIONS } from "../../constants/fireStations";
import { useData } from "../../context/DataContext";
import type { Customer } from "../../types";
import { Trash2Icon } from "../../constants";
import { formatDate } from "../../utils/dateFormatter";
import { useDebounce } from "../../utils/useDebounce";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { useModalBackHandler } from "../../utils/useModalBackHandler";
import AlertPopup from "../ui/AlertPopup";

// Animation variants
const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (delay = 0) => ({
    opacity: 1,
    transition: {
      delay,
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  }),
};

const listItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
};

const tableRowVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 15,
    scale: 0.98,
  },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
      delay: i * 0.04,
    },
  }),
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: {
      duration: 0.15,
    },
  },
  hover: {
    backgroundColor: "rgba(99, 102, 241, 0.05)",
    transition: { duration: 0.2 },
  },
};

const tableBodyVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.15,
    },
  },
};

const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const modalContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15 },
  },
};

const buttonVariants: Variants = {
  idle: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
    },
  },
};

const deleteButtonVariants: Variants = {
  idle: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.15,
    rotate: [0, -10, 10, -5, 0],
    transition: {
      scale: { type: "spring", stiffness: 400, damping: 20 },
      rotate: { duration: 0.4 },
    },
  },
  tap: { scale: 0.9 },
};

const searchResultVariants: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: {
      height: { type: "spring", stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.2 },
  },
};

const LoanSeniorityPage = () => {
  const signalRouteReady = useRouteReady();
  const {
    customers,
    loans,
    subscriptions,
    seniorityList,
    fetchSeniorityList,
    addToSeniority,
    updateSeniority,
    removeFromSeniority,
    isScopedCustomer,
    installmentsByLoanId,
  } = useData();
  const [addSearchTerm, setAddSearchTerm] = useState("");
  const debouncedAddSearchTerm = useDebounce(addSearchTerm, 300);
  const [listSearchTerm, setListSearchTerm] = useState("");
  const debouncedListSearchTerm = useDebounce(listSearchTerm, 300);
  const headerDelay = 0;
  const searchSectionDelay = 0.3;
  const listSectionDelay = isScopedCustomer ? 0.35 : 0.5;
  const itemsPerPage = 20;
  const addSearchLimit = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Alert Popup State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setAlertConfig({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // Signal readiness on mount
  useEffect(() => {
    signalRouteReady();
  }, [signalRouteReady]);

  useEffect(() => {
    fetchSeniorityList().catch((err) =>
      console.error("Failed to load seniority list", err),
    );
  }, [fetchSeniorityList]);

  useEffect(() => {
    setCurrentPage(1);
  }, [seniorityList, debouncedListSearchTerm]);

  const filteredSeniorityList = useMemo(() => {
    const term = debouncedListSearchTerm?.toLowerCase() || "";
    if (!term) return seniorityList || [];
    return (seniorityList || []).filter(
      (entry: any) =>
        entry.customers?.name?.toLowerCase().includes(term) ||
        String(entry.customers?.phone || "")
          .toLowerCase()
          .includes(term) ||
        entry.station_name?.toLowerCase().includes(term) ||
        entry.loan_type?.toLowerCase().includes(term),
    );
  }, [debouncedListSearchTerm, seniorityList]);

  const existingSeniorityCustomerIds = useMemo(() => {
    return new Set(
      (seniorityList || []).map((entry: any) => entry.customer_id),
    );
  }, [seniorityList]);

  // Helper function to calculate repayment progress for a customer
  const getCustomerRepaymentProgress = (customerId: string): number => {
    const customerLoans = (loans || []).filter(
      (loan) => loan.customer_id === customerId,
    );
    if (!customerLoans.length) return 0; // First-time loan eligible

    let maxProgress = 0;
    customerLoans.forEach((loan) => {
      const loanInstallments = installmentsByLoanId?.get(loan.id) || [];
      const paidAmount = loanInstallments.reduce(
        (sum, inst) => sum + (inst.amount || 0),
        0,
      );
      const totalRepayable =
        (loan.original_amount || 0) + (loan.interest_amount || 0);
      if (totalRepayable > 0) {
        const progress = Math.min(paidAmount / totalRepayable, 1);
        if (progress > maxProgress) {
          maxProgress = progress;
        }
      }
    });

    return maxProgress;
  };

  // Helper function to check if customer meets repayment threshold
  const meetsRepaymentThreshold = (
    customerId: string,
    progress: number,
  ): boolean => {
    const customerLoans = (loans || []).filter(
      (loan) => loan.customer_id === customerId,
    );
    // Allow if first-time (no loans) OR 80%+ repayment
    return customerLoans.length === 0 || progress >= 0.8;
  };

  const matchedCustomers = useMemo(() => {
    const term = debouncedAddSearchTerm.trim().toLowerCase();
    if (!term) return [];

    // Get all matching customers by name/phone
    const matching = (customers || [])
      .filter((customer: Customer) => {
        const name = customer.name?.toLowerCase() || "";
        const phone = String(customer.phone || "").toLowerCase();
        return name.includes(term) || phone.includes(term);
      })
      .sort((a: Customer, b: Customer) =>
        (a.name || "").localeCompare(b.name || ""),
      )
      .slice(0, addSearchLimit);

    // Map to include eligibility info
    return matching.map((customer: Customer) => {
      const isInSeniority = existingSeniorityCustomerIds.has(customer.id);
      const progress = getCustomerRepaymentProgress(customer.id);
      const progressPercent = Math.round(progress * 100);
      const meetsThreshold = meetsRepaymentThreshold(customer.id, progress);

      let isBlocked = false;
      let blockReason = "";

      if (isInSeniority) {
        isBlocked = true;
        blockReason = "Already in seniority list";
      } else if (!meetsThreshold) {
        isBlocked = true;
        blockReason = `Requires 80% repayment (current ${progressPercent}%)`;
      }

      return { customer, isBlocked, blockReason };
    });
  }, [
    customers,
    debouncedAddSearchTerm,
    existingSeniorityCustomerIds,
    loans,
    installmentsByLoanId,
  ]);

  const totalPages = useMemo(() => {
    return Math.max(
      1,
      Math.ceil((filteredSeniorityList?.length || 0) / itemsPerPage),
    );
  }, [filteredSeniorityList, itemsPerPage]);

  const paginatedSeniorityList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return (filteredSeniorityList || []).slice(start, end);
  }, [filteredSeniorityList, currentPage, itemsPerPage]);

  const addCustomerToList = async (customer: Customer) => {
    setModalCustomer({ id: customer.id, name: customer.name });
    setModalEditingId(null);
    setStationName("");
    setLoanType("General");
    setLoanRequestDate("");
    // Set date to today for scoped users
    if (isScopedCustomer) {
      const today = new Date().toISOString().split("T")[0];
      setLoanRequestDate(today);
    }
  };

  const removeFromList = async (id: string) => {
    try {
      await removeFromSeniority(id);
    } catch (err) {
      showAlert(
        "Error",
        (err as Error).message ||
          "Failed to remove customer from seniority list",
        "error",
      );
    }
  };

  const [modalCustomer, setModalCustomer] = useState<any | null>(null);
  const [stationName, setStationName] = useState("");
  const [stationSearchTerm, setStationSearchTerm] = useState("");
  const [isStationDropdownOpen, setIsStationDropdownOpen] = useState(false);
  const [loanType, setLoanType] = useState("General");
  const [loanRequestDate, setLoanRequestDate] = useState("");
  const [modalEditingId, setModalEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const listSearchInputRef = useRef<HTMLInputElement | null>(null);
  const stationDropdownRef = useRef<HTMLDivElement>(null);

  // Filter fire stations based on search term
  const filteredStations = useMemo(() => {
    const term = stationSearchTerm.toLowerCase().trim();
    if (!term) return FIRE_STATIONS;
    return FIRE_STATIONS.filter((station) =>
      station.toLowerCase().includes(term),
    );
  }, [stationSearchTerm]);

  // Close station dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        stationDropdownRef.current &&
        !stationDropdownRef.current.contains(event.target as Node)
      ) {
        setIsStationDropdownOpen(false);
      }
    };

    if (isStationDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isStationDropdownOpen]);

  // Close search on Escape
  useEscapeKey(!!addSearchTerm, () => setAddSearchTerm(""));

  // Close search on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setAddSearchTerm("");
      }
    };

    if (addSearchTerm) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [addSearchTerm]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeFromSeniority(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      showAlert(
        "Error",
        (err as Error).message ||
          "Failed to remove customer from seniority list",
        "error",
      );
    }
  };

  const closeModal = useCallback(() => {
    setModalCustomer(null);
    setStationName("");
    setStationSearchTerm("");
    setIsStationDropdownOpen(false);
    setLoanType("General");
    setLoanRequestDate("");
  }, []);

  useEscapeKey(!!modalCustomer, closeModal);
  useEscapeKey(!!deleteTarget, () => setDeleteTarget(null));

  // Handle back button for modals
  useModalBackHandler(!!modalCustomer, closeModal);
  useModalBackHandler(!!deleteTarget, () => setDeleteTarget(null));

  // Close modal on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If modal is open (modalCustomer exists) and click is outside modalRef
      if (
        modalCustomer &&
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        closeModal();
      }
    };

    if (modalCustomer) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [modalCustomer, closeModal]);

  const saveModalEntry = async () => {
    if (!modalCustomer) return;
    try {
      const details = {
        station_name: stationName || null,
        loan_type: loanType || null,
        loan_request_date: loanRequestDate || null,
      };
      if (modalEditingId) {
        await updateSeniority(modalEditingId, details);
      } else {
        await addToSeniority(modalCustomer.id, details);
      }
      closeModal();
    } catch (err: any) {
      // Check for specific duplicate error from addToSeniority
      if (
        err.message === "This customer is already in the loan seniority list."
      ) {
        showAlert("Duplicate Entry", err.message, "info");
      } else {
        showAlert(
          "Error",
          err.message || "Failed to save seniority entry",
          "error",
        );
      }
    }
  };

  return (
    <PageWrapper>
      <AlertPopup
        isOpen={alertConfig.isOpen}
        onClose={closeAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />
      <motion.div
        className="flex items-center justify-between mb-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
          delay: headerDelay,
        }}
      >
        <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-dark-text">
          <motion.span
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: headerDelay + 0.1,
            }}
          >
            <UsersIcon className="w-8 h-8" />
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: headerDelay + 0.2 }}
          >
            Loan Seniority
          </motion.span>
        </h2>
      </motion.div>
      {!isScopedCustomer && (
        <GlassCard className="mb-6 !p-4" hoverScale={false}>
          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              delay: searchSectionDelay,
              type: "spring",
              stiffness: 260,
              damping: 22,
            }}
          >
            <div className="relative flex-1" ref={searchContainerRef}>
              <motion.input
                className="w-full bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg py-2 px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-muted"
                placeholder="Search customers to add by name or phone..."
                value={addSearchTerm}
                onChange={(e) => setAddSearchTerm(e.target.value)}
                whileFocus={{
                  scale: 1.01,
                  boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.1)",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
              <AnimatePresence>
                {addSearchTerm && (
                  <motion.button
                    type="button"
                    onClick={() => setAddSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text p-1"
                    aria-label="Clear search"
                    initial={{ opacity: 0, scale: 0, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0, rotate: 90 }}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
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
                  </motion.button>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {debouncedAddSearchTerm && matchedCustomers.length > 0 && (
                  <motion.div
                    className="absolute left-0 mt-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg max-h-72 overflow-y-auto z-20 min-w-max"
                    variants={searchResultVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <div className="px-4 py-2 text-xs text-gray-500 dark:text-dark-muted border-b border-gray-100 dark:border-dark-border">
                      Showing {matchedCustomers.length} result
                      {matchedCustomers.length === 1 ? "" : "s"}
                      {matchedCustomers.length === addSearchLimit
                        ? " (limited)"
                        : ""}
                    </div>
                    {matchedCustomers.map(
                      ({ customer, isBlocked, blockReason }) => (
                        <motion.button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            if (!isBlocked) {
                              addCustomerToList(customer);
                              setAddSearchTerm("");
                            }
                          }}
                          disabled={isBlocked}
                          className={`w-full flex items-center justify-between text-left px-3 py-1.5 transition-colors ${
                            isBlocked
                              ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50"
                              : "hover:bg-indigo-50 dark:hover:bg-slate-800"
                          } text-gray-800 dark:text-dark-text`}
                          title={isBlocked ? blockReason : undefined}
                          variants={listItemVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium">{customer.name}</span>
                            <span className="text-xs text-gray-500 dark:text-dark-muted">
                              {customer.phone || ""}
                            </span>
                            {isBlocked && (
                              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-0.5">
                                {blockReason}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ml-2 ${
                              isBlocked
                                ? "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                                : "text-white bg-indigo-600"
                            }`}
                          >
                            {isBlocked ? "Blocked" : "Add"}
                          </span>
                        </motion.button>
                      ),
                    )}
                  </motion.div>
                )}
                {debouncedAddSearchTerm && matchedCustomers.length === 0 && (
                  <motion.div
                    className="absolute left-0 right-0 mt-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-3 text-sm text-gray-500 dark:text-dark-muted z-20"
                    variants={searchResultVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    No customers match your search.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </GlassCard>
      )}

      {/* Entry modal - WRAPPED IN PORTAL */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {modalCustomer && (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={closeModal}
            >
              <motion.div
                className="bg-white dark:bg-dark-card rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md"
                variants={modalContentVariants}
                onClick={(e) => e.stopPropagation()}
                ref={modalRef}
              >
                <div className="flex items-center justify-between mb-4">
                  <motion.h3
                    className="text-lg font-semibold text-gray-800 dark:text-dark-text"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    {modalEditingId ? "Edit" : "Add"} Seniority Entry for{" "}
                    {modalCustomer.name}
                  </motion.h3>
                  <motion.button
                    onClick={closeModal}
                    className="text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-text"
                    whileHover={{ scale: 1.2, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    ✕
                  </motion.button>
                </div>
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                      Station Name
                    </label>
                    <div className="relative" ref={stationDropdownRef}>
                      <div
                        className={`w-full border rounded px-3 py-2 bg-white dark:bg-dark-bg text-gray-800 dark:text-dark-text cursor-pointer flex items-center justify-between transition-all ${
                          isStationDropdownOpen
                            ? "border-indigo-500 ring-2 ring-indigo-500"
                            : "border-gray-300 dark:border-dark-border"
                        }`}
                        onClick={() =>
                          setIsStationDropdownOpen(!isStationDropdownOpen)
                        }
                      >
                        <span
                          className={
                            stationName
                              ? ""
                              : "text-gray-400 dark:text-dark-muted"
                          }
                        >
                          {stationName || "Select a fire station..."}
                        </span>
                        <motion.svg
                          className="w-4 h-4 text-gray-500 dark:text-dark-muted"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          animate={{ rotate: isStationDropdownOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </motion.svg>
                      </div>
                      <AnimatePresence>
                        {isStationDropdownOpen && (
                          <motion.div
                            className="absolute z-50 w-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg overflow-hidden scrollbar-hide"
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="p-2 border-b border-gray-100 dark:border-dark-border sticky top-0 bg-white dark:bg-dark-card">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={stationSearchTerm}
                                  onChange={(e) =>
                                    setStationSearchTerm(e.target.value)
                                  }
                                  placeholder="Search fire stations..."
                                  className="w-full border border-gray-300 dark:border-dark-border rounded px-3 py-2 pl-8 bg-white dark:bg-dark-bg text-gray-800 dark:text-dark-text text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                                <svg
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-dark-muted"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                  />
                                </svg>
                                {stationSearchTerm && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setStationSearchTerm("");
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto scrollbar-hide">
                              {filteredStations.length > 0 ? (
                                filteredStations.map((station) => (
                                  <motion.button
                                    key={station}
                                    type="button"
                                    onClick={() => {
                                      setStationName(station);
                                      setStationSearchTerm("");
                                      setIsStationDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                      stationName === station
                                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium"
                                        : "text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-slate-800"
                                    }`}
                                    whileHover={{ x: 2 }}
                                    transition={{ duration: 0.1 }}
                                  >
                                    {station}
                                  </motion.button>
                                ))
                              ) : stationSearchTerm.trim().length > 0 ? (
                                <motion.button
                                  type="button"
                                  onClick={() => {
                                    setStationName(stationSearchTerm.trim());
                                    setStationSearchTerm("");
                                    setIsStationDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors font-medium"
                                  whileHover={{ x: 2 }}
                                  transition={{ duration: 0.1 }}
                                >
                                  + Add "{stationSearchTerm.trim()}" as custom
                                  station
                                </motion.button>
                              ) : (
                                <div className="px-3 py-4 text-sm text-gray-500 dark:text-dark-muted text-center">
                                  No stations found. Type to add a custom
                                  station name.
                                </div>
                              )}
                            </div>
                            {stationName && (
                              <div className="p-2 border-t border-gray-100 dark:border-dark-border">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStationName("");
                                    setStationSearchTerm("");
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                >
                                  Clear selection
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                      Loan Type
                    </label>
                    <select
                      value={loanType}
                      onChange={(e) => setLoanType(e.target.value)}
                      className="w-full border border-gray-300 dark:border-dark-border rounded px-3 py-2 bg-white dark:bg-dark-bg text-gray-800 dark:text-dark-text focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
                    >
                      <option value="General">General</option>
                      <option value="Medical">Medical</option>
                    </select>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                      Loan Request Date
                    </label>
                    <input
                      value={loanRequestDate}
                      onChange={(e) => setLoanRequestDate(e.target.value)}
                      type="date"
                      disabled={isScopedCustomer}
                      className="w-full border border-gray-300 dark:border-dark-border rounded px-3 py-2 text-base bg-white dark:bg-dark-bg block text-gray-800 dark:text-dark-text focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900"
                      style={{ minHeight: "42px", WebkitAppearance: "none" }}
                    />
                  </motion.div>
                </motion.div>
                <motion.div
                  className="mt-4 flex justify-end gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <motion.button
                    onClick={closeModal}
                    className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-dark-text"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={saveModalEntry}
                    className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Save
                  </motion.button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <GlassCard className="!p-4" hoverScale={false}>
        <motion.h3
          className="text-xl font-bold mb-3 text-gray-800 dark:text-dark-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: listSectionDelay,
            type: "spring",
            stiffness: 260,
            damping: 22,
          }}
        >
          Loan Seniority List
        </motion.h3>
        <div className="mb-4 relative">
          <input
            ref={listSearchInputRef}
            className="w-full md:w-96 bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg py-2 px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-muted"
            placeholder="Filter list by name, phone, station, or loan type..."
            value={listSearchTerm}
            onChange={(e) => setListSearchTerm(e.target.value)}
          />
          <AnimatePresence>
            {listSearchTerm && (
              <motion.button
                type="button"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  setListSearchTerm("");
                  listSearchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text p-1"
                aria-label="Clear search"
                initial={{ opacity: 0, scale: 0, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0, rotate: 90 }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
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
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        {!seniorityList || seniorityList.length === 0 ? (
          <motion.div
            className="text-sm text-gray-500 dark:text-dark-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: listSectionDelay + 0.1 }}
          >
            {isScopedCustomer
              ? "No seniority entries found."
              : "No customers added yet. Search above and click Add to include a customer."}
          </motion.div>
        ) : (
          <>
            {/* Desktop table */}
            <motion.div
              className="hidden md:block overflow-x-auto"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: listSectionDelay + 0.05,
                type: "spring",
                stiffness: 260,
                damping: 24,
              }}
            >
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">
                      Sr.No
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">
                      Customer
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">
                      Phone
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">
                      Station
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">
                      Loan Type
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">
                      Requested
                    </th>
                    {!isScopedCustomer && (
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <motion.tbody
                  initial="hidden"
                  animate="visible"
                  variants={tableBodyVariants}
                  transition={{ delay: listSectionDelay + 0.1 }}
                >
                  <AnimatePresence mode="popLayout">
                    {paginatedSeniorityList.map((entry: any, idx: number) => (
                      <motion.tr
                        key={entry.id}
                        className="even:bg-gray-50 dark:even:bg-gray-800/50 cursor-pointer"
                        custom={idx}
                        variants={tableRowVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        whileHover="hover"
                        layout
                        layoutId={`row-${entry.id}`}
                      >
                        <td className="px-4 py-3 text-gray-800 dark:text-dark-text">
                          {(currentPage - 1) * itemsPerPage + idx + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-indigo-700 dark:text-indigo-400">
                          {entry.customers?.name || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-dark-muted">
                          {entry.customers?.phone || ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-dark-text">
                          {entry.station_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-dark-text">
                          {entry.loan_type || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-dark-text">
                          {entry.loan_request_date
                            ? formatDate(entry.loan_request_date)
                            : "-"}
                        </td>
                        {!isScopedCustomer && (
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <motion.button
                                onClick={() => {
                                  setModalCustomer({
                                    id: entry.customer_id,
                                    name: entry.customers?.name,
                                  });
                                  setStationName(entry.station_name || "");
                                  setLoanType(entry.loan_type || "General");
                                  setLoanRequestDate(
                                    entry.loan_request_date || "",
                                  );
                                  setModalEditingId(entry.id);
                                }}
                                aria-label={`Edit seniority entry ${entry.id}`}
                                className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                                variants={buttonVariants}
                                initial="idle"
                                whileHover="hover"
                                whileTap="tap"
                              >
                                Edit
                              </motion.button>
                              <motion.button
                                onClick={() =>
                                  setDeleteTarget({
                                    id: entry.id,
                                    name: entry.customers?.name || "Unknown",
                                  })
                                }
                                aria-label={`Remove seniority entry ${entry.id}`}
                                className="p-1 rounded-full hover:bg-red-500/10 transition-colors"
                                variants={deleteButtonVariants}
                                initial="idle"
                                whileHover="hover"
                                whileTap="tap"
                              >
                                <Trash2Icon className="w-4 h-4 text-red-500" />
                              </motion.button>
                            </div>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </motion.tbody>
              </table>
            </motion.div>

            {/* Mobile cards */}
            <motion.div
              className="md:hidden space-y-3"
              variants={listContainerVariants}
              initial="hidden"
              animate="visible"
              custom={listSectionDelay + 0.05}
            >
              <AnimatePresence mode="popLayout">
                {paginatedSeniorityList.map((entry: any, idx: number) => (
                  <motion.div
                    key={entry.id}
                    className="bg-white dark:bg-dark-bg border border-gray-100 dark:border-dark-border rounded p-3"
                    variants={listItemVariants}
                    layout
                    layoutId={`card-${entry.id}`}
                    whileHover={{
                      scale: 1.01,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      transition: { duration: 0.2 },
                    }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-400 dark:text-dark-muted">
                          Sr.No {(currentPage - 1) * itemsPerPage + idx + 1}
                        </div>
                        <div className="font-semibold text-indigo-700 dark:text-indigo-400 truncate">
                          {entry.customers?.name || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-dark-muted">
                          {entry.customers?.phone || ""}
                        </div>
                        <motion.div
                          className="mt-2 text-sm text-gray-600 dark:text-dark-muted space-y-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {entry.station_name && (
                            <div>
                              Station:{" "}
                              <span className="font-medium text-gray-800 dark:text-dark-text">
                                {entry.station_name}
                              </span>
                            </div>
                          )}
                          {entry.loan_type && (
                            <div>
                              Loan Type:{" "}
                              <span className="font-medium text-gray-800 dark:text-dark-text">
                                {entry.loan_type}
                              </span>
                            </div>
                          )}
                          {entry.loan_request_date && (
                            <div>
                              Requested:{" "}
                              <span className="font-medium text-gray-800 dark:text-dark-text">
                                {formatDate(entry.loan_request_date)}
                              </span>
                            </div>
                          )}
                        </motion.div>
                      </div>
                      {!isScopedCustomer && (
                        <div className="flex items-center gap-2 ml-3">
                          <motion.button
                            onClick={() => {
                              setModalCustomer({
                                id: entry.customer_id,
                                name: entry.customers?.name,
                              });
                              setStationName(entry.station_name || "");
                              setLoanType(entry.loan_type || "General");
                              setLoanRequestDate(entry.loan_request_date || "");
                              setModalEditingId(entry.id);
                            }}
                            className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                            aria-label="Edit"
                            variants={buttonVariants}
                            initial="idle"
                            whileHover="hover"
                            whileTap="tap"
                          >
                            Edit
                          </motion.button>
                          <motion.button
                            onClick={() =>
                              setDeleteTarget({
                                id: entry.id,
                                name: entry.customers?.name || "Unknown",
                              })
                            }
                            className="p-2 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                            aria-label="Remove"
                            variants={deleteButtonVariants}
                            initial="idle"
                            whileHover="hover"
                            whileTap="tap"
                          >
                            <Trash2Icon className="w-4 h-4" />
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
                <div className="text-sm text-gray-600 dark:text-dark-muted">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, seniorityList.length)}{" "}
                  of {seniorityList.length} entries
                </div>
                <motion.div className="flex gap-2 flex-wrap justify-center">
                  <motion.button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                    aria-label="Go to first page"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    First
                  </motion.button>
                  <motion.button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                    aria-label="Go to previous page"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Previous
                  </motion.button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1
                      ) {
                        return (
                          <motion.button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded border ${
                              currentPage === page
                                ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-600"
                                : "border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-slate-700"
                            }`}
                            aria-label={`Go to page ${page}`}
                            aria-current={
                              currentPage === page ? "page" : undefined
                            }
                            variants={buttonVariants}
                            initial="idle"
                            whileHover="hover"
                            whileTap="tap"
                          >
                            {page}
                          </motion.button>
                        );
                      }
                      if (page === 2 && currentPage > 3) {
                        return (
                          <span
                            key="start-ellipsis"
                            className="px-2 text-gray-500 dark:text-dark-muted"
                          >
                            ...
                          </span>
                        );
                      }
                      if (
                        page === totalPages - 1 &&
                        currentPage < totalPages - 2
                      ) {
                        return (
                          <span
                            key="end-ellipsis"
                            className="px-2 text-gray-500 dark:text-dark-muted"
                          >
                            ...
                          </span>
                        );
                      }
                      return null;
                    },
                  )}
                  <motion.button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                    aria-label="Go to next page"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Next
                  </motion.button>
                  <motion.button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                    aria-label="Go to last page"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Last
                  </motion.button>
                </motion.div>
              </div>
            )}
          </>
        )}
      </GlassCard>

      {/* Delete Confirmation Modal - WRAPPED IN PORTAL */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setDeleteTarget(null)}
            >
              <motion.div
                className="bg-white dark:bg-dark-card rounded-lg shadow-lg p-6 md:p-8 w-[90%] max-w-md"
                variants={modalContentVariants}
                onClick={(e) => e.stopPropagation()}
              >
                <motion.h3
                  className="text-lg font-bold mb-3 text-gray-800 dark:text-dark-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  Remove from Seniority List?
                </motion.h3>
                <motion.p
                  className="mb-4 text-sm text-gray-600 dark:text-dark-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  Are you sure you want to remove{" "}
                  <span className="font-semibold text-gray-800 dark:text-dark-text">
                    {deleteTarget.name}
                  </span>{" "}
                  from the seniority list? You can restore this entry later from
                  the Trash.
                </motion.p>
                <motion.div
                  className="flex justify-end gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <motion.button
                    onClick={() => setDeleteTarget(null)}
                    className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-dark-text"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={confirmDelete}
                    className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Remove
                  </motion.button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </PageWrapper>
  );
};

export default LoanSeniorityPage;
