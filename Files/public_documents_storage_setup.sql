-- Public documents storage bucket and policy setup
-- Run this in Supabase SQL Editor for the same project your localhost uses.
--
-- This matches app upload paths:
--   bucket: public-documents
--   object key: documents/{timestamp}_{filename}
--
-- Write access is admin-only, aligned with app checks:
--   app_metadata.role in ('admin','super_admin') OR is_admin=true in app/user metadata.

insert into storage.buckets (id, name, public)
values ('public-documents', 'public-documents', true)
on conflict (id) do update set public = excluded.public;

-- Helper predicate repeated inline to avoid creating SQL functions.
-- Keep comparisons as text to avoid cast issues when claims are missing/stringified.
-- (
--   lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'super_admin')
--   or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
--   or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'is_admin', 'false')) = 'true'
-- )

-- Public read for all files in this bucket.
drop policy if exists "Public documents read" on storage.objects;
create policy "Public documents read"
on storage.objects
for select
using (bucket_id = 'public-documents');

-- Admin-only insert into documents/* path.
drop policy if exists "Public documents admin insert" on storage.objects;
create policy "Public documents admin insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'public-documents'
  and split_part(name, '/', 1) = 'documents'
  and (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'super_admin')
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'is_admin', 'false')) = 'true'
  )
);

-- Admin-only update within documents/* path.
drop policy if exists "Public documents admin update" on storage.objects;
create policy "Public documents admin update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'public-documents'
  and split_part(name, '/', 1) = 'documents'
  and (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'super_admin')
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'is_admin', 'false')) = 'true'
  )
)
with check (
  bucket_id = 'public-documents'
  and split_part(name, '/', 1) = 'documents'
  and (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'super_admin')
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'is_admin', 'false')) = 'true'
  )
);

-- Admin-only delete within documents/* path.
drop policy if exists "Public documents admin delete" on storage.objects;
create policy "Public documents admin delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'public-documents'
  and split_part(name, '/', 1) = 'documents'
  and (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'super_admin')
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'is_admin', 'false')) = 'true'
  )
);
