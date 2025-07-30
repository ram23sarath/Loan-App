

import React from 'react';
import { motion, Variants } from 'framer-motion';
import * as XLSX from 'xlsx';
import type { Customer, LoanWithCustomer, SubscriptionWithCustomer, Installment } from '../../types';
import GlassCard from '../ui/GlassCard';
import { XIcon, FileDownIcon, LandmarkIcon, HistoryIcon, Trash2Icon } from '../../constants';
import { formatDate } from '../../utils/dateFormatter';

interface CustomerDetailModalProps {
  customer: Customer;
  loans: LoanWithCustomer[];
  subscriptions: SubscriptionWithCustomer[];
  installments: Installment[];
  onClose: () => void;
  deleteLoan: (loanId: string) => Promise<void>;
  deleteSubscription: (subscriptionId: string) => Promise<void>;
  deleteInstallment: (installmentId: string) => Promise<void>;
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

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ customer, loans, subscriptions, installments, onClose, deleteLoan, deleteSubscription, deleteInstallment }) => {
  const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
  const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);

  const handleDeleteLoan = async (loan: LoanWithCustomer) => {
    if (window.confirm(`Are you sure you want to delete the loan from ${formatDate(loan.payment_date)}? This will also delete all its installments.`)) {
        try {
            await deleteLoan(loan.id);
        } catch(error: any) {
            alert(error.message);
        }
    }
  };

  const handleDeleteSubscription = async (sub: SubscriptionWithCustomer) => {
    if (window.confirm(`Are you sure you want to delete the subscription for the year ${sub.year}?`)) {
        try {
            await deleteSubscription(sub.id);
        } catch(error: any) {
            alert(error.message);
        }
    }
  };
  
  const handleDeleteInstallment = async (installment: Installment) => {
    if (window.confirm(`Are you sure you want to delete installment #${installment.installment_number}?`)) {
        try {
            await deleteInstallment(installment.id);
        } catch(error: any) {
            alert(error.message);
        }
    }
  };

  const handleIndividualExport = () => {
    const customerLoansData = customerLoans.map(loan => {
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

    const customerSubscriptionsData = customerSubscriptions.map(sub => ({
        'Subscription ID': sub.id,
        'Amount': sub.amount,
        'Year': sub.year,
        'Date': formatDate(sub.date),
        'Receipt': sub.receipt,
    }));
    
    const customerInstallmentsData = installments
        .filter(inst => customerLoans.some(l => l.id === inst.loan_id))
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
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col"
        variants={modalVariants}
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="w-full flex-shrink-0 !p-0">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <div>
                    <h2 className="text-3xl font-bold">{customer.name}</h2>
                    <p className="text-gray-500">{customer.phone}</p>
                </div>
                <div className="flex items-center gap-4">
                    <motion.button onClick={handleIndividualExport} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors p-3 rounded-lg font-semibold" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <FileDownIcon className="w-5 h-5"/> Export Details
                    </motion.button>
                    <motion.button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <XIcon className="w-6 h-6" />
                    </motion.button>
                </div>
            </div>
        </GlassCard>

        <div className="overflow-y-auto mt-4 pr-2">
            {/* Loans Section */}
            <GlassCard className="w-full mb-6">
                <h3 className="text-2xl font-semibold mb-4 flex items-center gap-3"><LandmarkIcon/> Loans</h3>
                {customerLoans.length > 0 ? (
                    <div className="space-y-4">
                        {customerLoans.map(loan => {
                             const loanInstallments = installments.filter(i => i.loan_id === loan.id);
                             const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
                             const totalRepayable = loan.original_amount + loan.interest_amount;
                             const progress = totalRepayable > 0 ? (amountPaid / totalRepayable) * 100 : 0;
                             const isPaidOff = amountPaid >= totalRepayable;
                            return (
                                <div key={loan.id} className="p-4 bg-gray-50 rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-lg">Loan from {formatDate(loan.payment_date)}</p>
                                            <p className="text-xs text-gray-500">Total: ${totalRepayable.toLocaleString()} (${loan.original_amount.toLocaleString()} + ${loan.interest_amount.toLocaleString()} interest)</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <motion.button
                                                onClick={() => handleDeleteLoan(loan)}
                                                className="p-2 rounded-full hover:bg-red-500/10 transition-colors"
                                                aria-label={`Delete loan from ${loan.payment_date}`}
                                                whileHover={{ scale: 1.2 }}
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                <Trash2Icon className="w-5 h-5 text-red-500" />
                                            </motion.button>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 my-2">
                                        <div className={`h-2 rounded-full ${isPaidOff ? 'bg-green-500' : 'bg-indigo-500'}`} style={{width: `${progress}%`}} />
                                    </div>
                                    <div className="text-xs text-gray-500 flex justify-between">
                                        <span>Paid: ${amountPaid.toLocaleString()}</span>
                                        <span>Installments: {loanInstallments.length}/{loan.total_instalments}</span>
                                    </div>
                                    {loanInstallments.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-gray-200 space-y-2">
                                            <h4 className="text-sm font-semibold text-gray-600 mb-1">Recorded Installments:</h4>
                                            {loanInstallments.map(installment => (
                                                <div key={installment.id} className="flex justify-between items-center bg-gray-100 p-2 rounded-md">
                                                    <div>
                                                        <p className="font-medium text-sm">Installment #{installment.installment_number}</p>
                                                        <p className="text-xs text-gray-500">Date: {formatDate(installment.date)} | Receipt: {installment.receipt_number}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                       <p className="font-semibold text-green-600">
                                                            ${installment.amount.toLocaleString()}
                                                            {installment.late_fee && installment.late_fee > 0 && (
                                                                <span className="text-xs text-orange-500 ml-1">(+${installment.late_fee} late)</span>
                                                            )}
                                                       </p>
                                                       <motion.button
                                                            onClick={() => handleDeleteInstallment(installment)}
                                                            className="p-1 rounded-full hover:bg-red-500/10 transition-colors"
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
                            )
                        })}
                    </div>
                ) : <p className="text-gray-500">No loan records for this customer.</p>}
            </GlassCard>
            
            {/* Subscriptions Section */}
            <GlassCard className="w-full">
                <h3 className="text-2xl font-semibold mb-4 flex items-center gap-3"><HistoryIcon/> Subscriptions</h3>
                {customerSubscriptions.length > 0 ? (
                     <div className="space-y-4">
                         {customerSubscriptions.map(sub => (
                             <div key={sub.id} className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                                 <div>
                                     <p className="font-bold">Subscription for {sub.year}</p>
                                     <p className="text-xs text-gray-500">Date: {formatDate(sub.date)} | Receipt: {sub.receipt}</p>
                                 </div>
                                 <div className="flex items-center gap-4">
                                     <p className="font-bold text-xl text-cyan-600">${sub.amount.toLocaleString()}</p>
                                      <motion.button
                                        onClick={() => handleDeleteSubscription(sub)}
                                        className="p-2 rounded-full hover:bg-red-500/10 transition-colors"
                                        aria-label={`Delete subscription for ${sub.year}`}
                                        whileHover={{ scale: 1.2 }}
                                        whileTap={{ scale: 0.9 }}
                                      >
                                        <Trash2Icon className="w-5 h-5 text-red-500" />
                                      </motion.button>
                                 </div>
                             </div>
                         ))}
                    </div>
                ) : <p className="text-gray-500">No subscription records for this customer.</p>}
            </GlassCard>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CustomerDetailModal;
