import Decimal from "decimal.js";
import type { Installment, LoanWithCustomer } from "../types";

export type LoanStatusResult = {
  paid: number;
  totalRepayable: number;
  requiredInstallments: number;
  hasReachedInstallmentTarget: boolean;
  isPaidOff: boolean;
  balance: number;
  status: "Paid Off" | "In Progress";
};

export const getLoanStatus = (
  loan: LoanWithCustomer,
  installments: Installment[]
): LoanStatusResult => {

  // ---- HARD VALIDATION (money logic: fail fast) ----
  if (!Number.isInteger(loan.total_instalments) || loan.total_instalments <= 0) {
    throw new Error(
      `Invalid loan configuration: total_instalments must be a positive integer. LoanId=${loan.id}`
    );
  }

  if (!Number.isFinite(loan.original_amount) || loan.original_amount < 0) {
    throw new Error(
      `Invalid loan configuration: original_amount must be a finite non-negative number. LoanId=${loan.id}`
    );
  }

  if (!Number.isFinite(loan.interest_amount) || loan.interest_amount < 0) {
    throw new Error(
      `Invalid loan configuration: interest_amount must be a finite non-negative number. LoanId=${loan.id}`
    );
  }

  // ---- CORE LOGIC ----
  const requiredInstallments = loan.total_instalments;
  const originalAmountDecimal = new Decimal(loan.original_amount);
  const interestAmountDecimal = new Decimal(loan.interest_amount);
  const totalRepayableDecimal = originalAmountDecimal.plus(interestAmountDecimal);

  const paidDecimal = installments.reduce((acc, inst, idx) => {
    if (!Number.isFinite(inst.amount) || inst.amount < 0) {
      throw new Error(
        `Invalid installment amount for LoanId=${loan.id} InstallmentIndex=${idx} InstallmentId=${inst.id ?? "unknown"}`
      );
    }
    return acc.plus(new Decimal(inst.amount));
  }, new Decimal(0));

  const paid = paidDecimal.toNumber();
  const totalRepayable = totalRepayableDecimal.toNumber();

  const hasReachedInstallmentTarget =
    installments.length >= requiredInstallments;

  const balanceDecimal = totalRepayableDecimal.minus(paidDecimal);
  const balance = Math.max(balanceDecimal.toNumber(), 0);
  const isPaidOff = balanceDecimal.lte(0);

  return {
    paid,
    totalRepayable,
    requiredInstallments,
    hasReachedInstallmentTarget,
    isPaidOff,
    balance,
    status: isPaidOff ? "Paid Off" : "In Progress",
  };
};

// ─── Shared eligibility constants & helpers ──────────────────────────────────

/** A loan is considered "ongoing" (not yet sufficiently repaid) when < this % is paid. */
export const ONGOING_PAYMENT_THRESHOLD = 80;

/**
 * Calculate repayment percentage for a single loan using Decimal.js.
 * Returns 0–100 (percentage).  Zero-value loans (totalRepayable ≤ 0) return 100 (fully paid).
 */
export const getLoanRepaymentProgress = (
  loan: LoanWithCustomer,
  installments: Installment[],
): number => {
  const totalRepayable = new Decimal(loan.original_amount ?? 0).plus(
    new Decimal(loan.interest_amount ?? 0),
  );
  if (totalRepayable.lte(0)) return 100; // treat zero-value loans as fully paid

  const paid = installments.reduce(
    (acc, inst) => acc.plus(new Decimal(inst.amount ?? 0)),
    new Decimal(0),
  );
  // Clamp to [0, 100]
  return Math.min(paid.div(totalRepayable).times(100).toNumber(), 100);
};

/**
 * Returns `true` when a loan still has < ONGOING_PAYMENT_THRESHOLD % repaid
 * (i.e. the loan is still "in progress" and should block new loan recording).
 */
export const isLoanOngoing = (
  loan: LoanWithCustomer,
  installmentsByLoanId: Map<string, Installment[]>,
): boolean => {
  const installments = installmentsByLoanId.get(loan.id) || [];
  return getLoanRepaymentProgress(loan, installments) < ONGOING_PAYMENT_THRESHOLD;
};

/**
 * Eligibility result returned by `canRequestNewLoan`.
 */
export type LoanEligibilityResult = {
  eligible: boolean;
  progressPercent: number;
  reason?: string;
};

/**
 * Determine whether a customer may request a **new** loan.
 *
 * Rules:
 *  – While data is still loading → ineligible (prevents race-condition flash).
 *  – No existing loans → eligible (first-time borrower).
 *  – At least one loan with ≥ 80 % repaid → eligible (uses max-across-loans).
 *  – Otherwise → ineligible.
 */
export const canRequestNewLoan = (
  customerLoans: LoanWithCustomer[],
  installmentsByLoanId: Map<string, Installment[]>,
  dataLoading: boolean,
): LoanEligibilityResult => {
  if (dataLoading) {
    return { eligible: false, progressPercent: 0, reason: "Loading loan data…" };
  }

  if (customerLoans.length === 0) {
    return { eligible: true, progressPercent: 0, reason: "First-time borrower — no existing loans." };
  }

  let maxProgress = 0;
  for (const loan of customerLoans) {
    const installments = installmentsByLoanId.get(loan.id) || [];
    const progress = getLoanRepaymentProgress(loan, installments);
    if (progress > maxProgress) maxProgress = progress;
  }

  const progressPercent = Math.round(maxProgress);
  const eligible = maxProgress >= ONGOING_PAYMENT_THRESHOLD;

  return {
    eligible,
    progressPercent,
    reason: eligible
      ? undefined
      : `You need at least 80% repayment (current ${progressPercent}%).`,
  };
};