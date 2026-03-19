import type { AuditLogEntry } from "../../types";

const AMOUNT_KEYS = [
  "derived_amount",
  "deleted_amount",
  "created_amount",
  "original_amount",
  "previous_amount",
  "amount",
  "subscription_amount",
  "installment_amount",
  "loan_amount",
  "value",
  "adjustment_amount",
  "misc_amount",
  "new_amount",
];

const HUMANIZED_FIELD_LABELS: Record<string, string> = {
  receipt_number: "Receipt Number",
  receipt: "Receipt",
  notes: "Remarks",
  payment_date: "Date",
  date: "Date",
  late_fee: "Late Fee",
};

const IGNORED_CHANGE_FIELDS = new Set(["updated_at", "created_at"]);
const CREATE_STYLE_ACTIONS = new Set(["create", "adjust_misc_create"]);
const DELETE_STYLE_ACTIONS = new Set(["soft_delete", "permanent_delete"]);

export interface AuditSentenceDirectories {
  adminDirectory: Record<string, string>;
  customerDirectory: Record<string, string>;
  entityCustomerNames: Record<string, string>;
}

export const normalizeAuditSearch = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export const getEntityKey = (entityType: string, entityId: string) =>
  `${entityType}:${entityId}`;

export const toAuditMetadata = (entry: AuditLogEntry): Record<string, unknown> => {
  const value = entry.metadata;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

export const toText = (value: unknown): string | null => {
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const toAmount = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

export const renderScalar = (value: unknown): string => {
  if (value === null) return "—";
  if (value === "") return "(empty string)";
  if (value === undefined) return "(missing)";
  return String(value);
};

const getExplicitAuditAmount = (entry: AuditLogEntry): number | null => {
  const metadata = toAuditMetadata(entry);
  const changes = metadata.changes as
    | { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }
    | undefined;
  const before = changes?.before ?? null;
  const after = changes?.after ?? null;

  for (const key of AMOUNT_KEYS) {
    const found = toAmount(metadata[key]);
    if (found !== null) return found;
  }

  const updates = metadata.updates;
  if (updates && typeof updates === "object" && !Array.isArray(updates)) {
    const updatesRecord = updates as Record<string, unknown>;
    const found = toAmount(updatesRecord.amount);
    if (found !== null) return found;
  }

  if (after && typeof after === "object") {
    const found = toAmount((after as Record<string, unknown>).amount);
    if (found !== null) return found;
  }

  if (before && typeof before === "object") {
    const found = toAmount((before as Record<string, unknown>).amount);
    if (found !== null) return found;
  }

  return null;
};

const getAuditAmount = (entry: AuditLogEntry) => {
  const explicit = getExplicitAuditAmount(entry);
  return explicit;
};

export const getEntityLabel = (entityType: string) => {
  switch (entityType) {
    case "loan":
      return "Loan";
    case "subscription":
      return "Subscription";
    case "installment":
      return "Installment";
    case "data_entry":
      return "Data Entry";
    case "customer":
      return "Customer";
    default:
      return entityType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

export const getActionLabel = (action: string) => {
  switch (action) {
    case "soft_delete":
      return "Deleted";
    case "permanent_delete":
      return "Permanently Deleted";
    case "restore":
      return "Restored";
    case "create":
      return "Added";
    case "update":
      return "Updated";
    case "adjust_misc":
    case "adjust_misc_create":
      return "Adjusted";
    default:
      return action
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

export const formatCurrency = (value: number) =>
  value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const getChangeBoundaryValue = (
  entry: AuditLogEntry,
  side: "before" | "after",
  value: unknown,
): unknown => {
  if (value !== undefined) {
    return value;
  }

  if (
    side === "before" &&
    (CREATE_STYLE_ACTIONS.has(entry.action) || DELETE_STYLE_ACTIONS.has(entry.action))
  ) {
    return null;
  }

  return undefined;
};

const getHumanReadableAuditValue = (
  entry: AuditLogEntry,
  key: string,
  value: unknown,
  adminDirectory: Record<string, string>,
): unknown => {
  const text = toText(value);
  if (!text) {
    return value;
  }

  if (key.endsWith("_by") || key === "admin_uid") {
    const metadata = toAuditMetadata(entry);
    return (
      adminDirectory[text] ||
      adminDirectory[entry.admin_uid] ||
      toText(metadata.actor_name) ||
      toText(metadata.actor_email) ||
      text
    );
  }

  return value;
};

const getChangedFieldKeys = (entry: AuditLogEntry): string[] => {
  const metadata = toAuditMetadata(entry);
  const changed = metadata.fields_changed;
  if (Array.isArray(changed)) {
    return changed.filter((k): k is string => typeof k === "string");
  }

  const changes = metadata.changes as
    | { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }
    | undefined;
  const before = changes?.before ?? {};
  const after = changes?.after ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys).filter((k) => before[k] !== after[k]);
};

export const getFieldChangeText = (
  entry: AuditLogEntry,
  adminDirectory: Record<string, string> = {},
): string | null => {
  const metadata = toAuditMetadata(entry);
  const changes = metadata.changes as
    | { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }
    | undefined;
  const before = changes?.before ?? {};
  const after = changes?.after ?? {};

  const keys = getChangedFieldKeys(entry)
    .filter((key) => !IGNORED_CHANGE_FIELDS.has(key))
    .filter((key) => key !== "amount");

  if (!keys.length) return null;

  const details = keys.map((key) => {
    const label = HUMANIZED_FIELD_LABELS[key] || key.replace(/_/g, " ");
    const beforeValue = renderScalar(
      getHumanReadableAuditValue(
        entry,
        key,
        getChangeBoundaryValue(entry, "before", before[key]),
        adminDirectory,
      ),
    );
    const afterValue = renderScalar(
      getHumanReadableAuditValue(
        entry,
        key,
        getChangeBoundaryValue(entry, "after", after[key]),
        adminDirectory,
      ),
    );
    return `${label}: ${beforeValue} → ${afterValue}`;
  });

  return details.join("; ");
};

export const getAmountDiffText = (entry: AuditLogEntry): string | null => {
  const metadata = toAuditMetadata(entry);
  const changes = metadata.changes as
    | { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }
    | undefined;
  const previousAmount =
    toAmount(changes?.before?.amount) ??
    toAmount(metadata.previous_amount) ??
    toAmount(metadata.original_amount);
  const newAmount =
    toAmount(changes?.after?.amount) ??
    toAmount(metadata.new_amount) ??
    null;
  const deletedAmount = toAmount(metadata.deleted_amount);
  const explicitAmount = getAuditAmount(entry);

  if (entry.action === "update" || entry.action === "adjust_misc") {
    if (previousAmount !== null && newAmount !== null) {
      return `${formatCurrency(previousAmount)} → ${formatCurrency(newAmount)}`;
    }
    if (newAmount !== null) {
      return formatCurrency(newAmount);
    }
    if (previousAmount !== null) {
      return formatCurrency(previousAmount);
    }
  }

  if (entry.action === "soft_delete" || entry.action === "permanent_delete") {
    const value = deletedAmount ?? explicitAmount;
    if (value !== null) {
      return `deleted ${formatCurrency(value)}`;
    }
  }

  if (entry.action === "create" || entry.action === "adjust_misc_create") {
    const value = newAmount ?? explicitAmount;
    if (value !== null) {
      return formatCurrency(value);
    }
  }

  if (explicitAmount !== null) {
    return formatCurrency(explicitAmount);
  }

  return null;
};

export const formatAuditTimeIst = (timestamp: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(timestamp));

export const isQuarterlyInterestEntry = (entry: AuditLogEntry) => {
  if (entry.entity_type === "quarterly_interest_run") {
    return true;
  }
  const metadata = toAuditMetadata(entry);
  return toText(metadata.source) === "quarterly-interest-cron";
};

export const buildAuditSentence = (
  entry: AuditLogEntry,
  directories: AuditSentenceDirectories,
): string => {
  const metadata = toAuditMetadata(entry);
  const actorName =
    toText(metadata.actor_name) ||
    toText(metadata.actor_email) ||
    directories.adminDirectory[entry.admin_uid] ||
    toText(entry.admin_uid) ||
    "Admin user";

  const customerId =
    entry.entity_type === "customer"
      ? entry.entity_id
      : toText(metadata.customer_id);
  const customerNameFromMetadata = toText(metadata.customer_name);
  const customerNameFromLookup = customerId
    ? directories.customerDirectory[customerId]
    : null;
  const entityCustomerName = entry.entity_id
    ? directories.entityCustomerNames[getEntityKey(entry.entity_type, entry.entity_id)]
    : null;

  const actionLabel = getActionLabel(entry.action);
  const entityLabel = getEntityLabel(entry.entity_type);
  const resolvedCustomerName =
    customerNameFromMetadata ||
    (entry.entity_type === "customer" ? toText(metadata.name) : null) ||
    customerNameFromLookup ||
    entityCustomerName ||
    "Unknown Customer";
  const amountText = getAmountDiffText(entry);
  const fieldText = getFieldChangeText(entry, directories.adminDirectory);

  const baseSentence = `Admin ${renderScalar(actorName)} ${actionLabel} ${entityLabel} for ${renderScalar(resolvedCustomerName)}`;
  const detailParts = [amountText, fieldText].filter(Boolean) as string[];
  return detailParts.length
    ? `${baseSentence} — ${detailParts.join(" | ")}`
    : baseSentence;
};

export const initialAuditPageCursors = (): Record<number, string | null> => ({
  1: null,
});

export const updateAuditPageCursors = (
  previous: Record<number, string | null>,
  nextPage: number,
  currentCursor: string | null,
  nextCursor: string | null,
): Record<number, string | null> => {
  const updated: Record<number, string | null> = {
    ...previous,
    [nextPage]: currentCursor,
  };

  for (const page of Object.keys(updated)) {
    const pageNumber = Number(page);
    if (pageNumber > nextPage + 1) {
      delete updated[pageNumber];
    }
  }

  if (nextCursor) {
    updated[nextPage + 1] = nextCursor;
  } else {
    delete updated[nextPage + 1];
  }

  return updated;
};
