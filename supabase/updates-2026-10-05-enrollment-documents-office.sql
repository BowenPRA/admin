-- PRA Admin: enrollment documents for the whole office (5 October 2026).
-- Run once in Supabase > SQL Editor, after the enrollment files of
-- 30 September and 1 October. Safe to run again.
--
-- Until now the private part of an enrollment form (ID and passport numbers,
-- the documents the parents uploaded, the signature) could be opened by the
-- super admin only. From here on every office account (super admin, head,
-- admin) can read it and open the documents, the same accounts that see the
-- Enrollments page. Removing a document, or a whole form, stays with the
-- super admin. The website's own rights do not change.

drop policy if exists super_read on adm_enrollment_private;
drop policy if exists office_read on adm_enrollment_private;
create policy office_read on adm_enrollment_private for select to authenticated
  using (adm_is_staff());

drop policy if exists adm_enrollment_open on storage.objects;
create policy adm_enrollment_open on storage.objects for select to authenticated
  using (bucket_id = 'adm-enrollment' and adm_is_staff());

-- Check: both rules are in place and name the office, not the super admin.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'adm_enrollment_private' and policyname = 'office_read' and qual like '%adm_is_staff%') then
    raise exception 'The office read rule on adm_enrollment_private is missing.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'adm_enrollment_open' and qual like '%adm_is_staff%') then
    raise exception 'The office rule on the adm-enrollment folder is missing.';
  end if;
end $$;
