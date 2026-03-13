# Admin Audit Log

## Manual SQL setup
Run `Files/admin_audit_log.sql` in the Supabase SQL editor.

This creates:
- `public.admin_audit_log` table
- indexes for `created_at`, `admin_uid`, `action`, `entity_type`, `entity_id`
- RLS policies for super-admin read and admin/super-admin insert

## Frontend changes
- `ToolsModal` includes two new views: **Audit Log** and **Admins**.
- UI visibility can use `VITE_SUPER_ADMIN_UID` as a quick toggle.
- Server authorization is authoritative (Bearer token validation + super-admin check).
- Audit Log is displayed in a table format with transaction-style rows.
- Audit Log view keeps a single search bar for admin-name search.

## DataContext audit events
- `logAuditEvent()` records mutation activity to `admin_audit_log`.
- Logging is fire-and-forget and only runs for the super-admin UID above.
- `adjustSubscriptionForMisc()` is included in audit tracking.

## Netlify function
Endpoint: `/.netlify/functions/get-audit-logs`

Supported methods:
- `GET`
- `POST`

Simple server authorization:
- requires `Authorization: Bearer <supabase_access_token>`
- validates token server-side and checks super-admin via UID/env/role/lookup

Supported query params:
- `page`, `page_size`
- `search` (admin name / email)

Behavior:
- Server enforces a rolling 30-day window for returned audit logs.

## Retention cleanup
- Scheduled function: `cleanup-audit-logs-cron`
- Schedule: daily (`0 0 * * *`)
- Effect: permanently deletes `admin_audit_log` records older than 30 days.

## Optional environment variables
Server (Netlify):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPER_ADMIN_UID`

Client (Vite):
- `VITE_SUPER_ADMIN_UID` (optional; UI toggle only, not authorization)
