-- PRA Admin: proof of payment on receipts (21 September 2026). Run once in
-- Supabase > SQL Editor, after the earlier update files. Safe to run again.

-- 1. Each payment keeps a list of its proof files (bank transfer screenshots):
--    [{ path, name, type, size, added_at }]. The files themselves are in Storage.
alter table adm_payments add column if not exists proof jsonb default '[]'::jsonb;

-- 2. A private bucket for them: nothing in it has a public link; the app asks
--    for a short-lived signed link when someone opens a file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adm-receipts', 'adm-receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. Only office accounts (super_admin, head, admin) may read, add or remove them,
--    the same people who may see invoices and payments.
drop policy if exists adm_receipts_office on storage.objects;
create policy adm_receipts_office on storage.objects for all to authenticated
  using (bucket_id = 'adm-receipts' and adm_is_staff())
  with check (bucket_id = 'adm-receipts' and adm_is_staff());
