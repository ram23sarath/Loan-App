-- Avatar storage bucket and policy setup
-- Apply manually in Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- Public read for avatars bucket
drop policy if exists "Avatar bucket public read" on storage.objects;

create policy "Avatar bucket public read"
on storage.objects
for select
using (bucket_id = 'avatars');

-- Authenticated users may insert only into their own users/{uid}/avatar.{ext} path.
drop policy if exists "Avatar bucket insert own folder" on storage.objects;

create policy "Avatar bucket insert own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) ~ '^avatar\\.(webp|jpg|jpeg|png)$'
);

-- Authenticated users may update only their own avatar path.
drop policy if exists "Avatar bucket update own folder" on storage.objects;

create policy "Avatar bucket update own folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 2) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) ~ '^avatar\\.(webp|jpg|jpeg|png)$'
);

-- Authenticated users may delete only within their own folder.
drop policy if exists "Avatar bucket delete own folder" on storage.objects;

create policy "Avatar bucket delete own folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 2) = auth.uid()::text
);
