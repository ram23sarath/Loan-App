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

  const collectedBreakdownCards = [
    { label: 'Interest', value: totalInterestCollected, color: 'green' },
    { label: 'Late Fees', value: totalLateFeeCollected, color: 'orange' },
    { label: 'Subscriptions', value: totalSubscriptionCollected, color: 'cyan' },
    { label: 'Misc Income', value: totalDataCollected, color: 'pink' },
  ];

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
          {/* Section 1: Collected Funds */}
          <motion.div
            className="lg:col-span-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 flex flex-col gap-6 shadow-sm"
            variants={mainCardVariants}
          >
            <div className="flex flex-col items-center">
              <span className="text-base font-medium text-indigo-800 uppercase tracking-wider">Total Collected</span>
              <span className="text-4xl font-bold text-indigo-700 mt-1">
                ₹{totalAllCollected.toLocaleString()}
              </span>
            </div>

            <motion.div
              className="w-full grid grid-cols-2 gap-4"
              variants={breakdownContainerVariants}
            >
              {collectedBreakdownCards.map((card) => (
                <motion.div
                  key={card.label}
                  // ✨ UPDATED: Added background color and adjusted text color for better visual distinction
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

          {/* Section 2: Total Loans Given */}
          <motion.div
            className="lg:col-span-2 bg-blue-50/50 border border-blue-100 rounded-2xl p-6 flex flex-col items-center justify-center shadow-sm"
            variants={mainCardVariants}
          >
            <span className="text-base font-medium text-blue-800 uppercase tracking-wider">Total Loans Given</span>
            <span className="text-4xl font-bold text-blue-700 mt-1">
              ₹{totalLoansGiven.toLocaleString()}
            </span>
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