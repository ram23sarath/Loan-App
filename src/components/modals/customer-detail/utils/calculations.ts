import type {
  DataEntry,
  Installment,
  LoanWithCustomer,
  SubscriptionWithCustomer,
} from "../../../../types";
import { formatNumberIndian } from "../../../../utils/numberFormatter";
import {
  getLoanRepaymentProgress,
  isLoanOngoing as isLoanOngoingUtil,
} from "../../../../utils/loanStatus";

export interface SummaryTotals {
  totalLoan: number;
  totalLoanInterest: number;
  totalSubscription: number;
  totalLateFees: number;
  totalMiscEntries: number;
  netTotal: number;
  interestCharged: number;
}

export interface LoanMetrics {
  amountPaid: number;
  totalRepayable: number;
  balance: number;
  isPaidOff: boolean;
}

export interface OngoingLoanInfo {
  paymentPercentage: number;
  amountPaid: number;
  totalRepayable: number;
}

export const formatCurrency = (amount: number): string => {
  return `₹${formatNumberIndian(amount)}`;
};

export const buildInstallmentsByLoanId = (
  installments: Installment[],
): Map<string, Installment[]> => {
  const map = new Map<string, Installment[]>();
  installments.forEach((inst) => {
    const existing = map.get(inst.loan_id) || [];
    existing.push(inst);
    map.set(inst.loan_id, existing);
  });
  return map;
};

export const calculateLoanMetrics = (
  loan: LoanWithCustomer,
  installmentsByLoanId: Map<string, Installment[]>,
): LoanMetrics => {
  const loanInstallments = installmentsByLoanId.get(loan.id) || [];
  const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
  const totalRepayable = loan.original_amount + loan.interest_amount;
  const balance = totalRepayable - amountPaid;
  return {
    amountPaid,
    totalRepayable,
    balance,
    isPaidOff: amountPaid >= totalRepayable,
  };
};

export const calculatePaymentPercentage = (
  loan: LoanWithCustomer,
  installmentsByLoanId: Map<string, Installment[]>,
): number => {
  const loanInstallments = installmentsByLoanId.get(loan.id) || [];
  return getLoanRepaymentProgress(loan, loanInstallments);
};

export const isLoanOngoing = (
  loan: LoanWithCustomer,
  installmentsByLoanId: Map<string, Installment[]>,
): boolean => {
  return isLoanOngoingUtil(loan, installmentsByLoanId);
};

export const calculateSummaryTotals = (
  loans: LoanWithCustomer[],
  subscriptions: SubscriptionWithCustomer[],
  installments: Installment[],
  dataEntries: DataEntry[],
  interestCharged: number,
): SummaryTotals => {
  const totalLoan = loans.reduce(
    (acc, loan) => acc + loan.original_amount + loan.interest_amount,
    0,
  );
  const totalLoanInterest = loans.reduce((acc, loan) => acc + loan.interest_amount, 0);
  const totalSubscription = subscriptions.reduce((acc, sub) => acc + sub.amount, 0);

  const totalLateFees =
    subscriptions.reduce((acc, sub) => acc + (sub.late_fee || 0), 0) +
    installments
      .filter((inst) => loans.some((loan) => loan.id === inst.loan_id))
      .reduce((acc, inst) => acc + (inst.late_fee || 0), 0);

  const totalMiscEntries = dataEntries.reduce((acc, entry) => acc + entry.amount, 0);
  const netTotal =
    totalSubscription + totalLoanInterest + totalLateFees - totalMiscEntries;

  return {
    totalLoan,
    totalLoanInterest,
    totalSubscription,
    totalLateFees,
    totalMiscEntries,
    netTotal,
    interestCharged,
  };
};

export const calculateOngoingLoanInfo = (
  loans: LoanWithCustomer[],
  installmentsByLoanId: Map<string, Installment[]>,
): OngoingLoanInfo | null => {
  const ongoing = loans.find((loan) => isLoanOngoing(loan, installmentsByLoanId));

  if (!ongoing) {
    return null;
  }

  const paymentPercentage = Math.round(
    calculatePaymentPercentage(ongoing, installmentsByLoanId),
  );
  const loanInstallments = installmentsByLoanId.get(ongoing.id) || [];
  const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
  const totalRepayable = ongoing.original_amount + ongoing.interest_amount;

  return {
    paymentPercentage,
    amountPaid,
    totalRepayable,
  };
};
