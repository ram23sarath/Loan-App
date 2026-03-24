import { describe, expect, it } from "vitest";
import type { AuditLogEntry, Json } from "../../types";
import {
  buildAuditSentence,
  getAmountDiffText,
  getFieldChangeText,
  initialAuditPageCursors,
  isQuarterlyInterestEntry,
  normalizeAuditSearch,
  updateAuditPageCursors,
} from "./auditLogHelpers";

const buildEntry = (
  action: string,
  entityType: string,
  metadata: Record<string, unknown>,
): AuditLogEntry => ({
  id: "audit-1",
  admin_uid: "admin-uid",
  action,
  entity_type: entityType,
  entity_id: "entity-1",
  created_at: new Date().toISOString(),
  metadata: metadata as Json,
});

const buildCreateEntry = (entityType: string, after: Record<string, unknown>) =>
  buildEntry("create", entityType, {
    changes: {
      after,
    },
  });

describe("AuditLogPage field change formatting", () => {
  it("uses expected baseline marker for create data entry changes", () => {
    const entry = buildCreateEntry("data_entry", {
      id: 199,
      customer_id: "c66e9af6-5f71-4950-8d94-f8c9b3a90bdf",
      date: "2018-06-30",
      receipt_number: "",
      notes: "Garland and Shall",
      type: "expenditure",
      subtype: "Retirement Gift",
      payment_method: "Cash",
      deleted_at: null,
      deleted_by: null,
    });

    const text = getFieldChangeText(entry);

    // id and customer_id are now ignored (internal fields)
    expect(text).not.toContain("id:");
    expect(text).not.toContain("customer id");
    // deleted_at/deleted_by with null values should be filtered (— → —)
    expect(text).not.toContain("Deleted At");
    expect(text).not.toContain("Deleted By");
    // Meaningful fields should appear without before→after arrows (just values)
    expect(text).toContain("Date: 2018-06-30");
    expect(text).not.toContain("→");
    // Empty receipt_number should be omitted (optional field not meaningfully entered)
    expect(text).not.toContain("Receipt Number");
    expect(text).toContain("Remarks: Garland and Shall");
    expect(text).toContain("Payment Method: Cash");
    expect(text).toContain("Subtype: Retirement Gift");
    expect(text).not.toContain("(missing)");
  });

  it("uses expected baseline marker for create subscription changes", () => {
    const entry = buildCreateEntry("subscription", {
      id: "548828b0-1960-4c09-a041-bf5079be679d",
      customer_id: "c66e9af6-5f71-4950-8d94-f8c9b3a90bdf",
      date: "2018-02-02",
      receipt: "1140",
      late_fee: 0,
      deleted_at: null,
      deleted_by: null,
    });

    const text = getFieldChangeText(entry);

    // id and customer_id are now ignored
    expect(text).not.toContain("id:");
    expect(text).not.toContain("customer id");
    // deleted_at/deleted_by with null values should be filtered
    expect(text).not.toContain("Deleted At");
    expect(text).not.toContain("Deleted By");
    // Meaningful fields should appear without arrows
    expect(text).toContain("Date: 2018-02-02");
    expect(text).toContain("Receipt: 1140");
    expect(text).toContain("Late Fee: 0");
    expect(text).not.toContain("→");
    expect(text).not.toContain("(missing)");
  });

  it("resolves deleted_by to an admin display name when available", () => {
    const entry = buildEntry("soft_delete", "customer", {
      changes: {
        after: {
          deleted_at: "2026-03-17T13:20:31.597Z",
          deleted_by: "c34dedcb-a4da-4836-b349-dd55b2008f5f",
        },
      },
    });

    const text = getFieldChangeText(entry, {
      "c34dedcb-a4da-4836-b349-dd55b2008f5f": "Admin I J Reddy",
    });

    expect(text).toContain("Deleted At: — → 2026-03-17T13:20:31.597Z");
    expect(text).toContain("Deleted By: — → Admin I J Reddy");
    expect(text).not.toContain("c34dedcb-a4da-4836-b349-dd55b2008f5f");
  });

  it("omits fields where both before and after are null", () => {
    const entry = buildCreateEntry("data_entry", {
      date: "2025-01-01",
      amount: 500,
      deleted_at: null,
      deleted_by: null,
    });

    const text = getFieldChangeText(entry);

    expect(text).not.toContain("Deleted At");
    expect(text).not.toContain("Deleted By");
    expect(text).toContain("Date");
  });

  it("treats empty string as null sentinel in update actions", () => {
    const entry = buildEntry("update", "data_entry", {
      changes: {
        before: { notes: "" },
        after: { notes: "Garland and Shall" },
      },
    });

    const text = getFieldChangeText(entry);

    // Empty string should render as — (null sentinel), not (empty string)
    expect(text).toContain("Remarks: — → Garland and Shall");
    expect(text).not.toContain("(empty string)");
  });

  it("filters out lines where both before and after are empty strings in update actions", () => {
    const entry = buildEntry("update", "data_entry", {
      changes: {
        before: { notes: "" },
        after: { notes: "" },
      },
    });

    const text = getFieldChangeText(entry);

    // When both are empty, the line should be filtered out (both render as —)
    expect(text).toBeNull();
  });
});

describe("AuditLogPage amount diff formatting", () => {
  it("renders before and after amount for updates", () => {
    const entry = buildEntry("update", "loan", {
      changes: {
        before: { amount: 1000 },
        after: { amount: 2500 },
      },
    });

    expect(getAmountDiffText(entry)).toBe("1,000 → 2,500");
  });

  it("renders deleted amount for delete actions", () => {
    const entry = buildEntry("soft_delete", "subscription", {
      deleted_amount: "4300",
    });

    expect(getAmountDiffText(entry)).toBe("deleted 4,300");
  });

  it("shows absolute value for negative amounts in adjustments", () => {
    const entry = buildEntry("adjust_misc", "subscription", {
      previous_amount: 1000,
      new_amount: -3515,
    });

    expect(getAmountDiffText(entry)).toBe("1,000 → 3,515");
  });
});

describe("AuditLogPage sentence rendering", () => {
  it("builds a readable sentence with fallbacks", () => {
    const entry = buildEntry("create", "loan", {
      changes: {
        after: {
          amount: 12000,
        },
      },
      customer_id: "cust-1",
    });

    const sentence = buildAuditSentence(entry, {
      adminDirectory: { "admin-uid": "A. Kumar" },
      customerDirectory: { "cust-1": "Shyam Traders" },
      entityCustomerNames: {},
    });

    expect(sentence).toContain("A. Kumar Added Loan for Shyam Traders");
    expect(sentence).toContain("Amount:");
    expect(sentence).toContain("12,000");
    expect(sentence).not.toContain("Admin A. Kumar");
    expect(sentence).not.toContain("undefined");
    expect(sentence).not.toContain("null");
  });
});

describe("AuditLogPage quarterly classification", () => {
  it("classifies explicit quarterly_interest_run entries", () => {
    const entry = buildEntry("create", "quarterly_interest_run", {
      source: "something-else",
    });
    expect(isQuarterlyInterestEntry(entry)).toBe(true);
  });

  it("classifies entries marked by quarterly-interest source", () => {
    const entry = buildEntry("update", "customer", {
      source: "quarterly-interest-cron",
    });
    expect(isQuarterlyInterestEntry(entry)).toBe(true);
  });

  it("does not classify entries only by quarter label", () => {
    const entry = buildEntry("update", "customer", {
      quarter: "Q1",
    });
    expect(isQuarterlyInterestEntry(entry)).toBe(false);
  });
});

describe("AuditLogPage search and cursor helpers", () => {
  it("normalizes search input before apply", () => {
    expect(normalizeAuditSearch("   admin    name   ")).toBe("admin name");
  });

  it("resets and updates cursor map deterministically", () => {
    const start = initialAuditPageCursors();
    expect(start).toEqual({ 1: null });

    const page1 = updateAuditPageCursors(start, 1, null, "cursor-2");
    expect(page1).toEqual({ 1: null, 2: "cursor-2" });

    const page2 = updateAuditPageCursors(page1, 2, "cursor-2", "cursor-3");
    expect(page2).toEqual({ 1: null, 2: "cursor-2", 3: "cursor-3" });

    const backTo1 = updateAuditPageCursors(page2, 1, null, null);
    expect(backTo1).toEqual({ 1: null });
  });
});
