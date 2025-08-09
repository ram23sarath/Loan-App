import React from 'react';
import { useData } from '../../context/DataContext';

const SummaryPage = () => {
  const { loans = [], installments = [], subscriptions = [], dataEntries = [] } = useData();

  // --- Data Calculation (No changes here) ---
  const totalInterestCollected = loans.reduce((acc, loan) => {
    const loanInstallments = installments.filter(i => i.loan_id === loan.id);
    const totalPaidForLoan = loanInstallments.reduce((sum, inst) => sum + inst.amount, 0);
    if (totalPaidForLoan > loan.original_amount) {
      const interestCollected = Math.min(totalPaidForLoan - loan.original_amount, loan.interest_amount);
      return acc + interestCollected;
    }
    return acc;
  }, 0);
  const totalLateFeeCollected = installments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0);
  const totalSubscriptionCollected = subscriptions.reduce((acc, sub) => acc + (sub.amount || 0), 0);
  const totalDataCollected = dataEntries.reduce((acc, entry) => {
    if (entry.type === 'expenditure') {
      return acc - (entry.amount || 0);
    }
    return acc + (entry.amount || 0);
  }, 0);
  const totalAllCollected = totalInterestCollected + totalLateFeeCollected + totalSubscriptionCollected + totalDataCollected;
  const totalLoansGiven = loans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0);

  // --- Card data structured for easy mapping and animation ---
  const summaryCards = [
    { label: 'Interest Collected', value: totalInterestCollected, color: 'green' },
    { label: 'Late Fee Collected', value: totalLateFeeCollected, color: 'orange' },
    { label: 'Subscription Collected', value: totalSubscriptionCollected, color: 'cyan' },
    { label: 'Misc Collected', value: totalDataCollected, color: 'pink' },
    { label: 'Total Collected', value: totalAllCollected, color: 'indigo', isSummary: true },
    { label: 'Total Loans Given', value: totalLoansGiven, color: 'blue', isSummary: true },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto my-8">
      <div className="bg-white rounded-xl shadow-md flex flex-col gap-8 p-6 border border-gray-200/80">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-indigo-700 uppercase tracking-widest">Summary Dashboard</h2>
        </div>
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`flex flex-col items-center justify-center px-6 py-6 rounded-2xl bg-${card.color}-50 border border-${card.color}-100 shadow-sm ${card.isSummary ? 'ring-2 ring-indigo-200' : ''}`}
            >
              <span className={`text-base font-medium text-${card.color}-700 mb-2`}>{card.label}</span>
              <span className={`text-2xl font-bold text-${card.color}-700`}>
                ₹{card.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-gray-400 mt-2">
          Updated as of {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;