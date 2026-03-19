# Audit Log Feature Gap Analyzer + Implementer

You are an implementation agent working inside this repository.

## Objective
Given a FLOW input from the user, analyze the current codebase behavior and determine whether the flow is fully supported for the Audit Log feature centered on src/components/pages/AuditLogPage.tsx. Identify all gaps, implement missing pieces, and verify the result.

## Input
The user will provide:
- FLOW: a plain-language sequence of expected behavior (user actions, system actions, and expected UI/data results).

Use this exact input block format in your run:

FLOW:
{{FLOW_INPUT}}

## Repository Context You Must Respect
- Frontend stack: React + TypeScript + Vite.
- Audit log page: src/components/pages/AuditLogPage.tsx.
- Audit API function: netlify/functions/get-audit-logs.js.
- Audit DB schema and RLS reference: Files/admin_audit_log.sql.
- Audit docs: Files/docs/admin-audit-log.md.
- Route wiring and guards: src/App.tsx.
- Admin tools entrypoint: src/components/ProfileHeader/modals/ToolsModal.tsx.
- Audit write behavior usually originates in DataContext and Netlify functions:
  - src/context/DataContext.tsx
  - netlify/functions/create-user-from-customer.js
  - netlify/functions/update-user-from-customer.js
  - netlify/functions/delete-user-from-customer.js
  - netlify/functions/quarterly-interest-cron.js

## Core Task
1. Parse FLOW into explicit requirements.
2. Map each requirement to current implementation.
3. Find gaps (functional, security, data-shape, UX, pagination, filtering, formatting, authorization, error states, performance, and regression risk).
4. Implement missing behavior with minimal, targeted code changes.
5. Validate by running appropriate checks.
6. Return a concise implementation report.

## FLOW Parsing Rules (Strict)
You must parse FLOW into a structured requirement matrix before any coding.

Required extracted fields per flow step:
- Actor: who performs the step (for example: super admin, admin, scoped customer, backend cron, system).
- Action: what is performed (click, fetch, create, update, delete, paginate, search, authorize).
- Target: entity/page/API affected.
- Preconditions: auth role, data existence, route state, feature flags, required metadata.
- Expected UI state: visible/hidden controls, loading/error/empty/success states, section placement, button enabled/disabled state.
- Expected data state: payload fields, sorting, filtering, pagination cursors, retention window, fallback values.
- Failure path: expected behavior for 401/403/500/network/invalid input.

Normalization rules:
- Convert ambiguous language into testable assertions.
- Split compound sentences into atomic requirements.
- Mark missing details as assumptions and keep them explicit.
- Do not proceed to implementation until all flow steps are mapped to assertions.

## Mandatory Analysis Checklist
Perform all checks, even if FLOW mentions only some of them.

### A) Access and Security
- Confirm Audit Log page is protected both in UI and on server authorization.
- Verify super-admin checks are server-authoritative (not only env-based UI toggle).
- Validate unauthorized responses and UI handling (401/403 paths).
Acceptance criteria:
- Non-authorized users cannot access audit data even if UI route/navigation is forced.
- UI presents a deterministic access-denied or error state for forbidden responses.
- Server authorization remains authoritative for every data response.

### B) Data Contract Integrity
- Verify AuditLogPage response typing matches get-audit-logs.js payload shape.
- Validate pagination contract: page size, cursor encoding/decoding, hasMore, nextCursor.
- Confirm ID assumptions (uuid/string) are consistent between SQL schema, function, and TS types.
Acceptance criteria:
- Frontend parsing tolerates optional/legacy fields without runtime failure.
- Cursor pagination works across sequential navigation and search resets.
- IDs are validated/handled consistently without type coercion bugs.

### C) Search and Filtering
- Verify search behavior from UI to function is safe and accurate.
- Confirm wildcard escaping / ilike safety and UUID-specific admin_uid filtering.
- Ensure Apply/search reset behavior works correctly with cursor pagination.
Acceptance criteria:
- Search terms cannot broaden results due to unescaped wildcard characters.
- UUID and text searches behave predictably and never cause server query errors.
- Applying a new search resets paging state deterministically.

### D) Transaction Sentence Quality
- Validate sentence composition in AuditLogPage:
  - actor resolution
  - entity/action labels
  - customer name resolution
  - amount extraction and diff display
  - field-change summaries
- Check edge cases: null metadata, missing before/after, deleted related entities, raw IDs.
Acceptance criteria:
- Each row renders a readable transaction sentence without undefined/null artifacts.
- Amount and field-change details are correct for create/update/delete variants.
- Missing metadata falls back safely to known defaults.

### E) Quarterly vs General Segmentation
- Verify quarterly-interest detection logic and classification.
- Ensure entries are not lost or double-counted between sections.
Acceptance criteria:
- Every entry is rendered exactly once in the correct section.
- Quarterly-interest identification handles metadata and entity-type based cases.

### F) Related-Entity Name Resolution
- Confirm get-audit-logs.js resolves customer names for:
  - customer
  - loan
  - subscription
  - installment (via loan)
  - data_entry
- Verify fallback behavior when related entities are deleted/missing.
Acceptance criteria:
- Customer names resolve for all supported entity paths when source rows exist.
- Deleted/missing related rows still produce stable fallback display text.

### G) Error and Loading UX
- Validate initial loading, empty state, refresh behavior, and error rendering.
- Confirm Prev/Next button disable logic and cursor prerequisites.
Acceptance criteria:
- Loading/empty/error states are mutually consistent and user-actionable.
- Pagination controls always reflect true navigability and never request invalid cursors.

### H) 30-Day Retention Consistency
- Ensure API behavior and UI messaging align with 30-day retention rules.
Acceptance criteria:
- Returned results always honor rolling 30-day server window.
- UI copy accurately reflects retention behavior.

### I) Regression and Compatibility
- Verify no breakage in route lazy-loading, admin tools navigation, or scoped-customer behavior.
- Keep changes minimal and avoid unrelated refactors.
Acceptance criteria:
- Audit log route and tool entry navigation continue to work as before.
- Scoped-customer restrictions and admin-only boundaries remain intact.

## Gap Severity Classification (Required)
Classify every gap with one severity:
- S0 Critical: security/authorization bypass, data corruption/loss, or system outage risk.
- S1 High: major functional break in core flow, incorrect audit visibility, or incorrect mutation history rendering.
- S2 Medium: partial flow failure, incorrect fallback behavior, pagination/search inconsistencies, notable UX correctness issue.
- S3 Low: minor UI/copy inconsistencies, non-blocking polish issues.

Prioritization rules:
- Fix S0 and S1 first.
- Do not defer S0/S1 unless explicitly blocked; document blocker with evidence.
- Include severity in the Gap Analysis section for each requirement.

## Implementation Rules
- Prefer minimal diffs in existing files.
- Preserve existing coding style and naming.
- Do not remove existing security checks.
- Add small helper functions only when needed.
- If backend payload changes, update frontend types and parsing accordingly.
- If a gap cannot be safely solved, add a guarded fallback and document it.
- Do not modify DB schema, RLS policies, auth role semantics, or retention window logic unless strictly required by FLOW and justified in writing.
- Any DB/RLS/auth contract change must include:
  - explicit justification,
  - risk assessment,
  - rollback note,
  - compatibility impact statement.
- For backend contract changes, implement a safe fallback strategy:
  - backward-compatible response handling,
  - default values for missing fields,
  - defensive parsing,
  - graceful UI degradation without crash.

## Testing Requirements (Required)
- For every implemented gap fix, create or update tests when test infrastructure exists for that layer.
- Minimum expectation:
  - frontend logic/rendering change -> component/unit test update,
  - Netlify function behavior change -> function/unit test update,
  - shared parsing/utility change -> unit test update.
- If automated tests are not feasible in current repo/tooling, provide:
  - exact reason,
  - a focused manual verification checklist mapped to changed behavior.

## Verification Steps
Run as applicable:
- npm run build
- npm run test (if available and relevant)
- Any focused checks needed for touched files
- Run newly added/updated tests for affected behavior.

If a command cannot run in current environment, state exactly what could not be run and why.

## Output Format (Required)
Return your result in this exact section order:

1) Requirements Parsed from FLOW
- Bullet list of normalized requirements.

2) Gap Analysis
- For each requirement: status = covered / partial / missing.
- For each requirement: include severity = S0 / S1 / S2 / S3 when status is partial or missing.
- Include file-level evidence.

3) Implemented Changes
- Bullet list of code changes with file paths.
- Mention key logic decisions.

4) Validation Results
- Commands run and pass/fail outcomes.
- Any remaining risks.

5) Final Behavior Summary
- Short summary of what now works end-to-end for the FLOW.

## Quality Bar
Do not stop at analysis only. If gaps exist, implement them in this run.
If no gaps exist, explicitly prove coverage with file evidence and validation results.
