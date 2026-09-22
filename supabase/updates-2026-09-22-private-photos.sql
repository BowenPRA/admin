-- PRA Admin: student photos behind the login (22 September 2026). Run once in
-- Supabase > SQL Editor, after the earlier update files. Safe to run again.
--
-- Until now the photos were files on the public website. They now live in a
-- private bucket: nothing in it has a public link, and the app asks for signed
-- links once someone has signed in. After running this, upload the photos with
--   node scripts/upload-student-photos.mjs
-- Student rows keep their photo path ("photos/sunny.jpg"); nothing else changes.

-- 1. The bucket. Portraits are small JPEGs, so 2 MB is plenty.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adm-photos', 'adm-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 2. Anyone who can see students (office, head teachers and active teachers,
--    the same as adm_students) may view the photos.
drop policy if exists adm_photos_read on storage.objects;
create policy adm_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'adm-photos' and adm_is_report_staff());

-- 3. Only the people who may edit students may add, replace or remove them.
drop policy if exists adm_photos_write on storage.objects;
create policy adm_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'adm-photos' and (adm_is_staff() or adm_is_head()));
drop policy if exists adm_photos_update on storage.objects;
create policy adm_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'adm-photos' and (adm_is_staff() or adm_is_head()))
  with check (bucket_id = 'adm-photos' and (adm_is_staff() or adm_is_head()));
drop policy if exists adm_photos_delete on storage.objects;
create policy adm_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'adm-photos' and (adm_is_staff() or adm_is_head()));
