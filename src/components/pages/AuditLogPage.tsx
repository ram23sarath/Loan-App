import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouteReady } from "../RouteReadySignal";
import PageWrapper from "../ui/PageWrapper";
import { useData } from "../../context/DataContext";
import { HistoryIcon } from "../../constants";
import { supabase } from "../../lib/supabase";
import type { AuditLogEntry } from "../../types";

interface AuditLogResponse {
  success: boolean;
  entries: AuditLogEntry[];
  admin_directory?: Record<string, string>;
  customer_directory?: Record<string, string>;
  entity_customer_names?: Record<string, string>;
  is_super_admin?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: string;
}

const toAuditMetadata = (entry: AuditLogEntry): Record<string, unknown> => {
  const value = entry.metadata;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toText = (value: unknown): string | null => {
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const toAmount = (value: unknown): number | null => {
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

const getEntityKey = (entityType: string, entityId: string) =>
  `${entityType}:${entityId}`;

const getExplicitAuditAmount = (entry: AuditLogEntry): number | null => {
  const metadata = toAuditMetadata(entry);
  const amountKeys = [
    "derived_amount",
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

  for (const key of amountKeys) {
    const found = toAmount(metadata[key]);
    if (found !== null) return found;
  }

  const updates = metadata.updates;
  if (updates && typeof updates === "object" && !Array.isArray(updates)) {
    const updatesRecord = updates as Record<string, unknown>;
    const found = toAmount(updatesRecord.amount);
    if (found !== null) return found;
  }

  return null;
};

const getEntityLabel = (entityType: string) => {
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

const getActionLabel = (action: string) => {
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

const getAuditAmount = (entry: AuditLogEntry) => {
  const explicit = getExplicitAuditAmount(entry);
  return explicit ?? 0;
};

const formatAuditAmount = (entry: AuditLogEntry) =>
  getAuditAmount(entry).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatAuditTimeIst = (timestamp: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(timestamp));

const AuditLogPage = () => {
  const signalRouteReady = useRouteReady();
  const { session } = useData();

  const uiSuperAdminUid = import.meta.env.VITE_SUPER_ADMIN_UID?.trim() || "";
  const uiIsSuperAdmin = Boolean(
    uiSuperAdminUid && session?.user?.id === uiSuperAdminUid,
  );
  const sessionRole = String(session?.user?.app_metadata?.role || "").toLowerCase();
  const sessionIsSuperAdmin = sessionRole === "super_admin";

  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditCustomerNames, setAuditCustomerNames] = useState<Record<string, string>>({});
  const [auditEntityCustomerNames, setAuditEntityCustomerNames] = useState<Record<string, string>>({});
  const [auditAdminDirectory, setAuditAdminDirectory] = useState<Record<string, string>>({});
  const [serverIsSuperAdmin, setServerIsSuperAdmin] = useState(false);

  const canAccessAudit = uiIsSuperAdmin || sessionIsSuperAdmin || serverIsSuperAdmin;

  useEffect(() => {
    signalRouteReady();
  }, [signalRouteReady]);

  const enrichLegacyAuditAmounts = async (entries: AuditLogEntry[]) => {
    if (!entries.length) return entries;

    const historicalAmountByEntity = new Map<string, number>();

    entries.forEach((entry) => {
      if (!entry.entity_id) return;
      const knownAmount = getExplicitAuditAmount(entry);
      if (knownAmount === null) return;
      historicalAmountByEntity.set(
        getEntityKey(entry.entity_type, entry.entity_id),
        knownAmount,
      );
    });

    const withHistoricalFallback = entries.map((entry) => {
      if (!entry.entity_id) return entry;
      if (getExplicitAuditAmount(entry) !== null) return entry;

      const historicalAmount = historicalAmountByEntity.get(
        getEntityKey(entry.entity_type, entry.entity_id),
      );
      if (historicalAmount === undefined) return entry;

      const metadata = toAuditMetadata(entry);
      return {
        ...entry,
        metadata: {
          ...metadata,
          derived_amount: historicalAmount,
        },
      } as AuditLogEntry;
    });

    const unresolved = withHistoricalFallback.filter(
      (entry) => entry.entity_id && getExplicitAuditAmount(entry) === null,
    );

    if (!unresolved.length) return withHistoricalFallback;

    const unresolvedLoanIds = Array.from(
      new Set(
        unresolved
          .filter((entry) => entry.entity_type === "loan")
          .map((entry) => entry.entity_id as string),
      ),
    );

    const unresolvedSubscriptionIds = Array.from(
      new Set(
        unresolved
          .filter((entry) => entry.entity_type === "subscription")
          .map((entry) => entry.entity_id as string),
      ),
    );

    const unresolvedInstallmentIds = Array.from(
      new Set(
        unresolved
          .filter((entry) => entry.entity_type === "installment")
          .map((entry) => entry.entity_id as string),
      ),
    );

    const dbAmountByEntity = new Map<string, number>();

    if (unresolvedLoanIds.length > 0) {
      const { data: loanRows, error: loanError } = await supabase
        .from("loans")
        .select("id, original_amount")
        .in("id", unresolvedLoanIds);

      if (loanError) {
        console.warn("[AuditLogPage] Failed resolving loan amounts:", loanError.message);
      } else {
        (loanRows || []).forEach((row: any) => {
          const amount = toAmount(row.original_amount);
          if (row.id && amount !== null) {
            dbAmountByEntity.set(getEntityKey("loan", row.id), amount);
          }
        });
      }
    }

    if (unresolvedSubscriptionIds.length > 0) {
      const { data: subscriptionRows, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select("id, amount")
        .in("id", unresolvedSubscriptionIds);

      if (subscriptionError) {
        console.warn(
          "[AuditLogPage] Failed resolving subscription amounts:",
          subscriptionError.message,
        );
      } else {
        (subscriptionRows || []).forEach((row: any) => {
          const amount = toAmount(row.amount);
          if (row.id && amount !== null) {
            dbAmountByEntity.set(getEntityKey("subscription", row.id), amount);
          }
        });
      }
    }

    if (unresolvedInstallmentIds.length > 0) {
      const { data: installmentRows, error: installmentError } = await supabase
        .from("installments")
        .select("id, amount")
        .in("id", unresolvedInstallmentIds);

      if (installmentError) {
        console.warn(
          "[AuditLogPage] Failed resolving installment amounts:",
          installmentError.message,
        );
      } else {
        (installmentRows || []).forEach((row: any) => {
          const amount = toAmount(row.amount);
          if (row.id && amount !== null) {
            dbAmountByEntity.set(getEntityKey("installment", row.id), amount);
          }
        });
      }
    }

    return withHistoricalFallback.map((entry) => {
      if (!entry.entity_id) return entry;
      if (getExplicitAuditAmount(entry) !== null) return entry;

      const dbAmount = dbAmountByEntity.get(
        getEntityKey(entry.entity_type, entry.entity_id),
      );

      if (dbAmount === undefined) return entry;

      const metadata = toAuditMetadata(entry);
      return {
        ...entry,
        metadata: {
          ...metadata,
          derived_amount: dbAmount,
        },
      } as AuditLogEntry;
    });
  };

  const fetchAuditLogs = useCallback(
    async (nextPage = 1) => {
      const accessToken = session?.access_token;
      if (!accessToken) {
        setAuditError("Missing session token. Please sign in again.");
        return;
      }

      setAuditLoading(true);
      setAuditError(null);
      try {
      const query = new URLSearchParams({
        page: String(nextPage),
        page_size: "20",
      });

      if (auditSearch) query.set("search", auditSearch);

      const response = await fetch(
        `/.netlify/functions/get-audit-logs?${query.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const result = (await response.json()) as AuditLogResponse;

      if (response.ok && result.success) {
        setServerIsSuperAdmin(Boolean(result.is_super_admin));
        const entries = await enrichLegacyAuditAmounts(result.entries || []);
        setAuditEntries(entries);
        setAuditCustomerNames(result.customer_directory || {});
        setAuditEntityCustomerNames(result.entity_customer_names || {});
        setAuditAdminDirectory(result.admin_directory || {});
        setAuditPage(result.pagination?.page || nextPage);
        setAuditTotalPages(result.pagination?.totalPages || 1);
        setAuditTotal(result.pagination?.total || 0);
      } else {
        if (response.status === 401 || response.status === 403) {
          setServerIsSuperAdmin(false);
        }
        setAuditError(result.error || "Failed to load audit logs");
      }
    } catch (err: any) {
      setAuditError(err.message || "Failed to load audit logs");
    } finally {
      setAuditLoading(false);
    }
    },
    [session, auditSearch],
  );

  useEffect(() => {
    if (session?.access_token) {
      fetchAuditLogs(1);
    }
  }, [session, fetchAuditLogs]);

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 sm:gap-4 text-gray-800 dark:text-dark-text">
          <HistoryIcon className="w-8 h-8 sm:w-10 sm:h-10" />
          <span>Audit Log</span>
        </h2>
        <motion.button
          onClick={() => fetchAuditLogs(auditPage)}
          disabled={auditLoading || !canAccessAudit}
          className="w-10 h-10 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50"
          whileTap={{ scale: 0.9 }}
          title="Refresh"
        >
          <svg
            className={`w-5 h-5 ${auditLoading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </motion.button>
      </div>

      {!canAccessAudit && (
        <div className="mb-4 p-4 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-sm font-medium border border-rose-200 dark:border-rose-500/20">
          Access denied. This page is available only to the super admin.
        </div>
      )}

      {canAccessAudit && (
        <>
          <div className="mb-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
            Audit transactions are retained for 30 days only.
          </div>

          <div className="flex gap-2 mb-5">
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search by admin name"
              className="flex-1 px-3 py-2.5 text-sm bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
            />
            <button
              onClick={() => fetchAuditLogs(1)}
              disabled={auditLoading}
              className="px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors disabled:opacity-50"
            >
              Apply
            </button>
          </div>

          {auditError && (
            <div className="mb-4 p-4 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-sm font-medium border border-rose-200 dark:border-rose-500/20">
              {auditError}
            </div>
          )}

          {auditLoading && auditEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-slate-100 dark:border-slate-800 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Loading audit logs...
              </p>
            </div>
          ) : auditEntries.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 text-sm text-slate-500 dark:text-slate-400">
              No audit events found.
            </div>
          ) : (
            <div className="mb-5 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/90">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Transaction
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Recorded At (IST)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                  {auditEntries.map((entry) => {
                    const metadata = toAuditMetadata(entry);
                    const actorName =
                      toText(metadata.actor_name) ||
                      toText(metadata.actor_email) ||
                      auditAdminDirectory[entry.admin_uid] ||
                      "Admin user";

                    const customerId =
                      entry.entity_type === "customer"
                        ? entry.entity_id
                        : toText(metadata.customer_id);
                    const customerName =
                      toText(metadata.customer_name) ||
                      (customerId ? auditCustomerNames[customerId] : null) ||
                      null;

                    const entityCustomerName =
                      entry.entity_id
                        ? auditEntityCustomerNames[
                            getEntityKey(entry.entity_type, entry.entity_id)
                          ]
                        : null;

                    const actionLabel = getActionLabel(entry.action);
                    const entityLabel = getEntityLabel(entry.entity_type);
                    const resolvedCustomerName =
                      customerName || entityCustomerName || "Unknown Customer";
                    const value = formatAuditAmount(entry);
                    const recordedAt = formatAuditTimeIst(entry.created_at);

                    const sentence = `Admin (${actorName}) ${actionLabel} ${entityLabel} for (${resolvedCustomerName}) of (${value})`;

                    return (
                      <tr key={entry.id} className="align-top">
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-100 font-medium">
                          {sentence}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {recordedAt}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {auditTotal} total events • page {auditPage} of {auditTotalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchAuditLogs(Math.max(1, auditPage - 1))}
                disabled={auditLoading || auditPage <= 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => fetchAuditLogs(Math.min(auditTotalPages, auditPage + 1))}
                disabled={auditLoading || auditPage >= auditTotalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </PageWrapper>
  );
};

export default AuditLogPage;
