-- Manual migration: Admin Audit Log
-- Run this in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_uid uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_admin_uid_idx
  on public.admin_audit_log (admin_uid);

create index if not exists admin_audit_log_action_idx
  on public.admin_audit_log (action);

create index if not exists admin_audit_log_entity_type_idx
  on public.admin_audit_log (entity_type);

create index if not exists admin_audit_log_entity_id_idx
  on public.admin_audit_log (entity_id)
  where entity_id is not null;

alter table public.admin_audit_log enable row level security;

create table if not exists public.super_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

drop policy if exists "Super admins can view self membership" on public.super_admins;
create policy "Super admins can view self membership"
on public.super_admins
for select
to authenticated
using (auth.uid() = user_id);

grant select on public.super_admins to authenticated;

drop policy if exists "Super admin can read admin audit log" on public.admin_audit_log;
create policy "Super admin can read admin audit log"
on public.admin_audit_log
for select
to authenticated
using (
  exists (
    select 1
    from public.super_admins sa
    where sa.user_id = auth.uid()
  )
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'super_admin'
);

drop policy if exists "Super admin can insert admin audit log" on public.admin_audit_log;
drop policy if exists "Admins can insert admin audit log" on public.admin_audit_log;
create policy "Admins can insert admin audit log"
on public.admin_audit_log
for insert
to authenticated
with check (
  (
    exists (
      select 1
      from public.super_admins sa
      where sa.user_id = auth.uid()
    )
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'super_admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'is_admin', 'false') = 'true'
  )
  and admin_uid = auth.uid()
);

grant select, insert on public.admin_audit_log to authenticated;