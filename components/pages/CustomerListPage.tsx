import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { UsersIcon, Trash2Icon, SpinnerIcon } from '../../constants';
import CustomerDetailModal from '../modals/CustomerDetailModal';
import EditModal from '../modals/EditModal';
import type { Customer } from '../../types';

// --- CHANGED: Added Chevron Icon for collapsibles ---
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
  const { customers, loans, subscriptions, installments, dataEntries, deleteCustomer, deleteLoan, deleteSubscription, deleteInstallment, isRefreshing, signOut, updateCustomer, updateLoan, updateSubscription } = useData();
    const [deleteCustomerTarget, setDeleteCustomerTarget] = React.useState<{id: string, name: string} | null>(null);
    const [deleteCounts, setDeleteCounts] = React.useState<{ dataEntries: number; loans: number; installments: number; subscriptions: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('date-desc');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editModal, setEditModal] = useState<{ type: 'customer' | 'loan' | 'subscription' | 'customer_loan'; data: any } | null>(null);

  // --- CHANGED: Added state for collapsible sections ---
  const [expandedSections, setExpandedSections] = useState({
    both: true,
    loans: false,
    subs: false,
    neither: false,
  });

  // --- CHANGED: Added pagination state for each section ---
  const [currentPages, setCurrentPages] = useState({
    both: 1,
    loans: 1,
    subs: 1,
    neither: 1,
  });

  const itemsPerPage = 25;

  const toggleSection = (key: 'both' | 'loans' | 'subs' | 'neither') => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setCurrentPage = (section: 'both' | 'loans' | 'subs' | 'neither', page: number) => {
    setCurrentPages(prev => ({ ...prev, [section]: page }));
  };

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
        // Compute dependent counts to show in the confirmation modal
        const cid = customer.id;
        const dataEntriesCount = dataEntries.filter(d => d.customer_id === cid).length;
        const customerLoans = loans.filter(l => l.customer_id === cid);
        const loansCount = customerLoans.length;
        const loanIds = customerLoans.map(l => l.id);
        const installmentsCount = installments.filter(i => loanIds.includes(i.loan_id)).length;
        const subscriptionsCount = subscriptions.filter(s => s.customer_id === cid).length;
        setDeleteCounts({ dataEntries: dataEntriesCount, loans: loansCount, installments: installmentsCount, subscriptions: subscriptionsCount });
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
    const withNeither: Customer[] = [];

    processedCustomers.forEach(customer => {
      const hasLoans = loans.some(l => l.customer_id === customer.id);
      const hasSubscriptions = subscriptions.some(s => s.customer_id === customer.id);

            if (hasLoans && hasSubscriptions) {
        withBoth.push(customer);
            } else if (hasLoans) {
        withOnlyLoans.push(customer);
            } else if (hasSubscriptions) {
        withOnlySubscriptions.push(customer);
            } else {
                // Customers without loans or subscriptions should still be visible
                withNeither.push(customer);
      }
    });

        return { withOnlyLoans, withOnlySubscriptions, withBoth, withNeither };
  }, [customers, loans, subscriptions, searchTerm, sortOption]);
  
  // --- CHANGED: Removed the standardized TableHeader component ---
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // --- CHANGED: Animation variants for collapse ---
  const collapseVariants = {
    open: { opacity: 1, height: 'auto', overflow: 'hidden' },
    collapsed: { opacity: 0, height: 0, overflow: 'hidden' }
  };

  // --- CHANGED: Pagination controls component ---
  const PaginationControls = ({ section, totalItems }: { section: 'both' | 'loans' | 'subs' | 'neither', totalItems: number }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const currentPage = currentPages[section];

    if (totalPages <= 1) return null;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} customers
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={() => setCurrentPage(section, 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage(section, Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
                  onClick={() => setCurrentPage(section, page)}
                  className={`px-3 py-1 rounded border ${
                    currentPage === page
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              );
            }
            if (page === 2 && currentPage > 3) {
              return <span key="dots-start" className="px-2">...</span>;
            }
            if (page === totalPages - 1 && currentPage < totalPages - 2) {
              return <span key="dots-end" className="px-2">...</span>;
            }
            return null;
          })}
          
          <button
            onClick={() => setCurrentPage(section, Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(section, totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
        <h2 className="text-xl sm:text-4xl font-bold flex items-center gap-2 sm:gap-4">
          <UsersIcon className="w-7 h-7 sm:w-10 sm:h-10" />
          <span>All Customers</span>
          <span className="ml-2 text-xl sm:text-4xl font-bold text-gray-400">({customers.length})</span>
          {isRefreshing && <SpinnerIcon className="w-5 h-5 sm:w-8 sm:h-8 animate-spin text-indigo-500" />}
        </h2>
      </div>

      {customers.length > 0 && (
        <GlassCard className="mb-8 !p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative w-full md:w-1/2">
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg py-2 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
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
      categorizedCustomers.withNeither.length === 0 &&
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
            <GlassCard className="!p-0 bg-indigo-50 border-indigo-200 overflow-hidden">
              {/* --- CHANGED: Header is now a button --- */}
              <button
                onClick={() => toggleSection('both')}
                className="w-full flex justify-between items-center p-2 sm:p-4"
              >
                <h3 className="text-xl font-bold text-indigo-800 flex items-center gap-1"><UsersIcon className="w-5 h-5 mr-1"/>Customers with Loans & Subscriptions</h3>
                <ChevronDownIcon className={`w-6 h-6 text-indigo-800 transition-transform ${expandedSections.both ? 'rotate-180' : ''}`} />
              </button>
              {/* --- CHANGED: Collapsible Content --- */}
              <AnimatePresence initial={false}>
                {expandedSections.both && (
                  <motion.div
                    key="content"
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={collapseVariants}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                  >
                    <div className="p-2 sm:p-4 pt-0">
                      {/* Pagination for withBoth */}
                      {(() => {
                        const totalPages = Math.ceil(categorizedCustomers.withBoth.length / itemsPerPage);
                        const start = (currentPages.both - 1) * itemsPerPage;
                        const end = start + itemsPerPage;
                        const paginatedCustomers = categorizedCustomers.withBoth.slice(start, end);
                        return (
                          <>
                            {/* Desktop Table */}
                            <div className="hidden sm:block">
                              {/* --- CHANGED: Reverted table header --- */}
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Loans</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Loan Value</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Subscriptions</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedCustomers.map((customer, idx) => {
                                      const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                                      const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                                      const loanValue = customerLoans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0);
                                      return (
                                          <motion.tr key={customer.id} className="bg-white hover:bg-indigo-50/50 transition cursor-pointer" onClick={() => setSelectedCustomer(customer)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                                              {/* --- CHANGED: Reverted table row --- */}
                                              <td className="px-4 py-2 font-bold text-indigo-700">{customer.name}</td>
                                              <td className="px-4 py-2 text-gray-500">{customer.phone}</td>
                                              <td className="px-4 py-2 text-gray-700">{customerLoans.length}</td>
                                              <td className="px-4 py-2 text-green-600">{formatCurrency(loanValue)}</td>
                                              <td className="px-4 py-2 text-cyan-600">{customerSubscriptions.length}</td>
                                              <td className="px-4 py-2">
                                                <div className="flex justify-center gap-2">
                                                  <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer, loan: customerLoans[0] || {}, subscription: customerSubscriptions[0] || {} } }); }} className="p-2 rounded-full hover:bg-blue-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><span className="text-blue-600 font-bold">Edit</span></motion.button>
                                                  <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                                                </div>
                                              </td>
                                          </motion.tr>
                                      );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {/* Mobile Cards (unchanged) */}
                            <div className="sm:hidden space-y-3">
                              {paginatedCustomers.map((customer, idx) => {
                                  const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                                  const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                                  const loanValue = customerLoans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0);
                                  return (
                                      <motion.div key={customer.id} className="bg-white rounded-xl shadow border border-gray-100 p-3" onClick={() => setSelectedCustomer(customer)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                                          <div className="grid grid-cols-3 gap-3 items-start">
                                              <div className="col-span-2">
                                                  <div className="text-base font-bold text-indigo-700">{customer.name}</div>
                                                  <div className="text-xs text-gray-500">{customer.phone}</div>
                                                  <div className="mt-2 text-sm text-gray-700 space-y-1">
                                                      <div className="flex justify-between"><span className="text-gray-600">Loans</span><span className="font-semibold">{customerLoans.length}</span></div>
                                                      <div className="flex justify-between"><span className="text-gray-600">Loan Value</span><span className="font-semibold">{formatCurrency(loanValue)}</span></div>
                                                      <div className="flex justify-between"><span className="text-gray-600">Subscriptions</span><span className="font-semibold">{customerSubscriptions.length}</span></div>
                                                  </div>
                                              </div>
                                              <div className="flex flex-col items-end justify-between">
                                                  <div className="flex gap-2">
                                                      <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer, loan: customerLoans[0] || {}, subscription: customerSubscriptions[0] || {} } }); }} className="px-3 py-1 rounded bg-white border border-gray-200 text-blue-600 font-bold text-sm" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Edit</motion.button>
                                                      <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                                                  </div>
                                              </div>
                                          </div>
                                      </motion.div>
                                  );
                              })}
                            </div>
                            {/* Pagination Controls */}
                            <PaginationControls section="both" totalItems={categorizedCustomers.withBoth.length} />
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
            <GlassCard className="!p-0 bg-blue-50 border-blue-200 overflow-hidden">
              {/* --- CHANGED: Header is now a button --- */}
              <button
                onClick={() => toggleSection('loans')}
                className="w-full flex justify-between items-center p-2 sm:p-4"
              >
                <h3 className="text-xl font-bold text-blue-800 flex items-center gap-1"><UsersIcon className="w-5 h-5 mr-1"/>Customers with Only Loans</h3>
                <ChevronDownIcon className={`w-6 h-6 text-blue-800 transition-transform ${expandedSections.loans ? 'rotate-180' : ''}`} />
              </button>
              {/* --- CHANGED: Collapsible Content --- */}
              <AnimatePresence initial={false}>
                {expandedSections.loans && (
                  <motion.div
                    key="content"
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={collapseVariants}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                  >
                    <div className="p-2 sm:p-4 pt-0">
                      {/* Pagination for withOnlyLoans */}
                      {(() => {
                        const totalPages = Math.ceil(categorizedCustomers.withOnlyLoans.length / itemsPerPage);
                        const start = (currentPages.loans - 1) * itemsPerPage;
                        const end = start + itemsPerPage;
                        const paginatedCustomers = categorizedCustomers.withOnlyLoans.slice(start, end);
                        return (
                          <>
                            {/* Desktop Table */}
                            <div className="hidden sm:block">
                              {/* --- CHANGED: Reverted table header --- */}
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Loans</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Loan Value</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedCustomers.map((customer, idx) => {
                                      const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                                      const loanValue = customerLoans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0);
                                      return (
                                          <motion.tr key={customer.id} className="bg-white hover:bg-blue-50/50 transition cursor-pointer" onClick={() => setSelectedCustomer(customer)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                                              {/* --- CHANGED: Reverted table row --- */}
                                              <td className="px-4 py-2 font-bold text-indigo-700">{customer.name}</td>
                                              <td className="px-4 py-2 text-gray-500">{customer.phone}</td>
                                              <td className="px-4 py-2 text-gray-700">{customerLoans.length}</td>
                                              <td className="px-4 py-2 text-green-600">{formatCurrency(loanValue)}</td>
                                              <td className="px-4 py-2">
                                                <div className="flex justify-center gap-2">
                                                  <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer, loan: customerLoans[0] || {} } }); }} className="p-2 rounded-full hover:bg-blue-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><span className="text-blue-600 font-bold">Edit</span></motion.button>
                                                  <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                                                </div>
                                              </td>
                                          </motion.tr>
                                      );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {/* Mobile Cards (unchanged) */}
                            <div className="sm:hidden space-y-3">
                              {paginatedCustomers.map((customer, idx) => {
                                  const customerLoans = loans.filter(loan => loan.customer_id === customer.id);
                                  const loanValue = customerLoans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0);
                                  return (
                                      <motion.div key={customer.id} className="bg-white rounded-xl shadow border border-gray-100 p-3" onClick={() => setSelectedCustomer(customer)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                                          <div className="grid grid-cols-3 gap-3 items-start">
                                              <div className="col-span-2">
                                                  <div className="text-base font-bold text-indigo-700">{customer.name}</div>
                                                  <div className="text-xs text-gray-500">{customer.phone}</div>
                                                  <div className="mt-2 text-sm text-gray-700">
                                                      <div className="flex justify-between"><span className="text-gray-600">Loans</span><span className="font-semibold">{customerLoans.length}</span></div>
                                                      <div className="flex justify-between"><span className="text-gray-600">Loan Value</span><span className="font-semibold">{formatCurrency(loanValue)}</span></div>
                                                  </div>
                                              </div>
                                              <div className="flex flex-col items-end justify-between">
                                                  <div className="flex gap-2">
                                                      <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer, loan: customerLoans[0] || {} } }); }} className="px-3 py-1 rounded bg-white border border-gray-200 text-blue-600 font-bold text-sm" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Edit</motion.button>
                                                      <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                                                  </div>
                                              </div>
                                          </div>
                                      </motion.div>
                                  );
                              })}
                            </div>
                            {/* Pagination Controls */}
                            <PaginationControls section="loans" totalItems={categorizedCustomers.withOnlyLoans.length} />
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
            <GlassCard className="!p-0 bg-cyan-50 border-cyan-200 overflow-hidden">
              {/* --- CHANGED: Header is now a button --- */}
              <button
                onClick={() => toggleSection('subs')}
                className="w-full flex justify-between items-center p-2 sm:p-4"
              >
                <h3 className="text-xl font-bold text-cyan-800 flex items-center gap-1"><UsersIcon className="w-5 h-5 mr-1"/>Customers with Only Subscriptions</h3>
                <ChevronDownIcon className={`w-6 h-6 text-cyan-800 transition-transform ${expandedSections.subs ? 'rotate-180' : ''}`} />
              </button>
              {/* --- CHANGED: Collapsible Content --- */}
              <AnimatePresence initial={false}>
                {expandedSections.subs && (
                  <motion.div
                    key="content"
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={collapseVariants}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                  >
                    <div className="p-2 sm:p-4 pt-0">
                      {/* Pagination for withOnlySubscriptions */}
                      {(() => {
                        const totalPages = Math.ceil(categorizedCustomers.withOnlySubscriptions.length / itemsPerPage);
                        const start = (currentPages.subs - 1) * itemsPerPage;
                        const end = start + itemsPerPage;
                        const paginatedCustomers = categorizedCustomers.withOnlySubscriptions.slice(start, end);
                        return (
                          <>
                            {/* Desktop Table */}
                            <div className="hidden sm:block">
                              {/* --- CHANGED: Reverted table header --- */}
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Subscriptions</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Total Value</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedCustomers.map((customer, idx) => {
                                      const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                                      const subValue = customerSubscriptions.reduce((acc, sub) => acc + sub.amount, 0);
                                      return (
                                          <motion.tr key={customer.id} className="bg-white hover:bg-cyan-50/50 transition cursor-pointer" onClick={() => setSelectedCustomer(customer)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                                              {/* --- CHANGED: Reverted table row --- */}
                                              <td className="px-4 py-2 font-bold text-indigo-700">{customer.name}</td>
                                              <td className="px-4 py-2 text-gray-500">{customer.phone}</td>
                                              <td className="px-4 py-2 text-cyan-600">{customerSubscriptions.length}</td>
                                              <td className="px-4 py-2 text-cyan-600">{formatCurrency(subValue)}</td>
                                              <td className="px-4 py-2">
                                                <div className="flex justify-center gap-2">
                                                  <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer, subscription: customerSubscriptions[0] || {} } }); }} className="p-2 rounded-full hover:bg-blue-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><span className="text-blue-600 font-bold">Edit</span></motion.button>
                                                  <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                                                </div>
                                              </td>
                                          </motion.tr>
                                      );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {/* Mobile Cards (unchanged) */}
                            <div className="sm:hidden space-y-3">
                              {paginatedCustomers.map((customer, idx) => {
                                  const customerSubscriptions = subscriptions.filter(sub => sub.customer_id === customer.id);
                                  const subValue = customerSubscriptions.reduce((acc, sub) => acc + sub.amount, 0);
                                  return (
                                      <motion.div key={customer.id} className="bg-white rounded-xl shadow border border-gray-100 p-3" onClick={() => setSelectedCustomer(customer)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                                          <div className="grid grid-cols-3 gap-3 items-start">
                                              <div className="col-span-2">
                                                  <div className="text-base font-bold text-indigo-700">{customer.name}</div>
                                                  <div className="text-xs text-gray-500">{customer.phone}</div>
                                                  <div className="mt-2 text-sm text-gray-700">
                                                      <div className="flex justify-between"><span className="text-gray-600">Subscriptions</span><span className="font-semibold">{customerSubscriptions.length}</span></div>
                                                      <div className="flex justify-between"><span className="text-gray-600">Total Value</span><span className="font-semibold">{formatCurrency(subValue)}</span></div>
                                                  </div>
                                              </div>
                                              <div className="flex flex-col items-end justify-between">
                                                  <div className="flex gap-2">
                                                      <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer, subscription: customerSubscriptions[0] || {} } }); }} className="px-3 py-1 rounded bg-white border border-gray-200 text-blue-600 font-bold text-sm" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Edit</motion.button>
                                                      <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                                                  </div>
                                              </div>
                                          </div>
                                      </motion.div>
                                  );
                              })}
                            </div>
                            {/* Pagination Controls */}
                            <PaginationControls section="subs" totalItems={categorizedCustomers.withOnlySubscriptions.length} />
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
          {categorizedCustomers.withNeither && categorizedCustomers.withNeither.length > 0 && (
              <GlassCard className="!p-0 bg-gray-50 border-gray-200 overflow-hidden">
                {/* --- CHANGED: Header is now a button --- */}
                <button
                  onClick={() => toggleSection('neither')}
                  className="w-full flex justify-between items-center p-2 sm:p-4"
                >
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-1"><UsersIcon className="w-5 h-5 mr-1"/>Customers with No Records</h3>
                  <ChevronDownIcon className={`w-6 h-6 text-gray-800 transition-transform ${expandedSections.neither ? 'rotate-180' : ''}`} />
                </button>
                {/* --- CHANGED: Collapsible Content --- */}
                <AnimatePresence initial={false}>
                  {expandedSections.neither && (
                    <motion.div
                      key="content"
                      initial="collapsed"
                      animate="open"
                      exit="collapsed"
                      variants={collapseVariants}
                      transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    >
                      <div className="p-2 sm:p-4 pt-0">
                        {/* Pagination for withNeither */}
                        {(() => {
                          const totalPages = Math.ceil(categorizedCustomers.withNeither.length / itemsPerPage);
                          const start = (currentPages.neither - 1) * itemsPerPage;
                          const end = start + itemsPerPage;
                          const paginatedCustomers = categorizedCustomers.withNeither.slice(start, end);
                          return (
                            <>
                              {/* Desktop Table */}
                              <div className="hidden sm:block">
                                {/* --- CHANGED: Reverted table header --- */}
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead>
                                      <tr>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Actions</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {paginatedCustomers.map((customer, idx) => (
                                          <motion.tr key={customer.id} className="bg-white hover:bg-gray-50/50 transition cursor-pointer" onClick={() => setSelectedCustomer(customer)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                                              {/* --- CHANGED: Reverted table row --- */}
                                              <td className="px-4 py-2 font-bold text-indigo-700">{customer.name}</td>
                                              <td className="px-4 py-2 text-gray-500">{customer.phone}</td>
                                              <td className="px-4 py-2">
                                                <div className="flex justify-center gap-2">
                                                  <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer } }); }} className="p-2 rounded-full hover:bg-blue-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><span className="text-blue-600 font-bold">Edit</span></motion.button>
                                                  <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                                                </div>
                                              </td>
                                          </motion.tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                              {/* Mobile Cards (unchanged) */}
                              <div className="sm:hidden space-y-3">
                                  {paginatedCustomers.map((customer, idx) => (
                                      <motion.div key={customer.id} className="bg-white rounded-xl shadow border border-gray-100 p-3" onClick={() => setSelectedCustomer(customer)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                                          <div className="grid grid-cols-3 gap-3 items-start">
                                              <div className="col-span-2">
                                                  <div className="text-base font-bold text-indigo-700">{customer.name}</div>
                                                  <div className="text-xs text-gray-500">{customer.phone}</div>
                                              </div>
                                              <div className="flex flex-col items-end justify-between">
                                                  <div className="flex gap-2">
                                                      <motion.button onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'customer_loan', data: { customer } }); }} className="px-3 py-1 rounded bg-white border border-gray-200 text-blue-600 font-bold text-sm" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Edit</motion.button>
                                                      <motion.button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }} className="p-2 rounded-full hover:bg-red-500/10" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}><Trash2Icon className="w-5 h-5 text-red-500" /></motion.button>
                                                  </div>
                                              </div>
                                          </div>
                                      </motion.div>
                                  ))}
                              </div>
                              {/* Pagination Controls */}
                              <PaginationControls section="neither" totalItems={categorizedCustomers.withNeither.length} />
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
          loans={loans.filter(l => l.customer_id === selectedCustomer.id)}
          subscriptions={subscriptions.filter(s => s.customer_id === selectedCustomer.id)}
          installments={installments}
          dataEntries={dataEntries.filter(d => d.customer_id === selectedCustomer.id)}
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
                    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Confirm Deletion</h3>
                        <p className="mb-4">You're about to delete <span className="font-semibold">{deleteCustomerTarget.name}</span>. The following related records will be removed:</p>
                        <ul className="mb-4 list-disc list-inside text-sm text-gray-700">
                            <li>Data entries: <span className="font-semibold">{deleteCounts?.dataEntries ?? 0}</span></li>
                            <li>Loans: <span className="font-semibold">{deleteCounts?.loans ?? 0}</span></li>
                            <li>Installments (for loans above): <span className="font-semibold">{deleteCounts?.installments ?? 0}</span></li>
                            <li>Subscriptions: <span className="font-semibold">{deleteCounts?.subscriptions ?? 0}</span></li>
                        </ul>
                        <p className="text-sm text-red-600 mb-4">This action is irreversible. Please ensure you have a backup if needed.</p>
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