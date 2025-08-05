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

  const categorizedCustomers = useMemo(() => {
    let processedCustomers = [...customers];

    // Apply sorting
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

    // Apply search filter
    if (searchTerm) {
      processedCustomers = processedCustomers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm)
      );
    }

    // Categorize customers
    const withOnlyLoans: Customer[] = [];
    const withOnlySubscriptions: Customer[] = [];
    const withBoth: Customer[] = [];

    processedCustomers.forEach(customer => {
      const hasLoans = loans.some(l => l.customer_id === customer.id);
      const hasSubscriptions = subscriptions.some(s => s.customer_id === customer.id);

      if (hasLoans && hasSubscriptions) {
        withBoth.push(customer);
      } else if (hasLoans) {
        withOnlyLoans.push(customer);
      } else if (hasSubscriptions) {
        withOnlySubscriptions.push(customer);
      }
    });

    return { withOnlyLoans, withOnlySubscriptions, withBoth };
  }, [customers, loans, subscriptions, searchTerm, sortOption]);

  return (
    <PageWrapper>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4 sm:gap-0 px-2 sm:px-0">
        <h2 className="text-xl sm:text-4xl font-bold flex items-center gap-2 sm:gap-4">
          <UsersIcon className="w-7 h-7 sm:w-10 sm:h-10" />
          <span>All Customers</span>
          {isRefreshing && <SpinnerIcon className="w-5 h-5 sm:w-8 sm:h-8 animate-spin text-indigo-500" />}
        </h2>
        {customers.length > 0 && (
          <motion.button
            onClick={handleComprehensiveExport}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 transition-colors p-2 sm:p-3 rounded-lg font-semibold text-xs sm:text-base"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FileDownIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Export Comprehensive Report</span>
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
      
      {categorizedCustomers.withBoth.length === 0 &&
       categorizedCustomers.withOnlyLoans.length === 0 &&
       categorizedCustomers.withOnlySubscriptions.length === 0 &&
       !isRefreshing ? (
        <GlassCard>
          <p className="text-center text-gray-500">
            {searchTerm ? 'No customers match your search.' : 'No customers found. Add one to get started!'}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-8">
          {/* Section: Customers with Both */}
          {categorizedCustomers.withBoth.length > 0 && (
            <GlassCard className="!p-2 sm:!p-4 bg-indigo-50 border-indigo-200">
              <h3 className="text-xl font-bold mb-4 px-2 text-indigo-800 flex items-center gap-1"><UsersIcon className="w-5 h-5 mr-1"/>Customers with Loans & Subscriptions</h3>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Total Loan Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Subscriptions</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorizedCustomers.withBoth.map(customer => {
                        const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                        const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                        return (
                          <tr key={customer.id} className="bg-white hover:bg-indigo-50/50 transition cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                            <td className="px-4 py-2 font-bold text-indigo-700">{customer.name}</td>
                            <td className="px-4 py-2 text-gray-500">{customer.phone}</td>
                            <td className="px-4 py-2 text-green-600">
                                {customerLoans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                            </td>
                            <td className="px-4 py-2 text-cyan-600">
                                {customerSubscriptions.length} Active
                            </td>
                            <td className="px-4 py-2 flex justify-center gap-2">
                                <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer, loan: customerLoans[0] || {}, subscription: customerSubscriptions[0] || {} } }); }} className="p-2 rounded-full hover:bg-blue-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><span className="text-blue-600 font-bold">Edit</span></motion.button>
                                <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                            </td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {categorizedCustomers.withBoth.map(customer => {
                    const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                    return (
                        <div key={customer.id} className="bg-white rounded-xl shadow border border-gray-100 p-3 flex flex-col gap-2" onClick={() => setSelectedCustomer(customer)}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-700 text-base">{customer.name}</span>
                            <span className="text-xs text-gray-500">{customer.phone}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-green-600 text-xs">Loan: {customerLoans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                            <span className="text-cyan-600 text-xs">Subscriptions: {customerSubscriptions.length}</span>
                          </div>
                        </div>
                    );
                })}
              </div>
            </GlassCard>
          )}

          {/* Section: Customers with Only Loans */}
          {categorizedCustomers.withOnlyLoans.length > 0 && (
            <GlassCard className="!p-2 sm:!p-4 bg-blue-50 border-blue-200">
              <h3 className="text-xl font-bold mb-4 px-2 text-blue-800 flex items-center gap-1"><UsersIcon className="w-5 h-5 mr-1"/>Customers with Only Loans</h3>
               {/* Desktop Table */}
              <div className="hidden sm:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Total Loan Amount</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorizedCustomers.withOnlyLoans.map(customer => {
                        const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                        return (
                          <tr key={customer.id} className="bg-white hover:bg-blue-50/50 transition cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                            <td className="px-4 py-2 font-bold text-indigo-700">{customer.name}</td>
                            <td className="px-4 py-2 text-gray-500">{customer.phone}</td>
                            <td className="px-4 py-2 text-green-600">
                                {customerLoans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                            </td>
                            <td className="px-4 py-2 flex justify-center gap-2">
                                <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer, loan: customerLoans[0] || {} } }); }} className="p-2 rounded-full hover:bg-blue-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><span className="text-blue-600 font-bold">Edit</span></motion.button>
                                <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                            </td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {categorizedCustomers.withOnlyLoans.map(customer => {
                    const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                    return (
                        <div key={customer.id} className="bg-white rounded-xl shadow border border-gray-100 p-3 flex flex-col gap-2" onClick={() => setSelectedCustomer(customer)}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-700 text-base">{customer.name}</span>
                  _         <span className="text-xs text-gray-500">{customer.phone}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-green-600 text-xs">Loan: {customerLoans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                          </div>
                        </div>
                    );
                })}
              </div>
            </GlassCard>
          )}

          {/* Section: Customers with Only Subscriptions */}
          {categorizedCustomers.withOnlySubscriptions.length > 0 && (
            <GlassCard className="!p-2 sm:!p-4 bg-cyan-50 border-cyan-200">
              <h3 className="text-xl font-bold mb-4 px-2 text-cyan-800 flex items-center gap-1"><UsersIcon className="w-5 h-5 mr-1"/>Customers with Only Subscriptions</h3>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Total Subscription Value</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorizedCustomers.withOnlySubscriptions.map(customer => {
                        const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                        return (
                          <tr key={customer.id} className="bg-white hover:bg-cyan-50/50 transition cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                            <td className="px-4 py-2 font-bold text-indigo-700">{customer.name}</td>
                            <td className="px-4 py-2 text-gray-500">{customer.phone}</td>
                            <td className="px-4 py-2 text-cyan-600">
                                {customerSubscriptions.reduce((acc, sub) => acc + sub.amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                            </td>
                            <td className="px-4 py-2 flex justify-center gap-2">
                                <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer, subscription: customerSubscriptions[0] || {} } }); }} className="p-2 rounded-full hover:bg-blue-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><span className="text-blue-600 font-bold">Edit</span></motion.button>
                                <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                            </td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
               {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {categorizedCustomers.withOnlySubscriptions.map(customer => {
                    const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                    return (
                        <div key={customer.id} className="bg-white rounded-xl shadow border border-gray-100 p-3 flex flex-col gap-2" onClick={() => setSelectedCustomer(customer)}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-700 text-base">{customer.name}</span>
                            <span className="text-xs text-gray-500">{customer.phone}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-cyan-600 text-xs">Subscriptions: {customerSubscriptions.reduce((acc, sub) => acc + sub.amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                          </div>
                        </div>
                    );
                })}
              </div>
            </GlassCard>
          )}
        </div>
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