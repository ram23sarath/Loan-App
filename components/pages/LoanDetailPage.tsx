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
      <div className="mb-4">
        <div><strong>Customer:</strong> {loan.customers?.name ?? 'Unknown'}</div>
        <div><strong>Original Amount:</strong> ₹{loan.original_amount.toLocaleString()}</div>
        <div><strong>Interest Amount:</strong> ₹{loan.interest_amount.toLocaleString()}</div>
        <div><strong>Total Repayable:</strong> ₹{(loan.original_amount + loan.interest_amount).toLocaleString()}</div>
        <div><strong>Check Number:</strong> {loan.check_number || '-'}</div>
        <div><strong>Payment Date:</strong> {loan.payment_date ? formatDate(loan.payment_date) : '-'}</div>
      </div>
      <h3 className="text-lg font-semibold mb-2">Installments Paid</h3>
      {loanInstallments.length > 0 ? (
        <ul className="space-y-2">
          {loanInstallments.map(inst => (
            <li key={inst.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 rounded px-3 py-2 border border-gray-200 gap-2">
              <div>
                <span className="font-medium">#{inst.installment_number}</span>
                <span className="ml-2 text-gray-600">{formatDate(inst.date)}</span>
                <span className="ml-2 text-green-700 font-semibold">₹{inst.amount.toLocaleString()}</span>
                {inst.late_fee > 0 && <span className="ml-2 text-orange-500 text-xs">(+₹{inst.late_fee} late)</span>}
                <span className="ml-2 text-gray-500 text-xs">Receipt: {inst.receipt_number}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No installments have been paid for this loan yet.</p>
      )}
    </GlassCard>
  );
};

export default LoanDetailPage;
