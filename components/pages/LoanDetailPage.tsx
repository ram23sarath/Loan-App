import React from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import { formatDate } from '../../utils/dateFormatter';


const LoanDetailPage: React.FC = () => {
  const { id } = useParams();
  const { loans, installments, loading } = useData();

  if (loading) {
    return <GlassCard><p>Loading...</p></GlassCard>;
  }

  const loan = loans.find(l => l.id === id);
  const loanInstallments = installments.filter(inst => inst.loan_id === id);

  if (!loan) {
    return <GlassCard><p>Loan not found.</p></GlassCard>;
  }

  return (
    <GlassCard className="max-w-2xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Loan Details</h2>
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Customer</div>
          <div className="font-semibold text-indigo-700">{loan.customers?.name ?? 'Unknown'}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Payment Date</div>
          <div className="font-semibold">{loan.payment_date ? formatDate(loan.payment_date) : '-'}</div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Original Amount</div>
          <div className="font-semibold text-green-700">₹{loan.original_amount.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Interest Amount</div>
          <div className="font-semibold text-green-700">₹{loan.interest_amount.toLocaleString()}</div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Total Repayable</div>
          <div className="font-semibold text-indigo-800">₹{(loan.original_amount + loan.interest_amount).toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Check Number</div>
          <div className="font-semibold">{loan.check_number || '-'}</div>
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-3">Installments Paid</h3>
      {loanInstallments.length > 0 ? (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <div className="grid grid-cols-6 gap-4 bg-indigo-50 text-xs font-semibold text-indigo-700 p-3">
            <div>#</div>
            <div>Date</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Late Fee</div>
            <div>Receipt</div>
            <div className="text-right">Notes</div>
          </div>
          <div className="divide-y divide-gray-100">
            {loanInstallments.map(inst => (
              <div key={inst.id} className="grid grid-cols-6 gap-4 items-center p-3 bg-white">
                <div className="text-sm text-gray-700">#{inst.installment_number}</div>
                <div className="text-sm text-gray-600">{formatDate(inst.date)}</div>
                <div className="text-sm font-semibold text-green-700 text-right">₹{inst.amount.toLocaleString()}</div>
                <div className="text-sm text-gray-700 text-right">{inst.late_fee ? `₹${inst.late_fee}` : '-'}</div>
                <div className="text-sm text-gray-600">{inst.receipt_number || '-'}</div>
                <div className="text-sm text-gray-500 text-right">{inst.notes || '-'}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-500">No installments have been paid for this loan yet.</p>
      )}
    </GlassCard>
  );
};

export default LoanDetailPage;