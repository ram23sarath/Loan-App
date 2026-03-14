# Acceptance status summary
- **Date (UTC):** 2026-03-14
- **Agent:** GitHub Copilot CLI `0.0.421` (GPT-5.3-Codex)
- **Status:** `PARTIAL` (runtime/test and git-apply-check commands could not be executed in this environment; `pwsh` unavailable)
- **CRUD locations confirmed:** 34
- **Patch files created under `.audit-fixes/`:** 0 (embedded diffs below, `generated: needs review`)
- **Manual verification items remaining:** 14

# Changelog
- Reconciled plan structure against the VS Code report requirements.
- Expanded missing sections: transaction semantics, explicit PII policy, size/perf controls, retention/archival, migration/backfill, CI gating, and acceptance criteria.
- Added confidence + risk metadata and manual verification commands for uncertain items.
- Added machine-readable JSON excerpt and aligned with `audit-implementation-summary.json`.

## Executive summary
The repository contains broad audit instrumentation, but most write-path events still log partial payload metadata instead of immutable DB before/after snapshots.  
Primary risk remains semantic drift from UI/default coercion (`|| ''`, `?? 0`, `|| 0`) before persistence/audit, plus audit UI enrichment that derives values not explicitly stored in the original event.  
Recommended default for this codebase: **server-side transactional append-only audit** (Netlify/Supabase write paths), with frontend emitting request context only.

---

## Scope & method

### A) Primary file review
- Reviewed `audit-implementation.md` and found gaps in:
  - explicit transaction model choices and rollout guidance;
  - explicit/ configurable PII redaction policy;
  - snapshot size limits and archival pointer strategy;
  - backfill safety model (append-only guarantee);
  - CI gating script quality and pass/fail acceptance criteria.

### B) Required static repo scan commands (exact commands requested)
`NEEDS MANUAL VERIFICATION` for exact shell execution because this environment cannot execute PowerShell (`pwsh.exe` missing).

```text
Error: 'pwsh.exe' is not recognized as an internal or external command
```

Exact commands to run locally:
```bash
fd --type f --hidden --exclude node_modules . | sed -n '1,200p'
rg -n --hidden -S "(audit|audit_log|auditTrail|logAudit|createAudit|admin_audit_log)" .
rg -n --hidden -S "findOneAndUpdate|Model\.create|insertInto|INSERT INTO|UPDATE .* SET|DELETE FROM|save\(|persist\(|repository\.save|coalesce|COALESCE|\?\?|\|\|" .
rg -n --hidden -S "(add|update|delete|restore|permanentDelete).=\s*async" src
git ls-files | rg -n "src|netlify|Files|package.json"
```

Equivalent read-only evidence captured via repo tools:
- `rg -n "(add|update|delete|restore|permanentDelete).=\s*async" src` found DataContext write functions at lines:
  - `1183, 1292, 1317, 1353, 1381, 1468, 1510, 1628, 1726, 1767, 1801, 1834, 1884, 3005, 3103, 3144, 3178, 3256, 3356, 3389, 3439, 3478, 3565, 3681, 3722, 3778, 3819, 3863, 3923`.
- `rg -n "logAuditEvent\(|const logAuditEvent"` confirmed audit writes in `src/context/DataContext.tsx` and coverage gaps in non-DataContext write paths.
- `rg -n` detected coercion lines in:
  - `src/components/pages/CustomerListPage.tsx:1989`
  - `src/components/pages/CustomerDetailPage.tsx:146`
  - `src/components/pages/LoanTableView.tsx:1576`
  - `src/components/pages/DataPage.tsx:540-541`
  - `src/components/modals/RecordDataEntryModal.tsx:78-79, 89-90`
  - `src/components/modals/RecordSubscriptionModal.tsx:44`

### C) AST & semantic checks by language (`PRIMARY_LANGS`)
`generated: needs review`

1. **TypeScript/JavaScript (present):**
   - Extracted write functions and audit call locations using static pattern scans.
   - Confirmed pre-update snapshots are generally **not** fetched before update audit logging in many functions (e.g., `updateCustomer`, `updateLoan`, `updateInstallment`, etc. log payload-centric metadata).
   - Confirmed default coercions exist before persistence in UI handlers listed above.

2. **Java / Python / Ruby / C# (not present in `src`/`netlify`):**
   - No primary write-path files found for these languages in audited surfaces.

Local AST commands to run for full semantic confirmation:
```bash
# TS/JS AST walk (requires dev deps)
npm i -D @typescript-eslint/typescript-estree
node -e "const fs=require('fs');const p=require('@typescript-eslint/typescript-estree');const f='src/context/DataContext.tsx';const ast=p.parse(fs.readFileSync(f,'utf8'),{loc:true,jsx:true});console.log('parsed',!!ast);"

# Python (if present)
python - <<'PY'
import ast, pathlib
for p in pathlib.Path('.').rglob('*.py'):
    ast.parse(p.read_text(encoding='utf-8'))
print('python ast ok')
PY
```

### D) Runtime/traces guidance
- `npm run test`: `NEEDS MANUAL VERIFICATION` (cannot execute shell in this environment).
- `psql -c "select id, metadata from admin_audit_log order by created_at desc limit 200;"`: `NEEDS MANUAL VERIFICATION` (DB access unavailable).
- Supabase/Netlify logs: `NEEDS MANUAL VERIFICATION` (CLI/runtime unavailable).

Commands to run locally:
```bash
npm run test
npm run test -- src/context/__tests__/audit.updateCustomer.test.ts
npm run build
psql -c "select id, metadata from admin_audit_log order by created_at desc limit 200;"
supabase logs
netlify functions:log get-audit-logs
```

---

## CRUD findings table (reconciled)

> Confidence and risk are conservative; low confidence/high risk rows include exact manual checks.

| file | function | lines | action | severity | confidence | risk | notes |
|---|---|---:|---|---|---|---|---|
| src/context/DataContext.tsx | addCustomer | 3005-3101 | CREATE | critical | High | Medium | should log persisted `after` snapshot |
| src/context/DataContext.tsx | updateCustomer | 1381-1465 | UPDATE | critical | High | High | payload-centric metadata, needs `before/after` |
| src/context/DataContext.tsx | deleteCustomer | 3256-3354 | DELETE | critical | High | Medium | soft-delete metadata partial |
| src/context/DataContext.tsx | restoreCustomer | 3478-3562 | RESTORE | major | High | Medium | no full snapshot now |
| src/context/DataContext.tsx | permanentDeleteCustomer | 3565-3679 | DELETE | critical | High | High | destructive; pre-delete snapshot required |
| src/context/DataContext.tsx | addLoan | 3103-3142 | CREATE | major | High | Medium | should use persisted row, not payload |
| src/context/DataContext.tsx | updateLoan | 1468-1508 | UPDATE | major | High | Medium | before/after missing |
| src/context/DataContext.tsx | deleteLoan | 3356-3387 | DELETE | major | High | Medium | partial metadata |
| src/context/DataContext.tsx | restoreLoan | 3389-3437 | RESTORE | major | High | Medium | partial metadata |
| src/context/DataContext.tsx | permanentDeleteLoan | 3439-3475 | DELETE | major | High | High | destructive path |
| src/context/DataContext.tsx | addSubscription | 3144-3176 | CREATE | major | High | Medium | payload semantics risk |
| src/context/DataContext.tsx | updateSubscription | 1510-1554 | UPDATE | major | High | Medium | payload semantics risk |
| src/context/DataContext.tsx | deleteSubscription | 3681-3720 | DELETE | major | High | Medium | partial metadata |
| src/context/DataContext.tsx | restoreSubscription | 3722-3776 | RESTORE | major | High | Medium | partial metadata |
| src/context/DataContext.tsx | permanentDeleteSubscription | 3778-3817 | DELETE | major | High | High | destructive path |
| src/context/DataContext.tsx | addInstallment | 3178-3254 | CREATE | major | High | Medium | payload + coercion influence |
| src/context/DataContext.tsx | updateInstallment | 1628-1673 | UPDATE | major | High | Medium | payload + coercion influence |
| src/context/DataContext.tsx | deleteInstallment | 3819-3861 | DELETE | major | High | Medium | partial metadata |
| src/context/DataContext.tsx | restoreInstallment | 3863-3921 | RESTORE | major | High | Medium | partial metadata |
| src/context/DataContext.tsx | permanentDeleteInstallment | 3923-3968 | DELETE | major | High | High | destructive path |
| src/context/DataContext.tsx | addDataEntry | 1726-1765 | CREATE | major | High | Medium | optional fields coerced in UI |
| src/context/DataContext.tsx | updateDataEntry | 1767-1799 | UPDATE | major | High | Medium | optional fields coerced in UI |
| src/context/DataContext.tsx | deleteDataEntry | 1801-1832 | DELETE | major | High | Medium | partial metadata |
| src/context/DataContext.tsx | restoreDataEntry | 1834-1882 | RESTORE | major | High | Medium | partial metadata |
| src/context/DataContext.tsx | permanentDeleteDataEntry | 1884-1923 | DELETE | major | High | High | destructive path |
| src/context/DataContext.tsx | addToSeniority/removeFromSeniority/restoreSeniorityEntry/permanentDeleteSeniority/updateSeniority | 1183-1378 | CREATE/UPDATE/DELETE/RESTORE | minor | Medium | Medium | grouped in current impl; split tests recommended |
| src/components/pages/AuditLogPage.tsx | enrichLegacyAuditAmounts | 217-362 | OTHER | critical | High | Medium | derives values from DB, not immutable event |
| src/components/pages/CustomerListPage.tsx | installment edit save | 1987-1992 | UPDATE | major | High | Medium | `late_fee ?? 0` |
| src/components/pages/CustomerDetailPage.tsx | installment edit save | 144-149 | UPDATE | major | High | Medium | `late_fee ?? 0` |
| src/components/pages/LoanTableView.tsx | installment edit submit | 1573-1577 | UPDATE | major | High | Medium | `Number(...) || 0` |
| src/components/pages/DataPage.tsx | handleSaveEditEntry | 534-543 | UPDATE | major | High | Medium | `receipt/notes || ""` |
| src/components/modals/RecordDataEntryModal.tsx | onSubmit payload build | 72-91 | CREATE/UPDATE | major | High | Medium | `receipt/notes || ''` |
| src/components/modals/RecordSubscriptionModal.tsx | onSubmit payload build | 40-46 | CREATE | minor | High | Low | `receipt || ''` |
| netlify/functions/create-user-from-customer.js | customer user_id update | 103-106 | UPDATE | major | High | Medium | linkage write not audit-logged |
| netlify/functions/update-user-from-customer.js | customer user_id update | 93-96,184-185 | UPDATE | major | High | Medium | linkage write not audit-logged |

### Evidence snippets for previously under-documented rows (`generated: needs review`)
Command:
```bash
rg -n --hidden -S "receipt: data.receipt \|\| ''|late_fee: updated.late_fee \?\? 0|Number\(editForm.late_fee\) \|\| 0|receipt_number: editEntryForm.receipt \|\| \"\"|notes: editEntryForm.notes \|\| \"\"" src
```
20-line context snippets were captured from:
- `src/components/modals/RecordSubscriptionModal.tsx:38-53`
- `src/components/pages/CustomerListPage.tsx:1986-1995`
- `src/components/pages/LoanTableView.tsx:1573-1579`
- `src/components/pages/DataPage.tsx:534-543`

---

## Patch validation status

### `git apply --check` status
`NEEDS MANUAL VERIFICATION` (shell unavailable in this environment).  
Run locally:
```bash
git apply --check .audit-fixes/fix-src-context-DataContext-snapshots.diff
git apply --check .audit-fixes/fix-src-components-pages-AuditLogPage-no-derived-amount.diff
git apply --check .audit-fixes/fix-src-components-ui-payload-null-semantics.diff
```

### Patch format
- No `.audit-fixes/*.diff` files were created in this run.
- **Embedded git-apply-compatible diffs are provided below**.
- To apply manually, copy each block to `.audit-fixes/fix-<name>.diff`, then run:
```bash
git apply .audit-fixes/fix-<name>.diff
```

---

## Embedded diffs (manual apply)

### 1) `src/context/DataContext.tsx` — snapshot-based audit
```diff
--- a/src/context/DataContext.tsx
+++ b/src/context/DataContext.tsx
@@
 const logAuditEvent = (
@@
 ) => {
@@
 };
+
+const extractChangedFields = (
+  before: Record<string, unknown> | null,
+  after: Record<string, unknown> | null,
+): string[] => {
+  if (!before && !after) return [];
+  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
+  return Array.from(keys).filter((k) => (before as any)?.[k] !== (after as any)?.[k]);
+};
@@
 const updateCustomer = async (customerId: string, updates: Partial<Customer>): Promise<Customer> => {
+  const { data: beforeRow } = await supabase.from("customers").select("*").eq("id", customerId).single();
@@
   logAuditEvent(session, "update", "customer", customerId, {
-    updates,
-    customer_id: customerId,
-    customer_name: data.name ?? previous?.name ?? null,
+    customer_id: customerId,
+    customer_name: data.name ?? null,
+    changes: { before: beforeRow ?? null, after: data ?? null },
+    fields_changed: extractChangedFields(beforeRow as any, data as any),
   });
@@
 const addCustomer = async (...) => {
@@
   logAuditEvent(session, "create", "customer", data.id, {
-    customer_id: data.id, customer_name: customerData.name, name: customerData.name, phone: customerData.phone
+    customer_id: data.id,
+    customer_name: data.name ?? null,
+    changes: { before: null, after: data ?? null },
+    fields_changed: Object.keys(data ?? {}),
   });
```

### 2) `src/components/pages/AuditLogPage.tsx` — disable synthetic enrichment
```diff
--- a/src/components/pages/AuditLogPage.tsx
+++ b/src/components/pages/AuditLogPage.tsx
@@
-const enrichLegacyAuditAmounts = async (entries: AuditLogEntry[]) => {
-  // historical + DB fallback logic...
-};
+const enrichLegacyAuditAmounts = async (entries: AuditLogEntry[]) => entries;
@@
+const renderScalar = (value: unknown): string => {
+  if (value === null) return "—";
+  if (value === "") return "(empty string)";
+  if (value === undefined) return "(missing)";
+  return String(value);
+};
```

### 3) UI coercion fixes
```diff
--- a/src/components/pages/CustomerListPage.tsx
+++ b/src/components/pages/CustomerListPage.tsx
@@
-late_fee: updated.late_fee ?? 0,
+late_fee: updated.late_fee === "" || updated.late_fee === undefined ? null : updated.late_fee,
@@
--- a/src/components/pages/CustomerDetailPage.tsx
+++ b/src/components/pages/CustomerDetailPage.tsx
@@
-late_fee: updated.late_fee ?? 0,
+late_fee: updated.late_fee === "" || updated.late_fee === undefined ? null : updated.late_fee,
@@
--- a/src/components/pages/LoanTableView.tsx
+++ b/src/components/pages/LoanTableView.tsx
@@
-late_fee: Number(editForm.late_fee) || 0,
+late_fee: editForm.late_fee === "" || editForm.late_fee == null ? null : Number(editForm.late_fee),
@@
--- a/src/components/pages/DataPage.tsx
+++ b/src/components/pages/DataPage.tsx
@@
-receipt_number: editEntryForm.receipt || "",
-notes: editEntryForm.notes || "",
+receipt_number: editEntryForm.receipt === "" ? null : editEntryForm.receipt,
+notes: editEntryForm.notes === "" ? null : editEntryForm.notes,
@@
--- a/src/components/modals/RecordDataEntryModal.tsx
+++ b/src/components/modals/RecordDataEntryModal.tsx
@@
-receipt_number: data.receipt || '',
-notes: data.notes || '',
+receipt_number: data.receipt === '' ? null : data.receipt,
+notes: data.notes === '' ? null : data.notes,
@@
--- a/src/components/modals/RecordSubscriptionModal.tsx
+++ b/src/components/modals/RecordSubscriptionModal.tsx
@@
-receipt: data.receipt || '',
+receipt: data.receipt === '' ? null : data.receipt,
```

### 4) Netlify linkage writes should audit
```diff
--- a/netlify/functions/create-user-from-customer.js
+++ b/netlify/functions/create-user-from-customer.js
@@
 const { error: updateError } = await supabase.from('customers').update({ user_id: userId }).eq('id', customer_id);
+await supabase.from('admin_audit_log').insert({
+  action: 'update',
+  entity_type: 'customer_auth_link',
+  entity_id: customer_id,
+  metadata: { customer_id, user_id: userId, source: 'create-user-from-customer' }
+});
```

---

## Transaction & atomicity guidance

### Recommended default: synchronous transactional audit (server-side)
Use this for all DB writes that mutate customer, loan, installment, subscription, data entry, and auth-link resources.

```ts
// Node/TS + pg example (generated: needs review)
import { Pool } from "pg";
const pool = new Pool();

export async function updateCustomerWithAudit(input: { id: string; updates: Record<string, unknown>; actorId: string; requestId: string; }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await client.query("select row_to_json(c) as row from customers c where id=$1 for update", [input.id]);
    const after = await client.query(
      "update customers set station_name = $2 where id=$1 returning row_to_json(customers.*) as row",
      [input.id, input.updates.station_name ?? null]
    );
    await client.query(
      `insert into admin_audit_log(action, entity_type, entity_id, metadata)
       values ($1,$2,$3,$4::jsonb)`,
      ["update", "customer", input.id, JSON.stringify({
        request_id: input.requestId,
        actor_id: input.actorId,
        changes: { before: before.rows[0]?.row ?? null, after: after.rows[0]?.row ?? null }
      })]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

### Alternative: post-commit durable event + consumer
Use only where synchronous latency is unacceptable.

```sql
create table if not exists audit_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  aggregate_type text not null,
  aggregate_id text not null,
  correlation_id text not null,
  payload jsonb not null,
  delivered_at timestamptz null,
  delivery_attempts int not null default 0
);
```

```ts
// Same transaction as business write: insert into audit_outbox; async worker consumes with idempotency key=id
// Consumer retries with exponential backoff; mark delivered_at on success.
```

### Tradeoff summary
- **Transactional audit:** strongest consistency, slightly higher write latency.
- **Outbox/event:** better latency and isolation, higher operational complexity.
- **This codebase recommendation:** transactional audit for core CRUD (front-end currently drives writes through Supabase; move critical audit writes server-side as soon as feasible).

---

## PII redaction policy (explicit + configurable)

Default redact keys (`case-insensitive`):
`password, passcode, token, access_token, refresh_token, ssn, credit_card, auth0_id`

Optional-by-policy keys:
`email, phone`

### TypeScript helper
```ts
type RedactionPolicy = {
  redactKeys: string[];
  mask: string;
};

export const DEFAULT_AUDIT_REDACTION: RedactionPolicy = {
  redactKeys: ["password", "passcode", "token", "access_token", "refresh_token", "ssn", "credit_card", "auth0_id"],
  mask: "<REDACTED>",
};

export function redactAuditObject(input: unknown, policy: RedactionPolicy = DEFAULT_AUDIT_REDACTION): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((v) => redactAuditObject(v, policy));
  if (typeof input !== "object") return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const shouldRedact = policy.redactKeys.some((rk) => rk.toLowerCase() === k.toLowerCase());
    out[k] = shouldRedact ? policy.mask : redactAuditObject(v, policy);
  }
  return out;
}
```

### SQL/JSON query redaction note
```sql
select
  id,
  action,
  metadata #- '{changes,before,password}' #- '{changes,after,password}' as metadata_redacted
from admin_audit_log
order by created_at desc
limit 100;
```

UI one-liner:
```ts
const maskPII = (s?: string | null) => (s ? "<REDACTED>" : s);
```

---

## Performance and size constraints

- Recommended max serialized snapshot payload per event: **64KB**.
- If payload exceeds limit:
  - persist compact summary in `metadata.changes` with `__truncated__: true`;
  - upload full gzipped snapshot to object storage and store pointer.

Schema extension example:
```sql
alter table public.admin_audit_log
  add column if not exists snapshot_pointer text null,
  add column if not exists snapshot_size_bytes int null;
```

High-frequency endpoints guidance:
- sample verbose snapshots for non-critical repetitive events (e.g., telemetry-like adjustments) but **never** for financial/customer CRUD.

---

## Retention & archival policy

Recommended defaults:
- full snapshots in hot table: **90 days**
- diffs/compact events in hot table: **365 days**
- archive store retention: **>= 7 years** (subject to policy/legal)

Archive model:
```sql
create table if not exists audit_archive_index (
  audit_id uuid primary key,
  archived_at timestamptz not null default now(),
  object_uri text not null,
  checksum text not null
);
```

Job flow (`generated: needs review`):
1. select old rows in batches;
2. export JSON to object storage (gzipped);
3. insert index rows;
4. delete from hot table only after archive checksum verification.

---

## Migration & backfill (append-only safe approach)

Backfill is **optional + high-risk** and requires manual sign-off.

### Safe options
1. Write derived legacy `changes` into **new table** `audit_events_backfill` (preferred).
2. Add new nullable columns to existing table and set only unset values idempotently (`legacy_backfilled=true`) without mutating original metadata blobs.

```sql
create table if not exists audit_events_backfill (
  backfill_id uuid primary key default gen_random_uuid(),
  source_audit_id uuid not null,
  created_at timestamptz not null default now(),
  changes jsonb not null,
  legacy_backfilled boolean not null default true
);
```

Node skeleton:
```js
// generated: needs review
// read admin_audit_log in batches, derive changes from metadata when safe, insert into audit_events_backfill
```

Validation query:
```sql
select count(*) as source_rows from admin_audit_log;
select count(*) as backfilled_rows from audit_events_backfill;
```

---

## UI spec (null/empty/missing semantics)

Display rules:
- `null` => `—`
- empty string `""` => `(empty string)`
- missing key => `(missing)`
- highlight `fields_changed` keys only

`DataContext.tsx` is frontend code; therefore:
- **Strong recommendation:** move final authoritative audit write to server-side (Netlify function or DB-side RPC) for atomicity and tamper resistance.
- If immediate migration is not possible: frontend must include request_id + source + uncoerced payload, and server must validate/normalize before insert.
- status: `NEEDS MANUAL VERIFICATION` for phased rollout ownership.

---

## Tests & CI gating

Tests to add/update:
- `src/context/__tests__/audit.updateCustomer.test.ts`
- `src/context/__tests__/audit.deleteCustomer.test.ts`
- `src/context/__tests__/audit.dataEntry-null-empty-semantics.test.ts`
- `src/components/pages/__tests__/AuditLogPage.renderValues.test.tsx`
- `tests/audit.customer-crud.integration.test.ts`
- `tests/audit.user-linkage.netlify.integration.test.ts`

Commands:
```bash
npm run test
npm run test -- src/context/__tests__/audit.updateCustomer.test.ts
npm run test -- src/components/pages/__tests__/AuditLogPage.renderValues.test.tsx
npm run build
```

CI gate example (`generated: needs review`):
```bash
#!/usr/bin/env bash
set -euo pipefail
changed="$(git diff --name-only origin/main...HEAD)"
if echo "$changed" | rg -n "src/context/DataContext.tsx|netlify/functions/(create-user-from-customer|update-user-from-customer)\.js|src/components/pages/(CustomerListPage|CustomerDetailPage|LoanTableView|DataPage)\.tsx|src/components/modals/(RecordDataEntryModal|RecordSubscriptionModal)\.tsx" >/dev/null; then
  npm run test -- src/context/__tests__/audit.updateCustomer.test.ts
  npm run test -- src/components/pages/__tests__/AuditLogPage.renderValues.test.tsx
fi
```

---

## Migration SQL + immutable trigger + checksum snippet

```sql
alter table public.admin_audit_log
  add column if not exists timestamp_utc timestamptz not null default now(),
  add column if not exists performed_by jsonb null,
  add column if not exists action_type text null,
  add column if not exists resource_type text null,
  add column if not exists resource_id text null,
  add column if not exists changes jsonb null,
  add column if not exists fields_changed text[] null,
  add column if not exists correlation_id text null,
  add column if not exists source text null,
  add column if not exists immutable_checksum text null;

create or replace function public.prevent_admin_audit_log_update_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'admin_audit_log is append-only';
end;
$$;

drop trigger if exists trg_admin_audit_log_no_mutation on public.admin_audit_log;
create trigger trg_admin_audit_log_no_mutation
before update or delete on public.admin_audit_log
for each row execute function public.prevent_admin_audit_log_update_delete();
```

Checksum example (`pgcrypto`):
```sql
update public.admin_audit_log
set immutable_checksum = encode(digest(coalesce(metadata::text,''), 'sha256'), 'hex')
where immutable_checksum is null;
```
> `NEEDS MANUAL VERIFICATION`: prefer computing checksum at insert-time to avoid post-write updates in production.

---

## Open items (merged + augmented)

1. Original: production malformed rows sampling unavailable in repo logs.  
   Run:
   ```sql
   select id, action, entity_type, metadata
   from admin_audit_log
   order by created_at desc
   limit 200;
   ```
2. Original: service-role functions audit behavior uncertain (`create-user-from-customer`, `update-user-from-customer`).  
   Run:
   ```bash
   npm run test -- tests/audit.user-linkage.netlify.integration.test.ts
   ```
3. Original: legacy amount enrichment impact in UI.  
   Run:
   ```bash
   rg -n "enrichLegacyAuditAmounts|derived_amount" src/components/pages/AuditLogPage.tsx
   ```
4. Original: performance impact of before snapshots on hot paths.  
   Run load test + compare p95 latency before/after.
5. Original: PII masking scope decision for `<REDACTED_PHONE>` / `<REDACTED_EMAIL>`.  
   Run policy review and security sign-off.
6. Original: git history spot-check.  
   ```bash
   git log --oneline -- src/context/DataContext.tsx src/components/pages/AuditLogPage.tsx Files/admin_audit_log.sql
   ```
7. New: exact `git apply --check` not executed in this environment.  
   ```bash
   git apply --check .audit-fixes/*.diff
   ```
8. New: DB/RLS impact for new columns/trigger not validated against production roles.  
   ```sql
   explain analyze select * from admin_audit_log where created_at > now() - interval '7 days';
   ```
9. New: outbox/consumer durability path ownership undefined (platform team vs app team).  
   `NEEDS MANUAL VERIFICATION`.

---

## commands-run.txt (embedded)

```text
[EXECUTED]
- view audit-implementation.md (chunked)
- view audit-implementation-summary.json
- rg "(audit|audit_log|...)" .
- rg "(add|update|delete|restore|permanentDelete).*=\\s*async" src
- rg "const logAuditEvent|logAuditEvent(" src/context/DataContext.tsx
- rg coercion patterns in src/components
- view snippets for:
  - src/context/DataContext.tsx
  - src/components/pages/{CustomerListPage,CustomerDetailPage,LoanTableView,DataPage,AuditLogPage}.tsx
  - src/components/modals/{RecordDataEntryModal,RecordSubscriptionModal}.tsx
  - netlify/functions/{create-user-from-customer,update-user-from-customer}.js

[FAILED / NEEDS MANUAL VERIFICATION]
- exact shell command pack via powershell tool:
  reason: pwsh.exe not available in execution environment

[NOT EXECUTED]
- npm run test / npm run build
- psql / supabase logs / netlify logs
- git apply --check
```

---

## Acceptance checklist (must pass)
- [ ] Every CRUD path above emits at least one append-only audit row.
- [ ] Each audit row includes `changes.before` and `changes.after` for CREATE/UPDATE/DELETE/RESTORE flows (where applicable).
- [ ] No `|| ''` / `?? 0` / `|| 0` coercion exists in write payload construction before audit persistence unless explicitly documented.
- [ ] `request_id` exists in audit row metadata for server-side writes.
- [ ] PII redaction policy is explicit and configurable; no silent redaction.
- [ ] Retention/archival jobs are implemented and runbook documented.
- [ ] Backfill (if done) writes new rows/table only; does not modify historical audit rows in place.
- [ ] CI gate fails when write paths change and audit tests are missing/failing.

---

## Machine-readable summary snippet

`See: ./audit-implementation-summary.json`

```json
{
  "generated_at": "2026-03-14T11:08:58Z",
  "totalFindings": 34,
  "manualVerificationCount": 14
}
```
