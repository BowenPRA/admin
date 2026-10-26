-- PRA Admin: the "Sent" report status (26 October 2026).
-- Run once in Supabase > SQL Editor, after the earlier update files. Safe to run again.
--
-- Reports now go Draft -> Ready to review -> Published -> Sent. Sent means published
-- and emailed to the family. The head ticks reports on the Reports page and sets
-- them to Sent together. A sent report stays locked like a published one: only the
-- head can change it, and teachers cannot edit its parts.
--
-- The status column takes any text, so nothing else changes. Until this file is run
-- the app already locks sent reports on screen; this makes the database agree.

-- 1. Learning areas: a teacher may write their part only while the report is not
--    published or sent. The head may always.
create or replace function adm_can_subject_in_report(sk text, rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select adm_is_head()
      or exists (select 1 from adm_teachers t, adm_reports r
                 where r.id = rid and coalesce(r.status, '') not in ('published', 'sent')
                   and t.email = adm_email() and coalesce(t.active, true)
                   and (sk || ':' || r.year_group) = any(t.subjects))
$$;

-- 2. The report itself: the homeroom teacher may change it while it is not published
--    or sent, and may not set either status. The head may always.
drop policy if exists hr_update on adm_reports;
create policy hr_update on adm_reports for update to authenticated
  using (adm_can_homeroom(year_group) and (adm_is_head() or coalesce(status, '') not in ('published', 'sent')))
  with check (adm_can_homeroom(year_group) and (adm_is_head() or coalesce(status, '') not in ('published', 'sent')));

notify pgrst, 'reload schema';

select 'Sent is set up: ' || (select count(*) from adm_reports where status = 'sent') || ' reports sent so far.' as result;
