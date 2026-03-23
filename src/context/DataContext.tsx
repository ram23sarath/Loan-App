import React, {
  createContext,
  useState,
  useContext,
  useRef,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "../lib/supabase";
import { apiRequest } from "../lib/apiClient";
import { loadAppData, loadGlobalSummaryRecords, resolveScopedCustomer } from "../lib/dataLoaders";
import type { Session } from "@supabase/supabase-js";
import type {
  Customer,
  Loan,
  Subscription,
  Installment,
  NewCustomer,
  NewLoan,
  NewSubscription,
  NewInstallment,
  LoanWithCustomer,
  SubscriptionWithCustomer,
  DataEntry,
  NewDataEntry,
} from "../types";
import { checkAndNotifyOverdueInstallments } from "../utils/notificationHelpers";
import { getLoanStatus } from "../utils/loanStatus";
import { NOTIFICATION_TYPES, NOTIFICATION_STATUSES } from "../../shared/notificationSchema.js";

// ============================================================================
// ERROR CLASSIFICATION & STRUCTURED LOGGING
// ============================================================================

const ERROR_CATEGORY = {
  NETWORK: "NETWORK",
  RATE_LIMIT: "RATE_LIMIT",
  TIMEOUT: "TIMEOUT",
  AUTH: "AUTH",
  SESSION: "SESSION",
  RLS: "RLS",
  VALIDATION: "VALIDATION",
  SERVER: "SERVER",
  UNKNOWN: "UNKNOWN",
} as const;

type ErrorCategory = typeof ERROR_CATEGORY[keyof typeof ERROR_CATEGORY];

const classifyError = (error: any): ErrorCategory => {
  if (!error) return ERROR_CATEGORY.UNKNOWN;

  const msg = (error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "").toLowerCase();
  const status: number = error?.status ?? error?.statusCode ?? 0;

  // Offline / network unreachable
  if (
    typeof navigator !== "undefined" && !navigator.onLine
  ) return ERROR_CATEGORY.NETWORK;

  // Browser-level fetch failures (covers Chrome, Firefox, Safari, Edge)
  if (
    msg === "failed to fetch" ||  // Chrome / Firefox / Edge
    msg === "load failed" ||  // Safari / WebKit
    msg.includes("networkerror") ||  // Firefox legacy
    msg.includes("network request failed") || // react-native / older browsers
    msg.includes("fetch is aborted") ||
    msg.includes("net::err_") ||  // Chrome DevTools error strings
    msg.includes("err_internet_disconnected") ||
    msg.includes("err_name_not_resolved") ||
    msg.includes("err_connection_refused")
  ) return ERROR_CATEGORY.NETWORK;

  // Timeout
  if (
    error?.name === "AbortError" ||
    msg.includes("timeout") ||
    msg.includes("timed out")
  ) return ERROR_CATEGORY.TIMEOUT;

  // Rate limiting (Supabase returns 429 with these codes/messages)
  if (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "too_many_requests" ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("email rate limit exceeded")
  ) return ERROR_CATEGORY.RATE_LIMIT;

  // Server / service unavailable
  if (status >= 500 && status < 600) return ERROR_CATEGORY.SERVER;

  // Auth credential errors
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("email not confirmed") ||
    msg.includes("user not found") ||
    code === "invalid_credentials" ||
    code === "user_not_found" ||
    code === "email_not_confirmed"
  ) return ERROR_CATEGORY.AUTH;

  // Session / token errors
  if (
    msg.includes("refresh_token_not_found") ||
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    code === "refresh_token_not_found" ||
    code === "session_not_found"
  ) return ERROR_CATEGORY.SESSION;

  // Row Level Security / permission denied
  if (
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    code === "42501"                           // PostgreSQL RLS violation
  ) return ERROR_CATEGORY.RLS;

  // Database constraint / validation errors
  if (
    code === "23505" || // unique_violation
    code === "23503" || // foreign_key_violation
    code === "23502" || // not_null_violation
    code === "22p02"    // invalid_text_representation
  ) return ERROR_CATEGORY.VALIDATION;

  return ERROR_CATEGORY.UNKNOWN;
};

const logStructuredError = (
  error: any,
  context: string,
  category: ErrorCategory,
): void => {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : "unknown";
  const timestamp = new Date().toISOString();

  const logPayload: Record<string, any> = {
    timestamp,
    category,
    context,
    online: isOnline,
    message: error?.message ?? String(error),
    code: error?.code ?? null,
    status: error?.status ?? error?.statusCode ?? null,
    hint: error?.hint ?? null,
    details: error?.details ?? null,
    name: error?.name ?? null,
  };

  // Only attach raw error in dev builds to avoid leaking internals in production
  if (import.meta.env?.DEV) {
    logPayload.rawError = error;
  }

  console.error(`[AppError][${category}] ${context}`, logPayload);

  // Category-specific diagnostic hints in the console to aid debugging
  switch (category) {
    case ERROR_CATEGORY.NETWORK:
      console.warn(
        `[AppError] Network diagnostic — online: ${isOnline}\n` +
        `  1. Can the user reach https://lhffcmefliaptsijuyay.supabase.co directly?\n` +
        `  2. Is supabase.co blocked by a firewall, VPN, or corporate proxy?\n` +
        `  3. Is the Supabase project paused? (Check Supabase dashboard)\n` +
        `  4. Check Network tab in DevTools for the exact browser-level error code.`
      );
      break;
    case ERROR_CATEGORY.RATE_LIMIT:
      console.warn(
        `[AppError] Rate limit hit.\n` +
        `  • Supabase free tier: ~60 auth requests/hour per IP.\n` +
        `  • Check Supabase Dashboard → Auth → Logs for 429 responses.\n` +
        `  • Affected IP may need to wait up to 1 hour before retrying.`
      );
      break;
    case ERROR_CATEGORY.SESSION:
      console.warn(
        `[AppError] Session/token invalid or expired.\n` +
        `  • Stored refresh token may have been rotated or revoked.\n` +
        `  • User must log in again to obtain a fresh session.`
      );
      break;
    case ERROR_CATEGORY.SERVER:
      console.warn(
        `[AppError] Supabase server error (${logPayload.status}).\n` +
        `  • Check https://status.supabase.com for ongoing incidents.\n` +
        `  • This is transient — retry after a short delay.`
      );
      break;
    case ERROR_CATEGORY.RLS:
      console.warn(
        `[AppError] Row Level Security policy blocked the request.\n` +
        `  • Check Supabase Dashboard → Table Editor → Policies for the affected table.\n` +
        `  • Ensure the authenticated user has the required SELECT/INSERT/UPDATE/DELETE policy.`
      );
      break;
  }
};

const parseSupabaseError = (error: any, context: string): string => {
  const category = classifyError(error);
  logStructuredError(error, context, category);

  if (error && typeof error === "object" && "message" in error) {
    const supabaseError = error as {
      message: string;
      details?: string;
      hint?: string;
      code?: string;
      status?: number;
    };

    switch (category) {
      case ERROR_CATEGORY.NETWORK: {
        const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
        if (!isOnline) {
          return `You appear to be offline. Please check your internet connection and try again.`;
        }
        return `Network Error: Cannot reach the server. Please check your internet connection. If the issue persists on multiple networks, your ISP or firewall may be blocking access.`;
      }
      case ERROR_CATEGORY.RATE_LIMIT:
        return `Too many login attempts. You have been temporarily rate-limited. Please wait a few minutes before trying again.`;
      case ERROR_CATEGORY.TIMEOUT:
        return `Request timed out. The server is taking too long to respond. Please try again.`;
      case ERROR_CATEGORY.SERVER:
        return `Server Error (${supabaseError.status ?? "5xx"}): The server encountered an issue. Please try again in a moment.`;
      case ERROR_CATEGORY.SESSION:
        return `Your session has expired or is no longer valid. Please log in again.`;
      case ERROR_CATEGORY.AUTH:
        if (supabaseError.message.toLowerCase().includes("email not confirmed")) {
          return `Your email has not been confirmed. Please check your inbox and verify your email before logging in.`;
        }
        return `Invalid email or password. Please try again.`;
      case ERROR_CATEGORY.RLS:
        return `Database Connection Successful, but Permission Denied.\n\nThis is likely a Row Level Security (RLS) issue. Please check your Supabase dashboard to ensure RLS policies allow the current user to perform this action.`;
      case ERROR_CATEGORY.VALIDATION:
        if (supabaseError.code === "23505") {
          return `Failed to add record: A record with a similar unique value (e.g., phone number or receipt) already exists.`;
        }
        return `Validation Error: ${supabaseError.message}`;
      default:
        return `Error: ${supabaseError.message}`;
    }
  }

  return `An unexpected error occurred while ${context}. Please try again.`;
};

const AUTH_REQUEST_TIMEOUT_MS = 12000;
const AUTH_MAX_RETRIES = 2;

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const withAuthTimeout = async <T,>(
  operation: () => Promise<T>,
  timeoutMs: number,
  context: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        const timeoutError = new Error(
          `Auth request timed out after ${timeoutMs}ms while ${context}`,
        ) as Error & { name: string };
        timeoutError.name = "AbortError";
        reject(timeoutError);
      }, timeoutMs);
    });

    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const runAuthWithRetry = async <T,>(
  operation: () => Promise<T>,
  context: string,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
  },
): Promise<T> => {
  const timeoutMs = options?.timeoutMs ?? AUTH_REQUEST_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? AUTH_MAX_RETRIES;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await withAuthTimeout(operation, timeoutMs, context);
    } catch (error) {
      lastError = error;
      const category = classifyError(error);
      const retryable =
        category === ERROR_CATEGORY.NETWORK ||
        category === ERROR_CATEGORY.TIMEOUT ||
        category === ERROR_CATEGORY.SERVER;

      if (!retryable || attempt === maxRetries) {
        break;
      }

      const delayMs = Math.min(4000, 700 * 2 ** attempt);
      console.warn(
        `[AuthRetry] ${context} failed (attempt ${attempt + 1}/${maxRetries + 1}, category: ${category}). Retrying in ${delayMs}ms...`,
      );
      await wait(delayMs);
    }
  }

  throw lastError;
};

// ... [DataContextType interface remains unchanged] ...
interface DataContextType {
  session: Session | null;
  customers: Customer[];
  loans: LoanWithCustomer[];
  subscriptions: SubscriptionWithCustomer[];
  installments: Installment[];
  dataEntries: DataEntry[];
  loading: boolean;
  isAuthChecking: boolean;
  isRefreshing: boolean;
  isScopedCustomer: boolean;
  scopedCustomerId: string | null;
  // Lookup maps for O(1) access
  customerMap: Map<string, Customer>;
  installmentsByLoanId: Map<string, Installment[]>;
  signInWithPassword: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  addCustomer: (customer: Omit<NewCustomer, "user_id">) => Promise<Customer>;
  updateCustomer: (
    customerId: string,
    updates: Partial<Customer>,
  ) => Promise<Customer>;
  addLoan: (loan: NewLoan) => Promise<Loan>;
  updateLoan: (loanId: string, updates: Partial<Loan>) => Promise<Loan>;
  addSubscription: (subscription: NewSubscription) => Promise<Subscription>;
  updateSubscription: (
    subscriptionId: string,
    updates: Partial<Subscription>,
  ) => Promise<Subscription>;
  adjustSubscriptionForMisc: (
    customerId: string,
    amount: number,
    date?: string,
  ) => Promise<void>;
  addInstallment: (installment: NewInstallment) => Promise<Installment>;
  updateInstallment: (
    installmentId: string,
    updates: Partial<Installment>,
  ) => Promise<Installment>;
  addDataEntry: (entry: NewDataEntry) => Promise<DataEntry>;
  deleteDataEntry: (id: string) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  deleteLoan: (loanId: string) => Promise<void>;
  deleteSubscription: (subscriptionId: string) => Promise<void>;
  deleteInstallment: (installmentId: string) => Promise<void>;
  seniorityList: Array<any>;
  deletedSeniorityList: Array<any>;
  fetchSeniorityList: (
    overrideSession?: Session | null,
    overrideIsScoped?: boolean,
  ) => Promise<void>;
  fetchDeletedSeniorityList: () => Promise<void>;
  addToSeniority: (
    customerId: string,
    details?: {
      station_name?: string;
      loan_type?: string;
      loan_request_date?: string;
    },
  ) => Promise<void>;
  updateSeniority: (
    id: string,
    updates: {
      station_name?: string | null;
      loan_type?: string | null;
      loan_request_date?: string | null;
    },
  ) => Promise<void>;
  removeFromSeniority: (id: string) => Promise<void>;
  restoreSeniorityEntry: (id: string) => Promise<void>;
  permanentDeleteSeniority: (id: string) => Promise<void>;
  // Data entries soft delete
  deletedDataEntries: DataEntry[];
  fetchDeletedDataEntries: () => Promise<void>;
  restoreDataEntry: (id: string) => Promise<void>;
  permanentDeleteDataEntry: (id: string) => Promise<void>;
  // Subscriptions soft delete
  deletedSubscriptions: SubscriptionWithCustomer[];
  fetchDeletedSubscriptions: () => Promise<void>;
  restoreSubscription: (id: string) => Promise<void>;
  permanentDeleteSubscription: (id: string) => Promise<void>;
  // Loans soft delete
  deletedLoans: LoanWithCustomer[];
  fetchDeletedLoans: () => Promise<void>;
  restoreLoan: (id: string) => Promise<void>;
  permanentDeleteLoan: (id: string) => Promise<void>;
  // Installments soft delete
  deletedInstallments: Installment[];
  fetchDeletedInstallments: () => Promise<void>;
  restoreInstallment: (id: string) => Promise<void>;
  permanentDeleteInstallment: (id: string) => Promise<void>;
  // Customers soft delete
  deletedCustomers: Customer[];
  fetchDeletedCustomers: () => Promise<void>;
  restoreCustomer: (id: string) => Promise<void>;
  permanentDeleteCustomer: (id: string) => Promise<void>;
  // Summary data (unfiltered for all users)
  summaryLoans: LoanWithCustomer[];
  summarySubscriptions: SubscriptionWithCustomer[];
  summaryInstallments: Installment[];
  summaryDataEntries: DataEntry[];
  fetchSummaryData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Helper function to fetch all records from a table (handles pagination automatically)
const BATCH_SIZE = 1000;
const fetchAllRecords = async <T,>(
  queryBuilder: () => ReturnType<ReturnType<typeof supabase.from>["select"]>,
  tableName?: string,
): Promise<T[]> => {
  const allRecords: T[] = [];
  let from = 0;
  let hasMore = true;
  let batchNum = 0;

  while (hasMore) {
    batchNum++;
    const { data, error } = await queryBuilder().range(
      from,
      from + BATCH_SIZE - 1,
    );
    if (error) throw error;
    if (data && data.length > 0) {
      allRecords.push(...(data as T[]));
      from += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allRecords;
};

// Build seniority query with proper filtering and ordering
const buildSeniorityQuery = () =>
  supabase
    .from("loan_seniority")
    .select("*, customers(name, phone, deleted_at)")
    .is("deleted_at", null)
    .order("loan_request_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

const buildDataCacheKey = (isScoped: boolean, scopedCustomerId: string | null) =>
  isScoped && scopedCustomerId ? `data_scoped_${scopedCustomerId}` : "data_admin";

const normalizeSnapshotForCompare = (snapshot: Record<string, unknown> | null) =>
  snapshot
    ? {
        customers: snapshot.customers || [],
        loans: snapshot.loans || [],
        subscriptions: snapshot.subscriptions || [],
        installments: snapshot.installments || [],
        dataEntries: snapshot.dataEntries || [],
      }
    : null;

// Fetch unfiltered global records for summary page (used by both fetchSummaryData and background pre-fetch)
const fetchGlobalSummaryRecords = async () => {
  const [loans, subscriptions, installments, dataEntries] = await Promise.all([
    fetchAllRecords<LoanWithCustomer>(
      () =>
        supabase
          .from("loans")
          .select("*, customers(name, phone)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      "loans",
    ),
    fetchAllRecords<SubscriptionWithCustomer>(
      () =>
        supabase
          .from("subscriptions")
          .select("*, customers(name, phone)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      "subscriptions",
    ),
    fetchAllRecords<Installment>(
      () =>
        supabase
          .from("installments")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      "installments",
    ),
    fetchAllRecords<DataEntry>(
      () =>
        supabase
          .from("data_entries")
          .select("*")
          .is("deleted_at", null)
          .order("date", { ascending: false }),
      "data_entries",
    ),
  ]);
  return { loans, subscriptions, installments, dataEntries };
};

// Cache helper functions
// Uses localStorage which is available in both web and Android WebView
// (domStorageEnabled is set to true on the WebView component).
const getCachedData = (key: string) => {
  try {
    const cached = localStorage.getItem(`loan_app_cache_${key}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Cache valid for 5 minutes
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        return data;
      }
    }
  } catch (err) {
    console.error("Error reading from cache:", err);
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  const cacheKey = `loan_app_cache_${key}`;
  const payload = JSON.stringify({ data, timestamp: Date.now() });

  try {
    localStorage.setItem(cacheKey, payload);
  } catch (err: any) {
    // Check if this is a quota-exceeded error
    const isQuotaExceeded =
      err.code === 22 || // QuotaExceededError code
      err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      (err.message && err.message.includes("quota"));

    if (isQuotaExceeded) {
      console.warn("[Cache] localStorage quota exceeded, attempting LRU eviction...");

      try {
        // Collect all cache entries with their timestamps
        const cacheEntries: Array<{ key: string; timestamp: number }> = [];

        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i);
          if (!storageKey || !storageKey.startsWith("loan_app_cache_")) {
            continue;
          }

          try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed.timestamp !== undefined) {
                cacheEntries.push({
                  key: storageKey,
                  timestamp: parsed.timestamp,
                });
              }
            }
          } catch {
            // Skip entries that can't be parsed
          }
        }

        // Sort by timestamp ascending (oldest first)
        cacheEntries.sort((a, b) => a.timestamp - b.timestamp);

        // Delete oldest entries until we have space
        let freed = false;
        for (const entry of cacheEntries) {
          if (freed) break;
          try {
            localStorage.removeItem(entry.key);
            console.log(`[Cache] Evicted oldest entry: ${entry.key}`);
            freed = true;
          } catch (removeErr) {
            console.error(`[Cache] Failed to evict ${entry.key}:`, removeErr);
          }
        }

        // Retry the original setItem once
        if (freed) {
          try {
            localStorage.setItem(cacheKey, payload);
            console.log("[Cache] Successfully wrote to cache after eviction");
            return;
          } catch (retryErr) {
            console.error(
              "[Cache] Failed to write to cache even after eviction:",
              retryErr,
            );
          }
        } else {
          console.error(
            "[Cache] No evictable entries found to free space",
          );
        }
      } catch (evictionErr) {
        console.error("[Cache] Error during LRU eviction process:", evictionErr);
      }
    } else {
      // Non-quota errors
      console.error("Error writing to cache:", err);
    }
  }
};

const clearCache = (key?: string) => {
  try {
    if (key) {
      localStorage.removeItem(`loan_app_cache_${key}`);
    } else {
      // Clear all cache keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith("loan_app_cache_")) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (err) {
    console.error("Error clearing cache:", err);
  }
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeAuditUuid = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
};

type AuditSnapshot = Record<string, unknown> | null;

const DEFAULT_AUDIT_REDACTION = {
  redactKeys: ["password", "passcode", "token", "access_token", "refresh_token", "ssn", "credit_card", "auth0_id"],
  mask: "<REDACTED>",
};

const redactAuditObject = (
  input: unknown,
  policy: { redactKeys: string[]; mask: string } = DEFAULT_AUDIT_REDACTION,
): unknown => {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((v) => redactAuditObject(v, policy));
  if (typeof input !== "object") return input;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const shouldRedact = policy.redactKeys.some((rk) => rk.toLowerCase() === key.toLowerCase());
    out[key] = shouldRedact ? policy.mask : redactAuditObject(value, policy);
  }
  return out;
};

const extractChangedFields = (
  before: AuditSnapshot,
  after: AuditSnapshot,
): string[] => {
  if (!before && !after) return [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return Array.from(keys).filter((k) => before?.[k] !== after?.[k]);
};

const buildAuditChangeMetadata = (
  before: AuditSnapshot,
  after: AuditSnapshot,
) => ({
  changes: {
    before,
    after,
  },
  fields_changed: extractChangedFields(before, after),
});

/** Fire-and-forget audit log insert — records actions for admin users. */
const logAuditEvent = (
  session: Session | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
) => {
  const uid = session?.user?.id;
  const role = String(session?.user?.app_metadata?.role || "").toLowerCase();
  const isAdminFlag = Boolean(
    session?.user?.app_metadata?.is_admin ?? session?.user?.user_metadata?.is_admin,
  );
  const envSuperAdminUid = import.meta.env.VITE_SUPER_ADMIN_UID?.trim() || "";
  const isEnvOverrideUid = Boolean(envSuperAdminUid && uid === envSuperAdminUid);
  const isAdminRole = role === "admin" || role === "super_admin";

  if (!uid || (!isAdminRole && !isAdminFlag && !isEnvOverrideUid)) return;

  const actorName =
    (session?.user?.user_metadata?.name as string | undefined) ||
    (session?.user?.app_metadata?.name as string | undefined) ||
    (session?.user?.email ? String(session.user.email).split("@")[0] : undefined) ||
    uid;
  const actorEmail = session?.user?.email || null;
  const normalizedAdminUid = normalizeAuditUuid(uid);
  if (!normalizedAdminUid) return;

  const normalizedEntityId = normalizeAuditUuid(entityId);
  const hasRawEntityId = typeof entityId === "string" && entityId.trim().length > 0;

  supabase
    .from("admin_audit_log")
    .insert({
      admin_uid: normalizedAdminUid,
      action,
      entity_type: entityType,
      entity_id: normalizedEntityId,
      metadata: {
        ...(redactAuditObject(metadata ?? {}) as Record<string, unknown>),
        ...(hasRawEntityId && !normalizedEntityId
          ? { raw_entity_id: String(entityId).trim() }
          : {}),
        actor_name: actorName,
        actor_email: actorEmail,
      } as import("../types").Json,
    })
    .then(({ error }) => {
      if (error) {
        // Enhanced error logging for debugging
        console.error("[AuditLog] ❌ Failed to record event", {
          action,
          entity_type: entityType,
          original_entity_id: entityId,
          normalized_entity_id: normalizedEntityId,
          has_raw_entity_id: hasRawEntityId,
          admin_uid: normalizedAdminUid,
          error_code: error?.code,
          error_message: error?.message,
          error_hint: error?.hint,
          error_details: error?.details,
          full_error: error,
        });
      }
    });
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<LoanWithCustomer[]>([]);
  const [subscriptions, setSubscriptions] = useState<
    SubscriptionWithCustomer[]
  >([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [seniorityList, setSeniorityList] = useState<any[]>([]);
  const [deletedSeniorityList, setDeletedSeniorityList] = useState<any[]>([]);
  const [deletedDataEntries, setDeletedDataEntries] = useState<DataEntry[]>([]);
  const [deletedSubscriptions, setDeletedSubscriptions] = useState<
    SubscriptionWithCustomer[]
  >([]);
  const [deletedLoans, setDeletedLoans] = useState<LoanWithCustomer[]>([]);
  const [deletedInstallments, setDeletedInstallments] = useState<Installment[]>(
    [],
  );
  const [deletedCustomers, setDeletedCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataEntries, setDataEntries] = useState<DataEntry[]>([]);
  const [isScopedCustomer, setIsScopedCustomer] = useState(false);
  const [scopedCustomerId, setScopedCustomerId] = useState<string | null>(null);

  // Summary data (unfiltered global data for summary page)
  const [summaryLoans, setSummaryLoans] = useState<LoanWithCustomer[]>([]);
  const [summarySubscriptions, setSummarySubscriptions] = useState<
    SubscriptionWithCustomer[]
  >([]);
  const [summaryInstallments, setSummaryInstallments] = useState<Installment[]>(
    [],
  );
  const [summaryDataEntries, setSummaryDataEntries] = useState<DataEntry[]>([]);
  const summaryDataLoadedRef = useRef(false);
  const summaryDataFetchingRef = useRef(false);

  // Lazily fetch unfiltered summary data — for admins reuses context data, for scoped users uses cache-first pattern
  const fetchSummaryData = useCallback(async () => {
    try {
      if (!isScopedCustomer) {
        // Admin: always sync from context data (cheap copy, stays up to date)
        setSummaryLoans(loans);
        setSummarySubscriptions(subscriptions);
        setSummaryInstallments(installments);
        setSummaryDataEntries(dataEntries);
      } else {
        // Scoped user: serve from cache immediately, then refresh from network

        // Step 1: Serve cached data instantly for fast render
        const cached = getCachedData("summary_global");
        if (cached && !summaryDataLoadedRef.current) {
          setSummaryLoans(cached.loans || []);
          setSummarySubscriptions(cached.subscriptions || []);
          setSummaryInstallments(cached.installments || []);
          setSummaryDataEntries(cached.dataEntries || []);
        }

        // Step 2: If already loaded from network this session, stop
        if (summaryDataLoadedRef.current) return;

        // Step 3: Guard against concurrent fetches
        if (summaryDataFetchingRef.current) {
          console.log("[DataContext] Summary data fetch already in progress, skipping duplicate request");
          return;
        }

        // Mark fetch as in progress
        summaryDataFetchingRef.current = true;

        try {
          // Fetch fresh data from network (background refresh)
          const { loans: allLoans, subscriptions: allSubs, installments: allInstallments, dataEntries: allEntries } =
            await loadGlobalSummaryRecords();
          setSummaryLoans(allLoans);
          setSummarySubscriptions(allSubs);
          setSummaryInstallments(allInstallments);
          setSummaryDataEntries(allEntries);
          summaryDataLoadedRef.current = true;

          // Step 4: Update cache for next time
          setCachedData("summary_global", {
            loans: allLoans,
            subscriptions: allSubs,
            installments: allInstallments,
            dataEntries: allEntries,
          });
        } finally {
          // Always reset the fetching flag, even if an error occurred
          summaryDataFetchingRef.current = false;
        }
      }
    } catch (error) {
      console.error("Error fetching summary data:", error);
    }
  }, [isScopedCustomer, loans, subscriptions, installments, dataEntries]);

  // Lookup maps for O(1) access - improves performance from O(n) to O(1)
  const customerMap = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c]));
  }, [customers]);

  const installmentsByLoanId = useMemo(() => {
    const map = new Map<string, Installment[]>();
    installments.forEach((inst) => {
      const existing = map.get(inst.loan_id) || [];
      existing.push(inst);
      map.set(inst.loan_id, existing);
    });
    // Sort each loan's installments by date (newest first) for consistency
    map.forEach((insts, loanId) => {
      insts.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      map.set(loanId, insts);
    });
    return map;
  }, [installments]);

  const applyDataSnapshot = useCallback((snapshot: Awaited<ReturnType<typeof loadAppData>>) => {
    setCustomers(snapshot.customers);
    setLoans(snapshot.loans);
    setSubscriptions(snapshot.subscriptions);
    setInstallments(snapshot.installments);
    setDataEntries(snapshot.dataEntries);
  }, []);

  // UPDATED: Accepts optional arguments. If provided, uses them; otherwise falls back to state.
  // This allows the useEffect to call it with calculated values before state updates commit.
  // NOTE: No dependency array needed since we're using overrides during initialization
  const fetchData = useCallback(
    async (overrideIsScoped?: boolean, overrideScopedId?: string | null) => {
      try {
        // Don't set isRefreshing during initialization - only during user-triggered refreshes
        // Check if we're being called during initialization by checking if overrides are provided
        const isInitialization =
          overrideIsScoped !== undefined || overrideScopedId !== undefined;
        if (!isInitialization) {
          setIsRefreshing(true);
        }

        // Use overrides if they are explicitly passed (even if false/null), otherwise use state
        const effectiveIsScoped =
          overrideIsScoped !== undefined ? overrideIsScoped : isScopedCustomer;
        const effectiveScopedId =
          overrideScopedId !== undefined ? overrideScopedId : scopedCustomerId;

        const snapshot = await loadAppData({
          isScoped: effectiveIsScoped,
          scopedCustomerId: effectiveScopedId,
        });
        applyDataSnapshot(snapshot);

        if (!effectiveIsScoped) {
          checkAndNotifyOverdueInstallments(
            snapshot.installments,
            snapshot.loans,
            snapshot.customers,
          ).catch((notificationErr) => {
            console.error(
              "Error checking overdue installments:",
              notificationErr,
            );
          });
        }
      } catch (error: any) {
        console.error("Error in fetchData:", error);
        alert(parseSupabaseError(error, "fetching data"));
      } finally {
        // Only reset isRefreshing if it was set (user-triggered refresh, not initialization)
        const isInitialization =
          overrideIsScoped !== undefined || overrideScopedId !== undefined;
        if (!isInitialization) {
          setIsRefreshing(false);
        }
      }
    },
    [applyDataSnapshot, isScopedCustomer, scopedCustomerId],
  );

  // UPDATED: Accepts optional arguments to avoid stale state during initialization and auth state changes.
  // If provided, uses them; otherwise falls back to state.
  const fetchSeniorityList = useCallback(
    async (overrideSession?: Session | null, overrideIsScoped?: boolean) => {
      try {
        // Use overrides if they are explicitly passed, otherwise use state
        const effectiveSession =
          overrideSession !== undefined ? overrideSession : session;
        const effectiveIsScoped =
          overrideIsScoped !== undefined ? overrideIsScoped : isScopedCustomer;

        if (
          !effectiveSession ||
          !effectiveSession.user ||
          !effectiveSession.user.id
        ) {
          setSeniorityList([]);
          return;
        }

        let query = supabase
          .from("loan_seniority")
          .select("*, customers(name, phone, deleted_at)")
          .is("deleted_at", null)
          .order("loan_request_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });
        // All users (including scoped) see the full seniority list
        // Primary sort uses loan_request_date so requested dates dictate the order,
        // with created_at providing a tie-breaker for same-day entries.
        // Filter by deleted_at IS NULL to exclude soft-deleted entries

        const { data, error } = await query;
        if (error) {
          console.error("Supabase error fetching loan_seniority:", error);
          throw error;
        }
        const rawSeniority = (data as any[]) || [];
        setSeniorityList(rawSeniority.filter((e: any) => !e.customers?.deleted_at));
      } catch (err: any) {
        console.error("Failed to fetch loan seniority list", err);
      }
    },
    [session, isScopedCustomer],
  );

  // Fetch deleted seniority entries (admin only - RLS enforced)
  const fetchDeletedSeniorityList = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedSeniorityList([]);
        return;
      }

      const { data, error } = await supabase
        .from("loan_seniority")
        .select("*, customers(name, phone)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted loan_seniority:", error);
        throw error;
      }
      setDeletedSeniorityList((data as any[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted seniority list", err);
      setDeletedSeniorityList([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted data entries (admin only - RLS enforced)
  const fetchDeletedDataEntries = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedDataEntries([]);
        return;
      }

      const { data, error } = await supabase
        .from("data_entries")
        .select("*, customers(name, phone)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted data_entries:", error);
        throw error;
      }
      setDeletedDataEntries((data as any[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted data entries", err);
      setDeletedDataEntries([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted subscriptions (admin only - RLS enforced)
  const fetchDeletedSubscriptions = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedSubscriptions([]);
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, customers(name, phone)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted subscriptions:", error);
        throw error;
      }
      setDeletedSubscriptions((data as SubscriptionWithCustomer[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted subscriptions", err);
      setDeletedSubscriptions([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted loans (admin only - RLS enforced)
  const fetchDeletedLoans = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedLoans([]);
        return;
      }

      const { data, error } = await supabase
        .from("loans")
        .select("*, customers(name, phone)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted loans:", error);
        throw error;
      }
      setDeletedLoans((data as LoanWithCustomer[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted loans", err);
      setDeletedLoans([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted installments (admin only - RLS enforced)
  const fetchDeletedInstallments = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedInstallments([]);
        return;
      }

      const { data, error } = await supabase
        .from("installments")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted installments:", error);
        throw error;
      }
      setDeletedInstallments((data as Installment[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted installments", err);
      setDeletedInstallments([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted customers (admin only - RLS enforced)
  const fetchDeletedCustomers = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedCustomers([]);
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted customers:", error);
        throw error;
      }
      setDeletedCustomers((data as Customer[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted customers", err);
      setDeletedCustomers([]);
    }
  }, [session, isScopedCustomer]);

  // ... [addToSeniority, removeFromSeniority, updateSeniority functions remain unchanged] ...
  const addToSeniority = async (
    customerId: string,
    details?: {
      station_name?: string;
      loan_type?: string;
      loan_request_date?: string;
    },
  ) => {
    if (
      isScopedCustomer &&
      scopedCustomerId &&
      customerId !== scopedCustomerId
    ) {
      throw new Error(
        "Read-only access: scoped customers can only request seniority for their own account",
      );
    }
    try {
      if (!session || !session.user) throw new Error("Not authenticated");

      // Check if customer is already in the seniority list (active, not deleted)
      const { data: existingEntry, error: checkError } = await supabase
        .from("loan_seniority")
        .select("id")
        .eq("customer_id", customerId)
        .is("deleted_at", null)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingEntry) {
        throw new Error("This customer is already in the loan seniority list.");
      }

      const payload: any = {
        user_id: session.user.id,
        customer_id: customerId,
      };
      if (details) {
        if (details.station_name) payload.station_name = details.station_name;
        if (details.loan_type) payload.loan_type = details.loan_type;
        if (details.loan_request_date)
          payload.loan_request_date = details.loan_request_date;
      }
      const { data, error } = await supabase
        .from("loan_seniority")
        .insert([payload])
        .select()
        .single();
      if (error || !data) throw error;
      const customerName = await resolveCustomerName(customerId);
      logAuditEvent(session, "create", "seniority", data.id, {
        customer_id: customerId,
        customer_name: customerName,
        ...details,
        ...buildAuditChangeMetadata(null, (data as AuditSnapshot) ?? null),
      });

      // Notify admins if this was a scoped request
      if (isScopedCustomer) {
        try {
          const customer = customerMap.get(customerId);
          const name = customer?.name || "A customer";
          await supabase.from("system_notifications").insert({
            type: NOTIFICATION_TYPES.SENIORITY_REQUEST,
            status: NOTIFICATION_STATUSES.PENDING,
            message: `${name} requested For Loan Seniority: ${details?.loan_type || "General"
              }`,
            metadata: { customer_id: customerId, ...details },
          });
        } catch (notifyErr) {
          console.error("Failed to send system notification:", notifyErr);
        }
      }

      await fetchSeniorityList();
    } catch (err: any) {
      // Pass through the specific error message if it's our duplicate check
      if (
        err.message === "This customer is already in the loan seniority list."
      ) {
        throw err;
      }
      throw new Error(
        parseSupabaseError(
          err,
          `adding customer ${customerId} to seniority list`,
        ),
      );
    }
  };

  const resolveCustomerName = async (
    customerId: string | null | undefined,
  ): Promise<string | null> => {
    if (!customerId) return null;
    const fromMap = customerMap.get(customerId)?.name;
    if (fromMap) return fromMap;

    const { data } = await supabase
      .from("customers")
      .select("name")
      .eq("id", customerId)
      .maybeSingle();

    return ((data as { name?: string } | null)?.name ?? null) || null;
  };

  const removeFromSeniority = async (id: string) => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot modify seniority list",
      );
    try {
      const { data: beforeRow } = await supabase
        .from("loan_seniority")
        .select("*")
        .eq("id", id)
        .single();
      const customerId =
        (beforeRow as { customer_id?: string } | null)?.customer_id ?? null;
      const customerName = await resolveCustomerName(customerId);
      // Soft delete: set deleted_at timestamp instead of hard delete
      const deletedAt = new Date().toISOString();
      const deletedBy = session?.user?.id || session?.user?.email || null;
      const { error } = await supabase
        .from("loan_seniority")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("id", id);
      if (error) throw error;
      logAuditEvent(session, "soft_delete", "seniority", id, {
        customer_id: customerId,
        customer_name: customerName,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          {
            ...((beforeRow as Record<string, unknown>) ?? {}),
            deleted_at: deletedAt,
            deleted_by: deletedBy,
          },
        ),
      });
      await fetchSeniorityList();
      await fetchDeletedSeniorityList();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `removing seniority item ${id}`));
    }
  };

  const restoreSeniorityEntry = async (id: string) => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore seniority entries",
      );
    try {
      const { data: beforeRow } = await supabase
        .from("loan_seniority")
        .select("*")
        .eq("id", id)
        .single();
      const customerId =
        (beforeRow as { customer_id?: string } | null)?.customer_id ?? null;
      const customerName = await resolveCustomerName(customerId);
      // Restore soft-deleted entry by clearing deleted_at
      const { error } = await supabase
        .from("loan_seniority")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      logAuditEvent(session, "restore", "seniority", id, {
        customer_id: customerId,
        customer_name: customerName,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          {
            ...((beforeRow as Record<string, unknown>) ?? {}),
            deleted_at: null,
            deleted_by: null,
          },
        ),
      });
      await fetchSeniorityList();
      await fetchDeletedSeniorityList();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `restoring seniority item ${id}`),
      );
    }
  };

  const permanentDeleteSeniority = async (id: string) => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete seniority entries",
      );
    try {
      // Defensive check: verify the entry is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("loan_seniority")
        .select("id, customer_id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: entry must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the entry
      const beforeSnapshot = (entry as AuditSnapshot) ?? null;
      const { error } = await supabase
        .from("loan_seniority")
        .delete()
        .eq("id", id);
      if (error) throw error;
      logAuditEvent(session, "permanent_delete", "seniority", id, {
        customer_id: (entry as { customer_id?: string } | null)?.customer_id ?? null,
        customer_name: await resolveCustomerName(
          (entry as { customer_id?: string } | null)?.customer_id ?? null,
        ),
        ...buildAuditChangeMetadata(beforeSnapshot, null),
      });
      await fetchDeletedSeniorityList();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting seniority item ${id}`),
      );
    }
  };

  const updateSeniority = async (
    id: string,
    updates: {
      station_name?: string | null;
      loan_type?: string | null;
      loan_request_date?: string | null;
    },
  ) => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot modify seniority list",
      );
    try {
      const { data: beforeRow } = await supabase
        .from("loan_seniority")
        .select("*")
        .eq("id", id)
        .single();
      const { data, error } = await supabase
        .from("loan_seniority")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) throw error;
      const customerId =
        (data as { customer_id?: string } | null)?.customer_id ??
        (beforeRow as { customer_id?: string } | null)?.customer_id ??
        null;
      logAuditEvent(session, "update", "seniority", id, {
        customer_id: customerId,
        customer_name: await resolveCustomerName(customerId),
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          (data as AuditSnapshot) ?? null,
        ),
      });
      await fetchSeniorityList();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `updating seniority item ${id}`));
    }
  };

  // ... [All CRUD operations remain unchanged] ...
  const updateCustomer = async (
    customerId: string,
    updates: Partial<Customer>,
  ): Promise<Customer> => {
    // Allow scoped customers to update only their own station_name
    if (isScopedCustomer) {
      const isOwnRecord = customerId === scopedCustomerId;
      const isOnlyStationName =
        Object.keys(updates).length === 1 && "station_name" in updates;
      if (!isOwnRecord || !isOnlyStationName) {
        throw new Error(
          "Read-only access: scoped customers can only update their own station name",
        );
      }
    }

    // Capture previous phone from in-memory map so we can detect changes
    const previous = customerMap.get(customerId);
    const previousPhone = previous?.phone ?? null;
    const { data: beforeRow } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    try {
      const { data, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", customerId)
        .select()
        .single();
      if (error || !data) throw error;
      logAuditEvent(session, "update", "customer", customerId, {
        customer_id: customerId,
        customer_name: data.name ?? previous?.name ?? null,
        previous_phone: previousPhone,
        new_phone: data.phone ?? null,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          (data as AuditSnapshot) ?? null,
        ),
      });

      await fetchData();

      // If admin changed phone, trigger server-side update of the auth user
      if (
        !isScopedCustomer &&
        updates.phone &&
        updates.phone !== previousPhone
      ) {
        (async () => {
          try {
            // Call directly to Supabase to update auth user
            // Note: This is a client-side call but uses RLS-protected data
            await apiRequest(
              "/.netlify/functions/update-user-from-customer",
              {
                method: "POST",
                headers: {
                  ...(session?.access_token
                    ? { Authorization: `Bearer ${session.access_token}` }
                    : {}),
                },
                body: {
                  customer_id: customerId,
                  phone: updates.phone,
                  admin_uid: session?.user?.id ?? null,
                  actor_name:
                    (session?.user?.user_metadata?.name as string | undefined) ||
                    (session?.user?.app_metadata?.name as string | undefined) ||
                    (session?.user?.email
                      ? String(session.user.email).split("@")[0]
                      : null),
                  actor_email: session?.user?.email ?? null,
                },
                timeoutMs: 15000,
              },
            );
            console.log(
              `Successfully synced auth credentials for customer ${customerId} to phone ${updates.phone}`,
            );
          } catch (err) {
            console.error(
              "Failed to update auth user after phone change:",
              err,
            );
          }
        })();
      }

      return data as Customer;
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `updating customer ${customerId}`),
      );
    }
  };

  const updateLoan = async (
    loanId: string,
    updates: Partial<Loan>,
  ): Promise<Loan> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot perform updates",
      );
    try {
      const { data: beforeRow } = await supabase
        .from("loans")
        .select("*")
        .eq("id", loanId)
        .single();
      const previousLoan = loans.find((loan) => loan.id === loanId);
      const { data, error } = await supabase
        .from("loans")
        .update(updates)
        .eq("id", loanId)
        .select()
        .single();
      if (error || !data) throw error;
      const customerName =
        previousLoan?.customers?.name ||
        customerMap.get(data.customer_id)?.name ||
        null;
      logAuditEvent(session, "update", "loan", loanId, {
        customer_id: data.customer_id,
        customer_name: customerName,
        previous_amount: previousLoan?.original_amount ?? null,
        new_amount: data.original_amount ?? null,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          (data as AuditSnapshot) ?? null,
        ),
      });
      // Optimistically update local state
      setLoans((prev) =>
        prev.map((loan) =>
          loan.id === loanId
            ? ({ ...loan, ...data } as LoanWithCustomer)
            : loan,
        ),
      );
      return data as Loan;
    } catch (error) {
      throw new Error(parseSupabaseError(error, `updating loan ${loanId}`));
    }
  };

  const updateSubscription = async (
    subscriptionId: string,
    updates: Partial<Subscription>,
  ): Promise<Subscription> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot perform updates",
      );
    try {
      const { data: beforeRow } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .single();
      const previousSubscription = subscriptions.find(
        (subscription) => subscription.id === subscriptionId,
      );
      const { data, error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", subscriptionId)
        .select()
        .single();
      if (error || !data) throw error;
      const customerName =
        previousSubscription?.customers?.name ||
        customerMap.get(data.customer_id)?.name ||
        null;
      logAuditEvent(session, "update", "subscription", subscriptionId, {
        customer_id: data.customer_id,
        customer_name: customerName,
        previous_amount: previousSubscription?.amount ?? null,
        new_amount: data.amount ?? null,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          (data as AuditSnapshot) ?? null,
        ),
      });
      // Optimistically update local state
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === subscriptionId
            ? ({ ...sub, ...data } as SubscriptionWithCustomer)
            : sub,
        ),
      );
      return data as Subscription;
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `updating subscription ${subscriptionId}`),
      );
    }
  };

  const adjustSubscriptionForMisc = async (
    customerId: string,
    amount: number,
    date?: string,
  ): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot perform subscription adjustments",
      );
    try {
      const { data: subs, error: subsError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("customer_id", customerId)
        .order("date", { ascending: false })
        .limit(1);
      if (subsError) throw subsError;
      if (subs && subs.length > 0) {
        const sub = subs[0] as Subscription;
        const newAmount = Number(sub.amount) - Number(amount);
        const { data, error } = await supabase
          .from("subscriptions")
          .update({ amount: newAmount })
          .eq("id", sub.id)
          .select()
          .single();
        if (error) throw error;
        logAuditEvent(session, "adjust_misc", "subscription", sub.id, {
          customer_id: customerId,
          customer_name: customerMap.get(customerId)?.name || null,
          adjustment_amount: amount,
          previous_amount: sub.amount,
          new_amount: newAmount,
          date: date || null,
        });
      } else {
        const now = date || new Date().toISOString().slice(0, 10);
        const year = new Date(now).getFullYear();
        const newSub = {
          customer_id: customerId,
          amount: -Math.abs(Number(amount)),
          year,
          date: now,
          receipt: "misc-subscription-adjustment",
        };
        const { data, error } = await supabase
          .from("subscriptions")
          .insert([newSub])
          .select()
          .single();
        if (error) throw error;
        logAuditEvent(session, "adjust_misc_create", "subscription", data?.id ?? null, {
          customer_id: customerId,
          customer_name: customerMap.get(customerId)?.name || null,
          adjustment_amount: amount,
          previous_amount: null,
          new_amount: newSub.amount,
          created_amount: newSub.amount,
          date: now,
        });
      }
      await fetchData();
    } catch (error) {
      throw new Error(
        parseSupabaseError(
          error,
          `adjusting subscription for misc entry for customer ${customerId}`,
        ),
      );
    }
  };

  const updateInstallment = async (
    installmentId: string,
    updates: Partial<Installment>,
  ): Promise<Installment> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot perform updates",
      );
    try {
      const { data: beforeRow } = await supabase
        .from("installments")
        .select("*")
        .eq("id", installmentId)
        .single();
      const previousInstallment = installments.find(
        (installment) => installment.id === installmentId,
      );
      const { data, error } = await supabase
        .from("installments")
        .update(updates)
        .eq("id", installmentId)
        .select()
        .single();
      if (error || !data) throw error;
      const parentLoan = loans.find((loan) => loan.id === data.loan_id);
      const customerId = parentLoan?.customer_id || null;
      const customerName =
        parentLoan?.customers?.name ||
        (customerId ? customerMap.get(customerId)?.name : null) ||
        null;
      logAuditEvent(session, "update", "installment", installmentId, {
        loan_id: data.loan_id,
        customer_id: customerId,
        customer_name: customerName,
        previous_amount: previousInstallment?.amount ?? null,
        new_amount: data.amount ?? null,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          (data as AuditSnapshot) ?? null,
        ),
      });
      // Optimistically update local state
      setInstallments((prev) =>
        prev.map((inst) =>
          inst.id === installmentId ? (data as Installment) : inst,
        ),
      );
      return data as Installment;
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `updating installment ${installmentId}`),
      );
    }
  };

  const clearData = () => {
    setCustomers([]);
    setLoans([]);
    setSubscriptions([]);
    setInstallments([]);
    setDataEntries([]);
    setSummaryLoans([]);
    setSummarySubscriptions([]);
    setSummaryInstallments([]);
    setSummaryDataEntries([]);
  };

  // ... [clearClientCache function remains unchanged] ...
  const clearClientCache = async () => {
    try {
      clearData();
      // Reset summary data loaded flag so fresh summary data can be fetched on new session
      summaryDataLoadedRef.current = false;
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage.clear();
      } catch (err) { }
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (!key) continue;
          const lower = key.toLowerCase();
          if (
            lower.includes("supabase") ||
            lower.startsWith("sb-") ||
            lower.includes("gotrue") ||
            lower === "loan_app_last_activity" ||
            (lower.includes("auth") && lower.includes("token"))
          ) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          try {
            window.localStorage.removeItem(k);
          } catch (e) { }
        }
      } catch (err) { }
      // ... [rest of cache clearing logic] ...
    } catch (err) {
      console.error("Error clearing client cache", err);
    }
  };

  // ... [addDataEntry, updateDataEntry, deleteDataEntry functions remain unchanged] ...
  const addDataEntry = async (entry: NewDataEntry): Promise<DataEntry> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot add data entries",
      );
    try {
      const { data, error } = await supabase
        .from("data_entries")
        .insert([entry])
        .select()
        .single();
      if (error || !data) throw error;
      logAuditEvent(session, "create", "data_entry", data.id, {
        customer_id: entry.customer_id,
        customer_name: customerMap.get(entry.customer_id)?.name || null,
        type: entry.type,
        amount: entry.amount,
        previous_amount: null,
        new_amount: entry.amount,
        ...buildAuditChangeMetadata(null, (data as AuditSnapshot) ?? null),
      });
      // Optimistically update local state — avoids full 5-table refetch
      setDataEntries((prev) => [data as DataEntry, ...prev]);
      try {
        if ((entry as any).subtype === "Subscription Return") {
          await adjustSubscriptionForMisc(
            entry.customer_id,
            Number(entry.amount),
            entry.date,
          );
          // adjustSubscriptionForMisc internally calls fetchData, which refetches
          // all 5 tables including subscriptions. No need for a redundant refetch here.
        }
      } catch (err) {
        console.error("Failed to adjust subscription for misc entry:", err);
      }
      return data as DataEntry;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding data entry"));
    }
  };

  const updateDataEntry = async (
    id: string,
    updates: Partial<DataEntry>,
  ): Promise<DataEntry> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot update data entries",
      );
    try {
      const { data: beforeRow } = await supabase
        .from("data_entries")
        .select("*")
        .eq("id", id)
        .single();
      const previousEntry = dataEntries.find((entry) => entry.id === id);
      const { data, error } = await supabase
        .from("data_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) throw error;
      logAuditEvent(session, "update", "data_entry", id, {
        customer_id: data.customer_id,
        customer_name: customerMap.get(data.customer_id)?.name || null,
        previous_amount: previousEntry?.amount ?? null,
        new_amount: data.amount ?? null,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          (data as AuditSnapshot) ?? null,
        ),
      });
      // Optimistically update local state with the returned data
      setDataEntries((prev) =>
        prev.map((entry) => (entry.id === id ? (data as DataEntry) : entry)),
      );
      return data as DataEntry;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "updating data entry"));
    }
  };

  const deleteDataEntry = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot delete data entries",
      );
    try {
      const targetEntry = dataEntries.find((entry) => entry.id === id);
      const { data: beforeRow } = await supabase
        .from("data_entries")
        .select("*")
        .eq("id", id)
        .single();
      // Soft delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("data_entries")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: session?.user?.id || session?.user?.email || null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      logAuditEvent(session, "soft_delete", "data_entry", id, {
        customer_id: targetEntry?.customer_id ?? null,
        customer_name:
          (targetEntry?.customer_id
            ? customerMap.get(targetEntry.customer_id)?.name
            : null) || null,
        deleted_amount: targetEntry?.amount ?? null,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          {
            ...((beforeRow as Record<string, unknown>) ?? {}),
            deleted_at: new Date().toISOString(),
            deleted_by: session?.user?.id || session?.user?.email || null,
          },
        ),
      });
      // Optimistically remove from local state
      setDataEntries((prev) => prev.filter((entry) => entry.id !== id));
      // Refresh trash view (lightweight compared to full fetchData)
      await fetchDeletedDataEntries();
    } catch (error) {
      throw new Error(parseSupabaseError(error, "deleting data entry"));
    }
  };

  const restoreDataEntry = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore data entries",
      );
    try {
      // Restore soft-deleted entry by clearing deleted_at
      const { data: beforeRow } = await supabase
        .from("data_entries")
        .select("*")
        .eq("id", id)
        .single();
      const { error } = await supabase
        .from("data_entries")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      logAuditEvent(session, "restore", "data_entry", id, {
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          {
            ...((beforeRow as Record<string, unknown>) ?? {}),
            deleted_at: null,
            deleted_by: null,
          },
        ),
      });
      // Fetch the restored data entry
      const { data: restoredEntry, error: fetchErr } = await supabase
        .from("data_entries")
        .select("*")
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;

      if (restoredEntry) {
        // Verify parent customer exists and is not soft-deleted
        const { data: customer, error: customerErr } = await supabase
          .from("customers")
          .select("id, deleted_at")
          .eq("id", (restoredEntry as any).customer_id)
          .single();

        if (customerErr && customerErr.code !== "PGRST116") throw customerErr;

        if (!customer || (customer as any).deleted_at !== null) {
          throw new Error(
            "Cannot restore: The parent customer has been deleted or does not exist. You can only permanently delete this data entry.",
          );
        }

        // Parent customer exists and is not deleted - safe to restore data entry
        setDataEntries((prev) => [restoredEntry as DataEntry, ...prev]);
      }
      // Refresh trash view (lightweight compared to full fetchData)
      await fetchDeletedDataEntries();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring data entry ${id}`));
    }
  };

  const permanentDeleteDataEntry = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete data entries",
      );
    try {
      // Defensive check: verify the entry is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("data_entries")
        .select("id, deleted_at, customer_id, amount")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: entry must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the entry
      const beforeSnapshot = (entry as AuditSnapshot) ?? null;
      const { error } = await supabase
        .from("data_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
      const customerId = (entry as any)?.customer_id ?? null;
      logAuditEvent(session, "permanent_delete", "data_entry", id, {
        customer_id: customerId,
        customer_name: customerId ? customerMap.get(customerId)?.name || null : null,
        deleted_amount: (entry as any)?.amount ?? null,
        ...buildAuditChangeMetadata(beforeSnapshot, null),
      });
      await fetchDeletedDataEntries();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting data entry ${id}`),
      );
    }
  };

  // Ref to track the last processed session token to prevent redundant updates
  const lastSessionTokenRef = React.useRef<string | null>(null);
  // Ref to track the last authenticated user ID to prevent redundant fetches on token refresh
  const lastUserIdRef = React.useRef<string | null>(null);

  // ============================================================================
  // NATIVE BRIDGE INTEGRATION - Mobile WebView Communication
  // ============================================================================
  // This effect registers handlers for messages from the native mobile wrapper
  // and notifies native when auth state changes. Only runs when inside native app.
  useEffect(() => {
    // Check if running in native app
    const isNative = typeof window !== "undefined" && window.isNativeApp?.();
    if (!isNative) return; // Skip on web

    console.log("[NativeBridge] Setting up message handlers in web app");

    // Create the native message handler callback
    const nativeHandler = (message: any) => {
      console.log("[NativeBridge] Received message from native:", message.type);

      switch (message.type) {
        case "AUTH_TOKEN": {
          // Native sent auth session - set it in Supabase
          const { accessToken, refreshToken } = message.payload;
          console.log("[NativeBridge] Setting session from native auth token");
          supabase.auth
            .setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            .then(() => {
              // Dispatch event to unblock the waiting Promise in initializeSession
              console.log(
                "[NativeBridge] Auth token set, dispatching native-auth-received event",
              );
              window.dispatchEvent(
                new CustomEvent("native-auth-received", {
                  detail: { success: true },
                }),
              );
            })
            .catch((err) => {
              console.error("[NativeBridge] Failed to set session:", err);

              // If refresh token is invalid, notify native to clear storage
              if (
                err?.code === "refresh_token_not_found" ||
                err?.message?.includes("refresh_token_not_found")
              ) {
                console.warn(
                  "[NativeBridge] Invalid refresh token - notifying native to clear storage",
                );
                window.NativeBridge?.logout();
              }

              // Still dispatch event so waiting Promise doesn't hang
              window.dispatchEvent(
                new CustomEvent("native-auth-received", {
                  detail: { success: false, error: err },
                }),
              );
            });
          break;
        }
        case "NATIVE_READY": {
          // Native wrapper is ready and initialized
          console.log("[NativeBridge] Native wrapper is ready");
          break;
        }
        case "PUSH_TOKEN": {
          // Native sent push token - store via authenticated RPC
          const { token, platform } = message.payload;
          console.log(
            "[NativeBridge] Storing push token:",
            token.substring(0, 20) + "...",
          );
          // Use 'as any' to bypass type checking - this RPC may not be in generated types yet
          (supabase.rpc as any)("update_push_token", {
            p_token: token,
            p_platform: platform,
          })
            .then(() => {
              console.log("[NativeBridge] Push token stored successfully");
            })
            .catch((err: any) =>
              console.warn("[NativeBridge] Failed to store push token:", err),
            );
          break;
        }
        case "NETWORK_STATUS": {
          // Handle offline/online state changes
          const { isConnected, type } = message.payload;
          console.log(
            "[NativeBridge] Network status:",
            isConnected ? "online" : "offline",
            `(${type})`,
          );
          // Could dispatch network state to context here if needed
          break;
        }
        case "APP_STATE": {
          // App moved to background/foreground
          console.log("[NativeBridge] App state:", message.payload.state);
          break;
        }
        case "DEEP_LINK": {
          // Deep link navigation from native
          const { url, path } = message.payload;
          console.log("[NativeBridge] Deep link received:", path);
          // Navigation is handled by native (via URL change in WebView)
          break;
        }
        default:
          if (import.meta.env?.DEV) {
            console.log("[NativeBridge] Unhandled message type:", message.type);
          }
      }
    };

    // Register handler for messages FROM native app
    const unsubscribe = window.registerNativeHandler?.(nativeHandler) as
      | (() => void)
      | undefined
      | void;

    console.log("[NativeBridge] Message handler registered");

    // Cleanup function: unregister the handler when component unmounts
    return () => {
      if (typeof unsubscribe === "function") {
        // If registerNativeHandler returns an unsubscribe function, call it
        unsubscribe();
      }
      console.log("[NativeBridge] Message handler unregistered");
    };
  }, []);

  // Report page render to native wrapper when DataProvider mounts.
  // This is a safety net: bridge.ts also sends PAGE_LOADED on window.load,
  // but this ensures it fires even if the bridge load event was missed.
  useEffect(() => {
    const isNative = typeof window !== "undefined" && window.isNativeApp?.();
    if (!isNative) return;

    // Small delay to ensure React has painted something visible
    const timer = setTimeout(() => {
      console.log(
        "[NativeBridge] Reporting page render to native (DataProvider mounted)",
      );
      window.NativeBridge?.reportPageLoad(
        window.location.pathname || "/",
        "I J Reddy Loan App",
      );
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  // When session changes, notify native to persist it
  useEffect(() => {
    const isNative = typeof window !== "undefined" && window.isNativeApp?.();
    if (!isNative) return; // Skip on web

    // Listen for Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "[NativeBridge] Auth state changed:",
        event,
        session ? "with session" : "no session",
      );

      if (event === "SIGNED_IN" && session) {
        // User signed in - send session to native for persistence
        console.log("[NativeBridge] Sending session to native for persistence");
        // Note: isScopedCustomer/scopedCustomerId may be stale here
        // Native should re-query or web should update after scope detection
        window.NativeBridge?.updateSession({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at ?? 0,
          user: {
            id: session.user.id,
            email: session.user.email,
            isScopedCustomer: isScopedCustomer,
            scopedCustomerId: scopedCustomerId,
          },
        });
      } else if (event === "SIGNED_OUT") {
        // User signed out - notify native to clear session
        console.log("[NativeBridge] Notifying native of logout");
        window.NativeBridge?.logout();
      } else if (event === "TOKEN_REFRESHED" && session) {
        // Token was refreshed - update native with new token
        console.log("[NativeBridge] Updating native with refreshed token");
        window.NativeBridge?.updateSession({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at ?? 0,
          user: {
            id: session.user.id,
            email: session.user.email,
            isScopedCustomer: isScopedCustomer,
            scopedCustomerId: scopedCustomerId,
          },
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isScopedCustomer, scopedCustomerId]);

  // FIX: Simplified initialization for Chrome/Edge compatibility
  useEffect(() => {
    let isMounted = true;
    let loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const initializeSession = async () => {
      if (!isMounted) return;
      setLoading(true);
      console.log("[DataContext] Starting session initialization...");

      // Failsafe timeout to prevent infinite loading (helps WebView issues)
      loadingTimeoutId = setTimeout(() => {
        if (isMounted) {
          console.error(
            "[DataContext] Session initialization timed out after 30s - forcing loading=false",
          );
          setLoading(false);
          setIsAuthChecking(false);
          setIsRefreshing(false);
        }
      }, 30000);

      // Progress markers to help diagnose where hangs occur
      const progressMarkers = [
        setTimeout(
          () =>
            console.log(
              "[DataContext] Auth init: 5s elapsed, still working...",
            ),
          5000,
        ),
        setTimeout(
          () =>
            console.warn(
              "[DataContext] Auth init: 15s elapsed, this is taking longer than expected",
            ),
          15000,
        ),
        setTimeout(
          () =>
            console.error(
              "[DataContext] Auth init: 25s elapsed, approaching timeout!",
            ),
          25000,
        ),
      ];

      const clearProgressMarkers = () => {
        progressMarkers.forEach(clearTimeout);
      };

      try {
        // Get the current session
        console.log("[DataContext] Stage 1: Fetching session from Supabase...");

        // If running in native app, request session from native first
        const isNative =
          typeof window !== "undefined" && window.isNativeApp?.();
        if (isNative) {
          console.log(
            "[DataContext] Requesting auth session from native wrapper...",
          );
          window.NativeBridge?.requestAuth();

          // Wait for native auth response via event, with fallback timeout
          await new Promise<void>((resolve) => {
            let eventListener: ((event: Event) => void) | null = null;
            let timeoutId: ReturnType<typeof setTimeout> | null = null;

            const cleanup = () => {
              if (eventListener) {
                window.removeEventListener(
                  "native-auth-received",
                  eventListener,
                );
              }
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
            };

            // Listen for the auth event from the message handler
            eventListener = () => {
              console.log(
                "[DataContext] Received native-auth-received event, proceeding with session check",
              );
              cleanup();
              resolve();
            };

            // Fallback timeout: if native never responds, proceed anyway after 2 seconds
            timeoutId = setTimeout(() => {
              console.warn(
                "[DataContext] Native auth response timeout (2s), proceeding with cached/browser session",
              );
              cleanup();
              resolve();
            }, 2000);

            window.addEventListener("native-auth-received", eventListener);
          });
        }

        let sessionResult;
        try {
          sessionResult = await runAuthWithRetry(
            () => supabase.auth.getSession(),
            "retrieving auth session",
            { maxRetries: 1 },
          );
        } catch (sessionError: any) {
          // Handle refresh_token_not_found error
          if (
            sessionError?.code === "refresh_token_not_found" ||
            sessionError?.message?.includes("refresh_token_not_found")
          ) {
            console.warn(
              "[DataContext] Refresh token not found - clearing session and notifying native",
            );
            // Clear the invalid session
            await supabase.auth.signOut({ scope: "local" });
            // Notify native to clear its stored session
            if (isNative) {
              window.NativeBridge?.logout();
            }
            sessionResult = { data: { session: null }, error: null };
          } else {
            throw sessionError;
          }
        }

        const {
          data: { session },
        } = sessionResult;
        console.log(
          "[DataContext] Stage 1 complete: Session",
          session ? "exists" : "null",
        );

        if (!isMounted) return;

        setSession(session);
        lastSessionTokenRef.current = session?.access_token || null;
        lastUserIdRef.current = session?.user?.id || null;

        // Auth check complete - unblock ProtectedRoute immediately
        // Data loading will continue in background
        setIsAuthChecking(false);

        let currentIsScoped = false;
        let currentScopedId: string | null = null;

        // If session exists, determine scope and fetch data
        if (session && session.user && session.user.id) {
          console.log("[DataContext] Stage 2: Checking user scope...");
          try {
            const resolvedScope = await resolveScopedCustomer(session.user.id);
            currentIsScoped = resolvedScope.isScoped;
            currentScopedId = resolvedScope.scopedCustomerId;
          } catch (err) {
            console.error("Error checking scoped customer", err);
          }

          if (!isMounted) return;

          setIsScopedCustomer(currentIsScoped);
          setScopedCustomerId(currentScopedId);

          // Tell native the correct isScopedCustomer value now that scope detection is complete.
          // The SIGNED_IN handler fires before this async query runs, so isScopedCustomer was
          // stale (false) when that message was sent. Send a corrected update here.
          const isNative = typeof window !== 'undefined' && window.isNativeApp?.();
          if (isNative) {
            window.NativeBridge?.updateSession({
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
              expiresAt: session.expires_at ?? 0,
              user: {
                id: session.user.id,
                email: session.user.email,
                isScopedCustomer: currentIsScoped,
                scopedCustomerId: currentScopedId,
              },
            });
          }

          // Load cached data immediately if available (for smooth UX)
          const cacheKey = buildDataCacheKey(currentIsScoped, currentScopedId);
          const cachedData = getCachedData(cacheKey);
          // Keep reference to what was served so we can skip re-renders when
          // the background fetch returns the same data.
          const dataServedFromCache = cachedData;
          if (cachedData) {
            setCustomers(cachedData.customers || []);
            setLoans(cachedData.loans || []);
            setSubscriptions(cachedData.subscriptions || []);
            setInstallments(cachedData.installments || []);
            setDataEntries(cachedData.dataEntries || []);
            setSeniorityList(cachedData.seniorityList || []);
          }

          // Progressive Loading: unblock UI immediately while data continues in background.
          // Keep isRefreshing reserved for explicit/user-triggered refresh actions.
          if (isMounted) {
            setLoading(false);
          }

          // Start seniority fetch immediately so it runs in parallel with the main data fetch
          const seniorityInitPromise = buildSeniorityQuery();

          // Inline the fetch logic during initialization to avoid issues with fetchData callback
          try {
            const freshSnapshot = await loadAppData({
              isScoped: currentIsScoped,
              scopedCustomerId: currentScopedId,
            });

            if (!isMounted) return;

            const dataChanged =
              !normalizeSnapshotForCompare(dataServedFromCache) ||
              JSON.stringify(freshSnapshot) !==
                JSON.stringify(normalizeSnapshotForCompare(dataServedFromCache));

            if (dataChanged && isMounted) {
              applyDataSnapshot(freshSnapshot);
            }

            if (!currentIsScoped) {
              checkAndNotifyOverdueInstallments(
                freshSnapshot.installments,
                freshSnapshot.loans,
                freshSnapshot.customers,
              ).catch((notificationErr) => {
                console.error(
                  "Error checking overdue installments during init:",
                  notificationErr,
                );
              });
            }

            setCachedData(cacheKey, {
              ...freshSnapshot,
              seniorityList: [],
            });
          } catch (err) {
            console.error("Error fetching data during initialization", err);
          }

          // Fetch seniority list
          try {
            const seniorityKey = currentIsScoped
              ? `seniority_scoped_${currentScopedId}`
              : "seniority_admin";
            const cachedSeniority = getCachedData(seniorityKey);
            if (cachedSeniority) {
              if (isMounted) setSeniorityList(cachedSeniority);
            }

            // All users (including scoped) see the full seniority list
            // Primary sort uses loan_request_date so requested dates dictate the order,
            // with created_at providing a tie-breaker for same-day entries.
            const { data, error } = await seniorityInitPromise;
            if (error) throw error;
            const seniorityData = ((data as any[]) || []).filter(
              (e: any) => !e.customers?.deleted_at,
            );
            // Only update seniority state if it changed vs what was served
            if (
              !cachedSeniority ||
              JSON.stringify(seniorityData) !== JSON.stringify(cachedSeniority)
            ) {
              if (isMounted) setSeniorityList(seniorityData);
            }
            setCachedData(seniorityKey, seniorityData);
          } catch (err) {
            console.error(
              "Error fetching seniority list during initialization",
              err,
            );
          }

          // Background pre-fetch of global summary data for scoped users.
          // Non-blocking: populates localStorage cache so SummaryPage renders instantly.
          if (currentIsScoped && !getCachedData("summary_global")) {
            loadGlobalSummaryRecords()
              .then((summaryRecords) => {
                setCachedData("summary_global", summaryRecords);
              })
              .catch((err) => {
                console.error("[DataContext] Background summary pre-fetch failed:", err);
              });
          }
        }
      } catch (err) {
        console.error("Error initializing session", err);
      } finally {
        if (isMounted) {
          console.log("[DataContext] Session initialization complete");
          clearProgressMarkers();
          setLoading(false);
          setIsRefreshing(false);
          if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
        }
      }
    };

    initializeSession();

    // Listen for auth state changes - handle sign in and sign out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;

      // Handle sign out
      if (_event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        setIsAuthChecking(false);
        setIsRefreshing(false);
        lastSessionTokenRef.current = null;
        lastUserIdRef.current = null;
        clearClientCache();
        return;
      }

      // Handle sign in - set the session so user stays logged in
      if (_event === "SIGNED_IN") {
        console.log("[Auth] onAuthStateChange: SIGNED_IN event received");
        // Verify we have a fresh session to prevent stale state issues
        if (session && session.access_token) {
          // Only update if the token is different (avoids redundant updates)
          if (lastSessionTokenRef.current !== session.access_token) {
            console.log("[Auth] Updating session from SIGNED_IN event");
            setSession(session);
            lastSessionTokenRef.current = session.access_token;
            lastUserIdRef.current = session.user?.id || null;
            setIsAuthChecking(false);
          }
        }
      }

      // Handle token refresh - update session with new tokens
      if (_event === "TOKEN_REFRESHED" && session) {
        console.log("[Auth] onAuthStateChange: TOKEN_REFRESHED event received");
        if (lastSessionTokenRef.current !== session.access_token) {
          setSession(session);
          lastSessionTokenRef.current = session.access_token;
          lastUserIdRef.current = session.user?.id || null;
        }
      }

      // Handle user metadata updates (e.g. avatar path/name changes)
      if (_event === "USER_UPDATED" && session) {
        setSession(session);
        lastSessionTokenRef.current = session.access_token;
        lastUserIdRef.current = session.user?.id || null;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PAGE_LOADED is now sent on DataProvider mount (above) and by bridge.ts on window.load.
  // Web app shows its own loading indicators while data loads in background.

  // Refetch data when user logs in (when session becomes available but data hasn't been loaded yet)
  useEffect(() => {
    if (!session || !session.user) return;

    // Only refetch if we have empty data (user just logged in)
    const hasNoData = customers.length === 0 && loans.length === 0;
    if (!hasNoData) return;

    let isMounted = true;

    const refetchDataAfterLogin = async () => {
      try {
        // Determine if user is scoped
        let currentIsScoped = false;
        let currentScopedId: string | null = null;

        try {
          const resolvedScope = await resolveScopedCustomer(session.user.id);
          currentIsScoped = resolvedScope.isScoped;
          currentScopedId = resolvedScope.scopedCustomerId;
        } catch (err) {
          console.error("Error checking scoped customer after login", err);
        }

        if (!isMounted) return;

        setIsScopedCustomer(currentIsScoped);
        setScopedCustomerId(currentScopedId);

        // Start seniority fetch immediately so it runs in parallel with the main data fetch
        const seniorityPostLoginPromise = buildSeniorityQuery();

        // Fetch all data
        const cacheKey = buildDataCacheKey(currentIsScoped, currentScopedId);
        const cachedData = getCachedData(cacheKey);
        if (cachedData && isMounted) {
          setCustomers(cachedData.customers || []);
          setLoans(cachedData.loans || []);
          setSubscriptions(cachedData.subscriptions || []);
          setDataEntries(cachedData.dataEntries || []);
          setInstallments(cachedData.installments || []);
        }

        const freshSnapshot = await loadAppData({
          isScoped: currentIsScoped,
          scopedCustomerId: currentScopedId,
        });

        if (!isMounted) return;

        applyDataSnapshot(freshSnapshot);
        setCachedData(cacheKey, {
          ...freshSnapshot,
          seniorityList: [],
        });

        if (!currentIsScoped) {
          checkAndNotifyOverdueInstallments(
            freshSnapshot.installments,
            freshSnapshot.loans,
            freshSnapshot.customers,
          ).catch((notificationErr) => {
            console.error(
              "Error checking overdue installments after login:",
              notificationErr,
            );
          });
        } else if (!getCachedData("summary_global")) {
          loadGlobalSummaryRecords()
            .then((summaryRecords) => {
              setCachedData("summary_global", summaryRecords);
            })
            .catch((err) => {
              console.error("[DataContext] Background summary pre-fetch failed:", err);
            });
        }

        // Fetch seniority list
        try {
          const seniorityKey = currentIsScoped
            ? `seniority_scoped_${currentScopedId}`
            : "seniority_admin";
          const cachedSeniority = getCachedData(seniorityKey);
          if (cachedSeniority) {
            if (isMounted) setSeniorityList(cachedSeniority);
          }

          // Keep ordering consistent with the initialization fetch.
          const { data, error } = await seniorityPostLoginPromise;
          if (error) throw error;
          const seniorityData = ((data as any[]) || []).filter(
            (e: any) => !e.customers?.deleted_at,
          );
          if (isMounted) setSeniorityList(seniorityData);
          setCachedData(seniorityKey, seniorityData);
        } catch (err) {
          console.error("Error fetching seniority list after login", err);
        }
      } catch (err) {
        console.error("Error refetching data after login", err);
      }
    };

    // Silent post-login bootstrap: load in background without global sync banner.
    refetchDataAfterLogin();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  // Reset summary data loaded flag when session changes or scoped customer status changes
  useEffect(() => {
    if (!session) {
      // Session cleared (logout) - reset flag for fresh summary fetch on next login
      summaryDataLoadedRef.current = false;
    }
  }, [session]);

  useEffect(() => {
    // When isScopedCustomer changes, reset summary data so it's fetched with correct scope
    summaryDataLoadedRef.current = false;
  }, [isScopedCustomer]);

  const signInWithPassword = async (email: string, pass: string) => {
    try {
      // Clear any stale session state before login to prevent race conditions
      // This ensures ProtectedRoute doesn't see outdated state during re-login
      console.log("[Auth] Clearing stale session state before login...");
      setSession(null);
      lastSessionTokenRef.current = null;
      lastUserIdRef.current = null;

      const { data, error } = await runAuthWithRetry(
        () =>
          supabase.auth.signInWithPassword({
            email,
            password: pass,
          }),
        "signing in",
      );
      if (error) throw error;

      // Set session immediately from the response to prevent race condition
      // where ProtectedRoute checks before onAuthStateChange fires
      if (data.session) {
        console.log("[Auth] Setting session immediately from login response");
        setSession(data.session);
        lastSessionTokenRef.current = data.session.access_token;
        lastUserIdRef.current = data.session.user?.id || null;
        setIsAuthChecking(false); // Ensure auth check is marked complete
      }
    } catch (error) {
      throw new Error(parseSupabaseError(error, "signing in"));
    }
  };

  const signOut = async () => {
    try {
      const { error } = await runAuthWithRetry(
        () => supabase.auth.signOut(),
        "signing out",
        { maxRetries: 1 },
      );
      if (error) throw error;
      clearClientCache();
    } catch (error) {
      throw new Error(parseSupabaseError(error, "signing out"));
    }
  };

  const addCustomer = async (
    customerData: Omit<NewCustomer, "user_id">,
  ): Promise<Customer> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot add customers",
      );
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert([customerData] as any)
        .select()
        .single();
      if (error || !data) throw error;
      logAuditEvent(session, "create", "customer", data.id, {
        customer_id: data.id,
        customer_name: customerData.name,
        name: customerData.name,
        phone: customerData.phone,
        ...buildAuditChangeMetadata(null, (data as AuditSnapshot) ?? null),
      });

      // Trigger background user creation without blocking the customer add flow.
      try {
        (async () => {
          try {
            const createUrl = `/.netlify/functions/create-user-from-customer?_=${Date.now()}`;
            const successData = await apiRequest<{ user_id?: string }>(createUrl, {
              method: "POST",
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
                ...(session?.access_token
                  ? { Authorization: `Bearer ${session.access_token}` }
                  : {}),
              },
              body: {
                customer_id: data.id,
                name: customerData.name,
                phone: customerData.phone,
                admin_uid: session?.user?.id ?? null,
                actor_name:
                  (session?.user?.user_metadata?.name as string | undefined) ||
                  (session?.user?.app_metadata?.name as string | undefined) ||
                  (session?.user?.email
                    ? String(session.user.email).split("@")[0]
                    : null),
                actor_email: session?.user?.email ?? null,
              },
              timeoutMs: 15000,
              dedupeKey: createUrl,
            });

            console.log(
              "✅ Background user auto-created:",
              successData.user_id || "<unknown>",
            );
            try {
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("background-user-create", {
                    detail: {
                      status: "success",
                      customer_id: data.id,
                      user_id: successData.user_id,
                      message: "User created successfully",
                    },
                  }),
                );
              }
            } catch (e) { }
          } catch (err: any) {
            const errData =
              err?.details && typeof err.details === "object" ? err.details : {};
            console.warn(
              "⚠️  Background user creation failed:",
              (errData as { error?: string }).error || err.message,
            );
            try {
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("background-user-create", {
                    detail: {
                      status: "error",
                      customer_id: data.id,
                      message:
                        (errData as { error?: string }).error || err.message,
                    },
                  }),
                );
              }
            } catch (e) { }
            console.warn("⚠️  Error during background user creation:", err);
          }
        })();
      } catch (userCreateError) {
        console.warn(
          "⚠️  Failed to schedule background user creation:",
          userCreateError,
        );
      }

      await fetchData();
      return data as Customer;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding customer"));
    }
  };

  const addLoan = async (loanData: NewLoan): Promise<Loan> => {
    if (isScopedCustomer)
      throw new Error("Read-only access: scoped customers cannot add loans");
    try {
      const { data, error } = await supabase
        .from("loans")
        .insert([loanData] as any)
        .select()
        .single();
      if (error || !data) throw error;
      logAuditEvent(session, "create", "loan", data.id, {
        customer_id: loanData.customer_id,
        customer_name: customerMap.get(loanData.customer_id)?.name || null,
        amount: loanData.original_amount,
        previous_amount: null,
        new_amount: loanData.original_amount,
        ...buildAuditChangeMetadata(null, (data as AuditSnapshot) ?? null),
      });
      try {
        if (data.customer_id) {
          // Remove from seniority list regardless of who requested it
          await supabase
            .from("loan_seniority")
            .delete()
            .eq("customer_id", data.customer_id);
        }
      } catch (e) {
        console.error("Failed to cleanup loan_seniority after loan create", e);
      }
      // Optimistically update local state with the returned loan + customer data from state
      const customer = customerMap.get(data.customer_id);
      const loanWithCustomer: LoanWithCustomer = {
        ...(data as any),
        customers: customer ? { name: customer.name, phone: customer.phone } : null,
      };
      setLoans((prev) => [loanWithCustomer, ...prev]);
      return data as Loan;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding loan"));
    }
  };

  const addSubscription = async (
    subscriptionData: NewSubscription,
  ): Promise<Subscription> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot add subscriptions",
      );
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .insert([subscriptionData] as any)
        .select()
        .single();
      if (error || !data) throw error;
      logAuditEvent(session, "create", "subscription", data.id, {
        customer_id: subscriptionData.customer_id,
        customer_name: customerMap.get(subscriptionData.customer_id)?.name || null,
        amount: subscriptionData.amount,
        previous_amount: null,
        new_amount: subscriptionData.amount,
        ...buildAuditChangeMetadata(null, (data as AuditSnapshot) ?? null),
      });
      // Optimistically update local state with the returned subscription + customer data from state
      const customer = customerMap.get(data.customer_id);
      const subWithCustomer: SubscriptionWithCustomer = {
        ...(data as any),
        customers: customer ? { name: customer.name, phone: customer.phone } : null,
      };
      setSubscriptions((prev) => [subWithCustomer, ...prev]);
      return data as Subscription;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding subscription"));
    }
  };

  const addInstallment = async (
    installmentData: NewInstallment,
  ): Promise<Installment> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot add installments",
      );

    let loanForStatus = loans.find(
      (loan) => loan.id === installmentData.loan_id,
    );
    let fetchedInstallments: Installment[] | null = null;
    if (!loanForStatus) {
      const { data: fetchedLoan, error: fetchLoanError } = await supabase
        .from("loans")
        .select("*, customers(name, phone)")
        .eq("id", installmentData.loan_id)
        .is("deleted_at", null)
        .single();
      if (fetchLoanError)
        throw new Error(parseSupabaseError(fetchLoanError, "finding loan"));
      loanForStatus = fetchedLoan as LoanWithCustomer;

      const { data: fetchedInstData, error: fetchInstError } = await supabase
        .from("installments")
        .select()
        .eq("loan_id", installmentData.loan_id)
        .is("deleted_at", null);
      if (fetchInstError)
        throw new Error(
          parseSupabaseError(fetchInstError, "finding installments"),
        );
      fetchedInstallments = (fetchedInstData as Installment[]) ?? null;
    }

    if (!loanForStatus) {
      throw new Error("Loan not found");
    }

    const existingInstallments =
      fetchedInstallments && fetchedInstallments.length > 0
        ? fetchedInstallments
        : installments.filter(
          (installment) =>
            installment.loan_id === installmentData.loan_id &&
            !installment.deleted_at,
        );
    const loanStatus = getLoanStatus(loanForStatus, existingInstallments);
    if (loanStatus.status !== "In Progress") {
      throw new Error("Installments can only be added to In Progress loans");
    }

    try {
      const { data, error } = await supabase
        .from("installments")
        .insert([installmentData] as any)
        .select()
        .single();
      if (error || !data) throw error;
      logAuditEvent(session, "create", "installment", data.id, {
        loan_id: installmentData.loan_id,
        customer_id: loanForStatus.customer_id,
        customer_name:
          loanForStatus.customers?.name ||
          customerMap.get(loanForStatus.customer_id)?.name ||
          null,
        amount: installmentData.amount,
        previous_amount: null,
        new_amount: installmentData.amount,
        ...buildAuditChangeMetadata(null, (data as AuditSnapshot) ?? null),
      });
      // Optimistically update local state
      setInstallments((prev) => [data as Installment, ...prev]);
      return data as Installment;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding installment"));
    }
  };

  const deleteCustomer = async (customerId: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot delete customers",
      );
    try {
      const deletedAt = new Date().toISOString();
      const deletedBy = session?.user?.id || session?.user?.email || null;
      const customerName = customerMap.get(customerId)?.name || null;
      const relatedLoanIds = loans
        .filter((loan) => loan.customer_id === customerId && !(loan as any).deleted_at)
        .map((loan) => loan.id);
      const relatedSubscriptionIds = subscriptions
        .filter(
          (subscription) =>
            subscription.customer_id === customerId &&
            !(subscription as any).deleted_at,
        )
        .map((subscription) => subscription.id);
      const relatedDataEntryIds = dataEntries
        .filter(
          (entry) => entry.customer_id === customerId && !(entry as any).deleted_at,
        )
        .map((entry) => entry.id);
      const relatedSeniorityIds = seniorityList
        .filter(
          (seniority) =>
            seniority.customer_id === customerId && !(seniority as any).deleted_at,
        )
        .map((seniority) => seniority.id);
      const relatedInstallmentIds = installments
        .filter(
          (installment) =>
            relatedLoanIds.includes(installment.loan_id) &&
            !(installment as any).deleted_at,
        )
        .map((installment) => installment.id);
      const { data: beforeRow } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      // Optimistic UI update - remove from local state immediately
      try {
        const optimisticLoanIds = loans
          .filter((l) => l.customer_id === customerId)
          .map((l) => l.id);
        setCustomers((prev) => prev.filter((c) => c.id !== customerId));
        setLoans((prev) => prev.filter((l) => l.customer_id !== customerId));
        setSubscriptions((prev) =>
          prev.filter((s) => s.customer_id !== customerId),
        );
        setInstallments((prev) =>
          prev.filter((i) => !optimisticLoanIds.includes(i.loan_id)),
        );
        setDataEntries((prev) =>
          prev.filter((d) => d.customer_id !== customerId),
        );
        setSeniorityList((prev) =>
          prev.filter((s) => s.customer_id !== customerId),
        );
      } catch (e) { }

      // Soft delete the customer
      const { error: custErr } = await supabase
        .from("customers")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("id", customerId);
      if (custErr) throw custErr;

      // Soft delete all related loans
      const { error: loansErr } = await supabase
        .from("loans")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("customer_id", customerId)
        .is("deleted_at", null);
      if (loansErr) throw loansErr;

      // Soft delete all related subscriptions
      const { error: subsErr } = await supabase
        .from("subscriptions")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("customer_id", customerId)
        .is("deleted_at", null);
      if (subsErr) throw subsErr;

      // Soft delete all related data entries
      const { error: dataErr } = await supabase
        .from("data_entries")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("customer_id", customerId)
        .is("deleted_at", null);
      if (dataErr) throw dataErr;

      // Soft delete all related loan seniority entries
      const { error: seniorityErr } = await supabase
        .from("loan_seniority")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("customer_id", customerId)
        .is("deleted_at", null);
      if (seniorityErr) throw seniorityErr;

      const cascadeCounts = {
        loans: relatedLoanIds.length,
        subscriptions: relatedSubscriptionIds.length,
        data_entries: relatedDataEntryIds.length,
        loan_seniority: relatedSeniorityIds.length,
        installments_by_loan: relatedInstallmentIds.length,
      };

      if (Object.values(cascadeCounts).some((count) => count > 0)) {
        logAuditEvent(session, "soft_delete", "customer_cascade", customerId, {
          customer_id: customerId,
          customer_name: customerName,
          deleted_at: deletedAt,
          deleted_by: deletedBy,
          cascade_counts: cascadeCounts,
          loan_ids: relatedLoanIds.slice(0, 25),
          subscription_ids: relatedSubscriptionIds.slice(0, 25),
          data_entry_ids: relatedDataEntryIds.slice(0, 25),
          seniority_ids: relatedSeniorityIds.slice(0, 25),
          installment_ids: relatedInstallmentIds.slice(0, 25),
        });
      }

      logAuditEvent(session, "soft_delete", "customer", customerId, {
        customer_name: customerName,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          {
            ...((beforeRow as Record<string, unknown>) ?? {}),
            deleted_at: deletedAt,
            deleted_by: deletedBy,
          },
        ),
      });

      await fetchData();
      await fetchDeletedCustomers();
    } catch (error) {
      // Revert optimistic update on error
      await fetchData();
      throw new Error(
        parseSupabaseError(error, `deleting customer ${customerId}`),
      );
    }
  };

  const deleteLoan = async (loanId: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error("Read-only access: scoped customers cannot delete loans");
    try {
      const targetLoan = loans.find((loan) => loan.id === loanId);
      const deletedAt = new Date().toISOString();
      const deletedBy = session?.user?.id || session?.user?.email || null;
      const { data: beforeRow } = await supabase
        .from("loans")
        .select("*")
        .eq("id", loanId)
        .single();
      // Soft delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("loans")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("id", loanId);
      if (error) throw error;
      logAuditEvent(session, "soft_delete", "loan", loanId, {
        customer_id: targetLoan?.customer_id ?? null,
        customer_name:
          targetLoan?.customers?.name ||
          (targetLoan?.customer_id
            ? customerMap.get(targetLoan.customer_id)?.name
            : null) ||
          null,
        deleted_amount: targetLoan?.original_amount ?? null,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          {
            ...((beforeRow as Record<string, unknown>) ?? {}),
            deleted_at: deletedAt,
            deleted_by: deletedBy,
          },
        ),
      });
      // Optimistically remove from local state
      setLoans((prev) => prev.filter((loan) => loan.id !== loanId));
      // Refresh trash view (lightweight compared to full fetchData)
      await fetchDeletedLoans();
    } catch (error) {
      throw new Error(parseSupabaseError(error, `deleting loan ${loanId}`));
    }
  };

  const restoreLoan = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore loans",
      );
    try {
      // Restore soft-deleted entry by clearing deleted_at
      const { data: beforeRow } = await supabase
        .from("loans")
        .select("*")
        .eq("id", id)
        .single();
      const { error } = await supabase
        .from("loans")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      logAuditEvent(session, "restore", "loan", id, {
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          {
            ...((beforeRow as Record<string, unknown>) ?? {}),
            deleted_at: null,
            deleted_by: null,
          },
        ),
      });
      // Fetch the restored loan with customer relationship
      const { data: restoredLoan, error: fetchErr } = await supabase
        .from("loans")
        .select("*, customers(name, phone)")
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;

      if (restoredLoan) {
        // Verify parent customer exists and is not soft-deleted
        const { data: customer, error: customerErr } = await supabase
          .from("customers")
          .select("id, deleted_at")
          .eq("id", (restoredLoan as any).customer_id)
          .single();

        if (customerErr && customerErr.code !== "PGRST116") throw customerErr;

        if (!customer || (customer as any).deleted_at !== null) {
          throw new Error(
            "Cannot restore: The parent customer has been deleted or does not exist. You can only permanently delete this loan.",
          );
        }

        // Parent customer exists and is not deleted - safe to restore loan
        setLoans((prev) => [restoredLoan as LoanWithCustomer, ...prev]);
      }
      // Refresh trash view (lightweight compared to full fetchData)
      await fetchDeletedLoans();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring loan ${id}`));
    }
  };

  const permanentDeleteLoan = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete loans",
      );
    try {
      // Defensive check: verify the loan is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("loans")
        .select("id, deleted_at, customer_id, original_amount")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: loan must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the loan (installments will cascade delete)
      const beforeSnapshot = (entry as AuditSnapshot) ?? null;
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) throw error;
      const customerId = (entry as any)?.customer_id ?? null;
      logAuditEvent(session, "permanent_delete", "loan", id, {
        customer_id: customerId,
        customer_name: customerId ? customerMap.get(customerId)?.name || null : null,
        deleted_amount: (entry as any)?.original_amount ?? null,
        ...buildAuditChangeMetadata(beforeSnapshot, null),
      });
      await fetchDeletedLoans();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting loan ${id}`),
      );
    }
  };

  // Restore a soft-deleted customer and all related records
  const restoreCustomer = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore customers",
      );
    try {
      // Get the customer's deleted_at timestamp to restore matching related records
      const { data: customer, error: fetchError } = await supabase
        .from("customers")
        .select("id, name, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!customer || (customer as any).deleted_at === null) {
        throw new Error("Customer is not in trash");
      }

      const deletedAt = (customer as any).deleted_at;
      const beforeSnapshot = (customer as AuditSnapshot) ?? null;

      // Restore the customer
      const { error: custErr } = await supabase
        .from("customers")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (custErr) throw custErr;

      // Restore all related loans that were deleted at the same time
      const { error: loansErr } = await supabase
        .from("loans")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("customer_id", id)
        .eq("deleted_at", deletedAt);
      if (loansErr) throw loansErr;

      // Restore all related subscriptions that were deleted at the same time
      const { error: subsErr } = await supabase
        .from("subscriptions")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("customer_id", id)
        .eq("deleted_at", deletedAt);
      if (subsErr) throw subsErr;

      // Restore all related data entries that were deleted at the same time
      const { error: dataErr } = await supabase
        .from("data_entries")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("customer_id", id)
        .eq("deleted_at", deletedAt);
      if (dataErr) throw dataErr;

      // Restore all related loan seniority entries that were deleted at the same time
      const { error: seniorityErr } = await supabase
        .from("loan_seniority")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("customer_id", id)
        .eq("deleted_at", deletedAt);
      if (seniorityErr) throw seniorityErr;

      logAuditEvent(session, "restore", "customer", id, {
        customer_name: (customer as any)?.name || null,
        ...buildAuditChangeMetadata(
          beforeSnapshot,
          {
            ...((customer as Record<string, unknown>) ?? {}),
            deleted_at: null,
            deleted_by: null,
          },
        ),
      });

      await fetchData();
      await fetchDeletedCustomers();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring customer ${id}`));
    }
  };

  // Permanently delete a soft-deleted customer and all related records
  const permanentDeleteCustomer = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete customers",
      );
    try {
      // Defensive check: verify the customer is soft-deleted before permanent deletion
      const { data: customer, error: fetchError } = await supabase
        .from("customers")
        .select("id, name, user_id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!customer || (customer as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: customer must be soft-deleted first (moved to trash)",
        );
      }

      const customerUserId = (customer as any).user_id || null;
      const beforeSnapshot = (customer as AuditSnapshot) ?? null;

      const { data: dataEntriesForCustomer, error: dataEntriesFetchError } =
        await supabase
          .from("data_entries")
          .select("id")
          .eq("customer_id", id);
      if (dataEntriesFetchError) throw dataEntriesFetchError;

      const { data: seniorityForCustomer, error: seniorityFetchError } =
        await supabase
          .from("loan_seniority")
          .select("id")
          .eq("customer_id", id);
      if (seniorityFetchError) throw seniorityFetchError;

      const { data: subscriptionsForCustomer, error: subscriptionsFetchError } =
        await supabase
          .from("subscriptions")
          .select("id")
          .eq("customer_id", id);
      if (subscriptionsFetchError) throw subscriptionsFetchError;

      // Hard delete all related data entries
      const { error: delDataErr } = await supabase
        .from("data_entries")
        .delete()
        .eq("customer_id", id);
      if (delDataErr) throw delDataErr;

      // Hard delete all related loan seniority entries
      const { error: delSeniorityErr } = await supabase
        .from("loan_seniority")
        .delete()
        .eq("customer_id", id);
      if (delSeniorityErr) throw delSeniorityErr;

      // Get all loans for this customer to delete their installments
      const { data: loansForCustomer, error: loansFetchError } = await supabase
        .from("loans")
        .select("id")
        .eq("customer_id", id);
      if (loansFetchError) throw loansFetchError;
      const loanIds = (loansForCustomer || []).map((l: any) => l.id);
      let installmentIds: string[] = [];
      if (loanIds.length > 0) {
        const { data: installmentsForCustomerLoans, error: installmentsFetchError } =
          await supabase
            .from("installments")
            .select("id")
            .in("loan_id", loanIds);
        if (installmentsFetchError) throw installmentsFetchError;
        installmentIds = (installmentsForCustomerLoans || []).map(
          (installment: any) => installment.id,
        );

        const { error: delInstallErr } = await supabase
          .from("installments")
          .delete()
          .in("loan_id", loanIds);
        if (delInstallErr) throw delInstallErr;
        const { error: delLoanErr } = await supabase
          .from("loans")
          .delete()
          .in("id", loanIds);
        if (delLoanErr) throw delLoanErr;
      }

      // Hard delete all related subscriptions
      const { error: delSubErr } = await supabase
        .from("subscriptions")
        .delete()
        .eq("customer_id", id);
      if (delSubErr) throw delSubErr;

      // Hard delete the customer
      const { error: delCustErr } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);
      if (delCustErr) throw delCustErr;

      const cascadeCounts = {
        loans: loanIds.length,
        subscriptions: (subscriptionsForCustomer || []).length,
        data_entries: (dataEntriesForCustomer || []).length,
        loan_seniority: (seniorityForCustomer || []).length,
        installments: installmentIds.length,
      };

      if (Object.values(cascadeCounts).some((count) => count > 0)) {
        logAuditEvent(session, "permanent_delete", "customer_cascade", id, {
          customer_id: id,
          customer_name: (customer as any)?.name || null,
          customer_user_id: customerUserId,
          cascade_counts: cascadeCounts,
          loan_ids: loanIds.slice(0, 25),
          subscription_ids: (subscriptionsForCustomer || [])
            .map((subscription: any) => subscription.id)
            .slice(0, 25),
          data_entry_ids: (dataEntriesForCustomer || [])
            .map((entry: any) => entry.id)
            .slice(0, 25),
          seniority_ids: (seniorityForCustomer || [])
            .map((seniority: any) => seniority.id)
            .slice(0, 25),
          installment_ids: installmentIds.slice(0, 25),
        });
      }

      logAuditEvent(session, "permanent_delete", "customer", id, {
        customer_name: (customer as any)?.name || null,
        ...buildAuditChangeMetadata(beforeSnapshot, null),
      });

      // Delete linked auth user if exists
      if (customerUserId) {
        try {
          const deleteUrl = `/.netlify/functions/delete-user-from-customer?_=${Date.now()}`;
          await apiRequest(deleteUrl, {
            method: "POST",
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
            body: {
              customer_id: id,
              user_id: customerUserId,
              customer_name: (customer as any)?.name ?? null,
              admin_uid: session?.user?.id ?? null,
              actor_name:
                (session?.user?.user_metadata?.name as string | undefined) ||
                (session?.user?.app_metadata?.name as string | undefined) ||
                (session?.user?.email
                  ? String(session.user.email).split("@")[0]
                  : null),
              actor_email: session?.user?.email ?? null,
            },
            timeoutMs: 15000,
            dedupeKey: deleteUrl,
          });
          console.log("✅ Linked auth user deleted for customer", id);
        } catch (e) {
          console.warn(
            "Warning: error calling delete-user-from-customer function",
            e,
          );
        }
      }

      await fetchDeletedCustomers();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting customer ${id}`),
      );
    }
  };

  const deleteSubscription = async (subscriptionId: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot delete subscriptions",
      );
    try {
      const targetSubscription = subscriptions.find(
        (subscription) => subscription.id === subscriptionId,
      );
      const deletedAt = new Date().toISOString();
      const deletedBy = session?.user?.id || session?.user?.email || null;
      const { data: beforeRow } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .single();
      // Soft delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("subscriptions")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("id", subscriptionId);
      if (error) throw error;
      logAuditEvent(session, "soft_delete", "subscription", subscriptionId, {
        customer_id: targetSubscription?.customer_id ?? null,
        customer_name:
          targetSubscription?.customers?.name ||
          (targetSubscription?.customer_id
            ? customerMap.get(targetSubscription.customer_id)?.name
            : null) ||
          null,
        deleted_amount: targetSubscription?.amount ?? null,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          {
            ...((beforeRow as Record<string, unknown>) ?? {}),
            deleted_at: deletedAt,
            deleted_by: deletedBy,
          },
        ),
      });
      // Optimistically remove from local state
      setSubscriptions((prev) =>
        prev.filter((sub) => sub.id !== subscriptionId),
      );
      // Refresh trash view (lightweight compared to full fetchData)
      await fetchDeletedSubscriptions();
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `deleting subscription ${subscriptionId}`),
      );
    }
  };

  const restoreSubscription = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore subscriptions",
      );
    try {
      // First, fetch the soft-deleted subscription to verify it exists and get parent ID
      const { data: deletedSub, error: fetchErr } = await supabase
        .from("subscriptions")
        .select("*, customers(name, phone)")
        .eq("id", id)
        .not("deleted_at", "is", null)
        .single();
      if (fetchErr) throw fetchErr;

      if (!deletedSub) {
        throw new Error("Subscription not found in trash");
      }

      // Verify parent customer exists and is not soft-deleted BEFORE restoring
      const { data: customer, error: customerErr } = await supabase
        .from("customers")
        .select("id, deleted_at")
        .eq("id", (deletedSub as any).customer_id)
        .single();

      if (customerErr && customerErr.code !== "PGRST116") throw customerErr;

      if (!customer || (customer as any).deleted_at !== null) {
        throw new Error(
          "Cannot restore: The parent customer has been deleted or does not exist. You can only permanently delete this subscription.",
        );
      }

      // Parent customer exists and is not deleted - now safe to restore subscription in DB
      const beforeSnapshot = (deletedSub as AuditSnapshot) ?? null;
      const { error } = await supabase
        .from("subscriptions")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;

      logAuditEvent(session, "restore", "subscription", id, {
        ...buildAuditChangeMetadata(
          beforeSnapshot,
          {
            ...((deletedSub as Record<string, unknown>) ?? {}),
            deleted_at: null,
            deleted_by: null,
          },
        ),
      });

      // Update UI state with restored subscription
      setSubscriptions((prev) => [deletedSub as SubscriptionWithCustomer, ...prev]);

      // Refresh trash view (lightweight compared to full fetchData)
      await fetchDeletedSubscriptions();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring subscription ${id}`));
    }
  };

  const permanentDeleteSubscription = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete subscriptions",
      );
    try {
      // Defensive check: verify the entry is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("subscriptions")
        .select("id, deleted_at, customer_id, amount")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: subscription must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the entry
      const beforeSnapshot = (entry as AuditSnapshot) ?? null;
      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      const customerId = (entry as any)?.customer_id ?? null;
      logAuditEvent(session, "permanent_delete", "subscription", id, {
        customer_id: customerId,
        customer_name: customerId ? customerMap.get(customerId)?.name || null : null,
        deleted_amount: (entry as any)?.amount ?? null,
        ...buildAuditChangeMetadata(beforeSnapshot, null),
      });
      await fetchDeletedSubscriptions();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting subscription ${id}`),
      );
    }
  };

  const deleteInstallment = async (installmentId: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot delete installments",
      );
    try {
      const targetInstallment = installments.find(
        (installment) => installment.id === installmentId,
      );
      const deletedAt = new Date().toISOString();
      const deletedBy = session?.user?.id || session?.user?.email || null;
      const { data: beforeRow } = await supabase
        .from("installments")
        .select("*")
        .eq("id", installmentId)
        .single();
      // Soft delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("installments")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("id", installmentId);
      if (error) throw error;
      const parentLoan = targetInstallment
        ? loans.find((loan) => loan.id === targetInstallment.loan_id)
        : null;
      const customerId = parentLoan?.customer_id || null;
      logAuditEvent(session, "soft_delete", "installment", installmentId, {
        loan_id: targetInstallment?.loan_id ?? null,
        customer_id: customerId,
        customer_name:
          parentLoan?.customers?.name ||
          (customerId ? customerMap.get(customerId)?.name : null) ||
          null,
        deleted_amount: targetInstallment?.amount ?? null,
        ...buildAuditChangeMetadata(
          (beforeRow as AuditSnapshot) ?? null,
          {
            ...((beforeRow as Record<string, unknown>) ?? {}),
            deleted_at: deletedAt,
            deleted_by: deletedBy,
          },
        ),
      });
      // Optimistically remove from local state
      setInstallments((prev) =>
        prev.filter((inst) => inst.id !== installmentId),
      );
      // Refresh trash view (lightweight compared to full fetchData)
      await fetchDeletedInstallments();
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `deleting installment ${installmentId}`),
      );
    }
  };

  const restoreInstallment = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore installments",
      );
    try {
      // First, get the installment to find its loan_id
      const { data: installment, error: fetchError } = await supabase
        .from("installments")
        .select("id, loan_id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!installment || (installment as any).deleted_at === null) {
        throw new Error("Installment is not in trash");
      }

      // Check if the parent loan exists and is not soft-deleted
      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .select("id, deleted_at")
        .eq("id", (installment as any).loan_id)
        .single();

      if (loanError && loanError.code !== "PGRST116") throw loanError;

      if (!loan || (loan as any).deleted_at !== null) {
        throw new Error(
          "Cannot restore: The parent loan has been deleted or does not exist. You can only permanently delete this installment.",
        );
      }

      // Restore soft-deleted entry by clearing deleted_at
      const beforeSnapshot = (installment as AuditSnapshot) ?? null;
      const { error } = await supabase
        .from("installments")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      logAuditEvent(session, "restore", "installment", id, {
        ...buildAuditChangeMetadata(
          beforeSnapshot,
          {
            ...((installment as Record<string, unknown>) ?? {}),
            deleted_at: null,
            deleted_by: null,
          },
        ),
      });
      // Fetch the restored installment
      const { data: restoredInst, error: fetchErr } = await supabase
        .from("installments")
        .select("*")
        .eq("id", id)
        .single();
      if (!fetchErr && restoredInst) {
        setInstallments((prev) => [restoredInst as Installment, ...prev]);
      }
      // Refresh trash view (lightweight compared to full fetchData)
      await fetchDeletedInstallments();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring installment ${id}`));
    }
  };

  const permanentDeleteInstallment = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete installments",
      );
    try {
      // Defensive check: verify the installment is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("installments")
        .select("id, deleted_at, loan_id, amount")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: installment must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the installment
      const beforeSnapshot = (entry as AuditSnapshot) ?? null;
      const { error } = await supabase
        .from("installments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      const loanId = (entry as any)?.loan_id ?? null;
      const parentLoan = loanId ? loans.find((loan) => loan.id === loanId) : null;
      const customerId = parentLoan?.customer_id || null;
      logAuditEvent(session, "permanent_delete", "installment", id, {
        loan_id: loanId,
        customer_id: customerId,
        customer_name:
          parentLoan?.customers?.name ||
          (customerId ? customerMap.get(customerId)?.name : null) ||
          null,
        deleted_amount: (entry as any)?.amount ?? null,
        ...buildAuditChangeMetadata(beforeSnapshot, null),
      });
      await fetchDeletedInstallments();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting installment ${id}`),
      );
    }
  };

  return (
    <DataContext.Provider
      value={{
        session,
        customers,
        loans,
        subscriptions,
        installments,
        dataEntries,
        loading,
        isAuthChecking,
        isRefreshing,
        isScopedCustomer,
        scopedCustomerId,
        customerMap,
        installmentsByLoanId,
        signInWithPassword,
        signOut,
        addCustomer,
        updateCustomer,
        addLoan,
        updateLoan,
        addSubscription,
        updateSubscription,
        addInstallment,
        updateInstallment,
        addDataEntry,
        updateDataEntry,
        deleteDataEntry,
        deleteCustomer,
        deleteLoan,
        deleteSubscription,
        deleteInstallment,
        adjustSubscriptionForMisc,
        seniorityList,
        deletedSeniorityList,
        fetchSeniorityList,
        fetchDeletedSeniorityList,
        addToSeniority,
        updateSeniority,
        removeFromSeniority,
        restoreSeniorityEntry,
        permanentDeleteSeniority,
        deletedDataEntries,
        fetchDeletedDataEntries,
        restoreDataEntry,
        permanentDeleteDataEntry,
        deletedSubscriptions,
        fetchDeletedSubscriptions,
        restoreSubscription,
        permanentDeleteSubscription,
        deletedLoans,
        fetchDeletedLoans,
        restoreLoan,
        permanentDeleteLoan,
        deletedInstallments,
        fetchDeletedInstallments,
        restoreInstallment,
        permanentDeleteInstallment,
        deletedCustomers,
        fetchDeletedCustomers,
        restoreCustomer,
        permanentDeleteCustomer,
        summaryLoans,
        summarySubscriptions,
        summaryInstallments,
        summaryDataEntries,
        fetchSummaryData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
