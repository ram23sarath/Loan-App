import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import PageWrapper from '../ui/PageWrapper';
import GlassCard from '../ui/GlassCard';
import { UsersIcon } from '../../constants';
import { useData } from '../../context/DataContext';
import type { Customer } from '../../types';
import { Trash2Icon, PencilIcon } from '../../constants';
import { formatDate } from '../../utils/dateFormatter';
import { useDebounce } from '../../utils/useDebounce';

// Animation variants
const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const listItemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    scale: 0.95,
    transition: {
      duration: 0.2,
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
      type: 'spring',
      stiffness: 300,
      damping: 24,
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
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    transition: { duration: 0.2 },
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
      type: 'spring',
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
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      type: 'spring',
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
      scale: { type: 'spring', stiffness: 400, damping: 20 },
      rotate: { duration: 0.4 },
    },
  },
  tap: { scale: 0.9 },
};

const searchResultVariants: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      height: { type: 'spring', stiffness: 300, damping: 30 },
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
  const { customers, loans, subscriptions, seniorityList, fetchSeniorityList, addToSeniority, updateSeniority, removeFromSeniority, isScopedCustomer } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    fetchSeniorityList().catch(err => console.error('Failed to load seniority list', err));
  }, [fetchSeniorityList]);

  const filtered = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    const existingIds = new Set<string>((seniorityList || []).map((e: any) => e.customer_id));
    const withoutLoansOrSubs = customers.filter(c => {
      if (existingIds.has(c.id)) return false;
      const hasLoan = loans.some(l => l.customer_id === c.id);
      const hasSub = subscriptions.some(s => s.customer_id === c.id);
      return !hasLoan && !hasSub;
    });
    if (!term) return withoutLoansOrSubs.slice(0, 10);
    return customers
      .filter(c => !existingIds.has(c.id))
      .filter(c => c.name.toLowerCase().includes(term) || String(c.phone).toLowerCase().includes(term));
  }, [customers, loans, subscriptions, debouncedSearchTerm, seniorityList]);

  const addCustomerToList = async (customer: Customer) => {
    setModalCustomer({ id: customer.id, name: customer.name });
    setModalEditingId(null);
  };

  const removeFromList = async (id: string) => {
    try {
      await removeFromSeniority(id);
    } catch (err) {
      alert((err as Error).message || 'Failed to remove customer from seniority list');
    }
  };

  const [modalCustomer, setModalCustomer] = useState<any | null>(null);
  const [stationName, setStationName] = useState('');
  const [loanType, setLoanType] = useState('General');
  const [loanRequestDate, setLoanRequestDate] = useState('');
  const [modalEditingId, setModalEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeFromSeniority(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      alert((err as Error).message || 'Failed to remove customer from seniority list');
    }
  };

  const closeModal = () => {
    setModalCustomer(null);
    setStationName('');
    setLoanType('General');
    setLoanRequestDate('');
  };

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
      alert(err.message || 'Failed to save seniority entry');
    }
  };

  return (
    <PageWrapper>
      <motion.div
        className="flex items-center justify-between mb-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-dark-text">
          <motion.span
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          >
            <UsersIcon className="w-8 h-8" />
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Loan Seniority
          </motion.span>
        </h2>
      </motion.div>

      {/* Search/Add section - hidden for scoped users */}
      {!isScopedCustomer && (
        <GlassCard className="mb-6 !p-4" hoverScale={false}>
          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="relative flex-1">
              <motion.input
                className="w-full bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg py-2 px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-muted"
                placeholder="Search customers by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                whileFocus={{ scale: 1.01, boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
              <AnimatePresence>
                {searchTerm && (
                  <motion.button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text p-1"
                    aria-label="Clear search"
                    initial={{ opacity: 0, scale: 0, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0, rotate: 90 }}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div
            className="mt-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-dark-text">Search results</h3>
            <motion.div
              className="space-y-2 max-h-64 overflow-y-auto"
              variants={listContainerVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.div
                    key="empty"
                    className="text-sm text-gray-500 dark:text-dark-muted"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    No customers found.
                  </motion.div>
                ) : (
                  filtered.map((c, idx) => (
                    <motion.div
                      key={c.id}
                      className="flex items-center justify-between bg-white dark:bg-dark-bg border border-gray-100 dark:border-dark-border rounded p-2"
                      variants={listItemVariants}
                      layout
                      layoutId={c.id}
                      whileHover={{
                        x: 4,
                        backgroundColor: 'rgba(99, 102, 241, 0.05)',
                        transition: { duration: 0.2 }
                      }}
                    >
                      <div className="min-w-0 mr-2">
                        <div className="font-semibold text-indigo-700 dark:text-indigo-400 truncate">{c.name}</div>
                        <div className="text-sm text-gray-500 dark:text-dark-muted">{c.phone}</div>
                      </div>
                      <motion.button
                        onClick={() => addCustomerToList(c)}
                        className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 shrink-0"
                        variants={buttonVariants}
                        initial="idle"
                        whileHover="hover"
                        whileTap="tap"
                      >
                        Add
                      </motion.button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </GlassCard>
      )}

      {/* Entry modal */}
      <AnimatePresence>
        {modalCustomer && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
            >
              <div className="flex items-center justify-between mb-4">
                <motion.h3
                  className="text-lg font-semibold text-gray-800 dark:text-dark-text"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {modalEditingId ? 'Edit' : 'Add'} Seniority Entry for {modalCustomer.name}
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
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">Station Name</label>
                  <input value={stationName} onChange={(e) => setStationName(e.target.value)} className="w-full border border-gray-300 dark:border-dark-border rounded px-3 py-2 bg-white dark:bg-dark-bg text-gray-800 dark:text-dark-text focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">Loan Type</label>
                  <select value={loanType} onChange={(e) => setLoanType(e.target.value)} className="w-full border border-gray-300 dark:border-dark-border rounded px-3 py-2 bg-white dark:bg-dark-bg text-gray-800 dark:text-dark-text focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow">
                    <option value="General">General</option>
                    <option value="Medical">Medical</option>
                  </select>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">Loan Request Date</label>
                  <input
                    value={loanRequestDate}
                    onChange={(e) => setLoanRequestDate(e.target.value)}
                    type="date"
                    className="w-full border border-gray-300 dark:border-dark-border rounded px-3 py-2 text-base bg-white dark:bg-dark-bg block text-gray-800 dark:text-dark-text focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
                    style={{ minHeight: '42px', WebkitAppearance: 'none' }}
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
      </AnimatePresence>

      <GlassCard className="!p-4" hoverScale={false}>
        <motion.h3
          className="text-xl font-bold mb-3 text-gray-800 dark:text-dark-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Loan Seniority List
        </motion.h3>
        {(!seniorityList || seniorityList.length === 0) ? (
          <motion.div
            className="text-sm text-gray-500 dark:text-dark-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {isScopedCustomer
              ? "No seniority entries found."
              : "No customers added yet. Search above and click Add to include a customer."}
          </motion.div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">#</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Customer</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Phone</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Station</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Loan Type</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Requested</th>
                    {!isScopedCustomer && <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Actions</th>}
                  </tr>
                </thead>
                <motion.tbody
                  initial="hidden"
                  animate="visible"
                  variants={listContainerVariants}
                >
                  <AnimatePresence mode="popLayout">
                    {seniorityList.map((entry: any, idx: number) => (
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
                        <td className="px-4 py-3 text-gray-800 dark:text-dark-text">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-indigo-700 dark:text-indigo-400">{entry.customers?.name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-dark-muted">{entry.customers?.phone || ''}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-dark-text">{entry.station_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-dark-text">{entry.loan_type || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-dark-text">{entry.loan_request_date ? formatDate(entry.loan_request_date) : '-'}</td>
                        {!isScopedCustomer && (
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <motion.button
                                onClick={() => {
                                  setModalCustomer({ id: entry.customer_id, name: entry.customers?.name });
                                  setStationName(entry.station_name || '');
                                  setLoanType(entry.loan_type || 'General');
                                  setLoanRequestDate(entry.loan_request_date || '');
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
                                onClick={() => setDeleteTarget({ id: entry.id, name: entry.customers?.name || 'Unknown' })}
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
            </div>

            {/* Mobile cards */}
            <motion.div
              className="md:hidden space-y-3"
              variants={listContainerVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence mode="popLayout">
                {seniorityList.map((entry: any, idx: number) => (
                  <motion.div
                    key={entry.id}
                    className="bg-white dark:bg-dark-bg border border-gray-100 dark:border-dark-border rounded p-3"
                    variants={listItemVariants}
                    layout
                    layoutId={`card-${entry.id}`}
                    whileHover={{
                      scale: 1.01,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      transition: { duration: 0.2 }
                    }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-400 dark:text-dark-muted">#{idx + 1}</div>
                        <div className="font-semibold text-indigo-700 dark:text-indigo-400 truncate">{entry.customers?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500 dark:text-dark-muted">{entry.customers?.phone || ''}</div>
                        <motion.div
                          className="mt-2 text-sm text-gray-600 dark:text-dark-muted space-y-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {entry.station_name && <div>Station: <span className="font-medium text-gray-800 dark:text-dark-text">{entry.station_name}</span></div>}
                          {entry.loan_type && <div>Loan Type: <span className="font-medium text-gray-800 dark:text-dark-text">{entry.loan_type}</span></div>}
                          {entry.loan_request_date && <div>Requested: <span className="font-medium text-gray-800 dark:text-dark-text">{formatDate(entry.loan_request_date)}</span></div>}
                        </motion.div>
                      </div>
                      {!isScopedCustomer && (
                        <div className="flex items-center gap-2 ml-3">
                          <motion.button
                            onClick={() => {
                              setModalCustomer({ id: entry.customer_id, name: entry.customers?.name });
                              setStationName(entry.station_name || '');
                              setLoanType(entry.loan_type || 'General');
                              setLoanRequestDate(entry.loan_request_date || '');
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
                            onClick={() => setDeleteTarget({ id: entry.id, name: entry.customers?.name || 'Unknown' })}
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
          </>
        )}
      </GlassCard>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
                initial={{ opacity: 0, y: -10 }}
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
                Are you sure you want to remove <span className="font-semibold text-gray-800 dark:text-dark-text">{deleteTarget.name}</span> from the seniority list?
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
      </AnimatePresence>
    </PageWrapper>
  );
};

export default LoanSeniorityPage;
