import React from 'react';
import { motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import { Trash2Icon, WhatsAppIcon } from '../../constants';
import GlassCard from '../ui/GlassCard';
import { formatDate } from '../../utils/dateFormatter';
import type { LoanWithCustomer } from '../../types';


const LoanTableView: React.FC = () => {
  const { loans, installments, deleteInstallment } = useData();
  const [filter, setFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  // Sorting state
  const [sortField, setSortField] = React.useState('');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const filteredLoans = loans.filter(loan => {
    const customerName = loan.customers?.name?.toLowerCase() || '';
    const checkNumber = (loan.check_number || '').toLowerCase();
    const status = (() => {
      const totalRepayable = loan.original_amount + loan.interest_amount;
      const paid = installments.filter(inst => inst.loan_id === loan.id).reduce((acc, inst) => acc + inst.amount, 0);
      return paid >= totalRepayable ? 'Paid Off' : 'In Progress';
    })();
    const matchesText =
      customerName.includes(filter.toLowerCase()) ||
      checkNumber.includes(filter.toLowerCase());
    const matchesStatus = statusFilter === '' || status === statusFilter;
    return matchesText && matchesStatus;
  });

  const sortedLoans = React.useMemo(() => {
    if (!sortField) return filteredLoans;
    return [...filteredLoans].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      switch (sortField) {
        case 'customer':
          aValue = a.customers?.name || '';
          bValue = b.customers?.name || '';
          break;
        case 'loan_amount':
          aValue = a.original_amount;
          bValue = b.original_amount;
          break;
        case 'interest':
          aValue = a.interest_amount;
          bValue = b.interest_amount;
          break;
        case 'total_repayable':
          aValue = a.original_amount + a.interest_amount;
          bValue = b.original_amount + b.interest_amount;
          break;
        case 'paid':
          aValue = installments.filter(inst => inst.loan_id === a.id).reduce((acc, inst) => acc + inst.amount, 0);
          bValue = installments.filter(inst => inst.loan_id === b.id).reduce((acc, inst) => acc + inst.amount, 0);
          break;
        case 'balance':
          aValue = (a.original_amount + a.interest_amount) - installments.filter(inst => inst.loan_id === a.id).reduce((acc, inst) => acc + inst.amount, 0);
          bValue = (b.original_amount + b.interest_amount) - installments.filter(inst => inst.loan_id === b.id).reduce((acc, inst) => acc + inst.amount, 0);
          break;
        case 'check_number':
          aValue = a.check_number || '';
          bValue = b.check_number || '';
          break;
        case 'installments':
          aValue = installments.filter(inst => inst.loan_id === a.id).length;
          bValue = installments.filter(inst => inst.loan_id === b.id).length;
          break;
        case 'total_installments':
          aValue = a.total_instalments;
          bValue = b.total_instalments;
          break;
        case 'payment_date':
          aValue = a.payment_date;
          bValue = b.payment_date;
          break;
        case 'status':
          aValue = (() => {
            const totalRepayable = a.original_amount + a.interest_amount;
            const paid = installments.filter(inst => inst.loan_id === a.id).reduce((acc, inst) => acc + inst.amount, 0);
            return paid >= totalRepayable ? 'Paid Off' : 'In Progress';
          })();
          bValue = (() => {
            const totalRepayable = b.original_amount + b.interest_amount;
            const paid = installments.filter(inst => inst.loan_id === b.id).reduce((acc, inst) => acc + inst.amount, 0);
            return paid >= totalRepayable ? 'Paid Off' : 'In Progress';
          })();
          break;
        default:
          aValue = '';
          bValue = '';
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [filteredLoans, sortField, sortDirection, installments]);

  if (loans.length === 0) {
    return (
      <GlassCard>
        <p className="text-center text-gray-500">No loans recorded yet.</p>
      </GlassCard>
    );
  }

  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{id: string, number: number} | null>(null);

  // Sorting handler
  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  return (
    <GlassCard className="overflow-x-auto">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
        <input
          type="text"
          placeholder="Filter by customer or check number..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full sm:w-64 bg-white/50"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full sm:w-48 bg-white/50"
        >
          <option value="">All Statuses</option>
          <option value="Paid Off">Paid Off</option>
          <option value="In Progress">In Progress</option>
        </select>
      </div>
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-100/70">
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('customer')}>Customer</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('loan_amount')}>Loan Amount</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('interest')}>Interest</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('total_repayable')}>Total Repayable</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('paid')}>Paid</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('balance')}>Balance</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('check_number')}>Check Number</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('installments')}>Installment #</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('total_installments')}>Total Installments</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('payment_date')}>Payment Date</th>
            <th className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('status')}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedLoans.map((loan: LoanWithCustomer) => {
  // Sorting handler
  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }
            const loanInstallments = installments.filter(inst => inst.loan_id === loan.id);
            const totalRepayable = loan.original_amount + loan.interest_amount;
            const paid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
            const balance = totalRepayable - paid;
            const isPaidOff = paid >= totalRepayable;
            const isExpanded = expandedRow === loan.id;
            return (
              <React.Fragment key={loan.id}>
                <tr className="even:bg-gray-50/50 hover:bg-indigo-50/50 transition-colors">
                  <td className="px-4 py-2 border-b">
                    <button
                      className="font-bold text-indigo-700 hover:underline focus:outline-none text-left"
                      onClick={() => setExpandedRow(isExpanded ? null : loan.id)}
                      aria-expanded={isExpanded}
                    >
                      {loan.customers?.name ?? 'Unknown'}
                    </button>
                  </td>
                  <td className="px-4 py-2 border-b">₹{loan.original_amount.toLocaleString()}</td>
                  <td className="px-4 py-2 border-b">₹{loan.interest_amount.toLocaleString()}</td>
                  <td className="px-4 py-2 border-b">₹{totalRepayable.toLocaleString()}</td>
                  <td className="px-4 py-2 border-b">₹{paid.toLocaleString()}</td>
                  <td className="px-4 py-2 border-b">₹{balance.toLocaleString()}</td>
                  <td className="px-4 py-2 border-b">{loan.check_number || '-'}</td>
                  <td className="px-4 py-2 border-b">{loanInstallments.length}</td>
                  <td className="px-4 py-2 border-b">{loan.total_instalments || '-'}</td>
                  <td className="px-4 py-2 border-b">{loan.payment_date ? formatDate(loan.payment_date) : '-'}</td>
                  <td className={`px-4 py-2 border-b font-semibold ${isPaidOff ? 'text-green-600' : 'text-orange-600'}`}>{isPaidOff ? 'Paid Off' : 'In Progress'}</td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50/20">
                    <td colSpan={11} className="px-4 py-2 border-b">
                      <div className="p-3 border rounded-lg bg-white/80">
                        <h4 className="font-semibold text-gray-700 mb-2">Installments Paid</h4>
                        {loanInstallments.length > 0 ? (
                           <ul className="space-y-2">
                            {loanInstallments.map(inst => {
                              const customer = loan.customers;
                              let message = '';
                              let whatsappUrl = '#';
                              let isValidPhone = false;
                              if (customer && customer.phone && /^\d{10,15}$/.test(customer.phone)) {
                                isValidPhone = true;
                                message = `Hi ${customer.name}, your installment payment of ₹${inst.amount}`;
                                if (inst.late_fee && inst.late_fee > 0) {
                                  message += ` (including a ₹${inst.late_fee} late fee)`;
                                }
                                message += ` (Installment #${inst.installment_number}) was received on ${formatDate(inst.date, 'whatsapp')}. Thank you.`;
                                whatsappUrl = `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`;
                                console.log('WhatsApp URL:', whatsappUrl, 'Phone:', customer.phone);
                              } else {
                                console.warn('Invalid or missing phone for customer:', customer);
                              }
                              return (
                                <li key={inst.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 rounded px-3 py-2 border border-gray-200 gap-2">
                                  <div>
                                    <span className="font-medium">#{inst.installment_number}</span>
                                    <span className="ml-2 text-gray-600">{formatDate(inst.date)}</span>
                                    <span className="ml-2 text-green-700 font-semibold">₹{inst.amount.toLocaleString()}</span>
                                    {inst.late_fee > 0 && <span className="ml-2 text-orange-500 text-xs">(+₹{inst.late_fee} late)</span>}
                                    <span className="ml-2 text-gray-500 text-xs">Receipt: {inst.receipt_number}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <motion.button
                                      onClick={() => isValidPhone && window.open(whatsappUrl, '_blank')}
                                      className="p-1 rounded-full hover:bg-green-500/10 transition-colors"
                                      aria-label={`Send installment #${inst.installment_number} on WhatsApp`}
                                      whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                      disabled={!isValidPhone}
                                    >
                                      <WhatsAppIcon className="w-4 h-4 text-green-500" />
                                    </motion.button>
                                    <motion.button
                                      onClick={() => setDeleteTarget({ id: inst.id, number: inst.installment_number })}
                                      className="p-1 rounded-full hover:bg-red-500/10 transition-colors ml-2"
                                      aria-label={`Delete installment #${inst.installment_number}`}
                                      whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                    >
                                      <Trash2Icon className="w-4 h-4 text-red-500" />
                                    </motion.button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                            <p className="text-center text-gray-500 py-4">No installments have been paid for this loan yet.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
        {/* Delete confirmation modal rendered once, outside the map */}
        {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-2">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-xs sm:max-w-sm">
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Delete Installment</h3>
                <p className="mb-4 sm:mb-6 text-sm sm:text-base">Are you sure you want to delete installment #{deleteTarget.number}?</p>
                <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteTarget(null)} className="px-3 py-2 rounded text-xs sm:text-base bg-gray-200 hover:bg-gray-300">Cancel</button>
                <button
                    onClick={async () => {
                    if(deleteTarget) {
                        await deleteInstallment(deleteTarget.id);
                        setDeleteTarget(null);
                    }
                    }}
                    className="px-3 py-2 rounded text-xs sm:text-base bg-red-600 text-white hover:bg-red-700"
                >Delete</button>
                </div>
            </div>
            </div>
        )}
    </GlassCard>
  );
};

export default LoanTableView;