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
    <>
      {/* Added a style block to define the fade-in animation */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .card-animate {
          opacity: 0; /* Start hidden */
          animation: fadeInUp 0.5s ease-out forwards;
        }
      `}</style>

      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-200 via-white to-blue-100 p-4">
        <div className="w-full max-w-5xl mx-auto p-8 rounded-3xl bg-white/90 border border-indigo-200 shadow-2xl flex flex-col gap-10 items-center justify-center min-h-[80vh]">
          <div className="flex justify-center w-full mb-4">
            <h2 className="uppercase tracking-widest text-3xl font-extrabold text-indigo-700 text-center drop-shadow-lg">Summary Dashboard</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-6 w-full max-w-md mx-auto">
            {/* Mapped over the cards to render them with staggered animations */}
            {summaryCards.map((card, index) => (
              <div
                key={card.label}
                className={`card-animate flex items-center justify-between px-6 py-4 rounded-2xl bg-${card.color}-50 border border-${card.color}-100 shadow ${card.isSummary ? 'mt-2' : ''}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <span className={`text-base font-medium text-${card.color}-700`}>{card.label}</span>
                <span className={`text-2xl font-bold text-${card.color}-700`}>₹{card.value.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="text-center text-xs text-gray-400 mt-4">
            Updated as of {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>
    </>
  );
};

export default SummaryPage;