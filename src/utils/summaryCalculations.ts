import { LoanWithCustomer, Installment, SubscriptionWithCustomer, DataEntry } from '../types';

export const expenseSubtypes = [
  'Subscription Return',
  'Retirement Gift',
  'Death Fund',
  'Misc Expense',
];

export interface SummaryData {
  totalInterestCollected: number;
  totalLateFeeCollected: number;
  totalSubscriptionCollected: number;
  subscriptionReturnTotal: number;
  subscriptionBalance: number;
  totalDataCollected: number;
  totalExpenses: number;
  expenseTotalsBySubtype: Record<string, number>;
  totalAllCollected: number;
  totalLoansGiven: number;
  totalPrincipalRecovered: number;
  loanBalance: number;
}

export const calculateSummaryData = (
  loans: LoanWithCustomer[],
  installments: Installment[],
  subscriptions: SubscriptionWithCustomer[],
  dataEntries: DataEntry[],
  installmentsByLoanId?: Map<string, Installment[]>
): SummaryData => {
  // Helper to get installments for a loan (uses map if available, falls back to filter)
  const getInstallmentsForLoan = (loanId: string): Installment[] => {
    if (installmentsByLoanId) {
      return installmentsByLoanId.get(loanId) || [];
    }
    return installments.filter((i) => i.loan_id === loanId);
  };

  // Calculate Total Interest Collected
  const totalInterestCollected = loans.reduce((acc, loan) => {
    const loanInstallments = getInstallmentsForLoan(loan.id);
    const totalPaidForLoan = loanInstallments.reduce(
      (sum, inst) => sum + inst.amount,
      0
    );
    if (totalPaidForLoan > loan.original_amount) {
      const interestCollected = Math.min(
        totalPaidForLoan - loan.original_amount,
        loan.interest_amount
      );
      return acc + interestCollected;
    }
    return acc;
  }, 0);

  // Calculate Total Late Fee Collected
  const totalLateFeeCollected =
    installments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0) +
    subscriptions.reduce((acc, sub) => acc + (sub.late_fee || 0), 0);

  // Calculate Total Subscription Collected
  const totalSubscriptionCollected = subscriptions.reduce(
    (acc, sub) => acc + (sub.amount || 0),
    0
  );

  // Calculate Subscription Return Total
  const subscriptionReturnTotal = dataEntries.reduce((acc, entry) => {
    if (
      (entry as any).type === 'expenditure' &&
      entry.subtype === 'Subscription Return'
    ) {
      return acc + (entry.amount || 0);
    }
    return acc;
  }, 0);

  // Calculate Subscription Balance
  const subscriptionBalance =
    totalSubscriptionCollected - subscriptionReturnTotal;

  // Calculate Total Data Collected
  const totalDataCollected = dataEntries.reduce((acc, entry) => {
    if (entry.type === 'expenditure') {
      return acc - (entry.amount || 0);
    }
    return acc + (entry.amount || 0);
  }, 0);

  // Calculate Total Expenses by Subtype
  const expenseTotalsBySubtype: Record<string, number> = expenseSubtypes.reduce(
    (acc, subtype) => {
      acc[subtype] = 0;
      return acc;
    },
    {} as Record<string, number>
  );

  dataEntries.forEach((entry) => {
    if (
      entry.type === 'expenditure' &&
      entry.subtype &&
      expenseSubtypes.includes(entry.subtype)
    ) {
      expenseTotalsBySubtype[entry.subtype!] =
        (expenseTotalsBySubtype[entry.subtype!] || 0) + (entry.amount || 0);
    }
  });

  const totalExpenses = Object.values(expenseTotalsBySubtype).reduce(
    (a, b) => a + b,
    0
  );

  // Calculate Total All Collected
  // Total Collected = Subscriptions + Interest + Late Fees
  const totalAllCollected =
    totalSubscriptionCollected +
    totalInterestCollected +
    totalLateFeeCollected;

  // Calculate Total Loans Given (principal only)
  const totalLoansGiven = loans.reduce(
    (acc, loan) => acc + (loan.original_amount || 0),
    0
  );

  // Calculate Total Principal Recovered
  const totalPrincipalRecovered = loans.reduce((acc, loan) => {
    const loanInstallments = getInstallmentsForLoan(loan.id);
    const totalPaidForLoan = loanInstallments.reduce(
      (sum, inst) => sum + (inst.amount || 0),
      0
    );
    const principalRecovered = Math.min(
      totalPaidForLoan,
      loan.original_amount || 0
    );
    return acc + principalRecovered;
  }, 0);

  // Calculate Loan Balance
  const loanBalance = totalLoansGiven - totalPrincipalRecovered;

  return {
    totalInterestCollected,
    totalLateFeeCollected,
    totalSubscriptionCollected,
    subscriptionReturnTotal,
    subscriptionBalance,
    totalDataCollected,
    totalExpenses,
    expenseTotalsBySubtype,
    totalAllCollected,
    totalLoansGiven,
    totalPrincipalRecovered,
    loanBalance,
  };
};
