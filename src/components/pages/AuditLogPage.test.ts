import { describe, expect, it } from "vitest";
import type { AuditLogEntry, Json } from "../../types";
import { getFieldChangeText } from "./AuditLogPage";

const buildEntry = (
  action: string,
  entityType: string,
  after: Record<string, unknown>,
): AuditLogEntry => ({
  id: "audit-1",
  admin_uid: "admin-uid",
  action,
  entity_type: entityType,
  entity_id: "entity-1",
  created_at: new Date().toISOString(),
  metadata: ({
    changes: {
      after,
    },
  } as unknown) as Json,
});

describe("AuditLogPage field change formatting", () => {
  it("uses expected baseline marker for create data entry changes", () => {
    const entry = buildEntry("create", "data_entry", {
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

    expect(text).toContain("id: — → 199");
    expect(text).toContain("customer id: — → c66e9af6-5f71-4950-8d94-f8c9b3a90bdf");
    expect(text).toContain("Date: — → 2018-06-30");
    expect(text).toContain("Receipt Number: — → (empty string)");
    expect(text).toContain("Remarks: — → Garland and Shall");
    expect(text).toContain("payment method: — → Cash");
    expect(text).not.toContain("(missing)");
  });

  it("uses expected baseline marker for create subscription changes", () => {
    const entry = buildEntry("create", "subscription", {
      id: "548828b0-1960-4c09-a041-bf5079be679d",
      customer_id: "c66e9af6-5f71-4950-8d94-f8c9b3a90bdf",
      date: "2018-02-02",
      receipt: "1140",
      late_fee: 0,
      deleted_at: null,
      deleted_by: null,
    });

    const text = getFieldChangeText(entry);

    expect(text).toContain("id: — → 548828b0-1960-4c09-a041-bf5079be679d");
    expect(text).toContain("customer id: — → c66e9af6-5f71-4950-8d94-f8c9b3a90bdf");
    expect(text).toContain("Date: — → 2018-02-02");
    expect(text).toContain("Receipt: — → 1140");
    expect(text).toContain("Late Fee: — → 0");
    expect(text).not.toContain("(missing)");
  });

  it("resolves deleted_by to an admin display name when available", () => {
    const entry = buildEntry("soft_delete", "customer", {
      deleted_at: "2026-03-17T13:20:31.597Z",
      deleted_by: "c34dedcb-a4da-4836-b349-dd55b2008f5f",
    });

    const text = getFieldChangeText(entry, {
      "c34dedcb-a4da-4836-b349-dd55b2008f5f": "Admin I J Reddy",
    });

    expect(text).toContain("deleted at: — → 2026-03-17T13:20:31.597Z");
    expect(text).toContain("deleted by: — → Admin I J Reddy");
    expect(text).not.toContain("c34dedcb-a4da-4836-b349-dd55b2008f5f");
  });
});
