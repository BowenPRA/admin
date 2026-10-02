-- PRA Admin: student dates and the new-student process (2 October 2026).
-- Run once in Supabase > SQL Editor, after the earlier update files. Safe to run
-- again. The app can be deployed before or after it: until it has run, students
-- save without an expected end date (lib/db.js).
--
--   Part 1. Expected end date (To-Do #37)
--   Part 2. New-student checklist (To-Do #38): added below by the next piece of work.
--
-- Grants (To-Do #22): from 30 October 2026 Supabase no longer gives new tables in
-- `public` to the API roles by itself, so every part that creates a table grants
-- what it needs explicitly. Part 1 only adds a column to adm_students; the grant
-- below restates the one the table already has, so nothing changes for it.


-- ===========================================================================
-- Part 1. Expected end date (To-Do #37)
-- ===========================================================================
--
-- end_date is the last day a student is expected to come. It only informs:
-- after it the attendance register and summaries stop expecting the student,
-- the invoice builder leaves them out of quarters that begin after it, and Home
-- and Students show who finishes this quarter. The status (active, pending,
-- past) is never changed by it; the office still sets that by hand.

alter table adm_students add column if not exists end_date date;
comment on column adm_students.end_date is
  'Expected last day at PRA. Informs attendance, the invoice builder and Home; never changes the status by itself.';

grant select, insert, update, delete on adm_students to authenticated;

-- Gene (BLE0055), Hunter (BLE0056) and Oliver (S0136) finish at the end of
-- Quarter 1 (Bowen, 2 October 2026). Matched by student code, and only where no
-- end date is set yet, so a date the office has typed since is kept. The date
-- is Quarter 1's last day in the calendar the app uses (Settings), or 8 October
-- 2026 as in the app's built-in calendar when none is saved.
update adm_students
set end_date = coalesce(
      (select (q ->> 'end')::date
       from adm_settings,
            jsonb_array_elements(case when key = 'calendar' and jsonb_typeof(value -> 'quarters') = 'array' then value -> 'quarters' end) q
       where key = 'calendar' and q ->> 'id' = 'q1' and q ->> 'end' ~ '^\d{4}-\d{2}-\d{2}$'
       limit 1),
      date '2026-10-08'),
    updated_at = now()
where student_code in ('BLE0055', 'BLE0056', 'S0136') and end_date is null;

notify pgrst, 'reload schema';

select 'Expected end dates are set up. ' || coalesce(
  (select string_agg(coalesce(nullif(nickname, ''), full_name) || ' (' || student_code || '): ' || to_char(end_date, 'DD Mon YYYY'), ', ' order by student_code)
   from adm_students where student_code in ('BLE0055', 'BLE0056', 'S0136') and end_date is not null),
  'Gene, Hunter and Oliver were not found by their student codes.') as result;
