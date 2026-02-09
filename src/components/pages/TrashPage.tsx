import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useEscapeKey } from "../hooks/useEscapeKey";
import PageWrapper from "../ui/PageWrapper";
import GlassCard from "../ui/GlassCard";
import { useRouteReady } from "../RouteReadySignal";
import { Trash2Icon } from "../../constants";
import { useData } from "../../context/DataContext";
import { formatDate } from "../../utils/dateFormatter";
import { formatNumberIndian } from "../../utils/numberFormatter";

const TrashPage = () => {
  const signalRouteReady = useRouteReady();
  const {
    session,
    customers,
    loans,
    seniorityList,
    deletedSeniorityList,
    fetchDeletedSeniorityList,
    fetchSeniorityList,
    restoreSeniorityEntry,
    permanentDeleteSeniority,
    // Data entries
    deletedDataEntries,
    fetchDeletedDataEntries,
    restoreDataEntry,
    permanentDeleteDataEntry,
    // Subscriptions
    deletedSubscriptions,
    fetchDeletedSubscriptions,
    restoreSubscription,
    permanentDeleteSubscription,
    // Loans
    deletedLoans,
    fetchDeletedLoans,
    restoreLoan,
    permanentDeleteLoan,
    // Installments
    deletedInstallments,
    fetchDeletedInstallments,
    restoreInstallment,
    permanentDeleteInstallment,
    // Customers
    deletedCustomers,
    fetchDeletedCustomers,
    restoreCustomer,
    permanentDeleteCustomer,
  } = useData();

  // Signal readiness on mount
  useEffect(() => {
    signalRouteReady();
  }, [signalRouteReady]);

  useEffect(() => {
    fetchDeletedSeniorityList().catch(console.error);
    fetchSeniorityList().catch(console.error);
    fetchDeletedDataEntries().catch(console.error);
    fetchDeletedSubscriptions().catch(console.error);
    fetchDeletedLoans().catch(console.error);
    fetchDeletedInstallments().catch(console.error);
    fetchDeletedCustomers().catch(console.error);
  }, [
    fetchDeletedSeniorityList,
    fetchSeniorityList,
    fetchDeletedDataEntries,
    fetchDeletedSubscriptions,
    fetchDeletedLoans,
    fetchDeletedInstallments,
    fetchDeletedCustomers,
  ]);

  // Seniority state
  const [restoreTarget, setRestoreTarget] = useState<{
    id: string;
    name: string;
    type:
      | "seniority"
      | "expenditure"
      | "subscription"
      | "loan"
      | "installment"
      | "customer";
    loanId?: string;
  } | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{
    id: string;
    name: string;
    type:
      | "seniority"
      | "expenditure"
      | "subscription"
      | "loan"
      | "installment"
      | "customer";
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEscapeKey(!!restoreError, () => setRestoreError(null));
  useEscapeKey(!!restoreTarget, () => setRestoreTarget(null));
  useEscapeKey(!!permanentDeleteTarget, () => setPermanentDeleteTarget(null));

  const confirmRestore = async () => {
    if (!restoreTarget) return;

    if (restoreTarget.type === "seniority") {
      // Check if customer is already in active list
      const entryToRestore = deletedSeniorityList?.find(
        (e: any) => e.id === restoreTarget.id,
      );
      if (entryToRestore) {
        const isAlreadyActive = seniorityList?.some(
          (e: any) => e.customer_id === entryToRestore.customer_id,
        );
        if (isAlreadyActive) {
          setRestoreError(
            "Cannot restore: This customer is already in the active seniority list.",
          );
          setRestoreTarget(null);
          return;
        }
      }

      try {
        await restoreSeniorityEntry(restoreTarget.id);
        setRestoreTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to restore");
      }
    } else if (restoreTarget.type === "expenditure") {
      try {
        await restoreDataEntry(restoreTarget.id);
        setRestoreTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to restore data entry");
      }
    } else if (restoreTarget.type === "subscription") {
      try {
        await restoreSubscription(restoreTarget.id);
        setRestoreTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to restore subscription");
      }
    } else if (restoreTarget.type === "loan") {
      try {
        await restoreLoan(restoreTarget.id);
        setRestoreTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to restore loan");
      }
    } else if (restoreTarget.type === "customer") {
      try {
        await restoreCustomer(restoreTarget.id);
        setRestoreTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to restore customer");
      }
    } else if (restoreTarget.type === "installment") {
      try {
        await restoreInstallment(restoreTarget.id);
        setRestoreTarget(null);
      } catch (err: any) {
        // Show error in modal instead of alert for better UX
        setRestoreError(err.message || "Failed to restore installment");
        setRestoreTarget(null);
      }
    }
  };

  const confirmDelete = async () => {
    if (!permanentDeleteTarget) return;

    if (permanentDeleteTarget.type === "seniority") {
      try {
        await permanentDeleteSeniority(permanentDeleteTarget.id);
        setPermanentDeleteTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to delete");
      }
    } else if (permanentDeleteTarget.type === "expenditure") {
      try {
        await permanentDeleteDataEntry(permanentDeleteTarget.id);
        setPermanentDeleteTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to delete data entry");
      }
    } else if (permanentDeleteTarget.type === "subscription") {
      try {
        await permanentDeleteSubscription(permanentDeleteTarget.id);
        setPermanentDeleteTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to delete subscription");
      }
    } else if (permanentDeleteTarget.type === "loan") {
      try {
        await permanentDeleteLoan(permanentDeleteTarget.id);
        setPermanentDeleteTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to delete loan");
      }
    } else if (permanentDeleteTarget.type === "customer") {
      try {
        await permanentDeleteCustomer(permanentDeleteTarget.id);
        setPermanentDeleteTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to delete customer");
      }
    } else if (permanentDeleteTarget.type === "installment") {
      try {
        await permanentDeleteInstallment(permanentDeleteTarget.id);
        setPermanentDeleteTarget(null);
      } catch (err: any) {
        alert(err.message || "Failed to delete installment");
      }
    }
  };

  // Helper function to format deleted info
  const formatDeletedInfo = (item: any) => {
    if (!item.deleted_at) return "N/A";
    const date = new Date(item.deleted_at);
    let adminName = "Unknown";
    if (item.deleted_by) {
      // Try to find by user_id in customers (if it was a customer action)
      const customer = customers.find(
        (c: any) => c.user_id === item.deleted_by,
      );
      if (customer) {
        adminName = customer.name;
      } else if (
        session?.user?.id === item.deleted_by &&
        session?.user?.user_metadata?.name
      ) {
        // If it was the current user, use their metadata name
        adminName = session.user.user_metadata.name;
      } else if (item.deleted_by.includes("@")) {
        // It's an email
        adminName = item.deleted_by;
      } else {
        // It's an ID but not found in customers
        adminName = "Admin";
      }
    }
    return `Deleted at - ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} by ${adminName}`;
  };

  const sections = [
    {
      title: "Customers",
      items: deletedCustomers || [],
      type: "customer" as const,
    },
    { title: "Loans", items: deletedLoans || [], type: "loan" as const },
    {
      title: "Installments",
      items: deletedInstallments || [],
      type: "installment" as const,
    },
    {
      title: "Subscriptions",
      items: deletedSubscriptions || [],
      type: "subscription" as const,
    },
    {
      title: "Loan Seniority",
      items: deletedSeniorityList || [],
      type: "seniority" as const,
    },
    {
      title: "Expenditures",
      items: deletedDataEntries || [],
      type: "expenditure" as const,
    },
  ];

  const modalBackdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const modalContentVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: "spring", stiffness: 350, damping: 25 },
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
      transition: { type: "spring", stiffness: 400, damping: 20 },
    },
    tap: { scale: 0.95 },
  };

  // Render item content based on type
  const renderItemContent = (item: any, type: string) => {
    if (type === "seniority") {
      return (
        <>
          <div className="font-medium text-gray-800 dark:text-dark-text flex items-center gap-2">
            {item.customers?.name || "Unknown"}
            {item.customers?.phone && (
              <span className="text-xs font-normal text-gray-500 dark:text-dark-muted">
                ({item.customers.phone})
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-dark-muted flex flex-wrap gap-x-2 mt-0.5">
            <span>{item.station_name || "No station"}</span>
            {item.loan_type && (
              <>
                <span>•</span>
                <span>{item.loan_type}</span>
              </>
            )}
            <span>•</span>
            <span className="text-red-500/80 dark:text-red-400/80">
              {formatDeletedInfo(item)}
            </span>
          </div>
        </>
      );
    } else if (type === "expenditure") {
      // Get customer name from the joined data or lookup
      const customerName =
        item.customers?.name ||
        customers.find((c: any) => c.id === item.customer_id)?.name ||
        "Unknown";
      const customerPhone =
        item.customers?.phone ||
        customers.find((c: any) => c.id === item.customer_id)?.phone;

      return (
        <>
          <div className="font-medium text-gray-800 dark:text-dark-text flex items-center gap-2">
            {customerName}
            {customerPhone && (
              <span className="text-xs font-normal text-gray-500 dark:text-dark-muted">
                ({customerPhone})
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-dark-muted flex flex-wrap gap-x-2 mt-0.5">
            <span
              className={`font-medium ${item.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {item.type === "credit" ? "+" : "-"}₹
              {formatNumberIndian(item.amount)}
            </span>
            <span>•</span>
            <span className="capitalize">{item.type}</span>
            {item.subtype && (
              <>
                <span>•</span>
                <span>{item.subtype}</span>
              </>
            )}
            {item.date && (
              <>
                <span>•</span>
                <span>{formatDate(item.date)}</span>
              </>
            )}
            <span>•</span>
            <span className="text-red-500/80 dark:text-red-400/80">
              {formatDeletedInfo(item)}
            </span>
          </div>
        </>
      );
    } else if (type === "subscription") {
      const customerName =
        item.customers?.name ||
        customers.find((c: any) => c.id === item.customer_id)?.name ||
        "Unknown";
      const customerPhone =
        item.customers?.phone ||
        customers.find((c: any) => c.id === item.customer_id)?.phone;

      return (
        <>
          <div className="font-medium text-gray-800 dark:text-dark-text flex items-center gap-2">
            {customerName}
            {customerPhone && (
              <span className="text-xs font-normal text-gray-500 dark:text-dark-muted">
                ({customerPhone})
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-dark-muted flex flex-wrap gap-x-2 mt-0.5">
            <span className="font-medium text-indigo-600 dark:text-indigo-400">
              ₹{formatNumberIndian(item.amount)}
            </span>
            <span>•</span>
            <span>Receipt: {item.receipt}</span>
            {item.date && (
              <>
                <span>•</span>
                <span>{formatDate(item.date)}</span>
              </>
            )}
            <span>•</span>
            <span className="text-red-500/80 dark:text-red-400/80">
              {formatDeletedInfo(item)}
            </span>
          </div>
        </>
      );
    } else if (type === "loan") {
      const customerName =
        item.customers?.name ||
        customers.find((c: any) => c.id === item.customer_id)?.name ||
        "Unknown";
      const customerPhone =
        item.customers?.phone ||
        customers.find((c: any) => c.id === item.customer_id)?.phone;

      return (
        <>
          <div className="font-medium text-gray-800 dark:text-dark-text flex items-center gap-2">
            {customerName}
            {customerPhone && (
              <span className="text-xs font-normal text-gray-500 dark:text-dark-muted">
                ({customerPhone})
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-dark-muted flex flex-wrap gap-x-2 mt-0.5">
            <span className="font-medium text-indigo-600 dark:text-indigo-400">
              ₹{formatNumberIndian(item.original_amount)}
            </span>
            <span>•</span>
            <span>Interest: ₹{formatNumberIndian(item.interest_amount)}</span>
            {item.payment_date && (
              <>
                <span>•</span>
                <span>{formatDate(item.payment_date)}</span>
              </>
            )}
            <span>•</span>
            <span className="text-red-500/80 dark:text-red-400/80">
              {formatDeletedInfo(item)}
            </span>
          </div>
        </>
      );
    } else if (type === "customer") {
      return (
        <>
          <div className="font-medium text-gray-800 dark:text-dark-text flex items-center gap-2">
            {item.name || "Unknown"}
            {item.phone && (
              <span className="text-xs font-normal text-gray-500 dark:text-dark-muted">
                ({item.phone})
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-dark-muted flex flex-wrap gap-x-2 mt-0.5">
            <span className="text-amber-600 dark:text-amber-400">
              ⚠ All related records will be restored/deleted
            </span>
            <span>•</span>
            <span className="text-red-500/80 dark:text-red-400/80">
              {formatDeletedInfo(item)}
            </span>
          </div>
        </>
      );
    } else if (type === "installment") {
      // Find parent loan to get customer info
      const parentLoan =
        deletedLoans?.find((l: any) => l.id === item.loan_id) ||
        loans?.find((l: any) => l.id === item.loan_id);
      const customerName = parentLoan?.customers?.name || "Unknown";
      const loanExists = loans?.some((l: any) => l.id === item.loan_id);

      return (
        <>
          <div className="font-medium text-gray-800 dark:text-dark-text flex items-center gap-2">
            Installment #{item.installment_number}
            <span className="text-xs font-normal text-gray-500 dark:text-dark-muted">
              ({customerName})
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-dark-muted flex flex-wrap gap-x-2 mt-0.5">
            <span className="font-medium text-green-600 dark:text-green-400">
              ₹{formatNumberIndian(item.amount)}
            </span>
            {item.date && (
              <>
                <span>•</span>
                <span>{formatDate(item.date)}</span>
              </>
            )}
            {item.receipt_number && (
              <>
                <span>•</span>
                <span>Receipt: {item.receipt_number}</span>
              </>
            )}
            {!loanExists && (
              <>
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400">
                  ⚠ Parent loan deleted
                </span>
              </>
            )}
            <span>•</span>
            <span className="text-red-500/80 dark:text-red-400/80">
              {formatDeletedInfo(item)}
            </span>
          </div>
        </>
      );
    }
    return null;
  };

  // Get item name for modal display
  const getItemName = (item: any, type: string) => {
    if (type === "seniority") {
      return item.customers?.name || "Item";
    } else if (type === "expenditure") {
      const customerName =
        item.customers?.name ||
        customers.find((c: any) => c.id === item.customer_id)?.name ||
        "Entry";
      return `${customerName}'s ${item.type} entry`;
    } else if (type === "subscription") {
      const customerName =
        item.customers?.name ||
        customers.find((c: any) => c.id === item.customer_id)?.name ||
        "Subscription";
      return `${customerName}'s subscription`;
    } else if (type === "loan") {
      const customerName =
        item.customers?.name ||
        customers.find((c: any) => c.id === item.customer_id)?.name ||
        "Loan";
      return `${customerName}'s loan`;
    } else if (type === "customer") {
      return `${item.name || "Customer"} and all related records`;
    } else if (type === "installment") {
      const parentLoan =
        deletedLoans?.find((l: any) => l.id === item.loan_id) ||
        loans?.find((l: any) => l.id === item.loan_id);
      const customerName = parentLoan?.customers?.name || "Unknown";
      return `Installment #${item.installment_number} (${customerName})`;
    }
    return "Item";
  };

  return (
    <PageWrapper>
      <motion.div
        className="flex items-center justify-between mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400">
            <Trash2Icon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
              Trash
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-muted">
              Manage deleted items and records
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        {sections.map((section, idx) => (
          <GlassCard
            key={section.title}
            className="flex flex-col h-full min-h-[250px]"
            hoverScale={false}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, type: "spring" }}
              className="flex flex-col h-full"
            >
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700/50 pb-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-text">
                  {section.title}
                </h3>
                <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-lg text-gray-500 dark:text-dark-muted">
                  {section.items.length} items
                </span>
              </div>

              {section.items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700/50 group hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <Trash2Icon className="w-8 h-8 text-gray-300 dark:text-slate-600 mb-2 group-hover:text-gray-400 dark:group-hover:text-slate-500 transition-colors" />
                  <p className="text-gray-400 dark:text-dark-muted text-sm font-medium">
                    No deleted items in {section.title}
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2 pr-1">
                  <AnimatePresence>
                    {section.items.map((item: any) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>{renderItemContent(item, section.type)}</div>
                        <div className="flex gap-2 self-end sm:self-center">
                          <motion.button
                            onClick={() =>
                              setRestoreTarget({
                                id: item.id,
                                name: getItemName(item, section.type),
                                type: section.type as
                                  | "seniority"
                                  | "expenditure"
                                  | "subscription"
                                  | "loan",
                              })
                            }
                            className="px-3 py-1 text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 hover:border-green-200 transition-colors"
                            variants={buttonVariants}
                            initial="idle"
                            whileHover="hover"
                            whileTap="tap"
                          >
                            Restore
                          </motion.button>
                          <motion.button
                            onClick={() =>
                              setPermanentDeleteTarget({
                                id: item.id,
                                name: getItemName(item, section.type),
                                type: section.type as
                                  | "seniority"
                                  | "expenditure"
                                  | "subscription"
                                  | "loan",
                              })
                            }
                            className="px-3 py-1 text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 transition-colors"
                            variants={buttonVariants}
                            initial="idle"
                            whileHover="hover"
                            whileTap="tap"
                          >
                            Delete
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </GlassCard>
        ))}
      </div>

      {/* Restore Modal - WRAPPED IN PORTAL */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {restoreTarget && (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setRestoreTarget(null)}
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
                  Restore Item?
                </motion.h3>
                <motion.p
                  className="mb-4 text-sm text-gray-600 dark:text-dark-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  Are you sure you want to restore{" "}
                  <span className="font-semibold text-gray-800 dark:text-dark-text">
                    {restoreTarget.name}
                  </span>
                  ?
                </motion.p>
                <motion.div
                  className="flex justify-end gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <motion.button
                    onClick={() => setRestoreTarget(null)}
                    className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-dark-text"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={confirmRestore}
                    className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                    variants={buttonVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Restore
                  </motion.button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Delete Modal - WRAPPED IN PORTAL */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {permanentDeleteTarget && (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setPermanentDeleteTarget(null)}
            >
              <motion.div
                className="bg-white dark:bg-dark-card rounded-lg shadow-lg p-6 md:p-8 w-[90%] max-w-md"
                variants={modalContentVariants}
                onClick={(e) => e.stopPropagation()}
              >
                <motion.h3
                  className="text-lg font-bold mb-3 text-red-700 dark:text-red-400"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  ⚠️ Permanently Delete?
                </motion.h3>
                <motion.p
                  className="mb-4 text-sm text-gray-600 dark:text-dark-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  Are you sure you want to{" "}
                  <strong className="text-red-600 dark:text-red-400">
                    permanently delete
                  </strong>{" "}
                  <span className="font-semibold text-gray-800 dark:text-dark-text">
                    {permanentDeleteTarget.name}
                  </span>
                  ?
                </motion.p>
                <motion.p
                  className="mb-4 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  This action cannot be undone. The entry will be permanently
                  removed from the database.
                </motion.p>
                <motion.div
                  className="flex justify-end gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <motion.button
                    onClick={() => setPermanentDeleteTarget(null)}
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
                    Delete Forever
                  </motion.button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Error Modal */}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {restoreError && (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setRestoreError(null)}
            >
              <motion.div
                className="bg-white dark:bg-dark-card rounded-lg shadow-lg p-6 w-full max-w-sm relative"
                variants={modalContentVariants}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setRestoreError(null)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                    <Trash2Icon className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-dark-text">
                    Cannot Restore
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-dark-muted mb-6">
                    {restoreError}
                  </p>
                  <button
                    onClick={() => setRestoreError(null)}
                    className="w-full px-4 py-2 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                  >
                    Okay, got it
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </PageWrapper>
  );
};

export default TrashPage;
