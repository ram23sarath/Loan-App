import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useEscapeKey } from "../hooks/useEscapeKey";
import PageWrapper from "../ui/PageWrapper";
import GlassCard from "../ui/GlassCard";
import { Trash2Icon } from "../../constants";
import { useData } from "../../context/DataContext";
import { formatDate } from "../../utils/dateFormatter";

const TrashPage = () => {
    const {
        session,
        customers,
        seniorityList,
        deletedSeniorityList,
        fetchDeletedSeniorityList,
        fetchSeniorityList,
        restoreSeniorityEntry,
        permanentDeleteSeniority,
    } = useData();

    useEffect(() => {
        fetchDeletedSeniorityList().catch(console.error);
        fetchSeniorityList().catch(console.error);
    }, [fetchDeletedSeniorityList, fetchSeniorityList]);

    const [restoreTarget, setRestoreTarget] = useState<{ id: string; name: string } | null>(null);
    const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [restoreError, setRestoreError] = useState<string | null>(null);

    useEscapeKey(!!restoreError, () => setRestoreError(null));

    const confirmRestore = async () => {
        if (!restoreTarget) return;

        // Check if customer is already in active list
        const entryToRestore = deletedSeniorityList?.find((e: any) => e.id === restoreTarget.id);
        if (entryToRestore) {
            const isAlreadyActive = seniorityList?.some((e: any) => e.customer_id === entryToRestore.customer_id);
            if (isAlreadyActive) {
                setRestoreError("Cannot restore: This customer is already in the active seniority list.");
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
    };

    const confirmDelete = async () => {
        if (!permanentDeleteTarget) return;
        try {
            await permanentDeleteSeniority(permanentDeleteTarget.id);
            setPermanentDeleteTarget(null);
        } catch (err: any) {
            alert(err.message || "Failed to delete");
        }
    };

    const sections = [
        { title: "Loans", items: [] },
        { title: "Subscriptions", items: [] },
        { title: "Loan Seniority", items: deletedSeniorityList || [] },
        { title: "Expenditures", items: [] },
    ];

    const modalBackdropVariants: Variants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
    };

    const modalContentVariants: Variants = {
        hidden: { opacity: 0, scale: 0.9, y: 20 },
        visible: {
            opacity: 1, scale: 1, y: 0,
            transition: { type: "spring", stiffness: 350, damping: 25 }
        },
        exit: {
            opacity: 0, scale: 0.95, y: 10,
            transition: { duration: 0.15 }
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
                    <GlassCard key={section.title} className="flex flex-col h-full min-h-[250px]" hoverScale={false}>
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
                                                <div>
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
                                                            {item.deleted_at ? (() => {
                                                                const date = new Date(item.deleted_at);
                                                                let adminName = "Unknown";
                                                                if (item.deleted_by) {
                                                                    // Try to find by user_id in customers (if it was a customer action)
                                                                    const customer = customers.find((c: any) => c.user_id === item.deleted_by);
                                                                    if (customer) {
                                                                        adminName = customer.name;
                                                                    } else if (session?.user?.id === item.deleted_by && session?.user?.user_metadata?.name) {
                                                                        // If it was the current user, use their metadata name
                                                                        adminName = session.user.user_metadata.name;
                                                                    } else if (item.deleted_by.includes('@')) {
                                                                        // It's an email, try to remove domain. Though we prefer names.
                                                                        adminName = item.deleted_by;
                                                                    } else {
                                                                        // It's an ID but not found in customers. 
                                                                        // Ideally we would look up a separate "users" table or similar, but for now fallback to ID or 'Admin'
                                                                        adminName = "Admin";
                                                                    }
                                                                }
                                                                return `Deleted at - ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by ${adminName}`;
                                                            })() : "N/A"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 self-end sm:self-center">
                                                    <motion.button
                                                        onClick={() => setRestoreTarget({ id: item.id, name: item.customers?.name || 'Item' })}
                                                        className="px-3 py-1 text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 hover:border-green-200 transition-colors"
                                                        variants={buttonVariants}
                                                        initial="idle"
                                                        whileHover="hover"
                                                        whileTap="tap"
                                                    >
                                                        Restore
                                                    </motion.button>
                                                    <motion.button
                                                        onClick={() => setPermanentDeleteTarget({ id: item.id, name: item.customers?.name || 'Item' })}
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

            {/* Restore Modal */}
            {restoreTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setRestoreTarget(null)}>
                    <div className="bg-white dark:bg-dark-card rounded-lg shadow-lg p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-2 dark:text-dark-text">Restore Item?</h3>
                        <p className="text-sm text-gray-600 dark:text-dark-muted mb-4">
                            Are you sure you want to restore <span className="font-semibold text-gray-800 dark:text-dark-text">{restoreTarget.name}</span>?
                        </p>
                        <div className="flex justify-end gap-2">
                            <motion.button
                                onClick={() => setRestoreTarget(null)}
                                className="px-3 py-2 rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-dark-text text-sm"
                                variants={buttonVariants}
                                initial="idle"
                                whileHover="hover"
                                whileTap="tap"
                            >
                                Cancel
                            </motion.button>
                            <motion.button
                                onClick={confirmRestore}
                                className="px-3 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700"
                                variants={buttonVariants}
                                initial="idle"
                                whileHover="hover"
                                whileTap="tap"
                            >
                                Restore
                            </motion.button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {permanentDeleteTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setPermanentDeleteTarget(null)}>
                    <div className="bg-white dark:bg-dark-card rounded-lg shadow-lg p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-2 dark:text-dark-text">Permanently Delete?</h3>
                        <p className="text-sm text-gray-600 dark:text-dark-muted mb-4">
                            This action cannot be undone. Permanently delete <span className="font-semibold text-gray-800 dark:text-dark-text">{permanentDeleteTarget.name}</span>?
                        </p>
                        <div className="flex justify-end gap-2">
                            <motion.button
                                onClick={() => setPermanentDeleteTarget(null)}
                                className="px-3 py-2 rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-dark-text text-sm"
                                variants={buttonVariants}
                                initial="idle"
                                whileHover="hover"
                                whileTap="tap"
                            >
                                Cancel
                            </motion.button>
                            <motion.button
                                onClick={confirmDelete}
                                className="px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                                variants={buttonVariants}
                                initial="idle"
                                whileHover="hover"
                                whileTap="tap"
                            >
                                Delete Forever
                            </motion.button>
                        </div>
                    </div>
                </div>
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
                                    <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-dark-text">Cannot Restore</h3>
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
                document.body
            )}

        </PageWrapper>
    );
};

export default TrashPage;
