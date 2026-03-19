---
name: audit-log-workflow
description: "Use when working on audit-log pages, audit-log APIs, or related data-flow fixes that need end-to-end tracing, pagination/search validation, and safety checks."
---

# Audit Log Workflow

## Purpose
Use this skill for changes that touch the audit log UI, Netlify functions, or any supporting data flow that feeds audit events, filters, pagination, or access control.

## Core Process
1. Trace the full path before editing: UI -> context/store -> API/function -> database -> API response -> UI render.
2. Identify the contract at each hop, including required fields, fallback values, and authorization checks.
3. Classify the issue severity.
4. Fix the highest-risk breakage first.
5. Keep the change minimal and localized.
6. Add or update tests for parsing, classification, pagination, or access-control behavior when possible.
7. Verify the final UI state for loading, empty, error, and success cases.

## Decision Rules
- If the problem affects authorization or data integrity, treat it as S0 or S1 and fix it before UI polish.
- If backend and frontend disagree on shape or semantics, preserve backward compatibility and add defensive parsing.
- If the page can encounter deleted related records or missing metadata, always provide fallback display values.
- If search or filtering is involved, reset stale pagination state and validate cursor handling.
- If the change would introduce extra API calls or expensive repeated work, simplify the flow before expanding features.

## Checks
- Confirm unauthorized users cannot reach protected data through the API even if the UI is gated.
- Confirm the page does not crash on null, undefined, or malformed response data.
- Confirm pagination remains stable across search and filter changes.
- Confirm any new backend behavior still matches existing response shapes or has explicit compatibility handling.
- Confirm there are no silent failures in audit writes, enrichment, or lookup fallbacks.

## Constraints
- Prefer minimal, targeted edits.
- Do not rewrite unrelated code.
- Do not add dependencies casually.
- Keep TypeScript types aligned with actual API responses.
- Preserve existing security assumptions and server-side authorization as the source of truth.

## Definition of Done
A change is complete only when:
- the expected audit-log behavior works end to end,
- no runtime or console errors are introduced,
- edge cases and fallback states are handled,
- authorization remains intact,
- search and pagination still behave predictably,
- and any feasible tests or verification steps have been updated.

## Example Uses
- Debugging missing or incorrect audit entries.
- Fixing audit-log search, pagination, or filtering.
- Updating audit enrichment when related records are deleted.
- Hardening Netlify audit endpoints against malformed input or missing identity fields.
- Reviewing audit-log UI regressions after a backend change.
