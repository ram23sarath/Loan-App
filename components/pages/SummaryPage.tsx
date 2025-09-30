import React from 'react';
import { motion } from 'framer-motion';
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
  const totalLateFeeCollected = installments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0)
    + subscriptions.reduce((acc, sub) => acc + (sub.late_fee || 0), 0);
  const totalSubscriptionCollected = subscriptions.reduce((acc, sub) => acc + (sub.amount || 0), 0);
  const totalDataCollected = dataEntries.reduce((acc, entry) => {
    if (entry.type === 'expenditure') {
      return acc - (entry.amount || 0);
    }
    return acc + (entry.amount || 0);
  }, 0);
  // New: calculate Expenses from specific subtypes recorded in New Data Entry
  const expenseSubtypes = ['Subscription Return', 'Retirement Gift', 'Death Fund', 'Misc Expense'];
  const totalExpenses = dataEntries.reduce((acc, entry) => {
    // Consider only entries that are expenditures and match the requested subtypes
    if (entry.type === 'expenditure' && entry.subtype && expenseSubtypes.includes(entry.subtype)) {
      return acc + (entry.amount || 0);
    }
    return acc;
  }, 0);
  // Calculate per-subtype totals so we can show breakdown under Expenses
  const expenseTotalsBySubtype: Record<string, number> = expenseSubtypes.reduce((acc, subtype) => {
    acc[subtype] = 0;
    return acc;
  }, {} as Record<string, number>);
  dataEntries.forEach(entry => {
    if (entry.type === 'expenditure' && entry.subtype && expenseSubtypes.includes(entry.subtype)) {
      expenseTotalsBySubtype[entry.subtype!] = (expenseTotalsBySubtype[entry.subtype!] || 0) + (entry.amount || 0);
    }
  });
  const totalAllCollected = totalInterestCollected + totalLateFeeCollected + totalSubscriptionCollected + totalDataCollected;
  // Show only principal amount disbursed (original_amount) — do not include interest here
  const totalLoansGiven = loans.reduce((acc, loan) => acc + (loan.original_amount || 0), 0);

  // New: calculate total principal recovered (payments applied to principal, excluding interest)
  const totalPrincipalRecovered = loans.reduce((acc, loan) => {
    const loanInstallments = installments.filter(i => i.loan_id === loan.id);
    const totalPaidForLoan = loanInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    // Payments are applied to principal first; principal recovered is min(totalPaid, original_amount)
    const principalRecovered = Math.min(totalPaidForLoan, loan.original_amount || 0);
    return acc + principalRecovered;
  }, 0);

  // No tab state — Loan Recovery will be displayed as its own heading below Total Collected

  const collectedBreakdownCards = [
    { label: 'Interest', value: totalInterestCollected, color: 'green' },
    { label: 'Late Fees', value: totalLateFeeCollected, color: 'orange' },
    { label: 'Subscriptions', value: totalSubscriptionCollected, color: 'cyan' },
    // MODIFICATION: Use Math.abs() to ensure the value is always positive for display.
    { label: 'Misc Expenses', value: Math.abs(totalDataCollected), color: 'pink' },
  ];

  // Split out the Misc card so we can render it in the right-side box while keeping
  // the rest of the breakdown on the left. Calculations remain unchanged.
  const miscCard = collectedBreakdownCards.find(c => c.label === 'Misc Expenses');
  const leftCards = collectedBreakdownCards.filter(c => c.label !== 'Misc Expenses');

  // --- Animation Variants (No changes here) ---
  const mainContainerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 },
    },
  };
  const mainCardVariants = {
    hidden: { y: -30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100, damping: 12 },
    },
  };
  const breakdownContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.07,
        delayChildren: 0.3,
      },
    },
  };
  const breakdownCardVariants = {
    hidden: { scale: 0.5, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { type: 'spring', stiffness: 200, damping: 15 },
    },
  };

  return (
    <div className="w-full max-w-7xl mx-auto my-8">
      <div className="bg-white rounded-xl shadow-md flex flex-col gap-8 p-6 border border-gray-200/80">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-indigo-700 uppercase tracking-widest">Summary Dashboard</h2>
        </div>

        <motion.div
          className="w-full grid grid-cols-1 lg:grid-cols-5 gap-6"
          variants={mainContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Section 1: Income */}
          <motion.div
            className="lg:col-span-3 bg-white/60 border border-indigo-100 rounded-2xl p-5 flex flex-col gap-4 shadow-sm"
            variants={mainCardVariants}
          >
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold">₹</div>
                <div>
                  <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Income</div>
                  <div className="text-xs text-gray-400">Collections & recoveries</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-base font-medium text-indigo-800 uppercase tracking-wider">Total Collected</span>
              <span className="text-4xl font-bold text-indigo-700 mt-1">₹{totalAllCollected.toLocaleString()}</span>
            </div>

            <div className="flex flex-col items-center mt-4">
              <span className="text-sm font-medium text-indigo-800 uppercase tracking-wider">Loan Recovery (Principal)</span>
              <span className="text-lg font-bold text-indigo-700 mt-1">₹{totalPrincipalRecovered.toLocaleString()}</span>
            </div>

            <motion.div
              className="w-full grid grid-cols-2 gap-4"
              variants={breakdownContainerVariants}
            >
              {leftCards.map((card) => (
                <motion.div
                  key={card.label}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl bg-${card.color}-50 border border-${card.color}-200`}
                  variants={breakdownCardVariants}
                >
                  <span className={`text-sm font-medium text-${card.color}-700`}>{card.label}</span>
                  <span className={`text-xl font-bold text-${card.color}-800 mt-1`}>
                    ₹{card.value.toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Section 2: Expenses */}
          <motion.div
            className="lg:col-span-2 bg-white/60 border border-red-100 rounded-2xl p-5 flex flex-col items-center justify-center shadow-sm"
            variants={mainCardVariants}
          >
            <div className="w-full flex items-center gap-3 mb-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold">-</div>
              <div className="text-sm">
                <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Expenses</div>
                <div className="text-xs text-gray-400">Outgoing & disbursed principal</div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-base font-medium text-blue-800 uppercase tracking-wider">Total Loans Given</span>
              <span className="text-4xl font-bold text-blue-700 mt-1">₹{totalLoansGiven.toLocaleString()}</span>
            </div>
            {/* Render the Misc Income card in the right-side box (visual move only). */}
            {miscCard && (
              <div className="w-full mt-6">
                <div className={`flex items-center justify-between p-4 rounded-lg bg-${miscCard.color}-50 border border-${miscCard.color}-200`}>
                  <div>
                    <div className={`text-sm font-medium text-${miscCard.color}-700`}>{miscCard.label}</div>
                    <div className={`text-lg font-bold text-${miscCard.color}-800 mt-1`}>₹{miscCard.value.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
            {/* Expenses box (calculated from selected misc entry subtypes) */}
            <div className="w-full mt-4">
              <div className={`flex items-center justify-between p-4 rounded-lg bg-red-50 border border-red-200`}>
                <div>
                  <div className={`text-sm font-medium text-red-700`}>Expenses</div>
                  <div className={`text-lg font-bold text-red-800 mt-1`}>₹{totalExpenses.toLocaleString()}</div>
                </div>
              </div>
              {/* Per-subtype breakdown */}
              <div className="mt-3 space-y-2">
                {Object.entries(expenseTotalsBySubtype).map(([subtype, amt]) => (
                  <div key={subtype} className="flex items-center justify-between px-3 py-1 rounded-md bg-red-25/30">
                    <div className="text-sm text-gray-700">{subtype}</div>
                    <div className="text-sm font-medium text-red-700">₹{(amt || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        <div className="text-center text-xs text-gray-400 mt-2">
          Updated as of {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;