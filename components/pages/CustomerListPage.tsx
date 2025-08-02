import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { UsersIcon, Trash2Icon, FileDownIcon, SpinnerIcon } from '../../constants';
import CustomerDetailModal from '../modals/CustomerDetailModal';
import EditModal from '../modals/EditModal';
import type { Customer } from '../../types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const CustomerListPage = () => {
  const { customers, loans, subscriptions, installments, deleteCustomer, deleteLoan, deleteSubscription, deleteInstallment, isRefreshing, signOut, updateCustomer, updateLoan, updateSubscription } = useData();
  const [deleteCustomerTarget, setDeleteCustomerTarget] = React.useState<{id: string, name: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('date-desc');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editModal, setEditModal] = useState<{ type: 'customer' | 'loan' | 'subscription' | 'customer_loan'; data: any } | null>(null);

  // Auto logout after 30 minutes of inactivity
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        signOut();
        alert('You have been logged out due to inactivity.');
      }, 30 * 60 * 1000); // 30 minutes
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [signOut]);

  const handleDeleteCustomer = (customer) => {
    setDeleteCustomerTarget({ id: customer.id, name: customer.name });
  };

  const confirmDeleteCustomer = async () => {
    if (deleteCustomerTarget) {
      try {
        await deleteCustomer(deleteCustomerTarget.id);
        setDeleteCustomerTarget(null);
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const cancelDeleteCustomer = () => {
    setDeleteCustomerTarget(null);
  };

  const handleComprehensiveExport = () => {
    const customerSummaryData = customers.map(customer => {
      const customerLoans = loans.filter(l => l.customer_id === customer.id);
      const customerSubscriptions = subscriptions.filter(s => s.customer_id === customer.id);
      const originalAmount = customerLoans.reduce((acc, loan) => acc + loan.original_amount, 0);
      const interestAmount = customerLoans.reduce((acc, loan) => acc + loan.interest_amount, 0);
      const totalAmount = originalAmount + interestAmount;
      const subscriptionAmount = customerSubscriptions.reduce((acc, sub) => acc + sub.amount, 0);
      return {
        'Name': customer.name,
        'Phone Number': customer.phone,
        'Original Amount': originalAmount,
        'Interest Amount': interestAmount,
        'Total Amount': totalAmount,
        'Subscription Amount': subscriptionAmount,
      };
    });

    const allLoansData = loans.map(loan => {
      const loanInstallments = installments.filter(i => i.loan_id === loan.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let amountPaid = 0;
      let principalPaid = 0;
      let interestCollected = 0;

      for (const inst of loanInstallments) {
        amountPaid += inst.amount;

        if (principalPaid < loan.original_amount) {
          const principalPortion = Math.min(inst.amount, loan.original_amount - principalPaid);
          principalPaid += principalPortion;
          const interestPortion = inst.amount - principalPortion;
          interestCollected += interestPortion;
        } else {
          interestCollected += inst.amount;
        }
      }

      const totalRepayable = loan.original_amount + loan.interest_amount;
      const isPaidOff = amountPaid >= totalRepayable;

      return {
        'Loan ID': loan.id,
        'Customer Name': loan.customers?.name ?? 'N/A',
        'Original Amount': loan.original_amount,
        'Interest Amount': loan.interest_amount,
        'Total Repayable': totalRepayable,
        'Amount Paid': amountPaid,
        'Principal Paid': principalPaid,
        'Interest Collected': interestCollected,
        'Balance': totalRepayable - amountPaid,
        'Loan Date': loan.payment_date,
        'Installments': `${loanInstallments.length} / ${loan.total_instalments}`,
        'Status': isPaidOff ? 'Paid Off' : 'In Progress',
      };
    });

    const allSubscriptionsData = subscriptions.map(sub => ({
      'Subscription ID': sub.id,
      'Customer Name': sub.customers?.name ?? 'N/A',
      'Amount': sub.amount,
      'Year': sub.year,
      'Date': sub.date,
      'Receipt': sub.receipt,
    }));

    const allInstallmentsData = installments.map(inst => {
      const parentLoan = loans.find(l => l.id === inst.loan_id);
      return {
        'Installment ID': inst.id,
        'Loan ID': inst.loan_id,
        'Customer Name': parentLoan?.customers?.name ?? 'N/A',
        'Installment Number': inst.installment_number,
        'Amount Paid': inst.amount,
        'Payment Date': inst.date,
        'Receipt Number': inst.receipt_number,
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerSummaryData), 'Customer Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allLoansData), 'All Loans');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allSubscriptionsData), 'All Subscriptions');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allInstallmentsData), 'All Installments');
    XLSX.writeFile(wb, 'Comprehensive_Data_Report.xlsx');
  };

  const filteredAndSortedCustomers = useMemo(() => {
    let processedCustomers = [...customers];

    processedCustomers.sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date-desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    if (searchTerm) {
      return processedCustomers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm)
      );
    }

    return processedCustomers;
  }, [customers, searchTerm, sortOption]);

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-4xl font-bold flex items-center gap-4">
          <UsersIcon className="w-10 h-10" />
          <span>All Customers</span>
          {isRefreshing && <SpinnerIcon className="w-8 h-8 animate-spin text-indigo-500" />}
        </h2>
        {customers.length > 0 && (
          <motion.button
            onClick={handleComprehensiveExport}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 transition-colors p-3 rounded-lg font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FileDownIcon className="w-5 h-5" />
            Export Comprehensive Report
          </motion.button>
        )}
      </div>

      {customers.length > 0 && (
        <GlassCard className="mb-8 !p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-1/2 bg-white border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
            />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="w-full md:w-1/2 bg-white border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="date-desc">Sort by Date (Newest First)</option>
              <option value="date-asc">Sort by Date (Oldest First)</option>
              <option value="name-asc">Sort by Name (A-Z)</option>
              <option value="name-desc">Sort by Name (Z-A)</option>
            </select>
          </div>
        </GlassCard>
      )}

      {filteredAndSortedCustomers.length === 0 && !isRefreshing ? (
        <GlassCard>
          <p className="text-center text-gray-500">
            {searchTerm ? 'No customers match your search.' : 'No customers found. Add one to get started!'}
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="!p-2">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Total Loan Amount</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Subscriptions</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCustomers.map(customer => {
                const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                let totalPrincipalPaid = 0;
                let totalInterestCollected = 0;
                customerLoans.forEach(loan => {
                  // Get all installments for this loan, sorted by date
                  const loanInstallments = installments
                    .filter(i => i.loan_id === loan.id)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  
                  // Calculate total amount paid through installments
                  const totalPaidForLoan = loanInstallments.reduce((sum, inst) => sum + inst.amount, 0);
                  
                  // Add to principal paid (capped at original amount)
                  const principalPaidForLoan = Math.min(totalPaidForLoan, loan.original_amount);
                  totalPrincipalPaid += principalPaidForLoan;
                  
                  // Only if total paid exceeds original amount, count the excess as interest
                  if (totalPaidForLoan > loan.original_amount) {
                    const interestCollectedForLoan = Math.min(
                      totalPaidForLoan - loan.original_amount,
                      loan.interest_amount
                    );
                    totalInterestCollected += interestCollectedForLoan;
                  }
                });
                const totalLoanAmount = customerLoans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0);
                const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                return (
                  <tr
                    key={customer.id}
                    className="bg-white hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td className="px-4 py-2 font-bold text-indigo-700">{customer.name}</td>
                    <td className="px-4 py-2 text-gray-500">{customer.phone}</td>
                    <td className="px-4 py-2 text-green-600">
                      Principal: ₹{totalPrincipalPaid.toLocaleString()}<br />
                      Interest: ₹{totalInterestCollected.toLocaleString()}<br />
                      <span className="text-xs text-gray-500">(Total: ₹{(totalPrincipalPaid + totalInterestCollected).toLocaleString()})</span>
                    </td>
                    <td className="px-4 py-2 text-cyan-600">
                      {customerSubscriptions.length > 0 ? (
                        customerSubscriptions.map(sub => (
                          <div key={sub.id} className="mb-1">
                            <span className="font-semibold">₹{sub.amount.toLocaleString()}</span>{' '}
                            <span className="text-xs text-gray-500">({sub.year})</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-2 flex gap-2">
                      <motion.button
                        onClick={e => {
                          e.stopPropagation();
                          const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                          const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                          setEditModal({ type: 'customer_loan', data: { customer, loan: customerLoans[0] || {}, subscription: customerSubscriptions[0] || {} } });
                        }}
                        className="p-2 rounded-full hover:bg-blue-500/10 transition-colors flex-shrink-0"
                        aria-label={`Edit ${customer.name}`}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <span className="text-blue-600 font-bold">Edit</span>
                      </motion.button>
                      <motion.button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteCustomer(customer);
                        }}
                        className="p-2 rounded-full hover:bg-red-500/10 transition-colors flex-shrink-0"
                        aria-label={`Delete ${customer.name}`}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2Icon className="w-5 h-5 text-red-500" />
                      </motion.button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassCard>
      )}

      <AnimatePresence>
        {selectedCustomer && (
          <CustomerDetailModal
            customer={selectedCustomer}
            loans={loans.filter(l => l.customer_id === selectedCustomer.id)}
            subscriptions={subscriptions.filter(s => s.customer_id === selectedCustomer.id)}
            installments={installments}
            onClose={() => setSelectedCustomer(null)}
            deleteLoan={deleteLoan}
            deleteSubscription={deleteSubscription}
            deleteInstallment={deleteInstallment}
            onEditLoan={(loan) => setEditModal({ type: 'loan', data: loan })}
            onEditSubscription={(sub) => setEditModal({ type: 'subscription', data: sub })}
          />
        )}
      </AnimatePresence>
      {editModal && (
        <EditModal
          type={editModal.type}
          data={editModal.data}
          onSave={async (updated) => {
            try {
              if (editModal.type === 'customer') {
                await updateCustomer(updated.id, { name: updated.name, phone: updated.phone });
              } else if (editModal.type === 'loan') {
                await updateLoan(updated.id, {
                  original_amount: updated.original_amount,
                  interest_amount: updated.interest_amount,
                  payment_date: updated.payment_date,
                  total_instalments: updated.total_instalments,
                });
              } else if (editModal.type === 'subscription') {
                await updateSubscription(updated.id, {
                  amount: updated.amount,
                  year: updated.year,
                  date: updated.date,
                  receipt: updated.receipt,
                });
              } else if (editModal.type === 'customer_loan') {
                await updateCustomer(updated.customer.id, { name: updated.customer.name, phone: updated.customer.phone });
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
              }
              setEditModal(null);
            } catch (err: any) {
              alert(err.message || 'Failed to update record');
            }
          }}
          onClose={() => setEditModal(null)}
        />
      )}
      {deleteCustomerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Delete Customer</h3>
            <p className="mb-6">Are you sure you want to delete <span className="font-semibold">{deleteCustomerTarget.name}</span>? This will also delete all associated loans, subscriptions, and installments.</p>
            <div className="flex justify-end gap-2">
              <button onClick={cancelDeleteCustomer} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
              <button onClick={confirmDeleteCustomer} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
};

export default CustomerListPage;