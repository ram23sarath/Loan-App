import React from 'react';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { formatDate } from '../../utils/dateFormatter';
import type { LoanWithCustomer } from '../../types';

const LoanTableView: React.FC = () => {
  const { loans, installments } = useData();
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
            return (
              <tr key={loan.id} className="even:bg-gray-50">
                <td className="px-4 py-2 border-b">{loan.customers?.name ?? 'Unknown'}</td>
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
            );
          })}
        </tbody>
      </table>
    </GlassCard>
  );
};

export default LoanTableView;
