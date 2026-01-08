import Decimal from "decimal.js";
import type { Installment, LoanWithCustomer } from "../types";

export type LoanStatusResult = {
  paid: number;
  totalRepayable: number;
  requiredInstallments: number;
  hasReachedInstallmentTarget: boolean;
  isPaidOff: boolean;
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

  const isPaidOff =
    hasReachedInstallmentTarget &&
    paidDecimal.greaterThanOrEqualTo(totalRepayableDecimal);

  return {
    paid,
    totalRepayable,
    requiredInstallments,
    hasReachedInstallmentTarget,
    isPaidOff,
    status: isPaidOff ? "Paid Off" : "In Progress",
  };
};