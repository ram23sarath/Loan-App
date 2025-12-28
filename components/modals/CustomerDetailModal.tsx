import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import type { Customer, LoanWithCustomer, SubscriptionWithCustomer, Installment, DataEntry } from '../../types';
import GlassCard from '../ui/GlassCard';
import { XIcon, FileDownIcon, LandmarkIcon, HistoryIcon, Trash2Icon } from '../../constants';
import { formatDate } from '../../utils/dateFormatter';

interface CustomerDetailModalProps {
  customer: Customer;
  loans: LoanWithCustomer[];
  subscriptions: SubscriptionWithCustomer[];
  installments: Installment[];
  dataEntries?: DataEntry[];
  onClose: () => void;
  deleteLoan: (loanId: string) => Promise<void>;
  deleteSubscription: (subscriptionId: string) => Promise<void>;
  deleteInstallment: (installmentId: string) => Promise<void>;
  onEditLoan?: (loan: LoanWithCustomer) => void;
  onEditSubscription?: (sub: SubscriptionWithCustomer) => void;
}

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100 } },
  exit: { opacity: 0, y: 50, scale: 0.9 },
};

const formatCurrency = (amount: number) => `₹${amount.toLocaleString()}`;

// Define variants for the note's expansion
const noteVariants: Variants = {
  collapsed: {
    height: 'auto',
    opacity: 1,
    overflow: 'hidden',
    transition: {
      height: { duration: 0.3, ease: 'easeInOut' },
      opacity: { duration: 0.2, ease: 'easeOut' },
    }
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    overflow: 'visible',
    transition: {
      height: { duration: 0.3, ease: 'easeInOut' },
      opacity: { duration: 0.2, ease: 'easeIn' },
    }
  },
};

const installmentRowVariants: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      duration: 0.3,
      ease: 'easeIn'
    }
  },
};

const installmentCardVariants: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  },
  visible: {
    opacity: 1,
    height: 'auto',
    marginTop: '0.75rem',
    transition: {
      duration: 0.3,
      ease: 'easeIn'
    }
  },
};

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  loans,
  subscriptions,
  installments,
  dataEntries = [],
  onClose,
  deleteLoan,
  deleteSubscription,
  deleteInstallment,
  onEditLoan,
  onEditSubscription,
}) => {
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const noteRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Lookup map for O(1) installment access by loan_id
  const installmentsByLoanId = useMemo(() => {
    const map = new Map<string, Installment[]>();
    installments.forEach(inst => {
      const existing = map.get(inst.loan_id) || [];
      existing.push(inst);
      map.set(inst.loan_id, existing);
    });
    return map;
  }, [installments]);

  // Delete confirmation states
  const [deleteLoanTarget, setDeleteLoanTarget] = useState<LoanWithCustomer | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<SubscriptionWithCustomer | null>(null);
  const [deleteInstTarget, setDeleteInstTarget] = useState<Installment | null>(null);

  const handleNoteClick = (id: string) => {
    setExpandedNoteId(expandedNoteId === id ? null : id);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (expandedNoteId && noteRefs.current[expandedNoteId] && !noteRefs.current[expandedNoteId]?.contains(event.target as Node)) {
        setExpandedNoteId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedNoteId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // If a delete confirmation is open, close it first
      if (deleteInstTarget) {
        setDeleteInstTarget(null);
        return;
      }
      if (deleteSubTarget) {
        setDeleteSubTarget(null);
        return;
      }
      if (deleteLoanTarget) {
        setDeleteLoanTarget(null);
        return;
      }
      // Otherwise close the whole modal
      onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [deleteInstTarget, deleteSubTarget, deleteLoanTarget, onClose]);

  const confirmDeleteLoan = async () => {
    if (!deleteLoanTarget) return;
    try {
      await deleteLoan(deleteLoanTarget.id);
      setDeleteLoanTarget(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const confirmDeleteSubscription = async () => {
    if (!deleteSubTarget) return;
    try {
      await deleteSubscription(deleteSubTarget.id);
      setDeleteSubTarget(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const confirmDeleteInstallment = async () => {
    if (!deleteInstTarget) return;
    try {
      await deleteInstallment(deleteInstTarget.id);
      setDeleteInstTarget(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleIndividualExport = () => {
    const customerLoansData = loans.map(loan => {
      const loanInstallments = installmentsByLoanId.get(loan.id) || [];
      const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
      const lateFeesPaid = loanInstallments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0);
      const totalRepayable = loan.original_amount + loan.interest_amount;

      return {
        'Loan ID': loan.id,
        'Original Amount': loan.original_amount,
        'Interest Amount': loan.interest_amount,
        'Total Repayable': totalRepayable,
        'Amount Paid': amountPaid,
        'Late Fees Paid': lateFeesPaid,
        'Balance': totalRepayable - amountPaid,
        'Loan Date': formatDate(loan.payment_date),
        'Status': amountPaid >= totalRepayable ? 'Paid Off' : 'In Progress',
      };
    });

    const customerSubscriptionsData = subscriptions.map(sub => ({
      'Subscription ID': sub.id,
      'Amount': sub.amount,
      'Date': formatDate(sub.date),
      'Receipt': sub.receipt,
    }));

    const customerInstallmentsData = installments
      .filter(inst => loans.some(l => l.id === inst.loan_id))
      .map(inst => ({
        'Installment ID': inst.id,
        'Loan ID': inst.loan_id,
        'Installment Number': inst.installment_number,
        'Amount Paid': inst.amount,
        'Late Fee Paid': inst.late_fee || 0,
        'Payment Date': formatDate(inst.date),
        'Receipt Number': inst.receipt_number,
      }));

    const wb = XLSX.utils.book_new();

    if (customerLoansData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerLoansData), 'Loans');
    if (customerSubscriptionsData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerSubscriptionsData), 'Subscriptions');
    if (customerInstallmentsData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerInstallmentsData), 'Installments');

    XLSX.writeFile(wb, `${customer.name}_Details.xlsx`);
  };

  return ReactDOM.createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-5xl flex flex-col max-h-[90vh]"
        variants={modalVariants}
        exit="exit"
        onClick={e => e.stopPropagation()}
      >
        <GlassCard className="!p-0 w-full flex-shrink-0 dark:bg-dark-card dark:border-dark-border" disable3D>
          <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 dark:border-dark-border">
            <div>
              <h2 className="text-xl sm:text-3xl font-bold dark:text-dark-text">{customer.name}</h2>
              <p className="text-sm sm:text-base text-gray-500 dark:text-dark-muted">{customer.phone}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <motion.button
                onClick={handleIndividualExport}
                className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 text-xs sm:text-base font-semibold transition-colors bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FileDownIcon className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Export Details</span><span className="sm:hidden">Export</span>
              </motion.button>
              <motion.button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 dark:text-dark-text"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <XIcon className="w-6 h-6" />
              </motion.button>
            </div>
          </div>
        </GlassCard>

        <div className="mt-2 sm:mt-4 space-y-3 sm:space-y-6 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {/* Loans Section */}
          <GlassCard className="w-full !p-3 sm:!p-6 dark:bg-dark-card dark:border-dark-border" disable3D>
            <h3 className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 text-lg sm:text-2xl font-semibold dark:text-dark-text">
              <LandmarkIcon className="w-5 h-5 sm:w-6 sm:h-6" /> Loans
              {loans.length > 0 && (
                <span className="text-base sm:text-lg font-normal text-green-600 dark:text-green-400">
                  (Total: {formatCurrency(loans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0))})
                </span>
              )}
            </h3>
            {loans.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Desktop Table */}
                <table className="min-w-full border-collapse hidden md:table">
                  <thead>
                    <tr className="bg-gray-100/70 dark:bg-slate-700">
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">#</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Loan Amount</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Interest</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Total Repayable</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Paid</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Balance</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Check #</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Installments</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Date</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Status</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan, idx) => {
                      const loanInstallments = installmentsByLoanId.get(loan.id) || [];
                      const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
                      const totalRepayable = loan.original_amount + loan.interest_amount;
                      const balance = totalRepayable - amountPaid;
                      const isPaidOff = amountPaid >= totalRepayable;
                      const isExpanded = expandedLoanId === loan.id;

                      return (
                        <React.Fragment key={loan.id}>
                          <tr className="even:bg-gray-50/50 hover:bg-indigo-50/50 transition-colors dark:even:bg-slate-700/50 dark:hover:bg-indigo-900/30">
                            <td className="px-4 py-2 border-b dark:border-dark-border font-medium text-sm text-gray-700 dark:text-dark-text">
                              <button
                                onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                                className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                              >
                                <span>{isExpanded ? '▼' : '▶'}</span>
                                <span>{idx + 1}</span>
                              </button>
                            </td>
                            <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-muted">{formatCurrency(loan.original_amount)}</td>
                            <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-muted">{formatCurrency(loan.interest_amount)}</td>
                            <td className="px-4 py-2 border-b dark:border-dark-border font-semibold dark:text-dark-text">{formatCurrency(totalRepayable)}</td>
                            <td className="px-4 py-2 border-b dark:border-dark-border text-green-600 dark:text-green-400">{formatCurrency(amountPaid)}</td>
                            <td className="px-4 py-2 border-b dark:border-dark-border text-red-600 dark:text-red-400">{formatCurrency(balance)}</td>
                            <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-muted">{loan.check_number || '-'}</td>
                            <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-muted">{loanInstallments.length}/{loan.total_instalments}</td>
                            <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-muted">{formatDate(loan.payment_date)}</td>
                            <td className={`px-4 py-2 border-b dark:border-dark-border font-semibold ${isPaidOff ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                              {isPaidOff ? 'Paid Off' : 'In Progress'}
                            </td>
                            <td className="px-4 py-2 border-b dark:border-dark-border">
                              <div className="flex gap-2">
                                {onEditLoan && (
                                  <button
                                    onClick={() => onEditLoan(loan)}
                                    className="px-2 py-1 rounded bg-blue-600 dark:bg-blue-500 text-white text-xs hover:bg-blue-700 dark:hover:bg-blue-400"
                                  >
                                    Edit
                                  </button>
                                )}
                                <button
                                  onClick={() => setDeleteLoanTarget(loan)}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onTouchStart={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => (e as any).stopPropagation()}
                                  className="px-2 py-1 rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                >
                                  <Trash2Icon className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          <AnimatePresence>
                            {isExpanded && loanInstallments.length > 0 && (
                              <motion.tr
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                variants={installmentRowVariants}
                              >
                                <td colSpan={11} className="px-4 py-3 bg-indigo-50/30 dark:bg-indigo-900/20">
                                  <motion.div
                                    className="space-y-2"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                  >
                                    <h5 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-2">Installments Paid:</h5>
                                    <div className="space-y-1">
                                      {loanInstallments.map(inst => (
                                        <div key={inst.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-dark-border text-sm">
                                          <div className="flex items-center gap-4">
                                            <span className="font-medium text-gray-700 dark:text-dark-text">#{inst.installment_number}</span>
                                            <span className="text-gray-600 dark:text-dark-muted">{formatDate(inst.date)}</span>
                                            <span className="text-gray-600 dark:text-dark-muted">Receipt: {inst.receipt_number}</span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="font-semibold text-green-600 dark:text-green-400">
                                              {formatCurrency(inst.amount)}
                                              {inst.late_fee && inst.late_fee > 0 && (
                                                <span className="ml-1 text-xs text-orange-500">(+{formatCurrency(inst.late_fee)} late)</span>
                                              )}
                                            </span>
                                            <motion.button
                                              onClick={() => setDeleteInstTarget(inst)}
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onTouchStart={(e) => e.stopPropagation()}
                                              onPointerDown={(e) => (e as any).stopPropagation()}
                                              className="px-2 py-1 rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                              whileHover={{ scale: 1.02 }}
                                              whileTap={{ scale: 0.98 }}
                                            >
                                              <Trash2Icon className="w-4 h-4 text-red-500" />
                                            </motion.button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                </td>
                              </motion.tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {loans.map((loan, idx) => {
                    const loanInstallments = installmentsByLoanId.get(loan.id) || [];
                    const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
                    const totalRepayable = loan.original_amount + loan.interest_amount;
                    const balance = totalRepayable - amountPaid;
                    const isPaidOff = amountPaid >= totalRepayable;
                    const isExpanded = expandedLoanId === loan.id;

                    return (
                      <div key={loan.id} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-dark-border">
                        <div className="flex justify-between items-start mb-2">
                          <button
                            onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                            className="text-xs text-gray-500 dark:text-dark-muted flex items-center gap-1"
                          >
                            <span>{isExpanded ? '▼' : '▶'}</span>
                            <span>#{idx + 1}</span>
                          </button>
                          <div className={`text-xs font-semibold px-2 py-1 rounded ${isPaidOff ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                            {isPaidOff ? 'Paid Off' : 'In Progress'}
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-dark-muted">Date:</span>
                            <span className="font-medium dark:text-dark-text">{formatDate(loan.payment_date)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-dark-muted">Loan Amount:</span>
                            <span className="font-medium dark:text-dark-text">{formatCurrency(loan.original_amount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-dark-muted">Interest:</span>
                            <span className="font-medium dark:text-dark-text">{formatCurrency(loan.interest_amount)}</span>
                          </div>
                          <div className="flex justify-between border-t dark:border-dark-border pt-2">
                            <span className="text-gray-600 dark:text-dark-muted font-semibold">Total Repayable:</span>
                            <span className="font-bold dark:text-dark-text">{formatCurrency(totalRepayable)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-dark-muted">Paid:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(amountPaid)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-dark-muted">Balance:</span>
                            <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(balance)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-dark-muted">Installments:</span>
                            <span className="font-medium dark:text-dark-text">{loanInstallments.length}/{loan.total_instalments}</span>
                          </div>
                          {loan.check_number && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-dark-muted">Check #:</span>
                              <span className="font-medium dark:text-dark-text">{loan.check_number}</span>
                            </div>
                          )}
                        </div>

                        <AnimatePresence>
                          {isExpanded && loanInstallments.length > 0 && (
                            <motion.div
                              className="mt-3 pt-3 border-t dark:border-dark-border space-y-2"
                              initial="hidden"
                              animate="visible"
                              exit="hidden"
                              variants={installmentCardVariants}
                            >
                              <h5 className="text-xs font-semibold text-gray-700 dark:text-dark-text">Installments Paid:</h5>
                              <motion.div
                                className="space-y-1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 }}
                              >
                                {loanInstallments.map(inst => (
                                  <div key={inst.id} className="flex items-start justify-between p-2 bg-white dark:bg-slate-700/50 rounded border border-gray-200 dark:border-dark-border text-xs">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-700 dark:text-dark-text">Installment #{inst.installment_number}</div>
                                      <div className="text-gray-600 dark:text-dark-muted mt-1">{formatDate(inst.date)}</div>
                                      <div className="text-gray-600 dark:text-dark-muted">Receipt: {inst.receipt_number}</div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="font-semibold text-green-600 dark:text-green-400">
                                        {formatCurrency(inst.amount)}
                                      </span>
                                      {inst.late_fee && inst.late_fee > 0 && (
                                        <span className="text-xs text-orange-500">+{formatCurrency(inst.late_fee)} late</span>
                                      )}
                                      <motion.button
                                        onClick={() => setDeleteInstTarget(inst)}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onPointerDown={(e) => (e as any).stopPropagation()}
                                        className="px-2 py-1 rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                      >
                                        <Trash2Icon className="w-3 h-3 text-red-500" />
                                      </motion.button>
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex gap-2 mt-3 pt-3 border-t dark:border-dark-border">
                          {onEditLoan && (
                            <button
                              onClick={() => onEditLoan(loan)}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onPointerDown={(e) => (e as any).stopPropagation()}
                              className="flex-1 px-3 py-2 rounded bg-blue-600 dark:bg-blue-500 text-white text-sm hover:bg-blue-700 dark:hover:bg-blue-400"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteLoanTarget(loan)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onPointerDown={(e) => (e as any).stopPropagation()}
                            className="px-3 py-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          >
                            <Trash2Icon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-dark-muted">No loan records for this customer.</p>
            )}
          </GlassCard>

          {/* Subscriptions Section */}
          <GlassCard className="w-full !p-3 sm:!p-6 dark:bg-dark-card dark:border-dark-border" disable3D>
            <h3 className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 text-lg sm:text-2xl font-semibold dark:text-dark-text">
              <HistoryIcon className="w-5 h-5 sm:w-6 sm:h-6" /> Subscriptions
              {subscriptions.length > 0 && (
                <span className="text-base sm:text-lg font-normal text-cyan-600 dark:text-cyan-400">
                  (Total: {formatCurrency(subscriptions.reduce((acc, sub) => acc + sub.amount, 0))})
                </span>
              )}
            </h3>
            {subscriptions.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Desktop Table */}
                <table className="min-w-full border-collapse hidden md:table">
                  <thead>
                    <tr className="bg-gray-100/70 dark:bg-slate-700">
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">#</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Date</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Amount</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Late Fee</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Receipt #</th>
                      <th className="px-4 py-2 border-b dark:border-dark-border text-left text-sm font-semibold text-gray-600 dark:text-dark-text">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub, idx) => (
                      <tr key={sub.id} className="even:bg-gray-50/50 hover:bg-cyan-50/50 transition-colors dark:even:bg-slate-700/50 dark:hover:bg-cyan-900/30">
                        <td className="px-4 py-2 border-b dark:border-dark-border font-medium text-sm text-gray-700 dark:text-dark-text">{idx + 1}</td>
                        <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-muted">{formatDate(sub.date)}</td>
                        <td className="px-4 py-2 border-b dark:border-dark-border font-semibold text-cyan-600 dark:text-cyan-400">{formatCurrency(sub.amount)}</td>
                        <td className="px-4 py-2 border-b dark:border-dark-border text-orange-600 dark:text-orange-400">
                          {sub.late_fee ? formatCurrency(sub.late_fee) : '-'}
                        </td>
                        <td className="px-4 py-2 border-b dark:border-dark-border dark:text-dark-muted">{sub.receipt || '-'}</td>
                        <td className="px-4 py-2 border-b dark:border-dark-border">
                          <div className="flex gap-2">
                            {onEditSubscription && (
                              <button
                                onClick={() => onEditSubscription(sub)}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onPointerDown={(e) => (e as any).stopPropagation()}
                                className="px-2 py-1 rounded bg-blue-600 dark:bg-blue-500 text-white text-xs hover:bg-blue-700 dark:hover:bg-blue-400"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteSubTarget(sub)}
                              className="p-1 rounded-full hover:bg-red-500/10 dark:hover:bg-red-900/30 transition-colors"
                            >
                              <Trash2Icon className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {subscriptions.map((sub, idx) => (
                    <div key={sub.id} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-dark-border">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-xs text-gray-500 dark:text-dark-muted">#{idx + 1}</div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-dark-muted">Date:</span>
                          <span className="font-medium dark:text-dark-text">{formatDate(sub.date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-dark-muted">Amount:</span>
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">{formatCurrency(sub.amount)}</span>
                        </div>
                        {sub.late_fee && sub.late_fee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-dark-muted">Late Fee:</span>
                            <span className="font-medium text-orange-600 dark:text-orange-400">{formatCurrency(sub.late_fee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-dark-muted">Receipt #:</span>
                          <span className="font-medium dark:text-dark-text">{sub.receipt || '-'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t dark:border-dark-border">
                        {onEditSubscription && (
                          <button
                            onClick={() => onEditSubscription(sub)}
                            className="flex-1 px-3 py-2 rounded bg-blue-600 dark:bg-blue-500 text-white text-sm hover:bg-blue-700 dark:hover:bg-blue-400"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteSubTarget(sub)}
                          className="px-3 py-2 rounded-md bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        >
                          <Trash2Icon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-dark-muted">No subscription records for this customer.</p>
            )}
          </GlassCard>

          {/* Data Entries Section */}
          <GlassCard className="w-full !p-3 sm:!p-6 dark:bg-dark-card dark:border-dark-border" disable3D>
            <div className="mb-3 sm:mb-4">
              <h3 className="flex items-center gap-2 sm:gap-3 text-lg sm:text-2xl font-semibold text-pink-700 dark:text-pink-400">Misc Data Entries</h3>
            </div>
            {dataEntries.length > 0 ? (
              <div>
                {/* Desktop Table/Grid View */}
                <div className="hidden md:block space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold tracking-wider text-pink-700 dark:text-pink-400 uppercase bg-pink-50 dark:bg-pink-900/20 rounded-lg w-full">
                    <div className="col-span-2 text-left">Date</div>
                    <div className="col-span-2 text-center">Type</div>
                    <div className="col-span-2 text-right">Amount</div>
                    <div className="col-span-2 text-center">Receipt #</div>
                    <div className="col-span-4 text-left">Notes</div>
                  </div>
                  {/* Rows */}
                  {dataEntries.map(entry => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-12 gap-4 px-4 py-2 text-sm items-start border-b border-pink-100 dark:border-pink-900/30 last:border-b-0 w-full"
                    >
                      <div className="col-span-2 text-left text-gray-700 dark:text-dark-text">{formatDate(entry.date)}</div>
                      <div className="col-span-2 text-center">
                        {entry.type === 'credit' ? (
                          <span className="inline-block px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full dark:bg-green-900/30 dark:text-green-400">Credit</span>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full dark:bg-red-900/30 dark:text-red-400">Expenditure</span>
                        )}
                      </div>
                      <div className={`col-span-2 font-bold text-right ${entry.type === 'credit' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {entry.type === 'credit' ? '+' : '-'}
                        {formatCurrency(entry.amount)}
                      </div>
                      <div className="col-span-2 text-center text-gray-600 dark:text-dark-muted">{entry.receipt_number}</div>
                      <div className="col-span-4 text-left text-gray-600 dark:text-dark-muted">
                        <div
                          ref={(el) => (noteRefs.current[entry.id] = el)}
                          onClick={() => handleNoteClick(entry.id)}
                          className="cursor-pointer"
                        >
                          <motion.p
                            initial="collapsed"
                            animate={expandedNoteId === entry.id ? 'expanded' : 'collapsed'}
                            variants={noteVariants}
                            className={expandedNoteId !== entry.id ? 'truncate' : ''}
                          >
                            {entry.notes || '-'}
                          </motion.p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-3">
                  {dataEntries.map((entry, idx) => (
                    <div key={entry.id} className="p-3 bg-pink-50 dark:bg-pink-900/10 rounded-lg border border-pink-200 dark:border-pink-900/30">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-xs text-gray-500 dark:text-dark-muted">#{idx + 1}</div>
                        <div>
                          {entry.type === 'credit' ? (
                            <span className="inline-block px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full dark:bg-green-900/30 dark:text-green-400">Credit</span>
                          ) : (
                            <span className="inline-block px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full dark:bg-red-900/30 dark:text-red-400">Expenditure</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-dark-muted">Date:</span>
                          <span className="font-medium dark:text-dark-text">{formatDate(entry.date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-dark-muted">Amount:</span>
                          <span className={`font-bold ${entry.type === 'credit' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {entry.type === 'credit' ? '+' : '-'}
                            {formatCurrency(entry.amount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-dark-muted">Receipt #:</span>
                          <span className="font-medium dark:text-dark-text">{entry.receipt_number}</span>
                        </div>
                        {entry.notes && (
                          <div className="pt-2 border-t border-pink-200 dark:border-pink-900/30">
                            <span className="text-gray-600 dark:text-dark-muted text-xs font-semibold">Notes:</span>
                            <div
                              ref={(el) => (noteRefs.current[entry.id] = el)}
                              onClick={() => handleNoteClick(entry.id)}
                              className="cursor-pointer mt-1"
                            >
                              <motion.p
                                initial="collapsed"
                                animate={expandedNoteId === entry.id ? 'expanded' : 'collapsed'}
                                variants={noteVariants}
                                className={`text-gray-700 dark:text-dark-text text-sm ${expandedNoteId !== entry.id ? 'line-clamp-2' : ''}`}
                              >
                                {entry.notes}
                              </motion.p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-dark-muted">No data entries for this customer.</p>
            )}
          </GlassCard>
        </div>

        {/* Delete Loan Confirmation Modal (render into its own portal to avoid stacking issues) */}
        {ReactDOM.createPortal(
          <AnimatePresence>
            {deleteLoanTarget && (
              <motion.div
                key="cust-delete-loan-backdrop"
                variants={backdropVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="fixed inset-0 z-[99999] bg-black/40"
                onClick={() => setDeleteLoanTarget(null)}
              >
                <motion.div
                  key="cust-delete-loan-content"
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 md:p-8 w-[90%] max-w-md dark:bg-dark-card dark:border dark:border-dark-border relative z-[100000]"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold mb-3 dark:text-dark-text">Delete Loan?</h3>
                  <p className="mb-4 text-sm text-gray-600 dark:text-dark-muted">
                    Are you sure you want to delete the loan from <span className="font-semibold dark:text-dark-text">{formatDate(deleteLoanTarget.payment_date)}</span>? This will also delete all its installments.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setDeleteLoanTarget(null)}
                      className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeleteLoan}
                      className="px-3 py-2 rounded bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
                    >
                      Delete Loan
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* Delete Subscription Confirmation Modal (separate portal) */}
        {ReactDOM.createPortal(
          <AnimatePresence>
            {deleteSubTarget && (
              <motion.div
                key="cust-delete-sub-backdrop"
                variants={backdropVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="fixed inset-0 z-[99999] bg-black/40"
                onClick={() => setDeleteSubTarget(null)}
              >
                <motion.div
                  key="cust-delete-sub-content"
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 md:p-8 w-[90%] max-w-md dark:bg-dark-card dark:border dark:border-dark-border relative z-[100000]"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold mb-3 dark:text-dark-text">Delete Subscription?</h3>
                  <p className="mb-4 text-sm text-gray-600 dark:text-dark-muted">
                    Are you sure you want to delete the subscription from <span className="font-semibold dark:text-dark-text">{formatDate(deleteSubTarget.date)}</span>?
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setDeleteSubTarget(null)}
                      className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeleteSubscription}
                      className="px-3 py-2 rounded bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
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

        {/* Delete Installment Confirmation Modal (separate portal) */}
        {ReactDOM.createPortal(
          <AnimatePresence>
            {deleteInstTarget && (
              <motion.div
                key="cust-delete-inst-backdrop"
                variants={backdropVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="fixed inset-0 z-[99999] bg-black/40"
                onClick={() => setDeleteInstTarget(null)}
              >
                <motion.div
                  key="cust-delete-inst-content"
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 md:p-8 w-[90%] max-w-md dark:bg-dark-card dark:border dark:border-dark-border relative z-[100000]"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold mb-3 dark:text-dark-text">Delete Installment?</h3>
                  <p className="mb-4 text-sm text-gray-600 dark:text-dark-muted">
                    Are you sure you want to delete installment <span className="font-semibold dark:text-dark-text">#{deleteInstTarget.installment_number}</span>?
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setDeleteInstTarget(null)}
                      className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeleteInstallment}
                      className="px-3 py-2 rounded bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
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
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default CustomerDetailModal;