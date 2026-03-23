# Fetch Audit Report

## Short audit summary
- The app has two main fetch stacks: direct Supabase reads/writes inside `DataContext` for core business data, and ad hoc browser `fetch()` calls for Netlify functions across audit/admin/backup flows.
- The biggest bottleneck was duplicated app-data loading logic: initialization, manual refresh, and post-login recovery each reimplemented nearly the same customer/loan/subscription/installment/data-entry fetch flow.
- The biggest robustness gap was inconsistent browser fetch handling: no shared timeout policy, no in-flight dedupe, mixed JSON parsing/error handling, and no standardized distinction between timeout/network/HTTP failures.

## Fetch entry points found
- `src/context/DataContext.tsx`: primary app data loading, auth/session fetches, background customer auth sync helpers, summary prefetch, and CRUD refreshes.
- `src/components/pages/AuditLogPage.tsx`: paginated audit-log fetch via Netlify function.
- `src/components/ProfileHeader/hooks/useBackupWorkflow.ts`: trigger/poll/cancel/download backup workflow via Netlify functions.
- `src/components/ProfileHeader/modals/ToolsModal.tsx`: create auth user, reset password, compare users, sync customer auth, fetch admins.
- `src/components/pages/HomePage.tsx`: direct signed-URL file download fetch.
- `src/lib/supabase.ts`: fetch proxy wrapper for production Supabase auth/rest requests.
- `src/components/pages/SummaryPage.tsx`, `src/components/pages/HomePage.tsx`, `src/components/ProfileHeader/hooks/useNotifications.ts`, and `src/components/modals/customer-detail/hooks/useCustomerInterest.ts`: direct Supabase reads outside the central app-data flow.

## Highest-impact problems
1. **Duplicated core data loaders in `DataContext`** caused maintainability risk and made duplicate requests more likely during init/login recovery.
2. **No standardized browser fetch client** meant Netlify requests had inconsistent timeout, retry, dedupe, caching, and error handling behavior.
3. **Repeated non-critical reads** like audit/admin status polling lacked dedupe/cache controls, creating avoidable network work during repeated UI interactions.

## Safe fixes implemented
- Added a shared `apiRequest` client with timeout, abort propagation, in-flight dedupe, optional caching, retry hooks, and normalized error types.
- Added shared Supabase data loaders for scoped/admin snapshots plus in-flight dedupe for the app’s core data graph.
- Refactored `DataContext` refresh/login recovery paths to reuse the same snapshot loader instead of reimplementing parallel fetch trees.
- Migrated Audit Log, Backup Workflow, and Tools Modal Netlify calls to the shared client.
- Added targeted tests for request dedupe/cache/error normalization.

## Areas that still need caution
- Many CRUD writes in `DataContext` still call Supabase directly; they are correct, but a larger follow-up could extract write-side service modules.
- `HomePage` signed-URL download still uses raw `fetch()` because it intentionally consumes a blob from a one-time URL and does not benefit from app-level caching.
- `SummaryPage` and notifications still use direct Supabase reads; they are lower-risk and were left unchanged to avoid over-refactoring.

## Expected performance wins
- Duplicate in-flight app-data loads now collapse onto a single promise for scoped/admin snapshots.
- Repeated audit/admin/tooling fetches now share a consistent timeout+dedeupe layer.
- Compare-users calls now use a short stale cache to avoid needless repeated admin diagnostics requests.
- Fewer bespoke request branches reduce accidental re-renders and reduce correctness risk when future fetch changes are needed.
