import React, { useState, useRef, useEffect } from 'react';
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
  const noteRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  const handleDeleteLoan = async (loan: LoanWithCustomer) => {
    if (window.confirm(`Are you sure you want to delete the loan from ${formatDate(loan.payment_date)}? This will also delete all its installments.`)) {
      try {
        await deleteLoan(loan.id);
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const handleDeleteSubscription = async (sub: SubscriptionWithCustomer) => {
    if (window.confirm(`Are you sure you want to delete this subscription from ${formatDate(sub.date)}?`)) {
      try {
        await deleteSubscription(sub.id);
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const handleDeleteInstallment = async (installment: Installment) => {
    if (window.confirm(`Are you sure you want to delete installment #${installment.installment_number}?`)) {
      try {
        await deleteInstallment(installment.id);
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const handleIndividualExport = () => {
    const customerLoansData = loans.map(loan => {
      const loanInstallments = installments.filter(i => i.loan_id === loan.id);
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

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
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
        <GlassCard className="!p-0 w-full flex-shrink-0">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-3xl font-bold">{customer.name}</h2>
              <p className="text-gray-500">{customer.phone}</p>
            </div>
            <div className="flex items-center gap-4">
              <motion.button
                onClick={handleIndividualExport}
                className="flex items-center gap-2 p-3 font-semibold transition-colors bg-gray-100 rounded-lg hover:bg-gray-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FileDownIcon className="w-5 h-5" /> Export Details
              </motion.button>
              <motion.button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-200"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <XIcon className="w-6 h-6" />
              </motion.button>
            </div>
          </div>
        </GlassCard>

        <div className="mt-4 space-y-6 overflow-y-auto">
          {/* Loans Section */}
          <GlassCard className="w-full">
            <h3 className="flex items-center gap-3 mb-4 text-2xl font-semibold">
              <LandmarkIcon /> Loans
            </h3>
            {loans.length > 0 ? (
              <div className="space-y-4">
                {loans.map(loan => {
                  const loanInstallments = installments.filter(i => i.loan_id === loan.id);
                  const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
                  const totalRepayable = loan.original_amount + loan.interest_amount;
                  const progress = totalRepayable > 0 ? (amountPaid / totalRepayable) * 100 : 0;
                  const isPaidOff = amountPaid >= totalRepayable;
                  const principalPaid = Math.min(amountPaid, loan.original_amount);
                  const interestCollected = amountPaid > loan.original_amount ? Math.min(amountPaid - loan.original_amount, loan.interest_amount) : 0;
                  
                  return (
                    <div key={loan.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-bold">Loan from {formatDate(loan.payment_date)}</p>
                          <p className="text-xs text-gray-500">
                            Total: {formatCurrency(totalRepayable)} ({formatCurrency(loan.original_amount)} + {formatCurrency(loan.interest_amount)} interest)
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Principal Paid: {formatCurrency(principalPaid)}
                            <br />
                            Interest Collected: {formatCurrency(interestCollected)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {onEditLoan && (
                            <motion.button
                              onClick={() => onEditLoan(loan)}
                              className="p-2 transition-colors rounded-full hover:bg-blue-500/10"
                              aria-label={`Edit loan from ${loan.payment_date}`}
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <span className="font-bold text-blue-600">Edit</span>
                            </motion.button>
                          )}
                          <motion.button
                            onClick={() => handleDeleteLoan(loan)}
                            className="p-2 transition-colors rounded-full hover:bg-red-500/10"
                            aria-label={`Delete loan from ${loan.payment_date}`}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2Icon className="w-5 h-5 text-red-500" />
                          </motion.button>
                        </div>
                      </div>
                      <div className="w-full h-2 my-2 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${isPaidOff ? 'bg-green-500' : 'bg-indigo-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Paid: {formatCurrency(amountPaid)}</span>
                        <span>Installments: {loanInstallments.length}/{loan.total_instalments}</span>
                      </div>
                      {loanInstallments.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-gray-200 pt-3">
                          <h4 className="mb-1 text-sm font-semibold text-gray-600">Recorded Installments:</h4>
                          {loanInstallments.map(installment => (
                            <div key={installment.id} className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
                              <div>
                                <p className="text-sm font-medium">Installment #{installment.installment_number}</p>
                                <p className="text-xs text-gray-500">
                                  Date: {formatDate(installment.date)} | Receipt: {installment.receipt_number}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <p className="font-semibold text-green-600">
                                  {formatCurrency(installment.amount)}
                                  {installment.late_fee && installment.late_fee > 0 && (
                                    <span className="ml-1 text-xs text-orange-500">(+{formatCurrency(installment.late_fee)} late)</span>
                                  )}
                                </p>
                                <motion.button
                                  onClick={() => handleDeleteInstallment(installment)}
                                  className="p-1 transition-colors rounded-full hover:bg-red-500/10"
                                  aria-label={`Delete installment #${installment.installment_number}`}
                                  whileHover={{ scale: 1.2 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <Trash2Icon className="w-4 h-4 text-red-500" />
                                </motion.button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500">No loan records for this customer.</p>
            )}
          </GlassCard>

          {/* Subscriptions Section */}
          <GlassCard className="w-full">
            <h3 className="flex items-center gap-3 mb-4 text-2xl font-semibold">
              <HistoryIcon /> Subscriptions
            </h3>
            {subscriptions.length > 0 ? (
              <div className="space-y-4">
                {subscriptions.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-bold">Subscription on {formatDate(sub.date)}</p>
                      <p className="text-xs text-gray-500">Receipt: {sub.receipt}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold text-cyan-600">{formatCurrency(sub.amount)}</p>
                      {onEditSubscription && (
                        <motion.button
                          onClick={() => onEditSubscription(sub)}
                          className="p-2 transition-colors rounded-full hover:bg-blue-500/10"
                          aria-label={`Edit subscription from ${formatDate(sub.date)}`}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <span className="font-bold text-blue-600">Edit</span>
                        </motion.button>
                      )}
                      <motion.button
                        onClick={() => handleDeleteSubscription(sub)}
                        className="p-2 transition-colors rounded-full hover:bg-red-500/10"
                        aria-label={`Delete subscription from ${formatDate(sub.date)}`}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2Icon className="w-5 h-5 text-red-500" />
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No subscription records for this customer.</p>
            )}
          </GlassCard>

          {/* Data Entries Section */}
          <GlassCard className="w-full">
            <div className="mb-4">
              <h3 className="flex items-center gap-3 text-2xl font-semibold text-pink-700">Misc Data Entries</h3>
            </div>
            {dataEntries.length > 0 ? (
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold tracking-wider text-pink-700 uppercase bg-pink-50 rounded-lg w-full">
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
                    className="grid grid-cols-12 gap-4 px-4 py-2 text-sm items-start border-b border-pink-100 last:border-b-0 w-full"
                  >
                    <div className="col-span-2 text-left text-gray-700">{formatDate(entry.date)}</div>
                    <div className="col-span-2 text-center">
                      {entry.type === 'credit' ? (
                        <span className="inline-block px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">Credit</span>
                      ) : (
                        <span className="inline-block px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full">Expenditure</span>
                      )}
                    </div>
                    <div className={`col-span-2 font-bold text-right ${entry.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                      {entry.type === 'credit' ? '+' : '-'}
                      {formatCurrency(entry.amount)}
                    </div>
                    <div className="col-span-2 text-center text-gray-600">{entry.receipt_number}</div>
                    <div className="col-span-4 text-left text-gray-600">
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
            ) : (
              <p className="text-gray-500">No data entries for this customer.</p>
            )}
          </GlassCard>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CustomerDetailModal;