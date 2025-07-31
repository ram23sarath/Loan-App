
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { UsersIcon, Trash2Icon, FileDownIcon, SpinnerIcon } from '../../constants';
import CustomerDetailModal from '../modals/CustomerDetailModal';
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
  const { customers, loans, subscriptions, installments, deleteCustomer, deleteLoan, deleteSubscription, deleteInstallment, isRefreshing } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('date-desc');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const handleDeleteCustomer = async (customer: Customer) => {
    if (window.confirm(`Are you sure you want to delete ${customer.name}? This will also delete all associated loans, subscriptions, and installments.`)) {
        try {
            await deleteCustomer(customer.id);
        } catch (error: any) {
            alert(error.message);
        }
    }
  };

  const handleComprehensiveExport = () => {
    const customerSummaryData = customers.map(customer => {
      const customerLoans = loans.filter(l => l.customer_id === customer.id);
      const customerSubscriptions = subscriptions.filter(s => s.customer_id === customer.id);
      const totalLoanAmount = customerLoans.reduce((acc, loan) => acc + loan.original_amount, 0);
      const totalInterest = customerLoans.reduce((acc, loan) => acc + loan.interest_amount, 0);
      const totalSubscriptionAmount = customerSubscriptions.reduce((acc, sub) => acc + sub.amount, 0);
      return { 
        'Customer ID': customer.id, 
        'Name': customer.name, 
        'Phone Number': customer.phone, 
        'Total Loan Amount': totalLoanAmount, 
        'Total Interest': totalInterest, 
        'Total Subscription Amount': totalSubscriptionAmount 
      };
    });
    
    const allLoansData = loans.map(loan => {
      const loanInstallments = installments.filter(i => i.loan_id === loan.id);
      const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
      const totalRepayable = loan.original_amount + loan.interest_amount;
      const isPaidOff = amountPaid >= totalRepayable;
      return { 
        'Loan ID': loan.id, 
        'Customer Name': loan.customers?.name ?? 'N/A', 
        'Original Amount': loan.original_amount, 
        'Interest Amount': loan.interest_amount, 
        'Total Repayable': totalRepayable, 'Amount Paid': amountPaid, 
        'Balance': totalRepayable - amountPaid, 
        'Loan Date': loan.payment_date, 
        'Installments': `${loanInstallments.length} / ${loan.total_instalments}`, 
        'Status': isPaidOff ? 'Paid Off' : 'In Progress' 
      };
    });

    const allSubscriptionsData = subscriptions.map(sub => ({ 
        'Subscription ID': sub.id, 
        'Customer Name': sub.customers?.name ?? 'N/A', 
        'Amount': sub.amount, 
        'Year': sub.year, 
        'Date': sub.date, 
        'Receipt': sub.receipt 
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
          'Receipt Number': inst.receipt_number 
      }
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
          <UsersIcon className="w-10 h-10"/>
          <span>All Customers</span>
          {isRefreshing && <SpinnerIcon className="w-8 h-8 animate-spin text-indigo-500" />}
        </h2>
        {customers.length > 0 && (
          <motion.button onClick={handleComprehensiveExport} className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 transition-colors p-3 rounded-lg font-semibold" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <FileDownIcon className="w-5 h-5"/>
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
          <p className="text-center text-gray-500">{searchTerm ? 'No customers match your search.' : 'No customers found. Add one to get started!'}</p>
        </GlassCard>
      ) : (
        <GlassCard className="!p-2">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Interest</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCustomers.map(customer => {
                const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                const totalInterest = customerLoans.reduce((acc, loan) => acc + loan.interest_amount, 0);
                return (
                  <tr key={customer.id} className="bg-white hover:bg-gray-50 transition cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                    <td className="px-4 py-2 font-bold text-indigo-700">{customer.name}</td>
                    <td className="px-4 py-2 text-gray-500">{customer.phone}</td>
                    <td className="px-4 py-2 text-green-600">${totalInterest.toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <motion.button onClick={e => {e.stopPropagation(); handleDeleteCustomer(customer);}} className="p-2 rounded-full hover:bg-red-500/10 transition-colors flex-shrink-0 ml-2" aria-label={`Delete ${customer.name}`} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
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
          />
        )}
      </AnimatePresence>
    </PageWrapper>
  );
};

export default CustomerListPage;
