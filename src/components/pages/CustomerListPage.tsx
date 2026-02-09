import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useRouteReady } from "../RouteReadySignal";
import GlassCard from "../ui/GlassCard";
import PageWrapper from "../ui/PageWrapper";
import {
  UsersIcon,
  Trash2Icon,
  SpinnerIcon,
  WhatsAppIcon,
} from "../../constants";
import CustomerDetailModal from "../modals/CustomerDetailModal";
import EditModal from "../modals/EditModal";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import type { Customer } from "../../types";
import { useDeferredSearch } from "../../utils/useDebounce";
import { openWhatsApp } from "../../utils/whatsapp";

// --- Icon Component ---
const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth={0.5}
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

const CustomerListPage = () => {
  const signalRouteReady = useRouteReady();
  const {
    customers,
    loans,
    subscriptions,
    installments,
    installmentsByLoanId,
    dataEntries,
    deleteCustomer,
    deleteLoan,
    deleteSubscription,
    deleteInstallment,
    deleteDataEntry,
    isRefreshing,
    signOut,
    updateCustomer,
    updateLoan,
    updateSubscription,
    updateInstallment,
    isScopedCustomer,
  } = useData();
  const [deleteCustomerTarget, setDeleteCustomerTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteCounts, setDeleteCounts] = React.useState<{
    dataEntries: number;
    loans: number;
    installments: number;
    subscriptions: number;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // Use useDeferredSearch for better React 18 concurrent rendering
  const debouncedSearchTerm = useDeferredSearch(searchTerm);
  const [sortOption, setSortOption] = useState("name-asc");
  const FILTER_OPTIONS = ["DOP", "ADFO", "SFO", "Rtd", "FM"];
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editModal, setEditModal] = useState<{
    type:
      | "customer"
      | "loan"
      | "subscription"
      | "customer_loan"
      | "installment";
    data: any;
  } | null>(null);

  const [expandedSections, setExpandedSections] = useState({
    both: true,
    loans: false,
    subs: false,
    neither: false,
  });

  const [currentPages, setCurrentPages] = useState({
    both: 1,
    loans: 1,
    subs: 1,
    neither: 1,
  });

  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  const itemsPerPage = 25;

  // Page picker popup state
  const [pagePickerOpen, setPagePickerOpen] = React.useState<{
    section: "both" | "loans" | "subs" | "neither";
    position: "start" | "end";
  } | null>(null);
  const [pagePickerOffset, setPagePickerOffset] = React.useState(0);

  // Signal readiness on mount
  useEffect(() => {
    signalRouteReady();
  }, [signalRouteReady]);

  const toggleSection = (key: "both" | "loans" | "subs" | "neither") => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setCurrentPage = (
    section: "both" | "loans" | "subs" | "neither",
    page: number,
  ) => {
    setCurrentPages((prev) => ({ ...prev, [section]: page }));
  };

  React.useEffect(() => {
    if (debouncedSearchTerm) {
      setExpandedSections({
        both: true,
        loans: true,
        subs: true,
        neither: true,
      });
    }
  }, [debouncedSearchTerm]);

  const handleDeleteCustomer = (customer) => {
    const cid = customer.id;
    const dataEntriesCount = dataEntries.filter(
      (d) => d.customer_id === cid,
    ).length;
    const customerLoans = loans.filter((l) => l.customer_id === cid);
    const loansCount = customerLoans.length;
    const installmentsCount = customerLoans.reduce(
      (acc, loan) => acc + (installmentsByLoanId.get(loan.id)?.length || 0),
      0,
    );
    const subscriptionsCount = subscriptions.filter(
      (s) => s.customer_id === cid,
    ).length;
    setDeleteCounts({
      dataEntries: dataEntriesCount,
      loans: loansCount,
      installments: installmentsCount,
      subscriptions: subscriptionsCount,
    });
    setDeleteCustomerTarget({ id: customer.id, name: customer.name });
  };

  const confirmDeleteCustomer = async () => {
    if (deleteCustomerTarget) {
      try {
        await deleteCustomer(deleteCustomerTarget.id);
        setDeleteCustomerTarget(null);
        setDeleteCounts(null);
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const cancelDeleteCustomer = () => {
    setDeleteCustomerTarget(null);
    setDeleteCounts(null);
  };

  const categorizedCustomers = useMemo(() => {
    let processedCustomers = [...customers];
    // Apply name-based filters when selected
    if (selectedFilters.length > 0) {
      const lowered = selectedFilters.map((s) => s.toLowerCase());
      processedCustomers = processedCustomers.filter((c) => {
        const name = (c.name || "").toLowerCase();
        return lowered.some((f) => name.includes(f));
      });
      // When filters are active, always sort by name ascending
      processedCustomers.sort((a, b) => a.name.localeCompare(b.name));
    }

    processedCustomers.sort((a, b) => {
      switch (sortOption) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "date-asc":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "date-desc":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    if (debouncedSearchTerm) {
      processedCustomers = processedCustomers.filter(
        (customer) =>
          customer.name
            .toLowerCase()
            .includes(debouncedSearchTerm.toLowerCase()) ||
          customer.phone.includes(debouncedSearchTerm),
      );
    }

    const withOnlyLoans: Customer[] = [];
    const withOnlySubscriptions: Customer[] = [];
    const withBoth: Customer[] = [];
    const withNeither: Customer[] = [];

    processedCustomers.forEach((customer) => {
      const hasLoans = loans.some((l) => l.customer_id === customer.id);
      const hasSubscriptions = subscriptions.some(
        (s) => s.customer_id === customer.id,
      );

      if (hasLoans && hasSubscriptions) {
        withBoth.push(customer);
      } else if (hasLoans) {
        withOnlyLoans.push(customer);
      } else if (hasSubscriptions) {
        withOnlySubscriptions.push(customer);
      } else {
        withNeither.push(customer);
      }
    });

    return { withOnlyLoans, withOnlySubscriptions, withBoth, withNeither };
  }, [
    customers,
    loans,
    subscriptions,
    debouncedSearchTerm,
    sortOption,
    selectedFilters,
  ]);

  const totalDisplayed =
    categorizedCustomers.withBoth.length +
    categorizedCustomers.withOnlyLoans.length +
    categorizedCustomers.withOnlySubscriptions.length +
    categorizedCustomers.withNeither.length;

  // compute per-filter counts (from full customers list)
  const filterCounts = useMemo(() => {
    const map: Record<string, number> = {};
    FILTER_OPTIONS.forEach((opt) => {
      const lc = opt.toLowerCase();
      map[opt] = customers.filter((c) =>
        (c.name || "").toLowerCase().includes(lc),
      ).length;
    });
    return map;
  }, [customers]);

  // Auto-expand certain panels when a filter is applied and matches exist
  React.useEffect(() => {
    if (selectedFilters.length > 0) {
      setExpandedSections((prev) => ({
        ...prev,
        subs:
          categorizedCustomers.withOnlySubscriptions.length > 0
            ? true
            : prev.subs,
        neither:
          categorizedCustomers.withNeither.length > 0 ? true : prev.neither,
      }));
    }
  }, [
    selectedFilters.length,
    categorizedCustomers.withOnlySubscriptions.length,
    categorizedCustomers.withNeither.length,
  ]);
  const formatCurrency = (value: number) => {
    return value.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const collapseVariants = {
    open: { opacity: 1, height: "auto", overflow: "hidden" },
    collapsed: { opacity: 0, height: 0, overflow: "hidden" },
  };

  const PaginationControls = ({
    section,
    totalItems,
  }: {
    section: "both" | "loans" | "subs" | "neither";
    totalItems: number;
  }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const currentPage = currentPages[section];

    if (totalPages <= 1) return null;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
        <div className="text-sm text-gray-600 dark:text-dark-muted">
          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
          customers
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={() => setCurrentPage(section, 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            First
          </button>
          <button
            onClick={() =>
              setCurrentPage(section, Math.max(1, currentPage - 1))
            }
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
                    setCurrentPage(section, page);
                    setPagePickerOpen(null);
                  }}
                  className={`px-3 py-1 rounded border ${
                    currentPage === page
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
                (_, i) => i + 2,
              );
              const maxOffset = Math.max(
                0,
                Math.ceil(startPages.length / 9) - 1,
              );
              const isOpen =
                pagePickerOpen?.section === section &&
                pagePickerOpen?.position === "start";
              const visiblePages = startPages.slice(
                pagePickerOffset * 9,
                (pagePickerOffset + 1) * 9,
              );

              return (
                <div key="dots-start" className="relative">
                  <button
                    onClick={() => {
                      if (isOpen) {
                        setPagePickerOpen(null);
                      } else {
                        setPagePickerOpen({ section, position: "start" });
                        setPagePickerOffset(0);
                      }
                    }}
                    className="px-2 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                    title="Click to show more pages"
                  >
                    ...
                  </button>
                  {isOpen && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-2 z-50 min-w-[140px]">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <button
                          onClick={() =>
                            setPagePickerOffset(
                              Math.max(0, pagePickerOffset - 1),
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
                            startPages.length,
                          )}{" "}
                          of {startPages.length}
                        </span>
                        <button
                          onClick={() =>
                            setPagePickerOffset(
                              Math.min(maxOffset, pagePickerOffset + 1),
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
                              setCurrentPage(section, p);
                              setPagePickerOpen(null);
                            }}
                            className={`px-2 py-1 text-sm rounded ${
                              currentPage === p
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
                (_, i) => currentPage + 2 + i,
              );
              const maxOffset = Math.max(0, Math.ceil(endPages.length / 9) - 1);
              const isOpen =
                pagePickerOpen?.section === section &&
                pagePickerOpen?.position === "end";
              const visiblePages = endPages.slice(
                pagePickerOffset * 9,
                (pagePickerOffset + 1) * 9,
              );

              return (
                <div key="dots-end" className="relative">
                  <button
                    onClick={() => {
                      if (isOpen) {
                        setPagePickerOpen(null);
                      } else {
                        setPagePickerOpen({ section, position: "end" });
                        setPagePickerOffset(0);
                      }
                    }}
                    className="px-2 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                    title="Click to show more pages"
                  >
                    ...
                  </button>
                  {isOpen && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-2 z-50 min-w-[140px]">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <button
                          onClick={() =>
                            setPagePickerOffset(
                              Math.max(0, pagePickerOffset - 1),
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
                            endPages.length,
                          )}{" "}
                          of {endPages.length}
                        </span>
                        <button
                          onClick={() =>
                            setPagePickerOffset(
                              Math.min(maxOffset, pagePickerOffset + 1),
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
                              setCurrentPage(section, p);
                              setPagePickerOpen(null);
                            }}
                            className={`px-2 py-1 text-sm rounded ${
                              currentPage === p
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
              setCurrentPage(section, Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(section, totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Last
          </button>
        </div>
      </div>
    );
  };

  return (
    <PageWrapper>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4 sm:gap-0 px-2 sm:px-0">
        <h2 className="text-xl sm:text-4xl font-bold flex items-center gap-2 sm:gap-4 dark:text-dark-text">
          <UsersIcon className="w-7 h-7 sm:w-10 sm:h-10" />
          <span>All Customers</span>
          <span className="ml-2 text-xl sm:text-4xl font-bold text-gray-400 dark:text-dark-muted">
            ({totalDisplayed})
          </span>
          {isRefreshing && (
            <SpinnerIcon className="w-5 h-5 sm:w-8 sm:h-8 animate-spin text-indigo-500 dark:text-indigo-400" />
          )}
        </h2>
      </div>

      {customers.length > 0 && (
        <GlassCard className="mb-8 !p-4 dark:bg-dark-card">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative w-full md:w-1/2">
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg py-2 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-dark-muted dark:hover:text-dark-text p-1"
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
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="w-full md:w-1/2 bg-white border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
            >
              <option value="date-desc">Sort by Date (Newest First)</option>
              <option value="date-asc">Sort by Date (Oldest First)</option>
              <option value="name-asc">Sort by Name (A-Z)</option>
              <option value="name-desc">Sort by Name (Z-A)</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <div className="text-sm font-medium mr-2 text-gray-700 dark:text-dark-text">
              Filters:
            </div>
            {FILTER_OPTIONS.map((opt) => {
              const active = selectedFilters.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => {
                    setSelectedFilters((prev) =>
                      prev.includes(opt)
                        ? prev.filter((p) => p !== opt)
                        : [...prev, opt],
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors flex items-center gap-2 ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-300 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
                  }`}
                >
                  <span>{opt}</span>
                  <span className="text-xs opacity-80">
                    ({filterCounts[opt] || 0})
                  </span>
                </button>
              );
            })}
            {selectedFilters.length > 0 && (
              <button
                onClick={() => setSelectedFilters([])}
                className="ml-2 px-3 py-1 rounded-full text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
              >
                Clear
              </button>
            )}
          </div>
        </GlassCard>
      )}

      {categorizedCustomers.withBoth.length === 0 &&
      categorizedCustomers.withOnlyLoans.length === 0 &&
      categorizedCustomers.withOnlySubscriptions.length === 0 &&
      categorizedCustomers.withNeither.length === 0 &&
      !isRefreshing ? (
        <GlassCard>
          <p className="text-center text-gray-500 dark:text-dark-muted">
            {searchTerm
              ? "No customers match your search."
              : "No customers found. Add one to get started!"}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-8">
          {/* Section: Customers with Both */}
          {categorizedCustomers.withBoth.length > 0 && (
            <GlassCard className="!p-0 bg-indigo-50 border-indigo-200 dark:bg-dark-card dark:border-dark-border overflow-hidden">
              <button
                onClick={() => toggleSection("both")}
                className="w-full flex justify-between items-center p-2 sm:p-4"
              >
                <h3 className="text-xl font-bold text-indigo-800 dark:text-indigo-400 flex items-center gap-1">
                  <UsersIcon className="w-5 h-5 mr-1" />
                  Customers with Loans & Subscriptions
                </h3>
                <ChevronDownIcon
                  className={`w-6 h-6 text-indigo-800 dark:text-indigo-400 transition-transform ${
                    expandedSections.both ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={true}>
                {expandedSections.both && (
                  <motion.div
                    key="content"
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={collapseVariants}
                    transition={{
                      duration: 0.3,
                      ease: [0.04, 0.62, 0.23, 0.98],
                    }}
                  >
                    <div className="p-2 sm:p-4 pt-0">
                      {(() => {
                        const totalPages = Math.ceil(
                          categorizedCustomers.withBoth.length / itemsPerPage,
                        );
                        const start = (currentPages.both - 1) * itemsPerPage;
                        const end = start + itemsPerPage;
                        const paginatedCustomers =
                          categorizedCustomers.withBoth.slice(start, end);
                        return (
                          <>
                            {/* Desktop Table */}
                            <div className="hidden sm:block">
                              <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
                                <thead className="dark:bg-slate-700">
                                  <tr>
                                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border w-12">
                                      Sr.No
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Name
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Phone
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Loans
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Loan Value
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Subscriptions
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border whitespace-nowrap">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody
                                  key={`both-page-${currentPages.both}`}
                                  className="divide-y divide-gray-200 dark:divide-dark-border"
                                >
                                  {paginatedCustomers.map((customer, idx) => {
                                    const customerLoans = loans.filter(
                                      (loan) =>
                                        loan.customer_id === customer.id,
                                    );
                                    const customerSubscriptions =
                                      subscriptions.filter(
                                        (sub) =>
                                          sub.customer_id === customer.id,
                                      );
                                    const loanValue = customerLoans.reduce(
                                      (acc, loan) =>
                                        acc +
                                        loan.original_amount +
                                        loan.interest_amount,
                                      0,
                                    );
                                    const rowNumber =
                                      (currentPages.both - 1) * itemsPerPage +
                                      idx +
                                      1;
                                    return (
                                      <motion.tr
                                        key={customer.id}
                                        className="bg-white hover:bg-indigo-50/50 transition dark:bg-dark-card dark:even:bg-slate-700/50 dark:hover:bg-slate-600/50"
                                        onTap={() =>
                                          setSelectedCustomer(customer)
                                        }
                                        onClick={() =>
                                          setSelectedCustomer(customer)
                                        }
                                        initial={false}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.1 }}
                                      >
                                        <td className="px-2 py-2 text-gray-400 text-sm dark:text-dark-muted dark:border-dark-border">
                                          {rowNumber}
                                        </td>
                                        <td className="px-4 py-2 font-bold dark:border-dark-border">
                                          <Link
                                            to={`/customers/${customer.id}`}
                                            className="text-indigo-700 dark:text-indigo-400 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                            onTouchStart={(e) =>
                                              e.stopPropagation()
                                            }
                                          >
                                            {customer.name}
                                          </Link>
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 dark:text-dark-muted dark:border-dark-border">
                                          {customer.phone}
                                        </td>
                                        <td className="px-4 py-2 text-gray-700 dark:text-dark-text dark:border-dark-border">
                                          {customerLoans.length}
                                        </td>
                                        <td className="px-4 py-2 text-green-600 dark:text-green-400 dark:border-dark-border">
                                          {formatCurrency(loanValue)}
                                        </td>
                                        <td className="px-4 py-2 text-cyan-600 dark:text-cyan-400 dark:border-dark-border">
                                          {customerSubscriptions.length}
                                        </td>
                                        <td className="px-4 py-2 dark:border-dark-border">
                                          <div className="flex justify-center gap-2 items-center whitespace-nowrap">
                                            <motion.button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditModal({
                                                  type: "customer_loan",
                                                  data: {
                                                    customer,
                                                    loan:
                                                      customerLoans[0] || {},
                                                    subscription:
                                                      customerSubscriptions[0] ||
                                                      {},
                                                  },
                                                });
                                              }}
                                              onPointerDownCapture={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 dark:hover:bg-blue-500 whitespace-nowrap"
                                              whileHover={{ scale: 1.05 }}
                                              whileTap={{ scale: 0.95 }}
                                            >
                                              Edit
                                            </motion.button>
                                            <motion.button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteCustomer(customer);
                                              }}
                                              onPointerDownCapture={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="p-1 rounded-full hover:bg-red-500/10 dark:hover:bg-red-900/30 transition-colors"
                                              whileHover={{ scale: 1.2 }}
                                              whileTap={{ scale: 0.9 }}
                                            >
                                              <Trash2Icon className="w-5 h-5 text-red-500" />
                                            </motion.button>
                                          </div>
                                        </td>
                                      </motion.tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {/* Mobile Cards */}
                            <div className="sm:hidden space-y-3">
                              {paginatedCustomers.map((customer, idx) => {
                                const customerLoans = loans.filter(
                                  (loan) => loan.customer_id === customer.id,
                                );
                                const customerSubscriptions =
                                  subscriptions.filter(
                                    (sub) => sub.customer_id === customer.id,
                                  );
                                const loanValue = customerLoans.reduce(
                                  (acc, loan) =>
                                    acc +
                                    loan.original_amount +
                                    loan.interest_amount,
                                  0,
                                );
                                const rowNumber =
                                  (currentPages.both - 1) * itemsPerPage +
                                  idx +
                                  1;
                                const isValidPhone =
                                  customer.phone &&
                                  /^\d{10,15}$/.test(customer.phone);
                                const message = `Hi ${
                                  customer.name
                                },\n\nLoans: ${
                                  customerLoans.length
                                }\nLoan Value: ${formatCurrency(
                                  loanValue,
                                )}\nSubscriptions: ${
                                  customerSubscriptions.length
                                }\n\nThank You, I J Reddy.`;
                                return (
                                  <div
                                    key={customer.id}
                                    className="relative overflow-hidden rounded-lg"
                                  >
                                    {/* Swipe background indicators */}
                                    {draggingCardId === customer.id && (
                                      <div className="absolute inset-0 flex rounded-lg overflow-hidden z-0">
                                        <div
                                          className={`${
                                            isScopedCustomer
                                              ? "w-full"
                                              : "w-1/2"
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
                                      onClick={() =>
                                        setSelectedCustomer(customer)
                                      }
                                      initial={false}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.1 }}
                                      drag="x"
                                      dragConstraints={{ left: 0, right: 0 }}
                                      dragElastic={0}
                                      dragMomentum={false}
                                      dragDirectionLock={true}
                                      style={{ touchAction: "pan-y" }}
                                      onDragStart={() =>
                                        setDraggingCardId(customer.id)
                                      }
                                      onDragEnd={(_, info) => {
                                        setDraggingCardId(null);
                                        const threshold = 100;
                                        if (
                                          !isScopedCustomer &&
                                          info.offset.x < -threshold
                                        ) {
                                          handleDeleteCustomer(customer);
                                        } else if (
                                          info.offset.x > threshold &&
                                          isValidPhone
                                        ) {
                                          openWhatsApp(
                                            customer.phone,
                                            message,
                                            { cooldownMs: 1200 },
                                          );
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400 dark:text-dark-muted">
                                          Sr.No {rowNumber}
                                        </span>
                                        <Link
                                          to={`/customers/${customer.id}`}
                                          className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:underline truncate"
                                          onClick={(e) => e.stopPropagation()}
                                          onTouchStart={(e) =>
                                            e.stopPropagation()
                                          }
                                        >
                                          {customer.name}
                                        </Link>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Phone:{" "}
                                        <span className="font-semibold text-gray-700 dark:text-dark-text">
                                          {customer.phone}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Loans:{" "}
                                        <span className="font-semibold text-gray-700 dark:text-dark-text">
                                          {customerLoans.length}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Loan Value:{" "}
                                        <span className="font-semibold text-green-600 dark:text-green-400">
                                          {formatCurrency(loanValue)}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Subscriptions:{" "}
                                        <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                                          {customerSubscriptions.length}
                                        </span>
                                      </div>
                                      <div className="mt-3 flex items-center justify-evenly">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            isValidPhone &&
                                              openWhatsApp(
                                                customer.phone,
                                                message,
                                                { cooldownMs: 1200 },
                                              );
                                          }}
                                          className="p-2 rounded-md bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                          disabled={!isValidPhone}
                                        >
                                          <WhatsAppIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditModal({
                                              type: "customer_loan",
                                              data: {
                                                customer,
                                                loan: customerLoans[0] || {},
                                                subscription:
                                                  customerSubscriptions[0] ||
                                                  {},
                                              },
                                            });
                                          }}
                                          className="px-3 py-1 rounded bg-blue-600 text-white text-sm dark:hover:bg-blue-500"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCustomer(customer);
                                          }}
                                          className="p-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                        >
                                          <Trash2Icon className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </motion.div>
                                  </div>
                                );
                              })}
                            </div>
                            <PaginationControls
                              section="both"
                              totalItems={categorizedCustomers.withBoth.length}
                            />
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          )}

          {/* Section: Customers with Only Loans */}
          {categorizedCustomers.withOnlyLoans.length > 0 && (
            <GlassCard className="!p-0 bg-blue-50 border-blue-200 dark:bg-dark-card dark:border-dark-border overflow-hidden">
              <button
                onClick={() => toggleSection("loans")}
                className="w-full flex justify-between items-center p-2 sm:p-4"
              >
                <h3 className="text-xl font-bold text-blue-800 dark:text-indigo-400 flex items-center gap-1">
                  <UsersIcon className="w-5 h-5 mr-1" />
                  Customers with Only Loans
                </h3>
                <ChevronDownIcon
                  className={`w-6 h-6 text-blue-800 dark:text-indigo-400 transition-transform ${
                    expandedSections.loans ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={true}>
                {expandedSections.loans && (
                  <motion.div
                    key="content"
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={collapseVariants}
                    transition={{
                      duration: 0.3,
                      ease: [0.04, 0.62, 0.23, 0.98],
                    }}
                  >
                    <div className="p-2 sm:p-4 pt-0">
                      {(() => {
                        const totalPages = Math.ceil(
                          categorizedCustomers.withOnlyLoans.length /
                            itemsPerPage,
                        );
                        const start = (currentPages.loans - 1) * itemsPerPage;
                        const end = start + itemsPerPage;
                        const paginatedCustomers =
                          categorizedCustomers.withOnlyLoans.slice(start, end);
                        return (
                          <>
                            {/* Desktop Table */}
                            <div className="hidden sm:block">
                              <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
                                <thead className="dark:bg-slate-700">
                                  <tr>
                                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border w-12">
                                      Sr.No
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Name
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Phone
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Loans
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Loan Value
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border whitespace-nowrap">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody
                                  key={`loans-page-${currentPages.loans}`}
                                  className="divide-y divide-gray-200 dark:divide-dark-border"
                                >
                                  {paginatedCustomers.map((customer, idx) => {
                                    const customerLoans = loans.filter(
                                      (loan) =>
                                        loan.customer_id === customer.id,
                                    );
                                    const loanValue = customerLoans.reduce(
                                      (acc, loan) =>
                                        acc +
                                        loan.original_amount +
                                        loan.interest_amount,
                                      0,
                                    );
                                    const rowNumber =
                                      (currentPages.loans - 1) * itemsPerPage +
                                      idx +
                                      1;
                                    return (
                                      <motion.tr
                                        key={customer.id}
                                        className="bg-white hover:bg-blue-50/50 transition dark:bg-dark-card dark:even:bg-slate-700/50 dark:hover:bg-slate-600/50"
                                        onTap={() =>
                                          setSelectedCustomer(customer)
                                        }
                                        onClick={() =>
                                          setSelectedCustomer(customer)
                                        }
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{
                                          duration: 0.3,
                                          delay: idx * 0.05,
                                        }}
                                      >
                                        <td className="px-2 py-2 text-gray-400 text-sm dark:text-dark-muted dark:border-dark-border">
                                          {rowNumber}
                                        </td>
                                        <td className="px-4 py-2 font-bold dark:border-dark-border">
                                          <Link
                                            to={`/customers/${customer.id}`}
                                            className="text-indigo-700 dark:text-indigo-400 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                            onTouchStart={(e) =>
                                              e.stopPropagation()
                                            }
                                          >
                                            {customer.name}
                                          </Link>
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 dark:text-dark-muted dark:border-dark-border">
                                          {customer.phone}
                                        </td>
                                        <td className="px-4 py-2 text-gray-700 dark:text-dark-text dark:border-dark-border">
                                          {customerLoans.length}
                                        </td>
                                        <td className="px-4 py-2 text-green-600 dark:text-green-400 dark:border-dark-border">
                                          {formatCurrency(loanValue)}
                                        </td>
                                        <td className="px-4 py-2 dark:border-dark-border">
                                          <div className="flex justify-center gap-2 items-center whitespace-nowrap">
                                            <motion.button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditModal({
                                                  type: "customer_loan",
                                                  data: {
                                                    customer,
                                                    loan:
                                                      customerLoans[0] || {},
                                                  },
                                                });
                                              }}
                                              onPointerDownCapture={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 dark:hover:bg-blue-500 whitespace-nowrap"
                                              whileHover={{ scale: 1.05 }}
                                              whileTap={{ scale: 0.95 }}
                                            >
                                              Edit
                                            </motion.button>
                                            <motion.button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteCustomer(customer);
                                              }}
                                              onPointerDownCapture={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="p-1 rounded-full hover:bg-red-500/10 dark:hover:bg-red-900/30 transition-colors"
                                              whileHover={{ scale: 1.2 }}
                                              whileTap={{ scale: 0.9 }}
                                            >
                                              <Trash2Icon className="w-5 h-5 text-red-500" />
                                            </motion.button>
                                          </div>
                                        </td>
                                      </motion.tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {/* Mobile Cards */}
                            <div className="sm:hidden space-y-3">
                              {paginatedCustomers.map((customer, idx) => {
                                const customerLoans = loans.filter(
                                  (loan) => loan.customer_id === customer.id,
                                );
                                const loanValue = customerLoans.reduce(
                                  (acc, loan) =>
                                    acc +
                                    loan.original_amount +
                                    loan.interest_amount,
                                  0,
                                );
                                const rowNumber =
                                  (currentPages.loans - 1) * itemsPerPage +
                                  idx +
                                  1;
                                const isValidPhone =
                                  customer.phone &&
                                  /^\d{10,15}$/.test(customer.phone);
                                const message = `Hi ${
                                  customer.name
                                },\n\nLoans: ${
                                  customerLoans.length
                                }\nLoan Value: ${formatCurrency(
                                  loanValue,
                                )}\n\nThank You, I J Reddy.`;
                                return (
                                  <div
                                    key={customer.id}
                                    className="relative overflow-hidden rounded-lg"
                                  >
                                    {/* Swipe background indicators */}
                                    {draggingCardId === customer.id && (
                                      <div className="absolute inset-0 flex rounded-lg overflow-hidden z-0">
                                        <div
                                          className={`${
                                            isScopedCustomer
                                              ? "w-full"
                                              : "w-1/2"
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
                                      onClick={() =>
                                        setSelectedCustomer(customer)
                                      }
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{
                                        duration: 0.3,
                                        delay: idx * 0.03,
                                      }}
                                      drag="x"
                                      dragConstraints={{ left: 0, right: 0 }}
                                      dragElastic={0}
                                      dragMomentum={false}
                                      dragDirectionLock={true}
                                      style={{ touchAction: "pan-y" }}
                                      onDragStart={() =>
                                        setDraggingCardId(customer.id)
                                      }
                                      onDragEnd={(_, info) => {
                                        setDraggingCardId(null);
                                        const threshold = 100;
                                        if (
                                          !isScopedCustomer &&
                                          info.offset.x < -threshold
                                        ) {
                                          handleDeleteCustomer(customer);
                                        } else if (
                                          info.offset.x > threshold &&
                                          isValidPhone
                                        ) {
                                          openWhatsApp(
                                            customer.phone,
                                            message,
                                            { cooldownMs: 1200 },
                                          );
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400 dark:text-dark-muted">
                                          Sr.No {rowNumber}
                                        </span>
                                        <Link
                                          to={`/customers/${customer.id}`}
                                          className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:underline truncate"
                                          onClick={(e) => e.stopPropagation()}
                                          onTouchStart={(e) =>
                                            e.stopPropagation()
                                          }
                                        >
                                          {customer.name}
                                        </Link>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Phone:{" "}
                                        <span className="font-semibold text-gray-700 dark:text-dark-text">
                                          {customer.phone}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Loans:{" "}
                                        <span className="font-semibold text-gray-700 dark:text-dark-text">
                                          {customerLoans.length}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Loan Value:{" "}
                                        <span className="font-semibold text-green-600 dark:text-green-400">
                                          {formatCurrency(loanValue)}
                                        </span>
                                      </div>
                                      <div className="mt-3 flex items-center justify-evenly">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            isValidPhone &&
                                              openWhatsApp(
                                                customer.phone,
                                                message,
                                                { cooldownMs: 1200 },
                                              );
                                          }}
                                          className="p-2 rounded-md bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                          disabled={!isValidPhone}
                                        >
                                          <WhatsAppIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditModal({
                                              type: "customer_loan",
                                              data: {
                                                customer,
                                                loan: customerLoans[0] || {},
                                              },
                                            });
                                          }}
                                          className="px-3 py-1 rounded bg-blue-600 text-white text-sm dark:hover:bg-blue-500"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCustomer(customer);
                                          }}
                                          className="p-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                        >
                                          <Trash2Icon className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </motion.div>
                                  </div>
                                );
                              })}
                            </div>
                            <PaginationControls
                              section="loans"
                              totalItems={
                                categorizedCustomers.withOnlyLoans.length
                              }
                            />
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          )}

          {/* Section: Customers with Only Subscriptions */}
          {categorizedCustomers.withOnlySubscriptions.length > 0 && (
            <GlassCard className="!p-0 bg-cyan-50 border-cyan-200 dark:bg-dark-card dark:border-dark-border overflow-hidden">
              <button
                onClick={() => toggleSection("subs")}
                className="w-full flex justify-between items-center p-2 sm:p-4"
              >
                <h3 className="text-xl font-bold text-cyan-800 dark:text-cyan-400 flex items-center gap-1">
                  <UsersIcon className="w-5 h-5 mr-1" />
                  Customers with Only Subscriptions
                </h3>
                <ChevronDownIcon
                  className={`w-6 h-6 text-cyan-800 dark:text-cyan-400 transition-transform ${
                    expandedSections.subs ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={true}>
                {expandedSections.subs && (
                  <motion.div
                    key="content"
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={collapseVariants}
                    transition={{
                      duration: 0.3,
                      ease: [0.04, 0.62, 0.23, 0.98],
                    }}
                  >
                    <div className="p-2 sm:p-4 pt-0">
                      {(() => {
                        const totalPages = Math.ceil(
                          categorizedCustomers.withOnlySubscriptions.length /
                            itemsPerPage,
                        );
                        const start = (currentPages.subs - 1) * itemsPerPage;
                        const end = start + itemsPerPage;
                        const paginatedCustomers =
                          categorizedCustomers.withOnlySubscriptions.slice(
                            start,
                            end,
                          );
                        return (
                          <>
                            {/* Desktop Table */}
                            <div className="hidden sm:block">
                              <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
                                <thead className="dark:bg-slate-700">
                                  <tr>
                                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border w-12">
                                      Sr.No
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Name
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Phone
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Subscriptions
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                      Total Value
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border whitespace-nowrap">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody
                                  key={`subs-page-${currentPages.subs}`}
                                  className="divide-y divide-gray-200 dark:divide-dark-border"
                                >
                                  {paginatedCustomers.map((customer, idx) => {
                                    const customerSubscriptions =
                                      subscriptions.filter(
                                        (sub) =>
                                          sub.customer_id === customer.id,
                                      );
                                    const subValue =
                                      customerSubscriptions.reduce(
                                        (acc, sub) => acc + sub.amount,
                                        0,
                                      );
                                    const rowNumber =
                                      (currentPages.subs - 1) * itemsPerPage +
                                      idx +
                                      1;
                                    return (
                                      <motion.tr
                                        key={customer.id}
                                        className="bg-white hover:bg-cyan-50/50 transition dark:bg-dark-card dark:even:bg-slate-700/50 dark:hover:bg-slate-600/50"
                                        onTap={() =>
                                          setSelectedCustomer(customer)
                                        }
                                        onClick={() =>
                                          setSelectedCustomer(customer)
                                        }
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{
                                          duration: 0.3,
                                          delay: idx * 0.05,
                                        }}
                                      >
                                        <td className="px-2 py-2 text-gray-400 text-sm dark:text-dark-muted dark:border-dark-border">
                                          {rowNumber}
                                        </td>
                                        <td className="px-4 py-2 font-bold dark:border-dark-border">
                                          <Link
                                            to={`/customers/${customer.id}`}
                                            className="text-indigo-700 dark:text-indigo-400 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                            onTouchStart={(e) =>
                                              e.stopPropagation()
                                            }
                                          >
                                            {customer.name}
                                          </Link>
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 dark:text-dark-muted dark:border-dark-border">
                                          {customer.phone}
                                        </td>
                                        <td className="px-4 py-2 text-cyan-600 dark:text-cyan-400 dark:border-dark-border">
                                          {customerSubscriptions.length}
                                        </td>
                                        <td className="px-4 py-2 text-cyan-600 dark:text-cyan-400 dark:border-dark-border">
                                          {formatCurrency(subValue)}
                                        </td>
                                        <td className="px-4 py-2 dark:border-dark-border">
                                          <div className="flex justify-center gap-2 items-center whitespace-nowrap">
                                            <motion.button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditModal({
                                                  type: "customer_loan",
                                                  data: {
                                                    customer,
                                                    subscription:
                                                      customerSubscriptions[0] ||
                                                      {},
                                                  },
                                                });
                                              }}
                                              onPointerDownCapture={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 dark:hover:bg-blue-500 whitespace-nowrap"
                                              whileHover={{ scale: 1.05 }}
                                              whileTap={{ scale: 0.95 }}
                                            >
                                              Edit
                                            </motion.button>
                                            <motion.button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteCustomer(customer);
                                              }}
                                              onPointerDownCapture={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="p-1 rounded-full hover:bg-red-500/10 dark:hover:bg-red-900/30 transition-colors"
                                              whileHover={{ scale: 1.2 }}
                                              whileTap={{ scale: 0.9 }}
                                            >
                                              <Trash2Icon className="w-5 h-5 text-red-500" />
                                            </motion.button>
                                          </div>
                                        </td>
                                      </motion.tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {/* Mobile Cards */}
                            <div className="sm:hidden space-y-3">
                              {paginatedCustomers.map((customer, idx) => {
                                const customerSubscriptions =
                                  subscriptions.filter(
                                    (sub) => sub.customer_id === customer.id,
                                  );
                                const subValue = customerSubscriptions.reduce(
                                  (acc, sub) => acc + sub.amount,
                                  0,
                                );
                                const rowNumber =
                                  (currentPages.subs - 1) * itemsPerPage +
                                  idx +
                                  1;
                                const isValidPhone =
                                  customer.phone &&
                                  /^\d{10,15}$/.test(customer.phone);
                                const message = `Hi ${
                                  customer.name
                                },\n\nSubscriptions: ${
                                  customerSubscriptions.length
                                }\nTotal Value: ${formatCurrency(
                                  subValue,
                                )}\n\nThank You, I J Reddy.`;
                                return (
                                  <div
                                    key={customer.id}
                                    className="relative overflow-hidden rounded-lg"
                                  >
                                    {/* Swipe background indicators */}
                                    {draggingCardId === customer.id && (
                                      <div className="absolute inset-0 flex rounded-lg overflow-hidden z-0">
                                        <div
                                          className={`${
                                            isScopedCustomer
                                              ? "w-full"
                                              : "w-1/2"
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
                                      onClick={() =>
                                        setSelectedCustomer(customer)
                                      }
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{
                                        duration: 0.3,
                                        delay: idx * 0.03,
                                      }}
                                      drag="x"
                                      dragConstraints={{ left: 0, right: 0 }}
                                      dragElastic={0}
                                      dragMomentum={false}
                                      dragDirectionLock={true}
                                      style={{ touchAction: "pan-y" }}
                                      onDragStart={() =>
                                        setDraggingCardId(customer.id)
                                      }
                                      onDragEnd={(_, info) => {
                                        setDraggingCardId(null);
                                        const threshold = 100;
                                        if (
                                          !isScopedCustomer &&
                                          info.offset.x < -threshold
                                        ) {
                                          handleDeleteCustomer(customer);
                                        } else if (
                                          info.offset.x > threshold &&
                                          isValidPhone
                                        ) {
                                          openWhatsApp(
                                            customer.phone,
                                            message,
                                            { cooldownMs: 1200 },
                                          );
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400 dark:text-dark-muted">
                                          Sr.No {rowNumber}
                                        </span>
                                        <Link
                                          to={`/customers/${customer.id}`}
                                          className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:underline truncate"
                                          onClick={(e) => e.stopPropagation()}
                                          onTouchStart={(e) =>
                                            e.stopPropagation()
                                          }
                                        >
                                          {customer.name}
                                        </Link>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Phone:{" "}
                                        <span className="font-semibold text-gray-700 dark:text-dark-text">
                                          {customer.phone}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Subscriptions:{" "}
                                        <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                                          {customerSubscriptions.length}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                        Total Value:{" "}
                                        <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                                          {formatCurrency(subValue)}
                                        </span>
                                      </div>
                                      <div className="mt-3 flex items-center justify-evenly">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            isValidPhone &&
                                              openWhatsApp(
                                                customer.phone,
                                                message,
                                                { cooldownMs: 1200 },
                                              );
                                          }}
                                          className="p-2 rounded-md bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                          disabled={!isValidPhone}
                                        >
                                          <WhatsAppIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditModal({
                                              type: "customer_loan",
                                              data: {
                                                customer,
                                                subscription:
                                                  customerSubscriptions[0] ||
                                                  {},
                                              },
                                            });
                                          }}
                                          className="px-3 py-1 rounded bg-blue-600 text-white text-sm dark:hover:bg-blue-500"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCustomer(customer);
                                          }}
                                          className="p-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                        >
                                          <Trash2Icon className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </motion.div>
                                  </div>
                                );
                              })}
                            </div>
                            <PaginationControls
                              section="subs"
                              totalItems={
                                categorizedCustomers.withOnlySubscriptions
                                  .length
                              }
                            />
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          )}

          {/* Section: Customers with No Loans or Subscriptions */}
          {categorizedCustomers.withNeither &&
            categorizedCustomers.withNeither.length > 0 && (
              <GlassCard className="!p-0 bg-gray-50 border-gray-200 dark:bg-dark-card dark:border-dark-border overflow-hidden">
                <button
                  onClick={() => toggleSection("neither")}
                  className="w-full flex justify-between items-center p-2 sm:p-4"
                >
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-400 flex items-center gap-1">
                    <UsersIcon className="w-5 h-5 mr-1" />
                    Customers with No Records
                  </h3>
                  <ChevronDownIcon
                    className={`w-6 h-6 text-gray-800 dark:text-gray-400 transition-transform ${
                      expandedSections.neither ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={true}>
                  {expandedSections.neither && (
                    <motion.div
                      key="content"
                      initial="collapsed"
                      animate="open"
                      exit="collapsed"
                      variants={collapseVariants}
                      transition={{
                        duration: 0.3,
                        ease: [0.04, 0.62, 0.23, 0.98],
                      }}
                    >
                      <div className="p-2 sm:p-4 pt-0">
                        {(() => {
                          const totalPages = Math.ceil(
                            categorizedCustomers.withNeither.length /
                              itemsPerPage,
                          );
                          const start =
                            (currentPages.neither - 1) * itemsPerPage;
                          const end = start + itemsPerPage;
                          const paginatedCustomers =
                            categorizedCustomers.withNeither.slice(start, end);
                          return (
                            <>
                              {/* Desktop Table */}
                              <div className="hidden sm:block">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
                                  <thead className="dark:bg-slate-700">
                                    <tr>
                                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border w-12">
                                        Sr.No
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                        Name
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border">
                                        Phone
                                      </th>
                                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-dark-text dark:border-dark-border whitespace-nowrap">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody
                                    key={`neither-page-${currentPages.neither}`}
                                    className="divide-y divide-gray-200 dark:divide-dark-border"
                                  >
                                    {paginatedCustomers.map((customer, idx) => {
                                      const rowNumber =
                                        (currentPages.neither - 1) *
                                          itemsPerPage +
                                        idx +
                                        1;
                                      return (
                                        <motion.tr
                                          key={customer.id}
                                          className="bg-white hover:bg-gray-50/50 transition dark:bg-dark-card dark:even:bg-slate-700/50 dark:hover:bg-slate-600/50"
                                          onTap={() =>
                                            setSelectedCustomer(customer)
                                          }
                                          onClick={() =>
                                            setSelectedCustomer(customer)
                                          }
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, y: -10 }}
                                          transition={{
                                            duration: 0.3,
                                            delay: idx * 0.05,
                                          }}
                                        >
                                          <td className="px-2 py-2 text-gray-400 text-sm dark:text-dark-muted dark:border-dark-border">
                                            {rowNumber}
                                          </td>
                                          <td className="px-4 py-2 font-bold dark:border-dark-border">
                                            <Link
                                              to={`/customers/${customer.id}`}
                                              className="text-indigo-700 dark:text-indigo-400 hover:underline"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              onTouchStart={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              {customer.name}
                                            </Link>
                                          </td>
                                          <td className="px-4 py-2 text-gray-500 dark:text-dark-muted dark:border-dark-border">
                                            {customer.phone}
                                          </td>
                                          <td className="px-4 py-2 dark:border-dark-border">
                                            <div className="flex justify-center gap-2 items-center whitespace-nowrap">
                                              <motion.button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditModal({
                                                    type: "customer_loan",
                                                    data: { customer },
                                                  });
                                                }}
                                                onPointerDownCapture={(e) =>
                                                  e.stopPropagation()
                                                }
                                                className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 dark:hover:bg-blue-500 whitespace-nowrap"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                              >
                                                Edit
                                              </motion.button>
                                              <motion.button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteCustomer(
                                                    customer,
                                                  );
                                                }}
                                                onPointerDownCapture={(e) =>
                                                  e.stopPropagation()
                                                }
                                                className="p-1 rounded-full hover:bg-red-500/10 dark:hover:bg-red-900/30 transition-colors"
                                                whileHover={{ scale: 1.2 }}
                                                whileTap={{ scale: 0.9 }}
                                              >
                                                <Trash2Icon className="w-5 h-5 text-red-500" />
                                              </motion.button>
                                            </div>
                                          </td>
                                        </motion.tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              {/* Mobile Cards */}
                              <div className="sm:hidden space-y-3">
                                {paginatedCustomers.map((customer, idx) => {
                                  const rowNumber =
                                    (currentPages.neither - 1) * itemsPerPage +
                                    idx +
                                    1;
                                  const isValidPhone =
                                    customer.phone &&
                                    /^\d{10,15}$/.test(customer.phone);
                                  const message = `Hi ${customer.name},\n\nThank You, I J Reddy.`;
                                  return (
                                    <div
                                      key={customer.id}
                                      className="relative overflow-hidden rounded-lg"
                                    >
                                      {/* Swipe background indicators */}
                                      {draggingCardId === customer.id && (
                                        <div className="absolute inset-0 flex rounded-lg overflow-hidden z-0">
                                          <div
                                            className={`${
                                              isScopedCustomer
                                                ? "w-full"
                                                : "w-1/2"
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
                                        onClick={() =>
                                          setSelectedCustomer(customer)
                                        }
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{
                                          duration: 0.3,
                                          delay: idx * 0.03,
                                        }}
                                        drag="x"
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={0}
                                        dragMomentum={false}
                                        dragDirectionLock={true}
                                        style={{ touchAction: "pan-y" }}
                                        onDragStart={() =>
                                          setDraggingCardId(customer.id)
                                        }
                                        onDragEnd={(_, info) => {
                                          setDraggingCardId(null);
                                          const threshold = 100;
                                          if (
                                            !isScopedCustomer &&
                                            info.offset.x < -threshold
                                          ) {
                                            handleDeleteCustomer(customer);
                                          } else if (
                                            info.offset.x > threshold &&
                                            isValidPhone
                                          ) {
                                            openWhatsApp(
                                              customer.phone,
                                              message,
                                              { cooldownMs: 1200 },
                                            );
                                          }
                                        }}
                                      >
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-gray-400 dark:text-dark-muted">
                                            Sr.No {rowNumber}
                                          </span>
                                          <Link
                                            to={`/customers/${customer.id}`}
                                            className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:underline truncate"
                                            onClick={(e) => e.stopPropagation()}
                                            onTouchStart={(e) =>
                                              e.stopPropagation()
                                            }
                                          >
                                            {customer.name}
                                          </Link>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 dark:text-dark-muted">
                                          Phone:{" "}
                                          <span className="font-semibold text-gray-700 dark:text-dark-text">
                                            {customer.phone}
                                          </span>
                                        </div>
                                        <div className="mt-3 flex items-center justify-evenly">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              isValidPhone &&
                                                openWhatsApp(
                                                  customer.phone,
                                                  message,
                                                  { cooldownMs: 1200 },
                                                );
                                            }}
                                            className="p-2 rounded-md bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                            disabled={!isValidPhone}
                                          >
                                            <WhatsAppIcon className="w-5 h-5" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditModal({
                                                type: "customer_loan",
                                                data: { customer },
                                              });
                                            }}
                                            className="px-3 py-1 rounded bg-blue-600 text-white text-sm dark:hover:bg-blue-500"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteCustomer(customer);
                                            }}
                                            className="p-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                          >
                                            <Trash2Icon className="w-5 h-5" />
                                          </button>
                                        </div>
                                      </motion.div>
                                    </div>
                                  );
                                })}
                              </div>
                              <PaginationControls
                                section="neither"
                                totalItems={
                                  categorizedCustomers.withNeither.length
                                }
                              />
                            </>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            )}
        </div>
      )}

      <AnimatePresence>
        {selectedCustomer && (
          <CustomerDetailModal
            customer={selectedCustomer}
            loans={loans.filter((l) => l.customer_id === selectedCustomer.id)}
            subscriptions={subscriptions.filter(
              (s) => s.customer_id === selectedCustomer.id,
            )}
            installments={installments}
            dataEntries={dataEntries.filter(
              (d) => d.customer_id === selectedCustomer.id,
            )}
            onClose={() => setSelectedCustomer(null)}
            deleteLoan={deleteLoan}
            deleteDataEntry={deleteDataEntry}
            deleteSubscription={deleteSubscription}
            deleteInstallment={deleteInstallment}
            onEditLoan={(loan) => setEditModal({ type: "loan", data: loan })}
            onEditSubscription={(sub) =>
              setEditModal({ type: "subscription", data: sub })
            }
            onEditInstallment={(installment) =>
              setEditModal({ type: "installment", data: installment })
            }
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editModal && (
          <EditModal
            type={editModal.type}
            data={editModal.data}
            onSave={async (updated) => {
              try {
                if (editModal.type === "customer") {
                  await updateCustomer(updated.id, {
                    name: updated.name,
                    phone: updated.phone,
                  });
                } else if (editModal.type === "loan") {
                  await updateLoan(updated.id, {
                    original_amount: updated.original_amount,
                    interest_amount: updated.interest_amount,
                    payment_date: updated.payment_date,
                    total_instalments: updated.total_instalments,
                  });
                } else if (editModal.type === "subscription") {
                  await updateSubscription(updated.id, {
                    amount: updated.amount,
                    year: updated.year,
                    date: updated.date,
                    receipt: updated.receipt,
                  });
                } else if (editModal.type === "customer_loan") {
                  await updateCustomer(updated.customer.id, {
                    name: updated.customer.name,
                    phone: updated.customer.phone,
                  });
                  if (updated.loan && updated.loan.id) {
                    await updateLoan(updated.loan.id, {
                      original_amount: updated.loan.original_amount,
                      interest_amount: updated.loan.interest_amount,
                      payment_date: updated.loan.payment_date,
                      total_instalments: updated.loan.total_instalments,
                    });
                  }
                  if (updated.subscription && updated.subscription.id) {
                    await updateSubscription(updated.subscription.id, {
                      amount: updated.subscription.amount,
                      year: updated.subscription.year,
                      date: updated.subscription.date,
                      receipt: updated.subscription.receipt,
                    });
                  }
                } else if (editModal.type === "installment") {
                  await updateInstallment(updated.id, {
                    amount: updated.amount,
                    late_fee: updated.late_fee ?? 0,
                    date: updated.date,
                    receipt_number: updated.receipt_number,
                  });
                }
                setEditModal(null);
              } catch (err: any) {
                alert(err.message || "Failed to update record");
              }
            }}
            onClose={() => setEditModal(null)}
          />
        )}
      </AnimatePresence>
      <DeleteConfirmationModal
        isOpen={!!deleteCustomerTarget}
        onClose={cancelDeleteCustomer}
        onConfirm={confirmDeleteCustomer}
        title={`Move ${deleteCustomerTarget?.name ?? "Customer"} to trash?`}
        message={
          <>
            <div className="text-sm text-gray-600 mb-3 space-y-1 dark:text-dark-muted">
              <p>
                <span className="font-medium">
                  Loans: {deleteCounts?.loans ?? 0}
                </span>
              </p>
              <p>
                <span className="font-medium">
                  Installments: {deleteCounts?.installments ?? 0}
                </span>
              </p>
              <p>
                <span className="font-medium">
                  Subscriptions: {deleteCounts?.subscriptions ?? 0}
                </span>
              </p>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Customer and all related records will be moved to trash. You can
              restore them later.
            </p>
          </>
        }
        isDeleting={false}
        confirmText="Move to Trash"
        variant="warning"
      />
    </PageWrapper>
  );
};

export default CustomerListPage;
