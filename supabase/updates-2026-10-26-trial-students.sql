-- PRA Admin: trial students (26 October 2026).
-- Run once in Supabase > SQL Editor, after the earlier update files. Safe to run
-- again. The app can be deployed before or after it: until it has run, students
-- save as before, and only setting trial days says which file to run.
--
-- A trial student is a Pending student booked to try some days in class.
-- trial_from and trial_to are the first and last trial day. On those days the
-- register lists the student at the top of their year group, and the Home page
-- shows them to the teachers of that class. Nothing else changes: they stay
-- Pending (no progress reports, not counted as enrolled, invoiced as usual).
-- Setting them to Enrolled ends the trial; the dates are kept as a record.
--
-- No new table, so no new grants or rules: the table's own (office accounts
-- change students, teachers read them) apply. The grant line restates the one
-- the table already has (supabase/README.md, To-Do #22).

alter table adm_students add column if not exists trial_from date;
alter table adm_students add column if not exists trial_to date;

alter table adm_students drop constraint if exists adm_students_trial_check;
alter table adm_students add constraint adm_students_trial_check
  check (trial_from is null or trial_to is null or trial_to >= trial_from);

comment on column adm_students.trial_from is
  'First trial day of a Pending student booked to try some days in class. Blank for everyone else.';
comment on column adm_students.trial_to is
  'Last trial day (the same as trial_from for a one-day trial).';

grant select, insert, update, delete on adm_students to authenticated;

notify pgrst, 'reload schema';

select 'Trial students are set up.' as result;
