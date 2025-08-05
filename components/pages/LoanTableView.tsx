import React from 'react';
import { useData } from '../../context/DataContext';
import { motion } from 'framer-motion';
import { Trash2Icon } from '../../constants';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { formatDate } from '../../utils/dateFormatter';
import type { LoanWithCustomer } from '../../types';

const LoanTableView: React.FC = () => {
  const { loans, installments, deleteInstallment } = useData();
  const [filter, setFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

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

  if (loans.length === 0) {
    return (
      <GlassCard>
        <p className="text-center text-gray-500">No loans recorded yet.</p>
      </GlassCard>
    );
  }

  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{id: string, number: number} | null>(null);

  return (
    <GlassCard className="overflow-x-auto">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
        <input
          type="text"
          placeholder="Filter by customer or check number..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full sm:w-64"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full sm:w-48"
        >
          <option value="">All Statuses</option>
          <option value="Paid Off">Paid Off</option>
          <option value="In Progress">In Progress</option>
        </select>
      </div>
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 border-b text-left">Customer</th>
            <th className="px-4 py-2 border-b text-left">Loan Amount</th>
            <th className="px-4 py-2 border-b text-left">Interest</th>
            <th className="px-4 py-2 border-b text-left">Total Repayable</th>
            <th className="px-4 py-2 border-b text-left">Paid</th>
            <th className="px-4 py-2 border-b text-left">Balance</th>
            <th className="px-4 py-2 border-b text-left">Check Number</th>
            <th className="px-4 py-2 border-b text-left">Installment #</th>
            <th className="px-4 py-2 border-b text-left">Total Installments</th>
            <th className="px-4 py-2 border-b text-left">Payment Date</th>
            <th className="px-4 py-2 border-b text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredLoans.map(loan => {
            const loanInstallments = installments.filter(inst => inst.loan_id === loan.id);
            const totalRepayable = loan.original_amount + loan.interest_amount;
            const paid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
            const balance = totalRepayable - paid;
            const isPaidOff = paid >= totalRepayable;
            const isExpanded = expandedRow === loan.id;
            return (
              <React.Fragment key={loan.id}>
                <tr className="even:bg-gray-50">
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
                {isExpanded && loanInstallments.length > 0 && (
                  <tr className="bg-gray-50">
                    <td colSpan={11} className="px-4 py-2 border-b">
                      <div className="p-3 border rounded-lg bg-white">
                        <h4 className="font-semibold text-gray-700 mb-2">Installments Paid</h4>
                        <ul className="space-y-2">
                          {loanInstallments.map(inst => (
                            <li key={inst.id} className="flex flex-row justify-between items-center bg-gray-50 rounded px-3 py-2 border border-gray-200">
                              <div>
                                <span className="font-medium">#{inst.installment_number}</span>
                                <span className="ml-2 text-gray-600">{formatDate(inst.date)}</span>
                                <span className="ml-2 text-green-700 font-semibold">₹{inst.amount.toLocaleString()}</span>
                                {inst.late_fee > 0 && <span className="ml-2 text-orange-500 text-xs">(+₹{inst.late_fee} late)</span>}
                                <span className="ml-2 text-gray-500 text-xs">Receipt: {inst.receipt_number}</span>
                              </div>
                              <motion.button
                                onClick={() => setDeleteTarget({ id: inst.id, number: inst.installment_number })}
                                className="p-1 rounded-full hover:bg-red-500/10 transition-colors ml-2"
                                aria-label={`Delete installment #${inst.installment_number}`}
                                whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                              >
                                <Trash2Icon className="w-4 h-4 text-red-500" />
                              </motion.button>
                            </li>
                          ))}
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
                                      await deleteInstallment(deleteTarget.id);
                                      setDeleteTarget(null);
                                    }}
                                    className="px-3 py-2 rounded text-xs sm:text-base bg-red-600 text-white hover:bg-red-700"
                                  >Delete</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </GlassCard>
  );
};

export default LoanTableView;
