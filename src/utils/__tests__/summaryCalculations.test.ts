import { describe, expect, it } from "vitest";
import type { DataEntry } from "../../types";
import { calculateSummaryData } from "../summaryCalculations";

const makeEntry = (overrides: Partial<DataEntry>): DataEntry => ({
  id: overrides.id ?? "entry-1",
  customer_id: overrides.customer_id ?? "customer-1",
  date: overrides.date ?? "2026-04-01",
  amount: overrides.amount ?? 0,
  receipt_number: overrides.receipt_number ?? "",
  type: overrides.type ?? "credit",
  notes: overrides.notes,
  subtype: overrides.subtype ?? null,
  payment_method: overrides.payment_method ?? null,
});

describe("calculateSummaryData", () => {
  it("keeps mutual funds savings separate from data collected and expenses", () => {
    const dataEntries = [
      makeEntry({ id: "credit", type: "credit", amount: 1000 }),
      makeEntry({
        id: "expense",
        type: "expenditure",
        subtype: "Misc Expense",
        amount: 250,
      }),
      makeEntry({
        id: "savings",
        type: "savings",
        subtype: "Mutual Funds",
        amount: 5000,
      }),
    ];

    const summary = calculateSummaryData([], [], [], dataEntries);

    expect(summary.totalDataCollected).toBe(750);
    expect(summary.totalExpenses).toBe(250);
    expect(summary.totalMutualFunds).toBe(5000);
    expect(summary.totalSavings).toBe(5000);
  });
});