import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouteReady } from "../RouteReadySignal";
import PageWrapper from "../ui/PageWrapper";
import { useData } from "../../context/DataContext";
import { apiRequest, ApiError } from "../../lib/apiClient";
import { HistoryIcon } from "../../constants";
import type { AuditLogEntry } from "../../types";
import {
  buildAuditSentence,
  formatAuditTimeIst,
  initialAuditPageCursors,
  isQuarterlyInterestEntry,
  normalizeAuditSearch,
  toText,
  updateAuditPageCursors,
} from "./auditLogHelpers";

interface AuditLogResponse {
  success: boolean;
  entries?: unknown;
  admin_directory?: Record<string, string>;
  customer_directory?: Record<string, string>;
  entity_customer_names?: Record<string, string>;
  is_super_admin?: boolean;
  pagination?: {
    pageSize: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  error?: string;
}

type AuditAccessState = "authorizing" | "authorized" | "forbidden";
type AuditFetchMode = "initial" | "search" | "refresh" | "page";

const hasKey = <T extends object>(value: T, key: number) =>
  Object.prototype.hasOwnProperty.call(value, key);

const toRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const mapped: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const text = toText(raw);
    if (text) {
      mapped[key] = text;
    }
  }
  return mapped;
};

const isAuditLogEntry = (value: unknown): value is AuditLogEntry => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.admin_uid === "string" &&
    typeof row.action === "string" &&
    typeof row.entity_type === "string" &&
    typeof row.created_at === "string"
  );
};

const toAuditEntries = (value: unknown): AuditLogEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isAuditLogEntry);
};

const AuditLogPage = () => {
  const signalRouteReady = useRouteReady();
  const { session } = useData();

  const uiSuperAdminUid = import.meta.env.VITE_SUPER_ADMIN_UID?.trim() || "";
  const uiIsSuperAdmin = Boolean(
    uiSuperAdminUid && session?.user?.id === uiSuperAdminUid,
  );
  const sessionRole = String(session?.user?.app_metadata?.role || "").toLowerCase();
  const sessionIsSuperAdmin = sessionRole === "super_admin";
  const authHintIsSuperAdmin = uiIsSuperAdmin || sessionIsSuperAdmin;

  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditPageCursors, setAuditPageCursors] = useState<Record<number, string | null>>(
    initialAuditPageCursors(),
  );
  const auditPageCursorsRef = useRef<Record<number, string | null>>(
    initialAuditPageCursors(),
  );
  const [auditSearch, setAuditSearch] = useState("");
  const auditAppliedSearchRef = useRef("");
  const [auditCustomerNames, setAuditCustomerNames] = useState<Record<string, string>>({});
  const [auditEntityCustomerNames, setAuditEntityCustomerNames] = useState<Record<string, string>>({});
  const [auditAdminDirectory, setAuditAdminDirectory] = useState<Record<string, string>>({});
  const [accessState, setAccessState] = useState<AuditAccessState>("authorizing");
  const [fetchMode, setFetchMode] = useState<AuditFetchMode | null>(null);
  const latestRequestRef = useRef(0);

  const canAccessAudit = accessState === "authorized";
  const isAuthorizing = accessState === "authorizing";
  const isInitialLoading = auditLoading && (fetchMode === "initial" || fetchMode === null);
  const isPageLoading = auditLoading && fetchMode === "page";

  const { quarterlyAuditEntries, generalAuditEntries } = useMemo(() => {
    const quarterly: AuditLogEntry[] = [];
    const general: AuditLogEntry[] = [];
    for (const entry of auditEntries) {
      if (isQuarterlyInterestEntry(entry)) {
        quarterly.push(entry);
      } else {
        general.push(entry);
      }
    }
    return { quarterlyAuditEntries: quarterly, generalAuditEntries: general };
  }, [auditEntries]);

  useEffect(() => {
    signalRouteReady();
  }, [signalRouteReady]);

  const resetPaginationState = useCallback(() => {
    const initial = initialAuditPageCursors();
    auditPageCursorsRef.current = initial;
    setAuditPage(1);
    setAuditHasMore(false);
    setAuditPageCursors(initial);
  }, []);

  const enrichLegacyAuditAmounts = async (entries: AuditLogEntry[]) => entries;

  const fetchAuditLogs = useCallback(
    async (nextPage = 1, mode: AuditFetchMode = "page") => {
      const accessToken = session?.access_token;
      if (!accessToken) {
        setAuditError("Missing session token. Please sign in again.");
        setAccessState("forbidden");
        return;
      }

      const currentCursor = auditPageCursorsRef.current[nextPage] ?? null;
      if (nextPage > 1 && currentCursor === null) {
        setAuditError("Missing page cursor. Reload or use Next in sequence.");
        return;
      }

      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;
      setAuditLoading(true);
      setFetchMode(mode);
      setAuditError(null);
      try {
        const query = new URLSearchParams({
          page_size: "20",
        });

        const appliedSearch = auditAppliedSearchRef.current;
        if (appliedSearch) query.set("search", appliedSearch);
        if (currentCursor) query.set("cursor", currentCursor);

        const result = await apiRequest<AuditLogResponse>(
          `/.netlify/functions/get-audit-logs?${query.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            timeoutMs: 15000,
            dedupeKey: `audit-logs:${query.toString()}`,
          },
        );

        if (requestId !== latestRequestRef.current) {
          return;
        }

        if (result.success) {
          const superAdminFromServer = Boolean(result.is_super_admin ?? true);
          if (!superAdminFromServer) {
            setAccessState("forbidden");
            setAuditEntries([]);
            setAuditError("Access denied. This page is available only to the super admin.");
            return;
          }

          setAccessState("authorized");
          const entries = await enrichLegacyAuditAmounts(toAuditEntries(result.entries));
          const nextCursorFromServer = toText(result.pagination?.nextCursor) ?? null;

          setAuditEntries(entries);
          setAuditCustomerNames(toRecord(result.customer_directory));
          setAuditEntityCustomerNames(toRecord(result.entity_customer_names));
          setAuditAdminDirectory(toRecord(result.admin_directory));
          setAuditPage(nextPage);
          setAuditHasMore(Boolean(result.pagination?.hasMore));
          setAuditPageCursors((prev) => {
            const updated = updateAuditPageCursors(
              prev,
              nextPage,
              currentCursor,
              nextCursorFromServer,
            );
            auditPageCursorsRef.current = updated;
            return updated;
          });
        } else {
          setAuditError(result.error || "Failed to load audit logs");
        }
      } catch (err: any) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setAccessState("forbidden");
          setAuditEntries([]);
          setAuditHasMore(false);
          resetPaginationState();
          setAuditError("Access denied. This page is available only to the super admin.");
          return;
        }
        setAuditError(err.message || "Failed to load audit logs");
      } finally {
        if (requestId === latestRequestRef.current) {
          setAuditLoading(false);
          setFetchMode(null);
        }
      }
    },
    [authHintIsSuperAdmin, resetPaginationState, session],
  );

  useEffect(() => {
    if (session?.access_token) {
      setAccessState("authorizing");
      resetPaginationState();
      fetchAuditLogs(1, "initial");
    } else {
      setAccessState("forbidden");
      setAuditError("Missing session token. Please sign in again.");
    }
  }, [session?.access_token, fetchAuditLogs, resetPaginationState]);

  const canGoPrev =
    canAccessAudit && !auditLoading && auditPage > 1 && hasKey(auditPageCursors, auditPage - 1);
  const hasNextCursor =
    hasKey(auditPageCursors, auditPage + 1) && Boolean(auditPageCursors[auditPage + 1]);
  const canGoNext = canAccessAudit && !auditLoading && auditHasMore && hasNextCursor;

  const renderAuditRows = (entries: AuditLogEntry[]) =>
    entries.map((entry) => {
      const sentence = buildAuditSentence(entry, {
        adminDirectory: auditAdminDirectory,
        customerDirectory: auditCustomerNames,
        entityCustomerNames: auditEntityCustomerNames,
      });
      const recordedAt = formatAuditTimeIst(entry.created_at);

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
    });

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 sm:gap-4 text-gray-800 dark:text-dark-text">
          <HistoryIcon className="w-8 h-8 sm:w-10 sm:h-10" />
          <span>Audit Log</span>
        </h2>
        <motion.button
          onClick={() => fetchAuditLogs(auditPage, "refresh")}
          disabled={auditLoading || !canAccessAudit || isAuthorizing}
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

      {isAuthorizing && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700/50">
          Verifying access to audit logs...
        </div>
      )}

      {accessState === "forbidden" && (
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
              onClick={() => {
                auditAppliedSearchRef.current = normalizeAuditSearch(auditSearch);
                resetPaginationState();
                fetchAuditLogs(1, "search");
              }}
              disabled={auditLoading || isAuthorizing || !canAccessAudit}
              className="px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors disabled:opacity-50"
            >
              {fetchMode === "search" && auditLoading ? "Searching..." : "Apply"}
            </button>
          </div>

          {auditError && (
            <div className="mb-4 p-4 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-sm font-medium border border-rose-200 dark:border-rose-500/20">
              {auditError}
            </div>
          )}

          {isInitialLoading && auditEntries.length === 0 ? (
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
            <div className="space-y-5 mb-5">
              {quarterlyAuditEntries.length > 0 && (
                <div>
                  <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Quarterly Interest Audit Logs
                  </h3>
                  <div className="overflow-auto rounded-2xl border border-emerald-200 dark:border-emerald-700/60 bg-white dark:bg-slate-900/40">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-emerald-50 dark:bg-emerald-900/20">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            Transaction
                          </th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                            Recorded At (IST)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-100 dark:divide-emerald-800/30">
                        {renderAuditRows(quarterlyAuditEntries)}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {generalAuditEntries.length > 0 && (
                <div>
                  <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    General Audit Logs
                  </h3>
                  <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40">
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
                        {renderAuditRows(generalAuditEntries)}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              page {auditPage}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!canGoPrev) return;
                  fetchAuditLogs(Math.max(1, auditPage - 1), "page");
                }}
                disabled={!canGoPrev}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => {
                  if (!canGoNext) return;
                  fetchAuditLogs(auditPage + 1, "page");
                }}
                disabled={!canGoNext}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
          {isPageLoading && (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Loading page...</div>
          )}
        </>
      )}
    </PageWrapper>
  );
};

export default AuditLogPage;
