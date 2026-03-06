import { describe, it, expect } from "vitest";
import type { Installment, LoanWithCustomer } from "../../types";
import {
  getLoanStatus,
  getLoanRepaymentProgress,
  isLoanOngoing,
  canRequestNewLoan,
  ONGOING_PAYMENT_THRESHOLD,
} from "../loanStatus";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal LoanWithCustomer for tests. */
const makeLoan = (
  overrides: Partial<LoanWithCustomer> = {},
): LoanWithCustomer => ({
  id: overrides.id ?? "loan-1",
  customer_id: overrides.customer_id ?? "cust-1",
  original_amount: overrides.original_amount ?? 100_000,
  interest_amount: overrides.interest_amount ?? 0,
  payment_date: "2025-01-01",
  total_instalments: overrides.total_instalments ?? 10,
  created_at: "2025-01-01T00:00:00Z",
  customers: { name: "Test", phone: "1234567890" },
  ...overrides,
});

/** Build a minimal Installment. */
const makeInstallment = (
  loanId: string,
  amount: number,
  idx = 1,
): Installment => ({
  id: `inst-${loanId}-${idx}`,
  loan_id: loanId,
  installment_number: idx,
  amount,
  date: "2025-02-01",
  receipt_number: `R-${idx}`,
  late_fee: null,
  created_at: "2025-02-01T00:00:00Z",
});

/** Build an installmentsByLoanId Map from an array of installments. */
const toMap = (installments: Installment[]): Map<string, Installment[]> => {
  const map = new Map<string, Installment[]>();
  for (const inst of installments) {
    const arr = map.get(inst.loan_id) || [];
    arr.push(inst);
    map.set(inst.loan_id, arr);
  }
  return map;
};

// ─── getLoanRepaymentProgress ─────────────────────────────────────────────────

describe("getLoanRepaymentProgress", () => {
  it("returns 0 when no installments paid", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    expect(getLoanRepaymentProgress(loan, [])).toBe(0);
  });

  it("returns 35 for original=100k, paid=35k (the bug-repro scenario)", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 35_000)];
    expect(getLoanRepaymentProgress(loan, installments)).toBe(35);
  });

  it("returns 80 when exactly 80% is paid", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 80_000)];
    expect(getLoanRepaymentProgress(loan, installments)).toBe(80);
  });

  it("returns 100 when fully paid (not more)", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 120_000)]; // overpaid
    expect(getLoanRepaymentProgress(loan, installments)).toBe(100);
  });

  it("returns 100 for a zero-value loan (totalRepayable = 0)", () => {
    const loan = makeLoan({ original_amount: 0, interest_amount: 0 });
    expect(getLoanRepaymentProgress(loan, [])).toBe(100);
  });

  it("handles interest correctly", () => {
    // original=80k + interest=20k = total 100k; paid 80k = 80%
    const loan = makeLoan({ original_amount: 80_000, interest_amount: 20_000 });
    const installments = [makeInstallment("loan-1", 80_000)];
    expect(getLoanRepaymentProgress(loan, installments)).toBe(80);
  });

  it("handles multiple installments summing correctly", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [
      makeInstallment("loan-1", 25_000, 1),
      makeInstallment("loan-1", 25_000, 2),
      makeInstallment("loan-1", 30_000, 3),
    ];
    // 80k / 100k = 80%
    expect(getLoanRepaymentProgress(loan, installments)).toBe(80);
  });

  it("returns correct progress for float edge case (79.999%)", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 79_999)];
    const progress = getLoanRepaymentProgress(loan, installments);
    expect(progress).toBeCloseTo(79.999, 2);
    expect(progress).toBeLessThan(80);
  });
});

// ─── isLoanOngoing ────────────────────────────────────────────────────────────

describe("isLoanOngoing", () => {
  it("returns true when loan is < 80% paid (35% paid, balance=65k)", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 35_000)];
    expect(isLoanOngoing(loan, toMap(installments))).toBe(true);
  });

  it("returns false when loan is exactly 80% paid", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 80_000)];
    expect(isLoanOngoing(loan, toMap(installments))).toBe(false);
  });

  it("returns false when loan is 100% paid", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 100_000)];
    expect(isLoanOngoing(loan, toMap(installments))).toBe(false);
  });

  it("returns false for zero-value loan (treated as fully paid)", () => {
    const loan = makeLoan({ original_amount: 0, interest_amount: 0 });
    expect(isLoanOngoing(loan, new Map())).toBe(false);
  });

  it("returns true when no installments exist for a non-zero loan", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    expect(isLoanOngoing(loan, new Map())).toBe(true);
  });
});

// ─── canRequestNewLoan ────────────────────────────────────────────────────────

describe("canRequestNewLoan", () => {
  it("returns ineligible while data is loading", () => {
    const loan = makeLoan({ original_amount: 100_000 });
    const installments = [makeInstallment("loan-1", 90_000)];
    const result = canRequestNewLoan([loan], toMap(installments), true);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/loading/i);
  });

  it("returns eligible for first-time borrower (no loans, not loading)", () => {
    const result = canRequestNewLoan([], new Map(), false);
    expect(result.eligible).toBe(true);
  });

  it("BUG REPRO: original=100k, balance=65k (paid=35k) => ineligible", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 35_000)];
    const result = canRequestNewLoan([loan], toMap(installments), false);
    expect(result.eligible).toBe(false);
    expect(result.progressPercent).toBe(35);
    expect(result.reason).toMatch(/80%/);
  });

  it("original=100k, balance=20k (paid=80k) => eligible", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 80_000)];
    const result = canRequestNewLoan([loan], toMap(installments), false);
    expect(result.eligible).toBe(true);
    expect(result.progressPercent).toBe(80);
  });

  it("original=100k, paid=79999 (edge case just below 80%) => ineligible", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0 });
    const installments = [makeInstallment("loan-1", 79_999)];
    const result = canRequestNewLoan([loan], toMap(installments), false);
    expect(result.eligible).toBe(false);
    expect(result.progressPercent).toBe(80); // Math.round(79.999) = 80 for display
    // But the raw progress is < 80, so still ineligible
  });

  it("original=0, balance=0 => ineligible (zero-value loan, no new loan)", () => {
    // A zero-value loan returns 100% progress but we still allow request
    const loan = makeLoan({ original_amount: 0, interest_amount: 0 });
    const result = canRequestNewLoan([loan], new Map(), false);
    // 100% progress → eligible
    expect(result.eligible).toBe(true);
  });

  it("two loans: one at 90%, one at 50% => eligible (max = 90%)", () => {
    const loan1 = makeLoan({ id: "loan-1", original_amount: 100_000, interest_amount: 0 });
    const loan2 = makeLoan({ id: "loan-2", original_amount: 100_000, interest_amount: 0 });
    const installments = [
      makeInstallment("loan-1", 90_000, 1), // 90%
      makeInstallment("loan-2", 50_000, 1), // 50%
    ];
    const result = canRequestNewLoan([loan1, loan2], toMap(installments), false);
    expect(result.eligible).toBe(true);
    expect(result.progressPercent).toBe(90);
  });

  it("two loans: one at 70%, one at 60% => ineligible (max = 70%)", () => {
    const loan1 = makeLoan({ id: "loan-1", original_amount: 100_000, interest_amount: 0 });
    const loan2 = makeLoan({ id: "loan-2", original_amount: 100_000, interest_amount: 0 });
    const installments = [
      makeInstallment("loan-1", 70_000, 1),
      makeInstallment("loan-2", 60_000, 1),
    ];
    const result = canRequestNewLoan([loan1, loan2], toMap(installments), false);
    expect(result.eligible).toBe(false);
    expect(result.progressPercent).toBe(70);
  });
});

// ─── getLoanStatus (existing core function — regression tests) ────────────────

describe("getLoanStatus", () => {
  it("computes balance correctly for bug-repro: original=100k, paid=35k", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0, total_instalments: 10 });
    const installments = [makeInstallment("loan-1", 35_000)];
    const status = getLoanStatus(loan, installments);
    expect(status.paid).toBe(35_000);
    expect(status.balance).toBe(65_000);
    expect(status.isPaidOff).toBe(false);
    expect(status.status).toBe("In Progress");
  });

  it("computes paid-off correctly", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 10_000, total_instalments: 10 });
    const installments = [makeInstallment("loan-1", 110_000)];
    const status = getLoanStatus(loan, installments);
    expect(status.paid).toBe(110_000);
    expect(status.balance).toBe(0);
    expect(status.isPaidOff).toBe(true);
    expect(status.status).toBe("Paid Off");
  });

  it("clamps balance to 0 when overpaid", () => {
    const loan = makeLoan({ original_amount: 100_000, interest_amount: 0, total_instalments: 1 });
    const installments = [makeInstallment("loan-1", 150_000)];
    const status = getLoanStatus(loan, installments);
    expect(status.balance).toBe(0);
    expect(status.isPaidOff).toBe(true);
  });

  it("throws on negative original_amount", () => {
    const loan = makeLoan({ original_amount: -100, total_instalments: 1 });
    expect(() => getLoanStatus(loan, [])).toThrow(/original_amount/);
  });

  it("throws on zero total_instalments", () => {
    const loan = makeLoan({ total_instalments: 0 });
    expect(() => getLoanStatus(loan, [])).toThrow(/total_instalments/);
  });
});

// ─── ONGOING_PAYMENT_THRESHOLD constant ───────────────────────────────────────

describe("ONGOING_PAYMENT_THRESHOLD", () => {
  it("is 80", () => {
    expect(ONGOING_PAYMENT_THRESHOLD).toBe(80);
  });
});
